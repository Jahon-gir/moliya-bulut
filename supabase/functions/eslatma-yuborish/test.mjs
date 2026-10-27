// Eslatma yuborish (Edge Function) sinovi. Ishga tushirish:  node --test supabase/functions/eslatma-yuborish/test.mjs
// Node 22.18+ kerak. HAQIQIY Supabase, push xizmati va kalit ISHLATILMAYDI: soxta Supabase (jadvallar, jurnal, cascade) va soxta push xizmati;
// VAPID va qurilma kalitlari har safar sinovning o'zida yasaladi.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as M from './index.ts';
import * as P from './push.ts';
import { qurilmaJuftligi, vapidJuftligi, deshifrla } from '../_shared/test-yordam.mjs';

const BU = dirname(fileURLToPath(import.meta.url));
const MANBA = readFileSync(join(BU, 'index.ts'), 'utf8');
const SIR = 'sinov-kron-sirri-0123456789abcdef', SRK = 'sinov-service-kaliti-XYZ';
const T0 = Date.UTC(2026, 9, 27, 16, 0, 0);          // 27.10.2026 16:00 UTC = 21:00 Toshkent (UTC+5)
const MIN = 60000, SOAT = 3600000, KUN = 86400000;

// ======================== SOF FUNKSIYALAR ========================
test('mahalliyVaqt: Toshkent, Nyu-York (yozgi vaqt), Kolkata (+5:30), Kiritimati (+14); yarim tunda sana o\'tishi', () => {
  assert.deepEqual(M.mahalliyVaqt(T0, 'Asia/Tashkent'), { sana: '2026-10-27', daqiqa: 21 * 60 });
  assert.deepEqual(M.mahalliyVaqt(T0, 'America/New_York'), { sana: '2026-10-27', daqiqa: 12 * 60 });
  assert.deepEqual(M.mahalliyVaqt(T0, 'Asia/Kolkata'), { sana: '2026-10-27', daqiqa: 21 * 60 + 30 });
  assert.deepEqual(M.mahalliyVaqt(T0, 'Pacific/Kiritimati'), { sana: '2026-10-28', daqiqa: 6 * 60 });
  assert.deepEqual(M.mahalliyVaqt(T0 + 3 * SOAT + 30 * MIN, 'Asia/Tashkent'), { sana: '2026-10-28', daqiqa: 30 }, 'yarim tundan keyin sana o\'tadi');
  assert.deepEqual(M.mahalliyVaqt(Date.UTC(2026, 9, 27, 19, 0, 0), 'Asia/Tashkent'), { sana: '2026-10-28', daqiqa: 0 }, '00:00 aynan');
  assert.deepEqual(M.mahalliyVaqt(Date.UTC(2026, 9, 27, 18, 59, 0), 'Asia/Tashkent'), { sana: '2026-10-27', daqiqa: 23 * 60 + 59 }, '23:59');
  assert.throws(() => M.mahalliyVaqt(T0, 'Mars/Olympus'));
});
test('vaqtDaqiqa va sanaQosh', () => {
  assert.equal(M.vaqtDaqiqa('21:00'), 1260); assert.equal(M.vaqtDaqiqa('09:05:00'), 545); assert.equal(M.vaqtDaqiqa('24:00'), null); assert.equal(M.vaqtDaqiqa('x'), null);
  assert.equal(M.sanaQosh('2026-10-30', 3), '2026-11-02'); assert.equal(M.sanaQosh('2026-12-31', 1), '2027-01-01'); assert.equal(M.sanaQosh('2026-03-01', -1), '2026-02-28'); assert.equal(M.sanaQosh('2028-02-28', 1), '2028-02-29');
});
test('oyna: [vaqt, vaqt+2 soat) chegaralari (Toshkent 21:00)', () => {
  const ol = (m) => M.oynaSanasi(T0 + m * MIN, 'Asia/Tashkent', '21:00:00');
  assert.equal(ol(-1), null, '20:59'); assert.equal(ol(0), '2026-10-27', '21:00'); assert.equal(ol(1), '2026-10-27'); assert.equal(ol(119), '2026-10-27', '22:59');
  assert.equal(ol(120), null, '23:00'); assert.equal(ol(-24 * 60), '2026-10-26', 'kecha shu soat — kechagi kunning oynasi');
});
test('oyna: yarim tundan o\'tadigan oyna (23:30 + 2 soat) — tundan keyingi daqiqalar OLDINGI kunga tegishli', () => {
  const v = '23:30:00', ol = (sana, soat, daq) => M.oynaSanasi(Date.UTC(...sana, soat, daq) - 5 * SOAT, 'Asia/Tashkent', v);
  // mahalliy vaqt: 27-oktabr 23:30 -> 28-oktabr 01:29
  assert.equal(M.oynaSanasi(Date.UTC(2026, 9, 27, 18, 29), 'Asia/Tashkent', v), null, '23:29');
  assert.equal(M.oynaSanasi(Date.UTC(2026, 9, 27, 18, 30), 'Asia/Tashkent', v), '2026-10-27', '23:30');
  assert.equal(M.oynaSanasi(Date.UTC(2026, 9, 27, 19, 0), 'Asia/Tashkent', v), '2026-10-27', '00:00 (28-oktabr): oyna kuni hamon 27-oktabr');
  assert.equal(M.oynaSanasi(Date.UTC(2026, 9, 27, 20, 29), 'Asia/Tashkent', v), '2026-10-27', '01:29');
  assert.equal(M.oynaSanasi(Date.UTC(2026, 9, 27, 20, 30), 'Asia/Tashkent', v), null, '01:30');
  assert.equal(M.oynaSanasi(T0, 'Asia/Tashkent', '23:59'), null); assert.equal(M.oynaSanasi(T0, 'Asia/Tashkent', 'buzuq'), null);
  void ol;
});
test('oyna: boshqa vaqt mintaqasi — Nyu-York 09:00 (T0 da 12:00 edi, oynadan tashqari; 17:00 UTC da 13:00 ham tashqari; 13:00 UTC = 09:00)', () => {
  const nyu = (utcSoat, utcDaq) => M.oynaSanasi(Date.UTC(2026, 9, 27, utcSoat, utcDaq), 'America/New_York', '09:00');
  assert.equal(nyu(12, 59), null); assert.equal(nyu(13, 0), '2026-10-27'); assert.equal(nyu(14, 59), '2026-10-27'); assert.equal(nyu(15, 0), null);
});
test('KUNLIK: yoqiq bo\'lsa va oynada bo\'lsa — har kuni; boshqa jadvallarga bog\'liq emas', () => {
  const q = { kunlik_yoqiq: true, kunlik_vaqt: '21:00:00', tz: 'Asia/Tashkent' };
  for (let kun = 0; kun < 5; kun++) assert.deepEqual(M.kunlikNomzod(q, T0 + kun * KUN + 10 * MIN), { kalit: 'kunlik', sana: '2026-10-' + (27 + kun) }, 'har kuni');
  assert.equal(M.kunlikNomzod({ ...q, kunlik_yoqiq: false }, T0), null);
  assert.equal(M.kunlikNomzod(q, T0 - 3 * SOAT), null); assert.equal(M.kunlikNomzod(q, T0 + 2 * SOAT), null);
  assert.equal(M.kunlikNomzod.length, 2, 'faqat qurilma va vaqt (yozuv/qarz argumenti yo\'q)');
  assert.ok(!/["'`]yozuvlar["'`]/.test(MANBA.replace(/\/\/[^\n]*/g, '')), 'kodda yozuvlar jadvali yo\'q');
});
test('QARZ oynasi: k = 0/1/3, muddat sanalari (oy chegarasi), noto\'g\'ri kunlar tashlanadi, bo\'sh ro\'yxat — null', () => {
  const q = { qarz_yoqiq: true, qarz_vaqt: '09:00:00', qarz_kunlar: [3, 0, 1, 2, 7, 0], tz: 'Asia/Tashkent' };
  const t = Date.UTC(2026, 9, 30, 4, 30);   // 30-oktabr 09:30 Toshkent
  assert.deepEqual(M.qarzOynasi(q, t), { sana: '2026-10-30', muddatlar: [{ k: 0, muddat: '2026-10-30' }, { k: 1, muddat: '2026-10-31' }, { k: 3, muddat: '2026-11-02' }] });
  assert.equal(M.qarzOynasi({ ...q, qarz_yoqiq: false }, t), null); assert.equal(M.qarzOynasi({ ...q, qarz_kunlar: [] }, t), null); assert.equal(M.qarzOynasi({ ...q, qarz_kunlar: [2] }, t), null);
  assert.equal(M.qarzOynasi(q, Date.UTC(2026, 9, 30, 2, 59)), null, '07:59'); assert.equal(M.qarzOynasi(q, Date.UTC(2026, 9, 30, 6, 0)), null, '11:00');
});
test('qarz nomzodlari: muddat mos, qolgan > 0; yopilgan va boshqa muddat tashlanadi; tartib (k, ism)', () => {
  const oyna = { sana: '2026-10-27', muddatlar: [{ k: 0, muddat: '2026-10-27' }, { k: 1, muddat: '2026-10-28' }, { k: 3, muddat: '2026-10-30' }] };
  const z = (id, shaxs, summa, muddat, tolangan = 0, yonalish = 'berdim') => ({ id, user_id: 'u', yonalish, shaxs, summa, muddat, tolangan });
  const r = M.qarzNomzodlari(oyna, [z('a', 'Vali', 100, '2026-10-30'), z('b', 'Ali', 500000, '2026-10-27', 100000), z('c', 'Yopiq', 100, '2026-10-27', 100), z('d', 'Ortiqcha', 100, '2026-10-27', 150), z('e', 'Boshqa', 100, '2026-10-29'), z('f', 'Ertaga', 50, '2026-10-28', 0, 'oldim'), z('g', 'Muddatsiz', 5, '')]);
  assert.deepEqual(r.map((x) => [x.kalit, x.sana, x.k, x.summa]), [['qarz:b:0', '2026-10-27', 0, 400000], ['qarz:f:1', '2026-10-28', 1, 50], ['qarz:a:3', '2026-10-30', 3, 100]]);
});
test('xabar matnlari: sarlavha (eng yaqin muddat), korsatish true/false, 3 tagacha + "va yana N ta", oldim qo\'shimchasi, summa formati, tag va url', () => {
  const it = (k, shaxs, summa, yonalish = 'berdim') => ({ kalit: 'qarz:' + shaxs + ':' + k, sana: 'x', k, shaxs, summa, yonalish });
  assert.equal(M.sumFormat(1000000), '1 000 000'); assert.equal(M.sumFormat(999), '999'); assert.equal(M.sumFormat(1234567.9), '1 234 567'); assert.equal(M.sumFormat(0), '0');
  let x = M.qarzXabar([it(0, 'Ali', 500000)], true, '2026-10-27');
  assert.deepEqual(x, { title: 'Qarz muddati bugun', body: 'Ali: 500 000 so\'m', tag: 'qarz-2026-10-27', data: { url: './?qarzlar=1' } });
  x = M.qarzXabar([it(1, 'Vali', 1000000, 'oldim')], true, '2026-10-27');
  assert.equal(x.title, 'Ertaga qarz muddati'); assert.equal(x.body, 'Vali: 1 000 000 so\'m, qaytarishingiz kerak');
  assert.equal(M.qarzXabar([it(3, 'Bek', 5)], true, 'd').title, '3 kundan keyin qarz muddati');
  assert.equal(M.qarzXabar([it(3, 'A', 1), it(1, 'B', 2), it(0, 'C', 3)], true, 'd').title, 'Qarz muddati bugun', 'birlashganda eng yaqini');
  x = M.qarzXabar([it(0, 'A', 1000), it(0, 'B', 2000), it(0, 'C', 3000), it(0, 'D', 4000), it(0, 'E', 5000)], true, 'd');
  assert.equal(x.body, 'A: 1 000 so\'m, B: 2 000 so\'m, C: 3 000 so\'m va yana 2 ta');
  assert.equal(M.qarzXabar([it(0, 'A', 1), it(0, 'B', 2), it(0, 'C', 3)], true, 'd').body, 'A: 1 so\'m, B: 2 so\'m, C: 3 so\'m', '3 ta — "va yana" yo\'q');
  x = M.qarzXabar([it(0, 'Ali', 500000), it(1, 'Vali', 700)], false, '2026-10-27');
  assert.deepEqual(x, { title: 'Qarz muddati bugun', body: 'Qarzlar ro\'yxatini ilovada ko\'ring', tag: 'qarz-2026-10-27', data: { url: './?qarzlar=1' } });
  assert.ok(!/Ali|Vali|500|700/.test(x.body + x.title), 'korsatish=false: ism va summa yo\'q');
  x = M.qarzXabar([it(0, '  ' + 'Uzun'.repeat(30) + '   ism ', 1), it(0, 'B'.repeat(200), 2), it(0, '', 3)], true, 'd');
  assert.ok(x.body.length <= 280); assert.ok(x.body.includes('Noma\'lum'), 'bo\'sh ism');
  assert.deepEqual(M.kunlikXabar('2026-10-27'), { title: 'Bugungi yozuvlarni kiriting', body: 'Bugun xarajat va daromadlaringizni yozib qo\'ydingizmi?', tag: 'kunlik-2026-10-27', data: { url: './?yangi=1' } });
});
test('sirMosmi: mos, mos emas, bo\'sh, qisqa, null', async () => {
  assert.equal(await M.sirMosmi(SIR, SIR), true); assert.equal(await M.sirMosmi(SIR + 'x', SIR), false); assert.equal(await M.sirMosmi('', SIR), false); assert.equal(await M.sirMosmi(null, SIR), false);
  assert.equal(await M.sirMosmi(SIR, undefined), false); assert.equal(await M.sirMosmi('qisqa', 'qisqa'), false, 'qisqa (16 dan kam) sir sozlanmagan hisoblanadi');
  assert.ok(/XOR|\^=|\^ /.test(MANBA) && /digest\("SHA-256"/.test(MANBA), 'constant-time solishtirish');
});

// ======================== EDGE FUNCTION (soxta Supabase va push xizmati) ========================
async function stend(o = {}) {
  const vapid = await vapidJuftligi();
  const h = { simdi: T0, qurilmalar: [], qarzlar: [], tolovlar: [], jurnal: [], push: [], sorovlar: [], pushHolat: () => 201, ...o.holat };
  const Q = {};
  async function qurilma(id, ust = {}) {
    const k = await qurilmaJuftligi();
    Q[id] = k;
    h.qurilmalar.push({ id, user_id: ust.user_id || 'u-' + id, endpoint: 'https://fcm.googleapis.com/fcm/send/' + id, p256dh: k.p256dh, auth_kaliti: k.auth, tz: 'Asia/Tashkent', kunlik_yoqiq: true, kunlik_vaqt: '21:00:00', qarz_yoqiq: false, qarz_kunlar: [0, 1], qarz_vaqt: '09:00:00', korsatish: true, ...ust });
    return k;
  }
  const J = (x, s = 200) => new Response(JSON.stringify(x), { status: s, headers: { 'Content-Type': 'application/json' } });
  const iz = (p) => (p || '').split(',').filter(Boolean);
  const fetchFn = async (url, init = {}) => {
    const u = new URL(url), usul = init.method || 'GET', p = u.searchParams;
    if (u.hostname !== 'x.invalid') {
      h.push.push({ endpoint: url, body: new Uint8Array(await new Response(init.body).arrayBuffer()) });
      const s = h.pushHolat(url);
      if (s === 0) throw new Error('tarmoq yo\'q');
      return new Response(null, { status: s });
    }
    const hd = new Headers(init.headers);
    h.sorovlar.push({ usul, yol: u.pathname, q: u.search, auth: hd.get('Authorization'), apikey: hd.get('apikey') });
    if (hd.get('Authorization') !== 'Bearer ' + SRK) return J({ message: 'JWT' }, 401);
    const jadval = u.pathname.replace('/rest/v1/', '');
    const ichida = (qiymat) => (qiymat || '').replace(/^in\.\(/, '').replace(/\)$/, '').split(',');
    if (jadval === 'bildirishnoma_qurilmalari') {
      if (usul === 'GET') return J(h.qurilmalar.filter((x) => x.kunlik_yoqiq || x.qarz_yoqiq).slice(0, +p.get('limit')));
      if (usul === 'DELETE') { const id = p.get('id').replace('eq.', ''); h.qurilmalar = h.qurilmalar.filter((x) => x.id !== id); h.jurnal = h.jurnal.filter((x) => x.qurilma_id !== id); return J([]); }
    }
    if (jadval === 'qarzlar' && usul === 'GET') {
      const us = ichida(p.get('user_id')), ms = ichida(p.get('muddat'));
      return J(h.qarzlar.filter((z) => !z.deleted && us.includes(z.user_id) && ms.includes(z.muddat)));
    }
    if (jadval === 'qarz_tolovlari' && usul === 'GET') { const ids = ichida(p.get('qarz_id')); return J(h.tolovlar.filter((t) => !t.deleted && ids.includes(t.qarz_id))); }
    if (jadval === 'eslatma_jurnali') {
      if (usul === 'POST') {
        if (!/ignore-duplicates/.test(hd.get('Prefer') || '') || p.get('on_conflict') !== 'qurilma_id,kalit,sana') return J({ message: 'noto\'g\'ri' }, 400);
        const yangi = [];
        for (const r of JSON.parse(init.body)) {
          if (h.jurnal.some((x) => x.qurilma_id === r.qurilma_id && x.kalit === r.kalit && x.sana === r.sana)) continue;   // unique: sinxron tekshiruv va qo'shish (atomik)
          h.jurnal.push({ ...r, created_at: new Date(h.simdi).toISOString() }); yangi.push({ kalit: r.kalit, sana: r.sana });
        }
        if (h.jurnalXato) return J({ message: 'xato' }, 500);
        return J(yangi, 201);
      }
      if (usul === 'DELETE') {
        if (p.get('created_at')) { const c = p.get('created_at').replace('lt.', ''); h.jurnal = h.jurnal.filter((x) => !(x.created_at < c)); return J([]); }
        const qid = p.get('qurilma_id').replace('eq.', ''), kal = ichida(p.get('kalit'));
        h.jurnal = h.jurnal.filter((x) => !(x.qurilma_id === qid && kal.includes(x.kalit))); return J([]);
      }
    }
    return J({ message: 'kutilmagan: ' + usul + ' ' + url }, 500);
  };
  const muhit = { SUPABASE_URL: 'https://x.invalid', SUPABASE_SERVICE_ROLE_KEY: SRK, CRON_SIRRI: SIR, VAPID_PUBLIC_KEY: vapid.ochiq, VAPID_PRIVATE_KEY: vapid.maxfiy, VAPID_SUBJECT: 'mailto:sinov@example.invalid', ...o.env };
  const chaqir = async (sir = SIR, usul = 'POST') => {
    const hd = {}; if (sir !== null) hd['x-kron-sirri'] = sir;
    const r = await M.ishlov(new Request('https://f.invalid/eslatma-yuborish', { method: usul, headers: hd, body: usul === 'POST' ? '{}' : undefined }), { get: (n) => muhit[n] }, fetchFn, () => h.simdi);
    return { r, j: await r.json() };
  };
  return { h, Q, qurilma, chaqir, vapid };
}
function logYigish() { const a = console.error, b = console.log, y = []; console.error = (...x) => y.push(x.map(String).join(' ')); console.log = (...x) => y.push(x.map(String).join(' ')); return { y, tugat: () => { console.error = a; console.log = b; } }; }
const ochiq = (s, q) => deshifrla(s.body, q);

test('SIR: sarlavhasiz, noto\'g\'ri yoki sozlanmagan sir — 401 va HECH NARSA qilinmaydi (serverga ham, push xizmatiga ham murojaat yo\'q)', async () => {
  const s = await stend(); await s.qurilma('d1');
  for (const sir of [null, '', 'noto\'g\'ri', SIR + 'x', SIR.toUpperCase()]) { const { r } = await s.chaqir(sir); assert.equal(r.status, 401); }
  assert.equal((await s.chaqir(SIR, 'GET')).r.status, 405, 'sir to\'g\'ri, lekin GET');
  assert.equal(s.h.sorovlar.length, 0); assert.equal(s.h.push.length, 0);
  const t = await stend({ env: { CRON_SIRRI: '' } }); await t.qurilma('d1');
  assert.equal((await t.chaqir('')).r.status, 401); assert.equal((await t.chaqir(SIR)).r.status, 401, 'sir sozlanmagan: hamma rad');
  const u = await stend({ env: { VAPID_PRIVATE_KEY: '' } });
  const { r, j } = await u.chaqir(); assert.equal(r.status, 503); assert.equal(j.xato, 'SOZLANMAGAN');
});
test('KUNLIK: 21:00 da yuboriladi, xabar to\'g\'ri; xuddi shu oynada qayta chaqirilsa YUBORILMAYDI (jurnal)', async () => {
  const s = await stend(); const k = await s.qurilma('d1');
  let { r, j } = await s.chaqir();
  assert.equal(r.status, 200); assert.deepEqual(j, { ok: true, qurilma: 1, yuborildi: 1, otkazildi: 0, xato: 0, ochirildi: 0 });
  assert.equal(s.h.push.length, 1); assert.equal(s.h.push[0].endpoint, 'https://fcm.googleapis.com/fcm/send/d1');
  assert.deepEqual(await ochiq(s.h.push[0], k), { title: 'Bugungi yozuvlarni kiriting', body: 'Bugun xarajat va daromadlaringizni yozib qo\'ydingizmi?', tag: 'kunlik-2026-10-27', data: { url: './?yangi=1' } });
  assert.deepEqual(s.h.jurnal.map((x) => [x.kalit, x.sana]), [['kunlik', '2026-10-27']]);
  s.h.simdi = T0 + 5 * MIN; ({ j } = await s.chaqir()); assert.equal(j.yuborildi, 0); assert.equal(j.otkazildi, 1); assert.equal(s.h.push.length, 1);
  s.h.simdi = T0 + 119 * MIN; ({ j } = await s.chaqir()); assert.equal(s.h.push.length, 1, 'oyna oxirigacha takror yo\'q');
  s.h.simdi = T0 + 121 * MIN; ({ j } = await s.chaqir()); assert.equal(j.otkazildi, 1); assert.equal(s.h.push.length, 1, 'oynadan keyin yuborilmaydi');
});
test('KUNLIK: HAR KUNI — yozuv, qarz yoki to\'lov bor-yo\'qligidan qat\'i nazar; yozuvlar jadvaliga murojaat YO\'Q', async () => {
  const s = await stend(); await s.qurilma('d1');
  for (let kun = 0; kun < 3; kun++) { s.h.simdi = T0 + kun * KUN; const { j } = await s.chaqir(); assert.equal(j.yuborildi, 1, kun + '-kun'); }
  assert.equal(s.h.push.length, 3);
  assert.deepEqual(s.h.jurnal.map((x) => x.sana), ['2026-10-27', '2026-10-28', '2026-10-29']);
  assert.ok(s.h.sorovlar.every((x) => /bildirishnoma_qurilmalari|eslatma_jurnali/.test(x.yol)), 'faqat qurilmalar va jurnal: ' + [...new Set(s.h.sorovlar.map((x) => x.yol))]);
});
test('KUNLIK: o\'tkazib yuborilgan tik keyingi tikda qoplanadi (oyna ichida), oynadan keyin esa yo\'q', async () => {
  const s = await stend(); await s.qurilma('d1');
  s.h.simdi = T0 + 100 * MIN;   // 22:40 (21:00 tiki o'tkazib yuborilgan edi)
  assert.equal((await s.chaqir()).j.yuborildi, 1);
  const t = await stend(); await t.qurilma('d1'); t.h.simdi = T0 + 130 * MIN;
  const { j } = await t.chaqir(); assert.equal(j.yuborildi, 0); assert.equal(t.h.push.length, 0);
});
test('MINTAQA: har qurilma o\'z vaqtida — Toshkent 21:00 da, Nyu-York 09:00 da; boshqa mintaqada vaqti kelmagan qurilmaga yuborilmaydi', async () => {
  const s = await stend(); await s.qurilma('toshkent'); await s.qurilma('nyuyork', { tz: 'America/New_York', kunlik_vaqt: '12:00:00' }); await s.qurilma('tong', { tz: 'America/New_York', kunlik_vaqt: '09:00:00' });
  const { j } = await s.chaqir();
  assert.equal(j.yuborildi, 2); assert.deepEqual(s.h.push.map((p) => p.endpoint.split('/').pop()).sort(), ['nyuyork', 'toshkent']);
  assert.equal(j.otkazildi, 1);
});
test('MINTAQA: noto\'g\'ri tz yoki ruxsatsiz endpoint — shu qurilma o\'tkaziladi, boshqalar to\'sqinlik qilmaydi; tz xatosi xato deb sanaladi', async () => {
  const s = await stend(); await s.qurilma('yomon', { tz: 'Mars/Olympus' }); await s.qurilma('hujum', { endpoint: 'https://169.254.169.254/x' }); await s.qurilma('soglom');
  const { j } = await s.chaqir();
  assert.equal(j.yuborildi, 1); assert.equal(j.xato, 1); assert.equal(j.otkazildi, 1); assert.deepEqual(s.h.push.map((p) => p.endpoint), ['https://fcm.googleapis.com/fcm/send/soglom']);
});
test('QARZ: k=0/1/3 moslashadi, yopilgan/o\'chirilgan/o\'chirilgan to\'lovli qarz hisobga olinadi; bir nechta qarz BITTA bildirishnomada', async () => {
  const t = Date.UTC(2026, 9, 27, 4, 0);   // 09:00 Toshkent
  const s = await stend({ holat: { simdi: t } });
  const k = await s.qurilma('d1', { user_id: 'u1', kunlik_yoqiq: false, qarz_yoqiq: true, qarz_kunlar: [0, 1, 3] });
  s.h.qarzlar.push(
    { id: 'q1', user_id: 'u1', yonalish: 'berdim', shaxs: 'Ali', summa: 500000, muddat: '2026-10-27' },
    { id: 'q2', user_id: 'u1', yonalish: 'oldim', shaxs: 'Vali', summa: 1000000, muddat: '2026-10-28' },
    { id: 'q3', user_id: 'u1', yonalish: 'berdim', shaxs: 'Bek', summa: 70000, muddat: '2026-10-30' },
    { id: 'q4', user_id: 'u1', yonalish: 'berdim', shaxs: 'Yopiq', summa: 100, muddat: '2026-10-27' },
    { id: 'q5', user_id: 'u1', yonalish: 'berdim', shaxs: 'Ochirilgan', summa: 100, muddat: '2026-10-27', deleted: true },
    { id: 'q6', user_id: 'u1', yonalish: 'berdim', shaxs: 'TolovOchirilgan', summa: 900, muddat: '2026-10-27' },
    { id: 'q7', user_id: 'u1', yonalish: 'berdim', shaxs: 'Boshqa muddat', summa: 100, muddat: '2026-10-29' },
    { id: 'q8', user_id: 'u2', yonalish: 'berdim', shaxs: 'Begona', summa: 100, muddat: '2026-10-27' });
  s.h.tolovlar.push({ qarz_id: 'q1', summa: 100000 }, { qarz_id: 'q4', summa: 100 }, { qarz_id: 'q6', summa: 900, deleted: true });
  const { j } = await s.chaqir();
  assert.equal(j.yuborildi, 1, 'bitta bildirishnoma'); assert.equal(s.h.push.length, 1);
  const x = await ochiq(s.h.push[0], k);
  assert.equal(x.title, 'Qarz muddati bugun'); assert.equal(x.tag, 'qarz-2026-10-27'); assert.deepEqual(x.data, { url: './?qarzlar=1' });
  assert.equal(x.body, 'Ali: 400 000 so\'m, TolovOchirilgan: 900 so\'m, Vali: 1 000 000 so\'m, qaytarishingiz kerak va yana 1 ta');
  assert.deepEqual(s.h.jurnal.map((z) => z.kalit).sort(), ['qarz:q1:0', 'qarz:q2:1', 'qarz:q3:3', 'qarz:q6:0']);
  assert.ok(!s.h.sorovlar.some((r) => /yozuvlar/.test(r.yol)));
  // qayta chaqirilsa — takror yo'q
  s.h.simdi = t + 5 * MIN; assert.equal((await s.chaqir()).j.yuborildi, 0); assert.equal(s.h.push.length, 1);
});
test('QARZ: yangi qarz keyingi tikda qo\'shilsa faqat YANGISI haqida yuboriladi; korsatish=false — ism va summa yo\'q', async () => {
  const s = await stend({ holat: { simdi: Date.UTC(2026, 9, 27, 4, 0) } });
  const k = await s.qurilma('d1', { user_id: 'u1', kunlik_yoqiq: false, qarz_yoqiq: true, qarz_kunlar: [0], korsatish: false });
  s.h.qarzlar.push({ id: 'q1', user_id: 'u1', yonalish: 'berdim', shaxs: 'Ali', summa: 500000, muddat: '2026-10-27' });
  await s.chaqir();
  assert.deepEqual(await ochiq(s.h.push[0], k), { title: 'Qarz muddati bugun', body: 'Qarzlar ro\'yxatini ilovada ko\'ring', tag: 'qarz-2026-10-27', data: { url: './?qarzlar=1' } });
  s.h.qarzlar.push({ id: 'q2', user_id: 'u1', yonalish: 'berdim', shaxs: 'Yangi', summa: 1, muddat: '2026-10-27' });
  s.h.simdi += 5 * MIN; const { j } = await s.chaqir();
  assert.equal(j.yuborildi, 1); assert.equal(s.h.push.length, 2);
  assert.deepEqual(s.h.jurnal.map((z) => z.kalit).sort(), ['qarz:q1:0', 'qarz:q2:0']);
});
test('QARZ + KUNLIK: bir qurilmaga ikkalasi ham kerak bo\'lsa ikkita alohida bildirishnoma (har birining o\'z tagi)', async () => {
  const s = await stend({ holat: { simdi: Date.UTC(2026, 9, 27, 4, 0) } });   // 09:00
  const k = await s.qurilma('d1', { user_id: 'u1', kunlik_vaqt: '09:00:00', qarz_yoqiq: true, qarz_kunlar: [0] });
  s.h.qarzlar.push({ id: 'q1', user_id: 'u1', yonalish: 'berdim', shaxs: 'Ali', summa: 5, muddat: '2026-10-27' });
  const { j } = await s.chaqir(); assert.equal(j.yuborildi, 2);
  assert.deepEqual((await Promise.all(s.h.push.map((p) => ochiq(p, k)))).map((x) => x.tag).sort(), ['kunlik-2026-10-27', 'qarz-2026-10-27']);
});
test('QARZ: boshqa foydalanuvchining qarzi bu qurilmaga yuborilmaydi; muddat k bilan mos kelmasa yo\'q; qarz_yoqiq o\'chiq bo\'lsa qarzlar jadvali o\'qilmaydi', async () => {
  const s = await stend({ holat: { simdi: Date.UTC(2026, 9, 27, 4, 0) } });
  await s.qurilma('d1', { user_id: 'u1', kunlik_yoqiq: false, qarz_yoqiq: true, qarz_kunlar: [1] });
  s.h.qarzlar.push({ id: 'q1', user_id: 'u2', yonalish: 'berdim', shaxs: 'Begona', summa: 5, muddat: '2026-10-28' }, { id: 'q2', user_id: 'u1', yonalish: 'berdim', shaxs: 'Mening', summa: 5, muddat: '2026-10-27' });
  assert.equal((await s.chaqir()).j.yuborildi, 0);
  const t = await stend(); await t.qurilma('d1'); await t.chaqir();
  assert.ok(!t.h.sorovlar.some((r) => /qarzlar|qarz_tolovlari/.test(r.yol)), 'qarz yoqilmagan: qarzlar o\'qilmaydi');
});
test('410 (va 404): qurilma qatori o\'chadi (jurnal ham), qolgan eslatmalar shu qurilmaga yuborilmaydi; boshqa qurilma ta\'sirlanmaydi', async () => {
  for (const kod of [410, 404]) {
    const s = await stend({ holat: { simdi: Date.UTC(2026, 9, 27, 4, 0) } });
    await s.qurilma('o\'lik', { user_id: 'u1', kunlik_vaqt: '09:00:00', qarz_yoqiq: true, qarz_kunlar: [0] }); await s.qurilma('tirik', { kunlik_vaqt: '09:00:00' });
    s.h.qarzlar.push({ id: 'q1', user_id: 'u1', yonalish: 'berdim', shaxs: 'Ali', summa: 5, muddat: '2026-10-27' });
    s.h.pushHolat = (url) => (url.endsWith('/' + 'o\'lik') ? kod : 201);
    const { j } = await s.chaqir();
    assert.equal(j.ochirildi, 1, String(kod)); assert.equal(j.yuborildi, 1);
    assert.deepEqual(s.h.qurilmalar.map((x) => x.id), ['tirik']); assert.ok(s.h.jurnal.every((x) => x.qurilma_id === 'tirik'));
    assert.equal(s.h.push.filter((p) => p.endpoint.endsWith('/o\'lik')).length, 1, 'o\'lik qurilmaga bitta urinish');
  }
});
test('IZOLYATSIYA: bir qurilmaning xatosi (tarmoq, 500, 400, shifrlash) boshqalarga to\'sqinlik qilmaydi', async () => {
  const s = await stend();
  for (const id of ['a', 'b', 'c', 'd', 'e']) await s.qurilma(id);
  s.h.qurilmalar.find((x) => x.id === 'e').p256dh = 'buzuq';
  s.h.pushHolat = (url) => { const m = { a: 0, b: 500, c: 400 }, id = url.split('/').pop(); return id in m ? m[id] : 201; };
  const { r, j } = await s.chaqir();
  assert.equal(r.status, 200); assert.equal(j.yuborildi, 1); assert.equal(j.xato, 4);
  assert.deepEqual(s.h.push.map((p) => p.endpoint.split('/').pop()).sort(), ['a', 'b', 'c', 'd']);
});
test('VAQTINCHA XATO (tarmoq, 429, 5xx): jurnal o\'chiriladi va keyingi tikda qayta uriniladi; doimiy 4xx da jurnal QOLADI', async () => {
  for (const kod of [0, 429, 503]) {
    const s = await stend(); await s.qurilma('d1');
    s.h.pushHolat = () => kod;
    let { j } = await s.chaqir(); assert.equal(j.xato, 1); assert.equal(s.h.jurnal.length, 0, kod + ': jurnal o\'chdi');
    s.h.pushHolat = () => 201; s.h.simdi = T0 + 5 * MIN;
    ({ j } = await s.chaqir()); assert.equal(j.yuborildi, 1, kod + ': qayta urinish'); assert.equal(s.h.jurnal.length, 1);
  }
  const s = await stend(); await s.qurilma('d1'); s.h.pushHolat = () => 400;
  await s.chaqir(); assert.equal(s.h.jurnal.length, 1, '400: jurnal qoladi (cheksiz takror yo\'q)');
  s.h.pushHolat = () => 201; s.h.simdi = T0 + 5 * MIN; assert.equal((await s.chaqir()).j.yuborildi, 0);
});
test('PARALLEL: ikki chaqiruv bir vaqtda — har eslatma BIR marta yuboriladi', async () => {
  const s = await stend({ holat: { simdi: Date.UTC(2026, 9, 27, 4, 0) } });
  for (const id of ['a', 'b', 'c']) await s.qurilma(id, { user_id: 'u1', kunlik_vaqt: '09:00:00', qarz_yoqiq: true, qarz_kunlar: [0] });
  s.h.qarzlar.push({ id: 'q1', user_id: 'u1', yonalish: 'berdim', shaxs: 'Ali', summa: 5, muddat: '2026-10-27' });
  const [x, y] = await Promise.all([s.chaqir(), s.chaqir()]);
  assert.equal(x.j.yuborildi + y.j.yuborildi, 6, 'jami 3 qurilma x 2 xabar'); assert.equal(s.h.push.length, 6);
  assert.equal(new Set(s.h.push.map((p) => p.endpoint)).size, 3);
});
test('JURNAL: 14 kundan eski qatorlar o\'chadi, 13 kunlik qoladi; ishlov chaqirig\'ida tozalanadi', async () => {
  const s = await stend(); await s.qurilma('d1', { kunlik_yoqiq: false, qarz_yoqiq: false });
  s.h.qurilmalar[0].kunlik_yoqiq = true; s.h.qurilmalar[0].kunlik_vaqt = '03:00:00';   // bu tikda hech narsa yuborilmaydi
  s.h.jurnal.push({ qurilma_id: 'd1', kalit: 'kunlik', sana: '2026-10-01', created_at: new Date(T0 - 15 * KUN).toISOString() }, { qurilma_id: 'd1', kalit: 'kunlik', sana: '2026-10-14', created_at: new Date(T0 - 13 * KUN).toISOString() });
  await s.chaqir();
  assert.deepEqual(s.h.jurnal.map((x) => x.sana), ['2026-10-14']);
});
test('LIMIT va so\'rovlar: bir chaqiruvda ko\'pi bilan 500 qurilma; hamma so\'rov service_role bilan; push so\'rovi 8 soniya timeout', async () => {
  const s = await stend(); await s.qurilma('d1'); await s.chaqir();
  const q = s.h.sorovlar.find((x) => x.yol.endsWith('bildirishnoma_qurilmalari') && x.usul === 'GET');
  assert.ok(/limit=500\b/.test(q.q)); assert.ok(s.h.sorovlar.every((x) => x.auth === 'Bearer ' + SRK && x.apikey === SRK));
  assert.equal(M.QURILMA_MAX, 500); assert.equal(M.YUBORISH_TAYM_MS, 8000); assert.equal(M.JURNAL_KUN, 14); assert.equal(M.OYNA_DAQIQA, 120); assert.equal(M.PARALLEL, 10);
});
test('JURNAL XATOSI: jurnalga yozib bo\'lmasa PUSH YUBORILMAYDI (takror xavfi bo\'lmasin)', async () => {
  const s = await stend({ holat: { jurnalXato: true } }); await s.qurilma('d1');
  const { j } = await s.chaqir(); assert.equal(j.yuborildi, 0); assert.equal(j.xato, 1); assert.equal(s.h.push.length, 0);
});
test('LOG: faqat sonlar va holat kodlari — endpoint, kalit, ism, summa, sir YOZILMAYDI', async () => {
  const L = logYigish();
  try {
    const s = await stend({ holat: { simdi: Date.UTC(2026, 9, 27, 4, 0) } });
    const k = await s.qurilma('d1', { user_id: 'u1', kunlik_vaqt: '09:00:00', qarz_yoqiq: true, qarz_kunlar: [0] });
    s.h.qarzlar.push({ id: 'q1', user_id: 'u1', yonalish: 'berdim', shaxs: 'MaxfiyIsm', summa: 123456789, muddat: '2026-10-27' });
    s.h.pushHolat = () => 500; await s.chaqir(); s.h.pushHolat = () => 410; s.h.simdi += 5 * MIN; await s.chaqir(); await s.chaqir('xato');
    const hammasi = L.y.join('\n');
    for (const sir of [s.h.qurilmalar[0]?.endpoint || 'https://fcm.googleapis.com/fcm/send/d1', 'fcm.googleapis.com', k.p256dh, k.auth, s.vapid.maxfiy, s.vapid.ochiq, SIR, SRK, 'MaxfiyIsm', '123456789', '123 456 789']) assert.ok(!hammasi.includes(sir), 'logda sir: ' + sir);
    assert.ok(L.y.length > 0 && L.y.every((x) => /^eslatma-yuborish: [a-z_]+(=\d+)?( [a-z]+=\d+)*( holatlar=[\w:,]+)?$/.test(x) || /^eslatma-yuborish: \w+ \S+$/.test(x)), 'log shakli: ' + L.y.join(' | '));
  } finally { L.tugat(); }
});
test('kod: service_role kaliti va sir kodda yozilmagan; tashqi paket yo\'q; import faqat ./push.ts; push.ts manbadan farq qilmaydi', () => {
  const kod = MANBA.replace(/\/\/[^\n]*/g, '');
  assert.ok(!/eyJ[A-Za-z0-9_-]{20,}|sb_secret_|npm:|jsr:|esm\.sh|deno\.land/.test(kod));
  assert.ok(/muhit\.get\("SUPABASE_SERVICE_ROLE_KEY"\)/.test(kod) && /muhit\.get\("CRON_SIRRI"\)/.test(kod));
  const importlar = (MANBA.match(/^\s*import\s[^\n]*$/gm) || []);
  assert.ok(importlar.length > 0 && importlar.every((x) => /from "\.\/push\.ts"/.test(x)));
  assert.ok(!/console\.(info|debug)/.test(kod));
  const m = readFileSync(join(BU, '..', '_shared', 'push.ts'), 'utf8');
  assert.equal(readFileSync(join(BU, 'push.ts'), 'utf8'), m, 'bash tools/push-nusxa.sh');
  assert.equal(readFileSync(join(BU, '..', 'bildirishnoma', 'push.ts'), 'utf8'), m);
  assert.ok(typeof P.pushYubor === 'function');
});
