// AI yordamchi (Edge Function) sinovi. Ishga tushirish:  node --test supabase/functions/yordamchi/test.mjs
// Node 22.18+ kerak (TypeScript faylni to'g'ridan-to'g'ri o'qiydi). Haqiqiy AI kaliti va tarmoq ISHLATILMAYDI: provayder taqlid qilinadi.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as M from './index.ts';

const BU = dirname(fileURLToPath(import.meta.url));
const KAT = ['Oziq-ovqat', "Ro'zg'or", 'Transport'];
const HIS = ['Naqd pul', 'Karta'];
const D = { dan: '2026-10-01', gacha: '2026-10-31' };
const SOROV = { amal: 'yigindi', davr: D, davr2: null, tur: 'xarajat', kategoriya: 'Oziq-ovqat', hisob: null, matn: null };
const JADVAL = { amal: 'jadval', guruh: 'kategoriya', olchov: 'jami', tur: 'xarajat', davr: D, kategoriya: null, hisob: null, tartib: 'kamayish', limit: 5 };

// ---- taqlid muhit va tarmoq ----
function muhitYasa(ustiga = {}) {
  const m = { SUPABASE_URL: 'https://x.invalid', SUPABASE_ANON_KEY: 'anon-sinov', AI_RUXSAT_EMAIL: 'Ega@Example.invalid, boshqa@example.invalid', AI_PROVAYDER: 'openai', AI_MODEL: 'sinov-model', OPENAI_API_KEY: 'sinov-kalit-1', ANTHROPIC_API_KEY: 'sinov-kalit-2', ...ustiga };
  return { get: (n) => m[n] };
}
// holat.aiMatn: AI "yozadigan" matn; holat.hisob: limit hisoblagichi; holat.chaqiruvlar: tashqariga ketgan so'rovlar
function tarmoq(holat = {}) {
  holat.chaqiruvlar = holat.chaqiruvlar || []; holat.hisob = holat.hisob || { n: 0 };
  const fn = async (url, init = {}) => {
    holat.chaqiruvlar.push({ url, init });
    const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
    if (url.endsWith('/auth/v1/user')) {
      if (holat.userHolati) return J({}, holat.userHolati);
      return J({ id: 'u-1', email: holat.email || 'ega@example.invalid' });
    }
    if (url.endsWith('/rest/v1/rpc/ai_limit_oshir')) {
      if (holat.limitXato) return J({ message: 'yo\'q' }, 404);
      holat.hisob.n = holat.limitBoshi !== undefined && holat.hisob.n === 0 ? holat.limitBoshi : holat.hisob.n + 1;
      return J(holat.hisob.n);
    }
    if (url === 'https://api.openai.com/v1/chat/completions') {
      if (holat.aiHolat) return J({}, holat.aiHolat);
      return J({ choices: [{ message: { content: holat.aiMatn } }] });
    }
    if (url === 'https://api.anthropic.com/v1/messages') {
      if (holat.aiHolat) return J({}, holat.aiHolat);
      return J({ content: [{ type: 'text', text: holat.aiMatn }] });
    }
    throw new Error('Kutilmagan manzil: ' + url);
  };
  return fn;
}
function so(tana, { jwt = 'jwt-sinov', origin = null, method = 'POST', apikey } = {}) {
  const h = { 'Content-Type': 'application/json' };
  if (jwt) h.Authorization = 'Bearer ' + jwt;
  if (origin) h.Origin = origin;
  if (apikey) h.apikey = apikey;
  return new Request('https://f.invalid/yordamchi', { method, headers: h, body: method === 'POST' ? (typeof tana === 'string' ? tana : JSON.stringify(tana)) : undefined });
}
const REJA = (o = {}) => ({ rejim: 'reja', savol: 'Bu oy oziq-ovqatga qancha sarfladim?', bugun: '2026-10-09', kategoriyalar: KAT, hisoblar: HIS, ...o });
const JAVOB = (o = {}) => ({ rejim: 'javob', savol: 'Bu oy oziq-ovqatga qancha?', sorovlar: [SOROV], natijalar: [{ jami: 1250000, yozuvlar_soni: 14 }], ...o });
const AIJ = (matn, davom = ['Daromadlarim?', 'Hisoblarimda qancha bor?']) => JSON.stringify({ matn, davom });
const PLAN = (...s) => JSON.stringify({ tur: 'sorovlar', sorovlar: s });
async function chaqir(tana, { holat = {}, env = {}, ...opt } = {}) {
  const r = await M.ishlov(so(tana, opt), muhitYasa(env), tarmoq(holat));
  return { r, j: r.status === 204 ? null : await r.json(), holat };
}

// ---------------- sxema tekshiruvi ----------------
const YAROQLI = {
  yigindi: SOROV,
  kategoriyalar: { ...SOROV, amal: 'kategoriyalar', kategoriya: null },
  qidiruv: { ...SOROV, amal: 'qidiruv', matn: 'non', kategoriya: null },
  taqqoslash: { ...SOROV, amal: 'taqqoslash', davr2: { dan: '2026-09-01', gacha: '2026-09-30' } },
  qarzlar: { ...SOROV, amal: 'qarzlar', tur: null, kategoriya: null },
  hisoblar: { ...SOROV, amal: 'hisoblar', tur: null, kategoriya: null },
  oylik_hisobot: { ...SOROV, amal: 'oylik_hisobot', tur: null, kategoriya: null },
  jadval: JADVAL,
  chegara: { amal: 'chegara', tur: 'xarajat', kategoriya: null, hisob: null },
  eng_katta_yozuvlar: { amal: 'eng_katta_yozuvlar', tur: 'xarajat', davr: D, kategoriya: null, limit: 5 },
  byudjet: { amal: 'byudjet', kategoriya: null },
  taxmin: { amal: 'taxmin' },
  jamgarma: { amal: 'jamgarma', davr: D },
};
test('sxema: 13 ta amalning to\'g\'ri shakli qabul qilinadi, nom ro\'yxatdagi aniq yozuvga keltiriladi', () => {
  for (const [amal, so] of Object.entries(YAROQLI)) assert.deepEqual(M.sorovniTekshir(so, KAT, HIS), so, amal);
  assert.equal(Object.keys(YAROQLI).length, 13);
  const s = M.sorovniTekshir({ ...SOROV, kategoriya: "  ro'zg‘or ", hisob: 'karta' }, KAT, HIS);
  assert.equal(s.kategoriya, "Ro'zg'or"); assert.equal(s.hisob, 'Karta');
  assert.deepEqual(M.sorovniTekshir({ amal: 'tushunarsiz', davr: { dan: 'x' } }, KAT, HIS), M.tushunarsizSorov());
});
test('sxema: yetishmagan ixtiyoriy kalitlar sukut bilan to\'ldiriladi (AI tushirib qoldirsa)', () => {
  assert.deepEqual(M.sorovniTekshir({ amal: 'jadval', guruh: 'kun', olchov: 'soni', tur: 'daromad', davr: D }, KAT, HIS),
    { amal: 'jadval', guruh: 'kun', olchov: 'soni', tur: 'daromad', davr: D, kategoriya: null, hisob: null, tartib: 'kamayish', limit: 5 });
  assert.deepEqual(M.sorovniTekshir({ amal: 'chegara' }, KAT, HIS), { amal: 'chegara', tur: null, kategoriya: null, hisob: null });
  assert.deepEqual(M.sorovniTekshir({ amal: 'byudjet' }, KAT, HIS), { amal: 'byudjet', kategoriya: null });
  assert.deepEqual(M.sorovniTekshir({ amal: 'yigindi', davr: D }, KAT, HIS), { ...SOROV, tur: null, kategoriya: null });
});
test('sxema: noto\'g\'rilari rad etiladi (null)', () => {
  const yomon = [
    null, 'matn', [], {}, { amal: 'ochirish' }, { ...SOROV, ortiqcha: 1 },
    { ...SOROV, davr: null }, { ...SOROV, davr: { dan: '2026-10-31', gacha: '2026-10-01' } }, { ...SOROV, davr: { dan: '2026-13-01', gacha: '2026-13-02' } },
    { ...SOROV, davr: { dan: '2026-02-30', gacha: '2026-03-01' } }, { ...SOROV, davr: { ...D, x: 1 } },
    { ...SOROV, davr2: D }, { ...SOROV, amal: 'taqqoslash' }, { ...SOROV, tur: 'otkazma' },
    { ...SOROV, kategoriya: "Yo'q kategoriya" }, { ...SOROV, hisob: 'Boshqa hisob' }, { ...SOROV, kategoriya: 5 }, { ...SOROV, matn: 'x'.repeat(41) },
    { ...SOROV, amal: 'qidiruv', matn: null },
    // jadval
    { ...JADVAL, guruh: 'yil2' }, { ...JADVAL, olchov: 'median' }, { ...JADVAL, tur: 'otkazma' }, { ...JADVAL, tartib: 'tasodif' }, { ...JADVAL, limit: 0 }, { ...JADVAL, limit: 21 }, { ...JADVAL, limit: 2.5 }, { ...JADVAL, limit: '5' },
    { ...JADVAL, davr: null }, { ...JADVAL, kategoriya: "Yo'q" }, { ...JADVAL, ortiqcha: 1 },
    { ...JADVAL, tur: 'aylanma', guruh: 'kategoriya' }, { ...JADVAL, tur: 'aylanma', guruh: 'kun' }, { ...JADVAL, tur: 'aylanma', guruh: 'hisob', kategoriya: 'Oziq-ovqat' },
    // boshqalar
    { amal: 'chegara', tur: 'otkazma', kategoriya: null, hisob: null }, { amal: 'chegara', davr: D },
    { ...YAROQLI.eng_katta_yozuvlar, limit: 11 }, { ...YAROQLI.eng_katta_yozuvlar, tur: null }, { ...YAROQLI.eng_katta_yozuvlar, davr: null },
    { amal: 'byudjet', kategoriya: 'Yo\'q' }, { amal: 'taxmin', davr: D }, { amal: 'jamgarma' }, { amal: 'jamgarma', davr: { dan: '2026-10-05', gacha: '2026-10-01' } },
  ];
  yomon.forEach((x, i) => assert.equal(M.sorovniTekshir(x, KAT, HIS), null, 'yomon #' + i));
  assert.ok(M.sorovniTekshir({ ...JADVAL, tur: 'aylanma', guruh: 'hisob' }, KAT, HIS)); assert.ok(M.sorovniTekshir({ ...JADVAL, tur: 'aylanma', guruh: 'yoq' }, KAT, HIS));
  for (const g of ['kategoriya', 'hisob', 'kun', 'hafta', 'oy', 'yil', 'hafta_kuni', 'yoq']) assert.ok(M.sorovniTekshir({ ...JADVAL, guruh: g }, KAT, HIS), g);
  for (const o of ['jami', 'soni', 'ortacha', 'eng_katta', 'eng_kichik']) assert.ok(M.sorovniTekshir({ ...JADVAL, olchov: o, tartib: 'osish', limit: 20 }, KAT, HIS), o);
});
test('reja shakli: sorovlar (1..5), suhbat, tashqari; eski bitta-so\'rov shakli ham; yaroqsizlari tashlanadi', () => {
  const R = (x) => M.rejaniTekshir(x, KAT, HIS);
  assert.deepEqual(R({ tur: 'sorovlar', sorovlar: [SOROV, JADVAL] }), { tur: 'sorovlar', sorovlar: [SOROV, JADVAL] });
  assert.equal(R({ tur: 'sorovlar', sorovlar: Array(7).fill(SOROV) }).sorovlar.length, M.SOROV_MAX, '5 tadan ko\'pi qirqiladi');
  assert.equal(M.SOROV_MAX, 5);
  assert.deepEqual(R({ tur: 'sorovlar', sorovlar: [{ amal: 'hack' }, SOROV, { ...JADVAL, limit: 99 }] }).sorovlar, [SOROV], 'yaroqsizlari tashlanadi');
  assert.equal(R({ tur: 'sorovlar', sorovlar: [{ amal: 'hack' }] }), null); assert.equal(R({ tur: 'sorovlar', sorovlar: [] }), null); assert.equal(R({ tur: 'sorovlar', sorovlar: [{ amal: 'tushunarsiz' }] }), null);
  assert.deepEqual(R({ tur: 'suhbat', matn: '  Salom!  Men  yordamchiman.  ' }), { tur: 'suhbat', matn: 'Salom! Men yordamchiman.' });
  assert.equal(R({ tur: 'suhbat' }), null); assert.equal(R({ tur: 'suhbat', matn: 'x'.repeat(601) }), null); assert.equal(R({ tur: 'suhbat', matn: '  ' }), null);
  assert.deepEqual(R({ tur: 'tashqari', matn: 'ob-havo' }), { tur: 'tashqari' });
  assert.deepEqual(R(SOROV), { tur: 'sorovlar', sorovlar: [SOROV] }, 'eski shakl');
  assert.equal(R({ tur: 'boshqa' }), null); assert.equal(R('matn'), null); assert.equal(R(null), null);
});
test('davom savollari sxemasi: 2..3 ta, har biri ≤ 40 belgi, raqamsiz; aks holda hammasi tashlanadi', () => {
  assert.deepEqual(M.davomniTekshir(['Daromadlarim?', 'Taksigachi?']), ['Daromadlarim?', 'Taksigachi?']);
  assert.equal(M.davomniTekshir(['a?', 'b?', 'c?']).length, 3);
  for (const yomon of [null, 'x', [], ['bitta?'], ['a?', 'b?', 'c?', 'd?'], ['a?', 5], ['5 ta?', 'b?'], ['x'.repeat(41), 'b?'], ['a?', 'a?'], ['a?', '  '], { 0: 'a' }]) assert.deepEqual(M.davomniTekshir(yomon), [], JSON.stringify(yomon));
  assert.equal(M.davomniTekshir(['x'.repeat(40), 'b?']).length, 2);
});
test('sana tayanchlari: hafta dushanbadan, shu/o\'tgan hafta, oy, yil (yanvarda o\'tgan oy — o\'tgan yil dekabri)', () => {
  const a = M.sanaTayanchlari('2026-10-09');
  assert.equal(a.hafta_kuni, 'Juma'); assert.deepEqual(a.shu_hafta, { dan: '2026-10-05', gacha: '2026-10-11' }); assert.deepEqual(a.otgan_hafta, { dan: '2026-09-28', gacha: '2026-10-04' });
  assert.deepEqual(a.shu_oy, { dan: '2026-10-01', gacha: '2026-10-31' }); assert.deepEqual(a.otgan_oy, { dan: '2026-09-01', gacha: '2026-09-30' });
  assert.deepEqual(a.shu_yil, { dan: '2026-01-01', gacha: '2026-12-31' }); assert.deepEqual(a.otgan_yil, { dan: '2025-01-01', gacha: '2025-12-31' });
  const b = M.sanaTayanchlari('2026-01-01'); assert.deepEqual(b.otgan_oy, { dan: '2025-12-01', gacha: '2025-12-31' }); assert.equal(b.hafta_kuni, 'Payshanba'); assert.deepEqual(b.shu_hafta, { dan: '2025-12-29', gacha: '2026-01-04' });
  assert.deepEqual(M.sanaTayanchlari('2024-03-10').otgan_oy, { dan: '2024-02-01', gacha: '2024-02-29' }, 'kabisa yili'); assert.equal(M.sanaTayanchlari('2026-10-11').hafta_kuni, 'Yakshanba'); assert.equal(M.sanaTayanchlari('2026-10-11').shu_hafta.dan, '2026-10-05');
});

// ---------------- reja rejimi ----------------
const kimdanAI = (holat) => holat.chaqiruvlar.filter((c) => c.url.includes('openai')).map((c) => JSON.parse(JSON.parse(c.init.body).messages[1].content));
test('reja: AI sorovlar qaytaradi -> { ok, reja } (yangi amallar, bir nechta so\'rov); chiqish sxemadan o\'tadi', async () => {
  const { r, j } = await chaqir(REJA(), { holat: { aiMatn: PLAN(SOROV, JADVAL, YAROQLI.chegara) } });
  assert.equal(r.status, 200); assert.deepEqual(j.reja, { tur: 'sorovlar', sorovlar: [SOROV, JADVAL, YAROQLI.chegara] });
  const b = await chaqir(REJA(), { holat: { aiMatn: '```json\n' + PLAN(YAROQLI.taxmin) + '\n```' } });
  assert.deepEqual(b.j.reja.sorovlar, [YAROQLI.taxmin]);
});
test('reja: yaroqsiz AI chiqishi -> tushunarsiz; kategoriya ro\'yxatda bo\'lmasa so\'rov tashlanadi', async () => {
  for (const aiMatn of ['bu JSON emas', '{"tur":"sorovlar"}', '[]', 'null', PLAN({ amal: 'hack' }), PLAN({ ...SOROV, kategoriya: "Yo'q" }), JSON.stringify({ tur: 'boshqa' })]) {
    const { r, j } = await chaqir(REJA(), { holat: { aiMatn } });
    assert.equal(r.status, 200, aiMatn); assert.deepEqual(j.reja, M.tushunarsizReja(), aiMatn);
  }
});
test('reja: suhbat (matnni AI yozadi) va tashqari; suhbat matnida savolda bo\'lmagan raqam bo\'lsa AI_RAQAM', async () => {
  const a = await chaqir(REJA({ savol: 'Kimsan?' }), { holat: { aiMatn: JSON.stringify({ tur: 'suhbat', matn: "Men Chuntak AI yordamchisiman. Masalan: «Shu oy xarajatim», «Hisoblarimda qancha bor?», «Byudjetimdan qancha qoldi?»." }) } });
  assert.equal(a.r.status, 200); assert.equal(a.j.reja.tur, 'suhbat'); assert.match(a.j.reja.matn, /Chuntak AI/);
  const b = await chaqir(REJA({ savol: 'Kimsan?' }), { holat: { aiMatn: JSON.stringify({ tur: 'suhbat', matn: "Men 24 soat ishlayman." }) } });
  assert.equal(b.r.status, 502); assert.equal(b.j.xato.kod, 'AI_RAQAM'); assert.equal(JSON.stringify(b.j).includes('24 soat'), false);
  const c = await chaqir(REJA({ savol: '3 ta maslahat bera olasanmi?' }), { holat: { aiMatn: JSON.stringify({ tur: 'suhbat', matn: "Ha, 3 ta maslahat beraman." }) } });
  assert.equal(c.r.status, 200, 'savoldagi raqam ruxsat');
  const d = await chaqir(REJA({ savol: 'Ob-havo qanday?' }), { holat: { aiMatn: JSON.stringify({ tur: 'tashqari' }) } });
  assert.deepEqual(d.j.reja, { tur: 'tashqari' });
});
test('reja: tarix (oxirgi 3 ta) AI ga beriladi; sana tayanchlari ham; yaroqsiz tarix elementi tashlanadi', async () => {
  const tarix = [1, 2, 3, 4].map((i) => ({ savol: 'savol ' + i, reja: { tur: 'sorovlar', sorovlar: [SOROV] }, matn: 'javob ' + i }));
  tarix.push({ savol: 5, reja: {}, matn: 'x' }); tarix.push({ savol: 'yaroqsiz reja', reja: { tur: 'x' }, matn: '' });
  const holat = { aiMatn: PLAN(SOROV) };
  const { r } = await chaqir(REJA({ savol: 'taksigachi?', tarix }), { holat });
  assert.equal(r.status, 200);
  const k = kimdanAI(holat)[0];
  assert.deepEqual(k.tarix.map((x) => x.savol), ['savol 2', 'savol 3', 'savol 4'], 'yaroqlilardan oxirgi 3 tasi: yaroqsizlar tashlangan');
  assert.deepEqual(k.tarix[2].reja.sorovlar[0], SOROV); assert.equal(k.tarix[2].matn, 'javob 4');
  assert.equal(k.savol, 'taksigachi?'); assert.equal(k.bugun, '2026-10-09'); assert.equal(k.hafta_kuni, 'Juma'); assert.deepEqual(k.shu_hafta, { dan: '2026-10-05', gacha: '2026-10-11' }); assert.deepEqual(k.otgan_oy, { dan: '2026-09-01', gacha: '2026-09-30' });
  const h2 = { aiMatn: PLAN(SOROV) }; await chaqir(REJA(), { holat: h2 }); assert.deepEqual(kimdanAI(h2)[0].tarix, []);
  const h3 = { aiMatn: PLAN(SOROV) }; await chaqir(REJA({ tarix: 'x' }), { holat: h3 }); assert.deepEqual(kimdanAI(h3)[0].tarix, [], 'noto\'g\'ri tarix = bo\'sh');
});
test('tarix 1500 belgigacha qirqiladi: eng yangisi saqlanadi, matn qisqartiriladi, sig\'masa eski elementlar tashlanadi', () => {
  const el = (i, n) => ({ savol: 'savol ' + i, reja: { tur: 'sorovlar', sorovlar: [SOROV] }, matn: 'm'.repeat(n) });
  const t = M.tarixniQirq([el(1, 500), el(2, 500), el(3, 500)]);
  assert.ok(JSON.stringify(t).length <= 1500 + 2 * 1, JSON.stringify(t).length); assert.equal(t[t.length - 1].savol, 'savol 3'); assert.ok(t[t.length - 1].matn.length > 0);
  const kichik = M.tarixniQirq([el(1, 50), el(2, 50), el(3, 50)]); assert.equal(kichik.length, 3); assert.equal(kichik[0].matn.length, 50);
  const katta = M.tarixniQirq([el(1, 600), el(2, 600), el(3, 600)]); assert.ok(katta.reduce((a, x) => a + JSON.stringify(x).length, 0) <= 1500); assert.equal(katta[katta.length - 1].savol, 'savol 3');
  assert.deepEqual(M.tarixniQirq([]), []);
  assert.equal(M.TARIX_BELGI, 1500); assert.equal(M.TARIX_MAX, 3);
});

// ---------------- raqam tekshiruvi ----------------
test('raqam: natijadagi raqamlar o\'tadi; boshqa raqam rad etiladi', () => {
  const kir = [{ jami: 1250000, soni: 14, oldingi: 1000000 }, D];
  assert.ok(M.raqamlarMosmi("Oktabrda 1 250 000 so'm sarfladingiz (14 ta yozuv).", kir));
  assert.ok(M.raqamlarMosmi('Jami 1250000 so\'m.', kir)); assert.ok(M.raqamlarMosmi('Jami 1 250 000 so\'m.', kir)); assert.ok(M.raqamlarMosmi('Taxminan 1,25 mln so\'m.', kir));
  assert.ok(M.raqamlarMosmi("2026-yil 1-oktabrdan 31-oktabrgacha 14 ta.", kir)); assert.ok(M.raqamlarMosmi("Oziq-ovqat va transport uchun to'ladingiz.", kir));
  for (const yomon of ["Jami 1 350 000 so'm.", "Jami 125 000 so'm.", "Jami 1,4 mln so'm.", '15 ta yozuv.', "Jami 1 250 000 va 14 ta, o'tgan oy 900 000.", "Kuniga 3 000 so'm."]) assert.equal(M.raqamlarMosmi(yomon, kir), false, yomon);
});
test('raqam: matndan raqamlarni ajratish', () => {
  const q = (s) => M.matndanRaqamlar(s).map((x) => x.qiymatlar);
  assert.deepEqual(q("1 200 000 so'm"), [[1200000]]); assert.deepEqual(q('5 ta 3 ta'), [[5], [3]]); assert.deepEqual(q('12,5%'), [[12.5]]); assert.deepEqual(q('1.200'), [[1.2, 1200]]);
});

// ---------------- javob rejimi ----------------
test('javob: AI { matn, davom } qaytaradi; mos matn va davom savollari qaytadi', async () => {
  const { r, j } = await chaqir(JAVOB(), { holat: { aiMatn: AIJ("Bu oy oziq-ovqatga 1 250 000 so'm sarfladingiz (14 ta yozuv).", ['Daromadlarim qancha?', 'Kategoriyalar bo\'yicha?', 'Taxmin qilib ber']) } });
  assert.equal(r.status, 200); assert.match(j.matn, /1 250 000/); assert.deepEqual(j.davom, ['Daromadlarim qancha?', "Kategoriyalar bo'yicha?", 'Taxmin qilib ber']);
});
test('javob: davom savollari sxemadan o\'tmasa tashlanadi, javob o\'zi qoladi; oddiy matn (JSON emas) ham javob', async () => {
  for (const davom of [['bitta?'], ['5 ta?', 'b?'], ['x'.repeat(41), 'b?'], 'matn', null, undefined, ['a?', 'b?', 'c?', 'd?']]) {
    const { r, j } = await chaqir(JAVOB(), { holat: { aiMatn: JSON.stringify({ matn: "Jami 1 250 000 so'm.", davom }) } });
    assert.equal(r.status, 200); assert.equal(j.matn, "Jami 1 250 000 so'm."); assert.deepEqual(j.davom, [], JSON.stringify(davom));
  }
  const p = await chaqir(JAVOB(), { holat: { aiMatn: "Jami 1 250 000 so'm." } });
  assert.equal(p.r.status, 200); assert.equal(p.j.matn, "Jami 1 250 000 so'm."); assert.deepEqual(p.j.davom, []);
});
test('javob: raqam mos kelmasa AI_RAQAM (matn qaytmaydi); savoldagi raqam ruxsat ("2-haftasida")', async () => {
  const yomon = await chaqir(JAVOB(), { holat: { aiMatn: AIJ("Bu oy oziq-ovqatga 1 300 000 so'm sarfladingiz.") } });
  assert.equal(yomon.r.status, 502); assert.equal(yomon.j.xato.kod, 'AI_RAQAM'); assert.equal(yomon.j.matn, undefined); assert.equal(JSON.stringify(yomon.j).includes('1 300 000'), false);
  const savol = "Sentabrning 2-haftasida eng ko'p xarajat nimaga bo'lgan?";
  assert.equal((await chaqir(JAVOB({ savol }), { holat: { aiMatn: AIJ("Sentabrning 2-haftasida eng ko'p 1 250 000 so'm ketgan.") } })).r.status, 200);
  assert.equal((await chaqir(JAVOB({ savol }), { holat: { aiMatn: AIJ("Sentabrning 3-haftasida 1 250 000 so'm ketgan.") } })).j.xato.kod, 'AI_RAQAM');
  assert.equal((await chaqir(JAVOB({ savol }), { holat: { aiMatn: AIJ("2-haftasida 1 300 000 so'm ketgan.") } })).j.xato.kod, 'AI_RAQAM', 'natijadagi raqam tekshiruvi o\'zgarmagan');
});
test('javob: bir nechta so\'rov — raqam HAR natijadan ruxsat, boshqa natijadan emas-ku? (hamma natijalar umumiy ro\'yxat)', async () => {
  const k = { sorovlar: [SOROV, JADVAL], natijalar: [{ jami: 1000, yozuvlar_soni: 3 }, { tur: 'xarajat', umumiy: 5000, qatorlar: [{ nom: 'Taksi', qiymat: 4000, foiz: 80 }] }] };
  assert.equal((await chaqir(JAVOB(k), { holat: { aiMatn: AIJ("Jami 1 000 so'm; Taksi 4 000 so'm (80%).") } })).r.status, 200);
  assert.equal((await chaqir(JAVOB(k), { holat: { aiMatn: AIJ("Taksi 4 500 so'm.") } })).j.xato.kod, 'AI_RAQAM');
});
test('javob: tarix AI ga beriladi (raqamlari ruxsat etilmaydi); taxmin so\'zi shart; bo\'sh/uzun/noto\'g\'ri matn', async () => {
  const tarix = [{ savol: 'Oldingi', reja: { tur: 'sorovlar', sorovlar: [SOROV] }, matn: 'Oldin 777 so\'m edi' }];
  const h = { aiMatn: AIJ("Jami 1 250 000 so'm.") };
  await chaqir(JAVOB({ tarix }), { holat: h }); assert.equal(kimdanAI(h)[0].tarix[0].matn, "Oldin 777 so'm edi");
  assert.equal((await chaqir(JAVOB({ tarix }), { holat: { aiMatn: AIJ("Oldin 777 so'm edi.") } })).j.xato.kod, 'AI_RAQAM', 'tarixdagi raqam ruxsat emas');
  const tx = { sorovlar: [YAROQLI.taxmin], natijalar: [{ shu_kungacha: 100000, kunlik_ortacha: 11111, qolgan_kunlar: 22, kutilayotgan_jami: 344442 }] };
  assert.equal((await chaqir(JAVOB(tx), { holat: { aiMatn: AIJ("Oy oxirigacha taxminan 344 442 so'm sarflaysiz.") } })).r.status, 200);
  const yoq = await chaqir(JAVOB(tx), { holat: { aiMatn: AIJ("Oy oxirigacha 344 442 so'm sarflaysiz.") } });
  assert.equal(yoq.r.status, 502); assert.equal(yoq.j.xato.kod, 'AI_SXEMA');
  for (const aiMatn of [JSON.stringify({ matn: '   ' }), JSON.stringify({ davom: ['a?', 'b?'] }), JSON.stringify({ matn: 'a '.repeat(400) }), '[1]', 'null']) assert.equal((await chaqir(JAVOB(), { holat: { aiMatn } })).j.xato.kod, 'AI_SXEMA', aiMatn);
  assert.equal((await chaqir(JAVOB(), { holat: { aiMatn: '  ' } })).j.xato.kod, 'AI_PROVAYDER');
});
test('javob kirishi: 1..5 so\'rov, natijalar soni teng; taqiqlangan kalitlar yangi natijalarda ham rad etiladi', async () => {
  const olti = { sorovlar: Array(6).fill(SOROV), natijalar: Array(6).fill({ jami: 1 }) };
  const besh = { sorovlar: Array(5).fill(SOROV), natijalar: Array(5).fill({ jami: 1 }) };
  assert.equal((await chaqir(JAVOB(besh), { holat: { aiMatn: AIJ('Jami 1 so\'m.') } })).r.status, 200, '5 ta o\'tadi');
  assert.equal((await chaqir(JAVOB(olti), { holat: { aiMatn: AIJ('x') } })).j.xato.kod, 'AI_KIRISH', '6 ta rad etiladi');
  const yomonlar = [
    JAVOB({ sorovlar: [], natijalar: [] }), JAVOB({ sorovlar: [SOROV], natijalar: [] }), JAVOB({ sorovlar: [SOROV, SOROV], natijalar: [{ jami: 1 }] }), JAVOB({ sorovlar: SOROV, natijalar: { jami: 1 } }),
    JAVOB({ sorovlar: [{ amal: 'tushunarsiz' }] }), JAVOB({ sorovlar: [{ amal: 'hack' }] }), JAVOB({ sorovlar: [{ ...JADVAL, limit: 50 }] }), JAVOB({ natijalar: [null] }), JAVOB({ natijalar: [[1]] }), JAVOB({ natijalar: ['x'] }),
    JAVOB({ natijalar: [{ shaxs: 'Ali', jami: 1 }] }), JAVOB({ natijalar: [{ izoh: 'x' }] }), JAVOB({ natijalar: [{ yozuvlar: [], jami: 1 }] }), JAVOB({ natijalar: [{ qatorlar: [{ nom: 'a', izoh: 'bozor' }] }] }),
    JAVOB({ natijalar: [{ royxat: [{ sana: '2026-10-01', shaxs: 'Vali', summa: 5 }] }] }), JAVOB({ natijalar: [{ qatorlar: [{ nom: 'x'.repeat(61), qiymat: 1 }] }] }), 
    JAVOB({ natijalar: [{ a: { b: { c: { d: { e: { f: 1 } } } } } }] }), JAVOB({ sorovlar: [SOROV], natijalar: [{ jami: 1 }], tarix: 7, savol: '' }),
    JAVOB({ sorovlar: Array(5).fill(SOROV), natijalar: Array(5).fill({ qatorlar: Array(60).fill({ nom: 'Uzun nom uzun nom uzun nom uzun nom', qiymat: 123456789 }) }) }),
  ];
  for (const [i, t] of yomonlar.entries()) { const { r, j } = await chaqir(t, { holat: { aiMatn: AIJ('Jami 1 so\'m.') } }); assert.equal(r.status, 400, 'yomon #' + i); assert.equal(j.xato.kod, 'AI_KIRISH', 'yomon #' + i); }
  const yangi = { sorovlar: [JADVAL, YAROQLI.eng_katta_yozuvlar, YAROQLI.chegara], natijalar: [
    { tur: 'xarajat', guruh: 'kategoriya', olchov: 'jami', umumiy: 9000, qatorlar_soni: 2, qatorlar: [{ nom: 'Taksi', qiymat: 6000, foiz: 67 }, { nom: 'Ovqat', qiymat: 3000, foiz: 33 }] },
    { tur: 'xarajat', topilgan_soni: 4, royxat: [{ sana: '2026-10-02', kategoriya: 'Taksi', summa: 5000 }] },
    { birinchi_sana: '2024-03-01', oxirgi_sana: '2026-10-09', yozuvlar_soni: 120 }] };
  const ok = await chaqir(JAVOB(yangi), { holat: { aiMatn: AIJ("Taksi 6 000 so'm (67%), eng katta yozuv 5 000 so'm, birinchi yozuv 2024-yilda.") } });
  assert.equal(ok.r.status, 200, JSON.stringify(ok.j));
});
test('javob: AI ga faqat ruxsat etilgan ma\'lumot ketadi (savol, tarix, so\'rovlar, natijalar)', async () => {
  const h = { aiMatn: AIJ("1 250 000 so'm, 14 ta.") }; await chaqir(JAVOB(), { holat: h });
  assert.deepEqual(Object.keys(kimdanAI(h)[0]).sort(), ['natijalar', 'savol', 'sorovlar', 'tarix']);
  const a = { aiMatn: PLAN(SOROV) }; await chaqir(REJA(), { holat: a });
  assert.deepEqual(Object.keys(kimdanAI(a)[0]).sort(), ['bugun', 'hafta_kuni', 'hisoblar', 'kategoriyalar', 'otgan_hafta', 'otgan_oy', 'otgan_yil', 'savol', 'shu_hafta', 'shu_oy', 'shu_yil', 'tarix']);
});
test('AI ko\'rsatmasi: davr qoidalari, davom savollari, yangi amallar va 5 ta so\'rov yozilgan', () => {
  const kod = readFileSync(join(BU, 'index.ts'), 'utf8');
  for (const s of ['DUSHANBADAN', '(N-1)*7+1 .. N*7', 'BITTA oraliq', 'oxirgi N kun', 'yoz', "o'tgan yil", 'boshidan beri', 'DAVOM SAVOLLARI', 'tarixdagi oldingi rejadan', '1 dan 5 tagacha', 'suhbat', 'tashqari', 'tushunarsiz', 'jadval', 'chegara', 'eng_katta_yozuvlar', 'byudjet', 'taxmin', 'jamgarma', 'aylanma', '3–4 ta misol', 'RAQAMSIZ']) assert.ok(kod.includes(s), s);
});

test('davr misollari: "sentabrning 2 va 3-haftasi" BITTA oraliq (8..21), "oxirgi 7 kun", "o\'tgan yil", "boshidan beri" — sxemadan o\'tadi va bir so\'rov bo\'lib qoladi', async () => {
  const dv = (dan, gacha) => ({ ...JADVAL, davr: { dan, gacha }, limit: 3 });
  const planlar = [dv('2026-09-08', '2026-09-21'), dv('2026-10-03', '2026-10-09'), dv('2025-01-01', '2025-12-31'), dv('2000-01-01', '2026-10-09')];
  for (const so of planlar) { const { j } = await chaqir(REJA({ savol: 'sinov' }), { holat: { aiMatn: PLAN(so) } }); assert.deepEqual(j.reja.sorovlar, [so]); }
  const { j } = await chaqir(REJA(), { holat: { aiMatn: PLAN(dv('2026-01-01', '2026-01-31'), dv('2026-03-01', '2026-03-31')) } });
  assert.equal(j.reja.sorovlar.length, 2, 'ketma-ket bo\'lmaganlar alohida so\'rovlar');
  const kod = readFileSync(join(BU, 'index.ts'), 'utf8'); assert.ok(kod.includes('2 va 3-hafta = 8..21') && kod.includes('8..14-sentabr'));
});

// ---------------- ruxsat ----------------
test('ruxsat: Authorization yo\'q -> 401 AI_RUXSAT (AI chaqirilmaydi); yaroqsiz token -> 401', async () => {
  const a = await chaqir(REJA(), { jwt: null, holat: { aiMatn: PLAN(SOROV) } });
  assert.equal(a.r.status, 401); assert.equal(a.j.xato.kod, 'AI_RUXSAT'); assert.equal(a.holat.chaqiruvlar.length, 0);
  const b = await chaqir(REJA(), { holat: { userHolati: 401 } }); assert.equal(b.r.status, 401); assert.ok(!b.holat.chaqiruvlar.some((c) => c.url.includes('api.openai.com')));
});
test('ruxsat: ro\'yxatda yo\'q email -> 403, limit sanalmaydi va AI chaqirilmaydi; sozlanmagan bo\'lsa hech kimga; harfga befarq', async () => {
  const { r, j, holat } = await chaqir(REJA(), { holat: { email: 'begona@example.invalid', aiMatn: PLAN(SOROV) } });
  assert.equal(r.status, 403); assert.equal(j.xato.kod, 'AI_RUXSAT'); assert.deepEqual(holat.chaqiruvlar.map((c) => c.url), ['https://x.invalid/auth/v1/user']);
  assert.equal((await chaqir(REJA(), { env: { AI_RUXSAT_EMAIL: '' }, holat: { aiMatn: PLAN(SOROV) } })).r.status, 403);
  assert.equal((await chaqir(REJA(), { env: { AI_RUXSAT_EMAIL: 'EGA@example.invalid' }, holat: { aiMatn: PLAN(SOROV) } })).r.status, 200);
  assert.equal(M.emailRuxsatMi('a@b.c', undefined), false); assert.equal(M.emailRuxsatMi('', 'a@b.c'), false);
});
test('ruxsat: ochiq kalit so\'rov sarlavhasidan olinadi', async () => {
  const { holat } = await chaqir(REJA(), { apikey: 'ilova-ochiq-kalit', holat: { aiMatn: PLAN(SOROV) } });
  assert.equal(holat.chaqiruvlar[0].init.headers.apikey, 'ilova-ochiq-kalit');
});

// ---------------- cheklovlar ----------------
test('savol 300 belgidan uzun bo\'lsa AI_UZUN (AI chaqirilmaydi, limit sanalmaydi); 300 belgi o\'tadi', async () => {
  const uzun = await chaqir(REJA({ savol: 'a'.repeat(301) }), { holat: { aiMatn: PLAN(SOROV) } });
  assert.equal(uzun.r.status, 413); assert.equal(uzun.j.xato.kod, 'AI_UZUN'); assert.ok(!uzun.holat.chaqiruvlar.some((c) => c.url.includes('api.openai.com') || c.url.includes('ai_limit')));
  assert.equal((await chaqir(REJA({ savol: 'a'.repeat(300) }), { holat: { aiMatn: PLAN(SOROV) } })).r.status, 200);
});
test('noto\'g\'ri kirish -> 400 AI_KIRISH', async () => {
  const yomon = ['json emas', [], { rejim: 'boshqa', savol: 'x' }, { rejim: 'reja' }, REJA({ savol: '   ' }), REJA({ savol: 5 }), REJA({ bugun: '2026-99-99' }), REJA({ kategoriyalar: 'x' }), REJA({ hisoblar: [1] }),
    REJA({ kategoriyalar: Array(101).fill('a') }), REJA({ kategoriyalar: ['x'.repeat(61)] }), JAVOB({ sorovlar: null }), { rejim: 'javob', savol: 'x' }];
  for (const [i, t] of yomon.entries()) { const { r, j } = await chaqir(t, { holat: { aiMatn: PLAN(SOROV) } }); assert.equal(r.status, 400, 'yomon #' + i); assert.equal(j.xato.kod, 'AI_KIRISH', 'yomon #' + i); }
});
test('limit: kuniga 200 ta o\'tadi, 201-chisi 429 AI_LIMIT va AI chaqirilmaydi', async () => {
  assert.equal(M.KUNLIK_LIMIT, 200); assert.equal(M.SAVOL_MAX, 300);
  assert.equal((await chaqir(REJA(), { holat: { aiMatn: PLAN(SOROV), limitBoshi: 200 } })).r.status, 200);
  const h = { aiMatn: PLAN(SOROV), limitBoshi: 201 }; const r = await chaqir(REJA(), { holat: h });
  assert.equal(r.r.status, 429); assert.equal(r.j.xato.kod, 'AI_LIMIT'); assert.ok(!h.chaqiruvlar.some((c) => c.url.includes('api.openai.com')));
  assert.equal((await chaqir(REJA(), { holat: { aiMatn: PLAN(SOROV), limitBoshi: 100 } })).r.status, 200, '100 endi limit emas');
});
test('limit: hisoblab bo\'lmasa (007 ishga tushirilmagan) so\'rov rad etiladi (AI_LIMIT); RPC foydalanuvchi tokeni bilan', async () => {
  const { r, j, holat } = await chaqir(REJA(), { holat: { limitXato: true, aiMatn: PLAN(SOROV) } });
  assert.equal(r.status, 503); assert.equal(j.xato.kod, 'AI_LIMIT'); assert.ok(!holat.chaqiruvlar.some((c) => c.url.includes('api.openai.com')));
  const h = { aiMatn: PLAN(SOROV) }; await chaqir(REJA(), { holat: h });
  assert.equal(h.chaqiruvlar.find((x) => x.url.endsWith('/rpc/ai_limit_oshir')).init.headers.Authorization, 'Bearer jwt-sinov');
});
test('AI chiqish tokenlari cheklangan (max_completion_tokens / max_tokens)', async () => {
  const a = await chaqir(REJA(), { holat: { aiMatn: PLAN(SOROV) } });
  const ta = JSON.parse(a.holat.chaqiruvlar.find((c) => c.url.includes('openai')).init.body); assert.ok(ta.max_completion_tokens > 0 && ta.max_completion_tokens <= 1000); assert.equal(ta.response_format.type, 'json_object');
  const b = await chaqir(JAVOB(), { env: { AI_PROVAYDER: 'claude' }, holat: { aiMatn: AIJ("Jami 1 250 000 so'm.") } });
  const tb = JSON.parse(b.holat.chaqiruvlar.find((c) => c.url.includes('anthropic')).init.body); assert.ok(tb.max_tokens > 0 && tb.max_tokens <= 600);
  assert.equal(b.r.status, 200);
});

// ---------------- CORS ----------------
test('CORS: faqat ruxsat etilgan manzillar; xato javoblarida ham sarlavha bor', async () => {
  for (const o of ['https://jahon-gir.github.io', 'http://localhost:8000']) assert.equal((await chaqir(REJA(), { origin: o, holat: { aiMatn: PLAN(SOROV) } })).r.headers.get('Access-Control-Allow-Origin'), o);
  for (const o of ['https://yomon.example', 'http://localhost:3000', 'https://jahon-gir.github.io.yomon.example', null]) assert.equal((await chaqir(REJA(), { origin: o, holat: { aiMatn: PLAN(SOROV) } })).r.headers.get('Access-Control-Allow-Origin'), null, String(o));
  const pre = await M.ishlov(so(null, { method: 'OPTIONS', origin: 'https://jahon-gir.github.io' }), muhitYasa(), tarmoq());
  assert.equal(pre.status, 204); assert.match(pre.headers.get('Access-Control-Allow-Headers'), /authorization/);
  assert.equal((await M.ishlov(so(null, { method: 'GET' }), muhitYasa(), tarmoq())).status, 405);
  const x = await chaqir(REJA(), { jwt: null, origin: 'https://jahon-gir.github.io' }); assert.equal(x.r.status, 401); assert.equal(x.r.headers.get('Access-Control-Allow-Origin'), 'https://jahon-gir.github.io');
});

// ---------------- provayder ----------------
test('provayder: openai va claude sozlama bilan almashadi, har biri o\'z kaliti va manzili bilan', async () => {
  const o = await chaqir(REJA(), { holat: { aiMatn: PLAN(SOROV) } });
  const co = o.holat.chaqiruvlar.find((c) => c.url.includes('openai'));
  assert.equal(co.init.headers.Authorization, 'Bearer sinov-kalit-1'); assert.equal(JSON.parse(co.init.body).model, 'sinov-model'); assert.ok(!o.holat.chaqiruvlar.some((c) => c.url.includes('anthropic')));
  const k = await chaqir(REJA(), { env: { AI_PROVAYDER: 'Claude', AI_MODEL: 'claude-sinov' }, holat: { aiMatn: PLAN(SOROV) } });
  const ck = k.holat.chaqiruvlar.find((c) => c.url.includes('anthropic'));
  assert.equal(ck.init.headers['x-api-key'], 'sinov-kalit-2'); assert.equal(ck.init.headers['anthropic-version'], '2023-06-01'); assert.equal(JSON.parse(ck.init.body).model, 'claude-sinov'); assert.deepEqual(k.j.reja.sorovlar, [SOROV]);
});
test('provayder: sozlanmagan/xato -> AI_PROVAYDER; tarmoq uzilsa NETWORK; kalit javobda ko\'rinmaydi', async () => {
  for (const env of [{ AI_PROVAYDER: '' }, { AI_PROVAYDER: 'gemini' }, { AI_MODEL: '' }, { OPENAI_API_KEY: '' }, { AI_PROVAYDER: 'claude', ANTHROPIC_API_KEY: '' }]) {
    const { r, j } = await chaqir(REJA(), { env, holat: { aiMatn: PLAN(SOROV) } }); assert.equal(r.status, 502); assert.equal(j.xato.kod, 'AI_PROVAYDER');
  }
  const a = await chaqir(REJA(), { holat: { aiHolat: 500 } }); assert.equal(a.j.xato.kod, 'AI_PROVAYDER'); assert.equal(JSON.stringify(a.j).includes('sinov-kalit'), false);
  const fn = async (url) => { if (url.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: 'u', email: 'ega@example.invalid' })); if (url.includes('ai_limit')) return new Response('1'); throw new TypeError('fetch failed'); };
  const r = await M.ishlov(so(REJA()), muhitYasa(), fn); const j = await r.json(); assert.equal(r.status, 503); assert.equal(j.xato.kod, 'NETWORK');
});
test('xato javoblari: faqat belgilangan kodlar, o\'zbekcha sabab bilan', async () => {
  const kodlar = new Set();
  const hs = [chaqir(REJA(), { jwt: null }), chaqir(REJA(), { holat: { email: 'x@y.z' } }), chaqir('yomon'), chaqir(REJA({ savol: 'a'.repeat(301) })), chaqir(REJA(), { holat: { limitBoshi: 201 } }),
    chaqir(REJA(), { holat: { aiHolat: 500 } }), chaqir(JAVOB(), { holat: { aiMatn: JSON.stringify({ x: 1 }) } }), chaqir(JAVOB(), { holat: { aiMatn: AIJ('999') } })];
  for (const { j } of await Promise.all(hs)) { assert.ok(M.XATO_KODLARI.includes(j.xato.kod)); assert.ok(j.xato.sabab.length > 5); kodlar.add(j.xato.kod); }
  assert.deepEqual([...kodlar].sort(), ['AI_KIRISH', 'AI_LIMIT', 'AI_PROVAYDER', 'AI_RAQAM', 'AI_RUXSAT', 'AI_SXEMA', 'AI_UZUN']);
  assert.deepEqual([...M.XATO_KODLARI].sort(), ['AI_KIRISH', 'AI_LIMIT', 'AI_PROVAYDER', 'AI_RAQAM', 'AI_RUXSAT', 'AI_SXEMA', 'AI_UZUN', 'NETWORK']);
});

// ---------------- fayl xususiyatlari (repo ochiq) ----------------
test('index.ts: bitta fayl (mahalliy import yo\'q), logga yozmaydi, kalit yoki email yozilmagan', () => {
  const kod = readFileSync(join(BU, 'index.ts'), 'utf8');
  const kodsiz = kod.replace(/\/\/[^\n]*/g, '');
  assert.equal(/^\s*import\s/m.test(kodsiz), false, 'import bor');
  assert.equal(/\bimport\s*\(/.test(kodsiz), false);
  assert.equal(/\brequire\s*\(/.test(kodsiz), false);
  assert.equal(/\bconsole\./.test(kodsiz), false, 'console.* bor: savol/natija logga tushishi mumkin');
  assert.equal(/\bDeno\.writeFile|Deno\.writeTextFile/.test(kodsiz), false);
  assert.equal(/sk-[A-Za-z0-9_-]{16,}|sk-ant-|eyJ[A-Za-z0-9_-]{20,}|sb_secret_|service_role/.test(kod.replace(/service_role[^\n]*/g, '')), false);
  assert.equal(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/.test(kod), false, 'email yozilgan');
});
test('repo qidiruvi: supabase/ ichida maxfiy kalit, haqiqiy email, parol yo\'q', () => {
  const ildiz = join(BU, '..', '..');
  const royxat = [];
  (function yur(d) { for (const n of readdirSync(d)) { const p = join(d, n); const s = statSync(p); if (s.isDirectory()) yur(p); else if (/\.(ts|mjs|js|sql|md|sh|json|toml)$/.test(n)) royxat.push(p); } })(ildiz);
  assert.ok(royxat.length >= 5);
  for (const f of royxat) {
    if (/test\.mjs$/.test(f)) continue;   // sinov faylining o'zida qidiruv andozalari bor
    const t = readFileSync(f, 'utf8');
    assert.equal(/sk-ant-[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9]{20,}|sk-proj-|sb_secret_[A-Za-z0-9]|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/.test(t), false, f);
    assert.equal(/(OPENAI_API_KEY|ANTHROPIC_API_KEY|AI_RUXSAT_EMAIL)\s*[:=]\s*["']?[A-Za-z0-9@]/.test(t.replace(/'(sinov|ega|boshqa)[^']*'/g, '')), false, f);
  }
});
