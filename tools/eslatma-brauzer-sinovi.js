// Eslatmalar (TZ-sinxronlash.md 46-band) uchun brauzer sinovi: HAQIQIY ilova (index.html, haqiqiy IndexedDB), faqat UYDIRMA ma'lumot.
// Brauzerning push imkoniyatlari (Notification, PushManager, serviceWorker.ready) SOXTA, Supabase va Edge Function so'rovlari TUTIB OLINADI
// (HAQIQIY server, push xizmati va kalit ISHLATILMAYDI). Faqat ishlab chiqish vaqtida; ilovaning o'zi uni ishlatmaydi.
// Ishga tushirish: avval  python3 -m http.server 8000  (repozitoriy papkasida), keyin  node tools/eslatma-brauzer-sinovi.js [rasmlar_papkasi]
// (PLAYWRIGHT_MODULE, CHROMIUM_PATH, ILOVA_MANZIL ixtiyoriy). 360 px, yorug' va qorong'i rejim. Xato bo'lsa chiqish kodi 1.
const fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const MANZIL = process.env.ILOVA_MANZIL || 'http://localhost:8000/index.html';
const RASMLAR = process.argv[2] || path.join(os.tmpdir(), 'eslatma-rasmlar');
fs.mkdirSync(RASMLAR, { recursive: true });
let jami = 0, xatolar = 0;
function teng(h, k, izoh) { jami++; if (JSON.stringify(h) !== JSON.stringify(k)) { xatolar++; console.log('  ✗ ' + izoh + ' — kutilgan: ' + JSON.stringify(k) + ', chiqdi: ' + JSON.stringify(h)); } }
const kut = (ms) => new Promise((ok) => setTimeout(ok, ms));
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/brauzer-sinovi-1';

// Uydirma ochiq VAPID kalit: 65 bayt (haqiqiy emas, faqat shakl uchun)
function soxtaKalit() { const b = Buffer.alloc(65); b[0] = 4; for (let i = 1; i < 65; i++) b[i] = i; return b.toString('base64url'); }
const KALIT = soxtaKalit();

// Sahifa ochilishidan OLDIN o'rnatiladigan soxta brauzer imkoniyatlari
function soxtaBrauzer(c) {
  window.__izlar = { ruxsat: 0, subscribe: [], unsub: 0 };
  if (c.notification === false) {
    Object.defineProperty(window, 'Notification', { value: undefined, configurable: true, writable: true });
  } else {
    const N = function () {};
    N.permission = c.ruxsat || 'default';
    N.requestPermission = function () { window.__izlar.ruxsat++; N.permission = c.javob || 'granted'; return Promise.resolve(N.permission); };
    Object.defineProperty(window, 'Notification', { value: N, configurable: true, writable: true });
  }
  if (c.pushManager === false) { try { delete window.PushManager; } catch (e) { /* ahamiyatsiz */ } }
  let joriy = null;
  function yangiObuna() {
    const s = {
      endpoint: c.endpoint,
      options: { applicationServerKey: null },
      toJSON() { return { endpoint: c.endpoint, keys: { p256dh: 'P-sinov-kalit', auth: 'A-sinov-kalit' } }; },
      unsubscribe() { window.__izlar.unsub++; joriy = null; return Promise.resolve(true); }
    };
    return s;
  }
  const reg = { pushManager: {
    getSubscription() { return Promise.resolve(joriy); },
    subscribe(o) { window.__izlar.subscribe.push({ userVisibleOnly: o.userVisibleOnly, uzunlik: o.applicationServerKey && o.applicationServerKey.length, tur: Object.prototype.toString.call(o.applicationServerKey) }); joriy = yangiObuna(); return Promise.resolve(joriy); }
  } };
  try { Object.defineProperty(navigator.serviceWorker, 'ready', { get() { return Promise.resolve(reg); }, configurable: true }); } catch (e) { /* ahamiyatsiz */ }
  if (typeof c.standalone === 'boolean') {
    const asl = window.matchMedia.bind(window);
    window.matchMedia = function (q) { if (/display-mode:\s*standalone/.test(q)) return { matches: c.standalone, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null }; return asl(q); };
  }
}

async function yangiSahifa(brauzer, tema, c, serverJavoblari, qidiruv) {
  const kontekst = await brauzer.newContext(Object.assign({ viewport: { width: 360, height: 780 }, colorScheme: tema, serviceWorkers: 'block', timezoneId: 'Asia/Tashkent' }, c.ua ? { userAgent: c.ua } : {}));
  const p = await kontekst.newPage();
  const iz = { rest: [], funksiya: [] };
  p.on('pageerror', (e) => { if (!/IDBObjectStore/.test(e.message)) { xatolar++; console.log('  ✗ PAGEERROR ' + e.message); } });
  const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  await p.route('**/*.supabase.co/**', async (r) => {
    const so = r.request(), url = so.url(), usul = so.method();
    if (usul === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
    if (/\/functions\/v1\/bildirishnoma/.test(url)) {
      const tana = JSON.parse(so.postData() || '{}');
      iz.funksiya.push({ tana, auth: so.headers().authorization, apikey: so.headers().apikey });
      const j = serverJavoblari[tana.amal] || (tana.amal === 'kalit' ? { holat: 200, j: { ok: true, kalit: KALIT } } : { holat: 200, j: { ok: true } });
      return r.fulfill({ status: j.holat, headers: Object.assign({ 'content-type': 'application/json' }, CORS), body: JSON.stringify(j.j) });
    }
    if (/\/rest\/v1\/bildirishnoma_qurilmalari/.test(url)) {
      iz.rest.push({ usul, url, auth: so.headers().authorization, apikey: so.headers().apikey, prefer: so.headers().prefer, tana: so.postData() ? JSON.parse(so.postData()) : null });
      if (serverJavoblari.rest && serverJavoblari.rest[usul]) { const j = serverJavoblari.rest[usul]; return r.fulfill({ status: j.holat, headers: Object.assign({ 'content-type': 'application/json' }, CORS), body: JSON.stringify(j.j || {}) }); }
      return r.fulfill({ status: usul === 'DELETE' ? 204 : 201, headers: CORS, body: '' });
    }
    return r.fulfill({ status: 200, headers: Object.assign({ 'content-type': 'application/json' }, CORS), body: '[]' });
  });
  await p.addInitScript(soxtaBrauzer, Object.assign({ endpoint: ENDPOINT }, c));
  await p.goto(MANZIL + (qidiruv || ''));
  await p.waitForFunction(() => typeof Data !== 'undefined' && document.querySelector('#ekran h1'));
  if (await p.locator('#salom-davom').count()) { await p.click('#salom-davom'); await p.waitForSelector('#salom-ekran', { state: 'detached' }); }
  return { p, iz, yop: () => kontekst.close() };
}
async function kirgandek(p) {
  await p.evaluate(() => {
    const h = Kirish.holat();
    h.kirgan = true; h.id = '11111111-1111-4111-8111-111111111111'; h.email = 'sinov@example.invalid'; h.ism = 'Sinov';
    Yuklash.sozlash({ token: () => Promise.resolve('jwt-sinov') });
    Eslatma.sozla({ tokenOl: () => Promise.resolve('jwt-sinov'), tokenYangila: () => Promise.resolve('jwt-sinov-2') });
  });
}
async function eslatmalarga(p) {
  await p.click('.menyu-tugma');
  await p.waitForSelector('#mn-eslatma');
  await p.click('#mn-eslatma');
  await p.waitForSelector('#eslatma-kunlik');
  await kut(150);
}
const holat = (p) => p.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const kartaKorinadimi = !q('#eslatma-holat').hidden;
  return {
    karta: kartaKorinadimi ? q('#eslatma-holat .yozuv-nom').textContent : null,
    profilTugma: !q('#eslatma-profil').hidden,
    toggle: ['#eslatma-kunlik', '#eslatma-qarz', '#eslatma-korsatish'].map((s) => q(s).getAttribute('aria-checked')),
    toggleOchiq: ['#eslatma-kunlik', '#eslatma-qarz', '#eslatma-korsatish'].map((s) => !q(s).disabled),
    vaqt: [q('#eslatma-kunlik-vaqt').value, q('#eslatma-qarz-vaqt').value],
    vaqtOchiq: [!q('#eslatma-kunlik-vaqt').disabled, !q('#eslatma-qarz-vaqt').disabled],
    chip: ['0', '1', '3'].map((k) => q('#eslatma-kun-' + k).getAttribute('aria-pressed')),
    chipOchiq: ['0', '1', '3'].map((k) => !q('#eslatma-kun-' + k).disabled),
    sinovOchiq: !q('#eslatma-sinov').disabled,
    xato: q('#eslatma-xato').textContent, natija: q('#eslatma-natija').textContent
  };
});
const olchamlar = (p) => p.evaluate(() => {
  const bal = (s) => document.querySelector(s).getBoundingClientRect().height;
  return {
    aylanish: document.documentElement.scrollWidth <= 360,
    balandliklar: ['#eslatma-kunlik', '#eslatma-qarz', '#eslatma-korsatish', '#eslatma-kunlik-vaqt', '#eslatma-qarz-vaqt', '#eslatma-kun-0', '#eslatma-kun-1', '#eslatma-kun-3', '#eslatma-sinov'].every((s) => bal(s) >= 44),
    ariya: ['#eslatma-kunlik', '#eslatma-qarz', '#eslatma-korsatish'].every((s) => !!document.querySelector(s).getAttribute('aria-label') && document.querySelector(s).getAttribute('role') === 'switch'),
    belgilar: [...document.querySelectorAll('.eslatma-belgi')].map((b) => b.style.background.replace(/\s/g, '')),
    belgiSvg: [...document.querySelectorAll('.eslatma-belgi')].every((b) => !!b.querySelector('svg')),
    sinovSvg: !!document.querySelector('#eslatma-sinov svg')
  };
});

async function senariy(brauzer, tema) {
  console.log('== ' + tema + ' rejim, 360 px ==');
  const rasm = (p, n) => p.screenshot({ path: path.join(RASMLAR, tema + '-' + n + '.png') });

  // ---- A) Kirmagan: kartochka + Profilga o'tish, hamma boshqaruv o'chirilgan ----
  {
    const { p, yop } = await yangiSahifa(brauzer, tema, {}, {});
    // Menyu qatori
    await p.click('.menyu-tugma'); await p.waitForSelector('#mn-eslatma');
    teng(await p.evaluate(() => { const q = document.querySelector('#mn-eslatma'); return [q.querySelector('.yozuv-nom').textContent, !!q.querySelector('.yozuv-nom svg'), q.querySelector('.yozuv-izoh').textContent, q.getBoundingClientRect().height >= 44, q.closest('.menyu-sozlamalar') !== null]; }),
      ['Eslatmalar', true, 'o\'chiq ›', true, true], 'Menyu → Asosiy sozlamalar ichida "Eslatmalar" qatori (bell, izoh)');
    await p.click('#mn-eslatma'); await p.waitForSelector('#eslatma-kunlik');
    await kut(150);
    const h = await holat(p);
    teng(h.karta, 'Eslatmalar uchun Google bilan kiring', 'kirmagan: karta matni');
    teng(h.profilTugma, true, 'kirmagan: Profilga o\'tish tugmasi');
    teng(h.toggleOchiq.concat(h.vaqtOchiq, h.chipOchiq, [h.sinovOchiq]), new Array(9).fill(false), 'kirmagan: hamma boshqaruv o\'chirilgan');
    teng(h.toggle, ['false', 'false', 'true'], 'boshlang\'ich: kunlik o\'chiq, qarz o\'chiq, ism va summa YOQIQ');
    teng([h.vaqt, h.chip], [['21:00', '09:00'], ['true', 'true', 'false']], 'boshlang\'ich vaqtlar va chiplar (Muddat kuni ✓, 1 kun oldin ✓, 3 kun oldin)');
    const o = await olchamlar(p);
    teng([o.aylanish, o.balandliklar, o.ariya, o.belgiSvg, o.sinovSvg], [true, true, true, true, true], 'o\'lcham (gorizontal aylanish yo\'q, ≥ 44 px), aria, ikonlar');
    teng(o.belgilar, ['rgb(30,143,255)', 'rgb(255,82,82)'], 'ikon kataklari #1E8FFF va #FF5252');
    await rasm(p, 'A-kirmagan');
    await p.click('#eslatma-profil'); await p.waitForSelector('#eslatma-kunlik', { state: 'detached' });
    teng(await p.textContent('#ekran h1'), 'Profil va sinxronlash', 'Profilga o\'tish tugmasi Profil ekranini ochadi');
    await yop();
  }

  // ---- B) Qo'llab-quvvatlanmaydi ----
  {
    const { p, yop } = await yangiSahifa(brauzer, tema, { notification: false, pushManager: false }, {});
    await kirgandek(p); await eslatmalarga(p);
    const h = await holat(p);
    teng([h.karta, h.profilTugma], ['Bu qurilmada bildirishnoma qo\'llab-quvvatlanmaydi', false], 'qo\'llab-quvvatlanmaydi');
    teng(h.toggleOchiq.concat(h.chipOchiq, [h.sinovOchiq]), new Array(7).fill(false), 'boshqaruv o\'chirilgan');
    await rasm(p, 'B-qollanmaydi');
    await yop();
  }

  // ---- C) iPhone: ilova o'rnatilmagan (Notification/PushManager yo'q) ----
  {
    const { p, yop } = await yangiSahifa(brauzer, tema, { ua: IOS_UA, notification: false, pushManager: false, standalone: false }, {});
    await kirgandek(p); await eslatmalarga(p);
    const h = await holat(p);
    teng(h.karta, 'Bildirishnoma uchun ilovani bosh ekranga o\'rnating (Safari → Ulashish → Bosh ekranga). iOS 16.4 yoki yangisi kerak', 'iOS o\'rnatilmagan: matn');
    teng(h.sinovOchiq, false, 'iOS o\'rnatilmagan: boshqaruv o\'chiq');
    await rasm(p, 'C-ios');
    await yop();
  }
  // ---- C2) iPhone: bosh ekranga o'rnatilgan ----
  {
    const { p, yop } = await yangiSahifa(brauzer, tema, { ua: IOS_UA, standalone: true }, {});
    await kirgandek(p); await eslatmalarga(p);
    const h = await holat(p);
    teng([h.karta, h.toggleOchiq[0], h.sinovOchiq], [null, true, true], 'iOS o\'rnatilgan: kartasiz, boshqaruv yoqilgan');
    await yop();
  }

  // ---- D) Ruxsat bloklangan ----
  {
    const { p, yop } = await yangiSahifa(brauzer, tema, { ruxsat: 'denied' }, {});
    await kirgandek(p); await eslatmalarga(p);
    const h = await holat(p);
    teng(h.karta, 'Bildirishnomalar bloklangan. Brauzer sozlamalaridan saytga ruxsat bering', 'denied: matn');
    teng(h.toggleOchiq.concat([h.sinovOchiq]), [false, false, false, false], 'denied: boshqaruv o\'chiq');
    await rasm(p, 'D-denied');
    await yop();
  }

  // ---- E) Yoqish oqimi, o'zgarishlar, Sinab ko'rish, o'chirish ----
  {
    const { p, iz, yop } = await yangiSahifa(brauzer, tema, {}, {});
    await kirgandek(p);
    await eslatmalarga(p);
    let h = await holat(p);
    teng([h.karta, h.toggleOchiq, h.sinovOchiq], [null, [true, true, true], true], 'tayyor: kartasiz, boshqaruv yoqilgan');
    teng(await p.evaluate(() => window.__izlar.ruxsat), 0, 'sahifa ochilganda ruxsat SO\'RALMAGAN');
    await rasm(p, 'E1-tayyor');

    // Sinab ko'rish yoqilmagan eslatmada: yo'riqnoma, server chaqirilmaydi
    await p.click('#eslatma-sinov'); await kut(150);
    teng(await p.textContent('#eslatma-xato'), 'Avval kunlik yoki qarz eslatmasini yoqing.', 'yoqilmagan: yo\'riqnoma');
    teng(iz.funksiya.filter((x) => x.tana.amal === 'sinov').length, 0, 'yoqilmagan: sinov so\'rovi yo\'q');

    // Kunlik toggle: bosilganda ruxsat -> obuna -> server
    await p.click('#eslatma-kunlik');
    await p.waitForFunction(() => document.querySelector('#eslatma-kunlik').getAttribute('aria-checked') === 'true');
    await kut(100);
    teng(await p.evaluate(() => window.__izlar), { ruxsat: 1, subscribe: [{ userVisibleOnly: true, uzunlik: 65, tur: '[object Uint8Array]' }], unsub: 0 }, 'ruxsat 1 marta, subscribe(userVisibleOnly: true, 65 baytli kalit)');
    teng(iz.funksiya[0], { tana: { amal: 'kalit' }, auth: 'Bearer jwt-sinov', apikey: await p.evaluate(() => Kirish.OCHIQ_KALIT) }, 'kalit so\'rovi foydalanuvchi tokeni bilan');
    teng(iz.rest.length, 1, 'bitta server yozuvi');
    const r = iz.rest[0];
    teng([r.usul, decodeURIComponent(r.url.split('?')[1]), r.auth, /merge-duplicates/.test(r.prefer || '')], ['POST', 'on_conflict=user_id,endpoint', 'Bearer jwt-sinov', true], 'upsert (on_conflict=user_id,endpoint, merge-duplicates), foydalanuvchi tokeni');
    teng(r.tana, { endpoint: ENDPOINT, p256dh: 'P-sinov-kalit', auth_kaliti: 'A-sinov-kalit', tz: 'Asia/Tashkent', kunlik_yoqiq: true, kunlik_vaqt: '21:00', qarz_yoqiq: false, qarz_kunlar: [0, 1], qarz_vaqt: '09:00', korsatish: true }, 'server qatori (user_id yuborilmaydi)');
    h = await holat(p);
    teng(h.toggle, ['true', 'false', 'true'], 'kunlik yoqildi');
    teng(await p.textContent('#mn-eslatma').catch(() => 'x'), 'x', 'menyu qatori bu ekranda yo\'q');

    // Debounce: tez-tez o'zgartirish -> bitta so'rov
    iz.rest.length = 0;
    await p.fill('#eslatma-kunlik-vaqt', '07:30');
    await p.click('#eslatma-kun-3');
    await p.click('#eslatma-kun-1');
    await kut(300);
    teng(iz.rest.length, 0, '300 ms da server so\'rovi hali yo\'q (debounce)');
    h = await holat(p);
    teng([h.vaqt[0], h.chip], ['07:30', ['true', 'false', 'true']], 'qurilmada darhol saqlandi');
    await kut(600);
    teng(iz.rest.length, 1, '600 ms dan keyin faqat bitta so\'rov');
    teng([iz.rest[0].tana.kunlik_vaqt, iz.rest[0].tana.qarz_kunlar], ['07:30', [0, 3]], 'yangilangan qator');

    // Qarz toggle va ism/summa
    await p.click('#eslatma-qarz');
    await p.waitForFunction(() => document.querySelector('#eslatma-qarz').getAttribute('aria-checked') === 'true');
    await p.fill('#eslatma-qarz-vaqt', '08:45');
    await p.click('#eslatma-korsatish');
    await kut(900);
    const oxirgi = iz.rest[iz.rest.length - 1].tana;
    teng([oxirgi.qarz_yoqiq, oxirgi.qarz_vaqt, oxirgi.korsatish, oxirgi.kunlik_yoqiq], [true, '08:45', false, true], 'qarz yoqildi, vaqt 08:45, ism va summa o\'chdi');
    teng(await p.evaluate(() => window.__izlar.ruxsat), 1, 'ikkinchi toggle ruxsatni qayta so\'ramaydi');
    await rasm(p, 'E2-yoqilgan');
    const o = await olchamlar(p);
    teng([o.aylanish, o.balandliklar], [true, true], 'yoqilgan holatda ham o\'lcham to\'g\'ri');

    // Sinab ko'rish
    await p.click('#eslatma-sinov');
    await p.waitForFunction(() => document.querySelector('#eslatma-natija').textContent.length > 0);
    teng(await p.textContent('#eslatma-natija'), 'Sinov yuborildi. Bir necha soniyada bildirishnoma keladi.', 'sinov muvaffaqiyati');
    const sinovlar = iz.funksiya.filter((x) => x.tana.amal === 'sinov');
    teng(sinovlar.length, 1, 'bitta sinov so\'rovi'); teng(sinovlar[0].tana, { amal: 'sinov', endpoint: ENDPOINT }, 'sinov shu qurilma endpointi bilan');
    teng(sinovlar[0].auth, 'Bearer jwt-sinov', 'sinov foydalanuvchi tokeni bilan');
    await rasm(p, 'E3-sinov');

    // O'chirish: avval bittasi, so'ng ikkinchisi -> obuna ham o'chadi
    iz.rest.length = 0;
    await p.click('#eslatma-kunlik'); await kut(900);
    teng([iz.rest.length, iz.rest[0] && iz.rest[0].usul], [1, 'POST'], 'bittasi o\'chsa obuna qoladi (qator yangilanadi)');
    iz.rest.length = 0;
    await p.click('#eslatma-qarz'); await kut(900);
    teng(iz.rest.map((x) => x.usul), ['DELETE'], 'ikkalasi o\'chsa server qatori o\'chadi');
    teng(decodeURIComponent(iz.rest[0].url.split('?')[1]), 'endpoint=eq.' + ENDPOINT, 'o\'chirish shu qurilma endpointi bo\'yicha');
    teng(await p.evaluate(() => window.__izlar.unsub), 1, 'brauzer obunasi bekor qilindi (unsubscribe)');
    h = await holat(p);
    teng(h.toggle.slice(0, 2), ['false', 'false'], 'toggle\'lar o\'chiq');
    await yop();
  }

  // ---- F) Xatolar: ruxsat rad etildi, server xatosi, sinov 429 / 410, kalit sozlanmagan ----
  {
    const { p, yop } = await yangiSahifa(brauzer, tema, { javob: 'denied' }, {});
    await kirgandek(p); await eslatmalarga(p);
    await p.click('#eslatma-qarz'); await kut(300);
    let h = await holat(p);
    teng(h.xato, 'Bildirishnoma ruxsati berilmadi.\n(kod: PUSH_RUXSAT)', 'ruxsat rad etildi: matn va kod');
    teng(h.toggle[1], 'false', 'toggle yoqilmadi');
    teng(h.karta, 'Bildirishnomalar bloklangan. Brauzer sozlamalaridan saytga ruxsat bering', 'rad etilgach ekran "bloklangan"ga o\'tdi');
    await rasm(p, 'F1-ruxsat-rad');
    await yop();
  }
  {
    const { p, iz, yop } = await yangiSahifa(brauzer, tema, {}, { rest: { POST: { holat: 500, j: { message: 'xato' } } } });
    await kirgandek(p); await eslatmalarga(p);
    await p.click('#eslatma-kunlik'); await kut(500);
    const h = await holat(p);
    teng(h.xato, 'Sozlamani serverga yozib bo\'lmadi.\n(kod: PUSH_SERVER)', 'server xatosi: matn va kod');
    teng(h.toggle[0], 'false', 'server yozmadi: toggle yoqilmadi');
    teng(await p.evaluate(() => window.__izlar.unsub), 1, 'serverga yozilmagan obuna qaytarib olindi');
    teng(iz.rest.length > 0, true);
    await rasm(p, 'F2-server-xato');
    await yop();
  }
  {
    const { p, yop } = await yangiSahifa(brauzer, tema, {}, { kalit: { holat: 503, j: { xato: { kod: 'SOZLANMAGAN' } } } });
    await kirgandek(p); await eslatmalarga(p);
    await p.click('#eslatma-kunlik'); await kut(400);
    const h = await holat(p);
    teng(h.xato, 'Server bildirishnoma uchun hali sozlanmagan.\n(kod: SOZLANMAGAN)', 'VAPID sozlanmagan: matn va kod');
    teng(h.toggle[0], 'false', 'sozlanmagan: toggle yoqilmadi');
    await yop();
  }
  {
    const jav = {};
    const { p, iz, yop } = await yangiSahifa(brauzer, tema, {}, jav);
    await kirgandek(p); await eslatmalarga(p);
    await p.click('#eslatma-kunlik'); await p.waitForFunction(() => document.querySelector('#eslatma-kunlik').getAttribute('aria-checked') === 'true');
    jav.sinov = { holat: 429, j: { xato: { kod: 'PUSH_TEZ' } } };
    await p.click('#eslatma-sinov'); await kut(400);
    teng((await holat(p)).xato, 'Sinov juda tez-tez. Bir oz kutib, qayta urinib ko\'ring.\n(kod: PUSH_TEZ)', 'sinov 429');
    await rasm(p, 'F3-sinov-tez');
    jav.sinov = { holat: 410, j: { xato: { kod: 'PUSH_ESKIRGAN' } } };
    await p.click('#eslatma-sinov'); await kut(500);
    const h = await holat(p);
    teng(h.xato, 'Obuna eskirgan, qayta yoqing.\n(kod: PUSH_ESKIRGAN)', 'sinov 410: matn');
    teng(h.toggle.slice(0, 2), ['false', 'false'], '410: toggle\'lar o\'chdi (qayta yoqiladi)');
    teng(await p.evaluate(() => window.__izlar.unsub), 1, '410: brauzer obunasi tozalandi');
    await yop();
  }

  // ---- G) Chiqishda shu qurilmaning serverdagi qatori o'chadi ----
  {
    const { p, iz, yop } = await yangiSahifa(brauzer, tema, {}, {});
    await kirgandek(p); await eslatmalarga(p);
    await p.click('#eslatma-kunlik'); await p.waitForFunction(() => document.querySelector('#eslatma-kunlik').getAttribute('aria-checked') === 'true');
    iz.rest.length = 0;
    // Profil -> Chiqish
    await p.click('.orqaga-tugma'); await p.waitForSelector('#mn-profil'); await p.click('#mn-profil'); await p.waitForSelector('#chiqish');
    await p.click('#chiqish');
    await p.waitForFunction(() => !Kirish.holat().kirgan);
    await kut(400);
    teng(iz.rest.map((x) => x.usul + ' ' + decodeURIComponent(x.url.split('?')[1] || '')), ['DELETE endpoint=eq.' + ENDPOINT], 'chiqishda server qatori o\'chirildi');
    teng(await p.evaluate(() => [window.__izlar.unsub, Eslatma.sozlama().kunlikYoqiq, Eslatma.sozlama().egasi]), [1, false, ''], 'chiqqach brauzer obunasi bekor, eslatmalar o\'chiq');
    await yop();
  }
  // ---- G2) Chiqishda internet yo'q: chiqish to'xtamaydi, qoldiq keyinroq tozalanadi ----
  {
    const { p, iz, yop } = await yangiSahifa(brauzer, tema, {}, { rest: { DELETE: { holat: 500, j: { message: 'xato' } } } });
    await kirgandek(p); await eslatmalarga(p);
    await p.click('#eslatma-kunlik'); await p.waitForFunction(() => document.querySelector('#eslatma-kunlik').getAttribute('aria-checked') === 'true');
    await p.click('.orqaga-tugma'); await p.waitForSelector('#mn-profil'); await p.click('#mn-profil'); await p.waitForSelector('#chiqish');
    await p.click('#chiqish');
    await p.waitForFunction(() => !Kirish.holat().kirgan, null, { timeout: 8000 });
    teng(await p.evaluate(() => JSON.parse(localStorage.getItem('moliya-eslatma-qolgan') || '[]')), [ENDPOINT], 'o\'chirib bo\'lmadi: manzil keyingi kirishda tozalash uchun eslab qolindi');
    teng(await p.evaluate(() => window.__izlar.unsub), 1, 'baribir brauzer obunasi bekor qilindi');
    await yop();
  }

  // ---- H) Bildirishnomadan kelgan yo'nalish (TZ 47): ?yangi=1 va ?qarzlar=1 ----
  const manzilQismi = (p) => p.evaluate(() => location.search);
  {
    const { p, yop } = await yangiSahifa(brauzer, tema, {}, {}, '?yangi=1');
    await p.waitForSelector('#yy-tranzaksiya', { timeout: 5000 });
    teng(await manzilQismi(p), '', '?yangi=1: parametr manzildan olib tashlandi');
    teng(await p.evaluate(() => !!document.querySelector('#yy-qarz')), true, '?yangi=1: yozuv qo\'shish oynasi ("+" tugmasi bilan bir xil) ochildi');
    await rasm(p, 'H1-yangi');
    await p.reload(); await p.waitForFunction(() => document.querySelector('#ekran h1'));
    if (await p.locator('#salom-davom').count()) { await p.click('#salom-davom'); await p.waitForSelector('#salom-ekran', { state: 'detached' }); }
    await kut(300);
    teng(await p.evaluate(() => !!document.querySelector('#yy-tranzaksiya')), false, 'qayta yuklaganda oyna takrorlanmadi');
    await yop();
  }
  {
    const { p, yop } = await yangiSahifa(brauzer, tema, {}, {}, '?qarzlar=1');
    await p.waitForSelector('[data-bolim="qarzlar"].faol', { timeout: 5000 });
    teng(await manzilQismi(p), '', '?qarzlar=1: parametr olib tashlandi');
    teng(await p.evaluate(() => [!!document.querySelector('.qarz-tanlov'), document.querySelector('#yy-tranzaksiya') === null]), [true, true], '?qarzlar=1: Qarzlar bo\'limi ochildi, yozuv oynasi yo\'q');
    await rasm(p, 'H2-qarzlar');
    await p.reload(); await p.waitForFunction(() => document.querySelector('#ekran h1'));
    await yop();
  }
  // PIN yoqiq: avval PIN so'raladi, keyin yo'naltiriladi; parametr PIN ochilguncha manzilda turadi
  {
    const { p, yop } = await yangiSahifa(brauzer, tema, {}, {});
    await p.click('.menyu-tugma'); await p.click('#mn-xavfsizlik'); await p.click('#pin-almashtirgich');
    const yoz = async (pin) => { for (const r of pin) await p.click('#pin-tugmalar .pin-raqam[aria-label="' + r + '"]'); await kut(250); };
    await p.waitForSelector('#pin-ekran'); await yoz('1234'); await yoz('1234');
    await p.waitForSelector('#pin-ekran', { state: 'detached', timeout: 5000 });
    teng(await p.evaluate(() => Pin.yoqilgan()), true, 'PIN yoqildi');
    await p.goto(MANZIL + '?yangi=1');
    await p.waitForSelector('#pin-ekran');
    teng(await p.evaluate(() => [location.search, !!document.querySelector('#yy-tranzaksiya')]), ['?yangi=1', false], 'PIN so\'ralmoqda: oyna hali ochilmagan, parametr manzilda');
    await rasm(p, 'H3-pin');
    await yoz('1234');
    await p.waitForSelector('#yy-tranzaksiya', { timeout: 5000 });
    teng(await manzilQismi(p), '', 'PIN ochilgach yozuv oynasi ochildi va parametr olib tashlandi');
    await p.goto(MANZIL + '?qarzlar=1'); await p.waitForSelector('#pin-ekran'); await yoz('1234');
    await p.waitForSelector('[data-bolim="qarzlar"].faol', { timeout: 5000 });
    teng(await manzilQismi(p), '', 'PIN bilan ?qarzlar=1');
    await yop();
  }
}

(async () => {
  const brauzer = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    for (const tema of ['light', 'dark']) await senariy(brauzer, tema);
  } finally { await brauzer.close(); }
  console.log('\nJami tekshiruv: ' + jami + ', xato: ' + xatolar + '. Rasmlar: ' + RASMLAR);
  process.exit(xatolar ? 1 : 0);
})();
