// =====================================================================
// Chuntak AI — bildirishnoma asosi (Web Push): Supabase Edge Function "bildirishnoma" (TZ-sinxronlash.md 46-band)
// Fayl: supabase/functions/bildirishnoma/index.ts
//
// TASHQI PAKET YO'Q. Faqat bitta qo'shni fayl: ./push.ts (Web Push, VAPID va shifrlash; standart WebCrypto, sababi: TZ 46.5 va 47.3).
// push.ts — supabase/functions/_shared/push.ts ning nusxasi (`bash tools/push-nusxa.sh`); Dashboard'da funksiyaga ikkala fayl joylanadi.
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

import { b64uKodla, b64uOch, endpointYaroqlimi, shifrla, vapidSarlavha, pushYubor, ENDPOINT_MAX } from "./push.ts";
import type { FetchFn, Obuna } from "./push.ts";
export { b64uKodla, b64uOch, endpointYaroqlimi, shifrla, vapidSarlavha, pushYubor };
export type { FetchFn, Obuna };
export interface Muhit { get(nom: string): string | undefined }

export const ILOVA_MANZILI = "https://jahon-gir.github.io/moliya-bulut/";
export const SINOV_ORALIQ_MS = 30000;             // "Sinab ko'rish" oralig'i: oxirgi_sinov dan 30 soniya
export const SINOV_SARLAVHA = "Eslatmalar ishlayapti";
export const SINOV_MATN = "Bu sinov bildirishnomasi.";
export const XATO_KODLARI = ["NOT_SIGNED_IN", "PUSH_KIRISH", "PUSH_YOQ", "PUSH_TEZ", "PUSH_ESKIRGAN", "PUSH_XIZMAT", "PUSH_OBUNA", "SOZLANMAGAN", "NETWORK"] as const;
export type XatoKodi = typeof XATO_KODLARI[number];

const TAYM_AUT_MS = 20000;
const TANA_MAX = 2048;                             // so'rov tanasi (bayt)
const RUXSAT_ORIGIN = ["https://jahon-gir.github.io", "http://localhost:8000"];

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
