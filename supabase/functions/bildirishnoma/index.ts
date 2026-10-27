// =====================================================================
// Chuntak AI — bildirishnoma asosi (Web Push): Supabase Edge Function "bildirishnoma" (TZ-sinxronlash.md 46-band)
// Fayl: supabase/functions/bildirishnoma/index.ts
//
// BITTA fayl, boshqa mahalliy fayldan import yo'q va TASHQI PAKET HAM YO'Q: uni Supabase Dashboard muharririga to'liq nusxalab joylash mumkin.
// Web Push (RFC 8030), VAPID (RFC 8292) va xabarni shifrlash (RFC 8291, aes128gcm) shu yerda Deno va Node da bir xil ishlaydigan
// standart WebCrypto bilan yozilgan (sababi: TZ 46.5).
//
// Amallar (POST, JSON, Verify JWT YOQIQ; kirmagan foydalanuvchi 401):
//   { "amal": "kalit" }                     -> { ok: true, kalit }   ochiq VAPID kaliti (base64url, siqilmagan nuqta)
//   { "amal": "sinov", "endpoint": "..." }  -> shu foydalanuvchining shu qurilma obunasiga sinov bildirishnomasi
//        muvaffaqiyat { ok: true }; 404 PUSH_YOQ (qurilma yozilmagan); 429 PUSH_TEZ (30 soniyadan ertaroq takror);
//        410 PUSH_ESKIRGAN (push xizmati 404/410 berdi: obuna qatori o'chiriladi); 502 PUSH_XIZMAT; 400 PUSH_OBUNA; 503 SOZLANMAGAN
// Jadvalga FAQAT foydalanuvchining o'z JWT'si bilan (RLS orqali) murojaat qilinadi: service_role KERAK EMAS va ishlatilmaydi.
//
// Maxfiy o'zgaruvchilar (FAQAT Supabase -> Edge Functions -> Secrets; kodga, repoga, testga yozilmaydi):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT ("mailto:..." yoki "https://...").
//   SUPABASE_URL va SUPABASE_ANON_KEY ni Supabase o'zi beradi.
// LOGGA kalit, endpoint, p256dh va auth_kaliti YOZILMAYDI: faqat qisqa holat kodlari.
// =====================================================================

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;
export interface Muhit { get(nom: string): string | undefined }

export const ILOVA_MANZILI = "https://jahon-gir.github.io/moliya-bulut/";
export const SINOV_ORALIQ_MS = 30000;             // "Sinab ko'rish" oralig'i: oxirgi_sinov dan 30 soniya
export const SINOV_SARLAVHA = "Eslatmalar ishlayapti";
export const SINOV_MATN = "Bu sinov bildirishnomasi.";
export const XATO_KODLARI = ["NOT_SIGNED_IN", "PUSH_KIRISH", "PUSH_YOQ", "PUSH_TEZ", "PUSH_ESKIRGAN", "PUSH_XIZMAT", "PUSH_OBUNA", "SOZLANMAGAN", "NETWORK"] as const;
export type XatoKodi = typeof XATO_KODLARI[number];

const TAYM_AUT_MS = 20000;
const PUSH_TAYM_MS = 10000;
const TANA_MAX = 2048;                             // so'rov tanasi (bayt)
const ENDPOINT_MAX = 2048;
const YUK_MAX = 3000;                              // shifrlanadigan xabar (bayt): bitta yozuvga (4096) sig'adi
const RUXSAT_ORIGIN = ["https://jahon-gir.github.io", "http://localhost:8000"];
// Push xizmatlari (brauzerlar): Chrome/Samsung/Opera — FCM, Firefox — Mozilla, Safari — Apple, Edge — Windows. Boshqa manzilga so'rov YUBORILMAYDI
// (aks holda foydalanuvchi bazaga ixtiyoriy https manzil yozib, server orqali so'rov yuborishi mumkin bo'lardi).
const PUSH_HOSTLAR = ["fcm.googleapis.com", "push.services.mozilla.com", "push.apple.com", "notify.windows.com"];

const XATO_MATNI: Record<XatoKodi, string> = {
  NOT_SIGNED_IN: "Avval akkauntga kiring.",
  PUSH_KIRISH: "So'rov noto'g'ri tuzilgan.",
  PUSH_YOQ: "Bu qurilma serverda yozilmagan. Eslatmani o'chirib, qayta yoqing.",
  PUSH_TEZ: "Sinov juda tez-tez. Bir oz kutib, qayta urinib ko'ring.",
  PUSH_ESKIRGAN: "Obuna eskirgan, qayta yoqing.",
  PUSH_XIZMAT: "Bildirishnoma xizmati javob bermadi.",
  PUSH_OBUNA: "Qurilma obunasi noto'g'ri.",
  SOZLANMAGAN: "Server bildirishnoma uchun sozlanmagan.",
  NETWORK: "Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring.",
};

// ---------------------------------------------------------------------
// Yordamchilar
// ---------------------------------------------------------------------
function json(tana: unknown, holat: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(tana), { status: holat, headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
function xatoJavob(kod: XatoKodi, holat: number, cors: Record<string, string>, debug?: string, qoshimcha?: Record<string, unknown>): Response {
  const x: Record<string, unknown> = { kod, sabab: XATO_MATNI[kod], ...(qoshimcha || {}) };
  if (debug && /^[a-z0-9_]{1,40}$/.test(debug)) x.debug = debug;
  return json({ xato: x }, holat, cors);
}
// Faqat qisqa holat kodlari loglanadi (kalit, endpoint, p256dh, auth_kaliti — HECH QACHON)
function log(kod: string, holat?: number): void {
  if (/^[a-z0-9_]{1,40}$/.test(kod)) console.error("bildirishnoma:", kod, holat === undefined ? "" : String(holat));
}

export function corsBoshlari(origin: string | null): Record<string, string> {
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  };
  if (origin && RUXSAT_ORIGIN.indexOf(origin) >= 0) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

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
function birlash(...q: Uint8Array[]): Uint8Array {
  const o = new Uint8Array(q.reduce((n, x) => n + x.length, 0));
  let i = 0;
  for (const x of q) { o.set(x, i); i += x.length; }
  return o;
}
const matnBayt = (s: string): Uint8Array => new TextEncoder().encode(s);

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

export async function pushYubor(fetchFn: FetchFn, obuna: Obuna, yuk: unknown, s: PushSozlama, hozirSek: number): Promise<number> {
  const tana = await shifrla(matnBayt(JSON.stringify(yuk)), b64uOch(obuna.p256dh), b64uOch(obuna.auth_kaliti));
  const vapid = await vapidSarlavha(obuna.endpoint, s.ochiq, s.maxfiy, s.mavzu, hozirSek);
  try {
    const r = await fetchFn(obuna.endpoint, {
      method: "POST",
      headers: { "Authorization": vapid, "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", "TTL": "60", "Urgency": "normal" },
      body: tana as BufferSource,
      signal: AbortSignal.timeout(PUSH_TAYM_MS),
    });
    try { await r.body?.cancel(); } catch (_e) { /* ahamiyatsiz */ }
    return r.status;
  } catch (_e) { return 0; }
}

// ---------------------------------------------------------------------
// Supabase: foydalanuvchi va jadval (foydalanuvchining o'z JWT'si bilan; RLS)
// ---------------------------------------------------------------------
async function foydalanuvchi(muhit: Muhit, fetchFn: FetchFn, jwt: string, anon: string): Promise<"ok" | "kirmagan" | "xato"> {
  const url = muhit.get("SUPABASE_URL");
  if (!url || !anon) return "xato";
  let r: Response;
  try {
    r = await fetchFn(url.replace(/\/+$/, "") + "/auth/v1/user", { headers: { "apikey": anon, "Authorization": "Bearer " + jwt }, signal: AbortSignal.timeout(TAYM_AUT_MS) });
  } catch (_e) { return "xato"; }
  if (r.status === 401 || r.status === 403) return "kirmagan";
  if (!r.ok) return "xato";
  try {
    const d = await r.json();
    if (d && typeof d.id === "string" && d.id) return "ok";
  } catch (_e) { /* pastga */ }
  return "kirmagan";
}

class JadvalXatosi extends Error { holat: number; constructor(holat: number) { super("jadval"); this.holat = holat; } }

async function jadval(muhit: Muhit, fetchFn: FetchFn, jwt: string, anon: string, usul: string, sorov: string, tana?: unknown): Promise<unknown[]> {
  const url = muhit.get("SUPABASE_URL")!.replace(/\/+$/, "") + "/rest/v1/bildirishnoma_qurilmalari?" + sorov;
  const bosh: Record<string, string> = { "apikey": anon, "Authorization": "Bearer " + jwt, "Accept": "application/json" };
  if (usul !== "GET") bosh["Prefer"] = "return=representation";
  if (tana !== undefined) bosh["Content-Type"] = "application/json";
  let r: Response;
  try {
    r = await fetchFn(url, { method: usul, headers: bosh, body: tana === undefined ? undefined : JSON.stringify(tana), signal: AbortSignal.timeout(TAYM_AUT_MS) });
  } catch (_e) { throw new JadvalXatosi(0); }
  if (!r.ok) throw new JadvalXatosi(r.status);
  try { const j = await r.json(); return Array.isArray(j) ? j : []; } catch (_e) { return []; }
}

// ---------------------------------------------------------------------
// Asosiy ishlovchi (sinov uchun muhit, fetch va soat tashqaridan beriladi)
// ---------------------------------------------------------------------
export async function ishlov(req: Request, muhit: Muhit, fetchFn: FetchFn, hozir: () => number = () => Date.now()): Promise<Response> {
  const cors = corsBoshlari(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return xatoJavob("PUSH_KIRISH", 405, cors);

  // 1) kirish
  const bm = (req.headers.get("Authorization") || "").match(/^Bearer\s+(\S+)$/i);
  if (!bm) return xatoJavob("NOT_SIGNED_IN", 401, cors);
  const jwt = bm[1];
  const anon = (req.headers.get("apikey") || muhit.get("SUPABASE_ANON_KEY") || "").trim();

  // 2) so'rov tanasi
  let tana: Record<string, unknown>;
  try {
    const matn = await req.text();
    if (matn.length > TANA_MAX) return xatoJavob("PUSH_KIRISH", 413, cors);
    const j = JSON.parse(matn);
    if (typeof j !== "object" || j === null || Array.isArray(j)) return xatoJavob("PUSH_KIRISH", 400, cors);
    tana = j as Record<string, unknown>;
  } catch (_e) { return xatoJavob("PUSH_KIRISH", 400, cors); }
  if (tana.amal !== "kalit" && tana.amal !== "sinov") return xatoJavob("PUSH_KIRISH", 400, cors);

  // 3) JWT haqiqiyligi (anon kalit yoki muddati o'tgan token o'tmaydi)
  const f = await foydalanuvchi(muhit, fetchFn, jwt, anon);
  if (f === "kirmagan") return xatoJavob("NOT_SIGNED_IN", 401, cors);
  if (f === "xato") { log("auth_xato"); return xatoJavob("NETWORK", 503, cors); }

  // 4) VAPID sozlamasi
  const ochiq = (muhit.get("VAPID_PUBLIC_KEY") || "").trim();
  const maxfiy = (muhit.get("VAPID_PRIVATE_KEY") || "").trim();
  const mavzu = (muhit.get("VAPID_SUBJECT") || "").trim();
  let sozlamaYaroqli = /^(mailto:[^\s@]+@[^\s@]+|https:\/\/\S+)$/.test(mavzu);
  try { const p = b64uOch(ochiq); if (p.length !== 65 || p[0] !== 4) sozlamaYaroqli = false; } catch (_e) { sozlamaYaroqli = false; }
  if (tana.amal === "sinov") { try { if (b64uOch(maxfiy).length !== 32) sozlamaYaroqli = false; } catch (_e) { sozlamaYaroqli = false; } }
  if (!sozlamaYaroqli) { log("vapid_sozlanmagan"); return xatoJavob("SOZLANMAGAN", 503, cors); }

  if (tana.amal === "kalit") return json({ ok: true, kalit: ochiq }, 200, cors);

  // ---- sinov ----
  const endpoint = tana.endpoint;
  if (typeof endpoint !== "string" || endpoint.length > ENDPOINT_MAX) return xatoJavob("PUSH_KIRISH", 400, cors);
  const ep = encodeURIComponent(endpoint);
  try {
    const qatorlar = await jadval(muhit, fetchFn, jwt, anon, "GET", "select=id,endpoint,p256dh,auth_kaliti&endpoint=eq." + ep + "&limit=1");
    if (qatorlar.length === 0) return xatoJavob("PUSH_YOQ", 404, cors);
    const q = qatorlar[0] as Record<string, unknown>;
    if (typeof q.id !== "string" || typeof q.p256dh !== "string" || typeof q.auth_kaliti !== "string" || !endpointYaroqlimi(q.endpoint)) return xatoJavob("PUSH_OBUNA", 400, cors, "obuna_yaroqsiz");
    const obuna: Obuna = { endpoint: q.endpoint as string, p256dh: q.p256dh, auth_kaliti: q.auth_kaliti };

    // Tezlik chegarasi: bitta atomik yangilash — oxirgi_sinov bo'sh yoki 30 soniyadan eski bo'lsagina o'tadi (ikki bosish ikki xabar bermaydi)
    const t = hozir();
    const chegara = new Date(t - SINOV_ORALIQ_MS).toISOString();
    const o = await jadval(muhit, fetchFn, jwt, anon, "PATCH", "id=eq." + encodeURIComponent(q.id) + "&or=(oxirgi_sinov.is.null,oxirgi_sinov.lt." + chegara + ")&select=id", { oxirgi_sinov: new Date(t).toISOString() });
    if (o.length === 0) return xatoJavob("PUSH_TEZ", 429, cors);

    const yuk = { title: SINOV_SARLAVHA, body: SINOV_MATN, tag: "sinov", data: { url: ILOVA_MANZILI } };
    let holat: number;
    try { holat = await pushYubor(fetchFn, obuna, yuk, { ochiq, maxfiy, mavzu }, Math.floor(t / 1000)); }
    catch (_e) { log("shifrlash_xato"); return xatoJavob("PUSH_OBUNA", 400, cors, "shifrlash"); }
    if (holat >= 200 && holat < 300) return json({ ok: true }, 200, cors);
    if (holat === 404 || holat === 410) {
      // Obuna o'lgan: qator o'chiriladi (o'chirib bo'lmasa ham foydalanuvchiga baribir "eskirgan" deyiladi)
      try { await jadval(muhit, fetchFn, jwt, anon, "DELETE", "id=eq." + encodeURIComponent(q.id) + "&select=id"); } catch (_e) { log("ochirish_xato"); }
      log("push_eskirgan", holat);
      return xatoJavob("PUSH_ESKIRGAN", 410, cors);
    }
    log("push_xato", holat);
    return xatoJavob("PUSH_XIZMAT", 502, cors, holat === 0 ? "push_tarmoq" : "push_" + holat);
  } catch (e) {
    if (e instanceof JadvalXatosi) {
      if (e.holat === 401 || e.holat === 403) return xatoJavob("NOT_SIGNED_IN", 401, cors);
      log("jadval_xato", e.holat);
      if (e.holat === 404) return xatoJavob("SOZLANMAGAN", 503, cors, "jadval_yoq");   // 013 ishga tushirilmagan
      return xatoJavob("NETWORK", 503, cors, e.holat ? "jadval_" + e.holat : "jadval_tarmoq");
    }
    log("kutilmagan");
    return xatoJavob("PUSH_XIZMAT", 500, cors, "kutilmagan");
  }
}

// Deno (Supabase Edge Functions) ichida ishga tushadi; sinovda (Node) import qilinganda ishga tushmaydi
// deno-lint-ignore no-explicit-any
const D = (globalThis as any).Deno;
if (D && typeof D.serve === "function") {
  D.serve((req: Request) => ishlov(req, { get: (n: string) => D.env.get(n) }, (u, i) => fetch(u, i)));
}
