// Qarz komissiyasi (TZ-sinxronlash.md 42-band) uchun brauzer sinovi: HAQIQIY ilova (index.html, haqiqiy IndexedDB), faqat UYDIRMA ma'lumot.
// Faqat ishlab chiqish vaqtida; ilovaning o'zi uni ishlatmaydi.
// Ishga tushirish: avval  python3 -m http.server 8000  (repozitoriy papkasida), keyin  node tools/qarz-komissiya-brauzer-sinovi.js [rasmlar_papkasi]
// (PLAYWRIGHT_MODULE, CHROMIUM_PATH, ILOVA_MANZIL ixtiyoriy). 360 px, yorug' va qorong'i rejim. Xato bo'lsa chiqish kodi 1.
const fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const MANZIL = process.env.ILOVA_MANZIL || 'http://localhost:8000/index.html';
const RASMLAR = process.argv[2] || path.join(os.tmpdir(), 'qarz-komissiya-rasmlar');
fs.mkdirSync(RASMLAR, { recursive: true });
let jami = 0, xatolar = 0;
function teng(h, k, izoh) { jami++; if (JSON.stringify(h) !== JSON.stringify(k)) { xatolar++; console.log('  ✗ ' + izoh + ' — kutilgan: ' + JSON.stringify(k) + ', chiqdi: ' + JSON.stringify(h)); } }
const bo = (s) => String(s).replace(/\s+/g, ' ').trim();

async function senariy(brauzer, tema) {
  console.log('== ' + tema + ' rejim, 360 px ==');
  const kontekst = await brauzer.newContext({ viewport: { width: 360, height: 780 }, colorScheme: tema, serviceWorkers: 'block' });
  const p = await kontekst.newPage();
  p.on('pageerror', (e) => { if (!/IDBObjectStore/.test(e.message)) { xatolar++; console.log('  ✗ PAGEERROR ' + e.message); } });
  await p.goto(MANZIL);
  await p.waitForFunction(() => typeof Data !== 'undefined' && document.querySelector('#ekran h1'));
  if (await p.locator('#salom-davom').count()) { await p.click('#salom-davom'); await p.waitForSelector('#salom-ekran', { state: 'detached' }); }
  const kid = await p.evaluate(async () => {
    await Data.saqlash('hisoblar', { yaratilgan: new Date().toISOString(), nom: 'Karta A', tur: 'karta', belgi: 'karta', rang: '#2F5DDB', oxirgi4: '', boshlangich_qoldiq: 1000000, arxivlangan: false });
    await Data.saqlash('kategoriyalar', { yaratilgan: new Date().toISOString(), nom: 'Komissiyalar', tur: 'xarajat', rang: '#123456', belgi: 'tag', arxivlangan: false });
    return (await Data.hammasi('kategoriyalar')).filter((k) => k.nom === 'Komissiyalar')[0].id;
  });
  await p.reload(); await p.waitForFunction(() => document.querySelector('#ekran h1'));
  const holat = () => p.evaluate(async () => { const [h, y, q] = await Promise.all([Data.hammasi('hisoblar'), Data.hammasi('yozuvlar'), Data.hammasi('qarzlar')]); return { qoldiq: Calc.hisobQoldigi(h.filter((x) => x.nom === 'Karta A')[0], y, q), y, q }; });
  const olchov = async (i) => teng(await p.evaluate(() => document.documentElement.scrollWidth <= 360), true, i + ': gorizontal aylanish yo\'q');
  const rasm = (n) => p.screenshot({ path: path.join(RASMLAR, tema + '-' + n + '.png') });
  const chiplar = () => p.evaluate(() => [...document.querySelectorAll('.kom-chiplar .chip')].map((b) => b.textContent + ':' + b.getAttribute('aria-pressed')));
  const natija = async () => bo(await p.locator('.kom-natija').innerText());

  // ---- 1) "Berdim": komissiya yo'q; "Oldim": komissiya qismi ----
  await p.click('.nav-qoshish'); await p.click('#yy-qarz');
  await p.waitForSelector('#q-summa');
  teng(await p.isVisible('.kom-qism'), false, '"Men berdim"da komissiya qismi yo\'q');
  teng(await p.isVisible('#q-qaytarasiz'), false, '"Men berdim"da Qaytarasiz yo\'q');
  await p.click('[data-yonalish="oldim"]');
  teng(await p.isVisible('.kom-qism'), true, '"Men oldim"da komissiya qismi bor');
  teng(await chiplar(), ['Yo\'q:true', 'Foiz…:false', 'Summa…:false'], 'chiplar (Yo\'q tanlangan)');
  teng(await p.isVisible('#q-qaytarasiz'), false, 'Yo\'q: Qaytarasiz maydoni yo\'q (oddiy qarz shakli)');
  teng(bo(await p.textContent('label[for="q-summa"]')), 'Summa (so\'m)', 'Yo\'q: avvalgi "Summa" maydoni');
  teng(await p.evaluate(() => [...document.querySelectorAll('.kom-chiplar .chip')].every((b) => b.getBoundingClientRect().height >= 44)), true, 'chiplar ≥ 44 px');
  teng(await p.evaluate(() => getComputedStyle(document.querySelector('.kom-bosh .belgi-katak')).backgroundColor), 'rgb(92, 107, 192)', 'ikon katagi #5C6BC0');
  await p.fill('#q-shaxs', 'Mikroqarz'); await p.selectOption('#q-hisob', { label: 'Karta A' }); await p.fill('#q-summa', '100000');
  await p.click('.kom-chiplar [data-kom="foiz"]');
  teng(await p.evaluate(() => [document.querySelector('label[for="q-summa"]').textContent, !!document.querySelector('#q-qaytarasiz').offsetParent, !!document.querySelector('#q-kom-foiz').offsetParent, !!document.querySelector('#q-kom-summa').offsetParent]), ['Hisobga tushdi', true, true, true], 'Foiz…: Hisobga tushdi / Qaytarasiz va foiz / summa maydonlari');
  teng(await p.evaluate(() => { const a = document.querySelector('#q-summa').getBoundingClientRect(), b = document.querySelector('#q-qaytarasiz').getBoundingClientRect(), c = document.querySelector('#q-kom-foiz').getBoundingClientRect(), d = document.querySelector('#q-kom-summa').getBoundingClientRect(); return [Math.abs(a.top - b.top) < 4 && a.right <= b.left, Math.abs(c.top - d.top) < 4 && c.right <= d.left, d.right <= 360]; }), [true, true, true], 'ikki maydon yonma-yon');
  await p.fill('#q-kom-foiz', '2,9');
  teng([await p.inputValue('#q-qaytarasiz'), await p.inputValue('#q-kom-summa')], ['102 900', '2 900'], 'foiz yozilsa: qaytarasiz va komissiya');
  teng(await natija(), 'Hisobga tushadi: 100 000 · Komissiya: 2 900 (2,9%) Qaytariladigan jami: 102 900', 'xulosa');
  await olchov('Foiz…'); await rasm('1-forma-foiz');
  await p.fill('#q-qaytarasiz', '103 000');
  teng([await p.inputValue('#q-kom-foiz'), await p.inputValue('#q-kom-summa')], ['3', '3 000'], 'qaytarasiz yozilsa: foiz va komissiya');
  await p.click('.kom-chiplar [data-kom="summa"]');
  await p.fill('#q-kom-summa', '2900');
  teng([await p.inputValue('#q-kom-foiz'), await p.inputValue('#q-qaytarasiz')], ['2,9', '102 900'], 'komissiya summasi yozilsa: foiz va qaytarasiz');
  await p.fill('#q-summa', '200000');
  teng([await p.inputValue('#q-kom-foiz'), await p.inputValue('#q-qaytarasiz')], ['1,5', '202 900'], 'hisobga tushdi o\'zgarsa: komissiya summasi saqlanadi, foiz va qaytarasiz qayta hisoblanadi');
  await p.fill('#q-summa', '100000');
  await rasm('2-forma-summa');
  await p.fill('#q-kom-summa', '60000');
  await p.click('form button[type="submit"]');
  teng(bo(await p.textContent('.kom-xato')), 'Komissiya foizi 0,01 dan 50 gacha bo\'lsin', '60% rad etildi'); teng((await holat()).q.length, 0, 'xatoda hech narsa saqlanmadi');
  await p.fill('#q-kom-summa', '2900');
  await p.click('form button[type="submit"]');
  await p.waitForSelector('.qarz-tanlov');
  // ---- 2) Saqlandi: ma'lumot ----
  let h = await holat();
  const q = h.q[0], ko = h.y[0];
  teng([h.q.length, h.y.length, q.summa, q.yonalish, ko.summa, ko.qarz_bog_id === q.id, ko.kategoriya_id === kid, ko.izoh, ko.hisob_id === q.hisob_id, ko.sana === q.sana && ko.vaqt === q.vaqt], [1, 1, 102900, 'oldim', 2900, true, true, 'Qarz komissiyasi (2,9%)', true, true], 'qarz 102 900, komissiya 2 900 ("Komissiyalar" kategoriyasida)');
  teng(h.qoldiq, 1000000 + 100000, 'hisob qoldig\'i aniq +100 000');
  teng(await p.evaluate(async () => (await Data.hammasi('kategoriyalar')).filter((k) => /komissiya/i.test(k.nom)).length), 1, 'yangi "Komissiya" yaratilmadi');
  // ---- 3) Tarix ----
  await p.click('.nav-tugma[data-bolim="tarix"]'); await p.waitForSelector('.kom-ichki');
  teng(await p.locator('.kun .qarz-satr').count(), 1); teng(bo(await p.textContent('.kom-ichki .yozuv-nom')), 'Komissiya · 2,9%', 'ichki qator nomi'); teng(bo(await p.textContent('.kom-ichki .yozuv-summa')), '−2 900 so\'m', 'ichki summa');
  teng(bo(await p.textContent('.qarz-satr .yozuv-summa')), '+102 900 so\'m', 'qarz qatori summasi = qaytariladigan');
  teng(await p.evaluate(() => { const a = document.querySelector('.qarz-satr').getBoundingClientRect(), b = document.querySelector('.kom-ichki').getBoundingClientRect(), ik = document.querySelector('.kom-ichki .belgi-katak').getBoundingClientRect(); return [b.top >= a.bottom - 1, b.left - a.left >= 20, Math.round(ik.width), b.right <= 360, b.height >= 44]; }), [true, true, 28, true, true], 'ichki qator: qarz ostida, surilgan, 28 px katak');
  teng(await p.evaluate(() => [...document.querySelectorAll('.kun-sarlavha .pill')].map((x) => Number(x.getAttribute('data-qiymat')))), [-2900, 102900], 'kun jami: xarajat 2 900, daromad (olingan qarz) 102 900');
  await olchov('Tarix'); await rasm('3-tarix');
  // ---- 4) Tafsilot ----
  await p.click('.qarz-satr'); await p.waitForSelector('.qarz-tafsilot');
  teng(await p.evaluate(() => [...document.querySelectorAll('.qarz-tafsilot .qator')].slice(0, 6).map((r) => [...r.children].map((c) => c.textContent.trim()).join(' '))), ['Yo\'nalish Men oldim (men qaytarishim kerak)', 'Hisobga tushgan 100 000 so\'m', 'Komissiya (2,9%) 2 900 so\'m', 'Qaytariladigan jami 102 900 so\'m', 'Qaytarilgan 0 so\'m', 'Qolgan 102 900 so\'m'], 'tafsilot qatorlari');
  await olchov('Tafsilot'); await rasm('4-tafsilot');
  // ---- 5) Tahrirlash: to'ldirilgan; "Yo'q" -> komissiya o'chadi; qayta tanlash -> o'sha qator tiriladi ----
  await p.click('button:has-text("Tahrirlash")'); await p.waitForSelector('#q-summa');
  teng(await chiplar(), ['Yo\'q:false', 'Foiz…:false', 'Summa…:true'], 'tahrirda komissiya to\'ldirilgan');
  teng([await p.inputValue('#q-summa'), await p.inputValue('#q-qaytarasiz'), await p.inputValue('#q-kom-summa'), await p.inputValue('#q-kom-foiz')], ['100 000', '102 900', '2 900', '2,9'], 'maydon qiymatlari');
  await rasm('5-tahrir');
  await p.fill('#q-kom-summa', '3000');
  await p.click('form button[type="submit"]'); await p.waitForSelector('.qarz-tafsilot');
  h = await holat(); teng([h.q[0].summa, h.y.length, h.y[0].id === ko.id, h.y[0].summa], [103000, 1, true, 3000], 'tahrir: o\'sha komissiya yozuvi yangilandi'); teng(h.qoldiq, 1100000, 'qoldiq +100 000');
  await p.click('button:has-text("Tahrirlash")'); await p.waitForSelector('#q-summa');
  await p.click('.kom-chiplar [data-kom="yoq"]');
  teng(bo(await p.textContent('label[for="q-summa"]')), 'Summa (so\'m)', 'Yo\'q: oddiy qarz shakli');
  await p.click('form button[type="submit"]'); await p.waitForSelector('.qarz-tafsilot');
  h = await holat(); teng([h.q[0].summa, h.y.length, h.qoldiq], [100000, 0, 1100000], '"Yo\'q": komissiya mantiqiy o\'chdi, qarz = 100 000 (oddiy)');
  teng(await p.evaluate(async (id) => (await Data.hammasiniOqish()).yozuvlar.filter((y) => y.id === id)[0].deleted, ko.id), true, 'tombstone');
  await p.click('button:has-text("Tahrirlash")'); await p.waitForSelector('#q-summa');
  await p.click('.kom-chiplar [data-kom="foiz"]'); await p.fill('#q-kom-foiz', '2,9');
  await p.click('form button[type="submit"]'); await p.waitForSelector('.qarz-tafsilot');
  h = await holat(); teng([h.q[0].summa, h.y.length, h.y[0].id === ko.id, h.y[0].summa], [102900, 1, true, 2900], 'qayta tanlansa o\'sha qator tiriladi');
  // ---- 6) Komissiya qatorini bosish qarz tahririni ochadi ----
  await p.click('.nav-tugma[data-bolim="tarix"]'); await p.waitForSelector('.kom-ichki'); await p.click('.kom-ichki');
  await p.waitForSelector('#q-summa'); teng(await p.textContent('h1'), 'Qarzni tahrirlash', 'komissiya qatori qarz tahririni ochdi');
  await p.click('.orqaga-tugma');
  // ---- 7) Qarz o'chirilsa komissiya ham o'chadi; "Bekor qilish" ikkalasini qaytaradi ----
  await p.click('.qarz-satr'); await p.waitForSelector('.qarz-tafsilot');
  await p.click('.xavfli-tugma:has-text("O\'chirish")'); await p.waitForTimeout(300);
  h = await holat(); teng([h.q.length, h.y.length, h.qoldiq], [0, 0, 1000000], 'qarz va komissiya o\'chdi');
  await p.click('.xabar button:has-text("Bekor"), button:has-text("Bekor qilish")'); await p.waitForTimeout(300);
  h = await holat(); teng([h.q.length, h.y.length, h.qoldiq], [1, 1, 1100000], '"Bekor qilish": ikkalasi qaytdi');
  // ---- 8) Komissiyasiz oddiy qarz avvalgidek ----
  await p.click('.nav-qoshish'); await p.click('#yy-qarz'); await p.waitForSelector('#q-summa');
  await p.click('[data-yonalish="oldim"]'); await p.fill('#q-shaxs', 'Oddiy'); await p.selectOption('#q-hisob', { label: 'Karta A' }); await p.fill('#q-summa', '50000');
  await p.click('form button[type="submit"]'); await p.waitForSelector('.qarz-tanlov');
  h = await holat(); teng([h.q.length, h.y.length, h.q.filter((z) => z.shaxs === 'Oddiy')[0].summa, h.qoldiq], [2, 1, 50000, 1150000], 'komissiyasiz qarz: yozuv paydo bo\'lmadi');
  // "Foiz…" tanlangan, lekin komissiya kiritilmagan va "Qaytarasiz" teng: oddiy qarz
  await p.click('.nav-qoshish'); await p.click('#yy-qarz'); await p.waitForSelector('#q-summa');
  await p.click('[data-yonalish="oldim"]'); await p.fill('#q-shaxs', 'Teng'); await p.fill('#q-summa', '40000'); await p.click('.kom-chiplar [data-kom="foiz"]'); await p.fill('#q-qaytarasiz', '40000');
  await p.click('form button[type="submit"]'); await p.waitForSelector('.qarz-tanlov');
  h = await holat(); teng([h.q.length, h.y.length, h.q.filter((z) => z.shaxs === 'Teng')[0].summa], [3, 1, 40000], 'Qaytarasiz teng — komissiyasiz oddiy qarz');
  // "Berdim": komissiya yo'q, yozuv ham yo'q
  await p.click('.nav-qoshish'); await p.click('#yy-qarz'); await p.waitForSelector('#q-summa');
  await p.fill('#q-shaxs', 'Berdim'); await p.fill('#q-summa', '10000');
  await p.click('form button[type="submit"]'); await p.waitForSelector('.qarz-tanlov');
  h = await holat(); teng([h.q.length, h.y.length], [4, 1], '"Berdim": komissiya yozuvi yo\'q');
  await kontekst.close();
}
(async () => {
  const brauzer = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  for (const tema of ['light', 'dark']) await senariy(brauzer, tema);
  await brauzer.close();
  console.log('\n' + (jami - xatolar) + ' / ' + jami + ' tekshiruv o\'tdi' + (xatolar ? ', ' + xatolar + ' ta XATO' : ''));
  process.exit(xatolar ? 1 : 0);
})().catch((e) => { console.log('SINOV TO\'XTADI: ' + e.message); process.exit(1); });
