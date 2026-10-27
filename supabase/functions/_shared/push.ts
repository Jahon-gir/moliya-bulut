// =====================================================================
// Chuntak AI — Web Push umumiy moduli (TZ-sinxronlash.md 46-band va 47-band)
// Fayl: supabase/functions/_shared/push.ts  (MANBA). Web Push (RFC 8030), VAPID (RFC 8292, ES256) va xabarni shifrlash (RFC 8291, aes128gcm)
// standart WebCrypto bilan: Deno va Node da bir xil. Tashqi paket yo'q, boshqa fayldan import yo'q.
//
// DIQQAT: bu fayl bir nechta funksiya papkasiga NUSXA qilinadi (bildirishnoma/push.ts, eslatma-yuborish/push.ts), chunki Supabase Dashboard
// muharriri funksiya papkasidan tashqaridagi fayllarni ko'rmaydi. Nusxalarni QO'LDA tahrirlamang: shu faylni o'zgartirib, `bash tools/push-nusxa.sh`
// ni ishga tushiring (testlar nusxalar bir xilligini tekshiradi).
// LOGGA kalit, endpoint, p256dh va auth_kaliti YOZILMAYDI.
// =====================================================================

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export const PUSH_TAYM_MS = 10000;
export const ENDPOINT_MAX = 2048;
const YUK_MAX = 3000;                              // shifrlanadigan xabar (bayt): bitta yozuvga (4096) sig'adi
// Push xizmatlari (brauzerlar): Chrome/Samsung/Opera — FCM, Firefox — Mozilla, Safari — Apple, Edge — Windows. Boshqa manzilga so'rov YUBORILMAYDI
// (aks holda foydalanuvchi bazaga ixtiyoriy https manzil yozib, server orqali so'rov yuborishi mumkin bo'lardi).
export const PUSH_HOSTLAR = ["fcm.googleapis.com", "push.services.mozilla.com", "push.apple.com", "notify.windows.com"];

export function b64uKodla(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function b64uOch(s: string): Uint8Array {
  if (typeof s !== "string" || !/^[A-Za-z0-9_-]*={0,2}$/.test(s)) throw new Error("base64url emas");
  const t = s.replace(/=+$/, "").replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(t + "=".repeat((4 - (t.length % 4)) % 4));
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return b;
}
export function birlash(...q: Uint8Array[]): Uint8Array {
  const o = new Uint8Array(q.reduce((n, x) => n + x.length, 0));
  let i = 0;
  for (const x of q) { o.set(x, i); i += x.length; }
  return o;
}
export const matnBayt = (s: string): Uint8Array => new TextEncoder().encode(s);

// Endpoint: https va ma'lum push xizmati (SSRF himoyasi)
export function endpointYaroqlimi(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length < 12 || endpoint.length > ENDPOINT_MAX) return false;
  let u: URL;
  try { u = new URL(endpoint); } catch (_e) { return false; }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return false;
  const h = u.hostname.toLowerCase();
  return PUSH_HOSTLAR.some((p) => h === p || h.endsWith("." + p));
}

// ---------------------------------------------------------------------
// VAPID (RFC 8292): ES256 imzolangan JWT. Maxfiy kalit — 32 baytli d (base64url), ochiq kalit — 65 baytli siqilmagan nuqta
// ---------------------------------------------------------------------
async function vapidKalitiniOch(ochiq: string, maxfiy: string): Promise<CryptoKey> {
  const p = b64uOch(ochiq), d = b64uOch(maxfiy);
  if (p.length !== 65 || p[0] !== 4 || d.length !== 32) throw new Error("VAPID kaliti noto'g'ri uzunlikda");
  const jwk = { kty: "EC", crv: "P-256", x: b64uKodla(p.slice(1, 33)), y: b64uKodla(p.slice(33, 65)), d: b64uKodla(d), ext: true };
  return await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

export async function vapidSarlavha(endpoint: string, ochiq: string, maxfiy: string, mavzu: string, hozirSek: number): Promise<string> {
  const kalit = await vapidKalitiniOch(ochiq, maxfiy);
  const bosh = b64uKodla(matnBayt(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const tana = b64uKodla(matnBayt(JSON.stringify({ aud: new URL(endpoint).origin, exp: hozirSek + 12 * 3600, sub: mavzu })));
  const imzo = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, kalit, matnBayt(bosh + "." + tana) as BufferSource));   // r||s (64 bayt): JWT shuni talab qiladi
  return "vapid t=" + bosh + "." + tana + "." + b64uKodla(imzo) + ", k=" + ochiq;
}

// ---------------------------------------------------------------------
// Xabarni shifrlash (RFC 8291, aes128gcm; bitta yozuv). tuz va asKalit faqat sinov uchun (RFC misolini tekshirish): odatda tasodifiy.
// ---------------------------------------------------------------------
async function hkdf(ikm: Uint8Array, tuz: Uint8Array, info: Uint8Array, bit: number): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", ikm as BufferSource, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: tuz as BufferSource, info: info as BufferSource }, k, bit));
}

export async function shifrla(yuk: Uint8Array, uaOchiq: Uint8Array, authSir: Uint8Array, opts?: { tuz?: Uint8Array; asKalit?: CryptoKeyPair }): Promise<Uint8Array> {
  if (uaOchiq.length !== 65 || uaOchiq[0] !== 4) throw new Error("p256dh noto'g'ri");
  if (authSir.length !== 16) throw new Error("auth noto'g'ri");
  if (yuk.length > YUK_MAX) throw new Error("xabar juda katta");
  const tuz = opts && opts.tuz ? opts.tuz : crypto.getRandomValues(new Uint8Array(16));
  const asKalit = opts && opts.asKalit ? opts.asKalit : await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
  const asOchiq = new Uint8Array(await crypto.subtle.exportKey("raw", asKalit.publicKey));
  const uaKalit = await crypto.subtle.importKey("raw", uaOchiq as BufferSource, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKalit }, asKalit.privateKey, 256));
  const ikm = await hkdf(ecdh, authSir, birlash(matnBayt("WebPush: info\0"), uaOchiq, asOchiq), 256);
  const cek = await hkdf(ikm, tuz, matnBayt("Content-Encoding: aes128gcm\0"), 128);
  const nonce = await hkdf(ikm, tuz, matnBayt("Content-Encoding: nonce\0"), 96);
  const aesKalit = await crypto.subtle.importKey("raw", cek as BufferSource, "AES-GCM", false, ["encrypt"]);
  const shifr = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as BufferSource }, aesKalit, birlash(yuk, new Uint8Array([2])) as BufferSource));   // 0x02 — oxirgi yozuv belgisi
  const rs = new Uint8Array([0, 0, 16, 0]);                                                                                                         // yozuv hajmi 4096
  return birlash(tuz, rs, new Uint8Array([asOchiq.length]), asOchiq, shifr);
}

// ---------------------------------------------------------------------
// Push xizmatiga yuborish. Natija: HTTP holat kodi (tarmoq xatosida 0)
// ---------------------------------------------------------------------
export interface Obuna { endpoint: string; p256dh: string; auth_kaliti: string }
export interface PushSozlama { ochiq: string; maxfiy: string; mavzu: string }

export async function pushYubor(fetchFn: FetchFn, obuna: Obuna, yuk: unknown, s: PushSozlama, hozirSek: number, taymMs: number = PUSH_TAYM_MS): Promise<number> {
  const tana = await shifrla(matnBayt(JSON.stringify(yuk)), b64uOch(obuna.p256dh), b64uOch(obuna.auth_kaliti));
  const vapid = await vapidSarlavha(obuna.endpoint, s.ochiq, s.maxfiy, s.mavzu, hozirSek);
  try {
    const r = await fetchFn(obuna.endpoint, {
      method: "POST",
      headers: { "Authorization": vapid, "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", "TTL": "60", "Urgency": "normal" },
      body: tana as BufferSource,
      signal: AbortSignal.timeout(taymMs),
    });
    try { await r.body?.cancel(); } catch (_e) { /* ahamiyatsiz */ }
    return r.status;
  } catch (_e) { return 0; }
}

