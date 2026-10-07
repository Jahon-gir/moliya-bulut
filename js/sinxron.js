// Ikki tomonlama sinxronlash (TZ-sinxronlash.md, S5): o'zgarishlarni serverga avtomatik yuborish (navbat), serverdagi o'zgarishlarni tortib olish,
// birinchi sinxron (yuklash / olish / tanlov), holat ko'rsatkichi. Kirmagan foydalanuvchi uchun UMUMAN ishlamaydi.
// Mahalliy baza asosiy: ilova avvalgidek hamma narsani undan o'qiydi; server — nusxa va qurilmalar o'rtasidagi ko'prik.
// Sof (bazasiz, tarmoqsiz) qoidalar js/sinxron-sof.js da; serverga yuborish va xato matnlari js/yuklash.js da (S4); bazaga yozish js/data.js da.
// Faqat ochiq (publishable) kalit ishlatiladi; user_id, created_at, updated_at ni ilova yubormaydi (serverdagi trigger qo'yadi).
var Sinxron = (function () {
  'use strict';

  var J = SinxronSof.JADVALLAR;
  var OVERLAP_MS = 5000;        // tortishda oxirgi kursordan shuncha orqaga qaytiladi (parallel yozuvlar tartibi buzilsa ham qator o'tib ketmasin; qayta qo'llash zararsiz)
  var SAHIFA = 1000;            // serverdan bir so'rovda ko'pi bilan shuncha qator (PostgREST chegarasi)
  var YUBOR_BOLAK = 300;        // bir so'rovda yuboriladigan qatorlar
  var OCHIRISH_BOLAK = 100;     // "id in (...)" ro'yxati uzun bo'lib ketmasin
  var KECHIKISH_MS = 2500;      // o'zgarishdan keyin yuborishni shuncha kutish (ketma-ket o'zgarishlar bitta so'rovga yig'iladi)
  var DAVR_MS = 60000;          // ilova ochiq turganda tortish davri
  var KAMIDA_MS = 8000;         // fokus/internet hodisalarida ketma-ket tsikllar orasidagi eng kam masofa
  var sozlama = {};

  var holat = { tur: 'boshlanmagan', soni: 0, oxirgi: null, xato: '', ziddiyat: 0, rad: [], ishlayapti: false, yangilandi: 0 };
  var kuzatuvchilar = [], tortildiKuzatuvchilar = [];
  var yaqinda = {}, oldingiYaqinda = {};       // oxirgi tsikllarda o'zimiz yuborgan qator id lari ("aks-sado" to'qnashuv emas)
  var band = null, birinchiBand = false, qayta = false, xatoKod = '', rejaSoati = null, davrSoati = null, boshlandi = false, oxirgiBoshlanish = 0, xatoMatni = '', xatoTuri = '';

  function sozla(s) { sozlama = s || {}; }
  function uid() { return sozlama.foydalanuvchi ? sozlama.foydalanuvchi() : (typeof Kirish !== 'undefined' && Kirish.holat().kirgan ? Kirish.holat().id : ''); }
  function xabarla() { kuzatuvchilar.slice().forEach(function (f) { try { f(holat); } catch (e) { /* ahamiyatsiz */ } }); }
  function kuzat(f) { kuzatuvchilar.push(f); return function () { kuzatuvchilar = kuzatuvchilar.filter(function (x) { return x !== f; }); }; }
  function tortildiKuzat(f) { tortildiKuzatuvchilar.push(f); }
  function tashlash() { yaqinda = {}; oldingiYaqinda = {}; xatoMatni = ''; xatoTuri = ''; holat.rad = []; holat.ziddiyat = 0; holat.oxirgi = null; }   // sinovlarda qurilma almashganda

  // ---------------- Holat ----------------
  function yozuvOl() { return Data.olish('sozlamalar', Data.SINXRON_KALITI); }
  function yozuvYoz(r) { return Data.saqlash('sozlamalar', Object.assign({ kalit: Data.SINXRON_KALITI }, r)); }

  // Holatni bazadan hisoblaydi va ko'rsatkichni yangilaydi. Natija: sinxron yozuvi (yoki null)
  function holatniYangila() {
    return Promise.all([yozuvOl(), Data.navbatniOl()]).then(function (r) {
      var rec = r[0] || null, soni = SinxronSof.navbatSoni(r[1]), id = uid();
      holat.soni = soni;
      holat.oxirgi = rec && rec.oxirgi_vaqt ? rec.oxirgi_vaqt : null;
      holat.rad = rec && rec.rad ? rec.rad : [];
      holat.ziddiyat = rec && rec.ziddiyat ? rec.ziddiyat : 0;
      holat.xato = xatoMatni; holat.kod = xatoKod;
      if (!id) holat.tur = 'yoq';
      else if (rec && rec.user_id && rec.user_id !== id) holat.tur = 'boshqa-akkaunt';
      else if (!rec || !rec.tayyor) holat.tur = 'boshlanmagan';
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

  function tort(c, rec) {
    var jami = { yozildi: 0, ziddiyat: 0 }, kursor = Object.assign({}, rec.kursor || {}), ozgardi = false;
    var ctxYaqinda = Object.assign({}, oldingiYaqinda, yaqinda);
    return TORTISH_TARTIBI.reduce(function (p, j) {
      return p.then(function () {
        return jadvalniTort(c, j, kursor[j], function (qatorlar) {
          return Data.tortilganlarniYozish(j, qatorlar, ctxYaqinda).then(function (h) { jami.yozildi += h.yozildi; jami.ziddiyat += h.ziddiyat; });
        }).then(function (maks) { if (maks && maks !== kursor[j]) { kursor[j] = maks; ozgardi = true; } });
      });
    }, Promise.resolve()).then(function () {
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

  function yubor(c, progress) {
    var natija = { yuborildi: 0, rad: [] }, navbat, ruyxat, qarzUchun = {}, radNavbat = [];
    return Data.navbatniOl().then(function (n) {
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
          natija.rad.push({ jadval: j, id: x.qator.id, sabab: b.sabab });
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
      return J.reduce(function (p, j) {
        return p.then(function () {
          return bolaklash(ruyxat[j], YUBOR_BOLAK).reduce(function (q, bolak) {
            return q.then(function () {
              return c.from(j).upsert(bolak.map(function (x) { return x.qator; }), { onConflict: 'id' }).then(function (res) {
                if (res.error) Yuklash.tashla(res.error, j, res.status);
                bajarildi += bolak.length; natija.yuborildi += bolak.length;
                bolak.forEach(function (x) { yaqinda[x.qator.id] = true; });
                if (progress) progress(bajarildi, jamiSoni, j);
                if (j === 'qarzlar' || j === 'qarz_tolovlari') { bolak.forEach(function (x) { qarzUchun[x.kalit] = x.qiymat; }); return; }   // qarz navbatdan to'lovlari bilan birga olinadi
                var y = {}; y[j] = {}; bolak.forEach(function (x) { y[j][x.kalit] = x.qiymat; });
                return Data.navbatdanOlish(y);
              }, function (e) { Yuklash.tashla(e, j); });
            });
          }, Promise.resolve());
        });
      }, Promise.resolve());
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
        xatoTuri = 'internet'; xatoMatni = 'Internet yo\'q. O\'zgarishlar saqlanadi va internet qaytganda avtomatik yuboriladi.';
        return holatniYangila().then(function () { return { ok: false, tur: 'internet-yoq' }; });
      }
      oxirgiBoshlanish = Date.now();
      holat.ishlayapti = true; xabarla();
      var c, tortilgan = 0;
      return Promise.resolve().then(function () { c = Yuklash.mijoz(); return tort(c, rec); }).then(function (t) {
        tortilgan = t.yozildi;
        return yubor(c, opts.progress);
      }).then(function (y) {
        oldingiYaqinda = yaqinda; yaqinda = {};
        xatoMatni = ''; xatoTuri = ''; xatoKod = '';
        return yozuvOl().then(function (yangi) {
          yangi = Object.assign({}, yangi || rec, { oxirgi_vaqt: new Date().toISOString() });
          if (y.rad.length) yangi.rad = (yangi.rad || []).concat(y.rad).slice(-20);
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

  // Ilova ishga tushganda bir marta chaqiriladi (baza tayyor bo'lgach)
  function boshlash() {
    if (boshlandi) return Promise.resolve();
    boshlandi = true;
    Data.ozgarishKuzat(function () {
      if (!uid()) return;
      holatniYangila().then(function (rec) { if (tayyorMi(rec, uid())) rejalash(); });
    });
    if (typeof Kirish !== 'undefined') Kirish.kuzat(function () { holatniYangila().then(function (rec) { if (tayyorMi(rec, uid())) yurgiz('kirish'); }); });
    function yangiTsikl(sabab) { if (Date.now() - oxirgiBoshlanish >= KAMIDA_MS) yurgiz(sabab); }
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') yangiTsikl('fokus'); });
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', function () { yangiTsikl('fokus'); });
      window.addEventListener('online', function () { xatoMatni = ''; xatoTuri = ''; yurgiz('internet'); });
      window.addEventListener('offline', function () { holatniYangila(); });
    }
    davrSoati = setInterval(function () { if (typeof document === 'undefined' || document.visibilityState === 'visible') yangiTsikl('vaqt'); }, sozlama.davr || DAVR_MS);
    return holatniYangila().then(function (rec) { if (tayyorMi(rec, uid())) return yurgiz('ochildi'); });
  }

  // ---------------- Birinchi sinxron ----------------
  function sanash(m) {
    var n = {};
    ['hisoblar', 'kategoriyalar', 'yozuvlar', 'byudjetlar', 'qarzlar'].forEach(function (t) { n[t] = (m[t] || []).filter(function (x) { return x.deleted !== true; }).length; });
    n.tolovlar = (m.qarzlar || []).reduce(function (a, q) { return a + (q.deleted === true ? 0 : (q.tolovlar || []).filter(function (t) { return t.deleted !== true; }).length); }, 0);
    return n;
  }

  // Ikki tomonni solishtiradi (hech narsaga tegmaydi). Natija: { tur: 'bosh-bosh' | 'yuklash' | 'olish' | 'tanlov', mahalliy: {...}, server: {...}, boshqaAkkaunt }
  function tahlil() {
    var c;
    return Promise.all([Data.hammasiniOqish(), yozuvOl()]).then(function (r) {
      var m = r[0], rec = r[1], boshqa = !!(rec && rec.user_id && rec.user_id !== uid());
      c = Yuklash.mijoz();
      return Yuklash.serverSoni(c).then(function (server) {
        var mahalliy = sanash(m), bosh = SinxronSof.mahalliyBoshmi(m), serverJami = Yuklash.jami(server), tur, davom = false;
        if (serverJami === 0) tur = bosh ? 'bosh-bosh' : 'yuklash';
        else tur = bosh ? 'olish' : 'tanlov';
        var natija = function (davomi) { return { tur: davomi ? 'yuklash' : tur, davom: !!davomi, mahalliy: mahalliy, server: { hisoblar: server.hisoblar, kategoriyalar: server.kategoriyalar, yozuvlar: server.yozuvlar, byudjetlar: server.byudjetlar, qarzlar: server.qarzlar, tolovlar: server.qarz_tolovlari, jami: serverJami }, boshqaAkkaunt: boshqa }; };
        if (tur !== 'tanlov') return natija(false);
        // Ikkalasida ham bor. Agar serverdagi hamma qator shu qurilmaniki bo'lsa (S4 dagi qo'lda yuklash yoki yarim qolgan yuklash), bu "tanlov" emas:
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

  // Birinchi sinxronni bajaradi. variant: 'bosh-bosh' | 'yuklash' | 'olish' | 'birlashtirish' | 'server' | 'mahalliy'. opts.progress(matn)
  // Natija: { ok: true, ... } yoki { ok: false, tur, xato }. Xatoda mahalliy ma'lumot o'zgarmaydi (almashtirish bitta tranzaksiyada).
  function birinchi(variant, opts) {
    opts = opts || {};
    var progress = opts.progress || function () {};
    var zaxiraQilindi = false;
    // Zaxira fayli bir urinishda BIR marta va faqat ishonchli davom etadigan bo'lsa (qulf olingan, server javob bergan va tekshiruvdan o'tgan) yuklab beriladi.
    // Zaxira olinmasa, hech narsa o'zgarmaydi.
    function zaxiraQil() {
      if (zaxiraQilindi || !opts.zaxira) return Promise.resolve();
      zaxiraQilindi = true;
      return Promise.resolve().then(opts.zaxira).catch(function (e) { var x = new Error('Zaxira faylini saqlab bo\'lmadi: ' + (e && e.message ? e.message : e) + '. Hech narsa o\'zgarmadi.'); x.server = true; x.kod = 'BACKUP_FAILED'; throw x; });
    }
    return bandIsh(function () {
      var c = Yuklash.mijoz();
      if (variant === 'bosh-bosh') {
        return Data.saqlash('sozlamalar', yangiYozuv({})).then(function () { return { ok: true, variant: variant }; });
      }
      if (variant === 'yuklash') {
        // Yozuvlar navbatga tushsin (navbat = true), tayyor = false: yuklash tugamaguncha avtomatik tsikl ishlamaydi
        return zaxiraQil().then(function () { return Data.saqlash('sozlamalar', yangiYozuv({}, { tayyor: false })); }).then(function () {
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
            return zaxiraQil().then(function () { return Data.almashtirish(m, { navbatsiz: !navbat, navbat: navbat || undefined, yerel: [yangiYozuv(r.kursor)] }); }).then(function () { return { ok: true, variant: variant, soni: sanash(m) }; });
          });
        });
      }
      if (variant === 'birlashtirish') {
        progress('Serverdan olinmoqda…');
        return hammasiniTort(c, function (j, n) { progress('Olinmoqda: ' + Yuklash.NOMLAR[j] + ' ' + n); }).then(function (r) {
          return Data.hammasiniOqish().then(function (L) {
            var asosiy = (L.sozlamalar || []).filter(function (x) { return x.kalit === 'asosiy'; })[0];
            var S = SinxronSof.serverdanMalumot(r.S, asosiy), b = SinxronSof.birlashtirish(L, S), xato = tekshirMalumot(b.malumot);
            if (xato) return { ok: false, tur: 'xato', kod: 'DATA_INVALID', xato: 'Birlashtirilgan ma\'lumot tekshiruvdan o\'tmadi: ' + xato + '. Mahalliy ma\'lumotga tegilmadi.' };
            return zaxiraQil().then(function () { return Data.almashtirish(b.malumot, { navbat: b.navbat, yerel: [yangiYozuv(r.kursor)] }); }).then(function () { return { ok: true, variant: variant, hisobot: b.hisobot, soni: sanash(b.malumot) }; });
          });
        });
      }
      if (variant === 'mahalliy') {
        progress('Server tekshirilmoqda…');
        return Promise.all([Data.hammasiniOqish(), hammasiniTort(c)]).then(function (x) {
          var L = x[0], r = x[1], local = {}, tomb = {}, soni = 0;
          J.forEach(function (j) { local[j] = {}; });
          ['hisoblar', 'kategoriyalar', 'yozuvlar', 'byudjetlar', 'qarzlar'].forEach(function (t) { (L[t] || []).forEach(function (q) { local[t][q.id] = true; if (t === 'qarzlar') (q.tolovlar || []).forEach(function (p) { local.qarz_tolovlari[p.id] = true; }); }); });
          J.forEach(function (j) {
            if (j === 'sozlamalar') return;
            var ids = (r.S[j] || []).filter(function (s) { return s.deleted !== true && !local[j][s.id]; }).map(function (s) { return s.id; });
            if (ids.length) tomb[j] = ids;
          });
          var asosiyId = (r.S.sozlamalar || [])[0] ? r.S.sozlamalar[0].id : null;
          // Serverda bor, lekin shu qurilmada yo'q qatorlar o'chirilgan deb belgilanadi (qator saqlanadi: tomb). Qarz to'lovlari ham.
          var tartib = ['yozuvlar', 'byudjetlar', 'qarz_tolovlari', 'qarzlar', 'kategoriyalar', 'hisoblar'].filter(function (j) { return tomb[j]; });
          return zaxiraQil().then(function () { return tartib.reduce(function (p, j) {
            return p.then(function () {
              return bolaklash(tomb[j], OCHIRISH_BOLAK).reduce(function (q, ids) {
                return q.then(function () { return c.from(j).update({ deleted: true }).in('id', ids).then(function (res) { if (res.error) Yuklash.tashla(res.error, j, res.status); soni += ids.length; progress('Serverdagi ortiqcha qatorlar o\'chirilmoqda: ' + soni); }, function (e) { Yuklash.tashla(e, j); }); });
              }, Promise.resolve());
            });
          }, Promise.resolve()).then(function () { return Data.hammasiniNavbatga(yangiYozuv({}, { navbat: true }), asosiyId); }).then(function () { return { ok: true, variant: variant, ochirilgan: soni }; }); });
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

  function qayta_urinish() { xatoMatni = ''; xatoTuri = ''; return yurgiz('qolda'); }

  return {
    sozla: sozla, kuzat: kuzat, tortildiKuzat: tortildiKuzat, boshlash: boshlash, holat: function () { return holat; }, holatniYangila: holatniYangila,
    yurgiz: yurgiz, qaytaUrinish: qayta_urinish, tahlil: tahlil, birinchi: birinchi, tashlash: tashlash, band: function () { return !!band; },
    kutayotgan: function () { return holat.soni; }, sanash: sanash, OVERLAP_MS: OVERLAP_MS
  };
})();
