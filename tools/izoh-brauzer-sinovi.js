// Ko'p qatorli izoh (TZ-sinxronlash.md 48-band) uchun brauzer sinovi: HAQIQIY ilova (index.html, haqiqiy IndexedDB), faqat UYDIRMA ma'lumot.
// Faqat ishlab chiqish vaqtida; ilovaning o'zi uni ishlatmaydi.
// Ishga tushirish: avval  python3 -m http.server 8000  (repozitoriy papkasida), keyin
//   node tools/izoh-brauzer-sinovi.js [rasmlar_papkasi]     (Playwright va Chromium kerak; PLAYWRIGHT_MODULE, ILOVA_MANZIL ixtiyoriy)
// 360 px kenglikda yorug' va qorong'i rejimda yuradi. Xato bo'lsa chiqish kodi 1.
const fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const MANZIL = process.env.ILOVA_MANZIL || 'http://localhost:8000/index.html';
const RASMLAR = process.argv[2] || path.join(os.tmpdir(), 'izoh-rasmlar');
fs.mkdirSync(RASMLAR, { recursive: true });

let jami = 0, xatolar = 0;
function teng(haqiqiy, kutilgan, izoh) {
  jami++;
  if (JSON.stringify(haqiqiy) !== JSON.stringify(kutilgan)) { xatolar++; console.log('  ✗ ' + izoh + ' — kutilgan: ' + JSON.stringify(kutilgan) + ', chiqdi: ' + JSON.stringify(haqiqiy)); }
}
const MATN = 'osh=10000\nnon-choy=25000\nkola=8000';

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
    await Data.saqlash('kategoriyalar', { yaratilgan: new Date().toISOString(), nom: 'Oziq-ovqat', tur: 'xarajat', rang: '#E65100', belgi: 'oziq', arxivlangan: false });
  });
  await p.reload();
  await p.waitForFunction(() => document.querySelector('#ekran h1'));
  const yozuvlar = () => p.evaluate(() => Data.hammasi('yozuvlar'));
  const rasm = (nom) => p.screenshot({ path: path.join(RASMLAR, tema + '-' + nom + '.png') });
  const olchov = async (izoh) => teng(await p.evaluate(() => document.documentElement.scrollWidth <= 360), true, izoh + ': gorizontal aylanish yo\'q');
  const rang = (sel) => p.evaluate((s) => getComputedStyle(document.querySelector(s)).color, sel);

  // ---- 1) Wizard: xarajat, 3 qatorli izoh ----
  await p.click('.nav-qoshish');
  await p.click('#yy-tranzaksiya');
  await p.waitForSelector('#w-summa');
  await p.fill('#w-summa', '43000');
  await p.click('button:has-text("Davom etish")');
  await p.click('button.katak:has-text("Oziq-ovqat")');
  await p.click('button.hisob-qator:has-text("Karta A")');
  await p.click('#w-keyingi');
  teng(await p.textContent('h1'), 'Izoh va saqlash', 'oxirgi qadam');
  teng(await p.evaluate(() => document.getElementById('w-izoh').tagName), 'TEXTAREA', 'izoh textarea');
  const bosh = await p.evaluate(() => { const r = document.getElementById('w-izoh').getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width) }; });
  teng(bosh.h, 48, 'bo\'sh maydon balandligi avvalgi bir qatorli maydondek (48 px)');
  teng(await p.textContent('.izoh-hisoblagich'), '0 / 500', 'hisoblagich');
  teng(await p.textContent('.izoh-pastki span'), 'Enter: yangi qator', 'yordam matni');
  teng(await p.getAttribute('#w-izoh', 'enterkeyhint'), 'enter', 'enterkeyhint');
  await p.click('#w-izoh');
  await p.type('#w-izoh', 'osh=10000');
  teng(await p.evaluate(() => document.getElementById('w-izoh').getBoundingClientRect().height), 48, 'qisqa izoh: balandlik o\'zgarmaydi');
  await p.keyboard.press('Enter');
  teng(await p.textContent('h1'), 'Izoh va saqlash', 'Enter keyingi qadamga o\'tkazmaydi');
  await p.type('#w-izoh', 'non-choy=25000');
  await p.keyboard.press('Enter');
  await p.type('#w-izoh', 'kola=8000');
  teng(await p.inputValue('#w-izoh'), MATN, 'Enter yangi qator ochdi');
  teng((await yozuvlar()).length, 0, 'Enter saqlamadi');
  const uch = await p.evaluate(() => document.getElementById('w-izoh').getBoundingClientRect().height);
  teng(uch > 48 && uch <= 22 * 5 + 26, true, '3 qatorda maydon o\'sdi (' + uch + ')');
  teng(await p.textContent('.izoh-hisoblagich'), MATN.length + ' / 500', '3 qatorli hisoblagich');
  await olchov('wizard izoh'); await rasm('1-wizard-3-qator');
  // 5 qatordan ko'p: balandlik 5 qatorda to'xtaydi, ichida aylanadi
  await p.fill('#w-izoh', 'a\nb\nc\nd\ne\nf\ng\nh');
  const kop = await p.evaluate(() => { const t = document.getElementById('w-izoh'); return { h: t.getBoundingClientRect().height, auto: getComputedStyle(t).overflowY }; });
  teng(kop.h, 22 * 5 + 24 + 2, '5 qatordan oshmaydi'); teng(kop.auto, 'auto', 'ichida aylanadi');
  // hisoblagich ranglari
  await p.fill('#w-izoh', 'x'.repeat(449)); const odd = await rang('.izoh-hisoblagich');
  await p.fill('#w-izoh', 'x'.repeat(450)); const sariq = await rang('.izoh-hisoblagich');
  await p.fill('#w-izoh', 'x'.repeat(500)); const qizil = await rang('.izoh-hisoblagich');
  teng(sariq !== odd && qizil !== odd && sariq !== qizil, true, 'hisoblagich ranglari: oddiy / sariq / qizil');
  teng(await p.evaluate(() => document.getElementById('w-izoh').value.length), 500, 'maxlength 500');
  await p.type('#w-izoh', 'yyy'); teng(await p.evaluate(() => document.getElementById('w-izoh').value.length), 500, '500 dan oshmaydi');
  await rasm('2-hisoblagich-qizil');
  await p.fill('#w-izoh', '\r\n  ' + MATN.replace(/\n/g, '\n') + '  \n\n\n\n\n');
  await p.click('#w-saqlash');
  await p.waitForFunction(() => !document.getElementById('w-izoh'));
  let y = await yozuvlar();
  teng(y.length, 1, 'yozuv saqlandi'); teng(y[0].izoh, MATN, 'izoh \\n bilan, ortiqcha bo\'sh joysiz saqlandi');

  // ---- 2) Tarix: yopiq / ochiq ----
  await p.click('[data-bolim="tarix"]');
  await p.waitForSelector('button.izoh-bir');
  teng(await p.textContent('button.izoh-bir'), 'osh=10000 …', 'yopiq: birinchi qator + " …"');
  teng(await p.getAttribute('button.izoh-bir', 'aria-expanded'), 'false', 'aria-expanded=false');
  await rasm('3-tarix-yopiq');
  await p.click('button.izoh-bir');
  teng(await p.getAttribute('button.izoh-bir', 'aria-expanded'), 'true', 'ochildi');
  teng(await p.textContent('button.izoh-bir'), MATN, 'ochiq: to\'liq matn');
  teng(await p.evaluate(() => { const b = document.querySelector('button.izoh-bir'); return getComputedStyle(b).whiteSpace; }), 'pre-line', 'qatorlar saqlanadi');
  teng(await p.evaluate(() => Math.round(document.querySelector('button.izoh-bir').getBoundingClientRect().height / 17) >= 3), true, '3 qator ko\'rinadi');
  teng(await p.textContent('h1'), 'Tarix', 'izoh bosilishi tahrirga olib bormadi');
  await olchov('Tarix ochiq izoh'); await rasm('4-tarix-ochiq');
  await p.click('button.izoh-bir');
  teng(await p.textContent('button.izoh-bir'), 'osh=10000 …', 'yig\'ildi');

  // qidiruv: yangi qator bo'shliq deb olinadi
  const soni = (s) => p.evaluate(async (s) => Calc.yozuvlarniSuz(await Data.hammasi('yozuvlar'), { qidiruv: s }).length, s);
  teng(await soni('non-choy'), 1, 'qidiruv: 2-qator'); teng(await soni('osh=10000 non-choy'), 1, 'qidiruv: yangi qator = bo\'shliq'); teng(await soni('pepsi'), 0, 'qidiruv: topilmadi');

  // ---- 3) Tahrirlash: avvalgi shaklda to'ldiriladi, o'zgartirib saqlanadi ----
  await p.click('.yozuv-kv .yozuv-nom');
  await p.waitForSelector('#f-izoh');
  teng(await p.evaluate(() => document.getElementById('f-izoh').tagName), 'TEXTAREA', 'tahrir formasida textarea');
  teng(await p.inputValue('#f-izoh'), MATN, 'tahrirda matn avvalgi shaklda');
  teng(await p.evaluate(() => document.getElementById('f-izoh').getBoundingClientRect().height > 48), true, 'ko\'p qatorli izoh: maydon o\'sgan');
  await p.focus('#f-izoh'); await p.keyboard.press('Control+End'); await p.keyboard.press('Enter'); await p.type('#f-izoh', 'sut=9000');
  teng((await yozuvlar())[0].izoh, MATN, 'Enter formani saqlamadi');
  await olchov('tahrir formasi'); await rasm('5-tahrir');
  await p.click('form button.asosiy-tugma:has-text("Saqlash")');
  await p.waitForFunction(() => !document.getElementById('f-izoh'));
  y = await yozuvlar(); teng(y[0].izoh, MATN + '\nsut=9000', 'tahrir saqlandi');

  // ---- 4) Bir qatorli izoh avvalgidek ----
  await p.evaluate(async () => { const y = await Data.hammasi('yozuvlar'); y[0].izoh = 'oddiy izoh'; await Data.saqlash('yozuvlar', y[0]); });
  await p.reload(); await p.waitForFunction(() => document.querySelector('#ekran h1'));
  await p.click('[data-bolim="tarix"]'); await p.waitForSelector('button.izoh-bir');
  teng(await p.textContent('button.izoh-bir'), 'oddiy izoh', 'bir qatorli izoh o\'zgarmaydi (" …" yo\'q)');
  await p.click('.yozuv-kv .yozuv-nom'); await p.waitForSelector('#f-izoh');
  teng(await p.evaluate(() => document.getElementById('f-izoh').getBoundingClientRect().height), 48, 'bir qatorli izoh: 48 px');
  teng(await p.inputValue('#f-izoh'), 'oddiy izoh', 'bir qatorli izoh to\'ldirildi');

  // ---- 5) Qarz formasi ----
  await p.reload(); await p.waitForFunction(() => document.querySelector('#ekran h1'));
  await p.click('.nav-qoshish'); await p.click('#yy-qarz'); await p.waitForSelector('#q-izoh');
  teng(await p.evaluate(() => document.getElementById('q-izoh').tagName), 'TEXTAREA', 'qarz izohi textarea');
  await p.fill('#q-izoh', 'bir\nikki'); await olchov('qarz formasi'); await rasm('6-qarz-forma');
  await kontekst.close();
}

(async () => {
  const brauzer = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try { for (const t of ['light', 'dark']) await senariy(brauzer, t); } finally { await brauzer.close(); }
  console.log(jami + ' tekshiruv, ' + xatolar + ' xato');
  process.exit(xatolar ? 1 : 0);
})();
