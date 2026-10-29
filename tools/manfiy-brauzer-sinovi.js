// Hisobda pul yetmasa: manfiy qoldiq qoidasi (TZ-sinxronlash.md 50-band) uchun brauzer sinovi: HAQIQIY ilova (index.html, haqiqiy IndexedDB), faqat UYDIRMA ma'lumot.
// "Gap bilan qo'shish" uchun server javobi SOXTA (tarmoqqa chiqilmaydi). Faqat ishlab chiqish vaqtida; ilovaning o'zi uni ishlatmaydi.
// Ishga tushirish: avval  python3 -m http.server 8000  (repozitoriy papkasida), keyin
//   node tools/manfiy-brauzer-sinovi.js [rasmlar_papkasi]     (Playwright va Chromium kerak; PLAYWRIGHT_MODULE, ILOVA_MANZIL ixtiyoriy)
// 360 px kenglikda yorug' va qorong'i rejimda yuradi. Xato bo'lsa chiqish kodi 1.
const fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const MANZIL = process.env.ILOVA_MANZIL || 'http://localhost:8000/index.html';
const RASMLAR = process.argv[2] || path.join(os.tmpdir(), 'manfiy-rasmlar');
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
  const navbat = [];
  await p.route('**/functions/v1/yordamchi', async (r) => {
    const sarlavha = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'content-type': 'application/json' };
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: sarlavha });
    const j = navbat.shift() || { holat: 500, tana: { xato: { kod: 'AI_PROVAYDER' } } };
    return r.fulfill({ status: j.holat, headers: sarlavha, body: JSON.stringify(j.tana) });
  });
  await p.goto(MANZIL);
  await p.waitForFunction(() => typeof Data !== 'undefined' && document.querySelector('#ekran h1'));
  if (await p.locator('#salom-davom').count()) { await p.click('#salom-davom'); await p.waitForSelector('#salom-ekran', { state: 'detached' }); }
  // Uydirma ma'lumot. "Naqd pul" — ilovaning o'z hisobi (0). Karta A 50 000, Karta B 100 000 (unda 100 000 lik xarajat: qoldiq 0), Karta C 0, Karta D 0.
  await p.evaluate(async () => {
    const yaratilgan = new Date().toISOString();
    const yoz = (nom, q) => Data.saqlash('hisoblar', { yaratilgan, nom, tur: 'karta', belgi: 'karta', rang: '#2F5DDB', oxirgi4: '', boshlangich_qoldiq: q, arxivlangan: false });
    await yoz('Karta A', 50000); await yoz('Karta B', 100000); await yoz('Karta C', 0); await yoz('Karta D', 0);
    const h = await Data.hammasi('hisoblar'), kat = (await Data.hammasi('kategoriyalar')).filter((k) => k.tur === 'xarajat')[0];
    await Data.saqlash('yozuvlar', { yaratilgan, tur: 'xarajat', summa: 100000, sana: Calc.bugun(), vaqt: '00:01', hisob_id: h.filter((x) => x.nom === 'Karta B')[0].id, kategoriya_id: kat.id, izoh: 'Sinov' });
    try { localStorage.removeItem('moliya-hisob-manfiy'); } catch (e) { /* ahamiyatsiz */ }
  });
  await p.reload();
  await p.waitForFunction(() => document.querySelector('#ekran h1'));
  await p.evaluate(() => {   // soxta kirish: Google'siz; faqat shu sahifada
    Kirish.holat = () => ({ kirgan: true, id: 'u-sinov', email: '', ism: '', xato: '', kirmoqda: false });
    Kirish.tokenOl = () => Promise.resolve('sinov-token'); Kirish.tokenYangila = () => Promise.resolve('sinov-token');
    Yordamchi.yangila();
  });
  const rasm = (nom) => p.screenshot({ path: path.join(RASMLAR, tema + '-' + nom + '.png') });
  const olchov = async (izoh) => teng(await p.evaluate(() => document.documentElement.scrollWidth <= 360), true, izoh + ': gorizontal aylanish yo\'q');
  const bazadan = (nom) => p.evaluate((n) => Data.hammasi(n), nom);
  const qoldiq = (nom) => p.evaluate(async (nom) => { const [h, y, q] = await Promise.all([Data.hammasi('hisoblar'), Data.hammasi('yozuvlar'), Data.hammasi('qarzlar')]); return Calc.hisobQoldigi(h.filter((x) => x.nom === nom)[0], y, q); }, nom);
  const sozlama = () => p.evaluate(async () => { const h = await Data.hammasi('hisoblar'), o = JSON.parse(localStorage.getItem('moliya-hisob-manfiy') || '{}'), n = {}; h.forEach((x) => { if (o[x.id]) n[x.nom] = o[x.id]; }); return n; });
  const sozlamaYoz = (nom, rejim) => p.evaluate(async ([nom, rejim]) => { const h = await Data.hammasi('hisoblar'), o = JSON.parse(localStorage.getItem('moliya-hisob-manfiy') || '{}'); o[h.filter((x) => x.nom === nom)[0].id] = rejim; localStorage.setItem('moliya-hisob-manfiy', JSON.stringify(o)); }, [nom, rejim]);
  const oyna = () => p.locator('.manfiy-oyna');
  const oynaMatni = async () => ({ sarlavha: bo(await p.textContent('.manfiy-oyna h2')), matn: bo(await p.textContent('.manfiy-matn')),
    tugmalar: await p.evaluate(() => [...document.querySelectorAll('.manfiy-tugmalar button')].map((b) => b.textContent)) });

  // Wizard: xarajat; oxirgi qadamda (izoh) "Saqlash" bosiladi (yoki faqat shu qadamgacha boriladi)
  async function wizardTayyor(summa, hisobNomi) {
    await p.click('.nav-qoshish'); await p.click('#yy-tranzaksiya'); await p.waitForSelector('#w-summa');
    await p.fill('#w-summa', summa); await p.click('button:has-text("Davom etish")');
    await p.click('.katak:not(.katak-qosh)');
    await p.click('button.hisob-qator:has-text("' + hisobNomi + '")');
    await p.waitForSelector('#w-saqlash');
  }

  // ======== 1) Hisob shakli: "Hisobda pul yetmasa" qatorlari ========
  await p.click('[data-bolim="koproq"]'); await p.click('#kp-hisoblar'); await p.waitForSelector('#hisob-qoshish');
  await p.click('#hisob-qoshish'); await p.click('.sheet [data-tur="karta"]');
  await p.waitForSelector('.manfiy-royxat');
  teng(await p.evaluate(() => [...document.querySelectorAll('.manfiy-qator')].map((q) => [q.querySelector('strong').textContent, q.querySelector('.xira').textContent, q.getAttribute('aria-checked'), q.getAttribute('role')])),
    [['Ruxsat', 'Kredit karta yoki overdraft uchun', 'false', 'radio'], ['Ogohlantirish', 'Saqlashdan oldin so\'raydi', 'false', 'radio'], ['Taqiqlash', 'Pul yetmasa saqlab bo\'lmaydi', 'true', 'radio']],
    'uch qator, boshlang\'ich tanlov: Taqiqlash (yangi hisob)');
  teng(await p.evaluate(() => document.querySelector('.manfiy-royxat').previousElementSibling.textContent.trim()), 'Hisobda pul yetmasa', 'bo\'lim sarlavhasi');
  teng(await p.evaluate(() => [...document.querySelectorAll('.manfiy-qator')].every((q) => q.getBoundingClientRect().height >= 44)), true, 'har qator kamida 44 px');
  teng(await p.evaluate(() => { const r = document.querySelector('.manfiy-qator.tanlangan .manfiy-radio'), s = getComputedStyle(r); return [s.backgroundColor, !!r.querySelector('svg'), document.querySelectorAll('.manfiy-qator.tanlangan').length]; }), ['rgb(15, 143, 111)', true, 1], 'tanlangan: to\'ldirilgan yashil #0F8F6F doira ichida check, bitta');
  teng(await p.evaluate(() => { const q = document.querySelector('.manfiy-qator.tanlangan'); return getComputedStyle(q).backgroundColor !== getComputedStyle(document.querySelector('.manfiy-qator:not(.tanlangan)')).backgroundColor; }), true, 'tanlangan qator accent fonli');
  await p.fill('#h-nom', 'Kredit karta');
  await p.click('[data-manfiy="ruxsat"]');
  teng(await p.evaluate(() => [...document.querySelectorAll('.manfiy-qator')].map((q) => q.getAttribute('aria-checked'))), ['true', 'false', 'false'], 'Ruxsat tanlandi');
  await olchov('hisob shakli'); await p.locator('.manfiy-royxat').scrollIntoViewIfNeeded(); await rasm('1-hisob-shakli');
  teng(await sozlama(), {}, 'saqlashgacha sozlama yozilmagan');
  await p.click('form button[type="submit"]'); await p.waitForSelector('.hisob-qatori');
  teng(await sozlama(), { 'Kredit karta': 'ruxsat' }, 'hisob saqlanganda sozlama saqlandi (faqat localStorage)');
  teng(await p.evaluate(async () => JSON.stringify(await Data.hammasi('sozlamalar')).includes('moliya-hisob-manfiy') || JSON.stringify(await Data.hammasi('sozlamalar')).includes('ruxsat')), false, 'bazaga (zaxira/sinxronga) tushmaydi');
  // mavjud hisob (sozlamasiz): Taqiqlash, o'zgartirib saqlash
  await p.click('.hisob-qatori:has-text("Karta A")'); await p.waitForSelector('.manfiy-royxat');
  teng(await p.evaluate(() => document.querySelector('.manfiy-qator.tanlangan').getAttribute('data-manfiy')), 'taqiqlash', 'mavjud hisob (sozlama tanlanmagan) = Taqiqlash');
  await p.click('[data-manfiy="ogohlantirish"]'); await p.click('form button[type="submit"]'); await p.waitForSelector('.hisob-qatori');
  teng((await sozlama())['Karta A'], 'ogohlantirish', 'Karta A: Ogohlantirish');
  await sozlamaYoz('Karta A', 'taqiqlash');
  // yaroqsiz qiymat = Taqiqlash
  await p.evaluate(async () => { const h = (await Data.hammasi('hisoblar')).filter((x) => x.nom === 'Karta C')[0]; const o = JSON.parse(localStorage.getItem('moliya-hisob-manfiy') || '{}'); o[h.id] = 'bema\'ni'; o['yoq-hisob'] = 'ruxsat'; localStorage.setItem('moliya-hisob-manfiy', JSON.stringify(o)); });
  await p.click('.hisob-qatori:has-text("Karta C")'); await p.waitForSelector('.manfiy-royxat');
  teng(await p.evaluate(() => document.querySelector('.manfiy-qator.tanlangan').getAttribute('data-manfiy')), 'taqiqlash', 'yaroqsiz qiymat = Taqiqlash');
  await p.click('.orqaga-tugma'); await p.waitForSelector('.hisob-qatori');
  await p.evaluate(async () => { const h = (await Data.hammasi('hisoblar')).filter((x) => x.nom === 'Karta C')[0]; const o = JSON.parse(localStorage.getItem('moliya-hisob-manfiy') || '{}'); delete o[h.id]; localStorage.setItem('moliya-hisob-manfiy', JSON.stringify(o)); });
  await p.click('[data-bolim="bosh"]');

  // ======== 2) Yozuv wizardi: Taqiqlash (Naqd pul: 0, 16 000 kerak) ========
  const yozuvSoni = async () => (await bazadan('yozuvlar')).length;
  const boshlangichSoni = await yozuvSoni();
  await wizardTayyor('16000', 'Naqd pul');
  await p.click('#w-saqlash'); await p.waitForSelector('.manfiy-oyna');
  teng(await oynaMatni(), { sarlavha: 'Hisobda mablag\' yetarli emas', matn: '«Naqd pul» hisobida 0 so\'m bor, bu amal uchun 16 000 so\'m kerak. Boshqa hisobni tanlang yoki avval shu hisobga kirim yozing.', tugmalar: ['Yopish', 'Hisobni o\'zgartirish'] }, 'Taqiqlash oynasi matni va tugmalari');
  teng(await p.locator('#manfiy-baribir').count(), 0, 'Taqiqlashda "Baribir saqlash" yo\'q');
  teng(await p.evaluate(() => { const i = document.querySelector('.manfiy-ikon'); const r = i.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), i.classList.contains('taqiq'), !!i.querySelector('svg'), getComputedStyle(i).backgroundColor !== 'rgba(0, 0, 0, 0)']; }), [36, 36, true, true, true], 'ikon katagi 36 px, qizil, SVG');
  teng(await p.evaluate(() => [...document.querySelectorAll('.manfiy-tugmalar button, .manfiy-havola')].map((b) => [b.textContent, Math.round(b.getBoundingClientRect().height) >= (b.classList.contains('manfiy-havola') ? 44 : 48)])), [['Yopish', true], ['Hisobni o\'zgartirish', true], ['Bu hisob uchun sozlamani o\'zgartirish', true]], 'tugmalar 48 px, havola 44 px');
  teng(await p.evaluate(() => { const b = document.querySelector('#manfiy-hisob'), y = document.querySelector('#manfiy-yopish'); return [getComputedStyle(b).backgroundColor !== 'rgba(0, 0, 0, 0)', getComputedStyle(y).backgroundColor === 'rgba(0, 0, 0, 0)']; }), [true, true], '"Yopish" outline (fonsiz), "Hisobni o\'zgartirish" to\'ldirilgan');
  await olchov('Taqiqlash oynasi'); await rasm('2-taqiqlash-oynasi');
  teng(await yozuvSoni(), boshlangichSoni, 'bloklangan amal hech narsa yozmadi');
  await p.click('#manfiy-yopish'); await p.waitForTimeout(100);
  teng([await oyna().count(), await p.textContent('h1'), await yozuvSoni()], [0, 'Sana va vaqt', boshlangichSoni], '"Yopish": forma ochiq, baza o\'zgarmadi');
  // tashqariga bosish va Esc: saqlanmaydi, forma ochiq
  await p.click('#w-saqlash'); await p.waitForSelector('.manfiy-oyna');
  await p.mouse.click(180, 20); await p.waitForTimeout(100);
  teng([await oyna().count(), await p.textContent('h1'), await yozuvSoni()], [0, 'Sana va vaqt', boshlangichSoni], 'tashqariga bosish: saqlanmaydi, forma ochiq');
  await p.click('#w-saqlash'); await p.waitForSelector('.manfiy-oyna'); await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  teng([await oyna().count(), await p.textContent('h1'), await yozuvSoni()], [0, 'Sana va vaqt', boshlangichSoni], 'Esc: saqlanmaydi, forma ochiq');
  // "Hisobni o'zgartirish": wizard hisob qadamiga qaytadi, summa saqlanadi
  await p.click('#w-saqlash'); await p.waitForSelector('.manfiy-oyna'); await p.click('#manfiy-hisob'); await p.waitForTimeout(100);
  teng([await oyna().count(), await p.textContent('h1'), await yozuvSoni()], [0, 'Hisob', boshlangichSoni], '"Hisobni o\'zgartirish": hisob qadamiga qaytadi');
  teng(await p.evaluate(() => Calc && document.querySelector('.hisob-qator[aria-pressed="true"]').textContent.includes('Naqd pul')), true, 'tanlangan hisob ko\'rinadi');
  await p.click('button.hisob-qator:has-text("Karta A")'); await p.waitForSelector('#w-saqlash');
  await p.click('#w-saqlash'); await p.waitForSelector('.nav-tugma[data-bolim="tarix"][aria-current], h1:has-text("Tarix")', { timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(300);
  teng([await oyna().count(), await yozuvSoni(), await qoldiq('Karta A')], [0, boshlangichSoni + 1, 34000], 'pul yetadigan hisobga saqlandi (oyna chiqmadi): 50 000 − 16 000');

  // ======== 3) "Bu hisob uchun sozlamani o'zgartirish" havolasi, Ogohlantirish oynasi ========
  await wizardTayyor('16000', 'Naqd pul');
  await p.click('#w-keyingi'); await p.waitForSelector('#w-izoh');
  await p.fill('#w-izoh', 'Ikki\nqator izoh');
  await p.click('#w-saqlash'); await p.waitForSelector('.manfiy-oyna');
  await p.click('#manfiy-sozlama'); await p.waitForSelector('.manfiy-sozlama-oynasi');
  teng([await p.locator('.manfiy-oyna').count(), bo(await p.textContent('.manfiy-sozlama-oynasi h2')), await p.locator('.manfiy-sozlama-oynasi .manfiy-qator').count(), await yozuvSoni()], [0, 'Hisobda pul yetmasa', 3, boshlangichSoni + 1], 'havola: sozlamani joyida kichik oyna sifatida ochadi, forma ochiq, baza o\'zgarmadi');
  teng(await p.evaluate(() => document.querySelector('.manfiy-sozlama-oynasi .manfiy-qator.tanlangan').getAttribute('data-manfiy')), 'taqiqlash', 'joriy sozlama belgilangan');
  await olchov('sozlama oynasi'); await rasm('3-sozlama-oynasi');
  await p.click('.manfiy-sozlama-oynasi [data-manfiy="ogohlantirish"]'); await p.waitForTimeout(100);
  teng([await p.locator('.manfiy-sozlama-oynasi').count(), (await sozlama())['Naqd pul'], await p.textContent('h1'), await p.inputValue('#w-izoh')], [0, 'ogohlantirish', 'Izoh va saqlash', 'Ikki\nqator izoh'], 'sozlama saqlandi; forma ma\'lumoti (izoh) yo\'qolmadi');
  await p.click('#w-saqlash'); await p.waitForSelector('.manfiy-oyna');
  teng(await oynaMatni(), { sarlavha: 'Hisobda mablag\' yetmaydi', matn: '«Naqd pul» hisobida hozir 0 so\'m bor. Bu amaldan keyin −16 000 so\'m bo\'ladi.', tugmalar: ['Hisobni o\'zgartirish', 'Baribir saqlash'] }, 'Ogohlantirish oynasi matni va tugmalari');
  teng(await p.evaluate(() => [document.querySelector('.manfiy-qizil').textContent, getComputedStyle(document.querySelector('.manfiy-qizil')).color !== getComputedStyle(document.querySelector('.manfiy-matn')).color, document.querySelector('.manfiy-ikon').classList.contains('ogoh'), Math.round(document.querySelector('.manfiy-ikon').getBoundingClientRect().width)]), ['−16 000 so\'m', true, true, 36], 'manfiy summa qizil qalin, ikon sariq 36 px');
  teng(await p.evaluate(() => [...document.querySelectorAll('.manfiy-tugmalar button')].map((b) => Math.round(b.getBoundingClientRect().height) >= 48)), [true, true], 'tugmalar kamida 48 px');
  await olchov('Ogohlantirish oynasi'); await rasm('4-ogohlantirish-oynasi');
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  teng([await oyna().count(), await yozuvSoni()], [0, boshlangichSoni + 1], 'Ogohlantirish yopilsa saqlanmaydi');
  await p.click('#w-saqlash'); await p.waitForSelector('.manfiy-oyna'); await p.click('#manfiy-baribir');
  await p.waitForFunction(() => !document.querySelector('.manfiy-oyna') && document.querySelector('h1') && document.querySelector('h1').textContent !== 'Izoh va saqlash');
  teng([await yozuvSoni(), await qoldiq('Naqd pul')], [boshlangichSoni + 2, -16000], '"Baribir saqlash": amal saqlandi, qoldiq −16 000');
  // allaqachon manfiy hisobda yana kamaytirish: "hozir" manfiy
  await wizardTayyor('1000', 'Naqd pul'); await p.click('#w-saqlash'); await p.waitForSelector('.manfiy-oyna');
  teng((await oynaMatni()).matn, '«Naqd pul» hisobida hozir −16 000 so\'m bor. Bu amaldan keyin −17 000 so\'m bo\'ladi.', 'allaqachon manfiy: hozir minus bilan');
  await p.click('#manfiy-sozlama'); await p.click('.manfiy-sozlama-oynasi [data-manfiy="ruxsat"]'); await p.waitForTimeout(100);
  await p.click('#w-saqlash'); await p.waitForTimeout(400);
  teng([await oyna().count(), await yozuvSoni(), await qoldiq('Naqd pul')], [0, boshlangichSoni + 3, -17000], 'Ruxsat: oyna chiqmaydi, saqlanadi');

  // ======== 4) Yozuvni tahrirlash: eski ta'sir olib tashlanadi ========
  await p.click('.nav-tugma[data-bolim="tarix"]'); await p.waitForSelector('.yozuv-kv');
  await p.click('.yozuv-kv:has-text("Karta B")'); await p.waitForSelector('#f-summa');
  teng(await p.inputValue('#f-summa'), '100 000', 'tahrir: Karta B xarajati');
  await p.fill('#f-summa', '80 000'); await p.click('form button[type="submit"]'); await p.waitForTimeout(400);
  teng([await oyna().count(), await qoldiq('Karta B')], [0, 20000], 'tahrir: summani kamaytirish bloklanmaydi (oyna yo\'q)');
  await p.click('.yozuv-kv:has-text("Karta B")'); await p.waitForSelector('#f-summa');
  await p.fill('#f-summa', '150 000'); await p.fill('#f-izoh', 'Yangi izoh'); await p.click('form button[type="submit"]'); await p.waitForSelector('.manfiy-oyna');
  teng((await oynaMatni()).matn, '«Karta B» hisobida 100 000 so\'m bor, bu amal uchun 150 000 so\'m kerak. Boshqa hisobni tanlang yoki avval shu hisobga kirim yozing.', 'tahrir: oshirish bloklanadi (hozir — eski ta\'sirsiz)');
  await rasm('5-tahrir-taqiq');
  await p.click('#manfiy-hisob'); await p.waitForTimeout(100);
  teng(await p.evaluate(() => [document.activeElement.id, document.querySelector('#f-summa').value, document.querySelector('#f-izoh').value]), ['f-hisob', '150 000', 'Yangi izoh'], 'tahrir: "Hisobni o\'zgartirish" hisob maydoniga fokus, kiritilgan ma\'lumot saqlangan');
  teng([await qoldiq('Karta B'), (await bazadan('yozuvlar')).filter((y) => y.summa === 80000).length], [20000, 1], 'tahrir: bloklanganda baza o\'zgarmadi');
  await p.click('form button[type="submit"]'); await p.waitForSelector('.manfiy-oyna'); await p.click('#manfiy-yopish'); await p.waitForTimeout(100);
  teng(await p.inputValue('#f-summa'), '150 000', 'tahrir: "Yopish" dan keyin forma ochiq');
  // o'chirish va "Bekor qilish" (undo) tekshirilmaydi
  await sozlamaYoz('Karta B', 'taqiqlash');
  await p.click('button:has-text("O\'chirish")'); await p.waitForSelector('.toast-tugma');
  teng([await oyna().count(), await qoldiq('Karta B')], [0, 100000], 'o\'chirish tekshirilmaydi');
  await p.click('.toast-tugma'); await p.waitForTimeout(400);
  teng([await oyna().count(), await qoldiq('Karta B')], [0, 20000], '"Bekor qilish" (undo) tekshirilmaydi');

  // ======== 5) Qarz berdim / oldim, to'lov ========
  const qarzSoni = async () => (await bazadan('qarzlar')).length;
  await p.click('.nav-qoshish'); await p.click('#yy-qarz'); await p.waitForSelector('#q-summa');
  await p.fill('#q-shaxs', 'Anvar'); await p.selectOption('#q-hisob', { label: 'Karta C' }); await p.fill('#q-summa', '5000'); await p.fill('#q-izoh', 'qarz izohi');
  await p.click('[data-yonalish="berdim"]'); await p.click('form button[type="submit"]'); await p.waitForSelector('.manfiy-oyna');
  teng((await oynaMatni()).matn, '«Karta C» hisobida 0 so\'m bor, bu amal uchun 5 000 so\'m kerak. Boshqa hisobni tanlang yoki avval shu hisobga kirim yozing.', 'qarz berdim: bloklandi');
  await p.click('#manfiy-hisob'); await p.waitForTimeout(100);
  teng(await p.evaluate(() => [document.activeElement.id, document.querySelector('#q-shaxs').value, document.querySelector('#q-summa').value, document.querySelector('#q-izoh').value]), ['q-hisob', 'Anvar', '5 000', 'qarz izohi'], 'qarz: hisob maydoniga fokus, forma ma\'lumoti saqlandi');
  teng(await qarzSoni(), 0, 'qarz bloklanganda baza o\'zgarmadi');
  await p.selectOption('#q-hisob', { label: 'Karta A' }); await p.click('form button[type="submit"]'); await p.waitForSelector('.qarz-tanlov, .qarz-royxat, h1:has-text("Qarzlar")');
  await p.waitForTimeout(300);
  teng([await oyna().count(), await qarzSoni(), await qoldiq('Karta A')], [0, 1, 29000], 'qarz berdim yetadigan hisobdan saqlandi: 34 000 − 5 000');
  // qarz oldim: komissiyali ham tekshirilmaydi (Karta C: 0)
  await p.click('.nav-qoshish'); await p.click('#yy-qarz'); await p.waitForSelector('#q-summa');
  await p.click('[data-yonalish="oldim"]'); await p.fill('#q-shaxs', 'Bank'); await p.selectOption('#q-hisob', { label: 'Karta C' }); await p.fill('#q-summa', '100000');
  await p.click('form button[type="submit"]'); await p.waitForTimeout(500);
  teng([await oyna().count(), await qarzSoni(), await qoldiq('Karta C')], [0, 2, 100000], 'qarz oldim: tekshirilmaydi (Karta C hozir 0 edi)');
  // to'lov: olingan qarzni qaytarish hisobdan chiqadi (Karta D: 0) — bloklanadi; berilgan qarzni qaytarib olish tekshirilmaydi
  const qarzOch = async (shaxs, tanlov) => { await p.click('[data-bolim="qarzlar"]'); await p.waitForSelector('.qarz-tanlov'); await p.click('[data-tanlov="' + tanlov + '"]'); await p.click('.odam-qator[data-shaxs="' + shaxs + '"]'); };
  await qarzOch('Bank', 'oldim'); await p.waitForSelector('button:has-text("Qaytardim")');
  await p.click('button:has-text("Qaytardim")'); await p.waitForSelector('#t-summa');
  await p.fill('#t-summa', '30000'); await p.selectOption('#t-hisob', { label: 'Karta D' }); await p.click('form button[type="submit"]'); await p.waitForSelector('.manfiy-oyna');
  teng((await oynaMatni()).matn, '«Karta D» hisobida 0 so\'m bor, bu amal uchun 30 000 so\'m kerak. Boshqa hisobni tanlang yoki avval shu hisobga kirim yozing.', 'to\'lov (qarz qaytarish) bloklandi');
  await p.click('#manfiy-hisob'); await p.waitForTimeout(100);
  teng(await p.evaluate(() => [document.activeElement.id, document.querySelector('#t-summa').value]), ['t-hisob', '30 000'], 'to\'lov: hisob maydoniga fokus, summa saqlandi');
  teng((await bazadan('qarzlar')).reduce((a, q) => a + q.tolovlar.length, 0), 0, 'to\'lov bloklanganda baza o\'zgarmadi');
  await p.selectOption('#t-hisob', { label: 'Karta C' }); await p.click('form button[type="submit"]'); await p.waitForTimeout(400);
  teng([await oyna().count(), await qoldiq('Karta C')], [0, 70000], 'to\'lov yetadigan hisobdan saqlandi');
  await qarzOch('Anvar', 'berdim'); await p.waitForSelector('button:has-text("Qaytarildi")');
  await p.click('button:has-text("Qaytarildi")'); await p.waitForSelector('#t-summa');
  await p.fill('#t-summa', '1000'); await p.selectOption('#t-hisob', { label: 'Karta D' }); await p.click('form button[type="submit"]'); await p.waitForTimeout(400);
  teng([await oyna().count(), await qoldiq('Karta D')], [0, 1000], 'berdim qarzning qaytarilishi (kirim) tekshirilmaydi');

  // ======== 6) Gap kartasi ========
  await p.click('[data-bolim="bosh"]');
  const kategoriya = await p.evaluate(async () => (await Data.hammasi('kategoriyalar')).filter((k) => k.tur === 'xarajat')[0].nom);
  navbat.push({ holat: 200, tana: { ok: true, manba: 'model', yozuvlar: [{ tur: 'xarajat', summa: 15000, soni: null, narx: null, kategoriya, hisob: 'Karta C', hisob_turi: 'karta', hisob2: null, shaxs: null, sana: null, izoh: 'taksi', ogohlantirish: [] }] } });
  await p.evaluate(async () => { const h = (await Data.hammasi('hisoblar')).filter((x) => x.nom === 'Karta A')[0]; void h; });
  await sozlamaYoz('Karta C', 'taqiqlash');
  await p.evaluate(async () => { /* Karta C da hozir 70 000: 15 000 yetadi — shuning uchun avval qoldiqni kamaytiramiz */ const h = (await Data.hammasi('hisoblar')).filter((x) => x.nom === 'Karta C')[0]; const k = (await Data.hammasi('kategoriyalar')).filter((x) => x.tur === 'xarajat')[0]; await Data.saqlash('yozuvlar', { yaratilgan: new Date().toISOString(), tur: 'xarajat', summa: 70000, sana: Calc.bugun(), vaqt: '00:02', hisob_id: h.id, kategoriya_id: k.id, izoh: 'Sinov' }); });
  await p.reload(); await p.waitForFunction(() => document.querySelector('#ekran h1'));
  await p.evaluate(() => { Kirish.holat = () => ({ kirgan: true, id: 'u-sinov', email: '', ism: '', xato: '', kirmoqda: false }); Kirish.tokenOl = () => Promise.resolve('sinov-token'); Kirish.tokenYangila = () => Promise.resolve('sinov-token'); Yordamchi.yangila(); });
  teng(await qoldiq('Karta C'), 0, 'Gap uchun Karta C qoldig\'i 0');
  const soniOldin = await yozuvSoni();
  await p.click('#gap-tugma'); await p.fill('#gap-matn', 'taksiga 15 ming'); await p.click('#gap-aylantirish'); await p.waitForSelector('#gap-saqlash');
  teng(await p.inputValue('#gk-hisob').then(async () => p.evaluate(() => document.querySelector('#gk-hisob').selectedOptions[0].textContent)), 'Karta C', 'Gap kartasi: hisob Karta C');
  await p.click('#gap-saqlash'); await p.waitForSelector('.manfiy-oyna');
  teng((await oynaMatni()).matn, '«Karta C» hisobida 0 so\'m bor, bu amal uchun 15 000 so\'m kerak. Boshqa hisobni tanlang yoki avval shu hisobga kirim yozing.', 'Gap: bloklandi');
  await olchov('Gap + taqiqlash oynasi'); await rasm('6-gap-taqiq');
  await p.click('#manfiy-hisob'); await p.waitForTimeout(200);
  teng(await p.evaluate(() => [document.activeElement.id, !!document.querySelector('#gap-saqlash'), /15\D?000/.test(document.querySelector('#gk-summa').value)]), ['gk-hisob', true, true], 'Gap: karta ochiq, hisob maydoniga fokus, summa saqlandi');
  teng(await yozuvSoni(), soniOldin, 'Gap: bloklanganda baza o\'zgarmadi');
  await sozlamaYoz('Karta C', 'ogohlantirish');
  await p.click('#gap-saqlash'); await p.waitForSelector('.manfiy-oyna');
  teng((await oynaMatni()).tugmalar, ['Hisobni o\'zgartirish', 'Baribir saqlash'], 'Gap: ogohlantirish');
  await p.click('#manfiy-baribir'); await p.waitForTimeout(500);
  teng([await yozuvSoni(), await qoldiq('Karta C')], [soniOldin + 1, -15000], 'Gap: "Baribir saqlash" saqladi');
  await olchov('yakun');
  await kontekst.close();
}

(async () => {
  const brauzer = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const tema of ['light', 'dark']) {
    try { await senariy(brauzer, tema); } catch (e) { xatolar++; console.log('  ✗ ' + (e && e.message ? e.message.split('\n').slice(0, 3).join(' | ') : e) + (e && e.stack ? ' @ ' + (e.stack.match(/manfiy-brauzer-sinovi\.js:\d+/) || [''])[0] : '')); }
  }
  await brauzer.close();
  console.log(jami + ' tekshiruv, xato: ' + xatolar + ' (rasmlar: ' + RASMLAR + ')');
  process.exit(xatolar ? 1 : 0);
})();
