// Chek skaneri (TZ-sinxronlash.md 36-band) uchun brauzer sinovi: HAQIQIY ilova va HAQIQIY canvas/fayl tanlash (Chromium), server javobi SOXTA
// (tarmoqqa chiqilmaydi, Gemini ishlatilmaydi). Faqat uydirma ma'lumot (rasm sinov paytida canvasda chiziladi, repoda rasm yo'q). Faqat ishlab chiqish vaqtida.
// Ishga tushirish: python3 -m http.server 8000  (repozitoriy papkasida), keyin  node tools/gap-chek-brauzer-sinovi.js [rasmlar_papkasi]
// (PLAYWRIGHT_MODULE, CHROMIUM_PATH, ILOVA_MANZIL o'zgaruvchilari ixtiyoriy). 360 px, yorug' va qorong'i rejim. Xato bo'lsa chiqish kodi 1.
const fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const MANZIL = process.env.ILOVA_MANZIL || 'http://localhost:8000/index.html';
const RASMLAR = process.argv[2] || path.join(os.tmpdir(), 'gap-chek-rasmlar');
fs.mkdirSync(RASMLAR, { recursive: true });
let jami = 0, xatolar = 0;
function teng(h, k, izoh) { jami++; if (JSON.stringify(h) !== JSON.stringify(k)) { xatolar++; console.log('  ✗ ' + izoh + ' — kutilgan: ' + JSON.stringify(k) + ', chiqdi: ' + JSON.stringify(h)); } }
const bugun = () => { const d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
const YOZUV = (o) => Object.assign({ tur: 'xarajat', summa: 25500, soni: null, narx: null, kategoriya: null, hisob: null, hisob_turi: null, hisob2: null, shaxs: null, sana: '2026-01-05', vaqt: '14:35', izoh: 'MAYDA BOZOR: NON 5 000, SUT 12 500', ogohlantirish: [] }, o || {});

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
    if (j.kechik) await new Promise((ok) => setTimeout(ok, j.kechik));
    return r.fulfill({ status: j.holat, headers: sarlavha, body: JSON.stringify(j.tana) }).catch(() => {});
  });
  await p.goto(MANZIL);
  await p.waitForFunction(() => typeof Data !== 'undefined' && document.querySelector('#ekran h1'));
  if (await p.locator('#salom-davom').count()) { await p.click('#salom-davom'); await p.waitForSelector('#salom-ekran', { state: 'detached' }); }
  await p.evaluate(() => {   // soxta kirish: Google'siz; faqat shu sahifada
    Kirish.holat = () => ({ kirgan: true, id: 'u-sinov', email: '', ism: '', xato: '', kirmoqda: false });
    Kirish.tokenOl = () => Promise.resolve('sinov-token'); Kirish.tokenYangila = () => Promise.resolve('sinov-token');
    Yordamchi.yangila();
  });
  // sinov rasmi: katta (3200x2400) PNG, canvasda chiziladi
  const rasm = Buffer.from(await p.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 3200; c.height = 2400; const x = c.getContext('2d');
    for (let i = 0; i < 60; i++) { x.fillStyle = 'hsl(' + (i * 6) + ',70%,50%)'; x.fillRect((i * 53) % 3000, (i * 37) % 2200, 400, 300); }
    return c.toDataURL('image/png').split(',')[1];
  }), 'base64');
  const fayl = { name: 'sinov.png', mimeType: 'image/png', buffer: rasm };
  const yoq = async (sel) => p.locator(sel).count().then((n) => n === 0);

  await p.click('#gap-tugma');
  const kamera = p.locator('#gap-kamera'), mik = p.locator('#gap-mik'), menyu = p.locator('#gap-kamera-menyu');
  teng(await kamera.isVisible(), true, 'kamera tugmasi ko\'rinadi');
  const kb = await kamera.boundingBox(), mb = await mik.boundingBox(), ta = await p.locator('#gap-matn').boundingBox();
  teng([kb.width >= 44, kb.height >= 44, kb.x + kb.width <= mb.x, Math.round(kb.width) === Math.round(mb.width), kb.x >= ta.x + ta.width - 1], [true, true, true, true, true], 'kamera mikrofonning chapida, bir xil o\'lcham, ≥ 44 px');
  const uslub = await p.evaluate(() => { const a = getComputedStyle(document.getElementById('gap-kamera')), b = getComputedStyle(document.getElementById('gap-mik')); return [a.backgroundColor === b.backgroundColor, a.color === b.color, a.borderRadius === b.borderRadius]; });
  teng(uslub, [true, true, true], 'kamera va mikrofon bir xil uslub');
  teng(await p.evaluate(() => [document.querySelector('.gp-ekran').scrollWidth <= document.querySelector('.gp-ekran').clientWidth, document.documentElement.scrollWidth <= 360]), [true, true], 'gorizontal aylanish yo\'q (360 px)');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-1-tugmalar.png') });

  // 1) menyu
  await kamera.click();
  teng(await menyu.isVisible(), true, 'menyu ochildi');
  teng(await p.locator('#gap-kamera-menyu button').allTextContents(), ['Suratga olish', 'Galereyadan tanlash'], 'menyu bandlari');
  const mbq = await p.locator('#gap-kamera-menyu button').evaluateAll((l) => l.map((b) => b.getBoundingClientRect().height >= 44));
  const mr = await menyu.boundingBox();
  teng([mbq, mr.x >= 0, mr.x + mr.width <= 360], [[true, true], true, true], 'menyu bandlari ≥ 44 px va ekranga sig\'adi');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-2-menyu.png') });
  await p.mouse.click(180, 400);
  teng(await menyu.isHidden(), true, 'tashqariga bosilsa yopiladi');

  // 2) o'qilmoqda -> Bekor
  navbat.push({ holat: 200, tana: { ok: true, manba: 'model', chek: true, yozuvlar: [YOZUV()] }, kechik: 3000 });
  await p.setInputFiles('#gap-rasm-galereya', fayl);
  await p.waitForSelector('#gap-chek-holat:not([hidden])');
  teng(/Chek o'qilmoqda…\s*Rasm saqlanmaydi/.test(await p.textContent('#gap-chek-holat')), true, '"Chek o\'qilmoqda…" va "Rasm saqlanmaydi"');
  teng(await p.evaluate(() => document.getElementById('gap-chek-bekor').getBoundingClientRect().height >= 44), true, 'Bekor ≥ 44 px');
  await p.waitForFunction(() => true); await p.waitForTimeout(300);
  const s = sorovlar[0];
  teng([sorovlar.length, s.rejim, s.mime, /^\/9j\//.test(s.rasm), s.rasm.length * 0.75 <= 1572864, Array.isArray(s.kategoriyalar), Array.isArray(s.hisoblar), s.bugun], [1, 'rasm', 'image/jpeg', true, true, true, true, bugun()], 'serverga rasm rejimi (JPEG, ≤ 1,5 MB)');
  const olcham = await p.evaluate((b64) => new Promise((ok) => { const i = new Image(); i.onload = () => ok([i.naturalWidth, i.naturalHeight]); i.src = 'data:image/jpeg;base64,' + b64; }), s.rasm);
  teng(olcham, [1600, 1200], 'uzun tomon 1600 px');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-3-oqilmoqda.png') });
  await p.click('#gap-chek-bekor');
  teng(await p.locator('#gap-chek-holat').isHidden(), true, 'Bekor: karta yo\'qoldi');
  await p.waitForTimeout(3300);
  teng([await yoq('#gap-saqlash'), await p.textContent('#gap-xato')], [true, ''], 'bekordan keyin kelgan javob karta ochmaydi');

  // 3) natija kartasi
  navbat.push({ holat: 200, tana: { ok: true, manba: 'model', chek: true, yozuvlar: [YOZUV({ sana: null, vaqt: null, ogohlantirish: ['Sana chekdan o\'qilmadi — bugungi sana qo\'yildi', 'JAMI summa chekdan topilmadi — summani kiriting'], summa: null })] } });
  await p.setInputFiles('#gap-rasm-kamera', fayl);
  await p.waitForSelector('#gap-chek-belgi');
  teng(await p.textContent('#gap-chek-belgi'), 'Chekdan o\'qildi · tekshiring', 'chek belgisi');
  teng((await p.locator('#gap-ogoh p').allTextContents()).length, 3, 'sariq qatorda ogohlantirishlar (umumiy + 2)');
  teng([await p.inputValue('#gk-sana'), await p.inputValue('#gk-summa'), await p.inputValue('#gk-izoh')], [bugun(), '', 'MAYDA BOZOR: NON 5 000, SUT 12 500'], 'sana bugun, summa bo\'sh, izoh');
  teng([await p.textContent('#gap-saqlash'), await p.textContent('#gap-tahrirlash')], ['Saqlash', 'Tahrirlash'], 'tugmalar');
  teng(await p.evaluate(() => [document.querySelector('.gp-tana').scrollWidth <= document.querySelector('.gp-tana').clientWidth, document.documentElement.scrollWidth <= 360, ['gap-saqlash', 'gap-tahrirlash', 'gap-bekor'].every((i) => document.getElementById(i).getBoundingClientRect().height >= 44)]), [true, true, true], 'gorizontal aylanish yo\'q, tugmalar ≥ 44 px');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-4-natija.png'), fullPage: false });
  teng(await p.evaluate(() => Object.entries(localStorage).map((x) => x.join('=')).join('|').indexOf('/9j/') < 0), true, 'rasm localStorage da yo\'q');

  // 4) Tahrirlash -> oddiy yozuv formasi to'ldirilgan; hech narsa saqlanmadi
  await p.fill('#gk-summa', '30000');
  await p.click('#gap-tahrirlash');
  await p.waitForSelector('.gp-ekran', { state: 'detached' });
  await p.waitForFunction(() => document.querySelector('#ekran h1') && /Yozuv qo'shish/.test(document.querySelector('#ekran h1').textContent));
  teng(await p.evaluate(() => { const i = document.querySelector('#ekran input[inputmode="numeric"], #ekran .summa-kiritish'); return i ? i.value.replace(/\s/g, '') : null; }), '30000', 'oddiy forma summa bilan to\'ldirildi');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-5-tahrirlash.png') });

  // 5) xato: CHEK_EMAS
  await p.click('#ekran .orqaga-tugma').catch(() => {});
  await p.evaluate(() => document.getElementById('gap-tugma') && (document.getElementById('gap-tugma').hidden = false));
  await p.goto(MANZIL);
  await p.waitForFunction(() => typeof Data !== 'undefined' && document.querySelector('#ekran h1'));
  await p.evaluate(() => { Kirish.holat = () => ({ kirgan: true, id: 'u-sinov', email: '', ism: '', xato: '', kirmoqda: false }); Kirish.tokenOl = () => Promise.resolve('sinov-token'); Kirish.tokenYangila = () => Promise.resolve('sinov-token'); Yordamchi.yangila(); });
  await p.click('#gap-tugma');
  navbat.push({ holat: 422, tana: { xato: { kod: 'CHEK_EMAS', sabab: 'x' } } });
  await p.setInputFiles('#gap-rasm-galereya', fayl);
  await p.waitForFunction(() => document.getElementById('gap-xato').textContent.length > 0);
  teng((await p.textContent('#gap-xato')).indexOf('Rasmda chek topilmadi.') === 0 && (await p.textContent('#gap-xato')).indexOf('(kod: CHEK_EMAS)') > 0, true, 'CHEK_EMAS xatosi o\'zbekcha + kod');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-6-xato.png') });
  await kontekst.close();
}

(async () => {
  const brauzer = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  for (const tema of ['light', 'dark']) await senariy(brauzer, tema);
  await brauzer.close();
  console.log(jami + ' tekshiruv, xato: ' + xatolar + ' (rasmlar: ' + RASMLAR + ')');
  process.exit(xatolar ? 1 : 0);
})().catch((e) => { console.log('✗ ' + e.stack); process.exit(1); });
