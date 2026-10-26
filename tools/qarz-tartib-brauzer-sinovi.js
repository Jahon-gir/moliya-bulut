// Qarzlar tartibi (TZ-sinxronlash.md 44-band) uchun brauzer sinovi: HAQIQIY ilova (index.html, haqiqiy IndexedDB), faqat UYDIRMA ma'lumot.
// Faqat ishlab chiqish vaqtida; ilovaning o'zi uni ishlatmaydi.
// Ishga tushirish: avval  python3 -m http.server 8000  (repozitoriy papkasida), keyin  node tools/qarz-tartib-brauzer-sinovi.js [rasmlar_papkasi]
// (PLAYWRIGHT_MODULE, CHROMIUM_PATH, ILOVA_MANZIL ixtiyoriy). 360 px, yorug' va qorong'i rejim. Xato bo'lsa chiqish kodi 1.
const fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const MANZIL = process.env.ILOVA_MANZIL || 'http://localhost:8000/index.html';
const RASMLAR = process.argv[2] || path.join(os.tmpdir(), 'qarz-tartib-rasmlar');
fs.mkdirSync(RASMLAR, { recursive: true });
let jami = 0, xatolar = 0;
function teng(h, k, izoh) { jami++; if (JSON.stringify(h) !== JSON.stringify(k)) { xatolar++; console.log('  ✗ ' + izoh + ' — kutilgan: ' + JSON.stringify(k) + ', chiqdi: ' + JSON.stringify(h)); } }

async function senariy(brauzer, tema) {
  console.log('== ' + tema + ' rejim, 360 px ==');
  const kontekst = await brauzer.newContext({ viewport: { width: 360, height: 780 }, colorScheme: tema, serviceWorkers: 'block' });
  const p = await kontekst.newPage();
  p.on('pageerror', (e) => { if (!/IDBObjectStore/.test(e.message)) { xatolar++; console.log('  ✗ PAGEERROR ' + e.message); } });
  await p.goto(MANZIL);
  await p.waitForFunction(() => typeof Data !== 'undefined' && document.querySelector('#ekran h1'));
  if (await p.locator('#salom-davom').count()) { await p.click('#salom-davom'); await p.waitForSelector('#salom-ekran', { state: 'detached' }); }
  const rasm = (n) => p.screenshot({ path: path.join(RASMLAR, tema + '-' + n + '.png') });
  const ismlar = () => p.evaluate(() => [...document.querySelectorAll('#qarz-royxat .qarz-qator')].map((b) => b.getAttribute('data-shaxs')));
  const tugmaMatni = () => p.evaluate(() => (document.querySelector('#qarz-tartib') || { textContent: null }).textContent);
  const olchov = async (i) => teng(await p.evaluate(() => document.documentElement.scrollWidth <= 360), true, i + ': gorizontal aylanish yo\'q');
  const qarzlarga = async () => { await p.click('[data-bolim="qarzlar"]'); await p.waitForSelector('.qarz-tanlov'); };

  // ---- 0) Qarz yo'q: tugma ko'rinmaydi ----
  await qarzlarga();
  teng(await p.locator('#qarz-tartib').count(), 0, 'qarz yo\'q: tugma yo\'q');

  // ---- uydirma ma'lumot (hamma sana bugundan oldin) ----
  await p.evaluate(async () => {
    const his = await Data.saqlash('hisoblar', { yaratilgan: new Date().toISOString(), nom: 'Karta A', tur: 'karta', belgi: 'karta', rang: '#2F5DDB', oxirgi4: '', boshlangich_qoldiq: 1000000, arxivlangan: false });
    const h = (await Data.hammasi('hisoblar'))[0];
    const q = (yo, sh, sum, sana, muddat, tolov) => Data.saqlash('qarzlar', { yaratilgan: new Date().toISOString(), yonalish: yo, shaxs: sh, summa: sum, hisob_id: h.id, sana, vaqt: '10:00', muddat: muddat || '', izoh: '', tolovlar: tolov ? [{ id: Data.yangiId(), sana, vaqt: '11:00', summa: tolov, hisob_id: h.id }] : [], yopilgan: false });
    await q('berdim', 'Ali', 100000, '2026-01-01', '2999-01-20');
    await q('berdim', 'Ali', 50000, '2026-01-08', '');
    await q('berdim', 'Vali', 300000, '2026-01-05', '2999-01-12');
    await q('berdim', 'Bek', 10000, '2026-01-09', '');
    await q('berdim', 'Sardor', 80000, '2026-01-07', '2026-01-02', 80000);
    await q('berdim', 'Zuhra', 20000, '2026-01-03', '2026-01-05');
    await q('oldim', 'Olim', 70000, '2026-01-04', '');
  });
  await p.reload(); await p.waitForFunction(() => document.querySelector('#ekran h1'));
  await qarzlarga();

  // ---- 1) Tugma: o'ng tomonda, ikki karta bilan ro'yxat orasida, ≥ 44 px, boshlang'ich "Muddat bo'yicha" ----
  teng(await tugmaMatni(), 'Muddat bo\'yicha', 'boshlang\'ich tartib nomi');
  teng(await p.evaluate(() => { const t = document.querySelector('#qarz-tartib'), r = t.getBoundingClientRect(), kt = document.querySelector('.qarz-tanlov').getBoundingClientRect(), ry = document.querySelector('#qarz-royxat').getBoundingClientRect(); return [r.height >= 44, r.right > 360 / 2 && r.right <= 360, r.top >= kt.bottom, r.bottom <= ry.top, !!t.querySelector('svg'), t.querySelector('svg').getAttribute('width')]; }), [true, true, true, true, true, '16'], 'tugma joyi, balandligi va ikoni');
  teng(await p.evaluate(() => getComputedStyle(document.querySelector('#qarz-tartib')).position), 'static', 'sticky emas');
  // muddat: Zuhra (o'tib ketgan), Vali, Ali(2 ta: muddatlisi birinchi), Bek (muddatsiz), (Sardor yopilgan — ro'yxatda yo'q)
  teng(await ismlar(), ['Zuhra', 'Vali', 'Ali', 'Ali', 'Bek'], 'muddat bo\'yicha ro\'yxat');
  teng(await p.evaluate(() => [...document.querySelectorAll('#qarz-royxat .qarz-qator')].map((b) => !!b.querySelector('.muddat-otgan'))), [true, false, false, false, false], 'o\'tib ketgan muddat belgisi faqat Zuhrada');
  await olchov('ro\'yxat'); await rasm('1-royxat');

  // ---- 2) Oyna ochiladi ----
  await p.click('#qarz-tartib');
  await p.waitForSelector('.tartib-oynasi');
  teng(await p.evaluate(() => [document.querySelector('.tartib-oynasi h2').textContent, [...document.querySelectorAll('.tartib-qator')].map((b) => b.querySelector('strong').textContent + '|' + b.querySelector('.xira').textContent + '|' + b.getAttribute('aria-checked') + '|' + !!b.querySelector('.tanlov-belgi svg') + '|' + !!b.querySelector('.tartib-radio svg'))]),
    ['Tartib', ['Olingan sana|Yangisi tepada|false|true|false', 'Qaytarish muddati|Yaqini tepada, muddatsizlar oxirida|true|true|true', 'Summa|Kattadan kichikka|false|true|false']], 'oyna: sarlavha, uch qator, tanlangani belgilangan');
  teng(await p.evaluate(() => [...document.querySelectorAll('.tartib-qator')].every((b) => b.getBoundingClientRect().height >= 44)), true, 'qatorlar ≥ 44 px');
  teng(await p.evaluate(() => { const r = document.querySelector('.tartib-qator.tanlangan .tartib-radio'); const c = getComputedStyle(r); return [r.getBoundingClientRect().width, c.borderRadius, c.backgroundColor !== 'rgba(0, 0, 0, 0)']; }), [24, '50%', true], 'radio: yashil doira');
  teng(await p.evaluate(() => getComputedStyle(document.querySelector('.tartib-qator.tanlangan')).backgroundColor !== getComputedStyle(document.querySelector('.tartib-qator:not(.tanlangan)')).backgroundColor), true, 'tanlangan qator foni bo\'yalgan');
  teng(await p.evaluate(() => { const a = getComputedStyle(document.querySelector('.tartib-oynasi'), '::before'); return [a.content, a.height]; }), ['""', '4px'], 'tutqich chizig\'i');
  await olchov('oyna'); await rasm('2-oyna');

  // ---- 3) Tashqariga bosish yopadi; Esc yopadi ----
  await p.mouse.click(180, 20);
  await p.waitForSelector('.tartib-oynasi', { state: 'detached' });
  teng(await tugmaMatni(), 'Muddat bo\'yicha', 'tashqariga bosilsa tanlov o\'zgarmaydi');
  await p.click('#qarz-tartib'); await p.waitForSelector('.tartib-oynasi'); await p.keyboard.press('Escape');
  await p.waitForSelector('.tartib-oynasi', { state: 'detached' });

  // ---- 4) "Sana bo'yicha" ----
  await p.click('#qarz-tartib'); await p.click('.tartib-qator[data-tartib="sana"]');
  await p.waitForSelector('.tartib-oynasi', { state: 'detached' });
  teng(await tugmaMatni(), 'Sana bo\'yicha', 'tugma nomi yangilandi');
  teng(await ismlar(), ['Bek', 'Ali', 'Ali', 'Vali', 'Zuhra'], 'sana bo\'yicha: yangisi tepada, Ali ichida ham yangisi (50 000) birinchi');
  await rasm('3-sana');
  // ---- 5) "Summa bo'yicha" ----
  await p.click('#qarz-tartib'); await p.click('.tartib-qator[data-tartib="summa"]');
  await p.waitForSelector('.tartib-oynasi', { state: 'detached' });
  teng(await tugmaMatni(), 'Summa bo\'yicha', 'tugma nomi (summa)');
  teng(await ismlar(), ['Vali', 'Ali', 'Ali', 'Zuhra', 'Bek'], 'summa bo\'yicha');
  // ---- 6) Ikkala ro'yxatga bitta tanlov ----
  await p.click('[data-tanlov="oldim"]');
  teng(await ismlar(), ['Olim'], 'Olingan ro\'yxat'); teng(await tugmaMatni(), 'Summa bo\'yicha', 'Olingan ro\'yxatda ham shu tanlov');
  // ---- 7) Saqlanishi: qayta yuklash ----
  teng(await p.evaluate(() => localStorage.getItem('moliya-qarz-tartibi')), 'summa', 'localStorage');
  await p.reload(); await p.waitForFunction(() => document.querySelector('#ekran h1')); await qarzlarga();
  teng(await tugmaMatni(), 'Summa bo\'yicha', 'qayta ochilganda saqlangan'); teng(await ismlar(), ['Vali', 'Ali', 'Ali', 'Zuhra', 'Bek'], 'saqlangan tartib qo\'llandi');
  // ---- 8) Yaroqsiz qiymat -> boshlang'ich ----
  await p.evaluate(() => localStorage.setItem('moliya-qarz-tartibi', 'noto\'g\'ri'));
  await p.reload(); await p.waitForFunction(() => document.querySelector('#ekran h1')); await qarzlarga();
  teng(await tugmaMatni(), 'Muddat bo\'yicha', 'yaroqsiz qiymat: boshlang\'ich');
  // ---- 9) Zaxiraga / bazaga kirmaydi ----
  teng(await p.evaluate(async () => JSON.stringify(await Data.hammasi('sozlamalar')).indexOf('qarz-tartibi') === -1), true, 'sozlamalar bazasida yo\'q');
  // ---- 10) Matn sig'masa qisqaradi (ellipsis), gorizontal aylanish yo'q ----
  teng(await p.evaluate(() => { const t = document.querySelector('#qarz-tartib'); return t.getBoundingClientRect().right <= 360 && getComputedStyle(t.querySelector('.qarz-tartib-nom')).textOverflow; }), 'ellipsis', 'ellipsis');
  // ---- 11) Hammasi o'chsa tugma yo'q (olingan ro'yxat bo'sh bo'lganda) ----
  await p.click('[data-tanlov="oldim"]');
  await p.evaluate(async () => { for (const q of await Data.hammasi('qarzlar')) if (q.yonalish === 'oldim') await Data.ochirish('qarzlar', q.id); });
  await p.reload(); await p.waitForFunction(() => document.querySelector('#ekran h1')); await qarzlarga(); await p.click('[data-tanlov="oldim"]');
  teng(await p.locator('#qarz-tartib').count(), 0, 'ro\'yxat bo\'sh: tugma yo\'q');
  await kontekst.close();
}

(async () => {
  const brauzer = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const t of ['light', 'dark']) await senariy(brauzer, t);
  await brauzer.close();
  console.log(jami + ' tekshiruv, ' + xatolar + ' xato. Rasmlar: ' + RASMLAR);
  process.exit(xatolar ? 1 : 0);
})();
