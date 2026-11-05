// Soliq cheki PDF va OpenAI zaxirasi belgisi (TZ-sinxronlash.md 55–56-band) uchun brauzer sinovi: HAQIQIY ilova (Chromium), server javobi SOXTA
// (tarmoqqa chiqilmaydi, Gemini va OpenAI ishlatilmaydi). Faqat uydirma ma'lumot (PDF baytlari soxta, repoda fayl yo'q). Faqat ishlab chiqish vaqtida.
// Ishga tushirish: python3 -m http.server 8000  (repozitoriy papkasida), keyin  node tools/pdf-brauzer-sinovi.js [rasmlar_papkasi]
// (PLAYWRIGHT_MODULE, CHROMIUM_PATH, ILOVA_MANZIL o'zgaruvchilari ixtiyoriy). 360 px, yorug' va qorong'i rejim. Xato bo'lsa chiqish kodi 1.
const fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const MANZIL = process.env.ILOVA_MANZIL || 'http://localhost:8000/index.html';
const RASMLAR = process.argv[2] || path.join(os.tmpdir(), 'pdf-rasmlar');
fs.mkdirSync(RASMLAR, { recursive: true });
let jami = 0, xatolar = 0;
function teng(h, k, izoh) { jami++; if (JSON.stringify(h) !== JSON.stringify(k)) { xatolar++; console.log('  ✗ ' + izoh + ' — kutilgan: ' + JSON.stringify(k) + ', chiqdi: ' + JSON.stringify(h)); } }
const IZOH = ['MAYDA BOZOR 04.10.2026', '1. Yopgan non=7800', '2. Sut 1L=12500', '3. Tovuq tuxumi x2=30490', "4. Yog' 1L=18700", '5. Shakar 1KG=9200', "6. Gul=0 (sovg'a)", 'Jami=78690'].join('\n');
const YOZUV = (o) => Object.assign({ tur: 'xarajat', summa: 78690, soni: null, narx: null, kategoriya: null, hisob: null, hisob_turi: null, hisob2: null, shaxs: null, sana: '2026-01-05', vaqt: '14:35', izoh: IZOH, ogohlantirish: [] }, o || {});
const JAVOB = (o, y) => ({ holat: 200, tana: Object.assign({ ok: true, manba: 'gemini', model: 'gemini-2.5-flash', yozuv_manba: null, chek: true, yigindi_mos: true, yozuvlar: [YOZUV(y)] }, o || {}) });
const PDF = { name: 'soliq-chek.pdf', mimeType: 'application/pdf', buffer: Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(2000, 7)]) };

async function senariy(brauzer, tema) {
  console.log('== ' + tema + ' rejim, 360 px ==');
  const kontekst = await brauzer.newContext({ viewport: { width: 360, height: 740 }, colorScheme: tema, serviceWorkers: 'block' });
  const p = await kontekst.newPage();
  p.on('pageerror', (e) => { if (!/IDBObjectStore/.test(e.message)) { xatolar++; console.log('  ✗ PAGEERROR ' + e.message); } });
  const sorovlar = [], navbat = [];
  await p.route('**/functions/v1/yordamchi', async (r) => {
    const sarlavha = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'content-type': 'application/json' };
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: sarlavha });
    sorovlar.push(JSON.parse(r.request().postData()));
    const j = navbat.shift() || { holat: 500, tana: { xato: { kod: 'AI_PROVAYDER' } } };
    return r.fulfill({ status: j.holat, headers: sarlavha, body: JSON.stringify(j.tana) }).catch(() => {});
  });
  await p.goto(MANZIL);
  await p.waitForFunction(() => typeof Data !== 'undefined' && document.querySelector('#ekran h1'));
  if (await p.locator('#salom-davom').count()) { await p.click('#salom-davom'); await p.waitForSelector('#salom-ekran', { state: 'detached' }); }
  await p.evaluate(() => {
    Kirish.holat = () => ({ kirgan: true, id: 'u-sinov', email: '', ism: '', xato: '', kirmoqda: false });
    Kirish.tokenOl = () => Promise.resolve('sinov-token'); Kirish.tokenYangila = () => Promise.resolve('sinov-token');
    Yordamchi.yangila();
  });
  await p.click('#gap-tugma');
  const sigadi = () => p.evaluate(() => [document.querySelector('.gp-tana').scrollWidth <= document.querySelector('.gp-tana').clientWidth, document.documentElement.scrollWidth <= 360]);

  // 1) menyu: PDF qatori BIRINCHI, accent tusli, ≥ 44 px, ekranga sig'adi
  await p.click('#gap-kamera');
  teng(await p.locator('#gap-kamera-menyu button').allTextContents(), ['PDF yuklashSoliq saytidan olingan chek', 'Suratga olish', 'Galereyadan tanlash'], 'menyu: PDF birinchi');
  const bq = await p.locator('#gap-kamera-menyu button').evaluateAll((l) => l.map((b) => b.getBoundingClientRect().height >= 44));
  const mr = await p.locator('#gap-kamera-menyu').boundingBox();
  teng([bq, mr.x >= 0, mr.x + mr.width <= 360], [[true, true, true], true, true], 'bandlar ≥ 44 px, menyu ekranga sig\'adi');
  const accent = await p.evaluate(() => { const a = getComputedStyle(document.getElementById('gap-pdf-tugma')), b = getComputedStyle(document.querySelectorAll('#gap-kamera-menyu button')[1]); return [a.backgroundColor !== b.backgroundColor, a.backgroundColor !== 'rgba(0, 0, 0, 0)']; });
  teng(accent, [true, true], 'PDF qatori accent tusli (qolganlardan farq qiladi)');
  teng(await p.evaluate(() => { const i = document.getElementById('gap-pdf-fayl'), s = getComputedStyle(i); return [i.accept, s.display !== 'none', i.hasAttribute('capture')]; }), ['application/pdf,.pdf', true, false], 'PDF input: accept, display:none emas, capture yo\'q');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-1-menyu.png') });
  await p.mouse.click(180, 400);

  // 2) noto'g'ri tur va katta hajm: serverga so'rov ketmaydi
  await p.setInputFiles('#gap-pdf-fayl', { name: 'rasm.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(100, 1) });
  teng((await p.textContent('#gap-xato')).indexOf('Faqat PDF fayl tanlang') === 0, true, 'PDF emas: xato');
  await p.setInputFiles('#gap-pdf-fayl', { name: 'katta.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(4 * 1024 * 1024 + 1, 7) });
  teng((await p.textContent('#gap-xato')).indexOf('PDF juda katta (4 MB gacha)') === 0, true, '4 MB dan katta: xato');
  teng(sorovlar.length, 0, 'xatolarda serverga so\'rov ketmadi');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-2-xato.png') });

  // 3) to'g'ri PDF: natija kartasi (yashil qator, PDF belgisi, izoh 4 qator + "… yana N qator", manba belgisi)
  navbat.push(JAVOB());
  await p.setInputFiles('#gap-pdf-fayl', PDF);
  await p.waitForSelector('#gap-chek-belgi');
  const s = sorovlar[0];
  teng([sorovlar.length, s.rejim, s.mime, /^JVBERi0/.test(s.rasm)], [1, 'rasm', 'application/pdf', true], 'serverga rasm rejimi, mime PDF');
  teng(await p.textContent('#gap-chek-belgi'), 'PDF chekdan o\'qildi · tekshiring', 'PDF belgisi');
  teng(await p.textContent('#gap-mos'), 'Mahsulotlar yig\'indisi jami bilan mos (chegirmalar hisobga olindi)', 'yashil qator');
  teng(await p.locator('#gap-izoh-matn > div').allTextContents(), ['MAYDA BOZOR 04.10.2026', '1. Yopgan non=7800', '2. Sut 1L=12500', '3. Tovuq tuxumi x2=30490'], 'izoh: dastlabki 4 qator');
  teng(await p.textContent('#gap-izoh-yana'), '… yana 4 qator', 'kulrang "… yana N qator"');
  teng(await p.locator('#gk-izoh').count(), 0, 'karta ichida izoh maydoni yo\'q (Tahrirlash orqali)');
  teng(await sigadi(), [true, true], 'gorizontal aylanish yo\'q (360 px)');
  const ranglar = await p.evaluate(() => { const m = getComputedStyle(document.getElementById('gap-mos')), y = getComputedStyle(document.getElementById('gap-izoh-yana')); return [m.color !== m.backgroundColor, y.color !== getComputedStyle(document.body).backgroundColor]; });
  teng(ranglar, [true, true], 'matn fondan farq qiladi (o\'qiladi)');
  await p.click('#gap-manba');
  teng(await p.textContent('#gap-manba-izoh'), 'Chek Gemini orqali o\'qildi', 'belgi: Gemini');
  teng(await p.evaluate(() => document.getElementById('gap-manba').getBoundingClientRect().height >= 44), true, 'belgi bosish maydoni ≥ 44 px');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-3-natija.png'), fullPage: false });
  await p.evaluate(() => { document.querySelector('.gp-tana').scrollTop = 99999; });
  await p.screenshot({ path: path.join(RASMLAR, tema + '-4-natija-past.png'), fullPage: false });
  teng(await p.evaluate(() => ['gap-saqlash', 'gap-tahrirlash', 'gap-bekor'].every((i) => document.getElementById(i).getBoundingClientRect().height >= 44)), true, 'tugmalar ≥ 44 px');

  // 4) Tahrirlash: oddiy yozuv formasi karta qiymatlari bilan ochiladi
  await p.click('#gap-tahrirlash');
  await p.waitForSelector('.gp-ekran', { state: 'detached' });
  await p.waitForFunction(() => document.querySelector('#ekran h1') && /Yozuv qo'shish/.test(document.querySelector('#ekran h1').textContent));
  teng(await p.evaluate(() => { const i = document.querySelector('#ekran .summa-kiritish'); return i ? i.value.replace(/\s/g, '') : null; }), '78690', 'oddiy forma summa bilan to\'ldirildi (to\'liq izoh — tests.html da)');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-5-tahrirlash.png') });

  // 5) OpenAI zaxirasi: sariq belgi va matn; rasm yo'li ham raqamlangan izoh beradi; yig'indi mos emas -> yashil qator yo'q
  await p.goto(MANZIL);
  await p.waitForFunction(() => typeof Data !== 'undefined' && document.querySelector('#ekran h1'));
  await p.evaluate(() => { Kirish.holat = () => ({ kirgan: true, id: 'u-sinov', email: '', ism: '', xato: '', kirmoqda: false }); Kirish.tokenOl = () => Promise.resolve('sinov-token'); Kirish.tokenYangila = () => Promise.resolve('sinov-token'); Yordamchi.yangila(); });
  await p.waitForSelector('#gap-tugma:not([hidden])', { timeout: 5000 }).catch(async () => { await p.evaluate(() => { const b = document.getElementById('gap-tugma'); if (b) b.hidden = false; }); });
  await p.click('#gap-tugma');
  navbat.push(JAVOB({ manba: 'openai', model: 'gpt-4.1-mini', yigindi_mos: false }, { ogohlantirish: ["Mahsulotlar yig'indisi jami bilan mos emas, summani tekshiring"] }));
  const rasm = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await p.setInputFiles('#gap-rasm-galereya', { name: 'chek.png', mimeType: 'image/png', buffer: rasm });
  await p.waitForSelector('#gap-chek-belgi');
  teng(await p.textContent('#gap-chek-belgi'), 'Chekdan o\'qildi · tekshiring', 'rasm: oddiy belgi');
  teng(await p.locator('#gap-mos').count(), 0, 'mos emas: yashil qator yo\'q');
  teng((await p.locator('#gap-ogoh p').allTextContents()).slice(1), ["Mahsulotlar yig'indisi jami bilan mos emas, summani tekshiring"], 'sariq ogohlantirish');
  await p.click('#gap-manba');
  teng(await p.textContent('#gap-manba-izoh'), 'Chek OpenAI orqali o\'qildi (zaxira)', 'belgi: OpenAI zaxira');
  teng(await p.evaluate(() => getComputedStyle(document.querySelector('.gp-manba-belgi')).backgroundColor !== getComputedStyle(document.querySelector('.gp-manba-belgi')).color), true, 'belgi rangi');
  teng(await p.locator('#gap-izoh-matn > div').count(), 4, 'rasm yo\'li ham raqamlangan izoh (dastlabki 4 qator)');
  teng(await sigadi(), [true, true], 'gorizontal aylanish yo\'q');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-6-openai.png') });
  teng(await p.evaluate(() => Object.entries(localStorage).map((x) => x.join('=')).join('|').indexOf('JVBERi0') < 0), true, 'PDF localStorage da yo\'q');
  await kontekst.close();
}

(async () => {
  const brauzer = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  for (const tema of ['light', 'dark']) await senariy(brauzer, tema);
  await brauzer.close();
  console.log(jami + ' tekshiruv, xato: ' + xatolar + ' (rasmlar: ' + RASMLAR + ')');
  process.exit(xatolar ? 1 : 0);
})().catch((e) => { console.log('✗ ' + e.stack); process.exit(1); });
