// Bo'lib to'lash: kim darhol qaytardi (TZ-sinxronlash.md 57-band) uchun brauzer sinovi: HAQIQIY ilova (index.html, haqiqiy IndexedDB), faqat UYDIRMA ma'lumot va ismlar.
// Faqat ishlab chiqish vaqtida; ilovaning o'zi uni ishlatmaydi.
// Ishga tushirish: avval  python3 -m http.server 8000  (repozitoriy papkasida), keyin
//   node tools/bolish-holat-brauzer-sinovi.js [rasmlar_papkasi]     (Playwright va Chromium kerak; PLAYWRIGHT_MODULE, ILOVA_MANZIL ixtiyoriy)
// 360 px kenglikda yorug' va qorong'i rejimda yuradi. Xato bo'lsa chiqish kodi 1.
const fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const MANZIL = process.env.ILOVA_MANZIL || 'http://localhost:8000/index.html';
const RASMLAR = process.argv[2] || path.join(os.tmpdir(), 'bolish-holat-rasmlar');
fs.mkdirSync(RASMLAR, { recursive: true });

let jami = 0, xatolar = 0;
function teng(haqiqiy, kutilgan, izoh) {
  jami++;
  if (JSON.stringify(haqiqiy) !== JSON.stringify(kutilgan)) { xatolar++; console.log('  ✗ ' + izoh + ' — kutilgan: ' + JSON.stringify(kutilgan) + ', chiqdi: ' + JSON.stringify(haqiqiy)); }
}
const bo = (s) => String(s).replace(/\s+/g, ' ').trim();
const ISMLAR = ['Ali', 'Vali', 'Sobir', 'Dilshod', 'Karim'];

async function senariy(brauzer, tema) {
  console.log('== ' + tema + ' rejim, 360 px ==');
  const kontekst = await brauzer.newContext({ viewport: { width: 360, height: 780 }, colorScheme: tema, serviceWorkers: 'block' });
  const p = await kontekst.newPage();
  p.on('pageerror', (e) => { xatolar++; console.log('  ✗ PAGEERROR ' + e.message); });
  await p.goto(MANZIL);
  await p.waitForFunction(() => typeof Data !== 'undefined' && document.querySelector('#ekran h1'));
  if (await p.locator('#salom-davom').count()) { await p.click('#salom-davom'); await p.waitForSelector('#salom-ekran', { state: 'detached' }); }
  // Uydirma ma'lumot: Karta A 1 000 000 (karta); tayyor "Naqd pul" (naqd, 0) ilovaning o'zida bor
  await p.evaluate(async () => {
    await Data.saqlash('hisoblar', { yaratilgan: new Date().toISOString(), nom: 'Karta A', tur: 'karta', belgi: 'karta', rang: '#2F5DDB', oxirgi4: '', boshlangich_qoldiq: 1000000, arxivlangan: false });
    try { localStorage.removeItem('moliya-xarajat-komissiya-oxirgi'); localStorage.removeItem('moliya-hisob-manfiy'); } catch (e) { /* ahamiyatsiz */ }
  });
  await p.reload();
  await p.waitForFunction(() => document.querySelector('#ekran h1'));
  const rasm = (nom) => p.screenshot({ path: path.join(RASMLAR, tema + '-' + nom + '.png') });
  const olchov = async (izoh) => teng(await p.evaluate(() => document.documentElement.scrollWidth <= 360 && document.getElementById('ekran').scrollWidth <= 360), true, izoh + ': gorizontal aylanish yo\'q');
  const bazadan = (n) => p.evaluate((n) => Data.hammasi(n), n);
  const qoldiq = (nom) => p.evaluate(async (nom) => { const [h, y, q] = await Promise.all([Data.hammasi('hisoblar'), Data.hammasi('yozuvlar'), Data.hammasi('qarzlar')]); return Calc.hisobQoldigi(h.filter((x) => x.nom === nom)[0], y, q); }, nom);
  const xulosa = async () => bo(await p.textContent('.bolish-xulosa'));
  const holatlar = () => p.evaluate(() => [...document.querySelectorAll('.bolish-holat')].map((b) => b.getAttribute('data-holat') + '|' + b.getAttribute('aria-label')));
  const rang = (v) => p.evaluate((v) => { const t = document.createElement('i'); t.style.color = 'var(' + v + ')'; document.body.appendChild(t); const c = getComputedStyle(t).color; t.remove(); return c; }, v);

  async function wizard(summa, hisobNomi) {
    await p.click('.nav-qoshish'); await p.click('#yy-tranzaksiya'); await p.waitForSelector('#w-summa');
    await p.fill('#w-summa', summa); await p.click('button:has-text("Davom etish")');
    await p.click('.katak:not(.katak-qosh)');
    await p.click('button.hisob-qator:has-text("' + hisobNomi + '")');
    await p.waitForSelector('#w-saqlash'); await p.click('#w-keyingi'); await p.waitForSelector('.kom-qism, #w-izoh');
  }
  async function odamlar(n, ismlar) {
    await p.click('#bolish-toggle');
    for (let i = 2; i < n; i++) await p.click('#bolish-kop');
    for (let i = 0; i < ismlar.length; i++) await p.fill('#bolish-ism-' + i, ismlar[i]);
  }

  // ======== 1) Tugmalar, aylanma, legend ========
  await wizard('347000', 'Karta A');
  await odamlar(6, ISMLAR);
  teng(await holatlar(), ISMLAR.map(() => 'qarz|Holat: qarz'), '5 ta tugma, boshlang\'ich QARZ');
  teng(await p.evaluate(() => { const b = document.getElementById('bolish-holat-0'), r = b.getBoundingClientRect(), i = b.querySelector('.bolish-holat-ich').getBoundingClientRect(), s = b.parentElement.querySelector('.bolish-summa').getBoundingClientRect(); return [Math.round(r.width) >= 44 && Math.round(r.height) >= 44, Math.round(i.width), Math.round(i.height), r.left >= s.right, !!b.querySelector('svg'), b.textContent.trim()]; }),
    [true, 40, 40, true, true, ''], 'tugma: bosish ≥ 44 px, katak 40×40, summadan o\'ngda, faqat ikon');
  const qarzRang = await p.evaluate(() => { const c = getComputedStyle(document.querySelector('#bolish-holat-0 .bolish-holat-ich')); return [c.color, c.backgroundColor]; });
  teng(qarzRang, [await rang('--text-warning'), await p.evaluate(() => { const t = document.createElement('i'); t.style.backgroundColor = 'var(--bg-warning)'; document.body.appendChild(t); const c = getComputedStyle(t).backgroundColor; t.remove(); return c; })], 'qarz: sariq tokenlar');
  teng(bo(await p.textContent('.bolish-legend')), 'naqd berdikartagaqarz', 'legend: naqd berdi, kartaga, qarz');
  teng(await p.evaluate(() => [...document.querySelectorAll('.bolish-legend-band svg')].length), 3, 'legend ikonlari');
  teng(await p.locator('.bolish-naqd-yoq').count(), 0, 'naqd hisob bor: izoh yo\'q');
  teng(await xulosa(), 'Saqlansa: xarajat 57 835, 5 ta qarz. Ochiq qoladi: 5 ta (289 165).', 'xulosa: hammasi qarz');
  await p.click('#bolish-holat-0'); teng((await holatlar())[0], 'naqd|Holat: naqd berdi', '1-bosish: naqd berdi');
  teng(await p.evaluate(() => getComputedStyle(document.querySelector('#bolish-holat-0 .bolish-holat-ich')).color), await rang('--text-success'), 'naqd: yashil');
  await p.click('#bolish-holat-0'); teng((await holatlar())[0], 'karta|Holat: kartaga o\'tkazdi', '2-bosish: kartaga');
  await p.click('#bolish-holat-0'); teng((await holatlar())[0], 'qarz|Holat: qarz', '3-bosish: qarzga qaytdi');
  for (const i of [0, 2, 4]) await p.click('#bolish-holat-' + i);
  teng(await xulosa(), 'Saqlansa: xarajat 57 835, 5 ta qarz. Darhol yopiladi: 3 ta (Naqd pulga +173 499). Ochiq qoladi: 2 ta (115 666).', 'xulosa: 3 naqd + 2 qarz');
  // qator o'chsa holati ketadi, yangi qator QARZ bilan; rejim o'zgarsa holatlar odamda qoladi
  await p.click('#bolish-kam'); teng((await holatlar()).length, 4, 'n = 5');
  await p.click('#bolish-kop'); teng((await holatlar())[4], 'qarz|Holat: qarz', 'qayta qo\'shilgan qator QARZ');
  await p.fill('#bolish-ism-4', 'Karim'); await p.click('#bolish-holat-4');
  await p.click('.bolish-chiplar [data-bolish="qolda"]'); teng((await holatlar()).map((x) => x.split('|')[0]), ['naqd', 'qarz', 'naqd', 'qarz', 'naqd'], 'qo\'lda rejimda holatlar saqlandi');
  teng(await xulosa(), 'Saqlansa: xarajat 57 835, 5 ta qarz. Darhol yopiladi: 3 ta (Naqd pulga +173 499). Ochiq qoladi: 2 ta (115 666).', 'qo\'lda xulosa');
  teng(await p.evaluate(() => { const r = document.querySelector('#bolish-holat-4').getBoundingClientRect(), i = document.querySelector('#bolish-ism-4').getBoundingClientRect(); return [Math.round(r.width) >= 44, r.right <= 360, i.width > 40]; }), [true, true, true], 'qo\'lda: tugma 44 px saqlandi, ism toraydi');
  await olchov('qo\'lda'); await rasm('1-qolda');
  await p.click('.bolish-chiplar [data-bolish="teng"]');
  // uzun ism: ellipsis, tugma o'lchami o'zgarmaydi
  await p.fill('#bolish-ism-1', 'Valijon Abdurahmonov Ortiqboyevich');
  teng(await p.evaluate(() => [getComputedStyle(document.getElementById('bolish-ism-1')).textOverflow, Math.round(document.getElementById('bolish-holat-1').getBoundingClientRect().width)]), ['ellipsis', 44], 'uzun ism: ellipsis, tugma 44');
  await p.fill('#bolish-ism-1', 'Vali');
  await olchov('teng'); await rasm('2-teng');

  // ======== 2) Saqlash: 3 naqd + 2 qarz ========
  const kartaOldin = await qoldiq('Karta A'), naqdOldin = await qoldiq('Naqd pul');
  await p.fill('#w-izoh', 'Kafe');
  await p.click('#w-saqlash'); await p.waitForSelector('.kun');
  teng(bo(await p.textContent('.toast')), '1 xarajat, 5 ta qarz (3 tasi yopildi) yozildi', 'xabar');
  const y = await bazadan('yozuvlar'), q = (await bazadan('qarzlar')).filter((z) => z.izoh === 'Kafe (bo\'lib to\'lash)');
  const naqdId = (await bazadan('hisoblar')).filter((h) => h.nom === 'Naqd pul')[0].id;
  teng([y.length, y[0].summa, q.length], [1, 57835, 5], '1 xarajat 57 835, 5 qarz');
  teng(q.filter((z) => z.tolovlar.length === 1).map((z) => z.shaxs).sort(), ['Ali', 'Karim', 'Sobir'], '3 ta to\'lov');
  teng(q.filter((z) => z.tolovlar.length).every((z) => z.tolovlar[0].hisob_id === naqdId && z.tolovlar[0].summa === z.summa && z.tolovlar[0].sana === z.sana && z.tolovlar[0].vaqt === z.vaqt && z.yopilgan === true), true, 'to\'lov: naqd hisobga, to\'liq ulush, xarajat vaqti, yopilgan');
  teng([await qoldiq('Karta A') - kartaOldin, await qoldiq('Naqd pul') - naqdOldin], [-347000, 173499], 'karta −347 000, naqd +173 499');
  await olchov('Tarix');
  await p.click('[data-bolim="qarzlar"]'); await p.waitForSelector('.odam-qator');
  teng(await p.evaluate(() => [...document.querySelectorAll('.odam-qator')].map((r) => r.getAttribute('data-shaxs')).sort()), ['Dilshod', 'Vali'], 'Qarzlar: faqat 2 ochiq');
  await olchov('Qarzlar'); await rasm('3-qarzlar');

  // ======== 3) Kartaga qaytgan: to'lov xarajat hisobiga ========
  await p.goto(MANZIL); await p.waitForSelector('#ekran h1');
  await wizard('60000', 'Karta A'); await odamlar(3, ['Nodir', 'Jasur']);
  await p.click('#bolish-holat-0'); await p.click('#bolish-holat-0');
  teng(await xulosa(), 'Saqlansa: xarajat 20 000, 2 ta qarz. Darhol yopiladi: 1 ta (Karta Aga +20 000). Ochiq qoladi: 1 ta (20 000).', 'xulosa: kartaga');
  const k2 = await qoldiq('Karta A');
  await p.click('#w-saqlash'); await p.waitForSelector('.kun');
  teng(bo(await p.textContent('.toast')), '1 xarajat, 2 ta qarz (1 tasi yopildi) yozildi', 'xabar: kartaga');
  teng(await qoldiq('Karta A') - k2, -60000 + 20000, 'karta: −60 000 + 20 000');

  // ======== 4) Naqd hisob yo'q: aylanma QARZ -> KARTA -> QARZ ========
  await p.evaluate(async () => { const h = (await Data.hammasi('hisoblar')).filter((x) => x.nom === 'Naqd pul')[0]; await Data.saqlash('hisoblar', Object.assign({}, h, { arxivlangan: true })); });
  await p.goto(MANZIL); await p.waitForSelector('#ekran h1');
  await wizard('10000', 'Karta A'); await odamlar(2, ['Bobur']);
  teng(bo(await p.textContent('.bolish-naqd-yoq')), 'Naqd hisob yo\'q', '"Naqd hisob yo\'q" izohi');
  await p.click('#bolish-holat-0'); teng((await holatlar())[0], 'karta|Holat: kartaga o\'tkazdi', 'naqd o\'tkazib yuborildi');
  await p.click('#bolish-holat-0'); teng((await holatlar())[0], 'qarz|Holat: qarz', 'qarzga qaytdi');
  await olchov('naqd yo\'q'); await rasm('4-naqd-yoq');
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
