// Bo'lib to'lash: kim darhol qaytardi (TZ-sinxronlash.md 57-band, 57.8: ikki holat va "tushdi" hisobi) uchun brauzer sinovi: HAQIQIY ilova (index.html, haqiqiy IndexedDB), faqat UYDIRMA ma'lumot va ismlar.
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
  // Uydirma ma'lumot: Karta A 1 000 000, Karta B 0, arxivlangan "Eski karta"; tayyor "Naqd pul" (naqd, 0) ilovaning o'zida bor
  await p.evaluate(async () => {
    await Data.saqlash('hisoblar', { yaratilgan: new Date().toISOString(), nom: 'Karta A', tur: 'karta', belgi: 'karta', rang: '#2F5DDB', oxirgi4: '', boshlangich_qoldiq: 1000000, arxivlangan: false });
    await Data.saqlash('hisoblar', { yaratilgan: new Date().toISOString(), nom: 'Karta B', tur: 'karta', belgi: 'karta', rang: '#2EA84F', oxirgi4: '', boshlangich_qoldiq: 0, arxivlangan: false });
    await Data.saqlash('hisoblar', { yaratilgan: new Date().toISOString(), nom: 'Eski karta', tur: 'karta', belgi: 'karta', rang: '#888888', oxirgi4: '', boshlangich_qoldiq: 0, arxivlangan: true });
    try { localStorage.removeItem('moliya-bolish-tushdi-oxirgi'); } catch (e) { /* ahamiyatsiz */ }
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

  const tushdi = (i) => p.evaluate((i) => { const t = document.getElementById('bolish-tushdi-' + i); return t ? [...t.children].map((c) => c.textContent).join(' ').trim() : null; }, i);
  const eslab = () => p.evaluate(() => localStorage.getItem('moliya-bolish-tushdi-oxirgi'));
  const hisobId = (nom) => p.evaluate(async (nom) => (await Data.hammasi('hisoblar')).filter((h) => h.nom === nom)[0].id, nom);
  async function oynadanTanla(i, nom, hammasi) {
    await p.click('#bolish-tushdi-' + i); await p.waitForSelector('.bolish-tushdi-oynasi');
    if (hammasi) await p.click('#bolish-hammasi');
    await p.click('.bolish-hisob-qator:has-text("' + nom + '")'); await p.waitForSelector('.bolish-tushdi-oynasi', { state: 'detached' });
  }

  // ======== 1) Ikki holatli tugma, legend, "tushdi" qatori ========
  await wizard('347000', 'Karta A');
  await odamlar(6, ISMLAR);
  teng(await holatlar(), ISMLAR.map(() => 'qarz|Holat: qarz'), '5 ta tugma, boshlang\'ich QARZ');
  teng(await p.evaluate(() => { const b = document.getElementById('bolish-holat-0'), r = b.getBoundingClientRect(), i = b.querySelector('.bolish-holat-ich').getBoundingClientRect(), s = b.parentElement.querySelector('.bolish-summa').getBoundingClientRect(); return [Math.round(r.width) >= 44 && Math.round(r.height) >= 44, Math.round(i.width), Math.round(i.height), r.left >= s.right, !!b.querySelector('svg'), b.textContent.trim()]; }),
    [true, 40, 40, true, true, ''], 'tugma: bosish ≥ 44 px, katak 40×40, summadan o\'ngda, faqat ikon');
  teng(await p.evaluate(() => getComputedStyle(document.querySelector('#bolish-holat-0 .bolish-holat-ich')).color), await rang('--text-warning'), 'qarz: sariq');
  teng(bo(await p.textContent('.bolish-legend')), 'berdiqarzHisob nomini bosib o\'zgartirasiz', 'legend: berdi, qarz, izoh');
  teng([await p.locator('.bolish-legend-band svg').count(), await p.locator('.bolish-naqd-yoq').count(), await p.locator('.bolish-tushdi').count()], [2, 0, 0], 'legend 2 ikon; "Naqd hisob yo\'q" yo\'q; qarzda "tushdi" yo\'q');
  teng(await xulosa(), 'Saqlansa: xarajat 57 835, 5 ta qarz. Ochiq qoladi: 5 ta (289 165).', 'xulosa: hammasi qarz');
  await p.click('#bolish-holat-0'); teng((await holatlar())[0], 'berdi|Holat: berdi', 'bosish: berdi');
  teng(await p.evaluate(() => getComputedStyle(document.querySelector('#bolish-holat-0 .bolish-holat-ich')).color), await rang('--text-success'), 'berdi: yashil');
  teng(await tushdi(0), 'tushdi: Naqd pul', '"tushdi" — boshlang\'ich (c): naqd turidagi hisob');
  teng(await p.evaluate(() => { const t = document.getElementById('bolish-tushdi-0'), n = t.querySelector('.bolish-tushdi-nom'); return [Math.round(t.getBoundingClientRect().height) >= 44, getComputedStyle(n).fontWeight >= 600, getComputedStyle(n).textOverflow, !!t.querySelector('svg')]; }), [true, true, 'ellipsis', true], '"tushdi": ≥ 44 px, qalin, ellipsis, chevron');
  await p.click('#bolish-holat-0'); teng([(await holatlar())[0], await tushdi(0)], ['qarz|Holat: qarz', null], 'yana bosish: qarz, "tushdi" yo\'qoladi');

  // ======== 2) Oyna: ochilishi, ro'yxat, tanlash, yopilishi, "Hammasi shu hisobga" ========
  for (const i of [0, 2, 4]) await p.click('#bolish-holat-' + i);
  await p.click('#bolish-tushdi-2'); await p.waitForSelector('.bolish-tushdi-oynasi');
  teng(await p.evaluate(() => { const o = document.querySelector('.bolish-tushdi-oynasi'); return [o.querySelector('h2').textContent, [...o.querySelectorAll('.bolish-hisob-qator')].map((q) => q.textContent.trim() + ':' + q.getAttribute('aria-checked')), o.querySelector('#bolish-hammasi').getAttribute('aria-checked'), o.querySelector('#bolish-hammasi').textContent.trim(), getComputedStyle(o, '::before').width]; }),
    ['Pul qaysi hisobga tushdi?', ['Naqd pul:true', 'Karta A:false', 'Karta B:false'], 'false', 'Hammasi shu hisobga (berganlar uchun)', '40px'], 'oyna: sarlavha, faol hisoblar (arxivlangan yo\'q), tanlangani, belgilash o\'chiq, tutqich');
  teng(await p.evaluate(() => [...document.querySelectorAll('.bolish-hisob-qator')].every((q) => q.getBoundingClientRect().height >= 44 && q.querySelector('svg'))), true, 'qatorlar ≥ 44 px, ikon katagi');
  await olchov('oyna'); await rasm('1-oyna');
  await p.keyboard.press('Escape'); await p.waitForSelector('.bolish-tushdi-oynasi', { state: 'detached' }); teng(await tushdi(2), 'tushdi: Naqd pul', 'Esc: o\'zgarmadi');
  await p.click('#bolish-tushdi-2'); await p.waitForSelector('.bolish-tushdi-oynasi'); await p.mouse.click(180, 20); await p.waitForSelector('.bolish-tushdi-oynasi', { state: 'detached' }); teng(await tushdi(2), 'tushdi: Naqd pul', 'tashqariga bosish: yopildi');
  await p.click('#bolish-tushdi-2'); await p.click('.bolish-tushdi-oynasi button:has-text("Orqaga")'); await p.waitForSelector('.bolish-tushdi-oynasi', { state: 'detached' }); teng(1, 1, '"Orqaga" yopadi');
  await oynadanTanla(2, 'Karta B'); teng([await tushdi(0), await tushdi(2), await tushdi(4)], ['tushdi: Naqd pul', 'tushdi: Karta B', 'tushdi: Naqd pul'], 'faqat 3-odam o\'zgardi, oyna yopildi');
  teng(await xulosa(), 'Saqlansa: xarajat 57 835, 5 ta qarz. Darhol yopiladi: 3 ta (Naqd pul hisobiga +115 666, Karta B hisobiga +57 833). Ochiq qoladi: 2 ta (115 666).', 'xulosa: guruh, kattasi oldin, "hisobiga"');
  await oynadanTanla(0, 'Karta A', true); teng([await tushdi(0), await tushdi(2), await tushdi(4)], ['tushdi: Karta A', 'tushdi: Karta A', 'tushdi: Karta A'], '"Hammasi shu hisobga": barcha berganlar');
  await p.click('#bolish-tushdi-0'); teng(await p.getAttribute('#bolish-hammasi', 'aria-checked'), 'true', 'belgilash formada eslab turiladi'); await p.click('#bolish-hammasi'); await p.keyboard.press('Escape');
  await oynadanTanla(0, 'Naqd pul'); await oynadanTanla(2, 'Karta B');
  // (a) zanjiri: yangi "berdi" odam — formada oxirgi tanlangan (Karta B)
  await p.click('#bolish-holat-1'); teng(await tushdi(1), 'tushdi: Karta B', '(a): formada oxirgi tanlangan'); await p.click('#bolish-holat-1');
  // qator o'chsa holati va hisobi ketadi, yangi qator QARZ
  await p.click('#bolish-kam'); teng((await holatlar()).length, 4, 'n = 5'); await p.click('#bolish-kop'); teng([(await holatlar())[4], await tushdi(4)], ['qarz|Holat: qarz', null], 'qayta qo\'shilgan qator QARZ');
  await p.fill('#bolish-ism-4', 'Karim'); await p.click('#bolish-holat-4'); await oynadanTanla(4, 'Naqd pul');
  await p.click('.bolish-chiplar [data-bolish="qolda"]'); teng((await holatlar()).map((x) => x.split('|')[0]), ['berdi', 'qarz', 'berdi', 'qarz', 'berdi'], 'qo\'lda: holatlar saqlandi');
  teng(await p.evaluate(() => { const r = document.querySelector('#bolish-holat-4').getBoundingClientRect(); return [Math.round(r.width) >= 44, r.right <= 360]; }), [true, true], 'qo\'lda: tugma 44 px');
  await olchov('qo\'lda'); await p.click('.bolish-chiplar [data-bolish="teng"]');
  await olchov('teng'); await p.locator('.bolish-jadval').scrollIntoViewIfNeeded(); await rasm('2-teng');

  // ======== 3) Saqlash: 2 Naqd pul, 1 Karta B, 2 qarz ========
  const kA = await qoldiq('Karta A'), nP = await qoldiq('Naqd pul'), kB = await qoldiq('Karta B');
  await p.fill('#w-izoh', 'Kafe'); await p.click('#w-saqlash'); await p.waitForSelector('.kun');
  teng(bo(await p.textContent('.toast')), '1 xarajat, 5 ta qarz (3 tasi yopildi) yozildi', 'xabar');
  const q = (await bazadan('qarzlar')).filter((z) => z.izoh === 'Kafe (bo\'lib to\'lash)');
  const nId = await hisobId('Naqd pul'), bId = await hisobId('Karta B');
  teng(q.filter((z) => z.tolovlar.length).map((z) => z.shaxs + ':' + (z.tolovlar[0].hisob_id === nId ? 'N' : z.tolovlar[0].hisob_id === bId ? 'B' : '?') + ':' + z.yopilgan).sort(), ['Ali:N:true', 'Karim:N:true', 'Sobir:B:true'], 'to\'lovlar tanlangan hisoblarga');
  teng([await qoldiq('Karta A') - kA, await qoldiq('Naqd pul') - nP, await qoldiq('Karta B') - kB], [-347000, 115666, 57833], 'qoldiqlar');
  teng(await eslab(), nId, 'localStorage: formada oxirgi tanlangan (Karim uchun Naqd pul)');
  await p.click('[data-bolim="qarzlar"]'); await p.waitForSelector('.odam-qator');
  teng(await p.evaluate(() => [...document.querySelectorAll('.odam-qator')].map((r) => r.getAttribute('data-shaxs')).sort()), ['Dilshod', 'Vali'], 'Qarzlar: faqat 2 ochiq');

  // ======== 4) Naqd turidagi hisob yo'q (foydalanuvchi holati): (b) eslab, keyin (d) xarajat hisobi ========
  await p.evaluate(async () => { const h = (await Data.hammasi('hisoblar')).filter((x) => x.nom === 'Naqd pul')[0]; await Data.saqlash('hisoblar', Object.assign({}, h, { tur: 'karta' })); });
  await p.goto(MANZIL); await p.waitForSelector('#ekran h1');
  await wizard('60000', 'Karta A'); await odamlar(3, ['Nodir', 'Jasur']);
  await p.click('#bolish-holat-0'); teng(await tushdi(0), 'tushdi: Naqd pul', '(b): shu qurilmada oxirgi tanlangan (turi endi karta)');
  await p.evaluate(() => localStorage.removeItem('moliya-bolish-tushdi-oxirgi'));
  await p.click('#bolish-holat-1'); teng(await tushdi(1), 'tushdi: Karta A', '(d): naqd turi yo\'q — xarajat hisobi');
  await oynadanTanla(0, 'Naqd pul');
  teng(await xulosa(), 'Saqlansa: xarajat 20 000, 2 ta qarz. Darhol yopiladi: 2 ta (Naqd pul hisobiga +20 000, Karta A hisobiga +20 000).', 'xulosa: "Naqd pul" turi karta bo\'lsa ham');
  const k2 = await qoldiq('Karta A'), n2 = await qoldiq('Naqd pul');
  await p.click('#w-saqlash'); await p.waitForSelector('.kun');
  teng(bo(await p.textContent('.toast')), '1 xarajat, 2 ta qarz (2 tasi yopildi) yozildi', 'xabar');
  teng([await qoldiq('Karta A') - k2, await qoldiq('Naqd pul') - n2, await eslab()], [-60000 + 20000, 20000, nId], 'qoldiqlar va eslab qolish yangilandi');
  // (b) arxivlangan bo'lsa e'tiborsiz
  await p.evaluate(async () => { const h = (await Data.hammasi('hisoblar')).filter((x) => x.nom === 'Naqd pul')[0]; await Data.saqlash('hisoblar', Object.assign({}, h, { arxivlangan: true })); });
  await p.goto(MANZIL); await p.waitForSelector('#ekran h1');
  await wizard('10000', 'Karta B'); await odamlar(2, ['Bobur']); await p.click('#bolish-holat-0');
  teng(await tushdi(0), 'tushdi: Karta B', 'arxivlangan eslab e\'tiborsiz — xarajat hisobi');
  await p.fill('#bolish-ism-0', 'Bobur Abdurahmonov Ortiqboyevich Valijonov');
  await olchov('uzun ism'); await rasm('3-naqd-turi-yoq');
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
