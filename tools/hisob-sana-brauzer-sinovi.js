// Sana bo'yicha hisob qoldig'i (TZ-sinxronlash.md 49-band) uchun brauzer sinovi: HAQIQIY ilova (index.html, haqiqiy IndexedDB), faqat UYDIRMA ma'lumot.
// Faqat ishlab chiqish vaqtida; ilovaning o'zi uni ishlatmaydi.
// Ishga tushirish: avval  python3 -m http.server 8000  (repozitoriy papkasida), keyin
//   node tools/hisob-sana-brauzer-sinovi.js [rasmlar_papkasi]     (Playwright va Chromium kerak; PLAYWRIGHT_MODULE, ILOVA_MANZIL ixtiyoriy)
// 360 px kenglikda yorug' va qorong'i rejimda yuradi. Xato bo'lsa chiqish kodi 1.
const fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const MANZIL = process.env.ILOVA_MANZIL || 'http://localhost:8000/index.html';
const RASMLAR = process.argv[2] || path.join(os.tmpdir(), 'hisob-sana-rasmlar');
fs.mkdirSync(RASMLAR, { recursive: true });

let jami = 0, xatolar = 0;
function teng(haqiqiy, kutilgan, izoh) {
  jami++;
  if (JSON.stringify(haqiqiy) !== JSON.stringify(kutilgan)) { xatolar++; console.log('  ✗ ' + izoh + ' — kutilgan: ' + JSON.stringify(kutilgan) + ', chiqdi: ' + JSON.stringify(haqiqiy)); }
}
const bo = (s) => String(s).replace(/\s+/g, ' ').trim();

async function senariy(brauzer, tema) {
  console.log('== ' + tema + ' rejim, 360 px ==');
  const kontekst = await brauzer.newContext({ viewport: { width: 360, height: 780 }, colorScheme: tema, serviceWorkers: 'block' });
  const p = await kontekst.newPage();
  p.on('pageerror', (e) => { if (!/IDBObjectStore/.test(e.message)) { xatolar++; console.log('  ✗ PAGEERROR ' + e.message); } });
  await p.goto(MANZIL);
  await p.waitForFunction(() => typeof Data !== 'undefined' && document.querySelector('#ekran h1'));
  if (await p.locator('#salom-davom').count()) { await p.click('#salom-davom'); await p.waitForSelector('#salom-ekran', { state: 'detached' }); }
  // Uydirma ma'lumot: Karta A (1 000 000), Hamyon (500 000), Karta B (0), Hamyon. Daromad 2 000 000 — oy boshidan 40 kun oldin;
  // xarajat 300 000 — oy boshida; Karta B ga 800 000 — oy boshida.
  const sana = await p.evaluate(async () => {
    const t = Calc.tezkorSanalar(Calc.bugun());
    const oldin = (iso, n) => { const q = iso.split('-'); const d = new Date(Date.UTC(+q[0], +q[1] - 1, +q[2] - n)); return d.toISOString().slice(0, 10); };
    const yaratilgan = new Date().toISOString();
    const hA = await Data.saqlash('hisoblar', { yaratilgan, nom: 'Karta A', tur: 'karta', belgi: 'karta', rang: '#2F5DDB', oxirgi4: '', boshlangich_qoldiq: 1000000, arxivlangan: false });
    await Data.saqlash('hisoblar', { yaratilgan, nom: 'Hamyon', tur: 'naqd', belgi: 'naqd', rang: '#2E7D32', oxirgi4: '', boshlangich_qoldiq: 500000, arxivlangan: false });
    const hB = await Data.saqlash('hisoblar', { yaratilgan, nom: 'Karta B', tur: 'karta', belgi: 'karta', rang: '#8E24AA', oxirgi4: '', boshlangich_qoldiq: 0, arxivlangan: false });
    const hisoblar = await Data.hammasi('hisoblar'), id = (nom) => hisoblar.filter((h) => h.nom === nom)[0].id;
    const k1 = await Data.saqlash('kategoriyalar', { yaratilgan, nom: 'Maosh', tur: 'daromad', rang: '#2E7D32', belgi: 'wallet', arxivlangan: false });
    const k2 = await Data.saqlash('kategoriyalar', { yaratilgan, nom: 'Oziq-ovqat', tur: 'xarajat', rang: '#E65100', belgi: 'oziq', arxivlangan: false });
    const kat = await Data.hammasi('kategoriyalar'), kid = (nom) => kat.filter((k) => k.nom === nom)[0].id;
    const eski = oldin(t.oyBoshi, 40);
    await Data.saqlash('yozuvlar', { yaratilgan, tur: 'daromad', summa: 2000000, sana: eski, vaqt: '09:00', hisob_id: id('Karta A'), kategoriya_id: kid('Maosh'), izoh: '' });
    await Data.saqlash('yozuvlar', { yaratilgan, tur: 'xarajat', summa: 300000, sana: t.oyBoshi, vaqt: '00:01', hisob_id: id('Karta A'), kategoriya_id: kid('Oziq-ovqat'), izoh: '' });
    await Data.saqlash('yozuvlar', { yaratilgan, tur: 'daromad', summa: 800000, sana: t.oyBoshi, vaqt: '00:02', hisob_id: id('Karta B'), kategoriya_id: kid('Maosh'), izoh: '' });
    return { eski, oyBoshi: t.oyBoshi, otgan: t.otganOyOxiri, bugun: t.bugun };
  });
  await p.reload();
  await p.waitForFunction(() => document.querySelector('#ekran h1'));
  const rasm = (nom) => p.screenshot({ path: path.join(RASMLAR, tema + '-' + nom + '.png') });
  const olchov = async (izoh) => teng(await p.evaluate(() => document.documentElement.scrollWidth <= 360), true, izoh + ': gorizontal aylanish yo\'q');
  const hisoblarniOch = async () => { await p.click('[data-bolim="koproq"]'); await p.click('#kp-hisoblar'); await p.waitForSelector('#hisob-sana'); };
  const qatorlar = () => p.evaluate(() => [...document.querySelectorAll('.hisob-qatori')].map((q) => ({ nom: q.querySelector('.yozuv-nom').textContent, matn: q.innerText.replace(/\s+/g, ' ').trim(), pill: (q.querySelector('.sana-farq') || {}).className || null })));
  const oyOy = (iso) => iso.slice(0, 7);

  // ---- 1) Oddiy holat ----
  await hisoblarniOch();
  teng(bo(await p.textContent('#hisob-sana')), 'Bugun', 'pill matni');
  teng(await p.evaluate(() => { const t = document.getElementById('hisob-sana'), i = t.querySelector('.sana-pill-ich'); return [Math.round(t.getBoundingClientRect().height) >= 44, Math.round(i.getBoundingClientRect().height), i.classList.contains('tanlangan'), i.querySelectorAll('svg').length]; }), [true, 36, false, 2], 'pill: 44 px bosish maydoni, 36 px ko\'rinish, neytral, ikon + chevron');
  teng(await p.locator('#sana-tasma, #sana-jami').count(), 0, 'oddiy holatda tasma va jami karta yo\'q');
  teng((await qatorlar()).map((q) => q.nom).sort(), ['Hamyon', 'Karta A', 'Karta B', 'Naqd pul'], 'hisoblar (Naqd pul — ilovaning o\'z hisobi, 0)');
  await olchov('Hisoblar (oddiy)'); await rasm('1-oddiy');

  // ---- 2) Sana oynasi ----
  await p.click('#hisob-sana');
  await p.waitForSelector('.sana-oynasi');
  teng(await p.textContent('.sana-oynasi h2'), 'Sanani tanlang', 'oyna sarlavhasi');
  teng(await p.$$eval('.sana-chiplar .chip', (c) => c.map((x) => [x.textContent, x.getAttribute('aria-pressed'), Math.round(x.getBoundingClientRect().height) >= 44])), [['Bugun', 'true', true], ['Kecha', 'false', true], ['Oy boshi', 'false', true], ['O\'tgan oy oxiri', 'false', true]], 'chiplar');
  teng(await p.$$eval('.sana-hafta', (c) => c.map((x) => x.textContent).join(' ')), 'Du Se Ch Pa Ju Sh Ya', 'hafta tartibi');
  teng(await p.evaluate(() => document.querySelector('[data-oy="keyingi"]').disabled), true, 'keyingi oy tugmasi joriy oyda o\'chiq');
  teng(await p.evaluate(() => [...document.querySelectorAll('.sana-kun')].every((k) => Math.round(k.getBoundingClientRect().height) >= 40)), true, 'kun hujayralari kamida 40 px');
  teng(await p.evaluate((b) => { const k = document.querySelector('.sana-kun[data-sana="' + b + '"]'); return k.classList.contains('bugun') && k.classList.contains('tanlangan'); }, sana.bugun), true, 'bugun ramka va tanlangan');
  teng(await p.evaluate((b) => { const bu = b.split('-'); const kel = [...document.querySelectorAll('.sana-kun.kelajak')]; return kel.every((k) => k.disabled && k.getAttribute('data-sana') > b); }, sana.bugun), true, 'kelajak kunlar o\'chirilgan');
  await rasm('2-oyna');
  await p.click('.sana-chiplar [data-chip="otganOyOxiri"]');
  teng(bo(await p.textContent('#hisob-sana')), 'Bugun', 'chip darhol qo\'llanmaydi (Ko\'rsatish bilan tasdiqlanadi)');
  teng(await p.getAttribute('.sana-chiplar [data-chip="otganOyOxiri"]', 'aria-pressed'), 'true', 'chip faol');
  teng(await p.getAttribute('.sana-kun[data-sana="' + sana.otgan + '"]', 'aria-pressed'), 'true', 'kalendar o\'tgan oyga o\'tdi, kun tanlangan');
  await rasm('3-oyna-chip');
  await p.click('#sana-korsatish');
  await p.waitForSelector('#sana-tasma');
  teng(await p.locator('.sana-oynasi').count(), 0, 'oyna yopildi');

  // ---- 3) Tanlangan sana ko'rinishi (o'tgan oy oxiri): A +300 000 (oshgan), Karta B −800 000 (kamaygan), Naqd o'zgarmagan ----
  const matn = await p.evaluate(() => { const q = document.querySelector('#hisob-sana .sana-pill-matn').textContent; return q; });
  teng(/^\d{1,2}-[a-z']+( \d{4})?$/.test(matn), true, 'pill matni "15-oktabr" ko\'rinishida: ' + matn);
  teng(await p.evaluate(() => [document.querySelector('#hisob-sana .sana-pill-ich').classList.contains('tanlangan'), getComputedStyle(document.querySelector('#hisob-sana .sana-pill-ich')).backgroundColor]), [true, 'rgb(15, 143, 111)'], 'to\'ldirilgan yashil #0F8F6F');
  teng(bo(await p.innerText('#sana-tasma')), matn + ' kun oxiridagi holat Bugunga qaytish', 'tasma matni');
  teng(await p.evaluate(() => Math.round(document.querySelector('.sana-qaytish').getBoundingClientRect().height) >= 44), true, '"Bugunga qaytish" 44 px');
  teng(bo(await p.innerText('#sana-jami')), 'Jami qoldiq 3 500 000 so\'m −500 000 hozirdan Hozir 4 000 000', 'jami karta (A 3 000 000 + Hamyon 500 000 + B 0 + Naqd pul 0)');
  const q = await qatorlar();
  const olQ = (nom) => q.filter((x) => x.nom === nom)[0];
  teng(olQ('Karta A').matn.indexOf('Hozir 2 700 000') >= 0 && olQ('Karta A').matn.indexOf('3 000 000 so\'m') >= 0 && olQ('Karta A').matn.indexOf('+300 000') >= 0, true, 'Karta A: ' + olQ('Karta A').matn);
  teng(/qizil/.test(olQ('Karta B').pill) && olQ('Karta B').matn.indexOf('−800 000') >= 0, true, 'Karta B kamaygan qizil: ' + olQ('Karta B').matn);
  teng(/yashil/.test(olQ('Karta A').pill), true, 'Karta A oshgan yashil');
  teng(olQ('Hamyon').matn.indexOf('o\'zgarmagan') >= 0 && olQ('Hamyon').pill === null, true, 'Hamyon: o\'zgarmagan');
  teng(bo(await p.textContent('.sana-izoh')), 'Hozirgi yozuvlarga ko\'ra hisoblangan. O\'tgan yozuvni keyin tahrirlasangiz, natija ham o\'zgaradi.', 'izoh matni');
  teng(await p.evaluate(() => document.querySelector('#ekran').lastElementChild.classList.contains('sana-izoh')), true, 'izoh eng pastda');
  await olchov('Hisoblar (sana)'); await rasm('4-sana');
  // jami sanalarda: tur filtri o'zgarsa jami ko'rsatilganlar bo'yicha
  await p.click('.hisob-yorliqlar [data-tur="naqd"]');
  teng(bo(await p.innerText('#sana-jami')), 'Jami qoldiq 500 000 so\'m o\'zgarmagan Hozir 500 000', 'filtr: jami faqat ko\'rsatilgan hisoblardan');
  await p.click('.hisob-yorliqlar [data-tur="hammasi"]');

  // ---- 4) Hisob kartasini bosish avvalgidek (tahrirlash), orqaga qaytganda sana saqlanadi ----
  await p.click('.hisob-qatori[data-hisob] >> text=Karta A');
  await p.waitForSelector('#h-qoldiq');
  await p.click('.orqaga-tugma');
  await p.waitForSelector('#sana-tasma');
  teng(await p.locator('#sana-jami').count(), 1, 'tahrirdan qaytganda sana ko\'rinishi saqlanadi');
  // ---- 5) Bugunga qaytish ----
  await p.click('.sana-qaytish');
  teng(await p.locator('#sana-tasma, #sana-jami').count(), 0, 'Bugunga qaytish: oddiy holat');
  teng(bo(await p.textContent('#hisob-sana')), 'Bugun', 'pill yana "Bugun"');

  // ---- 6) Kalendar orqali kun tanlash (oldingi oy tugmasi), nuqta ----
  await p.click('#hisob-sana');
  await p.waitForSelector('.sana-oynasi');
  await p.click('[data-oy="oldingi"]');
  const oldingiOy = await p.$$eval('.sana-kun', (k) => k.map((x) => x.getAttribute('data-sana')));
  teng(oldingiOy.every((d) => d < sana.oyBoshi), true, 'oldingi oy kunlari');
  teng(await p.evaluate(() => document.querySelectorAll('.sana-kun.kelajak').length), 0, 'o\'tgan oyda kelajak kun yo\'q');
  await p.click('.sana-kun[data-sana="' + sana.otgan + '"]');
  await p.click('#sana-korsatish');
  await p.waitForSelector('#sana-tasma');
  teng(bo(await p.innerText('#sana-jami')).indexOf('Hozir 4 000 000') > 0, true, 'kalendar kuni bilan ham shu natija');
  // ---- 7) Ekrandan chiqib qaytsa "Bugun" ----
  await p.click('[data-bolim="bosh"]');
  await hisoblarniOch();
  teng(bo(await p.textContent('#hisob-sana')), 'Bugun', 'ekranga qaytilganda Bugun');
  teng(await p.evaluate(() => Object.keys(localStorage).filter((k) => /sana/i.test(k)).length), 0, 'sana localStorage ga yozilmagan');
  // ---- 8) Eng eski oydan oldin o'tib bo'lmaydi ----
  await p.click('#hisob-sana'); await p.waitForSelector('.sana-oynasi');
  for (let i = 0; i < 6; i++) { if (await p.evaluate(() => document.querySelector('[data-oy="oldingi"]').disabled)) break; await p.click('[data-oy="oldingi"]'); }
  teng(await p.evaluate(() => document.querySelector('[data-oy="oldingi"]').disabled), true, 'eng eski yozuv oyidan oldingi oyga o\'tib bo\'lmaydi');
  teng(await p.evaluate((e) => !!document.querySelector('.sana-kun[data-sana="' + e + '"] .sana-nuqta'), sana.eski), true, 'eng eski yozuv kunida nuqta');
  await olchov('Sana oynasi'); await rasm('5-oyna-eski-oy');
  await p.keyboard.press('Escape');
  teng(await p.locator('.sana-oynasi').count(), 0, 'Esc oynani yopdi');
  await kontekst.close();
}

(async () => {
  const brauzer = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try { for (const t of ['light', 'dark']) await senariy(brauzer, t); } finally { await brauzer.close(); }
  console.log(jami + ' tekshiruv, ' + xatolar + ' xato');
  process.exit(xatolar ? 1 : 0);
})();
