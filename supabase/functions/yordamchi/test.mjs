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
const SOROV = { amal: 'yigindi', davr: { dan: '2026-10-01', gacha: '2026-10-31' }, davr2: null, tur: 'xarajat', kategoriya: 'Oziq-ovqat', hisob: null, matn: null };

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
const JAVOB = (o = {}) => ({ rejim: 'javob', savol: 'Bu oy oziq-ovqatga qancha?', sorov: SOROV, natija: { jami: 1250000, soni: 14 }, ...o });
async function chaqir(tana, { holat = {}, env = {}, ...opt } = {}) {
  const r = await M.ishlov(so(tana, opt), muhitYasa(env), tarmoq(holat));
  return { r, j: r.status === 204 ? null : await r.json(), holat };
}

// ---------------- sxema tekshiruvi ----------------
test('sxema: to\'g\'ri so\'rov qabul qilinadi, nom ro\'yxatdagi aniq yozuvga keltiriladi', () => {
  const s = M.sorovniTekshir({ ...SOROV, kategoriya: "  ro'zg‘or ", hisob: 'karta' }, KAT, HIS);
  assert.equal(s.kategoriya, "Ro'zg'or"); assert.equal(s.hisob, 'Karta'); assert.equal(s.amal, 'yigindi');
});
test('sxema: noto\'g\'rilari rad etiladi (null)', () => {
  const yomon = [
    null, 'matn', [], {},
    { ...SOROV, amal: 'ochirish' },                                  // noma'lum amal
    { ...SOROV, ortiqcha: 1 },                                       // ortiqcha kalit
    (({ matn, ...q }) => q)(SOROV),                                  // kalit yetishmaydi
    { ...SOROV, davr: null },                                        // davr shart
    { ...SOROV, davr: { dan: '2026-10-31', gacha: '2026-10-01' } },  // dan > gacha
    { ...SOROV, davr: { dan: '2026-13-01', gacha: '2026-13-02' } },  // yo'q oy
    { ...SOROV, davr: { dan: '2026-02-30', gacha: '2026-03-01' } },  // yo'q kun
    { ...SOROV, davr: { dan: '2026-10-01', gacha: '2026-10-31', x: 1 } },
    { ...SOROV, davr2: { dan: '2026-09-01', gacha: '2026-09-30' } }, // taqqoslashdan boshqada davr2 yo'q
    { ...SOROV, amal: 'taqqoslash' },                                // taqqoslashda davr2 shart
    { ...SOROV, tur: 'otkazma' },
    { ...SOROV, kategoriya: "Yo'q kategoriya" },                     // ro'yxatda yo'q
    { ...SOROV, hisob: 'Boshqa hisob' },
    { ...SOROV, kategoriya: 5 },
    { ...SOROV, matn: 'x'.repeat(41) },
    { ...SOROV, amal: 'qidiruv', matn: null },                       // qidiruvda so'z shart
  ];
  yomon.forEach((x, i) => assert.equal(M.sorovniTekshir(x, KAT, HIS), null, 'yomon #' + i));
});
test('sxema: taqqoslash va qidiruv to\'g\'ri shakllari o\'tadi; tushunarsiz har doim standart shaklga keltiriladi', () => {
  const t = { ...SOROV, amal: 'taqqoslash', davr2: { dan: '2026-09-01', gacha: '2026-09-30' } };
  assert.ok(M.sorovniTekshir(t, KAT, HIS));
  assert.ok(M.sorovniTekshir({ ...SOROV, amal: 'qidiruv', matn: 'bozor', kategoriya: null }, KAT, HIS));
  assert.deepEqual(M.sorovniTekshir({ amal: 'tushunarsiz', davr: { dan: 'x' }, davr2: 1, tur: 'q', kategoriya: 'q', hisob: 'q', matn: 'q' }, KAT, HIS), M.tushunarsizSorov());
});
test('reja: AI noto\'g\'ri/sxemadan tashqari javob bersa amal = tushunarsiz', async () => {
  for (const aiMatn of ['bu JSON emas', '{"amal":"yigindi"}', JSON.stringify({ ...SOROV, kategoriya: 'Yo\'q' }), JSON.stringify({ ...SOROV, amal: 'hack' }), '[]', 'null']) {
    const { r, j } = await chaqir(REJA(), { holat: { aiMatn } });
    assert.equal(r.status, 200); assert.equal(j.sorov.amal, 'tushunarsiz', aiMatn); assert.equal(j.sorov.davr, null);
  }
});
test('reja: to\'g\'ri JSON (``` bilan o\'ralgan ham) qabul qilinadi', async () => {
  const a = await chaqir(REJA(), { holat: { aiMatn: JSON.stringify(SOROV) } });
  assert.deepEqual(a.j.sorov, SOROV);
  const b = await chaqir(REJA(), { holat: { aiMatn: '```json\n' + JSON.stringify(SOROV) + '\n```' } });
  assert.deepEqual(b.j.sorov, SOROV);
});

// ---------------- raqam tekshiruvi ----------------
test('raqam: natijadagi raqamlar o\'tadi; boshqa raqam rad etiladi', () => {
  const kir = [{ jami: 1250000, soni: 14, oldingi: 1000000 }, SOROV.davr];
  assert.ok(M.raqamlarMosmi("Oktabrda 1 250 000 so'm sarfladingiz (14 ta yozuv).", kir));
  assert.ok(M.raqamlarMosmi('Jami 1250000 so\'m.', kir));
  assert.ok(M.raqamlarMosmi('Jami 1 250 000 so\'m.', kir));
  assert.ok(M.raqamlarMosmi('Taxminan 1,25 mln so\'m.', kir));          // faqat ko'rsatilgan aniqlikda qisqartirish
  assert.ok(M.raqamlarMosmi("2026-yil 1-oktabrdan 31-oktabrgacha 14 ta.", kir)); // so'rov sanalari
  assert.ok(M.raqamlarMosmi("Oziq-ovqat va transport uchun to'ladingiz.", kir));   // raqamsiz matn
  assert.equal(M.raqamlarMosmi("Jami 1 350 000 so'm.", kir), false);
  assert.equal(M.raqamlarMosmi('Jami 125 000 so\'m.', kir), false);
  assert.equal(M.raqamlarMosmi('Jami 1,4 mln so\'m.', kir), false);       // 1,4 mln ≠ 1 250 000
  assert.equal(M.raqamlarMosmi('15 ta yozuv.', kir), false);
  assert.equal(M.raqamlarMosmi('Jami 1 250 000 va 14 ta, o\'tgan oy 900 000.', kir), false);
  assert.equal(M.raqamlarMosmi('Kuniga 3 000 so\'m.', kir), false);
});
test('raqam: matndan raqamlarni ajratish', () => {
  const q = (s) => M.matndanRaqamlar(s).map((x) => x.qiymatlar);
  assert.deepEqual(q('1 200 000 so\'m'), [[1200000]]);
  assert.deepEqual(q('5 ta 3 ta'), [[5], [3]]);
  assert.deepEqual(q('12,5%'), [[12.5]]);
  assert.deepEqual(q('1.200'), [[1.2, 1200]]);
});
test('javob: mos matn qaytadi; mos kelmasa AI_RAQAM va matn qaytarilmaydi', async () => {
  const yaxshi = await chaqir(JAVOB(), { holat: { aiMatn: "Bu oy oziq-ovqatga 1 250 000 so'm sarfladingiz (14 ta yozuv)." } });
  assert.equal(yaxshi.r.status, 200); assert.match(yaxshi.j.matn, /1 250 000/);
  const yomon = await chaqir(JAVOB(), { holat: { aiMatn: "Bu oy oziq-ovqatga 1 300 000 so'm sarfladingiz." } });
  assert.equal(yomon.r.status, 502); assert.equal(yomon.j.xato.kod, 'AI_RAQAM'); assert.equal(yomon.j.matn, undefined);
  assert.equal(JSON.stringify(yomon.j).includes('1 300 000'), false);
});
test('raqam: savoldagi raqamlar ham ruxsat etiladi ("2-haftasida"), boshqa raqam esa yo\'q', async () => {
  const savol = "Sentabrning 2-haftasida eng ko'p xarajat nimaga bo'lgan?";
  const yaxshi = await chaqir(JAVOB({ savol }), { holat: { aiMatn: "Sentabrning 2-haftasida eng ko'p 1 250 000 so'm ketgan." } });
  assert.equal(yaxshi.r.status, 200);
  const yomon = await chaqir(JAVOB({ savol }), { holat: { aiMatn: "Sentabrning 3-haftasida 1 250 000 so'm ketgan." } });
  assert.equal(yomon.j.xato.kod, 'AI_RAQAM');
  const yomon2 = await chaqir(JAVOB({ savol }), { holat: { aiMatn: "2-haftasida 1 300 000 so'm ketgan." } });
  assert.equal(yomon2.j.xato.kod, 'AI_RAQAM', 'natijadagi raqam tekshiruvi o\'zgarmagan');
  assert.ok(M.raqamlarMosmi('2-haftasida 14 ta', [{ soni: 14 }, SOROV.davr, 'Sentabrning 2-haftasida']));
});
test('javob: bo\'sh yoki juda uzun AI matni -> xato kodi (matn qaytmaydi)', async () => {
  const a = await chaqir(JAVOB(), { holat: { aiMatn: '   ' } }); assert.equal(a.j.xato.kod, 'AI_PROVAYDER');
  const b = await chaqir(JAVOB(), { holat: { aiMatn: 'a '.repeat(300) } }); assert.equal(b.j.xato.kod, 'AI_SXEMA');
});

// ---------------- ruxsat ----------------
test('ruxsat: Authorization yo\'q -> 401 AI_RUXSAT (AI chaqirilmaydi)', async () => {
  const { r, j, holat } = await chaqir(REJA(), { jwt: null, holat: { aiMatn: JSON.stringify(SOROV) } });
  assert.equal(r.status, 401); assert.equal(j.xato.kod, 'AI_RUXSAT'); assert.equal(holat.chaqiruvlar.length, 0);
});
test('ruxsat: yaroqsiz token -> 401', async () => {
  const { r, j, holat } = await chaqir(REJA(), { holat: { userHolati: 401 } });
  assert.equal(r.status, 401); assert.equal(j.xato.kod, 'AI_RUXSAT'); assert.ok(!holat.chaqiruvlar.some((c) => c.url.includes('api.openai.com')));
});
test('ruxsat: ro\'yxatda yo\'q email -> 403 AI_RUXSAT, limit sanalmaydi va AI chaqirilmaydi', async () => {
  const { r, j, holat } = await chaqir(REJA(), { holat: { email: 'begona@example.invalid', aiMatn: JSON.stringify(SOROV) } });
  assert.equal(r.status, 403); assert.equal(j.xato.kod, 'AI_RUXSAT');
  assert.deepEqual(holat.chaqiruvlar.map((c) => c.url), ['https://x.invalid/auth/v1/user']);
});
test('ruxsat: AI_RUXSAT_EMAIL sozlanmagan bo\'lsa hech kimga ruxsat yo\'q; email katta-kichik harfga befarq', async () => {
  const a = await chaqir(REJA(), { env: { AI_RUXSAT_EMAIL: '' }, holat: { aiMatn: JSON.stringify(SOROV) } });
  assert.equal(a.r.status, 403);
  const b = await chaqir(REJA(), { env: { AI_RUXSAT_EMAIL: 'EGA@example.invalid' }, holat: { aiMatn: JSON.stringify(SOROV) } });
  assert.equal(b.r.status, 200);
  assert.equal(M.emailRuxsatMi('a@b.c', undefined), false); assert.equal(M.emailRuxsatMi('', 'a@b.c'), false);
});
test('ruxsat: ochiq kalit so\'rov sarlavhasidan olinadi (bo\'lmasa muhitdan)', async () => {
  const { holat } = await chaqir(REJA(), { apikey: 'ilova-ochiq-kalit', holat: { aiMatn: JSON.stringify(SOROV) } });
  assert.equal(holat.chaqiruvlar[0].init.headers.apikey, 'ilova-ochiq-kalit');
});

// ---------------- cheklovlar ----------------
test('savol 300 belgidan uzun bo\'lsa AI_UZUN (AI chaqirilmaydi, limit sanalmaydi); 300 belgi o\'tadi', async () => {
  const uzun = await chaqir(REJA({ savol: 'a'.repeat(301) }), { holat: { aiMatn: JSON.stringify(SOROV) } });
  assert.equal(uzun.r.status, 413); assert.equal(uzun.j.xato.kod, 'AI_UZUN');
  assert.ok(!uzun.holat.chaqiruvlar.some((c) => c.url.includes('api.openai.com') || c.url.includes('ai_limit')));
  const chegara = await chaqir(REJA({ savol: 'a'.repeat(300) }), { holat: { aiMatn: JSON.stringify(SOROV) } });
  assert.equal(chegara.r.status, 200);
});
test('noto\'g\'ri kirish -> 400 AI_KIRISH', async () => {
  const yomon = [
    'json emas', [], { rejim: 'boshqa', savol: 'x' }, { rejim: 'reja' }, REJA({ savol: '   ' }), REJA({ savol: 5 }), REJA({ bugun: '2026-99-99' }),
    REJA({ kategoriyalar: 'x' }), REJA({ hisoblar: [1] }), REJA({ kategoriyalar: Array(101).fill('a') }), REJA({ kategoriyalar: ['x'.repeat(61)] }),
    JAVOB({ sorov: { ...SOROV, amal: 'tushunarsiz' } }), JAVOB({ sorov: null }), JAVOB({ natija: null }), JAVOB({ natija: 'matn' }), JAVOB({ natija: [1, 2] }),
  ];
  for (const [i, t] of yomon.entries()) {
    const { r, j } = await chaqir(t, { holat: { aiMatn: JSON.stringify(SOROV) } });
    assert.equal(r.status, 400, 'yomon #' + i); assert.equal(j.xato.kod, 'AI_KIRISH', 'yomon #' + i);
  }
});
test('maxfiylik: natijada izoh, shaxs ismi yoki yozuvlar kalitlari bo\'lsa AI ga yuborilmaydi (rad etiladi)', async () => {
  for (const natija of [{ shaxs: 'Ali', jami: 1 }, { izoh: 'bozor', jami: 1 }, { yozuvlar: [], jami: 1 }, { ichki: { qarzdor: 'Vali' } }, { jami: 1, 'Katta Kalit': 2 }, { a: { b: { c: { d: { e: { f: 1 } } } } } }, { jami: 1, uzun: 'x'.repeat(61) }]) {
    const { r, j, holat } = await chaqir(JAVOB({ natija }), { holat: { aiMatn: 'Jami 1.' } });
    assert.equal(r.status, 400); assert.equal(j.xato.kod, 'AI_KIRISH');
    assert.ok(!holat.chaqiruvlar.some((c) => c.url.includes('api.openai.com')));
  }
});
test('limit: kuniga 100 ta o\'tadi, 101-chisi 429 AI_LIMIT va AI chaqirilmaydi', async () => {
  const sozlama = { aiMatn: JSON.stringify(SOROV), limitBoshi: 100 };
  const yuzinchi = await chaqir(REJA(), { holat: sozlama });
  assert.equal(yuzinchi.r.status, 200);
  const holat101 = { aiMatn: JSON.stringify(SOROV), limitBoshi: 101 };
  const yuzbirinchi = await chaqir(REJA(), { holat: holat101 });
  assert.equal(yuzbirinchi.r.status, 429); assert.equal(yuzbirinchi.j.xato.kod, 'AI_LIMIT');
  assert.ok(!holat101.chaqiruvlar.some((c) => c.url.includes('api.openai.com')));
  assert.equal(M.KUNLIK_LIMIT, 100); assert.equal(M.SAVOL_MAX, 300);
});
test('limit: hisoblab bo\'lmasa (007 ishga tushirilmagan) so\'rov rad etiladi (AI_LIMIT), AI chaqirilmaydi', async () => {
  const { r, j, holat } = await chaqir(REJA(), { holat: { limitXato: true, aiMatn: JSON.stringify(SOROV) } });
  assert.equal(r.status, 503); assert.equal(j.xato.kod, 'AI_LIMIT'); assert.ok(!holat.chaqiruvlar.some((c) => c.url.includes('api.openai.com')));
});
test('limit RPC: foydalanuvchi tokeni bilan chaqiriladi', async () => {
  const { holat } = await chaqir(REJA(), { holat: { aiMatn: JSON.stringify(SOROV) } });
  const c = holat.chaqiruvlar.find((x) => x.url.endsWith('/rpc/ai_limit_oshir'));
  assert.equal(c.init.headers.Authorization, 'Bearer jwt-sinov');
});
test('javob tokenlari cheklangan (max_completion_tokens / max_tokens)', async () => {
  const a = await chaqir(REJA(), { holat: { aiMatn: JSON.stringify(SOROV) } });
  const tana = JSON.parse(a.holat.chaqiruvlar.find((c) => c.url.includes('openai')).init.body);
  assert.ok(tana.max_completion_tokens > 0 && tana.max_completion_tokens <= 400);
  const b = await chaqir(JAVOB(), { env: { AI_PROVAYDER: 'claude' }, holat: { aiMatn: 'Jami 1 250 000 so\'m.' } });
  const t2 = JSON.parse(b.holat.chaqiruvlar.find((c) => c.url.includes('anthropic')).init.body);
  assert.ok(t2.max_tokens > 0 && t2.max_tokens <= 400);
});

// ---------------- CORS ----------------
test('CORS: faqat ruxsat etilgan manzillar', async () => {
  for (const o of ['https://jahon-gir.github.io', 'http://localhost:8000']) {
    const { r } = await chaqir(REJA(), { origin: o, holat: { aiMatn: JSON.stringify(SOROV) } });
    assert.equal(r.headers.get('Access-Control-Allow-Origin'), o);
  }
  for (const o of ['https://yomon.example', 'http://localhost:3000', 'https://jahon-gir.github.io.yomon.example', null]) {
    const { r } = await chaqir(REJA(), { origin: o, holat: { aiMatn: JSON.stringify(SOROV) } });
    assert.equal(r.headers.get('Access-Control-Allow-Origin'), null, String(o));
  }
  const pre = await M.ishlov(so(null, { method: 'OPTIONS', origin: 'https://jahon-gir.github.io' }), muhitYasa(), tarmoq());
  assert.equal(pre.status, 204); assert.equal(pre.headers.get('Access-Control-Allow-Origin'), 'https://jahon-gir.github.io');
  assert.match(pre.headers.get('Access-Control-Allow-Headers'), /authorization/);
  const yomonPre = await M.ishlov(so(null, { method: 'OPTIONS', origin: 'https://yomon.example' }), muhitYasa(), tarmoq());
  assert.equal(yomonPre.headers.get('Access-Control-Allow-Origin'), null);
  const get = await M.ishlov(so(null, { method: 'GET' }), muhitYasa(), tarmoq()); assert.equal(get.status, 405);
});
test('xato javoblarida ham CORS sarlavhasi bor (brauzer xatoni o\'qiy olsin)', async () => {
  const { r } = await chaqir(REJA(), { jwt: null, origin: 'https://jahon-gir.github.io' });
  assert.equal(r.status, 401); assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'https://jahon-gir.github.io');
});

// ---------------- provayder ----------------
test('provayder: openai va claude sozlama bilan almashadi, har biri o\'z kaliti va manzili bilan', async () => {
  const o = await chaqir(REJA(), { holat: { aiMatn: JSON.stringify(SOROV) } });
  const co = o.holat.chaqiruvlar.find((c) => c.url.includes('openai'));
  assert.equal(co.init.headers.Authorization, 'Bearer sinov-kalit-1'); assert.equal(JSON.parse(co.init.body).model, 'sinov-model');
  assert.equal(JSON.parse(co.init.body).response_format.type, 'json_object');
  assert.ok(!o.holat.chaqiruvlar.some((c) => c.url.includes('anthropic')));
  const k = await chaqir(REJA(), { env: { AI_PROVAYDER: 'Claude', AI_MODEL: 'claude-sinov' }, holat: { aiMatn: JSON.stringify(SOROV) } });
  const ck = k.holat.chaqiruvlar.find((c) => c.url.includes('anthropic'));
  assert.equal(ck.init.headers['x-api-key'], 'sinov-kalit-2'); assert.equal(ck.init.headers['anthropic-version'], '2023-06-01');
  assert.equal(JSON.parse(ck.init.body).model, 'claude-sinov'); assert.deepEqual(k.j.sorov, SOROV);
  assert.ok(!k.holat.chaqiruvlar.some((c) => c.url.includes('openai')));
});
test('provayder: sozlanmagan/xato -> AI_PROVAYDER; tarmoq uzilsa NETWORK; kalit javobda ko\'rinmaydi', async () => {
  for (const env of [{ AI_PROVAYDER: '' }, { AI_PROVAYDER: 'gemini' }, { AI_MODEL: '' }, { OPENAI_API_KEY: '' }, { AI_PROVAYDER: 'claude', ANTHROPIC_API_KEY: '' }]) {
    const { r, j } = await chaqir(REJA(), { env, holat: { aiMatn: JSON.stringify(SOROV) } });
    assert.equal(r.status, 502); assert.equal(j.xato.kod, 'AI_PROVAYDER');
  }
  const a = await chaqir(REJA(), { holat: { aiHolat: 500 } });
  assert.equal(a.j.xato.kod, 'AI_PROVAYDER'); assert.equal(JSON.stringify(a.j).includes('sinov-kalit'), false);
  const fn = async (url) => { if (url.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: 'u', email: 'ega@example.invalid' })); if (url.includes('ai_limit')) return new Response('1'); throw new TypeError('fetch failed'); };
  const r = await M.ishlov(so(REJA()), muhitYasa(), fn); const j = await r.json();
  assert.equal(r.status, 503); assert.equal(j.xato.kod, 'NETWORK');
});
test('AI ga faqat ruxsat etilgan ma\'lumot ketadi (reja: savol, sana, nomlar; javob: savol, so\'rov, natija)', async () => {
  const a = await chaqir(REJA(), { holat: { aiMatn: JSON.stringify(SOROV) } });
  const ta = JSON.parse(a.holat.chaqiruvlar.find((c) => c.url.includes('openai')).init.body);
  const ua = JSON.parse(ta.messages[1].content);
  assert.deepEqual(Object.keys(ua).sort(), ['bugun', 'hisoblar', 'kategoriyalar', 'savol']);
  const b = await chaqir(JAVOB(), { holat: { aiMatn: "1 250 000 so'm, 14 ta." } });
  const ub = JSON.parse(JSON.parse(b.holat.chaqiruvlar.find((c) => c.url.includes('openai')).init.body).messages[1].content);
  assert.deepEqual(Object.keys(ub).sort(), ['natija', 'savol', 'sorov']);
});
test('xato javoblari: faqat belgilangan kodlar, o\'zbekcha sabab bilan', async () => {
  const kodlar = new Set();
  const holatlar = [
    chaqir(REJA(), { jwt: null }), chaqir(REJA(), { holat: { email: 'x@y.z' } }), chaqir('yomon'), chaqir(REJA({ savol: 'a'.repeat(301) })),
    chaqir(REJA(), { holat: { limitBoshi: 101 } }), chaqir(REJA(), { holat: { aiHolat: 500 } }), chaqir(JAVOB(), { holat: { aiMatn: 'a '.repeat(300) } }), chaqir(JAVOB(), { holat: { aiMatn: '999' } }),
  ];
  for (const { j } of await Promise.all(holatlar)) { assert.ok(M.XATO_KODLARI.includes(j.xato.kod)); assert.ok(j.xato.sabab.length > 5); kodlar.add(j.xato.kod); }
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
