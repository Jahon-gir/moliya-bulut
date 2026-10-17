// Statistika ekrani (TZ-sinxronlash.md 34-band, daromad grafigi 34.5, 2-qism 35-band) uchun brauzer sinovi: HAQIQIY ilova (index.html, haqiqiy IndexedDB), faqat UYDIRMA yozuvlar.
// Faqat ishlab chiqish vaqtida; ilovaning o'zi uni ishlatmaydi.
// Ishga tushirish: avval  python3 -m http.server 8000  (repozitoriy papkasida), keyin
//   node tools/stat-brauzer-sinovi.js [rasmlar_papkasi]      (Playwright va Chromium kerak; PLAYWRIGHT_MODULE, CHROMIUM_PATH, ILOVA_MANZIL o'zgaruvchilari ixtiyoriy)
// Yorug' va qorong'i rejimda 360 px kenglikda yuradi, ekran rasmlari papkaga yoziladi. Xato bo'lsa chiqish kodi 1.
const fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const MANZIL = process.env.ILOVA_MANZIL || 'http://localhost:8000/index.html';
const RASMLAR = process.argv[2] || path.join(os.tmpdir(), 'stat-rasmlar');
fs.mkdirSync(RASMLAR, { recursive: true });

let jami = 0, xatolar = 0;
function teng(haqiqiy, kutilgan, izoh) {
  jami++;
  if (JSON.stringify(haqiqiy) !== JSON.stringify(kutilgan)) { xatolar++; console.log('  ✗ ' + izoh + ' — kutilgan: ' + JSON.stringify(kutilgan) + ', chiqdi: ' + JSON.stringify(haqiqiy)); }
}
const raqamlar = (s) => String(s).replace(/[^0-9]/g, '');

async function senariy(brauzer, tema) {
  console.log('== ' + tema + ' rejim, 360 px ==');
  const kontekst = await brauzer.newContext({ viewport: { width: 360, height: 740 }, colorScheme: tema, serviceWorkers: 'block' });
  const p = await kontekst.newPage();
  p.on('pageerror', (e) => { if (!/IDBObjectStore/.test(e.message)) { xatolar++; console.log('  ✗ PAGEERROR ' + e.message); } });
  await p.goto(MANZIL);
  await p.waitForFunction(() => typeof Data !== 'undefined' && document.querySelector('#ekran h1'));
  // Uydirma yozuvlar: oxirgi ~100 kun, har kuni 1–2 ta xarajat; ba'zilari vaqtsiz; bitta qarz va daromad
  await p.evaluate(async () => {
    const kats = (await Data.hammasi('kategoriyalar')).filter((k) => k.tur === 'xarajat'), his = (await Data.hammasi('hisoblar'))[0];
    const dk = (await Data.hammasi('kategoriyalar')).filter((k) => k.tur === 'daromad')[0];
    const bugun = new Date(); const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    for (let i = 0; i < 100; i++) {
      const d = new Date(bugun.getFullYear(), bugun.getMonth(), bugun.getDate() - i);
      const n = 1 + (i % 2);
      for (let j = 0; j < n; j++) {
        const kat = kats[(i * 3 + j * 2) % Math.min(kats.length, 8)];
        await Data.saqlash('yozuvlar', { id: Data.yangiId(), yaratilgan: new Date().toISOString(), tur: 'xarajat', summa: 8000 + ((i * 7919 + j * 1301) % 90) * 1000 + (d.getDay() === 6 ? 60000 : 0), sana: iso(d), vaqt: (i % 9 === 0 && j === 1) ? '' : String(6 + ((i + j * 5) % 16)).padStart(2, '0') + ':15', hisob_id: his.id, kategoriya_id: kat.id, izoh: '' });
      }
      if (i % 20 === 0) await Data.saqlash('yozuvlar', { id: Data.yangiId(), yaratilgan: new Date().toISOString(), tur: 'daromad', summa: 3000000, sana: iso(d), vaqt: '09:00', hisob_id: his.id, kategoriya_id: dk.id, izoh: '' });
    }
    await Data.saqlash('qarzlar', { id: Data.yangiId(), yaratilgan: new Date().toISOString(), yonalish: 'oldim', shaxs: 'Bobur', summa: 900000, hisob_id: his.id, sana: iso(new Date(bugun.getFullYear(), bugun.getMonth(), 1)), vaqt: '10:00', muddat: '', izoh: '', tolovlar: [{ id: Data.yangiId(), sana: iso(bugun), vaqt: '09:00', summa: 150000, hisob_id: his.id }], yopilgan: false });
    await Data.saqlash('qarzlar', { id: Data.yangiId(), yaratilgan: new Date().toISOString(), yonalish: 'berdim', shaxs: 'Karim', summa: 400000, hisob_id: his.id, sana: iso(new Date(bugun.getFullYear(), bugun.getMonth(), 1)), vaqt: '10:00', muddat: '', izoh: '', tolovlar: [], yopilgan: false });
  });
  await p.reload();
  await p.waitForFunction(() => document.querySelector('#ekran h1'));
  // Asosiy "Naqd pul oqimi" xarajati (joriy oy)
  const asosiyXarajat = raqamlar(await p.textContent('.oqim-xarajat .oqim-raqam')), asosiyDaromad = raqamlar(await p.textContent('.oqim-daromad .oqim-raqam'));
  await p.click('[data-bolim="koproq"]');
  teng(await p.isVisible('#kp-statistika'), true, '"Ko\'proq" menyusida "Statistika" bor');
  await p.click('#kp-statistika');
  teng(await p.textContent('h1'), 'Statistika', 'to\'liq ekran sarlavhasi');
  teng(await p.isVisible('.orqaga-tugma'), true, 'Orqaga tugmasi');
  teng(await p.locator('#ekran > .karta, #ekran .st-karta').count(), 7, '7 ta karta (4 + tejash, eng katta/kam, qarz)');
  teng(await p.locator('.oy-yorliq').count() >= 12, true, 'oy chiplari');
  teng(await p.textContent('.st-grafik h2'), 'Daromad va xarajat grafigi', 'karta nomi');
  const jamiX = raqamlar(await p.textContent('#stat-jami-xarajat')), jamiD = raqamlar(await p.textContent('#stat-jami-daromad'));
  teng(jamiX, asosiyXarajat, 'Jami xarajat Asosiy "Naqd pul oqimi" bilan bir xil (' + jamiX + ')');
  teng(jamiD, asosiyDaromad, 'Jami daromad Asosiy "Naqd pul oqimi" bilan bir xil (' + jamiD + ')');
  teng(await p.evaluate(() => [...document.querySelectorAll('.st-seriya')].map((b) => [getComputedStyle(b.querySelector('.st-seriya-kv')).backgroundColor, Math.round(b.getBoundingClientRect().height) >= 44, b.getBoundingClientRect().top === document.querySelector('.st-seriya').getBoundingClientRect().top])), [['rgb(29, 158, 117)', true, true], ['rgb(216, 90, 48)', true, true]], 'katakchalar yonma-yon: daromad #1D9E75 chapda, xarajat #D85A30 o\'ngda');
  const olchov = async (izoh) => {
    teng(await p.evaluate(() => document.documentElement.scrollWidth <= 360 && document.getElementById('ekran').scrollWidth <= 360), true, izoh + ': gorizontal aylanish yo\'q');
    teng(await p.evaluate(() => [...document.querySelectorAll('#ekran button')].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && getComputedStyle(b).visibility !== 'hidden' && !b.closest('[hidden]') && r.height < 43.5; }).map((b) => b.className + ':' + b.textContent)), [], izoh + ': tugmalar ≥ 44 px');
    teng(await p.evaluate(() => [...document.querySelectorAll('.sig, .st-karta')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.className)), [], izoh + ': raqamlar kartadan chiqmaydi');
  };
  await olchov('ustun/oy');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-1-ustun-oy.png'), fullPage: true });
  const oyKunlari = await p.evaluate(() => new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate());
  teng([await p.locator('.st-grafik .st-ustun-d').count(), await p.locator('.st-grafik .st-ustun-x').count()], [oyKunlari, oyKunlari], 'oy: har kunda juft ustun');
  // seriyani yashirish / qaytarish; oxirgisini yashirib bo'lmaydi
  await p.click('#stat-seriya-daromad');
  teng([await p.locator('.st-grafik .st-ustun-d').count(), await p.locator('.st-grafik .st-ustun-x').count(), await p.getAttribute('#stat-seriya-daromad', 'aria-pressed')], [0, oyKunlari, 'false'], 'daromad yashirildi');
  teng(await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#stat-seriya-daromad')).opacity)), 0.45, 'yashirilgan katak xira');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-1b-daromad-yashirin.png') });
  await p.click('#stat-seriya-xarajat', { force: true });   // aria-disabled: oxirgisi
  teng(await p.getAttribute('#stat-seriya-xarajat', 'aria-pressed'), 'true', 'oxirgi ko\'rinib turganini yashirib bo\'lmaydi');
  await p.click('#stat-seriya-daromad');
  teng(await p.locator('.st-grafik .st-ustun-d').count(), oyKunlari, 'qayta bossa qaytdi');
  await p.click('#stat-seriya-xarajat');
  teng([await p.locator('.st-grafik .st-ustun-x').count(), await p.locator('.st-grafik .st-ustun-d').count()], [0, oyKunlari], 'xarajat yashirildi: daromad qoldi');
  teng(await p.evaluate(() => { const j = JSON.parse(localStorage.getItem('moliya-stat-grafik')); return [j.daromad, j.xarajat]; }), [true, false], 'tanlov saqlandi');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-1c-xarajat-yashirin.png') });
  await p.click('#stat-seriya-xarajat');
  // grafik turlari
  for (const [tur, soz] of [['chiziq', 'chiziq'], ['maydon', 'maydon'], ['doira', 'doira']]) {
    if (tur === 'doira') {}
    await p.click('#stat-tur');
    if (tur === 'chiziq') await p.screenshot({ path: path.join(RASMLAR, tema + '-2-tur-menyusi.png') });
    await p.click('[data-tur="' + tur + '"]');
    teng(await p.evaluate(() => JSON.parse(localStorage.getItem('moliya-stat-grafik')).tur), tur, tur + ' tanlovi saqlandi');
    await olchov(soz);
    await p.screenshot({ path: path.join(RASMLAR, tema + '-3-' + tur + '.png'), fullPage: false });
  }
  teng(await p.locator('.st-seriyalar').count(), 0, 'doira: katakchalar o\'rniga almashtirgich');
  teng(await p.evaluate(() => [...document.querySelectorAll('.st-ulush button')].map((b) => b.textContent)), ['Xarajat ulushi', 'Daromad ulushi'], 'ikki bo\'lakli almashtirgich');
  teng(await p.locator('.st-davr button:disabled').count(), 4, 'doira: davr tugmalari xira');
  teng(await p.evaluate(() => getComputedStyle(document.querySelector('.st-davr')).opacity), '0.45', 'xira ko\'rinish');
  const leg = await p.locator('.st-leg-qator').count(); teng(leg >= 1 && leg <= 6, true, 'legenda ≤ 6 ta (' + leg + ')');
  teng(await p.evaluate(() => [...document.querySelectorAll('.st-leg-foiz')].reduce((a, e) => a + parseInt(e.textContent, 10), 0)), 100, 'legenda foizlari yig\'indisi 100');
  // daromad ulushi
  await p.click('[data-ulush="daromad"]');
  const legD = await p.locator('.st-leg-qator').count(); teng(legD >= 1 && legD <= 6, true, 'daromad ulushi: legenda ≤ 6 ta (' + legD + ')');
  teng(await p.evaluate(() => [...document.querySelectorAll('.st-leg-foiz')].reduce((a, e) => a + parseInt(e.textContent, 10), 0)), 100, 'daromad foizlari yig\'indisi 100');
  teng(raqamlar(await p.textContent('#stat-jami strong')), asosiyDaromad, 'daromad ulushi jami = Asosiy daromad');
  teng(await p.evaluate(() => JSON.parse(localStorage.getItem('moliya-stat-grafik')).ulush), 'daromad', 'ulush saqlandi');
  await olchov('doira/daromad');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-3b-doira-daromad.png') });
  await p.click('[data-ulush="xarajat"]');
  // davr tugmalari: tur ustunga qaytib
  await p.click('#stat-tur'); await p.click('[data-tur="ustun"]');
  for (const d of ['kun', 'hafta', 'yil']) {
    await p.click('[data-davr="' + d + '"]');
    teng(await p.evaluate(() => JSON.parse(localStorage.getItem('moliya-stat-grafik')).davr), d, d + ' tanlovi saqlandi');
    await olchov(d);
    if (d === 'kun') teng(await p.textContent('.st-grafik .st-izoh'), 'Vaqti yozilmagan yozuvlar kunlik grafikka kirmaydi.', 'kun: vaqt izohi');
    await p.screenshot({ path: path.join(RASMLAR, tema + '-4-davr-' + d + '.png'), fullPage: false });
  }
  teng([await p.locator('.st-grafik .st-ustun-d').count(), await p.locator('.st-grafik .st-ustun-x').count()], [12, 12], 'yil: 12 juft ustun');
  // ‹ ›
  await p.click('[data-davr="oy"]');
  const nom0 = await p.textContent('#stat-davr-nomi');
  teng(await p.isDisabled('[aria-label="Keyingi davr"]'), true, 'hozirgi oydan keyin yo\'q');
  await p.click('[aria-label="Oldingi davr"]');
  teng((await p.textContent('#stat-davr-nomi')) !== nom0, true, 'oldingi oyga o\'tdi');
  teng(await p.getAttribute('.oy-yorliq[aria-selected="true"]', 'data-oy'), await p.evaluate(() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }), 'chip ham ko\'chdi');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-5-otgan-oy.png'), fullPage: true });
  // eng qimmat kun: oy kuni
  await p.click('[data-rejim="oy"]');
  teng(await p.locator('.st-svg-qimmat .st-ustun').count(), 31, 'oy kuni: 31 ustun');
  teng(await p.locator('.st-svg-qimmat .st-ustun-eng').count(), 1, 'eng qimmati bitta (qizil)');
  teng(await p.evaluate(() => getComputedStyle(document.querySelector('.st-ustun-eng')).fill === getComputedStyle(document.querySelector('.st-qimmat-nom')).color), true, 'eng qimmati qizil (sarlavhadagi nom bilan bir xil)');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-6-qimmat-oy.png'), fullPage: true });
  // qayta ochilganda tur va davr eslab qolingan, qimmat — hafta kuni
  await p.reload(); await p.waitForFunction(() => document.querySelector('#ekran h1'));
  await p.click('[data-bolim="koproq"]'); await p.click('#kp-statistika');
  teng(await p.getAttribute('.st-davr [aria-pressed="true"]', 'data-davr'), 'oy', 'davr eslab qolindi'); teng(await p.getAttribute('[data-rejim="hafta"]', 'aria-pressed'), 'true', 'qimmat kun: hafta kuni');
  await p.click('[aria-label="Oldingi davr"]'); await p.click('.oy-yorliq[aria-selected="false"] >> nth=-1');
  teng(await p.textContent('#stat-davr-nomi') !== undefined, true, 'chip bosildi');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-7-qayta-ochildi.png'), fullPage: true });
  // 2-qism: tejash ulushi, eng katta/kam, qarz hisoboti (tanlangan oy — joriy)
  await p.click('.oy-yorliq:last-child');
  teng(await p.evaluate(() => document.querySelector('.oy-yorliq[aria-selected="true"]').getAttribute('data-oy') === (new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0'))), true, 'joriy oy tanlandi');
  const D = Number(asosiyDaromad), X = Number(asosiyXarajat), kutilgan = Math.round((D - X) * 100 / D);
  teng(await p.textContent('#stat-tejash-foiz'), (kutilgan < 0 ? '−' : '') + Math.abs(kutilgan) + '%', 'tejash ulushi = (kirim − chiqim) / kirim (Asosiy bilan bir xil kirim/chiqim)');
  teng(await p.evaluate(() => { const sx = parseFloat(document.querySelector('.st-bar-sarf').style.width), q = parseFloat(document.querySelector('.st-bar-qoldi').style.width); return sx + q; }), 100, 'chiziq 100% ga to\'ladi');
  await p.evaluate(() => document.querySelector('.st-tejash').scrollIntoView({ block: 'start' })); await p.waitForTimeout(100);
  await olchov('tejash');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-8-tejash-katta.png') });
  const katta = await p.evaluate(() => [...document.querySelectorAll('#stat-royxat .st-qator-summa')].map((e) => Number(e.textContent.replace(/[^0-9]/g, ''))));
  teng([katta.length, katta.every((v, i) => i === 0 || katta[i - 1] >= v)], [5, true], 'eng katta 5 xarajat: 5 ta, kamayish tartibida');
  teng(await p.evaluate(() => [...document.querySelectorAll('#stat-royxat .st-qator-nom')].some((e) => /Berilgan qarz/.test(e.textContent))), false, 'qarz berish ro\'yxatda yo\'q');
  await p.click('[data-royxat="kam"]');
  const kam = await p.evaluate(() => [...document.querySelectorAll('#stat-royxat .st-qator-summa')].map((e) => Number(e.textContent.replace(/[^0-9]/g, ''))));
  teng([kam.length >= 1 && kam.length <= 5, kam.every((v, i) => i === 0 || kam[i - 1] <= v), kam.every((v) => v > 0)], [true, true, true], 'eng kam kunlar: o\'sish tartibida, 0 yo\'q');
  teng(/^Xarajatsiz kunlar \(\d+ ta\) kirmaydi\.$/.test(await p.textContent('#stat-kam-izoh')), true, 'xarajatsiz kunlar izohi');
  await olchov('eng kam');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-9-kam.png') });
  await p.evaluate(() => document.querySelector('.st-qarz').scrollIntoView({ block: 'start' })); await p.waitForTimeout(100);
  teng(await p.locator('.st-qarz-h').count(), 4, 'qarz: 4 ta harakat katagi');
  teng(await p.evaluate(() => { const r = [...document.querySelectorAll('.st-qarz-h')].map((e) => e.getBoundingClientRect().top); return r.every((t) => t === r[0]); }), true, '4 ta katak bir qatorda');
  teng(await p.evaluate(() => { const a = document.querySelector('#stat-qarz-men').closest('.st-qarz-katak').getBoundingClientRect(), b = document.querySelector('#stat-qarz-menga').closest('.st-qarz-katak').getBoundingClientRect(); return a.top === b.top && a.left < b.left; }), true, 'Men qarzdorman chapda, Menga qarzdor o\'ngda');
  teng(await p.evaluate(() => [...document.querySelectorAll('.st-qarz .st-qator-nom')].map((e) => e.textContent)), ['Bobur', 'Karim'], 'eng katta qoldiqlar (uydirma ismlar)');
  teng(await p.getAttribute('.st-qarz-h >> nth=0', 'title') !== null, true, 'to\'liq summa title da');
  await olchov('qarz');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-10-qarz.png') });
  // Orqaga
  await p.click('.orqaga-tugma');
  teng(await p.isVisible('#kp-statistika'), true, 'Orqaga: Ko\'proq menyusi');
  await kontekst.close();
}

(async () => {
  const brauzer = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  for (const tema of ['light', 'dark']) await senariy(brauzer, tema);
  await brauzer.close();
  console.log(xatolar ? '✗ XATO: ' + xatolar + ' / ' + jami : '✓ Hammasi o\'tdi: ' + jami + ' tekshiruv');
  console.log('Rasmlar: ' + RASMLAR);
  process.exit(xatolar ? 1 : 0);
})();
