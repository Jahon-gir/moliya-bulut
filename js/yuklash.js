// Birinchi yuklash (TZ-sinxronlash.md, S4): mahalliy ma'lumotni serverga BIR MARTA, qo'lda yuborish.
// Ikki tomonlama sinxronlash, navbat va avtomatik yuborish YO'Q (bu S5). Mahalliy ma'lumotga hech narsa o'zgarmaydi:
// faqat "yuklash" holati (qachon, kim uchun) shu qurilmaning ichki yozuvida saqlanadi (zaxiraga va eksportga kirmaydi).
// Kutubxona: @supabase/postgrest-js (supabase-js ning jadval qismi), js/vendor/supabase-postgrest.min.js — ichki nusxa, service worker keshida.
// Faqat ochiq (publishable) kalit ishlatiladi. user_id, created_at, updated_at ni ilova YUBORMAYDI: serverdagi trigger o'zi qo'yadi.
var Yuklash = (function () {
  'use strict';

  var JADVALLAR = ['hisoblar', 'kategoriyalar', 'yozuvlar', 'byudjetlar', 'qarzlar', 'qarz_tolovlari', 'sozlamalar'];   // yuklash tartibi (bog'liqlik uchun)
  var NOMLAR = { hisoblar: 'Hisoblar', kategoriyalar: 'Kategoriyalar', yozuvlar: 'Yozuvlar', byudjetlar: 'Byudjetlar', qarzlar: 'Qarzlar', qarz_tolovlari: 'Qarz to\'lovlari', sozlamalar: 'Sozlamalar' };
  var BOLAK = 300;                 // bir so'rovda nechta qator
  var KALIT = 'yuklash';           // sozlamalar ichidagi mahalliy holat yozuvi
  var MAKS_SUMMA = 999999999999999;
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var SANA = /^\d{4}-\d{2}-\d{2}$/, VAQT = /^\d{2}:\d{2}(:\d{2})?$/;
  var yurmoqda = false, sozlama = {};

  // ---------------- Sof yordamchilar (DOM'siz; tests.html da sinaladi) ----------------
  // Mahalliy ma'lumot (Data.hammasiniOqish, o'chirilgan qatorlar bilan) -> serverdagi jadval qatorlari.
  // Yuborilmaydi: eski_id, updated_at (serverda belgilanadi), balans (saqlanmaydi), PIN va boshqa mahalliy yozuvlar.
  function qatorlar(m) {
    var r = {};
    ['hisoblar', 'kategoriyalar', 'yozuvlar', 'byudjetlar'].forEach(function (j) { r[j] = (m[j] || []).map(function (x) { return SinxronSof.serverQatori(j, x); }); });
    r.qarzlar = (m.qarzlar || []).map(function (x) { return SinxronSof.serverQatori('qarzlar', x); });
    r.qarz_tolovlari = [];
    (m.qarzlar || []).forEach(function (q) { (q.tolovlar || []).forEach(function (t) { r.qarz_tolovlari.push(SinxronSof.tolovQatori(q.id, t)); }); });
    var a = (m.sozlamalar || []).filter(function (x) { return x && x.kalit === 'asosiy'; })[0];
    r.sozlamalar = a ? [SinxronSof.serverQatori('sozlamalar', a)] : [];
    return r;
  }

  function soni(r) { var n = {}; JADVALLAR.forEach(function (j) { n[j] = (r[j] || []).length; }); return n; }
  function jami(n) { return JADVALLAR.reduce(function (a, j) { return a + (n[j] || 0); }, 0); }

  // Serverga yuborishdan OLDIN tekshiruv (hech narsa yuborilmaydi): serverdagi cheklovlarga mos kelmaydigan qatorlar ro'yxati.
  // Bitta buzuq qator butun so'rovni (bo'lakni) rad ettirmasligi uchun avval hammasi tekshiriladi.
  // opts.havolasiz — faqat bitta qator ichidagi tekshiruv (bog'langan qatorlar shu to'plamda bo'lmasligi mumkin: navbatdan yuborishda)
  function tekshirRoyxat(r, opts) {
    var xatolar = [], havolasiz = !!(opts && opts.havolasiz);
    function xato(j, i, x, sabab) { xatolar.push({ jadval: j, id: x && x.id, sabab: sabab, matn: NOMLAR[j] + ' #' + (i + 1) + (x && x.id ? ' (' + String(x.id).slice(0, 8) + '…)' : '') + ': ' + sabab }); }
    var ids = {};
    function bor(j, id) { return havolasiz || !!ids[j][id]; }
    JADVALLAR.forEach(function (j) { ids[j] = {}; (r[j] || []).forEach(function (x) { if (x.id) ids[j][x.id] = true; }); });
    var butun = function (v) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v; };
    var musbat = function (v) { return butun(v) && v > 0 && v <= MAKS_SUMMA; };
    var sana = function (v) { return typeof v === 'string' && SANA.test(v) && !isNaN(Date.parse(v + 'T00:00:00Z')); };
    var vaqt = function (v) { return typeof v === 'string' && VAQT.test(v); };
    var matn = function (v) { return typeof v === 'string' && v.trim() !== ''; };
    var vaqtYaratilgan = function (v) { return typeof v === 'string' && !isNaN(Date.parse(v)); };
    JADVALLAR.forEach(function (j) {
      var korilgan = {};
      (r[j] || []).forEach(function (x, i) {
        if (!UUID.test(String(x.id || ''))) return xato(j, i, x, 'ID UUID emas');
        if (korilgan[x.id]) return xato(j, i, x, 'takroriy ID');
        korilgan[x.id] = true;
        if (j === 'hisoblar') {
          if (!matn(x.nom)) xato(j, i, x, 'nom bo\'sh');
          else if (['karta', 'bank', 'naqd', 'boshqa'].indexOf(x.tur) < 0) xato(j, i, x, 'tur noto\'g\'ri');
          else if (!matn(x.belgi) || !matn(x.rang)) xato(j, i, x, 'belgi yoki rang yo\'q');
          else if (!/^([0-9]{4})?$/.test(x.oxirgi4)) xato(j, i, x, 'oxirgi 4 raqam noto\'g\'ri');
          else if (!butun(x.boshlangich_qoldiq) || Math.abs(x.boshlangich_qoldiq) > MAKS_SUMMA) xato(j, i, x, 'boshlang\'ich qoldiq noto\'g\'ri');
          else if (!vaqtYaratilgan(x.yaratilgan)) xato(j, i, x, 'yaratilgan vaqti noto\'g\'ri');
        } else if (j === 'kategoriyalar') {
          if (!matn(x.nom)) xato(j, i, x, 'nom bo\'sh');
          else if (['daromad', 'xarajat'].indexOf(x.tur) < 0) xato(j, i, x, 'tur noto\'g\'ri');
          else if (!matn(x.belgi) || !matn(x.rang)) xato(j, i, x, 'belgi yoki rang yo\'q');
          else if (!vaqtYaratilgan(x.yaratilgan)) xato(j, i, x, 'yaratilgan vaqti noto\'g\'ri');
        } else if (j === 'yozuvlar') {
          if (['daromad', 'xarajat', 'otkazma'].indexOf(x.tur) < 0) xato(j, i, x, 'tur noto\'g\'ri');
          else if (!musbat(x.summa)) xato(j, i, x, 'summa musbat butun son emas');
          else if (!sana(x.sana) || !vaqt(x.vaqt)) xato(j, i, x, 'sana yoki vaqt noto\'g\'ri');
          else if (!vaqtYaratilgan(x.yaratilgan)) xato(j, i, x, 'yaratilgan vaqti noto\'g\'ri');
          else if (!bor('hisoblar', x.hisob_id)) xato(j, i, x, 'hisobga havola uzilgan');
          else if (x.tur === 'otkazma') {
            if (!x.qabul_hisob_id || x.kategoriya_id !== null || x.qabul_hisob_id === x.hisob_id) xato(j, i, x, 'o\'tkazma tuzilmasi noto\'g\'ri');
            else if (!bor('hisoblar', x.qabul_hisob_id)) xato(j, i, x, 'qabul qiluvchi hisobga havola uzilgan');
          } else if (x.qabul_hisob_id !== null || !x.kategoriya_id) xato(j, i, x, 'kategoriya majburiy');
          else if (!bor('kategoriyalar', x.kategoriya_id)) xato(j, i, x, 'kategoriyaga havola uzilgan');
        } else if (j === 'byudjetlar') {
          if (!musbat(x.oylik_limit)) xato(j, i, x, 'chegara musbat butun son emas');
          else if (x.kategoriya_id !== null && !bor('kategoriyalar', x.kategoriya_id)) xato(j, i, x, 'kategoriyaga havola uzilgan');
        } else if (j === 'qarzlar') {
          if (['berdim', 'oldim'].indexOf(x.yonalish) < 0) xato(j, i, x, 'yo\'nalish noto\'g\'ri');
          else if (!matn(x.shaxs)) xato(j, i, x, 'shaxs nomi bo\'sh');
          else if (!musbat(x.summa)) xato(j, i, x, 'summa musbat butun son emas');
          else if (!sana(x.sana) || !vaqt(x.vaqt) || (x.muddat !== null && !sana(x.muddat))) xato(j, i, x, 'sana, vaqt yoki muddat noto\'g\'ri');
          else if (!vaqtYaratilgan(x.yaratilgan)) xato(j, i, x, 'yaratilgan vaqti noto\'g\'ri');
          else if (!bor('hisoblar', x.hisob_id)) xato(j, i, x, 'hisobga havola uzilgan');
        } else if (j === 'qarz_tolovlari') {
          if (!musbat(x.summa)) xato(j, i, x, 'summa musbat butun son emas');
          else if (!sana(x.sana) || !vaqt(x.vaqt)) xato(j, i, x, 'sana yoki vaqt noto\'g\'ri');
          else if (!bor('qarzlar', x.qarz_id)) xato(j, i, x, 'qarzga havola uzilgan');
          else if (!bor('hisoblar', x.hisob_id)) xato(j, i, x, 'hisobga havola uzilgan');
        } else if (j === 'sozlamalar') {
          if (!butun(x.sxema_versiyasi) || x.sxema_versiyasi < 1) xato(j, i, x, 'sxema versiyasi noto\'g\'ri');
          else if (['qurilma', 'yorug', 'qorongi'].indexOf(x.tema) < 0) xato(j, i, x, 'tema noto\'g\'ri');
          else if (x.oxirgi_zaxira_sanasi !== null && !sana(x.oxirgi_zaxira_sanasi)) xato(j, i, x, 'zaxira sanasi noto\'g\'ri');
        }
      });
    });
    return xatolar;
  }
  function tekshir(r, opts) { return tekshirRoyxat(r, opts).map(function (x) { return x.matn; }); }

  function bolaklash(royxat, n) { var b = []; for (var i = 0; i < royxat.length; i += n) b.push(royxat.slice(i, i + n)); return b; }

  // Serverdan kelgan xatoni foydalanuvchiga tushunarli matnga aylantiradi
  function xatoMatni(x, jadval) {
    var m = String((x && (x.message || x.details)) || x || '').toLowerCase(), kod = String((x && x.code) || '');
    var joy = jadval ? ' (' + NOMLAR[jadval] + ')' : '';
    if (!m && !kod) return 'Noma\'lum xato' + joy + '.';
    if (m.indexOf('fetch') >= 0 || m.indexOf('network') >= 0 || m.indexOf('failed to') >= 0 || m.indexOf('abort') >= 0 || m.indexOf('timeout') >= 0 || m.indexOf('load failed') >= 0) return 'Internet uzildi yoki server javob bermadi' + joy + '. Internetni tekshirib, qayta urinib ko\'ring: qolgan joyidan davom etadi.';
    if (kod === 'PGRST301' || kod === 'PGRST303' || m.indexOf('jwt') >= 0 || String(x && x.status) === '401') return 'Kirish muddati tugagan. Chiqib, qayta kiring.';
    if (kod === '42P01' || kod === 'PGRST205' || m.indexOf('does not exist') >= 0 || m.indexOf('could not find the table') >= 0) return 'Serverda jadvallar topilmadi' + joy + '. Supabase\'da supabase/001_sxema.sql ishga tushirilganini tekshiring.';
    if (kod === '42501' || m.indexOf('row-level security') >= 0 || m.indexOf('permission denied') >= 0) return 'Server ruxsat bermadi' + joy + '. Qayta kirib ko\'ring.';
    if (kod === '23503') return 'Server bog\'liqlikni tasdiqlamadi' + joy + ' (bog\'langan qator topilmadi).';
    if (kod === '23514' || kod === '23502' || kod === '22P02' || kod === '22007' || kod === '22008') return 'Server qatorni qabul qilmadi' + joy + ': ma\'lumot serverdagi qoidalarga mos emas (' + String((x && x.message) || kod).slice(0, 120) + ').';
    return 'Server xatosi' + joy + ': ' + String((x && x.message) || kod).slice(0, 140);
  }

  // ---------------- Server bilan ishlash ----------------
  // sozlash({ fetch, token }) — sinov uchun (taqlid server). Odatda Kirish.tokenOl va oddiy fetch.
  function sozlash(s) { sozlama = s || {}; }

  function mijoz() {
    var tokenOl = sozlama.token || function () { return Kirish.tokenOl(); };
    var asosiyFetch = sozlama.fetch || function (u, o) { return fetch(u, o); };
    var manzil = sozlama.manzil || Kirish.SUPABASE_MANZIL, kalit = sozlama.kalit || Kirish.OCHIQ_KALIT;
    return new SupabasePostgrest.PostgrestClient(manzil + '/rest/v1', {
      headers: { apikey: kalit },
      fetch: function (url, opts) {
        return Promise.resolve(tokenOl()).then(function (t) {
          if (!t) throw new Error('Kirish muddati tugagan (jwt)');
          var h = new Headers(opts && opts.headers);
          h.set('Authorization', 'Bearer ' + t);
          h.set('apikey', kalit);
          return asosiyFetch(url, Object.assign({}, opts, { headers: h }));
        });
      }
    });
  }

  function tashla(e, jadval) { var x = new Error(xatoMatni(e, jadval)); x.server = true; throw x; }

  // Serverdagi qatorlar soni (faqat o'zingizniki: RLS). Natija: { hisoblar: n, ... }
  function serverSoni(c) {
    var n = {};
    return JADVALLAR.reduce(function (p, j) {
      return p.then(function () {
        return c.from(j).select('id', { count: 'exact', head: true }).then(function (r) { if (r.error) tashla(r.error, j); n[j] = r.count || 0; }, function (e) { tashla(e, j); });
      });
    }, Promise.resolve()).then(function () { return n; });
  }

  // Serverdagi ID lar (1000 talik sahifalar bilan): "bu server qatorlari bizniki-mi" tekshiruvi uchun
  function serverIdlari(c, j) {
    var ids = [];
    function sahifa(b) {
      return c.from(j).select('id').order('id').range(b, b + 999).then(function (r) {
        if (r.error) tashla(r.error, j);
        (r.data || []).forEach(function (x) { ids.push(x.id); });
        return (r.data || []).length === 1000 ? sahifa(b + 1000) : ids;
      }, function (e) { tashla(e, j); });
    }
    return sahifa(0);
  }

  // Mahalliy holat yozuvi: { kalit, user_id, boshlangan, tugagan, soni }
  function holatOl() { return Data.olish('sozlamalar', KALIT).then(function (h) { return h || null; }); }
  function holatYoz(h) { return Data.saqlash('sozlamalar', Object.assign({ kalit: KALIT }, h)); }

  // Asosiy amal. opts: { foydalanuvchi: <id>, progress(bajarildi, jami, jadval) }
  // Natija: { ok: true, jadvallar: [...], soni, vaqt }  |  { ok: false, tur: 'bor' | 'xato' | 'mos-emas' | 'buzuq' | 'band', xato, ... }
  function yubor(opts) {
    opts = opts || {};
    if (yurmoqda) return Promise.resolve({ ok: false, tur: 'band', xato: 'Yuklash allaqachon davom etmoqda.' });
    yurmoqda = true;
    var c, r, mahalliy, mavjudHolat;
    function tugat(x) { yurmoqda = false; return x; }
    return Data.hammasiniOqish().then(function (m) {
      r = qatorlar(m); mahalliy = soni(r);
      var buzuq = tekshir(r);
      if (buzuq.length) return tugat({ ok: false, tur: 'buzuq', xato: 'Serverga yuborilmadi: ' + buzuq.length + ' ta qator serverdagi qoidalarga mos emas. Hech narsa yuborilmadi.', buzuq: buzuq.slice(0, 10) });
      c = mijoz();
      return holatOl().then(function (h) {
        mavjudHolat = h;
        return serverSoni(c);
      }).then(function (server) {
        if (jami(server) === 0) return null;
        // Serverda qator bor. Faqat shu qurilmaning o'z oldingi (yarim yoki tugagan) yuklashi bo'lsa davom etamiz:
        // shu foydalanuvchi uchun mahalliy yuklash yozuvi bor VA serverdagi har bir ID bizda ham bor. Aks holda HECH NARSAGA tegmaymiz.
        if (!mavjudHolat || !opts.foydalanuvchi || mavjudHolat.user_id !== opts.foydalanuvchi) return { server: server };
        return JADVALLAR.reduce(function (p, j) {
          return p.then(function (mos) {
            if (!mos || !server[j]) return mos;
            var bizda = {}; r[j].forEach(function (x) { bizda[x.id] = true; });
            return serverIdlari(c, j).then(function (ids) { return ids.every(function (id) { return bizda[id]; }); });
          });
        }, Promise.resolve(true)).then(function (mos) { return mos ? null : { server: server }; });
      }).then(function (bor) {
        if (bor) return tugat({ ok: false, tur: 'bor', server: bor.server, xato: 'Serverda allaqachon ma\'lumot bor. Bu holat keyingi bosqichda hal qilinadi. Hech narsa yuborilmadi, serverdagi hech narsa o\'zgarmadi.' });
        var boshlangan = mavjudHolat && mavjudHolat.user_id === opts.foydalanuvchi && !mavjudHolat.tugagan ? mavjudHolat.boshlangan : new Date().toISOString();
        return holatYoz({ user_id: opts.foydalanuvchi || '', boshlangan: boshlangan, tugagan: null, soni: mahalliy }).then(function () {
          var jamiSoni = jami(mahalliy), bajarildi = 0;
          if (opts.progress) opts.progress(0, jamiSoni, JADVALLAR[0]);
          return JADVALLAR.reduce(function (p, j) {
            return p.then(function () {
              return bolaklash(r[j], BOLAK).reduce(function (q, bolak) {
                return q.then(function () {
                  return c.from(j).upsert(bolak, { onConflict: 'id' }).then(function (res) {
                    if (res.error) tashla(res.error, j);
                    bajarildi += bolak.length;
                    if (opts.progress) opts.progress(bajarildi, jamiSoni, j);
                  }, function (e) { tashla(e, j); });
                });
              }, Promise.resolve());
            });
          }, Promise.resolve()).then(function () { return serverSoni(c); }).then(function (server) {
            var jadvallar = JADVALLAR.map(function (j) { return { jadval: j, nom: NOMLAR[j], mahalliy: mahalliy[j], server: server[j], mos: mahalliy[j] === server[j] }; });
            var farq = jadvallar.filter(function (x) { return !x.mos; });
            if (farq.length) return tugat({ ok: false, tur: 'mos-emas', jadvallar: jadvallar, xato: 'Yuklash tugadi, lekin qatorlar soni mos kelmadi: ' + farq.map(function (x) { return x.nom + ' ' + x.server + '/' + x.mahalliy; }).join(', ') + '. Qayta bosib ko\'ring.' });
            var vaqt = new Date().toISOString();
            return holatYoz({ user_id: opts.foydalanuvchi || '', boshlangan: boshlangan, tugagan: vaqt, soni: mahalliy }).then(function () { return tugat({ ok: true, jadvallar: jadvallar, soni: mahalliy, vaqt: vaqt }); });
          });
        });
      });
    }).catch(function (e) { return tugat({ ok: false, tur: 'xato', xato: e && e.server ? e.message : xatoMatni(e) }); });
  }

  return {
    JADVALLAR: JADVALLAR, NOMLAR: NOMLAR, BOLAK: BOLAK, KALIT: KALIT,
    qatorlar: qatorlar, soni: soni, jami: jami, tekshir: tekshir, tekshirRoyxat: tekshirRoyxat, serverSoni: serverSoni, serverIdlari: serverIdlari, mijoz: mijoz, tashla: tashla, bolaklash: bolaklash, xatoMatni: xatoMatni,
    sozlash: sozlash, holatOl: holatOl, yubor: yubor, band: function () { return yurmoqda; }
  };
})();
