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

// =====================================================================
// YOZUV REJIMI (gap -> yozuv). O'z model va OpenAI taqlid qilinadi, tarmoqqa chiqilmaydi.
// =====================================================================
const MODEL_MANZIL = 'https://model.sinov.invalid';
const YOZ_ASL = "Gapdan moliyaviy yozuvlarni ajrat. tur: xarajat, daromad, qarz_berdim, qarz_oldim, qarz_qaytardim, qarz_qaytarildi yoki otkazma. Qarz turlari faqat gapda qarz, qarzga, berib turdim, olib turdim, qaytardim kabi so'z bo'lsa; oddiy \"berdim\" va komissiya xarajat. otkazma faqat o'z hisoblaring orasida. Kategoriya, hisob va hisob2 ni ro'yxatdagi nom bilan aynan yoz. Kimga yoki qayerga ekanini bildiruvchi kategoriya ro'yxatda bo'lsa o'shani tanla. Eski yozuvlar berilsa, o'sha narsa uchun o'sha kategoriyani tanla. Mos kategoriya bo'lmasa ro'yxatdagi umumiy (Boshqa ...) kategoriyani, bo'lmasa null. Hisob nomi ro'yxatdagi aniq bitta hisobga mos kelmasa hisob null. summa_matn ga summani gapda qanday aytilgan bo'lsa shunday ko'chir. Narx dona uchun aytilsa soni va narx_matn ni to'ldir. izoh ga nima uchunligini yoz. Kelajakdagi reja yozuv emas. Yozuv bo'lmasa bo'sh ro'yxat. Faqat JSON ro'yxat qaytar.";
const YKAT = ['Taksi', 'Ovqatlanish', "Uy-ro'zg'or", 'Boshqa xarajat', 'Maosh'];
const YHIS = [{ nom: 'Cash UZS', turi: 'naqd' }, { nom: 'Uzum', turi: 'karta' }, { nom: 'Humo kartam', turi: 'karta' }];
const YOZUV = (o = {}) => ({ rejim: 'yozuv', gap: 'bugun bozorda 2 ta non va sut oldim 18 ming', bugun: '2026-10-13', kategoriyalar: YKAT, hisoblar: YHIS, ...o });
const MY = (o = {}) => ({ tur: 'xarajat', summa_matn: '18 ming', soni: null, narx_matn: null, kategoriya: "Uy-ro'zg'or", hisob: null, hisob_turi: null, hisob2: null, shaxs: null, sana: 'bugun', izoh: 'non va sut', ...o });
const YE = (o = {}) => ({ ...o });
// holat.oz: { matn } | { xato: 'tarmoq'|'vaqt'|500 } ; holat.openai: { matn } | { xato: 500 }
function tarmoqY(holat = {}) {
  holat.chaqiruvlar = holat.chaqiruvlar || []; holat.hisob = holat.hisob || { n: 0 };
  return async (url, init = {}) => {
    holat.chaqiruvlar.push({ url, init });
    const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
    if (url.endsWith('/auth/v1/user')) return J({ id: 'u-1', email: holat.email || 'ega@example.invalid' });
    if (url.endsWith('/rest/v1/rpc/ai_limit_oshir')) { holat.hisob.n = holat.limitBoshi !== undefined && holat.hisob.n === 0 ? holat.limitBoshi : holat.hisob.n + 1; return J(holat.hisob.n); }
    if (url === MODEL_MANZIL + '/api/chat') {
      const oz = holat.oz || {};
      if (oz.xato === 'tarmoq') throw new TypeError('fetch failed');
      if (oz.xato === 'vaqt') throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
      if (typeof oz.xato === 'number') return J({}, oz.xato);
      return J({ model: 'chuntak-v5', message: { role: 'assistant', content: oz.matn } });
    }
    if (url === 'https://api.openai.com/v1/chat/completions') {
      const o = holat.openai || {};
      if (o.xato) return J({}, o.xato);
      return J({ choices: [{ message: { content: o.matn } }] });
    }
    throw new Error('Kutilmagan manzil: ' + url);
  };
}
const YENV = { MODEL_URL: MODEL_MANZIL, MODEL_KALIT: 'sinov-model-kalit-123456' };
async function yoz(tana, { holat = {}, env = YENV, ...opt } = {}) {
  const r = await M.ishlov(so(tana, opt), muhitYasa(env), tarmoqY(holat));
  return { r, j: await r.json(), holat };
}
const ozSoz = (h) => h.chaqiruvlar.filter((c) => c.url === MODEL_MANZIL + '/api/chat').map((c) => ({ ...c, tana: JSON.parse(c.init.body) }));
const oaSoz = (h) => h.chaqiruvlar.filter((c) => c.url.includes('openai.com')).map((c) => ({ ...c, tana: JSON.parse(c.init.body) }));
const CTX = { gap: 'bugun bozorda 2 ta non va sut oldim 18 ming', bugun: '2026-10-13', kategoriyalar: YKAT, hisobTurlari: YHIS };

// ---------------- so'z -> son ----------------
test('sonOgir: barcha misollar (raqam, so\'z, aralash, qo\'shimcha, qisqartma)', () => {
  const jadval = {
    '20 ming': 20000, '20 000': 20000, '20000': 20000, '1,5 million': 1500000, '1.5 mln': 1500000, '5 million': 5000000,
    'yigirma ming': 20000, 'yigirma besh ming': 25000, 'yuz ellik ming': 150000, 'ikki yuz ming': 200000, 'bir yarim million': 1500000,
    'ikki yarim ming': 2500, 'uch million besh yuz ming': 3500000, '1 mlrd': 1000000000, 'ming': 1000, 'bir ming': 1000,
    "o'n ming so'm": 10000, '15 mingga': 15000, '50k': 50000, 'yarim million': 500000, '5 yuz ming': 500000,
    // qo'shimcha misollar
    "O‘N MING": 10000, 'o`n ming': 10000, "to'rt yuz ming": 400000, "to'qson to'qqiz ming to'qqiz yuz to'qson to'qqiz": 99999, 'sakkiz yuz': 800, 'nol': 0, 'yuz': 100,
    '18 000 so\'m': 18000, '1 250 000': 1250000, '1.250.000': 1250000, '5,000': 5000, '2,5 ming': 2500, '0,5 million': 500000, '1,25 mln': 1250000,
    '2 mlrd 500 mln': 2500000000, 'ikkita': 2, '20ming': 20000, '15 mingdan': 15000, 'bir million ikki yuz ming': 1200000, '3k': 3000, '1.5k': 1500, '20 ming.': 20000, 'ikki ming besh yuz': 2500,
  };
  for (const [kirish, kutilgan] of Object.entries(jadval)) assert.equal(M.sonOgir(kirish), kutilgan, JSON.stringify(kirish));
  assert.equal(M.sonOgir(18000), 18000); assert.equal(M.sonOgir(1.5), null); assert.equal(M.sonOgir(-5), null); assert.equal(M.sonOgir(null), null); assert.equal(M.sonOgir(undefined), null); assert.equal(M.sonOgir({}), null);
});
test('sonOgir: noaniq yoki ma\'nosiz bo\'lsa null (taxmin qilinmaydi); "mingi" = null (qaror)', () => {
  const yomon = ['', '   ', 'abc', 'salom dunyo', 'mingi', 'minglab', 'yarim', 'ikki yarim', 'bir yarim', '12,5', '12.5', '1,500 million', '2.500 ming', '1.250,5', '2 3', 'besh yigirma', 'bir ikki', 'yigirma yigirma',
    'ming ming', 'million ming million', 'so\'m', 'ta', '20 ming olma', 'taxminan 20 ming', 'yigirma besh yuz', 'yuz yuz', '-5', '.5 million', ',5 ming', '5 ming 3000', 'k', 'yigirma k', '007', '1 2 3', '5%', '$20', '20 so\'m ming', 'x'.repeat(200), '9'.repeat(30), '99999999999 mlrd'];
  for (const y of yomon) assert.equal(M.sonOgir(y), null, JSON.stringify(y));
});

// ---------------- konstanta va kirish ----------------
test('YOZ matni bir harfigacha asl nusxa; model so\'rovi ATAYIN bitta user xabar; KIRISH qator tartibi aynan', async () => {
  assert.equal(M.YOZ, YOZ_ASL);
  const holat = { oz: { matn: JSON.stringify([MY()]) } };
  const { r, j } = await yoz(YOZUV({ eski: [{ izoh: 'non', kategoriya: "Uy-ro'zg'or" }, { izoh: 'taksi', kategoriya: 'Taksi' }] }), { holat });
  assert.equal(r.status, 200); assert.equal(j.manba, 'model');
  const c = ozSoz(holat); assert.equal(c.length, 1); const t = c[0].tana;
  assert.equal(c[0].init.headers['X-Model-Kalit'], 'sinov-model-kalit-123456');
  assert.equal(t.model, 'chuntak-v5'); assert.equal(t.stream, false); assert.equal(t.keep_alive, '30m'); assert.deepEqual(t.options, { temperature: 0, num_predict: 600, num_ctx: 2048 });
  assert.equal(t.messages.length, 1); assert.equal(t.messages[0].role, 'user'); assert.deepEqual(Object.keys(t).sort(), ['keep_alive', 'messages', 'model', 'options', 'stream']);
  assert.equal(t.messages[0].content, YOZ_ASL + '\n\n' + "Kategoriyalar: Taksi, Ovqatlanish, Uy-ro'zg'or, Boshqa xarajat, Maosh\nHisoblar: Cash UZS (naqd), Uzum (karta), Humo kartam (karta)\nEski yozuvlar: non -> Uy-ro'zg'or; taksi -> Taksi\nGap: bugun bozorda 2 ta non va sut oldim 18 ming");
  assert.ok(c[0].init.signal, 'vaqt chegarasi (signal) bor');
  // eski bo'sh yoki yo'q bo'lsa qator umuman yo'q
  for (const eski of [undefined, [], null]) {
    const h = { oz: { matn: '[]' } }; await yoz(YOZUV({ eski }), { holat: h });
    assert.equal(ozSoz(h)[0].tana.messages[0].content.split('\n\n')[1], "Kategoriyalar: Taksi, Ovqatlanish, Uy-ro'zg'or, Boshqa xarajat, Maosh\nHisoblar: Cash UZS (naqd), Uzum (karta), Humo kartam (karta)\nGap: bugun bozorda 2 ta non va sut oldim 18 ming");
  }
  // MODEL_NOMI o'zgartirsa
  const h2 = { oz: { matn: '[]' } }; await yoz(YOZUV(), { holat: h2, env: { ...YENV, MODEL_NOMI: 'chuntak-v6' } }); assert.equal(ozSoz(h2)[0].tana.model, 'chuntak-v6');
});
test('yozuv kirishi: noto\'g\'ri shakl -> 400 AI_KIRISH, uzun gap -> 413 AI_UZUN (AI chaqirilmaydi, limit sanalmaydi)', async () => {
  const yomon = [YOZUV({ gap: '   ' }), YOZUV({ gap: 5 }), YOZUV({ gap: undefined }), YOZUV({ bugun: '2026-99-99' }), YOZUV({ kategoriyalar: 'x' }), YOZUV({ kategoriyalar: Array(101).fill('a') }),
    YOZUV({ hisoblar: ['Uzum'] }), YOZUV({ hisoblar: [{ nom: 'Uzum', turi: 'boshqa' }] }), YOZUV({ hisoblar: [{ nom: '', turi: 'naqd' }] }), YOZUV({ hisoblar: Array(101).fill({ nom: 'a', turi: 'naqd' }) }),
    YOZUV({ eski: 'x' }), YOZUV({ eski: Array(21).fill({ izoh: 'non', kategoriya: 'Taksi' }) }), YOZUV({ eski: [{ izoh: 5, kategoriya: 'Taksi' }] }), YOZUV({ eski: [{ izoh: 'non' }] })];
  for (const [i, t] of yomon.entries()) { const { r, j, holat } = await yoz(t, { holat: { oz: { matn: '[]' } } }); assert.equal(r.status, 400, 'yomon #' + i); assert.equal(j.xato.kod, 'AI_KIRISH'); assert.equal(holat.chaqiruvlar.filter((c) => c.url.includes('model.') || c.url.includes('ai_limit')).length, 0); }
  const u = await yoz(YOZUV({ gap: 'a'.repeat(301) }), { holat: { oz: { matn: '[]' } } });
  assert.equal(u.r.status, 413); assert.equal(u.j.xato.kod, 'AI_UZUN'); assert.equal(u.holat.chaqiruvlar.filter((c) => c.url.includes('model.') || c.url.includes('ai_limit')).length, 0);
  assert.equal((await yoz(YOZUV({ gap: 'a'.repeat(300) }), { holat: { oz: { matn: '[]' } } })).r.status, 200);
  // eski: kategoriyasi ro'yxatda yo'q element tashlanadi, izoh qirqiladi
  const h = { oz: { matn: '[]' } }; await yoz(YOZUV({ eski: [{ izoh: 'x'.repeat(100), kategoriya: "uy-ro‘zg'or" }, { izoh: 'yo\'q', kategoriya: 'Begona' }] }), { holat: h });
  assert.ok(ozSoz(h)[0].tana.messages[0].content.includes("Eski yozuvlar: " + 'x'.repeat(60) + " -> Uy-ro'zg'or\nGap:"));
});

// ---------------- tozalash ----------------
test('tozalash: kategoriya/hisob moslash (harf, bo\'shliq, apostrof turlari), hisob turi ustun, topilmasa null + ogohlantirish', () => {
  const T = (o) => M.yozuvniTozala(MY(o), CTX);
  for (const nom of ["uy-ro'zg'or", "UY-RO‘ZG‘OR", "Uy-roʻzgʻor", "  uy-ro’zg’or ", "Uy-ro`zg`or", "Uy-roʼzgʼor"]) assert.equal(T({ kategoriya: nom }).kategoriya, "Uy-ro'zg'or", nom);
  const a = T({ kategoriya: 'Yo\'q kategoriya', hisob: 'uzum', hisob_turi: 'naqd' });
  assert.equal(a.kategoriya, null); assert.deepEqual(a.ogohlantirish, ['kategoriya topilmadi']);
  assert.equal(a.hisob, 'Uzum'); assert.equal(a.hisob_turi, 'karta', 'hisob topilsa uning turi ustun');
  const b = T({ hisob: 'Begona hisob', hisob_turi: 'Karta' }); assert.equal(b.hisob, null); assert.equal(b.hisob_turi, 'karta'); assert.ok(b.ogohlantirish.includes('hisob topilmadi'));
  assert.equal(T({ hisob: null, hisob_turi: 'boshqa' }).hisob_turi, null); assert.equal(T({ hisob: null, hisob_turi: null }).hisob_turi, null);
  assert.deepEqual(T({ kategoriya: null }).ogohlantirish, [], 'model null bergan bo\'lsa ogohlantirish yo\'q');
  assert.equal(T({ hisob: 'cash  uzs' }).hisob, 'Cash UZS'); assert.equal(T({ hisob: 'cash  uzs' }).hisob_turi, 'naqd');
});
test('tozalash: tur ro\'yxatda bo\'lmasa element tashlanadi; kalitlar yo\'q yoki null bo\'lsa ham qabul qilinadi', () => {
  for (const x of [{ ...MY(), tur: 'sovga' }, null, 'matn', [], { summa_matn: '5 ming' }, { ...MY(), tur: 5 }]) assert.equal(M.yozuvniTozala(x, CTX), null, JSON.stringify(x));
  for (const tur of ['xarajat', 'daromad', 'qarz_berdim', 'qarz_oldim', 'qarz_qaytardim', 'qarz_qaytarildi', 'otkazma', 'XARAJAT']) assert.ok(M.yozuvniTozala({ tur, summa_matn: '5 ming' }, CTX), tur);
  const k = M.yozuvniTozala({ tur: 'xarajat', summa_matn: '5 ming' }, CTX);   // faqat ikki kalit
  assert.deepEqual(k, { tur: 'xarajat', summa: 5000, soni: null, narx: null, kategoriya: null, hisob: null, hisob_turi: null, hisob2: null, shaxs: null, sana: null, izoh: CTX.gap, ogohlantirish: [] });
  assert.deepEqual(Object.keys(k), ['tur', 'summa', 'soni', 'narx', 'kategoriya', 'hisob', 'hisob_turi', 'hisob2', 'shaxs', 'sana', 'izoh', 'ogohlantirish']);
});
test('tozalash: summa — son(summa_matn); soni x narx; son olinmasa null + "summa aniqlanmadi"; chegaralar', () => {
  const S = (o) => M.yozuvniTozala(MY(o), CTX);
  const SD = (o) => M.yozuvniTozala(MY(o), { ...CTX, gap: 'kecha 2 ta tarvuz oldim, har biri 25 ming' });   // dona narxi belgisi bor gap
  assert.equal(S({ summa_matn: 'yigirma besh ming' }).summa, 25000); assert.equal(S({ summa_matn: 18000 }).summa, 18000);
  const d = SD({ soni: 2, narx_matn: '9 ming', summa_matn: '18 ming' }); assert.deepEqual([d.summa, d.soni, d.narx], [18000, 2, 9000]);
  const e = SD({ soni: '3', narx_matn: 'besh yuz', summa_matn: null }); assert.deepEqual([e.summa, e.soni, e.narx], [1500, 3, 500]);
  assert.equal(SD({ soni: 2, narx_matn: 'arzon', summa_matn: '18 ming' }).summa, 18000, 'narx o\'qilmasa summa_matn');
  assert.equal(S({ soni: 2, narx_matn: null, summa_matn: '30 ming' }).summa, 30000);
  for (const sm of ['', null, 'ancha', '0', 'nol', '-5', '2000 mlrd', 'mingi']) { const x = S({ summa_matn: sm }); assert.equal(x.summa, null, String(sm)); assert.deepEqual(x.ogohlantirish, ['summa aniqlanmadi']); }
  assert.equal(SD({ soni: 1000000, narx_matn: '999 mlrd', summa_matn: null }).summa, null, 'ko\'paytma 1 000 000 000 000 dan oshdi');
  assert.equal(S({ summa_matn: '1000 mlrd' }).summa, 1000000000000, 'aynan chegara');

test('tozalash: "N ta X, summa" — summa JAMI (dona narxi faqat belgi bo\'lsa)', () => {
  const G = (gap, o) => M.yozuvniTozala(MY(o), { ...CTX, gap });
  const j = G('bugun bozorda 2 ta non va sut oldim 18 ming', { soni: 2, narx_matn: '18 ming', summa_matn: '36 ming' });
  assert.deepEqual([j.summa, j.narx, j.soni], [18000, null, 2]); assert.deepEqual(j.ogohlantirish, ['Summa jami deb olindi']); assert.equal(j.izoh, 'non va sut');
  const k = G('kecha 2 ta tarvuz oldim, har biri 25 ming', { soni: 2, narx_matn: '25 ming', summa_matn: '50 ming' });
  assert.deepEqual([k.summa, k.narx, k.soni, k.ogohlantirish], [50000, 25000, 2, []]);
  const l = G('3 ta kitob oldim 90 ming', { soni: 3, narx_matn: '90 ming', summa_matn: null }); assert.deepEqual([l.summa, l.narx], [90000, null]);
  const m = G('2 tadan 25 mingdan oldim', { soni: 2, narx_matn: '25 ming', summa_matn: null }); assert.deepEqual([m.summa, m.narx], [50000, 25000]);
  const n = G('2 ta olma oldim, 25 mingdan', { soni: 2, narx_matn: '25 ming', summa_matn: null }); assert.deepEqual([n.summa, n.narx], [50000, 25000], '-dan');
  for (const g of ['3 ta nonni donasi 4 ming', 'har bir non 4 ming', 'bittasi 4 ming', 'bittadan 4 ming', '3 non 4 ming dona']) assert.equal(M.donaNarxiBelgisiBormi(g), true, g);
  for (const g of ['2 dona non oldim 18 ming', 'ikki dona non 18 ming', 'bugun 3 ta non, jami 12 ming', 'Aliga 5 ming berdim', '2 ta nondan 18 ming']) assert.equal(M.donaNarxiBelgisiBormi(g), false, g);
  const o = G('2 dona non oldim 18 ming', { soni: 2, narx_matn: '18 ming', summa_matn: null }); assert.deepEqual([o.summa, o.narx], [18000, null]);
  const p = G('3 ta kitob oldim 90 ming', { soni: null, narx_matn: '90 ming', summa_matn: '90 ming' }); assert.deepEqual([p.summa, p.ogohlantirish], [90000, []], 'soni yo\'q — qoida ishlamaydi');
});
});
test('tozalash: shaxs — qarz turlarida ga/dan/ning olinadi (qolgan ≥ 3 harf bo\'lsa), boshqa turlarda saqlanadi', () => {
  const Q = (tur, shaxs) => M.yozuvniTozala(MY({ tur, shaxs }), CTX).shaxs;
  assert.equal(Q('qarz_berdim', 'Aliga'), 'Ali'); assert.equal(Q('qarz_qaytarildi', 'Sardordan'), 'Sardor'); assert.equal(Q('qarz_oldim', 'Valining'), 'Vali'); assert.equal(Q('qarz_qaytardim', 'Olga'), 'Olga');
  assert.equal(Q('qarz_berdim', 'Ali'), 'Ali'); assert.equal(Q('qarz_berdim', 'Madan'), 'Madan'); assert.equal(Q('qarz_berdim', 'Aziz akaga'), 'Aziz aka'); assert.equal(Q('qarz_berdim', '  '), null); assert.equal(Q('qarz_berdim', null), null);
  assert.equal(Q('xarajat', 'Aliga'), 'Aliga'); assert.equal(Q('otkazma', 'Sardordan'), 'Sardordan'); assert.equal(Q('daromad', 'Anvar'), 'Anvar');
});
test('tozalash: sana — bugun, kecha, "N kun oldin" (raqam va so\'z), ertaga/kelajak (element qoladi), YYYY-MM-DD, qolgani null', () => {
  const D = (sana) => M.yozuvniTozala(MY({ sana }), CTX);
  assert.equal(D('bugun').sana, '2026-10-13'); assert.equal(D('Bugun').sana, '2026-10-13'); assert.equal(D('kecha').sana, '2026-10-12');
  assert.equal(D('2 kun oldin').sana, '2026-10-11'); assert.equal(D('uch kun oldin').sana, '2026-10-10'); assert.equal(D('10 kun oldin').sana, '2026-10-03'); assert.equal(D('15 kun oldin').sana, '2026-09-28');
  const e = D('ertaga'); assert.ok(e); assert.equal(e.sana, null); assert.equal(e.ogohlantirish.length, 1); assert.match(e.ogohlantirish[0], /kelajak/);
  assert.equal(D('2026-10-14').sana, null); assert.equal(D('2026-10-14').ogohlantirish.length, 1); assert.equal(D('2027-01-01').sana, null);
  assert.equal(D('2026-10-13').sana, '2026-10-13'); assert.equal(D('2026-09-30').sana, '2026-09-30'); assert.deepEqual(D('2026-09-30').ogohlantirish, []);
  for (const x of [null, '', 'o\'tgan juma', '0 kun oldin', 'mingi kun oldin', '2026-02-30', '13.10.2026', 5, 'kun oldin', 'indin']) { const r = D(x); assert.equal(r.sana, null, String(x)); assert.deepEqual(r.ogohlantirish, [], String(x)); }
  const y = M.yozuvniTozala(MY({ sana: '1 kun oldin' }), { ...CTX, bugun: '2026-03-01' }); assert.equal(y.sana, '2026-02-28');
  const z = M.yozuvniTozala(MY({ sana: 'kecha' }), { ...CTX, bugun: '2026-01-01' }); assert.equal(z.sana, '2025-12-31');
});
test('tozalash: izoh (bo\'sh bo\'lsa gap ≤ 120, tozalangan, ≤ 200) va otkazma hisob2', () => {
  const I = (izoh, gap = CTX.gap) => M.yozuvniTozala(MY({ izoh }), { ...CTX, gap }).izoh;
  assert.equal(I('  non   va\n sut '), 'non va sut'); assert.equal(I(''), CTX.gap); assert.equal(I(null), CTX.gap); assert.equal(I('   ', 'g'.repeat(200)), 'g'.repeat(120)); assert.equal(I('x'.repeat(300)).length, 200);
  assert.equal(M.yozuvniTozala(MY({ izoh: '\u0000ab\u0007c' }), CTX).izoh, 'abc');
  const O = (hisob, hisob2, tur = 'otkazma') => M.yozuvniTozala(MY({ tur, hisob, hisob2 }), CTX);
  const a = O('Uzum', 'cash uzs'); assert.deepEqual([a.hisob, a.hisob2, a.ogohlantirish], ['Uzum', 'Cash UZS', []]);
  const b = O('Uzum', 'UZUM'); assert.deepEqual([b.hisob, b.hisob2], ['Uzum', null]); assert.deepEqual(b.ogohlantirish, ['ikkala hisob bir xil']);
  assert.ok(O('Uzum', 'Yo\'q hisob').ogohlantirish.length === 1 && O('Uzum', 'Yo\'q hisob').hisob2 === null);
  assert.equal(O('Uzum', 'Cash UZS', 'xarajat').hisob2, null, 'otkazma bo\'lmasa hisob2 kerak emas');
});

// ---------------- ishlov: to'liq oqim ----------------
test('yozuv: o\'z model javob beradi -> manba "model", tozalangan yozuvlar; OpenAI chaqirilmaydi', async () => {
  const javob = [MY({ summa_matn: '18 ming', kategoriya: 'uy-ro‘zg‘or' }), MY({ tur: 'qarz_berdim', summa_matn: 'yigirma ming', shaxs: 'Aliga', kategoriya: null, sana: 'kecha', izoh: 'qarz' })];
  const { r, j, holat } = await yoz(YOZUV(), { holat: { oz: { matn: JSON.stringify(javob) } } });
  assert.equal(r.status, 200); assert.equal(j.ok, true); assert.equal(j.manba, 'model'); assert.equal(j.sabab, undefined); assert.equal(j.yozuvlar.length, 2);
  assert.deepEqual(j.yozuvlar[0], { tur: 'xarajat', summa: 18000, soni: null, narx: null, kategoriya: "Uy-ro'zg'or", hisob: null, hisob_turi: null, hisob2: null, shaxs: null, sana: '2026-10-13', izoh: 'non va sut', ogohlantirish: [] });
  assert.deepEqual([j.yozuvlar[1].tur, j.yozuvlar[1].summa, j.yozuvlar[1].shaxs, j.yozuvlar[1].sana], ['qarz_berdim', 20000, 'Ali', '2026-10-12']);
  assert.equal(oaSoz(holat).length, 0);
  // ```json o'rami va oldidan matn
  const f = await yoz(YOZUV(), { holat: { oz: { matn: '```json\n' + JSON.stringify([MY()]) + '\n```' } } }); assert.equal(f.j.manba, 'model'); assert.equal(f.j.yozuvlar.length, 1);
  const g = await yoz(YOZUV(), { holat: { oz: { matn: 'Mana natija: ' + JSON.stringify([MY()]) + ' tayyor.' } } }); assert.equal(g.j.manba, 'model');
});
test('yozuv: natija ≤ 6 ta; bo\'sh ro\'yxat -> yozuv_yoq; yaroqsiz elementlar tashlanadi (hammasi yaroqsiz bo\'lsa ham yozuv_yoq)', async () => {
  const yetti = await yoz(YOZUV(), { holat: { oz: { matn: JSON.stringify(Array(9).fill(MY())) } } }); assert.equal(yetti.j.yozuvlar.length, 6);
  const bosh = await yoz(YOZUV({ gap: 'ertaga bozorga boraman' }), { holat: { oz: { matn: '[]' } } });
  assert.deepEqual(bosh.j, { ok: true, manba: 'model', yozuvlar: [], sabab: 'yozuv_yoq' });
  const yar = await yoz(YOZUV(), { holat: { oz: { matn: JSON.stringify([{ tur: 'sovga' }, 5, null, MY()]) } } }); assert.equal(yar.j.yozuvlar.length, 1);
  const hammasi = await yoz(YOZUV(), { holat: { oz: { matn: JSON.stringify([{ tur: 'sovga' }]) } } }); assert.equal(hammasi.j.sabab, 'yozuv_yoq'); assert.equal(hammasi.j.manba, 'model');
});
test('zaxira zanjiri: vaqt tugadi / tarmoq / HTTP xato / JSON emas -> OpenAI (manba "openai")', async () => {
  const oa = { matn: JSON.stringify([MY({ summa_matn: '18 ming' })]) };
  for (const oz of [{ xato: 'vaqt' }, { xato: 'tarmoq' }, { xato: 500 }, { xato: 401 }, { matn: 'bu JSON emas' }, { matn: '' }, { matn: '{"x":1}' }, { matn: '"matn"' }]) {
    const { r, j, holat } = await yoz(YOZUV(), { holat: { oz, openai: oa } });
    assert.equal(r.status, 200, JSON.stringify(oz)); assert.equal(j.manba, 'openai', JSON.stringify(oz)); assert.equal(j.yozuvlar[0].summa, 18000); assert.equal(ozSoz(holat).length, 1); assert.equal(oaSoz(holat).length, 1);
  }
  // OpenAI zaxirasi: faqat bitta user xabar, JSON obyekt rejimi ISHLATILMAYDI (ro'yxat qaytishi kerak)
  const h = { oz: { xato: 'vaqt' }, openai: oa }; await yoz(YOZUV({ eski: [{ izoh: 'non', kategoriya: "Uy-ro'zg'or" }] }), { holat: h });
  const t = oaSoz(h)[0].tana; assert.equal(t.messages.length, 1); assert.equal(t.messages[0].role, 'user'); assert.equal(t.response_format, undefined); assert.ok(t.max_completion_tokens > 0);
  assert.equal(t.messages[0].content, YOZ_ASL + '\n\n' + "Kategoriyalar: Taksi, Ovqatlanish, Uy-ro'zg'or, Boshqa xarajat, Maosh\nHisoblar: Cash UZS (naqd), Uzum (karta), Humo kartam (karta)\nGap: bugun bozorda 2 ta non va sut oldim 18 ming");
});
test('zaxira zanjiri: ikkalasi ham javob bermasa -> ok:true, yozuvlar:[], sabab "tushunarsiz"', async () => {
  for (const holat of [{ oz: { xato: 'vaqt' }, openai: { xato: 500 } }, { oz: { matn: 'JSON emas' }, openai: { matn: 'ham JSON emas' } }, { oz: { xato: 'tarmoq' }, openai: { matn: '' } }]) {
    const { r, j } = await yoz(YOZUV(), { holat });
    assert.equal(r.status, 200); assert.deepEqual(j, { ok: true, manba: null, yozuvlar: [], sabab: 'tushunarsiz' });
  }
  // OpenAI sozlanmagan bo'lsa bu sozlash xatosi: tushunarsiz bilan yashirilmaydi
  const { r, j } = await yoz(YOZUV(), { holat: { oz: { xato: 'vaqt' } }, env: { ...YENV, OPENAI_API_KEY: '' } }); assert.equal(r.status, 502); assert.equal(j.xato.kod, 'AI_PROVAYDER');
});
test('YOZUV_PROVAYDER: oz_openai (sukut, noma\'lum qiymat ham), oz, openai', async () => {
  const oa = { matn: JSON.stringify([MY()]) }, oz = { matn: JSON.stringify([MY()]) };
  for (const yp of [undefined, '', 'oz_openai', 'OZ_OPENAI', 'nomalum']) {
    const h = { oz, openai: oa }; const x = await yoz(YOZUV(), { holat: h, env: { ...YENV, YOZUV_PROVAYDER: yp } }); assert.equal(x.j.manba, 'model', String(yp)); assert.equal(oaSoz(h).length, 0);
  }
  // oz: faqat o'z model
  const a = { oz: { xato: 'vaqt' }, openai: oa }; const ra = await yoz(YOZUV(), { holat: a, env: { ...YENV, YOZUV_PROVAYDER: 'oz' } });
  assert.equal(ra.r.status, 502); assert.equal(ra.j.xato.kod, 'AI_PROVAYDER'); assert.equal(oaSoz(a).length, 0); assert.equal(JSON.stringify(ra.j).includes('sinov-model-kalit'), false); assert.equal(JSON.stringify(ra.j).includes('model.sinov'), false);
  const b = { oz: { matn: 'JSON emas' }, openai: oa }; const rb = await yoz(YOZUV(), { holat: b, env: { ...YENV, YOZUV_PROVAYDER: 'oz' } }); assert.equal(rb.r.status, 200); assert.equal(rb.j.sabab, 'tushunarsiz'); assert.equal(oaSoz(b).length, 0);
  const c = await yoz(YOZUV(), { holat: { oz, openai: oa }, env: { ...YENV, YOZUV_PROVAYDER: 'oz' } }); assert.equal(c.j.manba, 'model');
  // openai: faqat OpenAI, o'z modelga umuman so'rov yo'q
  const d = { oz, openai: oa }; const rd = await yoz(YOZUV(), { holat: d, env: { ...YENV, YOZUV_PROVAYDER: 'openai' } }); assert.equal(rd.j.manba, 'openai'); assert.equal(ozSoz(d).length, 0);
  const e = await yoz(YOZUV(), { holat: { openai: { xato: 500 } }, env: { ...YENV, YOZUV_PROVAYDER: 'openai' } }); assert.equal(e.r.status, 502); assert.equal(e.j.xato.kod, 'AI_PROVAYDER');
});
test('MODEL_URL yoki MODEL_KALIT yo\'q: o\'z model jimgina o\'tkaziladi (OpenAI); YOZUV_PROVAYDER=oz bo\'lsa xato', async () => {
  const oa = { matn: JSON.stringify([MY()]) };
  for (const env of [{ MODEL_URL: '' , MODEL_KALIT: 'x'.repeat(20) }, { MODEL_URL: MODEL_MANZIL, MODEL_KALIT: '' }, {}]) {
    const h = { openai: oa }; const x = await yoz(YOZUV(), { holat: h, env }); assert.equal(x.r.status, 200); assert.equal(x.j.manba, 'openai'); assert.equal(ozSoz(h).length, 0);
  }
  const z = await yoz(YOZUV(), { holat: { openai: oa }, env: { MODEL_URL: '', MODEL_KALIT: '', YOZUV_PROVAYDER: 'oz' } }); assert.equal(z.r.status, 502); assert.equal(z.j.xato.kod, 'AI_PROVAYDER');
});
test('MODEL_VAQT: sukut 25 sekund, sozlansa o\'sha (1..120), noto\'g\'ri qiymat sukutga qaytadi', async () => {
  // ruxsat/limit/OpenAI chaqiruvlari ham AbortSignal.timeout ishlatadi (20000); model uchun qiymat ro'yxatda bo'lishi kerak
  const olch = async (v) => { const orig = AbortSignal.timeout; const hammasi = []; AbortSignal.timeout = (n) => { hammasi.push(n); return orig.call(AbortSignal, n); }; try { await yoz(YOZUV(), { holat: { oz: { matn: '[]' } }, env: { ...YENV, MODEL_VAQT: v } }); } finally { AbortSignal.timeout = orig; } return hammasi; };
  assert.ok((await olch(undefined)).includes(25000)); assert.ok((await olch('40')).includes(40000)); assert.ok((await olch('abc')).includes(25000)); assert.ok((await olch('0')).includes(25000)); assert.ok((await olch('9999')).includes(120000));
});
test('maxfiylik: `eski` o\'z modelda BOR, OpenAI so\'rovida YO\'Q; OpenAI ga faqat gap va nomlar ketadi', async () => {
  const eski = [{ izoh: 'maxfiy-izoh-belgisi', kategoriya: 'Taksi' }];
  const a = { oz: { matn: '[]' } }; await yoz(YOZUV({ eski }), { holat: a });
  assert.ok(ozSoz(a)[0].tana.messages[0].content.includes('maxfiy-izoh-belgisi'));
  const b = { oz: { xato: 'tarmoq' }, openai: { matn: '[]' } }; await yoz(YOZUV({ eski }), { holat: b });
  const oaTana = oaSoz(b)[0].init.body; assert.equal(oaTana.includes('maxfiy-izoh-belgisi'), false); assert.equal(oaTana.includes('Eski yozuvlar:'), false); assert.equal(oaTana.includes('sinov-model-kalit'), false);
  const c = { openai: { matn: '[]' } }; await yoz(YOZUV({ eski }), { holat: c, env: { ...YENV, YOZUV_PROVAYDER: 'openai' } }); assert.equal(oaSoz(c)[0].init.body.includes('maxfiy-izoh-belgisi'), false);
});
test('yozuv rejimida ham: kirish, ruxsat, kunlik limit (1 ta so\'rov), CORS', async () => {
  const oz = { matn: JSON.stringify([MY()]) };
  const a = await yoz(YOZUV(), { jwt: null, holat: { oz } }); assert.equal(a.r.status, 401); assert.equal(a.j.xato.kod, 'AI_RUXSAT'); assert.equal(a.holat.chaqiruvlar.length, 0);
  const b = await yoz(YOZUV(), { holat: { oz, email: 'begona@example.invalid' } }); assert.equal(b.r.status, 403); assert.equal(ozSoz(b.holat).length + oaSoz(b.holat).length, 0); assert.equal(b.holat.chaqiruvlar.filter((c) => c.url.includes('ai_limit')).length, 0);
  const l1 = await yoz(YOZUV(), { holat: { oz, limitBoshi: 200 } }); assert.equal(l1.r.status, 200);
  const h = { oz, limitBoshi: 201 }; const l2 = await yoz(YOZUV(), { holat: h }); assert.equal(l2.r.status, 429); assert.equal(l2.j.xato.kod, 'AI_LIMIT'); assert.equal(ozSoz(h).length + oaSoz(h).length, 0);
  const h3 = { oz }; await yoz(YOZUV(), { holat: h3 }); assert.equal(h3.chaqiruvlar.filter((c) => c.url.includes('ai_limit')).length, 1, 'yozuv = 1 ta so\'rov');
  assert.equal(h3.hisob.n, 1);
  for (const o of ['https://jahon-gir.github.io', 'http://localhost:8000']) assert.equal((await yoz(YOZUV(), { origin: o, holat: { oz } })).r.headers.get('Access-Control-Allow-Origin'), o);
  assert.equal((await yoz(YOZUV(), { origin: 'https://yomon.example', holat: { oz } })).r.headers.get('Access-Control-Allow-Origin'), null);
  const x = await yoz(YOZUV(), { jwt: null, origin: 'https://jahon-gir.github.io', holat: { oz } }); assert.equal(x.r.headers.get('Access-Control-Allow-Origin'), 'https://jahon-gir.github.io');
});
test('yozuv: eski reja/javob rejimlari o\'zgarmagan (kodlar to\'plami, savol maydoni shart)', async () => {
  assert.deepEqual([...M.XATO_KODLARI].sort(), ['AI_KIRISH', 'AI_LIMIT', 'AI_PROVAYDER', 'AI_RAQAM', 'AI_RUXSAT', 'AI_SXEMA', 'AI_UZUN', 'NETWORK']);
  const { r, j } = await chaqir({ rejim: 'reja', gap: 'salom', bugun: '2026-10-13', kategoriyalar: [], hisoblar: [] }, { holat: { aiMatn: PLAN(SOROV) } });
  assert.equal(r.status, 400); assert.equal(j.xato.kod, 'AI_KIRISH', 'reja rejimi hanuz "savol" talab qiladi');
});

// ---------------- repo: yozuv qismi uchun qo'shimcha qidiruv ----------------
test('repo: model-server/ va hujjatlarda haqiqiy manzil, kalit, email yo\'q (faqat <...> belgilar)', () => {
  const ildiz = join(BU, '..', '..', '..');
  const royxat = [];
  (function yur(d) { for (const n of readdirSync(d)) { if (n === '.git' || n === 'node_modules') continue; const p = join(d, n); const s = statSync(p); if (s.isDirectory()) yur(p); else if (/\.(ts|mjs|py|md|sh|toml)$/.test(n)) royxat.push(p); } })(join(ildiz, 'model-server'));
  royxat.push(join(ildiz, 'supabase', 'README.md'), join(ildiz, 'supabase', 'functions', 'yordamchi', 'index.ts'), join(ildiz, 'TZ-sinxronlash.md'));
  assert.ok(royxat.length >= 4);
  for (const f of royxat) {
    if (/test(_kopri)?\.(mjs|py)$/.test(f)) continue;
    const t = readFileSync(f, 'utf8');
    assert.equal(/[a-z0-9-]+\.ts\.net|[a-z0-9-]+\.trycloudflare\.com|ngrok|\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b(?<!127\.0\.0\.1)/.test(t.replace(/127\.0\.0\.1/g, '')), false, f + ': haqiqiy manzil');
    assert.equal(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/.test(t.replace(/(bir|ikki)@gmail\.com/g, '').replace(/noreply@anthropic\.com/g, '')), false, f + ': email');
    assert.equal(/(MODEL_KALIT)\s*[:=]\s*["']?[A-Za-z0-9]{8,}/.test(t), false, f + ': kalit qiymati');
    assert.equal(/\bMODEL_KALIT\s*=\s*"[^"<]/.test(t), false, f);
  }
  assert.equal(/\bconsole\./.test(readFileSync(join(BU, 'index.ts'), 'utf8').replace(/\/\/[^\n]*/g, '')), false);
});
