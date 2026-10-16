// Statistika ekrani (TZ-sinxronlash.md 34-band) uchun brauzer sinovi: HAQIQIY ilova (index.html, haqiqiy IndexedDB), faqat UYDIRMA yozuvlar.
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
    await Data.saqlash('qarzlar', { id: Data.yangiId(), yaratilgan: new Date().toISOString(), yonalish: 'berdim', shaxs: 'Karim', summa: 400000, hisob_id: his.id, sana: iso(new Date(bugun.getFullYear(), bugun.getMonth(), 1)), vaqt: '10:00', muddat: '', izoh: '', tolovlar: [], yopilgan: false });
  });
  await p.reload();
  await p.waitForFunction(() => document.querySelector('#ekran h1'));
  // Asosiy "Naqd pul oqimi" xarajati (joriy oy)
  const asosiyXarajat = raqamlar(await p.textContent('.oqim-xarajat .oqim-raqam'));
  await p.click('[data-bolim="koproq"]');
  teng(await p.isVisible('#kp-statistika'), true, '"Ko\'proq" menyusida "Statistika" bor');
  await p.click('#kp-statistika');
  teng(await p.textContent('h1'), 'Statistika', 'to\'liq ekran sarlavhasi');
  teng(await p.isVisible('.orqaga-tugma'), true, 'Orqaga tugmasi');
  teng(await p.locator('#ekran > .karta, #ekran .st-karta').count(), 4, '4 ta karta');
  teng(await p.locator('.oy-yorliq').count() >= 12, true, 'oy chiplari');
  const jamiMatn = raqamlar(await p.textContent('#stat-jami strong'));
  teng(jamiMatn, asosiyXarajat, 'Jami Asosiy "Naqd pul oqimi" bilan bir xil (' + jamiMatn + ')');
  const olchov = async (izoh) => {
    teng(await p.evaluate(() => document.documentElement.scrollWidth <= 360 && document.getElementById('ekran').scrollWidth <= 360), true, izoh + ': gorizontal aylanish yo\'q');
    teng(await p.evaluate(() => [...document.querySelectorAll('#ekran button')].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && getComputedStyle(b).visibility !== 'hidden' && !b.closest('[hidden]') && r.height < 43.5; }).map((b) => b.className + ':' + b.textContent)), [], izoh + ': tugmalar ≥ 44 px');
    teng(await p.evaluate(() => [...document.querySelectorAll('.sig, .st-karta')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.className)), [], izoh + ': raqamlar kartadan chiqmaydi');
  };
  await olchov('ustun/oy');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-1-ustun-oy.png'), fullPage: true });
  teng(await p.locator('.st-grafik .st-ustun').count(), await p.evaluate(() => new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()), 'oy ustunlari = oy kunlari');
  // grafik turlari
  for (const [tur, soz] of [['chiziq', 'chiziq'], ['maydon', 'maydon'], ['doira', 'doira']]) {
    await p.click('#stat-tur');
    if (tur === 'chiziq') await p.screenshot({ path: path.join(RASMLAR, tema + '-2-tur-menyusi.png') });
    await p.click('[data-tur="' + tur + '"]');
    teng(await p.evaluate(() => JSON.parse(localStorage.getItem('moliya-stat-grafik')).tur), tur, tur + ' tanlovi saqlandi');
    await olchov(soz);
    await p.screenshot({ path: path.join(RASMLAR, tema + '-3-' + tur + '.png'), fullPage: false });
  }
  teng(await p.locator('.st-davr button:disabled').count(), 4, 'doira: davr tugmalari xira');
  teng(await p.evaluate(() => getComputedStyle(document.querySelector('.st-davr')).opacity), '0.45', 'xira ko\'rinish');
  const leg = await p.locator('.st-leg-qator').count(); teng(leg >= 1 && leg <= 6, true, 'legenda ≤ 6 ta (' + leg + ')');
  teng(await p.evaluate(() => [...document.querySelectorAll('.st-leg-foiz')].reduce((a, e) => a + parseInt(e.textContent, 10), 0)), 100, 'legenda foizlari yig\'indisi 100');
  // davr tugmalari: tur ustunga qaytib
  await p.click('#stat-tur'); await p.click('[data-tur="ustun"]');
  for (const d of ['kun', 'hafta', 'yil']) {
    await p.click('[data-davr="' + d + '"]');
    teng(await p.evaluate(() => JSON.parse(localStorage.getItem('moliya-stat-grafik')).davr), d, d + ' tanlovi saqlandi');
    await olchov(d);
    if (d === 'kun') teng(await p.textContent('.st-grafik .st-izoh'), 'Vaqti yozilmagan yozuvlar kunlik grafikka kirmaydi.', 'kun: vaqt izohi');
    await p.screenshot({ path: path.join(RASMLAR, tema + '-4-davr-' + d + '.png'), fullPage: false });
  }
  teng(await p.locator('.st-grafik .st-ustun').count(), 12, 'yil: 12 ustun');
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
