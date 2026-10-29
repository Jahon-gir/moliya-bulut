// Qarz to'lovini tahrirlash va bekor qilish (TZ-sinxronlash.md 51-band) uchun brauzer sinovi: HAQIQIY ilova (index.html, haqiqiy IndexedDB), faqat UYDIRMA ma'lumot.
// Faqat ishlab chiqish vaqtida; ilovaning o'zi uni ishlatmaydi.
// Ishga tushirish: avval  python3 -m http.server 8000  (repozitoriy papkasida), keyin
//   node tools/tolov-brauzer-sinovi.js [rasmlar_papkasi]     (Playwright va Chromium kerak; PLAYWRIGHT_MODULE, ILOVA_MANZIL ixtiyoriy)
// 360 px kenglikda yorug' va qorong'i rejimda yuradi. Xato bo'lsa chiqish kodi 1.
const fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const MANZIL = process.env.ILOVA_MANZIL || 'http://localhost:8000/index.html';
const RASMLAR = process.argv[2] || path.join(os.tmpdir(), 'tolov-rasmlar');
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
  // Uydirma ma'lumot: Karta A 1 000 000; Karta B 0; Eski karta (arxivlangan). Qarzlar: "Bank" (oldim 100 000, ikki to'lov bilan to'liq yopilgan),
  // "Zafar" (oldim 100 000, 10 000 Karta B dan — Karta B qoldig'i −10 000), "Ali" (berdim 50 000, 20 000 qaytgan)
  await p.evaluate(async () => {
    const yaratilgan = new Date().toISOString();
    const yoz = (nom, q, arx) => Data.saqlash('hisoblar', { yaratilgan, nom, tur: 'karta', belgi: 'karta', rang: '#2F5DDB', oxirgi4: '', boshlangich_qoldiq: q, arxivlangan: !!arx });
    await yoz('Karta A', 1000000); await yoz('Karta B', 0); await yoz('Eski karta', 0, true);
    const h = await Data.hammasi('hisoblar'), id = (n) => h.filter((x) => x.nom === n)[0].id, T = (s, sana, vaqt, hisob) => ({ id: Data.yangiId(), summa: s, sana, vaqt, hisob_id: id(hisob) });
    const q = (shaxs, yon, summa, hisob, tolovlar) => Data.saqlash('qarzlar', { id: Data.yangiId(), yaratilgan, yonalish: yon, shaxs, summa, hisob_id: id(hisob), sana: '2026-10-01', vaqt: '09:00', muddat: '', izoh: '', tolovlar });
    await q('Bank', 'oldim', 100000, 'Karta A', [T(60000, '2026-10-02', '10:00', 'Karta A'), T(40000, '2026-10-03', '11:00', 'Eski karta')]);
    await q('Zafar', 'oldim', 100000, 'Karta A', [T(10000, '2026-10-02', '10:00', 'Karta B')]);
    await q('Ali', 'berdim', 50000, 'Karta A', [T(20000, '2026-10-02', '10:00', 'Karta A')]);
    try { localStorage.removeItem('moliya-hisob-manfiy'); } catch (e) { /* ahamiyatsiz */ }
  });
  await p.reload();
  await p.waitForFunction(() => document.querySelector('#ekran h1'));
  const rasm = (nom) => p.screenshot({ path: path.join(RASMLAR, tema + '-' + nom + '.png') });
  const olchov = async (izoh) => teng(await p.evaluate(() => document.documentElement.scrollWidth <= 360), true, izoh + ': gorizontal aylanish yo\'q');
  const qarz = (shaxs) => p.evaluate(async (s) => (await Data.hammasiniOqish()).qarzlar.filter((q) => q.shaxs === s)[0], shaxs);
  const qoldiq = (nom) => p.evaluate(async (nom) => { const [h, y, q] = await Promise.all([Data.hammasi('hisoblar'), Data.hammasi('yozuvlar'), Data.hammasi('qarzlar')]); return Calc.hisobQoldigi(h.filter((x) => x.nom === nom)[0], y, q); }, nom);
  const qatorlar = () => p.evaluate(() => [...document.querySelectorAll('.tolov-qator')].map((r) => [r.querySelector('.tolov-sana').textContent, r.querySelector('.tolov-hisob').textContent, r.querySelector('.tolov-summa').textContent]));
  const yopilganOch = async () => { await p.click('[data-bolim="qarzlar"]'); await p.waitForSelector('.qarz-tanlov'); await p.click('.arxiv-tugma'); await p.waitForSelector('.qarz-qator'); };
  const qarzlarOch = async (shaxs, tanlov) => { await p.click('[data-bolim="qarzlar"]'); await p.waitForSelector('.qarz-tanlov'); await p.click('[data-tanlov="' + tanlov + '"]'); await p.click('.odam-qator[data-shaxs="' + shaxs + '"]'); await p.waitForSelector('.qarz-tafsilot'); };

  // ======== 1) Yopilgan qarz: to'lovlar ro'yxati va "⋯" ========
  await yopilganOch();
  teng(await p.locator('.qarz-qator').count(), 1, 'yopilgan ro\'yxatda faqat Bank');
  await p.click('.qarz-qator[data-shaxs="Bank"]'); await p.waitForSelector('.tolov-qator');
  teng(await qatorlar(), [['03.10.2026 · 11:00', 'Eski karta (arxiv)', '40 000 so\'m'], ['02.10.2026 · 10:00', 'Karta A', '60 000 so\'m']], 'to\'lovlar yangisi tepada; arxivlangan hisob "(arxiv)" bilan');
  teng(await p.evaluate(() => { const r = document.querySelector('.tolov-qator'), d = r.querySelector('.tolov-menyu'), b = d.getBoundingClientRect(), s = getComputedStyle(r.querySelector('.tolov-sana')), h = getComputedStyle(r.querySelector('.tolov-hisob')); return [b.width >= 44 && b.height >= 44, !!d.querySelector('svg'), s.fontSize, h.fontSize, h.color !== s.color, getComputedStyle(r.querySelector('.tolov-summa')).fontWeight >= 700, d.getAttribute('aria-label')]; }),
    [true, true, '14px', '12px', true, true, 'To\'lov amallari: 03.10.2026, 40 000 so\'m'], '"⋯" ≥ 44 px, sana 14 px, hisob 12 px kulrang, summa qalin, aria-label');
  teng(await p.evaluate(() => document.querySelectorAll('.tolov-qator button.yozuv, button.tolov-qator').length), 0, 'qator bosilmaydi: faqat "⋯"');
  await olchov('yopilgan qarz tafsiloti'); await rasm('1-yopilgan-qarz');

  // ======== 2) "⋯" oynasi ========
  await p.click('.tolov-qator:first-child .tolov-menyu, .tolov-qator .tolov-menyu'); await p.waitForSelector('.tolov-oynasi');
  teng(await p.evaluate(() => [...document.querySelectorAll('.tolov-amal')].map((b) => [b.innerText.replace(/\s+/g, ' ').trim(), Math.round(b.getBoundingClientRect().height) >= 48, !!b.querySelector('svg')])),
    [['To\'lovni tahrirlash', true, true], ['To\'lovni bekor qilish Qarz yana ochiq bo\'ladi, pul hisobga qaytadi', true, true]], 'oyna: ikki qator (≥ 48 px, ikonli), olingan qarz uchun matn');
  teng(await p.evaluate(() => getComputedStyle(document.querySelector('.tolov-amal-belgi.qizil')).color !== getComputedStyle(document.querySelector('.tolov-tahrir .tolov-amal-belgi')).color), true, 'bekor qilish ikoni qizil');
  await olchov('"⋯" oynasi'); await rasm('2-menyu-oynasi');
  await p.mouse.click(180, 20); await p.waitForTimeout(100);
  teng(await p.locator('.tolov-oynasi').count(), 0, 'tashqariga bosilsa yopiladi');

  // ======== 3) Tahrirlash: chegaralar va saqlash ========
  await p.click('.tolov-qator .tolov-menyu'); await p.click('.tolov-tahrir'); await p.waitForSelector('#t-summa');
  teng([await p.inputValue('#t-summa'), await p.evaluate(() => document.querySelector('#t-hisob').selectedOptions[0].textContent)], ['40 000', 'Eski karta (arxiv)'], 'tahrir shakli to\'ldirilgan; arxivlangan hisob tushunarli');
  await p.fill('#t-summa', '41 000'); await p.click('form button[type="submit"]');
  teng(bo(await p.textContent('#t-summa ~ .xato-matn, .xato-matn:not(:empty)')).includes('qolgan qarzdan oshmasin'), true, 'yig\'indi qarzdan oshsa xato (eski 40 000 chiqarib olinadi: qolgan 40 000)');
  await p.fill('#t-summa', '40 000'); await p.selectOption('#t-hisob', { label: 'Karta A' }); await p.click('form button[type="submit"]'); await p.waitForSelector('.tolov-qator');
  teng((await qatorlar())[0], ['03.10.2026 · 11:00', 'Karta A', '40 000 so\'m'], 'tahrirdan keyin hisob almashdi');
  teng(await p.locator('.manfiy-oyna').count(), 0, '§50: Karta A da pul yetarli');

  // ======== 4) Bekor qilish: tasdiq, "Yo'q", "Ha", undo ========
  const oldinA = await qoldiq('Karta A');
  await p.click('.tolov-qator .tolov-menyu'); await p.click('.tolov-bekor'); await p.waitForSelector('#tolov-bekor-ha');
  teng(bo(await p.textContent('.sheet h2')), 'Bu to\'lovni bekor qilasizmi?', 'tasdiq sarlavhasi');
  teng(await p.evaluate(() => [...document.querySelectorAll('.manfiy-tugmalar button')].map((b) => [b.textContent, Math.round(b.getBoundingClientRect().height) >= 48])), [['Yo\'q', true], ['Ha, bekor qilish', true]], 'ikki tugma (48 px)');
  teng(await p.evaluate(() => getComputedStyle(document.querySelector('#tolov-bekor-ha')).backgroundColor), tema === 'dark' ? 'rgb(255, 138, 128)' : 'rgb(198, 40, 40)', '"Ha, bekor qilish" qizil');
  await rasm('3-tasdiq');
  await p.click('#tolov-bekor-yoq'); await p.waitForTimeout(100);
  teng([await p.locator('.sheet-parda').count(), (await qatorlar()).length, (await qarz('Bank')).tolovlar.filter((t) => t.deleted).length], [0, 2, 0], '"Yo\'q": hech narsa o\'zgarmadi');
  await p.click('.tolov-qator .tolov-menyu'); await p.click('.tolov-bekor'); await p.click('#tolov-bekor-ha'); await p.waitForSelector('.toast-tugma');
  teng(bo(await p.textContent('.toast')), 'To\'lov bekor qilindiBekor qilish', 'toast va "Bekor qilish"');
  const bank = await qarz('Bank');
  teng([bank.tolovlar.length, bank.tolovlar.filter((t) => t.deleted === true).length, bank.tolovlar.filter((t) => t.deleted === true)[0].summa, bank.summa, bank.yopilgan], [2, 1, 40000, 100000, false], 'bazada qator saqlanadi (deleted = true), qarz summasi va yopilgan belgisi to\'g\'ri');
  teng(await qatorlar(), [['02.10.2026 · 10:00', 'Karta A', '60 000 so\'m']], 'ro\'yxat darhol yangilandi');
  teng(bo(await p.evaluate(() => [...document.querySelectorAll('.qarz-tafsilot .qator')].map((r) => r.innerText.replace(/\s+/g, ' ')).filter((t) => /^(Qaytarilgan|Qolgan)/.test(t)).join('|'))), 'Qaytarilgan 60 000 so\'m|Qolgan 40 000 so\'m', 'qolgan summa qayta hisoblandi');
  teng(await p.locator('button:has-text("Qaytardim")').count(), 1, 'qarz ochiq: to\'lov tugmasi qaytdi');
  teng((await qoldiq('Karta A')) - oldinA, 40000, 'Karta A qoldig\'i: pul hisobga qaytdi (+40 000)');
  await olchov('bekor qilingandan keyin'); await rasm('4-bekor-qilingan');
  // qarz yopilgan ro'yxatdan ochiq ro'yxatga o'tdi
  await p.click('.orqaga-tugma'); await p.waitForSelector('.qarz-qator, .yozuv').catch(() => {});
  await p.click('[data-bolim="qarzlar"]'); await p.waitForSelector('.qarz-tanlov'); await p.click('[data-tanlov="oldim"]');
  teng(await p.locator('.odam-qator[data-shaxs="Bank"]').count(), 1, 'Bank ochiq ro\'yxatga (Olingan) qaytdi');
  await p.click('.arxiv-tugma').catch(() => {}); teng(await p.locator('.qarz-qator[data-shaxs="Bank"]').count(), 0, 'yopilgan ekranda ko\'rinmaydi');
  // undo
  await p.click('[data-bolim="qarzlar"]'); await p.click('[data-tanlov="oldim"]'); await p.click('.odam-qator[data-shaxs="Bank"]'); await p.waitForSelector('.tolov-qator');
  await p.click('.tolov-qator .tolov-menyu'); await p.click('.tolov-bekor'); await p.click('#tolov-bekor-ha'); await p.waitForSelector('.toast-tugma');
  teng((await qatorlar()).length, 0, 'qolgan to\'lov ham bekor qilindi (qarz to\'liq ochiq)');
  await p.click('.toast-tugma'); await p.waitForTimeout(400);
  teng((await qatorlar()).length, 1, 'undo: to\'lov qaytdi');
  teng((await qarz('Bank')).tolovlar.filter((t) => t.deleted !== true).length, 1, 'bazada bitta to\'lov tirik (ikkinchisi avval bekor qilingan)');

  // ======== 5) Tahrir shaklidagi "To'lovni bekor qilish" ========
  await p.click('.tolov-qator .tolov-menyu'); await p.click('.tolov-tahrir'); await p.waitForSelector('#t-summa');
  await p.click('button:has-text("To\'lovni bekor qilish")'); await p.waitForSelector('#tolov-bekor-ha'); await p.click('#tolov-bekor-ha');
  await p.waitForSelector('.tolov-qator, .qarz-tafsilot'); await p.waitForTimeout(300);
  teng([await p.locator('#t-summa').count(), (await qarz('Bank')).tolovlar.filter((t) => t.deleted !== true).length], [0, 0], 'shakldan: ro\'yxatga qaytdi, to\'lov bekor');

  // ======== 6) §50: tahrirda tekshiriladi, bekor qilishda tekshirilmaydi ========
  await qarzlarOch('Zafar', 'oldim');
  teng(await qoldiq('Karta B'), -10000, 'Karta B qoldig\'i −10 000 (tarixiy manfiy)');
  await p.click('.tolov-qator .tolov-menyu'); await p.click('.tolov-tahrir'); await p.waitForSelector('#t-summa');
  await p.fill('#t-summa', '20 000'); await p.click('form button[type="submit"]'); await p.waitForSelector('.manfiy-oyna');
  teng(bo(await p.textContent('.manfiy-matn')), '«Karta B» hisobida 0 so\'m bor, bu amal uchun 20 000 so\'m kerak. Boshqa hisobni tanlang yoki avval shu hisobga kirim yozing.', 'tahrir: eski ta\'sir olib tashlanib tekshirildi');
  await p.click('#manfiy-hisob'); await p.waitForTimeout(100);
  teng([await p.evaluate(() => document.activeElement.id), await p.inputValue('#t-summa'), (await qarz('Zafar')).tolovlar[0].summa], ['t-hisob', '20 000', 10000], 'forma ma\'lumoti saqlandi, baza o\'zgarmadi');
  await p.fill('#t-summa', '5 000'); await p.click('form button[type="submit"]'); await p.waitForTimeout(400);
  teng([await p.locator('.manfiy-oyna').count(), (await qarz('Zafar')).tolovlar[0].summa], [0, 5000], 'kamaytirish bloklanmaydi');
  await qarzlarOch('Zafar', 'oldim');
  await p.click('.tolov-qator .tolov-menyu'); await p.click('.tolov-bekor'); await p.click('#tolov-bekor-ha'); await p.waitForTimeout(400);
  teng([await p.locator('.manfiy-oyna').count(), (await qarz('Zafar')).tolovlar.filter((t) => t.deleted).length, await qoldiq('Karta B')], [0, 1, 0], 'bekor qilish §50 bo\'yicha tekshirilmadi');

  // ======== 7) Berdim qarz: matn yo'nalishga mos ========
  await qarzlarOch('Ali', 'berdim');
  await p.click('.tolov-qator .tolov-menyu'); await p.waitForSelector('.tolov-oynasi');
  teng(bo(await p.textContent('.tolov-bekor .tolov-amal-matn .xira')), 'Qarz yana ochiq bo\'ladi, pul hisobdan chiqadi', 'berdim: pul hisobdan chiqadi');
  await rasm('5-berdim-menyu'); await olchov('berdim menyu');
  await kontekst.close();
}

(async () => {
  const brauzer = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const tema of ['light', 'dark']) {
    try { await senariy(brauzer, tema); } catch (e) { xatolar++; console.log('  ✗ ' + (e && e.message ? e.message.split('\n').slice(0, 3).join(' | ') : e) + (e && e.stack ? ' @ ' + (e.stack.match(/tolov-brauzer-sinovi\.js:\d+/) || [''])[0] : '')); }
  }
  await brauzer.close();
  console.log(jami + ' tekshiruv, xato: ' + xatolar + ' (rasmlar: ' + RASMLAR + ')');
  process.exit(xatolar ? 1 : 0);
})();
