// Bildirishnoma (Edge Function) sinovi. Ishga tushirish:  node --test supabase/functions/bildirishnoma/test.mjs
// Node 22.18+ kerak (TypeScript faylni to'g'ridan-to'g'ri o'qiydi). HAQIQIY push xizmati, Supabase va kalit ISHLATILMAYDI:
// push xizmati va Supabase jadvali taqlid qilinadi, VAPID juftligi va qurilma kalitlari har safar sinovning o'zida yasaladi.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as M from './index.ts';

const BU = dirname(fileURLToPath(import.meta.url));
const MANBA = readFileSync(join(BU, 'index.ts'), 'utf8');
const subtle = globalThis.crypto.subtle;

// ---------- sinov kalitlari (har safar yangi, hech qayerga yozilmaydi) ----------
async function vapidJuftligi() {
  const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await subtle.exportKey('jwk', kp.privateKey);
  return { ochiq: M.b64uKodla(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))), maxfiy: jwk.d, publicKey: kp.publicKey };
}
async function qurilmaJuftligi() {
  const kp = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return { kp, p256dh: M.b64uKodla(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))), auth: M.b64uKodla(auth), authBayt: auth };
}

// ---------- mustaqil deshifrlash (RFC 8188/8291, qabul qiluvchi tomoni) — shifrlash kodidan alohida yozilgan ----------
async function hkdfSinov(ikm, salt, info, uzunlik) {
  // HKDF-Extract + Expand qo'lda (HMAC bilan), WebCrypto HKDF ga tayanmaslik uchun
  const hmac = async (kalit, xabar) => {
    const k = await subtle.importKey('raw', kalit, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return new Uint8Array(await subtle.sign('HMAC', k, xabar));
  };
  const prk = await hmac(salt, ikm);
  let t = new Uint8Array(0), chiqish = new Uint8Array(0);
  for (let i = 1; chiqish.length < uzunlik; i++) {
    t = await hmac(prk, Uint8Array.from([...t, ...info, i]));
    chiqish = Uint8Array.from([...chiqish, ...t]);
  }
  return chiqish.slice(0, uzunlik);
}
async function deshifrla(tana, uaPrivate, uaOchiq, authSir) {
  const tuz = tana.slice(0, 16), rs = new DataView(tana.buffer, tana.byteOffset + 16, 4).getUint32(0), idlen = tana[20];
  const asOchiq = tana.slice(21, 21 + idlen), shifr = tana.slice(21 + idlen);
  assert.equal(rs, 4096); assert.equal(idlen, 65); assert.equal(asOchiq[0], 4);
  const asKalit = await subtle.importKey('raw', asOchiq, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: asKalit }, uaPrivate, 256));
  const enc = (s) => new TextEncoder().encode(s);
  const ikm = await hkdfSinov(ecdh, authSir, Uint8Array.from([...enc('WebPush: info\0'), ...uaOchiq, ...asOchiq]), 32);
  const cek = await hkdfSinov(ikm, tuz, enc('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdfSinov(ikm, tuz, enc('Content-Encoding: nonce\0'), 12);
  const k = await subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const ochiq = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: nonce }, k, shifr));
  assert.equal(ochiq[ochiq.length - 1], 2, 'oxirgi yozuv belgisi');
  return ochiq.slice(0, -1);
}

// ---------- taqlid server: Supabase (auth + jadval) va push xizmati ----------
const BOSHQA_JWT = 'jwt-boshqa';
function muhitYasa(vapid, ustiga = {}) {
  const m = { SUPABASE_URL: 'https://x.invalid', SUPABASE_ANON_KEY: 'anon-sinov', VAPID_PUBLIC_KEY: vapid.ochiq, VAPID_PRIVATE_KEY: vapid.maxfiy, VAPID_SUBJECT: 'mailto:sinov@example.invalid', ...ustiga };
  return { get: (n) => m[n] };
}
// holat: { qatorlar:[{id,user,...}], pushHolat, push:[{endpoint,headers,body}], chaqiruvlar:[{url,method,auth}] , jwtlar:{jwt:userId} }
function server(holat) {
  holat.qatorlar = holat.qatorlar || []; holat.push = []; holat.chaqiruvlar = [];
  holat.jwtlar = holat.jwtlar || { 'jwt-a': 'user-a', [BOSHQA_JWT]: 'user-b' };
  const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
  return async (url, init = {}) => {
    const u = new URL(url), h = new Headers(init.headers), method = init.method || 'GET';
    if (u.hostname !== 'x.invalid') {   // push xizmati
      holat.push.push({ endpoint: url, headers: h, body: new Uint8Array(await new Response(init.body).arrayBuffer()) });
      if (holat.pushTarmoq) throw new Error('tarmoq yo\'q');
      return new Response(null, { status: holat.pushHolat || 201 });
    }
    const jwt = (h.get('Authorization') || '').replace(/^Bearer /, '');
    holat.chaqiruvlar.push({ url: u.pathname, method, auth: h.get('Authorization'), apikey: h.get('apikey') });
    const kim = holat.jwtlar[jwt];
    if (u.pathname === '/auth/v1/user') return kim ? J({ id: kim, email: 'x@example.invalid' }) : J({ msg: 'yo\'q' }, 401);
    if (u.pathname === '/rest/v1/bildirishnoma_qurilmalari') {
      if (holat.jadvalYoq) return J({ code: 'PGRST205' }, 404);
      if (!kim) return J({ message: 'JWT' }, 401);
      const p = u.searchParams;
      let q = holat.qatorlar.filter((r) => r.user === kim);   // RLS: faqat o'z qatorlari
      if (p.get('endpoint')) q = q.filter((r) => 'eq.' + r.endpoint === p.get('endpoint'));
      if (p.get('id')) q = q.filter((r) => 'eq.' + r.id === p.get('id'));
      const or = p.get('or');
      if (or) { const m = /^\(oxirgi_sinov\.is\.null,oxirgi_sinov\.lt\.(.+)\)$/.exec(or); q = q.filter((r) => !r.oxirgi_sinov || r.oxirgi_sinov < m[1]); }
      if (method === 'GET') return J(q.slice(0, +(p.get('limit') || 1000)));
      if (method === 'PATCH') { const t = JSON.parse(init.body); q.forEach((r) => Object.assign(r, t)); return J(q.map((r) => ({ id: r.id }))); }
      if (method === 'DELETE') { holat.qatorlar = holat.qatorlar.filter((r) => q.indexOf(r) < 0); return J(q.map((r) => ({ id: r.id }))); }
    }
    throw new Error('Kutilmagan manzil: ' + url);
  };
}
async function muhit0(ustiga = {}) {
  const vapid = await vapidJuftligi(), qurilma = await qurilmaJuftligi();
  const endpoint = 'https://fcm.googleapis.com/fcm/send/sinov-' + Math.random().toString(36).slice(2);
  const holat = { qatorlar: [{ id: 'r-1', user: 'user-a', endpoint, p256dh: qurilma.p256dh, auth_kaliti: qurilma.auth, oxirgi_sinov: null }], ...ustiga };
  return { vapid, qurilma, endpoint, holat, fetch: server(holat) };
}
function so(tana, { jwt = 'jwt-a', origin = null, method = 'POST' } = {}) {
  const h = { 'Content-Type': 'application/json' };
  if (jwt) h.Authorization = 'Bearer ' + jwt;
  if (origin) h.Origin = origin;
  return new Request('https://f.invalid/bildirishnoma', { method, headers: h, body: method === 'POST' ? (typeof tana === 'string' ? tana : JSON.stringify(tana)) : undefined });
}
async function chaqir(m, tana, opt = {}, env = {}, hozir = () => 1_800_000_000_000) {
  const r = await M.ishlov(so(tana, opt), muhitYasa(m.vapid, env), m.fetch, hozir);
  return { r, j: r.status === 204 ? null : await r.json() };
}
function logYigish() {
  const asl = console.error, yozilgan = [];
  console.error = (...a) => { yozilgan.push(a.map(String).join(' ')); };
  return { yozilgan, tugat: () => { console.error = asl; } };
}

// ---------------- "kalit" ----------------
test('kalit: ochiq VAPID kaliti qaytadi (maxfiy kalit emas)', async () => {
  const m = await muhit0();
  const { r, j } = await chaqir(m, { amal: 'kalit' });
  assert.equal(r.status, 200); assert.equal(j.ok, true); assert.equal(j.kalit, m.vapid.ochiq);
  assert.equal(M.b64uOch(j.kalit).length, 65);
  assert.ok(!JSON.stringify(j).includes(m.vapid.maxfiy));
  assert.equal(r.headers.get('Cache-Control'), 'no-store');
});
test('kalit: JWT\'siz so\'rov rad etiladi (401 NOT_SIGNED_IN), serverga murojaat ham bo\'lmaydi', async () => {
  const m = await muhit0();
  const { r, j } = await chaqir(m, { amal: 'kalit' }, { jwt: null });
  assert.equal(r.status, 401); assert.equal(j.xato.kod, 'NOT_SIGNED_IN'); assert.equal(m.holat.chaqiruvlar.length, 0);
});
test('kalit: haqiqiy foydalanuvchi bo\'lmagan token (masalan anon kalit) rad etiladi', async () => {
  const m = await muhit0();
  const { r, j } = await chaqir(m, { amal: 'kalit' }, { jwt: 'anon-sinov' });
  assert.equal(r.status, 401); assert.equal(j.xato.kod, 'NOT_SIGNED_IN');
});
test('sinov: JWT\'siz va haqiqiy bo\'lmagan token bilan rad etiladi, push yuborilmaydi', async () => {
  const m = await muhit0();
  for (const jwt of [null, 'anon-sinov', 'yaroqsiz']) {
    const { r, j } = await chaqir(m, { amal: 'sinov', endpoint: m.endpoint }, { jwt });
    assert.equal(r.status, 401); assert.equal(j.xato.kod, 'NOT_SIGNED_IN');
  }
  assert.equal(m.holat.push.length, 0);
});
test('sozlanmagan: VAPID secretlari yo\'q yoki noto\'g\'ri bo\'lsa 503 SOZLANMAGAN', async () => {
  const m = await muhit0();
  for (const env of [{ VAPID_PUBLIC_KEY: '' }, { VAPID_SUBJECT: 'sinov' }, { VAPID_PUBLIC_KEY: 'AAAA' }]) {
    const { r, j } = await chaqir(m, { amal: 'kalit' }, {}, env);
    assert.equal(r.status, 503); assert.equal(j.xato.kod, 'SOZLANMAGAN');
  }
  const { r, j } = await chaqir(m, { amal: 'sinov', endpoint: m.endpoint }, {}, { VAPID_PRIVATE_KEY: 'qisqa' });
  assert.equal(r.status, 503); assert.equal(j.xato.kod, 'SOZLANMAGAN'); assert.equal(m.holat.push.length, 0);
});

// ---------------- "sinov" ----------------
test('sinov: muvaffaqiyat — push xizmatiga to\'g\'ri sarlavha va deshifrlanadigan xabar boradi', async () => {
  const m = await muhit0();
  const { r, j } = await chaqir(m, { amal: 'sinov', endpoint: m.endpoint });
  assert.equal(r.status, 200); assert.deepEqual(j, { ok: true });
  assert.equal(m.holat.push.length, 1);
  const p = m.holat.push[0];
  assert.equal(p.endpoint, m.endpoint);
  assert.equal(p.headers.get('Content-Encoding'), 'aes128gcm'); assert.equal(p.headers.get('TTL'), '60');
  const bosh = p.headers.get('Authorization'); const mm = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/.exec(bosh);
  assert.ok(mm, 'vapid sarlavhasi shakli'); assert.equal(mm[4], m.vapid.ochiq);
  // VAPID JWT imzosi ochiq kalit bilan tekshiriladi
  const imzoOk = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, m.vapid.publicKey, M.b64uOch(mm[3]), new TextEncoder().encode(mm[1] + '.' + mm[2]));
  assert.equal(imzoOk, true, 'ES256 imzosi to\'g\'ri');
  assert.deepEqual(JSON.parse(new TextDecoder().decode(M.b64uOch(mm[1]))), { typ: 'JWT', alg: 'ES256' });
  const da = JSON.parse(new TextDecoder().decode(M.b64uOch(mm[2])));
  assert.equal(da.aud, 'https://fcm.googleapis.com'); assert.equal(da.sub, 'mailto:sinov@example.invalid');
  assert.ok(da.exp > 1_800_000_000 && da.exp - 1_800_000_000 <= 24 * 3600, 'exp 24 soatdan oshmaydi');
  // Xabar
  const ochiq = JSON.parse(new TextDecoder().decode(await deshifrla(p.body, m.qurilma.kp.privateKey, M.b64uOch(m.qurilma.p256dh), m.qurilma.authBayt)));
  assert.deepEqual(ochiq, { title: 'Eslatmalar ishlayapti', body: 'Bu sinov bildirishnomasi.', tag: 'sinov', data: { url: 'https://jahon-gir.github.io/moliya-bulut/' } });
  assert.ok(m.holat.qatorlar[0].oxirgi_sinov, 'oxirgi_sinov yozildi');
});
test('sinov: jadvalga faqat foydalanuvchining o\'z JWT\'si bilan murojaat qilinadi (service_role yo\'q)', async () => {
  const m = await muhit0();
  await chaqir(m, { amal: 'sinov', endpoint: m.endpoint });
  const jadval = m.holat.chaqiruvlar.filter((c) => c.url.startsWith('/rest/v1/'));
  assert.ok(jadval.length >= 2);
  jadval.forEach((c) => { assert.equal(c.auth, 'Bearer jwt-a'); assert.equal(c.apikey, 'anon-sinov'); });
  assert.ok(!/service_role|SERVICE_ROLE/i.test(MANBA.replace(/\/\/[^\n]*/g, '')), 'kodda service_role yo\'q');
});
test('sinov: tezlik chegarasi — 30 soniyadan oldin takror 429 (push yuborilmaydi), keyin yana ishlaydi', async () => {
  const m = await muhit0();
  let t = 1_800_000_000_000;
  let { r, j } = await chaqir(m, { amal: 'sinov', endpoint: m.endpoint }, {}, {}, () => t);
  assert.equal(r.status, 200);
  t += 29_000;
  ({ r, j } = await chaqir(m, { amal: 'sinov', endpoint: m.endpoint }, {}, {}, () => t));
  assert.equal(r.status, 429); assert.equal(j.xato.kod, 'PUSH_TEZ'); assert.equal(m.holat.push.length, 1);
  t += 2_000;   // jami 31 soniya
  ({ r, j } = await chaqir(m, { amal: 'sinov', endpoint: m.endpoint }, {}, {}, () => t));
  assert.equal(r.status, 200); assert.equal(m.holat.push.length, 2);
});
test('sinov: 410 (va 404) da obuna qatori o\'chiriladi va "Obuna eskirgan, qayta yoqing" qaytadi', async () => {
  for (const kod of [410, 404]) {
    const m = await muhit0({ pushHolat: kod });
    const { r, j } = await chaqir(m, { amal: 'sinov', endpoint: m.endpoint });
    assert.equal(r.status, 410); assert.equal(j.xato.kod, 'PUSH_ESKIRGAN'); assert.equal(j.xato.sabab, 'Obuna eskirgan, qayta yoqing.');
    assert.equal(m.holat.qatorlar.length, 0, kod + ': qator o\'chdi');
  }
});
test('sinov: push xizmati boshqa xato (500) yoki tarmoq xatosi bersa 502, qator saqlanadi', async () => {
  let m = await muhit0({ pushHolat: 500 });
  let { r, j } = await chaqir(m, { amal: 'sinov', endpoint: m.endpoint });
  assert.equal(r.status, 502); assert.equal(j.xato.kod, 'PUSH_XIZMAT'); assert.equal(j.xato.debug, 'push_500'); assert.equal(m.holat.qatorlar.length, 1);
  m = await muhit0({ pushTarmoq: true });
  ({ r, j } = await chaqir(m, { amal: 'sinov', endpoint: m.endpoint }));
  assert.equal(r.status, 502); assert.equal(j.xato.debug, 'push_tarmoq'); assert.equal(m.holat.qatorlar.length, 1);
});
test('sinov: qurilma yozilmagan bo\'lsa 404 PUSH_YOQ; boshqa foydalanuvchining obunasiga yuborib bo\'lmaydi (RLS)', async () => {
  const m = await muhit0();
  let { r, j } = await chaqir(m, { amal: 'sinov', endpoint: 'https://fcm.googleapis.com/fcm/send/yoq' });
  assert.equal(r.status, 404); assert.equal(j.xato.kod, 'PUSH_YOQ');
  ({ r, j } = await chaqir(m, { amal: 'sinov', endpoint: m.endpoint }, { jwt: BOSHQA_JWT }));
  assert.equal(r.status, 404); assert.equal(j.xato.kod, 'PUSH_YOQ'); assert.equal(m.holat.push.length, 0);
});
test('sinov: noma\'lum push xizmati manziliga so\'rov YUBORILMAYDI (SSRF himoyasi)', async () => {
  const m = await muhit0();
  for (const yomon of ['https://169.254.169.254/latest', 'http://fcm.googleapis.com/fcm/send/x', 'https://evil.example.invalid/fcm.googleapis.com', 'https://fcm.googleapis.com.evil.invalid/x', 'https://user@fcm.googleapis.com/x']) {
    m.holat.qatorlar = [{ id: 'r-9', user: 'user-a', endpoint: yomon, p256dh: m.qurilma.p256dh, auth_kaliti: m.qurilma.auth, oxirgi_sinov: null }];
    const { r, j } = await chaqir(m, { amal: 'sinov', endpoint: yomon });
    assert.equal(r.status, 400, yomon); assert.equal(j.xato.kod, 'PUSH_OBUNA');
  }
  assert.equal(m.holat.push.length, 0);
});
test('sinov: buzuq p256dh/auth bo\'lsa 400 PUSH_OBUNA (xato tashlanmaydi)', async () => {
  const m = await muhit0();
  m.holat.qatorlar[0].p256dh = 'qisqa';
  const { r, j } = await chaqir(m, { amal: 'sinov', endpoint: m.endpoint });
  assert.equal(r.status, 400); assert.equal(j.xato.kod, 'PUSH_OBUNA'); assert.equal(m.holat.push.length, 0);
});
test('sinov: jadval yo\'q (013 ishga tushirilmagan) — 503 SOZLANMAGAN', async () => {
  const m = await muhit0({ jadvalYoq: true });
  const { r, j } = await chaqir(m, { amal: 'sinov', endpoint: m.endpoint });
  assert.equal(r.status, 503); assert.equal(j.xato.kod, 'SOZLANMAGAN'); assert.equal(j.xato.debug, 'jadval_yoq');
});

// ---------------- kirish tekshiruvi, CORS ----------------
test('noto\'g\'ri so\'rovlar: bo\'sh/buzuq JSON, noma\'lum amal, endpointsiz sinov, GET — rad etiladi', async () => {
  const m = await muhit0();
  for (const tana of ['', '{buzuq', '[]', '"x"', { amal: 'boshqa' }, {}, { amal: 'sinov' }, { amal: 'sinov', endpoint: 5 }, { amal: 'sinov', endpoint: 'https://' + 'a'.repeat(3000) }]) {
    const { r, j } = await chaqir(m, tana);
    assert.ok(r.status === 400 || r.status === 413, JSON.stringify(tana).slice(0, 30) + ' -> ' + r.status); assert.equal(j.xato.kod, 'PUSH_KIRISH');
  }
  const g = await M.ishlov(so(null, { method: 'GET' }), muhitYasa(m.vapid), m.fetch);
  assert.equal(g.status, 405);
});
test('CORS: faqat ilova manzillariga ruxsat; OPTIONS 204', async () => {
  const m = await muhit0();
  let r = await M.ishlov(so(null, { method: 'OPTIONS', origin: 'https://jahon-gir.github.io', jwt: null }), muhitYasa(m.vapid), m.fetch);
  assert.equal(r.status, 204); assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'https://jahon-gir.github.io');
  r = await M.ishlov(so(null, { method: 'OPTIONS', origin: 'https://boshqa.example.invalid', jwt: null }), muhitYasa(m.vapid), m.fetch);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), null);
});

// ---------------- maxfiylik ----------------
test('log: kalit, endpoint, p256dh va auth_kaliti LOGGA YOZILMAYDI (faqat holat kodlari)', async () => {
  const L = logYigish();
  try {
    for (const holat of [201, 410, 500]) {
      const m = await muhit0({ pushHolat: holat });
      await chaqir(m, { amal: 'sinov', endpoint: m.endpoint });
      const hammasi = L.yozilgan.join('\n');
      for (const sir of [m.endpoint, m.qurilma.p256dh, m.qurilma.auth, m.vapid.maxfiy, m.vapid.ochiq, 'jwt-a']) assert.ok(!hammasi.includes(sir), 'logda sir bor');
    }
    // sozlanmagan holat ham
    const m = await muhit0();
    await chaqir(m, { amal: 'sinov', endpoint: m.endpoint }, {}, { VAPID_PRIVATE_KEY: 'x' });
    assert.ok(L.yozilgan.every((s) => /^bildirishnoma: [a-z0-9_]+ ?\d*$/.test(s)), 'har log qatori: "bildirishnoma: <kod> [holat]"');
  } finally { L.tugat(); }
  assert.ok(!/console\.(log|info|debug)/.test(MANBA), 'console.log yo\'q');
});
test('xato javoblarida sir yo\'q: javob tanasida endpoint, kalit yoki token ko\'rinmaydi', async () => {
  const m = await muhit0({ pushHolat: 500 });
  const { j } = await chaqir(m, { amal: 'sinov', endpoint: m.endpoint });
  const matn = JSON.stringify(j);
  for (const sir of [m.endpoint, m.qurilma.p256dh, m.qurilma.auth, m.vapid.maxfiy]) assert.ok(!matn.includes(sir));
});

// ---------------- shifrlash va yordamchilar ----------------
test('shifrlash: RFC 8291 3-ilova misoli (aniq baytlar) bilan mos keladi', async () => {
  const b = (s) => M.b64uOch(s);
  const asPriv = b('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw'), asPub = b('BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8');
  const uaPub = b('BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4'), auth = b('BTBZMqHH6r4Tts7J_aSIgg'), tuz = b('DGv6ra1nlYgDCS1FRnbzlw');
  const jwk = { kty: 'EC', crv: 'P-256', d: M.b64uKodla(asPriv), x: M.b64uKodla(asPub.slice(1, 33)), y: M.b64uKodla(asPub.slice(33)), ext: true };
  const asKalit = { privateKey: await subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']), publicKey: await subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, true, []) };
  const natija = await M.shifrla(new TextEncoder().encode('When I grow up, I want to be a watermelon'), uaPub, auth, { tuz, asKalit });
  assert.equal(M.b64uKodla(natija), 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN');
});
test('shifrlash: tasodifiy kalit/tuz bilan har safar boshqa natija, lekin qabul qiluvchi deshifrlaydi; uzun xabar rad etiladi', async () => {
  const q = await qurilmaJuftligi();
  const yuk = new TextEncoder().encode('Salom, bu sinov: ʻ ʼ so\'m 1 250 000');
  const a = await M.shifrla(yuk, M.b64uOch(q.p256dh), q.authBayt), b = await M.shifrla(yuk, M.b64uOch(q.p256dh), q.authBayt);
  assert.notEqual(M.b64uKodla(a), M.b64uKodla(b));
  assert.deepEqual(await deshifrla(a, q.kp.privateKey, M.b64uOch(q.p256dh), q.authBayt), yuk);
  await assert.rejects(() => M.shifrla(new Uint8Array(4000), M.b64uOch(q.p256dh), q.authBayt));
  await assert.rejects(() => M.shifrla(yuk, new Uint8Array(64), q.authBayt));
  await assert.rejects(() => M.shifrla(yuk, M.b64uOch(q.p256dh), new Uint8Array(15)));
});
test('endpointYaroqlimi: faqat https va ma\'lum push xizmatlari', () => {
  for (const ok of ['https://fcm.googleapis.com/fcm/send/abc', 'https://updates.push.services.mozilla.com/wpush/v2/abc', 'https://web.push.apple.com/abc', 'https://wns2-par02p.notify.windows.com/w/?token=abc'])
    assert.equal(M.endpointYaroqlimi(ok), true, ok);
  for (const yomon of ['', 5, null, 'http://fcm.googleapis.com/x', 'https://example.invalid/x', 'https://fcm.googleapis.com.evil.invalid/x', 'https://evilfcm.googleapis.com.evil/x', 'https://notfcm.googleapis.com.x/', 'https://fcm.googleapis.com:8443/x', 'https://u:p@fcm.googleapis.com/x', 'not a url', 'https://fcm.googleapis.com/' + 'a'.repeat(2100)])
    assert.equal(M.endpointYaroqlimi(yomon), false, String(yomon));
});
test('base64url: aylanib to\'g\'ri qaytadi, noto\'g\'ri belgilar rad etiladi', () => {
  const x = crypto.getRandomValues(new Uint8Array(65));
  assert.deepEqual(M.b64uOch(M.b64uKodla(x)), x);
  assert.equal(M.b64uKodla(new Uint8Array([251, 255, 254])), '-__-');
  assert.throws(() => M.b64uOch('ab+/'));
  assert.throws(() => M.b64uOch('a b'));
});
test('fayl: bitta fayl, tashqi paket va boshqa fayldan import yo\'q', () => {
  assert.ok(!/^\s*import\s/m.test(MANBA), 'import yo\'q');
  assert.ok(!/npm:|jsr:|esm\.sh|deno\.land/.test(MANBA), 'tashqi paket yo\'q');
});
