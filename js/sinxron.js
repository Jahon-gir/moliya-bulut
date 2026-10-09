// Ikki tomonlama sinxronlash (TZ-sinxronlash.md, S5): o'zgarishlarni serverga avtomatik yuborish (navbat), serverdagi o'zgarishlarni tortib olish,
// birinchi sinxron (yuklash / olish: tanlovsiz, server yutadi), holat ko'rsatkichi. Kirmagan foydalanuvchi uchun UMUMAN ishlamaydi.
// Mahalliy baza asosiy: ilova avvalgidek hamma narsani undan o'qiydi; server — nusxa va qurilmalar o'rtasidagi ko'prik.
// Sof (bazasiz, tarmoqsiz) qoidalar js/sinxron-sof.js da; serverga yuborish va xato matnlari js/yuklash.js da (S4); bazaga yozish js/data.js da.
// Faqat ochiq (publishable) kalit ishlatiladi; user_id, created_at, updated_at ni ilova yubormaydi (serverdagi trigger qo'yadi).
var Sinxron = (function () {
  'use strict';

  var J = SinxronSof.JADVALLAR;
  var OVERLAP_MS = 5000;        // tortishda oxirgi kursordan shuncha orqaga qaytiladi (parallel yozuvlar tartibi buzilsa ham qator o'tib ketmasin; qayta qo'llash zararsiz)
  var SAHIFA = 1000;            // serverdan bir so'rovda ko'pi bilan shuncha qator (PostgREST chegarasi)
  var YUBOR_BOLAK = 150;        // bir so'rovda yuboriladigan qatorlar (katta import bo'lak-bo'lak yuboriladi)
  var OCHIRISH_BOLAK = 100;     // "id in (...)" ro'yxati uzun bo'lib ketmasin
  var KECHIKISH_MS = 2500;      // o'zgarishdan keyin yuborishni shuncha kutish (ketma-ket o'zgarishlar bitta so'rovga yig'iladi)
  var DAVR_MS = 60000;          // ilova ochiq turganda tortish davri
  var KAMIDA_MS = 8000;         // fokus/internet hodisalarida ketma-ket tsikllar orasidagi eng kam masofa
  var sozlama = {};

  var holat = { tur: 'boshlanmagan', tayyor: false, rozilik: false, jarayon: '', soni: 0, oxirgi: null, xato: '', ziddiyat: 0, rad: [], ishlayapti: false, yangilandi: 0 };
  var kuzatuvchilar = [], tortildiKuzatuvchilar = [];
  var yaqinda = {}, oldingiYaqinda = {};       // oxirgi tsikllarda o'zimiz yuborgan qator id lari ("aks-sado" to'qnashuv emas)
  var oxirgiKirishId = null, band = null, birinchiBand = false, avtoBand = false, oxirgiFaollik = Date.now(), tikSoni = 0, rpcHolati = undefined, qayta = false, xatoKod = '', rejaSoati = null, davrSoati = null, boshlandi = false, oxirgiBoshlanish = 0, xatoMatni = '', xatoTuri = '';

  function sozla(s) { sozlama = s || {}; }
  function uid() { return sozlama.foydalanuvchi ? sozlama.foydalanuvchi() : (typeof Kirish !== 'undefined' && Kirish.holat().kirgan ? Kirish.holat().id : ''); }
  function xabarla() { kuzatuvchilar.slice().forEach(function (f) { try { f(holat); } catch (e) { /* ahamiyatsiz */ } }); }
  function kuzat(f) { kuzatuvchilar.push(f); return function () { kuzatuvchilar = kuzatuvchilar.filter(function (x) { return x !== f; }); }; }
  function tortildiKuzat(f) { tortildiKuzatuvchilar.push(f); }
  function tashlash() { yaqinda = {}; oldingiYaqinda = {}; xatoMatni = ''; xatoTuri = ''; xatoKod = ''; avtoBand = false; rpcHolati = undefined; tikSoni = 0; holat.jarayon = ''; holat.rad = []; holat.ziddiyat = 0; holat.oxirgi = null; }   // sinovlarda qurilma almashganda

  // ---------------- Holat ----------------
  function yozuvOl() { return Data.olish('sozlamalar', Data.SINXRON_KALITI); }
  // ---- Rozilik (S8): "Google bilan kirish" tugmasini bosish = rozilik. Faqat shu akkaunt uchun bir marta saqlanadi (mahalliy yozuv, zaxiraga kirmaydi) ----
  var ROZILIK_BELGISI = 'moliya-rozilik-kutilmoqda';   // "moliya-" bilan boshlanadi: "PINni unutdim" to'liq tozalashi uni ham o'chiradi
  function rozilikOl() { return Data.olish('sozlamalar', 'rozilik'); }
  function rozilikBelgisiniQoy() { try { localStorage.setItem(ROZILIK_BELGISI, String(Date.now())); } catch (e) { /* ahamiyatsiz */ } }
  function rozilikBelgisiniOl() {
    try { var t = Number(localStorage.getItem(ROZILIK_BELGISI)); localStorage.removeItem(ROZILIK_BELGISI); return !!t && Date.now() - t < 30 * 60000; } catch (e) { return false; }
  }
  function rozilikYoz(id) { return Data.saqlash('sozlamalar', { kalit: 'rozilik', user_id: id, vaqt: new Date().toISOString() }); }
  // Kirish tugmasi bosilgach (Google dan qaytganda) belgi akkaunt bilan bog'lanadi. Natija: shu akkaunt uchun rozilik bor-yo'qligi
  function rozilikniQayd() {
    var id = uid();
    if (!id) return Promise.resolve(false);
    return rozilikOl().then(function (r) {
      if (r && r.user_id === id) { rozilikBelgisiniOl(); return true; }
      if (rozilikBelgisiniOl()) return rozilikYoz(id).then(function () { return true; });
      return false;
    });
  }
  // Eski kirgan foydalanuvchi (rozilik yozuvi yo'q) "Roziman" tugmasini bossa
  function rozilikBer() { var id = uid(); if (!id) return Promise.resolve(false); return rozilikYoz(id).then(function () { return holatniYangila(); }).then(function () { return avtomatik(); }); }

  function yozuvYoz(r) { return Data.saqlash('sozlamalar', Object.assign({ kalit: Data.SINXRON_KALITI }, r)); }

  // Holatni bazadan hisoblaydi va ko'rsatkichni yangilaydi. Natija: sinxron yozuvi (yoki null)
  function holatniYangila() {
    return Promise.all([yozuvOl(), Data.navbatniOl(), rozilikOl()]).then(function (r) {
      var rec = r[0] || null, soni = SinxronSof.navbatSoni(r[1]), id = uid(), roz = r[2];
      holat.soni = soni;
      holat.oxirgi = rec && rec.oxirgi_vaqt ? rec.oxirgi_vaqt : null;
      holat.rad = rec && rec.rad ? rec.rad : [];
      holat.ziddiyat = rec && rec.ziddiyat ? rec.ziddiyat : 0;
      holat.xato = xatoMatni; holat.kod = xatoKod;
      holat.tayyor = tayyorMi(rec, id); holat.rozilik = !!(roz && roz.user_id === id);
      if (!id) holat.tur = 'yoq';
      else if (!tayyorMi(rec, id)) {
        // Birinchi sinxron shu akkaunt uchun hali tugamagan. Rozilik yo'q: "yoqilmagan" (yoki boshqa akkaunt). Rozilik bor: avtomatik boshlanmoqda / xato
        if (!roz || roz.user_id !== id) holat.tur = rec && rec.user_id && rec.user_id !== id ? 'boshqa-akkaunt' : 'boshlanmagan';
        else if (holat.ishlayapti || avtoBand) holat.tur = 'ishlayapti';
        else if (xatoMatni) holat.tur = xatoTuri === 'internet' ? 'internet-yoq' : 'xato';
        else holat.tur = 'boshlanmoqda';
      }
      else if (holat.ishlayapti) holat.tur = 'ishlayapti';
      else if (xatoMatni) holat.tur = xatoTuri === 'internet' ? 'internet-yoq' : 'xato';
      else if (typeof navigator !== 'undefined' && navigator.onLine === false && soni > 0) holat.tur = 'internet-yoq';
      else holat.tur = soni > 0 ? 'kutilmoqda' : 'tayyor';
      holat.yangilandi++;
      xabarla();
      return rec;
    });
  }
  function tayyorMi(rec, id) { return !!(rec && rec.tayyor === true && id && rec.user_id === id); }

  // ---------------- Tortib olish ----------------
  function laterISO(a, b) { return !a || Date.parse(b) > Date.parse(a) ? b : a; }

  // Bir jadvalni kursordan boshlab tortadi; har sahifa bitta tranzaksiyada qo'llanadi. onSahifa(qatorlar) -> Promise
  function jadvalniTort(c, j, kursor, onSahifa) {
    var maks = kursor || null, since = kursor ? new Date(Date.parse(kursor) - OVERLAP_MS).toISOString() : '1970-01-01T00:00:00.000Z';
    function sahifa(dan) {
      return c.from(j).select('*').gte('updated_at', dan).order('updated_at', { ascending: true }).order('id', { ascending: true }).limit(SAHIFA).then(function (res) {
        if (res.error) Yuklash.tashla(res.error, j, res.status);
        var q = res.data || [];
        if (!q.length) return maks;
        return Promise.resolve(onSahifa(q)).then(function () {
          q.forEach(function (x) { maks = laterISO(maks, x.updated_at); });
          if (q.length < SAHIFA) return maks;
          var keyingi = SinxronSof.iso(q[q.length - 1].updated_at);
          if (keyingi === dan) keyingi = new Date(Date.parse(keyingi) + 1).toISOString();   // hammasi bir xil vaqtda bo'lsa ham oldinga yuramiz
          return sahifa(keyingi);
        });
      }, function (e) { Yuklash.tashla(e, j); });
    }
    return sahifa(since);
  }

  var TORTISH_TARTIBI = ['hisoblar', 'kategoriyalar', 'yozuvlar', 'byudjetlar', 'qarzlar', 'qarz_tolovlari'];   // sozlamalar tortilmaydi: tema va h.k. har qurilmada alohida

  // Serverdagi sinxron_holati() (supabase/005): har jadvalning eng oxirgi o'zgarish vaqti BITTA so'rovda. Bo'lmasa (null) — eski usul (har jadvalga so'rov).
  function serverHolati(c) {
    if (rpcHolati === false) return Promise.resolve(null);
    return c.rpc('sinxron_holati').then(function (res) {
      if (res.error) { if (res.status === 404 || res.error.code === 'PGRST202') rpcHolati = false; return null; }   // funksiya yo'q: shu seans davomida qayta so'ralmaydi
      rpcHolati = true;
      return res.data || null;
    }, function () { return null; });
  }

  // majbur = true: har jadval tekshiriladi (ilova ochilganda va har 10-tsiklda: kechikib yozilgan qator o'tib ketmasin). Aks holda faqat o'zgargan jadvallar tortiladi.
  function tort(c, rec, majbur) {
    var jami = { yozildi: 0, ziddiyat: 0 }, kursor = Object.assign({}, rec.kursor || {}), ozgardi = false;
    var ctxYaqinda = Object.assign({}, oldingiYaqinda, yaqinda);
    return (majbur ? Promise.resolve(null) : serverHolati(c)).then(function (sh) {
      return TORTISH_TARTIBI.reduce(function (p, j) {
        return p.then(function () {
          if (sh && kursor[j]) {                                   // serverdagi eng oxirgi vaqt bizning kursorimizdan yangi emas: bu jadvalda yangilik yo'q
            if (!sh[j] || Date.parse(sh[j]) <= Date.parse(kursor[j])) return;
          } else if (sh && !sh[j] && !kursor[j]) return;           // serverda bu jadval bo'sh
          return jadvalniTort(c, j, kursor[j], function (qatorlar) {
            return Data.tortilganlarniYozish(j, qatorlar, ctxYaqinda).then(function (h) { jami.yozildi += h.yozildi; jami.ziddiyat += h.ziddiyat; });
          }).then(function (maks) { if (maks && maks !== kursor[j]) { kursor[j] = maks; ozgardi = true; } });
        });
      }, Promise.resolve());
    }).then(function () {
      if (!ozgardi && !jami.ziddiyat) return jami;
      return yozuvOl().then(function (yangi) {
        yangi = Object.assign({}, yangi || rec, { kursor: Object.assign({}, (yangi && yangi.kursor) || {}, kursor) });
        if (jami.ziddiyat) yangi.ziddiyat = (yangi.ziddiyat || 0) + jami.ziddiyat;
        return yozuvYoz(yangi);
      }).then(function () { return jami; });
    });
  }

  // ---------------- Yuborish (navbat) ----------------
  function bolaklash(royxat, n) { var b = []; for (var i = 0; i < royxat.length; i += n) b.push(royxat.slice(i, i + n)); return b; }

  // Navbatdagi o'zgargan qatorlar -> server jadvallari bo'yicha qatorlar. Har element: { kalit, qiymat, qator }
  function yuboriladiganlar(navbat, oqilgan) {
    var r = { hisoblar: [], kategoriyalar: [], yozuvlar: [], byudjetlar: [], qarzlar: [], qarz_tolovlari: [], sozlamalar: [] }, qiymatlar = navbat.qatorlar || {};
    ['hisoblar', 'kategoriyalar', 'yozuvlar', 'byudjetlar'].forEach(function (t) {
      (oqilgan[t] || []).forEach(function (x) { var k = t === 'byudjetlar' ? x.kategoriya_id : x.id; r[t].push({ kalit: k, qiymat: qiymatlar[t][k], qator: SinxronSof.serverQatori(t, x) }); });
    });
    (oqilgan.qarzlar || []).forEach(function (q) {
      r.qarzlar.push({ kalit: q.id, qiymat: qiymatlar.qarzlar[q.id], qator: SinxronSof.serverQatori('qarzlar', q) });
      (q.tolovlar || []).forEach(function (t) { r.qarz_tolovlari.push({ kalit: q.id, qiymat: qiymatlar.qarzlar[q.id], qator: SinxronSof.tolovQatori(q.id, t) }); });
    });
    (oqilgan.sozlamalar || []).forEach(function (x) { if (x.kalit === 'asosiy') r.sozlamalar.push({ kalit: 'asosiy', qiymat: qiymatlar.sozlamalar.asosiy, qator: SinxronSof.serverQatori('sozlamalar', x) }); });
    return r;
  }

  // Bog'liqlik (FK) xatosi: qator qaysi ota qatorga tayanadi
  var FK_OTA = { yozuvlar: [['hisob_id', 'hisoblar'], ['qabul_hisob_id', 'hisoblar'], ['kategoriya_id', 'kategoriyalar']], byudjetlar: [['kategoriya_id', 'kategoriyalar']], qarzlar: [['hisob_id', 'hisoblar']], qarz_tolovlari: [['qarz_id', 'qarzlar'], ['hisob_id', 'hisoblar']] };
  var FK_URINISH_CHEGARA = 5;   // avtomatik qayta yuborish urinishlari (qo'lda "Qayta urinish" cheklanmagan)

  // Oldingi tsiklda bog'liqlik xatosi bilan o'tmagan qatorlar qayta navbatga qo'yiladi (ota qator keyin yuborilgan bo'lishi mumkin)
  function fkQatorlarniQaytaNavbatga(qolda) {
    return yozuvOl().then(function (rec) {
      var rad = rec && rec.rad ? rec.rad : [], qayta = rad.filter(function (r) { return r.fk && (qolda || (r.urinish || 0) < FK_URINISH_CHEGARA); });
      fkOldin = {};
      if (!qayta.length) return;
      qayta.forEach(function (r) { fkOldin[r.jadval + '|' + r.id] = r.urinish || 0; });
      return Data.navbatgaQoshish(qayta.map(function (r) { return { jadval: r.jadval === 'qarz_tolovlari' ? 'qarzlar' : r.jadval, kalit: r.kalit || r.id }; })).then(function () {
        return yozuvYoz(Object.assign({}, rec, { rad: rad.filter(function (r) { return qayta.indexOf(r) < 0; }) }));
      });
    });
  }
  var fkOldin = {};

  function yubor(c, progress, qolda) {
    var natija = { yuborildi: 0, rad: [] }, navbat, ruyxat, qarzUchun = {}, radNavbat = [], fkRad = [];
    return fkQatorlarniQaytaNavbatga(qolda).then(function () { return Data.navbatniOl(); }).then(function (n) {
      navbat = n;
      var kalitlar = {};
      Object.keys(n.qatorlar || {}).forEach(function (t) { var k = Object.keys(n.qatorlar[t]); if (k.length) kalitlar[t] = k; });
      return Data.qatorlarniOqish(kalitlar);
    }).then(function (oqilgan) {
      ruyxat = yuboriladiganlar(navbat, oqilgan);
      // Serverga mos kelmaydigan qator butun navbatni to'xtatmasin: u chetga olinadi va xato ro'yxatida ko'rsatiladi (TZ 6.9)
      var buzuq = Yuklash.tekshirRoyxat({ hisoblar: ruyxat.hisoblar.map(function (x) { return x.qator; }), kategoriyalar: ruyxat.kategoriyalar.map(function (x) { return x.qator; }), yozuvlar: ruyxat.yozuvlar.map(function (x) { return x.qator; }),
        byudjetlar: ruyxat.byudjetlar.map(function (x) { return x.qator; }), qarzlar: ruyxat.qarzlar.map(function (x) { return x.qator; }), qarz_tolovlari: ruyxat.qarz_tolovlari.map(function (x) { return x.qator; }), sozlamalar: ruyxat.sozlamalar.map(function (x) { return x.qator; }) }, { havolasiz: true });
      var radId = {}, qarzRad = {};
      buzuq.forEach(function (b) { radId[b.jadval + '|' + b.id] = b; });
      J.forEach(function (j) {
        ruyxat[j] = ruyxat[j].filter(function (x) {
          var b = radId[j + '|' + x.qator.id];
          if (!b) return true;
          natija.rad.push({ jadval: j, id: x.qator.id, sabab: b.sabab, kod: 'CLIENT_INVALID', tavsif: '' });
          radNavbat.push({ store: j === 'qarz_tolovlari' ? 'qarzlar' : j, kalit: x.kalit, qiymat: x.qiymat });
          if (j === 'qarz_tolovlari') qarzRad[x.kalit] = true;   // to'lovi buzuq qarz butunlay chetga olinadi (qarz va to'lovlari birga yuboriladi)
          return false;
        });
      });
      ruyxat.qarz_tolovlari = ruyxat.qarz_tolovlari.filter(function (x) { return !qarzRad[x.kalit]; });
      ruyxat.qarzlar = ruyxat.qarzlar.filter(function (x) { return !qarzRad[x.kalit]; });
    }).then(function () {
      var jamiSoni = J.reduce(function (a, j) { return a + ruyxat[j].length; }, 0), bajarildi = 0;
      if (progress && jamiSoni) progress(0, jamiSoni);
      // Bo'lak serverning MA'LUMOT qoidalariga to'g'ri kelmagani uchun rad etilsa (PG 22xxx/23xxx, HTTP 400/409/413/422), u teng ikkiga bo'linib qayta yuboriladi
      // va xatoli qator(lar) ajratiladi: qolganlari yuboriladi. Tarmoq, kirish (401/403) va server (5xx) xatolari avvalgidek tsiklni to'xtatadi (navbat saqlanadi).
      var qoshimchaSoroq = 60;   // bitta tsiklda bo'lish uchun qo'shimcha so'rovlar chegarasi (hammasi buzuq bo'lsa, so'rovlar to'lib ketmasin)
      function malumotXatosimi(res) {
        var kod = Yuklash.xatoKodi(res.error, res.status), st = res.status, m = String((res.error && (res.error.message || res.error.details)) || '').toLowerCase();
        if (m.indexOf('sub claim') >= 0 || m.indexOf('user_not_found') >= 0 || m.indexOf('jwt') >= 0 || (kod === 'PG_23503' && String((res.error && (res.error.details || res.error.message)) || '').indexOf('users') >= 0)) return false;   // akkaunt o'chirilgan / kirish muddati tugagan: ma'lumot xatosi emas
        return /^PG_(22|23)/.test(kod) || [400, 409, 413, 422].indexOf(st) >= 0 || (/^PG_PGRST1/.test(kod));
      }
      function tavsif(j, q) {
        if (j === 'yozuvlar') return (q.sana || '') + ' ' + (q.tur || '') + ' ' + (q.summa || '') + (q.izoh ? ' «' + String(q.izoh).slice(0, 30) + '»' : '');
        if (j === 'hisoblar' || j === 'kategoriyalar') return q.nom || '';
        if (j === 'qarzlar') return (q.shaxs || '') + ' ' + (q.summa || '');
        if (j === 'qarz_tolovlari') return (q.sana || '') + ' ' + (q.summa || '');
        return '';
      }
      function muvaffaq(j, bolak) {
        bajarildi += bolak.length; natija.yuborildi += bolak.length;
        bolak.forEach(function (x) { yaqinda[x.qator.id] = true; });
        if (progress) progress(bajarildi, jamiSoni, j);
        if (j === 'qarzlar' || j === 'qarz_tolovlari') { bolak.forEach(function (x) { qarzUchun[x.kalit] = x.qiymat; }); return; }   // qarz navbatdan to'lovlari bilan birga olinadi
        var y = {}; y[j] = {}; bolak.forEach(function (x) { y[j][x.kalit] = x.qiymat; });
        return Data.navbatdanOlish(y);
      }
      function bolakniYubor(j, bolak) {
        return c.from(j).upsert(bolak.map(function (x) { return x.qator; }), { onConflict: 'id' }).then(function (res) {
          if (!res.error) return muvaffaq(j, bolak);
          if (j === 'sozlamalar' && Yuklash.xatoKodi(res.error, res.status) === 'PG_42501') {   // Sozlamalar qatori uchun ruxsat xatosi: jim e'tiborsiz; navbatdan olinadi (kutilayotganlar soniga kirmaydi), xato ko'rsatilmaydi
            bajarildi += bolak.length; if (progress) progress(bajarildi, jamiSoni, j);
            var yy = { sozlamalar: {} }; bolak.forEach(function (x) { yy.sozlamalar[x.kalit] = x.qiymat; });
            return Data.navbatdanOlish(yy);
          }
          if (!malumotXatosimi(res) || natija.rad.length >= 30) Yuklash.tashla(res.error, j, res.status);
          if (Yuklash.xatoKodi(res.error, res.status) === 'PG_23503' && FK_OTA[j]) { bolak.forEach(function (x) { fkRad.push({ j: j, x: x }); }); return; }   // bog'liqlik: bo'lmaymiz, avval ota qatorlar tekshiriladi (tsikl oxirida)
          if (bolak.length > 1) {
            if (qoshimchaSoroq-- <= 0) Yuklash.tashla(res.error, j, res.status);
            var h = Math.ceil(bolak.length / 2);
            return bolakniYubor(j, bolak.slice(0, h)).then(function () { return bolakniYubor(j, bolak.slice(h)); });
          }
          var x = bolak[0], kod = Yuklash.xatoKodi(res.error, res.status);   // bitta qator: ajratiladi
          natija.rad.push({ jadval: j, id: x.qator.id, sabab: Yuklash.xatoMatni(res.error, j), kod: kod, tavsif: tavsif(j, x.qator) });
          radNavbat.push({ store: j === 'qarz_tolovlari' ? 'qarzlar' : j, kalit: x.kalit, qiymat: x.qiymat });
          bajarildi += 1; if (progress) progress(bajarildi, jamiSoni, j);
        }, function (e) { Yuklash.tashla(e, j); });
      }
      // Bog'liqlik xatosi (PG_23503) bilan rad etilgan qatorlar: ota qator mahalliyda bo'lsa avval o'sha yuboriladi, so'ng qator qayta yuboriladi.
      // Ota qator mahalliyda ham yo'q bo'lsa — qator "rad etilgan" ro'yxatiga qaysi ota qator yo'qligi bilan yoziladi va keyingi tsikllarda avtomatik qayta urinadi.
      function otaNomi(t, x) { return x ? (t === 'qarzlar' ? x.shaxs : x.nom) || '' : ''; }
      function fkniTuzat() {
        if (!fkRad.length) return Promise.resolve();
        var kerak = {}, otaServerda = {};
        fkRad.forEach(function (it) { FK_OTA[it.j].forEach(function (f) { var id = it.x.qator[f[0]]; if (id) (kerak[f[1]] = kerak[f[1]] || {})[id] = true; }); });
        var so = {}; Object.keys(kerak).forEach(function (t) { so[t] = Object.keys(kerak[t]); });
        return Data.qatorlarniOqish(so).then(function (mah) {
          var bor = {}, otaTartib = ['hisoblar', 'kategoriyalar', 'qarzlar'];
          otaTartib.forEach(function (t) { (mah[t] || []).forEach(function (x) { bor[t + '|' + x.id] = x; }); });
          return otaTartib.reduce(function (p, t) {
            return p.then(function () {
              var mahRoyxat = mah[t] || [];
              if (!mahRoyxat.length) return;
              // Faqat serverda YO'Q ota qatorlar yuboriladi: serverdagi (boshqa qurilma o'zgartirgan) qator eski mahalliy nusxa bilan ustiga yozilib ketmasin
              var idlar = mahRoyxat.map(function (x) { return x.id; });
              return bolaklash(idlar, 100).reduce(function (q, ids) {
                return q.then(function (bor0) {
                  return c.from(t).select('id').in('id', ids).then(function (res) {
                    if (res.error) Yuklash.tashla(res.error, t, res.status);
                    (res.data || []).forEach(function (r) { bor0[r.id] = true; otaServerda[t + '|' + r.id] = true; });
                    return bor0;
                  }, function (e) { Yuklash.tashla(e, t); });
                });
              }, Promise.resolve({})).then(function (serverda) {
                var royxat = mahRoyxat.filter(function (x) { return !serverda[x.id]; }).map(function (x) { return SinxronSof.serverQatori(t, x); });
                if (!royxat.length) return;
                return c.from(t).upsert(royxat, { onConflict: 'id' }).then(function (res) {
                  if (res.error) { if (!malumotXatosimi(res)) Yuklash.tashla(res.error, t, res.status); return; }   // ota qatorning o'zi rad etilsa, farzand qayta urinishda yana rad etiladi (sababi ro'yxatda)
                  royxat.forEach(function (q) { yaqinda[q.id] = true; otaServerda[t + '|' + q.id] = true; });
                }, function (e) { Yuklash.tashla(e, t); });
              });
            });
          }, Promise.resolve()).then(function () {
            // ota qatorlar yuborildi: farzandlar qayta yuboriladi (bo'lak-bo'lak; rad etilsa teng ikkiga bo'linadi, yagona qator — ro'yxatga)
            // ota qatori serverda hamon YO'Q (mahalliyda ham yo'q yoki rad etilgan) qatorlar bevosita ro'yxatga yoziladi: ular uchun so'rov yuborib bo'lmaydi
            var guruh = {}, yoqOta = [];
            fkRad.forEach(function (it) {
              var yoq = FK_OTA[it.j].some(function (f) { var id = it.x.qator[f[0]]; return id && !otaServerda[f[1] + '|' + id]; });
              if (yoq) yoqOta.push(it); else (guruh[it.j] = guruh[it.j] || []).push(it.x);
            });
            yoqOta.forEach(function (it) {
              var key = it.j + '|' + it.x.qator.id;
              natija.rad.push({ jadval: it.j, id: it.x.qator.id, sabab: 'Server bog\'liqlikni tasdiqlamadi (bog\'langan qator topilmadi).', kod: 'PG_23503', tavsif: tavsif(it.j, it.x.qator), ota: otaMalumoti(it.j, it.x), fk: true, kalit: it.x.kalit, urinish: (fkOldin[key] || 0) + 1 });
              radNavbat.push({ store: it.j === 'qarz_tolovlari' ? 'qarzlar' : it.j, kalit: it.x.kalit, qiymat: it.x.qiymat });
              bajarildi += 1; if (progress) progress(bajarildi, jamiSoni, it.j);
            });
            var budjet = 80;
            function otaMalumoti(j, x) {
              var ota = [];
              FK_OTA[j].forEach(function (f) { var id = x.qator[f[0]]; if (id && !otaServerda[f[1] + '|' + id]) ota.push({ jadval: f[1], id: id, nom: otaNomi(f[1], bor[f[1] + '|' + id]), mahalliy: !!bor[f[1] + '|' + id] }); });   // faqat serverda topilmaganlari
              return ota;
            }
            function qaytaYubor(j, bolak) {
              return c.from(j).upsert(bolak.map(function (x) { return x.qator; }), { onConflict: 'id' }).then(function (res) {
                if (!res.error) return muvaffaq(j, bolak);
                if (!malumotXatosimi(res)) Yuklash.tashla(res.error, j, res.status);
                if (bolak.length > 1 && budjet-- > 0) { var h = Math.ceil(bolak.length / 2); return qaytaYubor(j, bolak.slice(0, h)).then(function () { return qaytaYubor(j, bolak.slice(h)); }); }
                bolak.forEach(function (x) {
                  var kod = Yuklash.xatoKodi(res.error, res.status), key = j + '|' + x.qator.id;
                  natija.rad.push({ jadval: j, id: x.qator.id, sabab: Yuklash.xatoMatni(res.error, j), kod: kod, tavsif: tavsif(j, x.qator), ota: otaMalumoti(j, x), fk: kod === 'PG_23503', kalit: x.kalit, urinish: (fkOldin[key] || 0) + 1 });
                  radNavbat.push({ store: j === 'qarz_tolovlari' ? 'qarzlar' : j, kalit: x.kalit, qiymat: x.qiymat });
                  bajarildi += 1; if (progress) progress(bajarildi, jamiSoni, j);
                });
              }, function (e) { Yuklash.tashla(e, j); });
            }
            return J.reduce(function (p2, j) {
              return p2.then(function () { return guruh[j] ? bolaklash(guruh[j], YUBOR_BOLAK).reduce(function (q, bolak) { return q.then(function () { return qaytaYubor(j, bolak); }); }, Promise.resolve()) : null; });
            }, Promise.resolve());
          });
        });
      }
      return J.reduce(function (p, j) {
        return p.then(function () {
          return bolaklash(ruyxat[j], YUBOR_BOLAK).reduce(function (q, bolak) { return q.then(function () { return bolakniYubor(j, bolak); }); }, Promise.resolve());
        });
      }, Promise.resolve()).then(function () { return fkniTuzat(); });
    }).then(function () {
      // qarzlar va to'lovlari ikkalasi ham yuborilgach, qarz navbatdan olinadi
      var kalitlar = Object.keys(qarzUchun);
      if (!kalitlar.length) return;
      var y = { qarzlar: {} }; kalitlar.forEach(function (k) { y.qarzlar[k] = qarzUchun[k]; });
      return Data.navbatdanOlish(y);
    }).then(function () {
      // Buzuq qatorlar navbatdan olinadi (ular tahrirlanganda yana navbatga tushadi)
      return radNavbat.reduce(function (p, r) { return p.then(function () { return Data.navbatdanTashlash(r.store, r.kalit, r.qiymat); }); }, Promise.resolve());
    }).then(function () {
      // Serverda o'chirilishi kerak bo'lgan (byudjetdagi yutqazgan) qatorlar
      var och = navbat.ochirish || {};
      return Object.keys(och).reduce(function (p, j) {
        return p.then(function () {
          return bolaklash(och[j] || [], OCHIRISH_BOLAK).reduce(function (q, ids) {
            return q.then(function () {
              return c.from(j).update({ deleted: true }).in('id', ids).then(function (res) {
                if (res.error) Yuklash.tashla(res.error, j, res.status);
                var o = {}; o[j] = ids;
                return Data.navbatdanOlish(null, o);
              }, function (e) { Yuklash.tashla(e, j); });
            });
          }, Promise.resolve());
        });
      }, Promise.resolve());
    }).then(function () { return natija; });
  }

  // ---------------- Bitta tsikl ----------------
  function nomaxsus(e) { return e && e.server ? e.message : Yuklash.xatoMatni(e); }
  function kodOl(e) { return e && e.kod ? e.kod : Yuklash.xatoKodi(e); }
  function internetXatomi(m) { return /^Internet uzildi/.test(m || ''); }

  // sabab: 'ochildi' | 'fokus' | 'internet' | 'vaqt' | 'ozgarish' | 'qolda' | 'kirish'. opts.progress(bajarildi, jami, jadval)
  function yurgiz(sabab, opts) {
    opts = opts || {};
    if (birinchiBand) return Promise.resolve({ ok: false, tur: 'band', kod: 'SYNC_FIRST_RUNNING', xato: 'Birinchi sinxronlash davom etmoqda.' });   // birinchi sinxron paytida fon tsikli boshlanmaydi
    if (band) { qayta = true; return band; }
    var id = uid();
    if (!id) { holat.tur = 'yoq'; xabarla(); return Promise.resolve({ ok: false, tur: 'kirmagan' }); }
    band = yozuvOl().then(function (rec) {
      if (!tayyorMi(rec, id)) return holatniYangila().then(function () { return { ok: false, tur: 'tayyor-emas' }; });
      if (typeof navigator !== 'undefined' && navigator.onLine === false && !sozlama.internetniTekshirma) {
        xatoTuri = 'internet'; xatoKod = 'NETWORK_OFFLINE'; xatoMatni = 'Internet yo\'q. O\'zgarishlar saqlanadi va internet qaytganda avtomatik yuboriladi.';
        return holatniYangila().then(function () { return { ok: false, tur: 'internet-yoq' }; });
      }
      oxirgiBoshlanish = Date.now();
      holat.ishlayapti = true; xabarla();
      var c, tortilgan = 0;
      return Promise.resolve().then(function () { c = Yuklash.mijoz(); tikSoni++; return tort(c, rec, ['ochildi', 'qolda', 'internet', 'kirish', 'qayta'].indexOf(sabab) >= 0 || tikSoni % 10 === 0); }).then(function (t) {
        tortilgan = t.yozildi;
        return yubor(c, opts.progress, sabab === 'qolda');
      }).then(function (y) {
        oldingiYaqinda = yaqinda; yaqinda = {};
        xatoMatni = ''; xatoTuri = ''; xatoKod = '';
        return yozuvOl().then(function (yangi) {
          yangi = Object.assign({}, yangi || rec, { oxirgi_vaqt: new Date().toISOString() });
          if (y.rad.length) yangi.rad = (yangi.rad || []).concat(y.rad).slice(-200);
          return yozuvYoz(yangi);
        }).then(function () { holat.ishlayapti = false; return holatniYangila(); }).then(function () {
          if (tortilgan) tortildiKuzatuvchilar.forEach(function (f) { try { f(tortilgan); } catch (e) { /* ahamiyatsiz */ } });
          return { ok: true, tortilgan: tortilgan, yuborilgan: y.yuborildi, rad: y.rad };
        });
      }).catch(function (e) {
        holat.ishlayapti = false;
        xatoMatni = nomaxsus(e); xatoKod = kodOl(e); xatoTuri = internetXatomi(xatoMatni) ? 'internet' : 'xato';
        return holatniYangila().then(function () { return { ok: false, tur: xatoTuri, xato: xatoMatni, kod: xatoKod }; });
      });
    }).then(function (n) { band = null; if (qayta) { qayta = false; return yurgiz('qayta').then(function () { return n; }); } return n; },
      function (e) { band = null; holat.ishlayapti = false; return { ok: false, tur: 'xato', xato: nomaxsus(e), kod: kodOl(e) }; });
    return band;
  }

  function rejalash(kechikish) {
    if (rejaSoati) clearTimeout(rejaSoati);
    rejaSoati = setTimeout(function () { rejaSoati = null; yurgiz('ozgarish'); }, kechikish === undefined ? KECHIKISH_MS : kechikish);
  }

  // Fon tortishi faqat ilova ko'rinib turganda va internet bor paytda: sahifa yashirin bo'lsa vaqt belgisi ham to'xtatiladi (batareya).
  // Foydalanuvchi 3 daqiqadan ko'p tegmasa, tekshiruv 5 daqiqada bir marta (so'rovlar kamayadi).
  function faollik() { oxirgiFaollik = Date.now(); }
  function davrniBoshla() {
    if (davrSoati || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
    davrSoati = setInterval(function () {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      var bosh = Date.now() - oxirgiFaollik > (sozlama.boshVaqt !== undefined ? sozlama.boshVaqt : 180000), oraliq = bosh ? (sozlama.sekinDavr || 300000) : (sozlama.davr || DAVR_MS);
      if (Date.now() - oxirgiBoshlanish >= oraliq - 1000) yurgiz('vaqt');
    }, sozlama.tik || 15000);
  }
  function davrniToxtat() { if (davrSoati) { clearInterval(davrSoati); davrSoati = null; } }

  // Kirgan (yoki kirish qaytgan) paytda: rozilikni akkauntga bog'lab, sinxron tayyor bo'lsa tsikl, bo'lmasa avtomatik birinchi sinxron
  function kirishdan() {
    if (!uid()) return holatniYangila();
    return rozilikniQayd().then(function () { return holatniYangila(); }).then(function (rec) {
      if (tayyorMi(rec, uid())) return yurgiz('kirish');
      if (xatoMatni || avtoBand) return null;   // xato: foydalanuvchi "Qayta urinish" bosadi (har hodisada qaytadan urinilmaydi)
      return avtomatik();
    });
  }

  // Ilova ishga tushganda bir marta chaqiriladi (baza tayyor bo'lgach)
  function boshlash() {
    if (boshlandi) return Promise.resolve();
    boshlandi = true;
    Data.ozgarishKuzat(function () {
      if (!uid()) return;
      holatniYangila().then(function (rec) { if (tayyorMi(rec, uid())) rejalash(); });
    });
    // Kirish hodisalari (token yangilanishi ham hodisa beradi) tsiklni qayta-qayta boshlamasin: faqat kirgan akkaunt O'ZGARGANDA (kirish, chiqish, boshqa akkaunt)
    if (typeof Kirish !== 'undefined') Kirish.kuzat(function () { var id = uid(); if (id === oxirgiKirishId) return; oxirgiKirishId = id; kirishdan(); });
    function yangiTsikl(sabab) { if (Date.now() - oxirgiBoshlanish >= KAMIDA_MS) yurgiz(sabab); }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') { faollik(); davrniBoshla(); yangiTsikl('fokus'); } else davrniToxtat();
      });
      ['pointerdown', 'keydown', 'touchstart'].forEach(function (h) { document.addEventListener(h, faollik, { passive: true, capture: true }); });
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', function () { faollik(); yangiTsikl('fokus'); });
      window.addEventListener('online', function () { xatoMatni = ''; xatoTuri = ''; xatoKod = ''; yozuvOl().then(function (rec) { return tayyorMi(rec, uid()) ? yurgiz('internet') : kirishdan(); }); });
      window.addEventListener('offline', function () { holatniYangila(); });
    }
    davrniBoshla();
    oxirgiKirishId = uid();
    return holatniYangila().then(function (rec) { if (tayyorMi(rec, uid())) return yurgiz('ochildi'); return kirishdan(); });
  }

  // ---------------- Birinchi sinxron ----------------
  function sanash(m) {
    var n = {};
    ['hisoblar', 'kategoriyalar', 'yozuvlar', 'byudjetlar', 'qarzlar'].forEach(function (t) { n[t] = (m[t] || []).filter(function (x) { return x.deleted !== true; }).length; });
    n.tolovlar = (m.qarzlar || []).reduce(function (a, q) { return a + (q.deleted === true ? 0 : (q.tolovlar || []).filter(function (t) { return t.deleted !== true; }).length); }, 0);
    return n;
  }

  // Ikki tomonni solishtiradi (hech narsaga tegmaydi). Natija: { tur: 'bosh-bosh' | 'yuklash' | 'olish' | 'server', mahalliy: {...}, server: {...}, boshqaAkkaunt }
  function tahlil() {
    var c;
    return Promise.all([Data.hammasiniOqish(), yozuvOl()]).then(function (r) {
      var m = r[0], rec = r[1], boshqa = !!(rec && rec.user_id && rec.user_id !== uid());
      c = Yuklash.mijoz();
      return Yuklash.serverSoni(c).then(function (server) {
        var mahalliy = sanash(m), bosh = SinxronSof.mahalliyBoshmi(m), serverJami = Yuklash.jami(server), tur, davom = false;
        if (serverJami === 0) tur = bosh ? 'bosh-bosh' : 'yuklash';
        else tur = bosh ? 'olish' : 'server';   // serverda ma'lumot bor: server yutadi (qurilma bo'sh bo'lsa ham, to'la bo'lsa ham)
        var natija = function (davomi) { return { tur: davomi ? 'yuklash' : tur, davom: !!davomi, mahalliy: mahalliy, server: { hisoblar: server.hisoblar, kategoriyalar: server.kategoriyalar, yozuvlar: server.yozuvlar, byudjetlar: server.byudjetlar, qarzlar: server.qarzlar, tolovlar: server.qarz_tolovlari, jami: serverJami }, boshqaAkkaunt: boshqa }; };
        if (tur !== 'server') return natija(false);
        // Ikkalasida ham bor. Agar serverdagi hamma qator shu qurilmaniki bo'lsa (S4 dagi qo'lda yuklash yoki yarim qolgan yuklash), qurilmadagi hech narsa tashlanmaydi:
        // yuklash shunchaki tugallanadi. Faqat shu qurilmada oldingi yuklash belgisi bo'lsa (Yuklash holati) va hamma server ID si bizda ham bor bo'lsa.
        return Yuklash.holatOl().then(function (yh) {
          if (!yh || !uid() || yh.user_id !== uid()) return natija(false);
          var bizda = {}; ['hisoblar', 'kategoriyalar', 'yozuvlar', 'byudjetlar', 'qarzlar'].forEach(function (t) { (m[t] || []).forEach(function (x) { bizda[t + x.id] = true; if (t === 'qarzlar') (x.tolovlar || []).forEach(function (p) { bizda['qarz_tolovlari' + p.id] = true; }); }); });
          (m.sozlamalar || []).forEach(function (x) { if (x.kalit === 'asosiy') bizda['sozlamalar' + x.id] = true; });
          return J.reduce(function (p, j) {
            return p.then(function (mos) {
              if (!mos || !server[j]) return mos;
              return Yuklash.serverIdlari(c, j).then(function (ids) { return ids.every(function (id) { return bizda[j + id]; }); });
            });
          }, Promise.resolve(true)).then(function (mos) { return natija(mos); });
        });
      });
    }).catch(function (e) { return { tur: 'xato', xato: nomaxsus(e), kod: kodOl(e) }; });
  }

  // Serverdagi HAMMA qatorlar (kursorlar bilan). Natija: { S: {jadval: [qatorlar]}, kursor: {jadval: iso} }
  function hammasiniTort(c, onSahifa) {
    var S = {}, kursor = {};
    return TORTISH_TARTIBI.concat(['sozlamalar']).reduce(function (p, j) {
      return p.then(function () {
        S[j] = []; var indeks = {};
        return jadvalniTort(c, j, null, function (q) {
          q.forEach(function (x) { if (indeks[x.id] === undefined) { indeks[x.id] = S[j].length; S[j].push(x); } else S[j][indeks[x.id]] = x; });   // sahifalar bir-birini qisman qoplashi mumkin: id bo'yicha bitta
          if (onSahifa) onSahifa(j, S[j].length);
        }).then(function (maks) { if (maks) kursor[j] = maks; });
      });
    }, Promise.resolve()).then(function () { return { S: S, kursor: kursor }; });
  }

  function tekshirMalumot(m) {
    var t = Calc.zaxiraniTekshir(JSON.stringify(Calc.zaxiraYasash(m, Data.SXEMA_VERSIYASI, new Date())), Data.SXEMA_VERSIYASI, Calc.hozir());
    return t.xato ? t.xato : null;
  }
  function yangiYozuv(kursor, qo) { return Object.assign({ kalit: Data.SINXRON_KALITI, user_id: uid(), navbat: true, tayyor: true, boshlangan: new Date().toISOString(), kursor: kursor || {}, oxirgi_vaqt: new Date().toISOString(), ziddiyat: 0, rad: [] }, qo || {}); }
  // Birinchi sinxron bir vaqtda faqat bittа. Fon tsikli (fokus, davr) ketayotgan bo'lsa, u tugashini KUTADI (xato bermaydi): "band" xabari
  // faqat haqiqatan boshqa BIRINCHI sinxron ketayotganda chiqadi. Belgi har doim (xato bilan tugasa ham) olib tashlanadi; u faqat xotirada.
  function bandIsh(ish) {
    if (birinchiBand) return Promise.resolve({ ok: false, tur: 'band', kod: 'SYNC_LOCKED', xato: 'Birinchi sinxronlash hozir davom etmoqda. Bir ozdan keyin qayta urinib ko\'ring.' });
    birinchiBand = true; holat.ishlayapti = true; xabarla();
    var avval = band ? band.then(function () {}, function () {}) : Promise.resolve();
    var o = avval.then(ish).then(function (n) { birinchiBand = false; qayta = false; return n; }, function (e) { birinchiBand = false; qayta = false; return { ok: false, tur: 'xato', xato: nomaxsus(e), kod: kodOl(e) }; });
    return o.then(function (n) { holat.ishlayapti = false; return holatniYangila().then(function () { return n; }); });
  }

  // Birinchi sinxronni bajaradi. variant: 'bosh-bosh' | 'yuklash' | 'olish' | 'server' (olish va server bir xil: server yutadi). opts.progress(matn)
  // Natija: { ok: true, ... } yoki { ok: false, tur, xato }. Xatoda mahalliy ma'lumot o'zgarmaydi (almashtirish bitta tranzaksiyada).
  function birinchi(variant, opts) {
    opts = opts || {};
    var progress = opts.progress || function () {};
    return bandIsh(function () {
      var c = Yuklash.mijoz();
      if (variant === 'bosh-bosh') {
        return Data.saqlash('sozlamalar', yangiYozuv({})).then(function () { return { ok: true, variant: variant }; });
      }
      if (variant === 'yuklash') {
        // Yozuvlar navbatga tushsin (navbat = true), tayyor = false: yuklash tugamaguncha avtomatik tsikl ishlamaydi
        return Data.saqlash('sozlamalar', yangiYozuv({}, { tayyor: false })).then(function () {
          return Yuklash.yubor({ foydalanuvchi: uid(), progress: function (a, b, j) { progress('Yuklanmoqda: ' + a + ' / ' + b + (j ? ' (' + Yuklash.NOMLAR[j] + ')' : '')); } });
        }).then(function (n) {
          if (!n.ok) return n;
          return Data.saqlash('sozlamalar', yangiYozuv({}, { kursor: {} })).then(function () { n.variant = variant; return n; });
        });
      }
      if (variant === 'olish' || variant === 'server') {
        progress('Serverdan olinmoqda…');
        return hammasiniTort(c, function (j, n) { progress('Olinmoqda: ' + Yuklash.NOMLAR[j] + ' ' + n); }).then(function (r) {
          return Data.hammasiniOqish().then(function (L) {
            var asosiy = (L.sozlamalar || []).filter(function (x) { return x.kalit === 'asosiy'; })[0];
            var m = SinxronSof.serverdanMalumot(r.S, asosiy), xato = tekshirMalumot(m);
            if (xato) return { ok: false, tur: 'xato', kod: 'DATA_INVALID', xato: 'Serverdagi ma\'lumot tekshiruvdan o\'tmadi: ' + xato + '. Mahalliy ma\'lumotga tegilmadi.' };
            var navbat = null;
            if (!(r.S.sozlamalar || []).length && asosiy) { navbat = { sozlamalar: { asosiy: asosiy.updated_at } }; }   // serverda sozlama qatori yo'q: bizniki yuboriladi
            return Data.almashtirish(m, { navbatsiz: !navbat, navbat: navbat || undefined, yerel: [yangiYozuv(r.kursor)] }).then(function () { return { ok: true, variant: variant, soni: sanash(m) }; });
          });
        });
      }
      return { ok: false, tur: 'xato', kod: 'UNKNOWN_VARIANT', xato: 'Noma\'lum variant' };
    }).then(function (n) {
      if (n.ok && variant !== 'olish' && variant !== 'server') return yurgiz('qolda', { progress: function (a, b) { progress('Yuborilmoqda: ' + a + ' / ' + b); } }).then(function (t) {
        if (t && t.ok === false && t.tur !== 'tayyor-emas') { n.ogohlantirish = t.xato; }
        return n;
      });
      if (n.ok && (variant === 'olish' || variant === 'server')) { tortildiKuzatuvchilar.forEach(function (f) { try { f(1); } catch (e) { /* ahamiyatsiz */ } }); }
      return n;
    });
  }

  // ---------------- Hisobni va serverdagi ma'lumotni o'chirish (S7) ----------------
  // Serverdagi public.hisobni_ochirish() funksiyasini chaqiradi (supabase/003_hisobni_ochirish.sql): kirgan foydalanuvchining hamma qatori
  // HAQIQATAN o'chadi va akkaunti ham o'chadi. Keyin shu qurilmadagi sessiya yopiladi va sinxron holati (navbat, kursor) o'chiriladi.
  // MAHALLIY MA'LUMOT (hisoblar, yozuvlar va h.k.) O'CHMAYDI. Natija: { ok, hisobot, ogohlantirish } yoki { ok: false, tur, xato, kod }.
  function sinxronHolatiniTozala() {
    return [Data.SINXRON_KALITI, Data.NAVBAT_KALITI, 'yuklash', 'rozilik'].reduce(function (p, k) { return p.then(function () { return Data.haqiqiyOchirish('sozlamalar', k); }); }, Promise.resolve())
      .then(function () { tashlash(); holat.soni = 0; holat.tur = 'yoq'; holat.xato = ''; xabarla(); });
  }
  function hisobniOchirish() {
    return bandIsh(function () {
      if (!uid()) return { ok: false, tur: 'kirmagan', kod: 'NOT_SIGNED_IN', xato: 'Avval kiring.' };
      if (typeof navigator !== 'undefined' && navigator.onLine === false && !sozlama.internetniTekshirma) return { ok: false, tur: 'internet', kod: 'NETWORK_OFFLINE', xato: 'Internet yo\'q. Hisobni o\'chirish uchun internetga ulaning (hech narsa o\'chmadi).' };
      var c = Yuklash.mijoz(), hisobot = null;
      return c.rpc('hisobni_ochirish').then(function (res) {
        if (res.error) Yuklash.tashla(res.error, '', res.status);
        hisobot = res.data;
      }, function (e) { Yuklash.tashla(e, ''); }).then(function () {
        // Server tomoni tugadi (qaytarib bo'lmaydi). Endi mahalliy tozalash: har bir qadam alohida, xato bo'lsa ham keyingisi bajariladi
        var ogoh = [];
        var chiq = sozlama.chiqish ? sozlama.chiqish() : (typeof Kirish !== 'undefined' ? Kirish.chiqish() : Promise.resolve());
        return Promise.resolve(chiq).catch(function () { ogoh.push('Chiqishda xato (kod: SIGNOUT_FAILED): ilovadan qo\'lda chiqing.'); })
          .then(function () { return sinxronHolatiniTozala(); }).catch(function () { ogoh.push('Sinxron holatini tozalab bo\'lmadi (kod: LOCAL_CLEANUP_FAILED).'); })
          .then(function () { return { ok: true, hisobot: hisobot, ogohlantirish: ogoh.join(' ') }; });
      });
    });
  }

  // ---------------- Avtomatik birinchi sinxron (S8) ----------------
  // Kirish roziligi (Google tugmasi) bo'lgan akkaunt kirgan zahoti ishlaydi. Ikki tomon solishtiriladi:
  //   ikkalasi bo'sh (tayyor "Naqd pul" va kategoriyalar bo'sh hisoblanadi) -> yoqiladi; qurilmada bor, server bo'sh -> yuklanadi;
  //   qurilma bo'sh, serverda bor -> tortiladi; ikkalasida ham bor -> SERVER YUTADI (qurilmadagi, serverga hali yuborilmagan ma'lumot tashlanadi; hech narsa so'ralmaydi, TZ-sinxronlash.md 20.1).
  // Natija: { ok: true, tur: 'tayyor' | variant } | { ok: false, tur: 'rozilik-yoq' | 'kirmagan' | 'xato' | 'internet' | 'band', xato, kod }
  function avtomatik() {
    var id = uid();
    if (!id) return Promise.resolve({ ok: false, tur: 'kirmagan' });
    if (avtoBand || birinchiBand) return Promise.resolve({ ok: false, tur: 'band', kod: 'SYNC_LOCKED', xato: 'Sinxronlash hozir davom etmoqda.' });
    avtoBand = true;
    function tugat(n) { avtoBand = false; holat.jarayon = ''; return holatniYangila().then(function () { return n; }); }
    return Promise.all([yozuvOl(), rozilikOl()]).then(function (r) {
      var rec = r[0], roz = r[1];
      if (tayyorMi(rec, id)) return tugat({ ok: true, tur: 'tayyor' });
      if (!roz || roz.user_id !== id) return tugat({ ok: false, tur: 'rozilik-yoq' });
      if (typeof navigator !== 'undefined' && navigator.onLine === false && !sozlama.internetniTekshirma) {
        xatoTuri = 'internet'; xatoKod = 'NETWORK_OFFLINE'; xatoMatni = 'Internet yo\'q. Internet qaytganda sinxronlash o\'zi boshlanadi.';
        return tugat({ ok: false, tur: 'internet', kod: xatoKod, xato: xatoMatni });
      }
      xatoMatni = ''; xatoTuri = ''; xatoKod = '';
      holat.jarayon = 'Server bilan solishtirilmoqda…'; holatniYangila();
      return tahlil().then(function (t) {
        if (t.tur === 'xato') { xatoMatni = t.xato; xatoKod = t.kod || 'UNKNOWN'; xatoTuri = internetXatomi(t.xato) ? 'internet' : 'xato'; return tugat({ ok: false, tur: xatoTuri, xato: t.xato, kod: xatoKod }); }
        avtoBand = false;   // birinchi() o'z qulfini oladi
        return birinchi(t.tur, { progress: function (m) { holat.jarayon = m; xabarla(); } }).then(function (n) {
          if (!n.ok) {
            if (n.tur === 'bor') return avtomatik();   // yuklash paytida serverda ma'lumot paydo bo'ldi: qayta solishtiriladi
            xatoMatni = n.xato; xatoKod = n.kod || n.tur; xatoTuri = internetXatomi(n.xato) ? 'internet' : 'xato';
          }
          holat.jarayon = ''; if (n.ok) n = Object.assign({ tur: n.variant }, n);
          return holatniYangila().then(function () { return n; });
        });
      });
    }).catch(function (e) { xatoMatni = nomaxsus(e); xatoKod = kodOl(e); xatoTuri = internetXatomi(xatoMatni) ? 'internet' : 'xato'; return tugat({ ok: false, tur: xatoTuri, xato: xatoMatni, kod: xatoKod }); });
  }

  // "Qayta urinish": birinchi sinxron tugamagan bo'lsa — uni qayta boshlaydi, aks holda oddiy tsikl
  function qayta_urinish() {
    xatoMatni = ''; xatoTuri = ''; xatoKod = '';
    return yozuvOl().then(function (rec) { return tayyorMi(rec, uid()) ? yurgiz('qolda') : avtomatik(); });
  }

  return {
    sozla: sozla, kuzat: kuzat, tortildiKuzat: tortildiKuzat, boshlash: boshlash, holat: function () { return holat; }, holatniYangila: holatniYangila,
    rozilikBelgisiniQoy: rozilikBelgisiniQoy, rozilikniQayd: rozilikniQayd, rozilikBer: rozilikBer, avtomatik: avtomatik, davrniBoshla: davrniBoshla, davrniToxtat: davrniToxtat,
    hisobniOchirish: hisobniOchirish, yurgiz: yurgiz, qaytaUrinish: qayta_urinish, tahlil: tahlil, birinchi: birinchi, tashlash: tashlash, band: function () { return !!band || birinchiBand || avtoBand; },
    kutayotgan: function () { return holat.soni; }, sanash: sanash, OVERLAP_MS: OVERLAP_MS
  };
})();
