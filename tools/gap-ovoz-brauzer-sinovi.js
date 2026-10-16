// Gap ekranidagi mikrofon (TZ-sinxronlash.md 31-band) uchun brauzer sinovi: HAQIQIY ilova va HAQIQIY MediaRecorder (Chromium soxta mikrofon qurilmasi bilan),
// server javobi SOXTA (tarmoqqa chiqilmaydi, Gemini ishlatilmaydi). Faqat uydirma ma'lumot. Faqat ishlab chiqish vaqtida.
// Ishga tushirish: python3 -m http.server 8000  (repozitoriy papkasida), keyin  node tools/gap-ovoz-brauzer-sinovi.js [rasmlar_papkasi]
// (PLAYWRIGHT_MODULE, CHROMIUM_PATH, ILOVA_MANZIL o'zgaruvchilari ixtiyoriy). 360 px, yorug' va qorong'i rejim. Xato bo'lsa chiqish kodi 1.
const fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const MANZIL = process.env.ILOVA_MANZIL || 'http://localhost:8000/index.html';
const RASMLAR = process.argv[2] || path.join(os.tmpdir(), 'gap-ovoz-rasmlar');
fs.mkdirSync(RASMLAR, { recursive: true });
let jami = 0, xatolar = 0;
function teng(h, k, izoh) { jami++; if (JSON.stringify(h) !== JSON.stringify(k)) { xatolar++; console.log('  ✗ ' + izoh + ' — kutilgan: ' + JSON.stringify(k) + ', chiqdi: ' + JSON.stringify(h)); } }

async function senariy(brauzer, tema) {
  console.log('== ' + tema + ' rejim, 360 px ==');
  const kontekst = await brauzer.newContext({ viewport: { width: 360, height: 740 }, colorScheme: tema, serviceWorkers: 'block', permissions: ['microphone'] });
  const p = await kontekst.newPage();
  p.on('pageerror', (e) => { if (!/IDBObjectStore/.test(e.message)) { xatolar++; console.log('  ✗ PAGEERROR ' + e.message); } });
  const sorovlar = [], navbat = [];
  await p.route('**/functions/v1/yordamchi', async (r) => {
    const sarlavha = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'content-type': 'application/json' };
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: sarlavha });
    sorovlar.push(JSON.parse(r.request().postData()));
    const j = navbat.shift() || { holat: 500, tana: { xato: { kod: 'AI_PROVAYDER' } } };
    if (j.kechik) await new Promise((ok) => setTimeout(ok, j.kechik));
    return r.fulfill({ status: j.holat, headers: sarlavha, body: JSON.stringify(j.tana) });
  });
  await p.goto(MANZIL);
  await p.waitForFunction(() => typeof Data !== 'undefined' && document.querySelector('#ekran h1'));
  if (await p.locator('#salom-davom').count()) { await p.click('#salom-davom'); await p.waitForSelector('#salom-ekran', { state: 'detached' }); }
  await p.evaluate(() => {   // soxta kirish: Google'siz; faqat shu sahifada
    Kirish.holat = () => ({ kirgan: true, id: 'u-sinov', email: '', ism: '', xato: '', kirmoqda: false });
    Kirish.tokenOl = () => Promise.resolve('sinov-token'); Kirish.tokenYangila = () => Promise.resolve('sinov-token');
    Yordamchi.yangila();
  });
  const t = p.locator('#gap-tugma'), mik = p.locator('#gap-mik');
  await t.click();
  teng(await mik.isVisible(), true, 'mikrofon tugmasi ko\'rinadi');
  const q = await mik.boundingBox(), ta = await p.locator('#gap-matn').boundingBox();
  teng([q.width >= 44, q.height >= 44, q.x >= ta.x + ta.width - 1], [true, true, true], 'tugma ≥ 44 px va maydon yonida');
  teng(await p.evaluate(() => [document.querySelector('.gp-ekran').scrollWidth <= document.querySelector('.gp-ekran').clientWidth, document.documentElement.scrollWidth <= 360]), [true, true], 'gorizontal aylanish yo\'q (360 px)');
  teng(await mik.getAttribute('aria-label'), 'Ovoz bilan yozish', 'aria-label');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-1-mikrofon.png') });

  // 1) yozish -> to'xtatish -> matn maydonga tushadi, yozuvga aylantirilmaydi
  await p.fill('#gap-matn', 'non oldim');
  navbat.push({ holat: 200, tana: { ok: true, matn: 'taksiga o\'n besh ming', manba: null } });
  await mik.click();
  await p.waitForFunction(() => document.getElementById('gap-mik').getAttribute('aria-pressed') === 'true');
  await p.waitForTimeout(1300);
  teng(/^0:0[1-9] \/ 0:30$/.test(await p.textContent('#gap-mik-holat')), true, 'sekundomer: ' + await p.textContent('#gap-mik-holat'));
  teng(await mik.getAttribute('aria-label'), 'Yozishni to\'xtatish', 'to\'xtatish tugmasi');
  const qizil = await mik.evaluate((e) => { const x = document.createElement('i'); x.style.color = 'var(--xarajat)'; document.body.appendChild(x); const r = getComputedStyle(x).color; x.remove(); return [getComputedStyle(e).backgroundColor, r]; });
  teng(qizil[0], qizil[1], 'yozish paytida qizil (--xarajat)');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-2-yozilmoqda.png') });
  await mik.click();
  await p.waitForFunction(() => document.getElementById('gap-matn').value.indexOf('taksiga') >= 0);
  teng(await p.inputValue('#gap-matn'), 'non oldim taksiga o\'n besh ming', 'matn qo\'shildi');
  const s = sorovlar[0];
  teng([sorovlar.length, s.rejim, /^(audio\/webm|audio\/mp4|audio\/ogg)$/.test(s.mime), typeof s.audio === 'string' && s.audio.length > 500, Object.keys(s).sort().join()], [1, 'ovoz', true, true, 'audio,mime,rejim'], 'serverga ovoz rejimi: ' + (s && s.mime) + ', ' + (s && s.audio && s.audio.length) + ' belgi');
  teng(await p.locator('#gap-saqlash').count(), 0, 'yozuvga avtomatik aylantirilmadi (karta yo\'q)');
  teng(await p.evaluate(() => Object.entries(localStorage).map((x) => x.join('=')).join('|').indexOf('QUJD') < 0 && JSON.stringify(Object.keys(localStorage)).indexOf('audio') < 0), true, 'audio localStorage da yo\'q');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-3-matn-tushdi.png') });

  // 2) xato: ovoz eshitilmadi (server), limit
  for (const [javob, kut] of [[{ holat: 200, tana: { ok: false, sabab: 'ovoz_yoq' } }, /^Ovoz eshitilmadi/], [{ holat: 429, tana: { xato: { kod: 'AI_LIMIT', sabab: 'x' } } }, /^Bugungi limit tugadi/], [{ holat: 413, tana: { xato: { kod: 'AI_HAJM', sabab: 'x' } } }, /^Ovoz juda uzun/]]) {
    navbat.push(javob); await mik.click(); await p.waitForFunction(() => document.getElementById('gap-mik').getAttribute('aria-pressed') === 'true'); await p.waitForTimeout(500); await mik.click();
    await p.waitForFunction(() => document.getElementById('gap-xato').textContent.length > 0);
    teng([kut.test(await p.textContent('#gap-xato')), await p.inputValue('#gap-matn')], [true, 'non oldim taksiga o\'n besh ming'], 'xato: ' + kut);
    if (kut.source.indexOf('Ovoz eshitilmadi') >= 0) await p.screenshot({ path: path.join(RASMLAR, tema + '-4-xato.png') });
  }
  // 3) tinglanmoqda holati
  navbat.push({ holat: 200, tana: { ok: true, matn: 'sut', manba: null }, kechik: 1200 });
  await mik.click(); await p.waitForFunction(() => document.getElementById('gap-mik').getAttribute('aria-pressed') === 'true'); await p.waitForTimeout(500); await mik.click();
  teng(await p.textContent('#gap-mik-holat'), 'Tinglanyapti…', 'yuklanish holati');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-5-tinglanyapti.png') });
  await p.waitForFunction(() => /sut$/.test(document.getElementById('gap-matn').value));
  // 4) mikrofon ruxsati rad etilsa
  await kontekst.clearPermissions();
  await p.evaluate(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' })); });
  await mik.click(); await p.waitForFunction(() => document.getElementById('gap-xato').textContent.indexOf('Mikrofon ruxsati') === 0);
  teng(await p.textContent('#gap-xato'), 'Mikrofon ruxsati rad etildi. Brauzer sozlamasidan ruxsat bering.', 'ruxsat rad etildi');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-6-ruxsat.png') });
  await kontekst.close();
}

(async () => {
  const brauzer = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  for (const tema of ['light', 'dark']) await senariy(brauzer, tema);
  await brauzer.close();
  console.log(jami + ' tekshiruv, xato: ' + xatolar + ' (rasmlar: ' + RASMLAR + ')');
  process.exit(xatolar ? 1 : 0);
})().catch((e) => { console.log('✗ ' + e.stack); process.exit(1); });
