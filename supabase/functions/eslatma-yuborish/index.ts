// =====================================================================
// Chuntak AI — eslatmalarni VAQTIDA yuborish: Supabase Edge Function "eslatma-yuborish" (TZ-sinxronlash.md 47-band)
// Fayl: supabase/functions/eslatma-yuborish/index.ts
//
// Uni pg_cron har 5 daqiqada chaqiradi (supabase/016_eslatma_kroni.sql). Verify JWT O'CHIQ: cron foydalanuvchi emas. Himoya — `x-kron-sirri` sarlavhasi
// Secrets'dagi CRON_SIRRI bilan MOS kelmasa 401 va HECH NARSA qilinmaydi (constant-time solishtirish).
// Bildirishnoma_qurilmalari qatorlarini qatorning O'Z vaqt mintaqasida (`tz`) tekshiradi:
//   1) KUNLIK: kunlik_yoqiq va mahalliy vaqt [kunlik_vaqt, +2 soat) oynasida bo'lsa — HAR KUNI, bugun yozuv/qarz/to'lov bor-yo'qligidan qat'i nazar
//      (yozuvlar va qarzlar jadvallariga MURAJAAT QILINMAYDI).
//   2) QARZ MUDDATI: qarz_yoqiq va mahalliy vaqt [qarz_vaqt, +2 soat) oynasida bo'lsa — o'chirilmagan va qolgani > 0 qarzlardan muddati bugun + k
//      (k — qarz_kunlar: 0, 1, 3) bo'lganlari. Bir qurilmaga bir nechta qarz BITTA bildirishnomada.
// Takror yuborilmasligi: eslatma_jurnali (qurilma_id, kalit, sana) — yuborishdan OLDIN `insert ... on conflict do nothing`; faqat haqiqatan qo'shilgan bo'lsa yuboriladi.
// Vaqtincha xato (tarmoq/429/5xx) — jurnal qatori o'chiriladi (keyingi tikda qayta uriniladi). 404/410 — qurilma qatori o'chiriladi.
//
// Maxfiy o'zgaruvchilar (FAQAT Supabase Secrets / Edge muhiti; kodga, repoga, logga yozilmaydi):
//   CRON_SIRRI (siz kiritasiz), VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (46-banddagidek),
//   SUPABASE_URL va SUPABASE_SERVICE_ROLE_KEY — Supabase o'zi beradi (service_role kaliti faqat shu funksiyada, faqat serverda).
// LOGGA FAQAT sonlar va holat kodlari. Endpoint, kalit, ism, summa YOZILMAYDI.
// Web Push kodi ./push.ts da (supabase/functions/_shared/push.ts ning nusxasi: `bash tools/push-nusxa.sh`).
// =====================================================================

import { endpointYaroqlimi, pushYubor } from "./push.ts";
import type { FetchFn } from "./push.ts";
export type { FetchFn };

export interface Muhit { get(nom: string): string | undefined }
export interface Qurilma {
  id: string; user_id: string; endpoint: string; p256dh: string; auth_kaliti: string; tz: string;
  kunlik_yoqiq: boolean; kunlik_vaqt: string; qarz_yoqiq: boolean; qarz_kunlar: number[]; qarz_vaqt: string; korsatish: boolean;
}
export interface Qarz { id: string; user_id: string; yonalish: string; shaxs: string; summa: number; muddat: string; tolangan: number }
export interface Nomzod { kalit: string; sana: string }
export interface QarzNomzod extends Nomzod { k: number; shaxs: string; summa: number; yonalish: string }
export interface Xabar { title: string; body: string; tag: string; data: { url: string } }

export const OYNA_DAQIQA = 120;          // eslatma vaqtidan keyin 2 soat: o'tkazib yuborilgan tik qoplanadi
export const QURILMA_MAX = 500;          // bir chaqiruvda ko'pi bilan nechta qurilma
export const YUBORISH_TAYM_MS = 8000;        // bitta push so'rovi uchun
export const JURNAL_KUN = 14;            // jurnal shuncha kundan keyin tozalanadi
export const PARALLEL = 10;              // bir vaqtda nechta qurilma
export const QARZ_KUNLAR = [0, 1, 3];
export const QARZ_MATN_MAX = 3;          // matnda ko'pi bilan nechta qarz
const TAYM_MS = 20000;
const BODY_MAX = 280;
const ISM_MAX = 40;

// ---------------------------------------------------------------------
// SOF funksiyalar (hozirgi vaqt tashqaridan beriladi: ms)
// ---------------------------------------------------------------------
const formatlar = new Map<string, Intl.DateTimeFormat>();
// Vaqt mintaqasidagi mahalliy sana ("YYYY-MM-DD") va kun boshidan o'tgan daqiqa. Noto'g'ri mintaqada xato tashlaydi.
export function mahalliyVaqt(ms: number, tz: string): { sana: string; daqiqa: number } {
  let f = formatlar.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    formatlar.set(tz, f);
  }
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(new Date(ms))) p[x.type] = x.value;
  return { sana: p.year + "-" + p.month + "-" + p.day, daqiqa: (+p.hour % 24) * 60 + +p.minute };
}

export function vaqtDaqiqa(v: string): number | null {
  const m = /^(\d{2}):(\d{2})(:\d{2}(\.\d+)?)?$/.exec(String(v));
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  return +m[1] * 60 + +m[2];
}

export function sanaQosh(sana: string, kun: number): string {
  const [y, m, d] = sana.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + kun)).toISOString().slice(0, 10);
}

// Eslatma vaqti oynasida bo'lsa — oynaning "kuni" (mahalliy sana), aks holda null.
// Oyna yarim tundan o'tsa (masalan 23:00 + 2 soat) tundan keyingi daqiqalar OLDINGI kunning oynasiga tegishli: sana qaytgan kun bo'ladi.
export function oynaSanasi(ms: number, tz: string, vaqt: string, oyna: number = OYNA_DAQIQA): string | null {
  const t = vaqtDaqiqa(vaqt);
  if (t === null) return null;
  const l = mahalliyVaqt(ms, tz);
  if (l.daqiqa >= t && l.daqiqa < t + oyna) return l.sana;
  if (t + oyna > 1440 && l.daqiqa + 1440 >= t && l.daqiqa + 1440 < t + oyna) return sanaQosh(l.sana, -1);
  return null;
}

// KUNLIK: yoqiq va oynada bo'lsa; kalit "kunlik", sana — oynaning mahalliy kuni. Boshqa jadvallarga bog'liq EMAS.
export function kunlikNomzod(q: Pick<Qurilma, "kunlik_yoqiq" | "kunlik_vaqt" | "tz">, ms: number): Nomzod | null {
  if (q.kunlik_yoqiq !== true) return null;
  const sana = oynaSanasi(ms, q.tz, q.kunlik_vaqt);
  return sana ? { kalit: "kunlik", sana } : null;
}

// QARZ: yoqiq va oynada bo'lsa — qaysi muddat sanalari (bugun + k) qidiriladi
export function qarzOynasi(q: Pick<Qurilma, "qarz_yoqiq" | "qarz_vaqt" | "qarz_kunlar" | "tz">, ms: number): { sana: string; muddatlar: { k: number; muddat: string }[] } | null {
  if (q.qarz_yoqiq !== true) return null;
  const sana = oynaSanasi(ms, q.tz, q.qarz_vaqt);
  if (!sana) return null;
  const kunlar = [...new Set((q.qarz_kunlar || []).filter((k) => QARZ_KUNLAR.indexOf(k) >= 0))].sort((a, b) => a - b);
  if (!kunlar.length) return null;
  return { sana, muddatlar: kunlar.map((k) => ({ k, muddat: sanaQosh(sana, k) })) };
}

// Qolgan summa > 0 va muddati bugun + k bo'lgan qarzlar (qarzlar bitta foydalanuvchiniki; o'chirilganlar tashqarida filtrlangan)
export function qarzNomzodlari(oyna: { sana: string; muddatlar: { k: number; muddat: string }[] }, qarzlar: Qarz[]): QarzNomzod[] {
  const out: QarzNomzod[] = [];
  for (const z of qarzlar) {
    const qoldiq = Math.max(0, Number(z.summa) - Number(z.tolangan || 0));
    if (!(qoldiq > 0)) continue;
    const m = oyna.muddatlar.find((x) => x.muddat === z.muddat);
    if (!m) continue;
    out.push({ kalit: "qarz:" + z.id + ":" + m.k, sana: z.muddat, k: m.k, shaxs: z.shaxs, summa: qoldiq, yonalish: z.yonalish });
  }
  return out.sort((a, b) => a.k - b.k || a.shaxs.localeCompare(b.shaxs) || (a.kalit < b.kalit ? -1 : 1));
}

export function sumFormat(n: number): string { return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }

export function kunlikXabar(sana: string): Xabar {
  return { title: "Bugungi yozuvlarni kiriting", body: "Bugun xarajat va daromadlaringizni yozib qo'ydingizmi?", tag: "kunlik-" + sana, data: { url: "./?yangi=1" } };
}

const QARZ_SARLAVHA: Record<number, string> = { 0: "Qarz muddati bugun", 1: "Ertaga qarz muddati", 3: "3 kundan keyin qarz muddati" };
export function qarzXabar(items: QarzNomzod[], korsatish: boolean, sana: string): Xabar {
  const k = Math.min(...items.map((x) => x.k));
  const x: Xabar = { title: QARZ_SARLAVHA[k] || QARZ_SARLAVHA[0], body: "Qarzlar ro'yxatini ilovada ko'ring", tag: "qarz-" + sana, data: { url: "./?qarzlar=1" } };
  if (korsatish) {
    const qismlar = items.slice(0, QARZ_MATN_MAX).map((z) => {
      const ism = z.shaxs.replace(/\s+/g, " ").trim().slice(0, ISM_MAX) || "Noma'lum";
      return ism + ": " + sumFormat(z.summa) + " so'm" + (z.yonalish === "oldim" ? ", qaytarishingiz kerak" : "");
    });
    let b = qismlar.join(", ");
    if (items.length > QARZ_MATN_MAX) b += " va yana " + (items.length - QARZ_MATN_MAX) + " ta";
    x.body = b.length > BODY_MAX ? b.slice(0, BODY_MAX - 1) + "…" : b;
  }
  return x;
}

// CRON_SIRRI solishtirish: ikkala qiymat SHA-256 ga aylantiriladi (uzunlik sirni bildirmaydi), so'ng baytlar XOR bilan to'liq solishtiriladi
export async function sirMosmi(berilgan: string | null, haqiqiy: string | undefined): Promise<boolean> {
  if (!haqiqiy || haqiqiy.length < 16 || !berilgan) return false;
  const h = async (s: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  const [a, b] = await Promise.all([h(berilgan), h(haqiqiy)]);
  let farq = 0;
  for (let i = 0; i < a.length; i++) farq |= a[i] ^ b[i];
  return farq === 0;
}

// ---------------------------------------------------------------------
// Supabase (service_role): jadvallar
// ---------------------------------------------------------------------
class RestXatosi extends Error { holat: number; constructor(holat: number) { super("rest"); this.holat = holat; } }

function restYasash(muhit: Muhit, fetchFn: FetchFn) {
  const url = (muhit.get("SUPABASE_URL") || "").replace(/\/+$/, "");
  const kalit = muhit.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return async (usul: string, jadval: string, sorov: string, tana?: unknown, prefer?: string): Promise<unknown[]> => {
    const bosh: Record<string, string> = { "apikey": kalit, "Authorization": "Bearer " + kalit, "Accept": "application/json" };
    if (tana !== undefined) bosh["Content-Type"] = "application/json";
    if (prefer) bosh["Prefer"] = prefer;
    let r: Response;
    try {
      r = await fetchFn(url + "/rest/v1/" + jadval + (sorov ? "?" + sorov : ""), { method: usul, headers: bosh, body: tana === undefined ? undefined : JSON.stringify(tana), signal: AbortSignal.timeout(TAYM_MS) });
    } catch (_e) { throw new RestXatosi(0); }
    if (!r.ok) throw new RestXatosi(r.status);
    try { const j = await r.json(); return Array.isArray(j) ? j : []; } catch (_e) { return []; }
  };
}
type Rest = ReturnType<typeof restYasash>;

const bolak = <T>(a: T[], n: number): T[][] => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

async function qarzlarniOl(rest: Rest, userlar: string[], sanalar: string[]): Promise<Map<string, Qarz[]>> {
  const xarita = new Map<string, Qarz[]>();
  if (!userlar.length || !sanalar.length) return xarita;
  const hammasi: Qarz[] = [];
  for (const b of bolak(userlar, 50)) {
    const q = await rest("GET", "qarzlar", "select=id,user_id,yonalish,shaxs,summa,muddat&deleted=eq.false&user_id=in.(" + b.join(",") + ")&muddat=in.(" + sanalar.join(",") + ")") as Qarz[];
    for (const z of q) hammasi.push({ id: z.id, user_id: z.user_id, yonalish: z.yonalish, shaxs: String(z.shaxs || ""), summa: Number(z.summa), muddat: z.muddat, tolangan: 0 });
  }
  const tolangan = new Map<string, number>();
  for (const b of bolak(hammasi.map((z) => z.id), 100)) {
    const t = await rest("GET", "qarz_tolovlari", "select=qarz_id,summa&deleted=eq.false&qarz_id=in.(" + b.join(",") + ")") as { qarz_id: string; summa: number }[];
    for (const x of t) tolangan.set(x.qarz_id, (tolangan.get(x.qarz_id) || 0) + Number(x.summa));
  }
  for (const z of hammasi) {
    z.tolangan = tolangan.get(z.id) || 0;
    const a = xarita.get(z.user_id) || [];
    a.push(z);
    xarita.set(z.user_id, a);
  }
  return xarita;
}

// ---------------------------------------------------------------------
// Asosiy ishlovchi (sinov uchun muhit, fetch va soat tashqaridan beriladi)
// ---------------------------------------------------------------------
interface Hisob { yuborildi: number; otkazildi: number; xato: number; ochirildi: number; holatlar: Record<string, number> }
const json = (t: unknown, holat: number) => new Response(JSON.stringify(t), { status: holat, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

export async function ishlov(req: Request, muhit: Muhit, fetchFn: FetchFn, hozir: () => number = () => Date.now()): Promise<Response> {
  // 1) Sir: mos kelmasa 401 va hech narsa qilinmaydi (usuldan va tanadan qat'i nazar)
  if (!(await sirMosmi(req.headers.get("x-kron-sirri"), muhit.get("CRON_SIRRI")))) return json({ xato: "401" }, 401);
  if (req.method !== "POST") return json({ xato: "405" }, 405);

  const ochiq = (muhit.get("VAPID_PUBLIC_KEY") || "").trim(), maxfiy = (muhit.get("VAPID_PRIVATE_KEY") || "").trim(), mavzu = (muhit.get("VAPID_SUBJECT") || "").trim();
  if (!muhit.get("SUPABASE_URL") || !muhit.get("SUPABASE_SERVICE_ROLE_KEY") || !ochiq || !maxfiy || !/^(mailto:[^\s@]+@[^\s@]+|https:\/\/\S+)$/.test(mavzu)) {
    console.error("eslatma-yuborish: sozlanmagan");
    return json({ xato: "SOZLANMAGAN" }, 503);
  }
  const rest = restYasash(muhit, fetchFn);
  const t = hozir();
  const h: Hisob = { yuborildi: 0, otkazildi: 0, xato: 0, ochirildi: 0, holatlar: {} };
  const sanab = (k: string) => { h.holatlar[k] = (h.holatlar[k] || 0) + 1; };

  // 2) Eski jurnal qatorlari (14 kundan eski) o'chiriladi
  try { await rest("DELETE", "eslatma_jurnali", "created_at=lt." + new Date(t - JURNAL_KUN * 86400000).toISOString()); } catch (_e) { sanab("jurnal_tozalash_xato"); }

  // 3) Qurilmalar
  let qurilmalar: Qurilma[];
  try {
    qurilmalar = await rest("GET", "bildirishnoma_qurilmalari", "select=id,user_id,endpoint,p256dh,auth_kaliti,tz,kunlik_yoqiq,kunlik_vaqt,qarz_yoqiq,qarz_kunlar,qarz_vaqt,korsatish&or=(kunlik_yoqiq.eq.true,qarz_yoqiq.eq.true)&order=id&limit=" + QURILMA_MAX) as Qurilma[];
  } catch (e) {
    console.error("eslatma-yuborish: qurilmalar_xato", e instanceof RestXatosi ? e.holat : "?");
    return json({ xato: "QURILMALAR" }, 503);
  }

  // 4) Kim nima uchun navbatda (sof funksiyalar)
  interface Reja { q: Qurilma; kunlik: Nomzod | null; oyna: ReturnType<typeof qarzOynasi> }
  const rejalar: Reja[] = [];
  for (const q of qurilmalar) {
    try {
      const kunlik = kunlikNomzod(q, t), oyna = qarzOynasi(q, t);
      if (!kunlik && !oyna) { h.otkazildi++; continue; }
      if (!endpointYaroqlimi(q.endpoint)) { h.otkazildi++; sanab("endpoint_yaroqsiz"); continue; }
      rejalar.push({ q, kunlik, oyna });
    } catch (_e) { h.xato++; sanab("tz_xato"); }   // noto'g'ri vaqt mintaqasi: shu qurilma o'tkaziladi
  }

  // 5) Qarzlar (faqat kerak bo'lgan foydalanuvchilar va sanalar uchun)
  let qarzlar = new Map<string, Qarz[]>();
  const qarzReja = rejalar.filter((r) => r.oyna);
  if (qarzReja.length) {
    try {
      qarzlar = await qarzlarniOl(rest, [...new Set(qarzReja.map((r) => r.q.user_id))], [...new Set(qarzReja.flatMap((r) => r.oyna!.muddatlar.map((m) => m.muddat)))]);
    } catch (e) {
      console.error("eslatma-yuborish: qarzlar_xato", e instanceof RestXatosi ? e.holat : "?");
      qarzReja.forEach((r) => { r.oyna = null; });   // qarzlar o'qilmadi: qarz eslatmalari keyingi tikda; kunlik davom etadi
      sanab("qarzlar_xato");
    }
  }

  const sozlama = { ochiq, maxfiy, mavzu };
  // 6) Har qurilma alohida: xato boshqalarga to'sqinlik qilmaydi
  async function qurilmaIshi(r: Reja): Promise<void> {
    const q = r.q;
    try {
      const qarzNom = r.oyna ? qarzNomzodlari(r.oyna, qarzlar.get(q.user_id) || []) : [];
      const hammasi: Nomzod[] = [...(r.kunlik ? [r.kunlik] : []), ...qarzNom];
      if (!hammasi.length) { h.otkazildi++; return; }
      // Yuborishdan OLDIN jurnalga yozish: faqat haqiqatan qo'shilgan qatorlar (ignore-duplicates faqat yangilarini qaytaradi) uchun yuboriladi
      const yangi = await rest("POST", "eslatma_jurnali", "on_conflict=qurilma_id,kalit,sana&select=kalit,sana", hammasi.map((n) => ({ qurilma_id: q.id, kalit: n.kalit, sana: n.sana })), "resolution=ignore-duplicates,return=representation") as Nomzod[];
      const yangiMi = (n: Nomzod) => yangi.some((y) => y.kalit === n.kalit && String(y.sana) === n.sana);
      const kunlikYangi = r.kunlik && yangiMi(r.kunlik) ? r.kunlik : null;
      const qarzYangi = qarzNom.filter(yangiMi);
      if (!kunlikYangi && !qarzYangi.length) { h.otkazildi++; return; }

      const yuborishlar: { xabar: Xabar; kalitlar: string[] }[] = [];
      if (kunlikYangi) yuborishlar.push({ xabar: kunlikXabar(kunlikYangi.sana), kalitlar: [kunlikYangi.kalit] });
      if (qarzYangi.length) yuborishlar.push({ xabar: qarzXabar(qarzYangi, q.korsatish === true, r.oyna!.sana), kalitlar: qarzYangi.map((x) => x.kalit) });

      for (const y of yuborishlar) {
        const holat = await pushYubor(fetchFn, { endpoint: q.endpoint, p256dh: q.p256dh, auth_kaliti: q.auth_kaliti }, y.xabar, sozlama, Math.floor(t / 1000), YUBORISH_TAYM_MS);
        if (holat >= 200 && holat < 300) { h.yuborildi++; continue; }
        sanab(String(holat));
        if (holat === 404 || holat === 410) {
          // Obuna o'lgan: qurilma qatori o'chiriladi (jurnal cascade bilan ketadi); qolgan eslatmalar shu qurilmaga yuborilmaydi
          try { await rest("DELETE", "bildirishnoma_qurilmalari", "id=eq." + q.id); h.ochirildi++; } catch (_e) { sanab("ochirish_xato"); }
          return;
        }
        h.xato++;
        if (holat === 0 || holat === 429 || holat >= 500) {
          // Vaqtincha xato: jurnal qatori o'chiriladi, keyingi tikda qayta uriniladi (2 soatlik oyna ichida)
          try { await rest("DELETE", "eslatma_jurnali", "qurilma_id=eq." + q.id + "&kalit=in.(" + y.kalitlar.join(",") + ")"); } catch (_e) { sanab("jurnal_ochirish_xato"); }
        }
      }
    } catch (e) {
      h.xato++;
      sanab(e instanceof RestXatosi ? "rest_" + e.holat : "kutilmagan");
    }
  }
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(PARALLEL, rejalar.length) }, async () => {
    while (i < rejalar.length) await qurilmaIshi(rejalar[i++]);
  }));

  // 7) Log: FAQAT sonlar va holat kodlari
  const holatlar = Object.keys(h.holatlar).sort().map((k) => k + ":" + h.holatlar[k]).join(",");
  console.log("eslatma-yuborish: qurilma=" + qurilmalar.length + " yuborildi=" + h.yuborildi + " otkazildi=" + h.otkazildi + " xato=" + h.xato + " ochirildi=" + h.ochirildi + (holatlar ? " holatlar=" + holatlar : ""));
  return json({ ok: true, qurilma: qurilmalar.length, yuborildi: h.yuborildi, otkazildi: h.otkazildi, xato: h.xato, ochirildi: h.ochirildi }, 200);
}

// Deno (Supabase Edge Functions) ichida ishga tushadi; sinovda (Node) import qilinganda ishga tushmaydi
// deno-lint-ignore no-explicit-any
const D = (globalThis as any).Deno;
if (D && typeof D.serve === "function") {
  D.serve((req: Request) => ishlov(req, { get: (n: string) => D.env.get(n) }, (u, i) => fetch(u, i)));
}
