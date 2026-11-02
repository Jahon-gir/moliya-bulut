// Bo'lib to'lash (TZ-sinxronlash.md 54-band) uchun brauzer sinovi: HAQIQIY ilova (index.html, haqiqiy IndexedDB), faqat UYDIRMA ma'lumot va ismlar.
// Faqat ishlab chiqish vaqtida; ilovaning o'zi uni ishlatmaydi.
// Ishga tushirish: avval  python3 -m http.server 8000  (repozitoriy papkasida), keyin
//   node tools/bolish-brauzer-sinovi.js [rasmlar_papkasi]     (Playwright va Chromium kerak; PLAYWRIGHT_MODULE, ILOVA_MANZIL ixtiyoriy)
// 360 px kenglikda yorug' va qorong'i rejimda yuradi. Xato bo'lsa chiqish kodi 1.
const fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const MANZIL = process.env.ILOVA_MANZIL || 'http://localhost:8000/index.html';
const RASMLAR = process.argv[2] || path.join(os.tmpdir(), 'bolish-rasmlar');
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
  // Uydirma ma'lumot: Karta A 1 000 000; oldingi qarzlar: Ali (2 ta), Vali (1 ta) — ism tavsiyalari uchun
  await p.evaluate(async () => {
    const yaratilgan = new Date().toISOString();
    await Data.saqlash('hisoblar', { yaratilgan, nom: 'Karta A', tur: 'karta', belgi: 'karta', rang: '#2F5DDB', oxirgi4: '', boshlangich_qoldiq: 1000000, arxivlangan: false });
    const h = (await Data.hammasi('hisoblar')).filter((x) => x.nom === 'Karta A')[0];
    for (const [n, s, d] of [['Ali', 10000, '2026-09-01'], ['Ali', 20000, '2026-09-02'], ['Vali', 5000, '2026-09-03']]) await Data.saqlash('qarzlar', { id: Data.yangiId(), yaratilgan, yonalish: 'berdim', shaxs: n, summa: s, hisob_id: h.id, sana: d, vaqt: '10:00', muddat: '', izoh: '', tolovlar: [] });
    try { localStorage.removeItem('moliya-komissiya-oxirgi'); localStorage.removeItem('moliya-xarajat-komissiya-oxirgi'); localStorage.removeItem('moliya-hisob-manfiy'); } catch (e) { /* ahamiyatsiz */ }
  });
  await p.reload();
  await p.waitForFunction(() => document.querySelector('#ekran h1'));
  const rasm = (nom) => p.screenshot({ path: path.join(RASMLAR, tema + '-' + nom + '.png') });
  const olchov = async (izoh) => teng(await p.evaluate(() => document.documentElement.scrollWidth <= 360 && document.getElementById('ekran').scrollWidth <= 360), true, izoh + ': gorizontal aylanish yo\'q');
  const bazadan = (n) => p.evaluate((n) => Data.hammasi(n), n);
  const qoldiq = (nom) => p.evaluate(async (nom) => { const [h, y, q] = await Promise.all([Data.hammasi('hisoblar'), Data.hammasi('yozuvlar'), Data.hammasi('qarzlar')]); return Calc.hisobQoldigi(h.filter((x) => x.nom === nom)[0], y, q); }, nom);
  const xulosa = async () => bo(await p.textContent('.bolish-xulosa'));
  const satrlar = () => p.evaluate(() => [...document.querySelectorAll('.bolish-qator')].map((r) => { const i = r.querySelector('.bolish-ism'), s = r.querySelector('.bolish-summa, .bolish-maydon input'); return (i ? 'ism:' + i.value : 'siz') + '|' + (s.value !== undefined && s.tagName === 'INPUT' ? s.value : s.textContent); }));

  async function wizard(summa, hisobNomi, tur) {
    await p.click('.nav-qoshish'); await p.click('#yy-tranzaksiya'); await p.waitForSelector('#w-summa');
    if (tur) await p.click('.tanlov button:has-text("' + tur + '")');
    await p.fill('#w-summa', summa); await p.click('button:has-text("Davom etish")');
    if (tur !== 'O\'tkazma') await p.click('.katak:not(.katak-qosh)');
    await p.click('button.hisob-qator:has-text("' + hisobNomi + '")');
    await p.waitForSelector('#w-saqlash'); await p.click('#w-keyingi'); await p.waitForSelector('.kom-qism, #w-izoh');
  }

  // ======== 1) Toggle, stepper, chiplar, jadval ========
  await wizard('80000', 'Karta A');
  teng(await p.evaluate(() => { const t = document.getElementById('bolish-toggle'); return [t.getAttribute('aria-checked'), Math.round(t.getBoundingClientRect().height) >= 56, bo2(t.textContent), document.querySelector('.bolish-ich') === null]; function bo2(s) { return s.replace(/\s+/g, ' ').trim(); } }),
    ['false', true, 'Boshqalar uchun ham to\'ladimUlarning ulushi qarz bo\'lib yoziladi', true], 'toggle: boshlang\'ich o\'chiq, izoh, ≥ 56 px');
  await rasm('1-ochiq-emas');
  await p.click('#bolish-toggle');
  teng(await p.getAttribute('#bolish-toggle', 'aria-checked'), 'true', 'yoqildi');
  teng(bo(await p.textContent('.bolish-jami')), 'Jami summa80 000 so\'m', 'jami summa qatori');
  teng([await p.textContent('#bolish-son'), await p.isDisabled('#bolish-kam'), await p.isDisabled('#bolish-kop')], ['2', true, false], 'stepper: 2, "−" o\'chirilgan');
  teng(await p.evaluate(() => [...document.querySelectorAll('.bolish-chiplar .chip')].map((c) => c.textContent + ':' + c.getAttribute('aria-pressed'))), ['Teng bo\'lish:true', 'Qo\'lda:false'], 'rejim chiplari');
  teng(await p.evaluate(() => [...document.querySelectorAll('.bolish-ism-chip')].map((c) => c.textContent)), ['Ali', 'Vali'], 'oxirgi qarz ismlari (eng ko\'pi birinchi)');
  teng(await satrlar(), ['siz|40 000', 'ism:|40 000'], 'jadval: Siz + 1 odam, teng 40 000');
  teng(await p.evaluate(() => [document.querySelector('.bolish-siz .bolish-nom').textContent, document.querySelector('#bolish-ism-0').placeholder, Math.round(document.querySelector('#bolish-ism-0').getBoundingClientRect().height) >= 44]), ['Siz (xarajatingiz)', 'Ismi', true], 'qator nomi, placeholder, ≥ 44 px');
  teng(await xulosa(), 'Saqlansa: 1 xarajat 40 000 va 1 ta qarz yoziladi. Hisobdan jami 80 000 chiqadi.', 'xulosa');
  teng(await p.evaluate(() => [...document.querySelectorAll('.bolish-st-tugma')].every((b) => b.getBoundingClientRect().width >= 44 && b.getBoundingClientRect().height >= 44)), true, 'stepper tugmalari ≥ 44 px');
  await p.click('.bolish-ism-chip[data-ism="Ali"]'); teng(await p.inputValue('#bolish-ism-0'), 'Ali', 'chip ismni to\'ldirdi');
  await p.click('#bolish-kop');
  teng([await p.textContent('#bolish-son'), await satrlar()], ['3', ['siz|26 668', 'ism:Ali|26 666', 'ism:|26 666']], 'n = 3: 80 000 / 3, qoldiq sizga');
  teng(await xulosa(), 'Saqlansa: 1 xarajat 26 668 va 2 ta qarz yoziladi. Hisobdan jami 80 000 chiqadi.', 'xulosa n=3');
  for (let i = 0; i < 8; i++) await p.click('#bolish-kop');
  teng([await p.textContent('#bolish-son'), await p.isDisabled('#bolish-kop'), (await satrlar()).length], ['11', true, 11], 'n = 11: "+" o\'chirilgan, 10 ta boshqa odam');
  for (let i = 0; i < 9; i++) await p.click('#bolish-kam');
  teng(await p.textContent('#bolish-son'), '2', 'n = 2 ga qaytdi'); await olchov('bo\'lib to\'lash (teng)'); await rasm('2-teng');

  // ======== 2) Qo'lda: hisoblagich va "Saqlash" ========
  await p.click('.bolish-chiplar [data-bolish="qolda"]');
  teng(await satrlar(), ['siz|40 000', 'ism:Ali|40 000'], 'qo\'lda: teng qiymatlar boshlang\'ich'); teng(bo(await p.textContent('.bolish-qoldi')), 'Qoldi: 0 ✓', 'qoldi 0');
  teng(await p.evaluate(() => [document.querySelector('.bolish-qoldi').className, getComputedStyle(document.querySelector('.bolish-qoldi')).color]), ['bolish-qoldi toliq', await p.evaluate(() => { const t = document.createElement('i'); t.style.color = 'var(--daromad)'; document.body.appendChild(t); const c = getComputedStyle(t).color; t.remove(); return c; })], 'qoldi 0 — yashil');
  await p.fill('#bolish-siz', '30 000');
  teng([bo(await p.textContent('.bolish-qoldi')), await p.isDisabled('#w-saqlash'), bo(await p.textContent('.bolish-sabab'))], ['Qoldi: 10 000', true, 'Saqlash uchun yig\'indi jami summaga teng bo\'lsin'], 'yig\'indi kam: "Saqlash" faol emas, sababi matnda');
  await p.fill('#bolish-siz', '50 000'); teng([bo(await p.textContent('.bolish-qoldi')), await p.isDisabled('#w-saqlash'), await p.evaluate(() => document.querySelector('.bolish-qoldi').className)], ['Qoldi: −10 000', true, 'bolish-qoldi ortiq'], 'yig\'indi ortiq');
  await rasm('3-qolda-qoldi');
  await p.fill('#bolish-siz', '30 000'); await p.fill('#bolish-summa-0', '50 000');
  teng([bo(await p.textContent('.bolish-qoldi')), await p.isDisabled('#w-saqlash')], ['Qoldi: 0 ✓', false], 'yig\'indi teng: "Saqlash" faol');
  teng(await xulosa(), 'Saqlansa: 1 xarajat 30 000 va 1 ta qarz yoziladi. Hisobdan jami 80 000 chiqadi.', 'qo\'lda xulosa');
  // tekshiruv xatolari
  await p.click('#bolish-ism-0', { clickCount: 3 }); await p.fill('#bolish-ism-0', '');
  await p.click('#w-saqlash'); await p.waitForTimeout(150);
  teng([bo(await p.textContent('.bolish-xato')), (await bazadan('yozuvlar')).length], ['Ismni kiriting', 0], 'ism bo\'sh: xato, hech narsa yozilmadi');
  await p.click('#bolish-kop'); await p.fill('#bolish-ism-0', 'Ali'); await p.fill('#bolish-ism-1', ' ali '); await p.fill('#bolish-summa-0', '25 000'); await p.fill('#bolish-summa-1', '25 000');
  await p.click('#w-saqlash'); await p.waitForTimeout(150);
  teng(bo(await p.textContent('.bolish-xato')), 'Ismlar har xil bo\'lsin', 'takror ism');
  await p.click('#bolish-kam'); await p.click('.bolish-chiplar [data-bolish="teng"]');

  // ======== 3) Komissiya bilan birga, saqlash ========
  await p.click('.kom-chiplar [data-kom="p1"]');
  teng(await xulosa(), 'Saqlansa: 1 xarajat 40 000 va 1 ta qarz yoziladi. Hisobdan jami 80 800 chiqadi.', 'xulosa komissiya bilan (jami + 800)');
  await p.fill('#w-izoh', 'Baliq');
  await olchov('komissiya bilan'); await rasm('4-komissiya');
  await p.click('#w-saqlash'); await p.waitForSelector('.kun');
  teng(bo(await p.textContent('.toast')), '1 xarajat va 1 ta qarz yozildi (komissiya 800)', 'xabar'); 
  const y = await bazadan('yozuvlar'), q = await bazadan('qarzlar');
  const xar = y.filter((v) => v.summa === 40000)[0], kom = y.filter((v) => v.bog_id)[0], yangiQarz = q.filter((z) => z.izoh.indexOf('(bo\'lib to\'lash)') > 0);
  teng([y.length, xar.izoh, kom.summa, kom.bog_id === xar.id, kom.izoh], [2, 'Baliq', 800, true, 'Xarajat komissiyasi (1%)'], 'xarajat (ulush) + komissiya jami 80 000 dan (800), xarajatga bog\'langan');
  teng([yangiQarz.length, yangiQarz[0].yonalish, yangiQarz[0].shaxs, yangiQarz[0].summa, yangiQarz[0].hisob_id === xar.hisob_id, yangiQarz[0].sana === xar.sana && yangiQarz[0].vaqt === xar.vaqt, yangiQarz[0].muddat, yangiQarz[0].izoh], [1, 'berdim', 'Ali', 40000, true, true, '', 'Baliq (bo\'lib to\'lash)'], 'qarz: berdim, Ali, 40 000, xarajat sanasi, izoh');
  teng(await qoldiq('Karta A'), 1000000 - 35000 - 80800, 'hisobdan aniq 80 800 (jami + komissiya), ikki marta emas');
  teng(await p.evaluate(() => [...document.querySelectorAll('.kun-sarlavha .pill')].map((x) => Number(x.getAttribute('data-qiymat')))).then((a) => a.length > 0), true, 'Tarixga o\'tdi');
  await olchov('Tarix');
  // Qarzlar ekrani
  await p.click('[data-bolim="qarzlar"]'); await p.waitForSelector('.odam-qator');
  teng(await p.evaluate(() => [...document.querySelectorAll('.odam-qator')].map((r) => r.getAttribute('data-shaxs')).sort()), ['Ali', 'Vali'], 'Qarzlar ekranida odam qatorlari');
  teng(bo(await p.textContent('.odam-qator[data-shaxs="Ali"]')).includes('70 000'), true, 'Ali: 10 000 + 20 000 + 40 000 = 70 000');

  // ======== 4) Keyingi xarajatda yana o'chiq; boshqa turlarda va tahrirda yo'q ========
  await wizard('1000', 'Karta A');
  teng([await p.getAttribute('#bolish-toggle', 'aria-checked'), await p.locator('.bolish-ich').count()], ['false', 0], 'saqlagandan keyin yana o\'chiq (eslab qolinmaydi)');
  await p.goto(MANZIL); await p.waitForSelector('#ekran h1');
  await wizard('1000', 'Karta A', 'Daromad'); teng(await p.locator('#bolish-toggle').count(), 0, 'daromadda yo\'q');
  await p.goto(MANZIL); await p.waitForSelector('#ekran h1');
  await p.click('.nav-qoshish'); await p.click('#yy-tranzaksiya'); await p.waitForSelector('#w-summa'); await p.click('.tanlov button:has-text("O\'tkazma")'); await p.fill('#w-summa', '1000'); await p.click('button:has-text("Davom etish")');
  await p.click('button.hisob-qator >> nth=0'); await p.click('button.hisob-qator >> nth=0'); await p.waitForSelector('#w-keyingi'); await p.click('#w-keyingi'); await p.waitForSelector('.kom-qism');
  teng(await p.locator('#bolish-toggle').count(), 0, 'o\'tkazmada yo\'q');
  await p.goto(MANZIL); await p.waitForSelector('#ekran h1');
  await p.click('.nav-tugma[data-bolim="tarix"]'); await p.waitForSelector('.yozuv-kv'); await p.click('.yozuv-kv:not(.kom-ichki)'); await p.waitForSelector('#f-summa');
  teng(await p.locator('#bolish-toggle, .bolish-qism').count(), 0, 'tahrir formasida yo\'q');
  // tezkor saqlash oddiy xarajat
  await p.goto(MANZIL); await p.waitForSelector('#ekran h1');
  await p.click('.nav-qoshish'); await p.click('#yy-tranzaksiya'); await p.waitForSelector('#w-summa'); await p.fill('#w-summa', '2222'); await p.click('button:has-text("Davom etish")'); await p.click('.katak:not(.katak-qosh)');
  const oldin = (await bazadan('qarzlar')).length; await p.click('#w-saqlash'); await p.waitForSelector('.kun');
  teng([(await bazadan('qarzlar')).length, (await bazadan('yozuvlar')).filter((v) => v.summa === 2222).length], [oldin, 1], 'tezkor saqlash: oddiy xarajat');

  // ======== 5) §50: jami bo'yicha ========
  await p.evaluate(() => { try { localStorage.removeItem('moliya-xarajat-komissiya-oxirgi'); } catch (e) { /* ahamiyatsiz */ } });
  const soniOldin = [(await bazadan('yozuvlar')).length, (await bazadan('qarzlar')).length];
  await wizard('80000', 'Naqd pul'); await p.click('#bolish-toggle'); await p.fill('#bolish-ism-0', 'Sobir'); await p.click('#w-saqlash'); await p.waitForSelector('.manfiy-oyna');
  teng(bo(await p.textContent('.manfiy-matn')), '«Naqd pul» hisobida 0 so\'m bor, bu amal uchun 80 000 so\'m kerak. Boshqa hisobni tanlang yoki avval shu hisobga kirim yozing.', '§50: "kerak" = jami 80 000 (sizning 40 000 emas)');
  await olchov('§50 oynasi'); await rasm('5-manfiy');
  await p.click('#manfiy-yopish');
  teng([(await bazadan('yozuvlar')).length, (await bazadan('qarzlar')).length], soniOldin, 'bloklandi: hech narsa yozilmadi');
  teng([await p.inputValue('#bolish-ism-0'), await p.getAttribute('#bolish-toggle', 'aria-checked')], ['Sobir', 'true'], 'forma ma\'lumoti saqlandi');
  await kontekst.close();
}

(async () => {
  const brauzer = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const tema of ['light', 'dark']) {
    try { await senariy(brauzer, tema); } catch (e) { xatolar++; console.log('  ✗ ' + (e && e.message ? e.message.split('\n').slice(0, 3).join(' | ') : e) + (e && e.stack ? ' @ ' + (e.stack.match(/brauzer-sinovi\.js:\d+/) || [''])[0] : '')); }
  }
  await brauzer.close();
  console.log(jami + ' tekshiruv, xato: ' + xatolar + ' (rasmlar: ' + RASMLAR + ')');
  process.exit(xatolar ? 1 : 0);
})();
