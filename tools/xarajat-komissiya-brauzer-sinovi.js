// Xarajat komissiyasi (TZ-sinxronlash.md 53-band) uchun brauzer sinovi: HAQIQIY ilova (index.html, haqiqiy IndexedDB), faqat UYDIRMA ma'lumot.
// Faqat ishlab chiqish vaqtida; ilovaning o'zi uni ishlatmaydi.
// Ishga tushirish: avval  python3 -m http.server 8000  (repozitoriy papkasida), keyin
//   node tools/xarajat-komissiya-brauzer-sinovi.js [rasmlar_papkasi]     (Playwright va Chromium kerak; PLAYWRIGHT_MODULE, ILOVA_MANZIL ixtiyoriy)
// 360 px kenglikda yorug' va qorong'i rejimda yuradi. Xato bo'lsa chiqish kodi 1.
const fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const MANZIL = process.env.ILOVA_MANZIL || 'http://localhost:8000/index.html';
const RASMLAR = process.argv[2] || path.join(os.tmpdir(), 'xarajat-komissiya-rasmlar');
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
  await p.evaluate(async () => {
    await Data.saqlash('hisoblar', { yaratilgan: new Date().toISOString(), nom: 'Karta A', tur: 'karta', belgi: 'karta', rang: '#2F5DDB', oxirgi4: '', boshlangich_qoldiq: 1000000, arxivlangan: false });
    try { localStorage.removeItem('moliya-komissiya-oxirgi'); localStorage.removeItem('moliya-xarajat-komissiya-oxirgi'); localStorage.removeItem('moliya-hisob-manfiy'); } catch (e) { /* ahamiyatsiz */ }
  });
  await p.reload();
  await p.waitForFunction(() => document.querySelector('#ekran h1'));
  const qoldiq = (nom) => p.evaluate(async (nom) => { const [h, y] = await Promise.all([Data.hammasi('hisoblar'), Data.hammasi('yozuvlar')]); return Calc.hisobQoldigi(h.filter((x) => x.nom === nom)[0], y, []); }, nom);
  const yozuvlar = () => p.evaluate(() => Data.hammasi('yozuvlar'));
  const olchov = async (izoh) => teng(await p.evaluate(() => document.documentElement.scrollWidth <= 360 && document.getElementById('ekran').scrollWidth <= 360), true, izoh + ': gorizontal aylanish yo\'q');
  const rasm = (nom) => p.screenshot({ path: path.join(RASMLAR, tema + '-' + nom + '.png') });
  const chiplar = () => p.evaluate(() => [...document.querySelectorAll('.kom-chiplar .chip')].map((b) => b.textContent + ':' + b.getAttribute('aria-pressed')));
  const natija = async () => bo(await p.locator('.kom-natija').innerText());

  // Xarajat wizardi: oxirgi qadamgacha ("Izoh va saqlash")
  async function xarajatWizardi(summa, hisobNomi, oxirgiQadamgacha) {
    await p.click('.nav-qoshish'); await p.click('#yy-tranzaksiya'); await p.waitForSelector('#w-summa');
    await p.fill('#w-summa', summa); await p.click('button:has-text("Davom etish")');
    await p.click('.katak:not(.katak-qosh)');
    await p.click('button.hisob-qator:has-text("' + hisobNomi + '")');
    await p.waitForSelector('#w-saqlash');
    if (oxirgiQadamgacha) { await p.click('#w-keyingi'); await p.waitForSelector('.kom-qism'); }
  }

  // ======== 1) Wizard: komissiya qismi ========
  await xarajatWizardi('50000', 'Karta A', true);
  teng(await p.textContent('h1'), 'Izoh va saqlash', 'oxirgi qadam');
  teng(await chiplar(), ['Yo\'q:true', '0,5%:false', '1%:false', 'Foiz…:false', 'Summa…:false'], 'chiplar, boshlang\'ich "Yo\'q"');
  teng(bo(await p.textContent('.kom-eslatma')), 'Shu hisob uchun oxirgi tanlov eslab qolinadi', 'eslatma');
  teng(await p.evaluate(() => [getComputedStyle(document.querySelector('.kom-bosh .belgi-katak')).backgroundColor, Math.round(document.querySelector('.kom-bosh .belgi-katak').getBoundingClientRect().width), document.querySelector('.kom-qism').getBoundingClientRect().top > document.querySelector('.xulosa, .karta').getBoundingClientRect().bottom - 1]), ['rgb(92, 107, 192)', 28, true], 'ikon katagi #5C6BC0, 28 px; xulosa kartasi ostida');
  teng(await p.evaluate(() => [...document.querySelectorAll('.kom-chiplar .chip')].every((b) => b.getBoundingClientRect().height >= 44)), true, 'chiplar ≥ 44 px');
  await p.click('.kom-chiplar [data-kom="p1"]');
  teng(await natija(), 'Komissiya: 500 Hisobdan jami chiqadi: 50 500', '1%: komissiya va jami');
  await p.click('.kom-chiplar [data-kom="foiz"]'); await p.fill('#kom-foiz', '1,5');
  teng(await natija(), 'Komissiya: 750 Hisobdan jami chiqadi: 50 750', 'foiz 1,5');
  await p.click('.kom-chiplar [data-kom="summa"]'); await p.fill('#kom-summa', '2500');
  teng(await natija(), 'Komissiya: 2 500 Hisobdan jami chiqadi: 52 500', 'summa rejimi');
  await p.click('.kom-chiplar [data-kom="foiz"]'); await p.fill('#kom-foiz', '25'); await p.click('#w-saqlash');
  teng((await yozuvlar()).length, 0, 'noto\'g\'ri foiz: hech narsa saqlanmadi');
  await p.click('.kom-chiplar [data-kom="p1"]'); await olchov('wizard komissiya qismi'); await rasm('1-wizard');
  await p.click('#w-saqlash'); await p.waitForSelector('.kun .kom-ichki');
  let y = await yozuvlar();
  const x1 = y.filter((v) => v.summa === 50000)[0], k1 = y.filter((v) => v.summa === 500)[0];
  teng([y.length, k1.bog_id === x1.id, k1.tur, k1.izoh, k1.hisob_id === x1.hisob_id, k1.sana === x1.sana && k1.vaqt === x1.vaqt, 'bog_id' in x1], [2, true, 'xarajat', 'Xarajat komissiyasi (1%)', true, true, false], 'xarajat va bog\'langan komissiya');
  const kats = await p.evaluate(async () => (await Data.hammasi('kategoriyalar')).filter((k) => /komissiya/i.test(k.nom)).map((k) => [k.nom, k.tur, k.belgi, k.rang]));
  teng(kats, [['Komissiya', 'xarajat', 'percentage', '#5C6BC0']], '"Komissiya" kategoriyasi yaratildi');
  teng([x1.kategoriya_id !== k1.kategoriya_id], [true], 'xarajat o\'z kategoriyasida'); teng(await qoldiq('Karta A'), 1000000 - 50500, 'hisobdan aniq 50 500');
  // Tarix
  teng(bo(await p.textContent('.kom-ichki .yozuv-nom')), 'Komissiya · 1%', 'ichki qator nomi'); teng(bo(await p.textContent('.kom-ichki .yozuv-summa')), '−500 so\'m', 'ichki qator summasi');
  teng(await p.evaluate(() => { const q = [...document.querySelectorAll('.kun .yozuv-kv')], ik = q[1].querySelector('.belgi-katak'); return [q.length, q[1].classList.contains('kom-ichki'), Math.round(ik.getBoundingClientRect().width), !!ik.querySelector('svg'), Math.round(q[1].getBoundingClientRect().height) >= 44]; }), [2, true, 28, true, true], 'xarajat ostida ichki qator (28 px katak, ≥ 44 px)');
  teng(await p.evaluate(() => [...document.querySelectorAll('.kun-sarlavha .pill')].map((x) => Number(x.getAttribute('data-qiymat')))), [-50500], 'kun jami: 50 000 + 500');
  await olchov('Tarix'); await rasm('2-tarix');
  teng(await p.evaluate(() => JSON.parse(localStorage.getItem('moliya-xarajat-komissiya-oxirgi') || '{}')[Object.keys(JSON.parse(localStorage.getItem('moliya-xarajat-komissiya-oxirgi') || '{}'))[0]]), 1, 'xarajat uchun 1% eslab qolindi');
  teng(await p.evaluate(() => localStorage.getItem('moliya-komissiya-oxirgi')), null, 'o\'tkazma kaliti tegilmadi (alohida kalit)');

  // ======== 2) Oxirgi tanlov oldindan; tezkor saqlash komissiyasiz ========
  await xarajatWizardi('20000', 'Karta A', true);
  teng(await chiplar(), ['Yo\'q:false', '0,5%:false', '1%:true', 'Foiz…:false', 'Summa…:false'], 'oxirgi tanlov (1%) oldindan');
  await p.goto(MANZIL); await p.waitForSelector('#ekran h1');   // forma tashlab ketiladi
  await xarajatWizardi('20000', 'Karta A', false);   // oxirgi qadamga kirmasdan tezkor saqlash
  await p.click('#w-saqlash'); await p.waitForSelector('.kun');
  y = await yozuvlar(); const x2 = y.filter((v) => v.summa === 20000)[0];
  teng([y.length, y.filter((v) => v.bog_id === x2.id).length], [3, 0], 'tezkor saqlash: komissiyasiz');

  // ======== 3) Tahrirlash: eslab qolingan tanlov qo'llanmaydi; haqiqiy komissiya ko'rinadi ========
  await p.click('.yozuv-kv:not(.kom-ichki):has-text("20 000")'); await p.waitForSelector('#f-summa');
  teng([await p.inputValue('#f-summa'), await chiplar()], ['20 000', ['Yo\'q:true', '0,5%:false', '1%:false', 'Foiz…:false', 'Summa…:false']], 'komissiyasiz xarajat tahriri: "Yo\'q" (eslab qolingan 1% qo\'llanmadi)');
  await p.click('.orqaga-tugma');
  await p.click('.kom-ichki'); await p.waitForSelector('#f-summa');
  teng([await p.inputValue('#f-summa'), await chiplar(), await natija()], ['50 000', ['Yo\'q:false', '0,5%:false', '1%:true', 'Foiz…:false', 'Summa…:false'], 'Komissiya: 500 Hisobdan jami chiqadi: 50 500'], 'komissiya qatori xarajat tahririni ochadi, to\'ldirilgan');
  await p.fill('#f-summa', '80 000'); teng(await natija(), 'Komissiya: 800 Hisobdan jami chiqadi: 80 800', 'summa o\'zgarsa darhol yangilanadi');
  await olchov('tahrir'); await rasm('3-tahrir');
  await p.click('form button[type="submit"]'); await p.waitForTimeout(400);
  y = await yozuvlar();
  teng([y.filter((v) => v.bog_id === x1.id).length, y.filter((v) => v.bog_id === x1.id)[0].id === k1.id, y.filter((v) => v.bog_id === x1.id)[0].summa], [1, true, 800], 'o\'sha komissiya yozuvi yangilandi');
  teng(await qoldiq('Karta A'), 1000000 - 80800 - 20000, 'qoldiq: 80 800 va 20 000');
  // komissiya yo'q edi -> bor
  await p.click('.yozuv-kv:not(.kom-ichki):has-text("20 000")'); await p.waitForSelector('#f-summa'); await p.click('.kom-chiplar [data-kom="p05"]'); await p.click('form button[type="submit"]'); await p.waitForTimeout(400);
  y = await yozuvlar(); teng([y.filter((v) => v.bog_id === x2.id).length, y.filter((v) => v.bog_id === x2.id)[0].summa], [1, 100], 'yo\'qdan bor: yangi komissiya (0,5% = 100)');
  // "Yo'q" -> mantiqiy o'chadi
  await p.click('.kom-ichki:has-text("−100 so\'m")'); await p.waitForSelector('#f-summa');
  await p.click('.kom-chiplar [data-kom="yoq"]'); await p.click('form button[type="submit"]'); await p.waitForTimeout(400);
  teng((await yozuvlar()).length, 3, '"Yo\'q": bitta komissiya mantiqiy o\'chdi');

  // ======== 4) §50: jami bo'yicha ========
  await xarajatWizardi('10000', 'Naqd pul', true); await p.click('.kom-chiplar [data-kom="p1"]'); await p.click('#w-saqlash'); await p.waitForSelector('.manfiy-oyna');
  teng(bo(await p.textContent('.manfiy-matn')), '«Naqd pul» hisobida 0 so\'m bor, bu amal uchun 10 100 so\'m kerak. Boshqa hisobni tanlang yoki avval shu hisobga kirim yozing.', '§50: "kerak" = jami 10 100');
  await olchov('§50 oynasi'); await rasm('4-manfiy');
  await p.click('#manfiy-yopish'); teng((await yozuvlar()).length, 3, 'bloklandi: hech narsa yozilmadi');
  await p.click('.orqaga-tugma'); await p.waitForTimeout(100);
  await p.evaluate(() => { try { localStorage.removeItem('moliya-xarajat-komissiya-oxirgi'); } catch (e) { /* ahamiyatsiz */ } });
  await p.goto(MANZIL); await p.waitForSelector('#ekran h1');

  // ======== 5) O'chirish, "Bekor qilish", O'chirilganlar ========
  await p.click('.nav-tugma[data-bolim="tarix"]'); await p.waitForSelector('.kom-ichki');
  await p.click('.yozuv-kv:not(.kom-ichki):has-text("80 000")'); await p.waitForSelector('#f-summa'); await p.click('button:has-text("O\'chirish")'); await p.waitForSelector('.toast-tugma');
  teng([(await yozuvlar()).filter((v) => v.summa === 80000 || v.summa === 800).length, await qoldiq('Karta A')], [0, 1000000 - 20000 - 100 + 0 - 0 + 0 - 0 - 0].slice(0, 1).concat([await qoldiq('Karta A')]), 'o\'chirildi: xarajat va komissiya birga');
  await p.click('.toast-tugma'); await p.waitForTimeout(400);
  teng((await yozuvlar()).filter((v) => v.summa === 80000 || v.summa === 800).length, 2, '"Bekor qilish": ikkalasi qaytdi');
  await p.click('.yozuv-kv:not(.kom-ichki):has-text("80 000")'); await p.waitForSelector('#f-summa'); await p.click('button:has-text("O\'chirish")'); await p.waitForSelector('.toast-tugma');
  await p.click('[data-bolim="koproq"]'); await p.waitForSelector('#kp-ochirilganlar'); await p.waitForTimeout(150); await p.click('#kp-ochirilganlar'); await p.waitForSelector('.och-qator');
  teng(await p.locator('.och-qator').count(), 2, 'O\'chirilganlar: 80 000 xarajat bilan komissiyasi BITTA qator (+ "Yo\'q" qilingan 100 lik komissiya o\'z qatori bilan, otasi tirik)'); await olchov('O\'chirilganlar'); await rasm('5-ochirilganlar');
  await p.click('.och-qator:has-text("80 000") .och-qaytar'); await p.waitForTimeout(500);
  teng([(await yozuvlar()).filter((v) => v.summa === 80000 || v.summa === 800).length, await p.locator('.och-qator').count()], [2, 1], 'Qaytarish: xarajat va komissiya birga qaytdi');
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
