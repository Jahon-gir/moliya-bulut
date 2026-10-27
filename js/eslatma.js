// Eslatmalar (TZ-sinxronlash.md 46-band): sozlamalar ekrani, qurilmani serverga Web Push obunasi sifatida ulash va "Sinab ko'rish".
// Eslatmalarni VAQTIDA yuborish (kunlik, qarz muddati) bu qismda YO'Q — keyingi bosqich.
// Sozlama qurilmada (localStorage, "moliya-" kaliti) turadi; server qatori (bildirishnoma_qurilmalari) to'g'ridan-to'g'ri PostgREST orqali yoziladi
// (Yuklash.mijoz(): Kirish.tokenOl() bilan). Edge Function "bildirishnoma" faqat ochiq VAPID kaliti va "Sinab ko'rish" uchun.
// Bu modul IndexedDB ga TEGMAYDI (ilova ma'lumotlar sxemasi o'zgarmaydi); ma'lumot bazasi, zaxira va sinxron navbatiga kirmaydi.
var Eslatma = (function () {
  'use strict';

  var S = EslatmaSof;
  var FUNKSIYA_YOLI = '/functions/v1/bildirishnoma';
  var JADVAL = 'bildirishnoma_qurilmalari';
  var KECHIKISH_MS = 600;           // sozlama o'zgargach serverga yozishdan oldin kutish (debounce)
  var TAYYOR_KUTISH_MS = 8000;      // serviceWorker.ready shuncha kutiladi (ro'yxatdan o'tmagan bo'lsa abadiy kutmaslik uchun)
  var CHIQISH_KUTISH_MS = 4000;     // chiqishda serverdan o'chirish uchun ko'pi bilan shuncha kutiladi (chiqishni to'xtatmaydi)

  // Tashqi bog'liqliklar (tests.html da almashtiriladi)
  var dep = {
    xotira: function () { try { return localStorage; } catch (e) { return null; } },
    kirgan: function () { return !!Kirish.holat().kirgan; },
    foydalanuvchiId: function () { return Kirish.holat().id || ''; },
    mijoz: function () { return Yuklash.mijoz(); },
    fetch: function (u, i) { return window.fetch(u, i); },
    tokenOl: function () { return Kirish.tokenOl(); },
    tokenYangila: function () { return Kirish.tokenYangila(); },
    manzil: function () { return Kirish.SUPABASE_MANZIL; },
    kalit: function () { return Kirish.OCHIQ_KALIT; },
    notification: function () { return typeof Notification !== 'undefined' ? Notification : null; },
    pushManagerBor: function () { return typeof window !== 'undefined' && 'PushManager' in window; },
    serviceWorker: function () { return typeof navigator !== 'undefined' && navigator.serviceWorker ? navigator.serviceWorker : null; },
    ios: function () { return S.iosmi(navigator.userAgent, navigator.platform, navigator.maxTouchPoints); },
    ornatilgan: function () {
      var d = false;
      try { d = !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches); } catch (e) { d = false; }
      return S.ornatilganmi(d, navigator.standalone === true);
    },
    tz: function () { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return ''; } }
  };
  function sozla(o) { Object.keys(o || {}).forEach(function (k) { dep[k] = o[k]; }); }

  // ---------------- Sozlama (qurilmada) ----------------
  function sozlama() {
    var x = dep.xotira();
    var s;
    try { s = S.sozlamaOqi(x ? x.getItem(S.SAQLASH_KALITI) : null); } catch (e) { s = S.sozlamaOqi(null); }
    return s;
  }
  function sozlamaYoz(s) { try { var x = dep.xotira(); if (x) x.setItem(S.SAQLASH_KALITI, S.sozlamaYoz(s)); } catch (e) { /* xotira ishlamasa ham ilova ishlayveradi */ } }
  function qolganlar() { try { var x = dep.xotira(), j = JSON.parse((x && x.getItem(S.QOLGAN_KALIT)) || '[]'); return Array.isArray(j) ? j.filter(function (e) { return typeof e === 'string'; }).slice(0, 20) : []; } catch (e) { return []; } }
  function qolganlarniYoz(a) { try { var x = dep.xotira(); if (x) { if (a.length) x.setItem(S.QOLGAN_KALIT, JSON.stringify(a.slice(0, 20))); else x.removeItem(S.QOLGAN_KALIT); } } catch (e) { /* ahamiyatsiz */ } }
  function qolganQosh(ep) { var a = qolganlar(); if (a.indexOf(ep) < 0) a.push(ep); qolganlarniYoz(a); }
  function qolganOlibTashla(ep) { qolganlarniYoz(qolganlar().filter(function (e) { return e !== ep; })); }

  // ---------------- Holat va kuzatuvchilar ----------------
  var oldingiKirgan = null;
  var band = false, sinovBand = false, xato = null, natija = '', kuzatuvchilar = [], kalitKesh = '', timer = null;
  function xabarla() { kuzatuvchilar.slice().forEach(function (f) { try { f(); } catch (e) { /* ahamiyatsiz */ } }); }
  function kuzat(f) { kuzatuvchilar.push(f); return function () { kuzatuvchilar = kuzatuvchilar.filter(function (x) { return x !== f; }); }; }
  function xatoQoy(e, boshlangich) {
    var kod = S.xatoKodi(e, boshlangich);
    xato = { matn: S.xatoMatni(kod), kod: kod + (e && typeof e.debug === 'string' && e.debug ? ', ' + e.debug : '') };
    natija = '';
    xabarla();
  }
  function xatoYasa(kod, debug) { var e = new Error(kod); e.kod = kod; if (debug) e.debug = debug; return e; }

  function muhit() {
    var N = dep.notification();
    return { kirgan: dep.kirgan(), notification: !!N, pushManager: dep.pushManagerBor(), serviceWorker: !!dep.serviceWorker(), ios: dep.ios(), ornatilgan: dep.ornatilgan(), ruxsat: N ? N.permission : 'default' };
  }
  function holat() { return { ekran: S.ekranHolati(muhit()), sozlama: sozlama(), band: band, sinovBand: sinovBand, xato: xato, natija: natija }; }
  // Menyudagi qator izohi
  function menyuIzohi() { return S.obunaKerakmi(sozlama()) ? 'yoqiq' : 'o\'chiq'; }

  // ---------------- Brauzer: service worker va obuna ----------------
  function kut(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
  function registratsiya() {
    var sw = dep.serviceWorker();
    if (!sw || !sw.ready) return Promise.reject(xatoYasa('PUSH_OBUNA'));
    return Promise.race([
      Promise.resolve(sw.ready),
      kut(TAYYOR_KUTISH_MS).then(function () { throw xatoYasa('PUSH_OBUNA'); })
    ]);
  }
  function joriyObuna() {
    return registratsiya().then(function (reg) { return reg.pushManager.getSubscription(); });
  }
  // Obunani oladi yoki yaratadi (kalit boshqa bo'lsa, eski obuna bekor qilinib yangisi yaratiladi)
  function obunaYasash(kalit) {
    var bayt = S.base64urlBayt(kalit);
    if (!bayt || bayt.length !== 65) return Promise.reject(xatoYasa('PUSH_SERVER'));
    return registratsiya().then(function (reg) {
      return reg.pushManager.getSubscription().then(function (sub) {
        var eski = sub && sub.options && sub.options.applicationServerKey ? new Uint8Array(sub.options.applicationServerKey) : null;
        if (sub && eski && !S.baytlarTengmi(eski, bayt)) return sub.unsubscribe().then(function () { return null; });
        return sub;
      }).then(function (sub) {
        return sub || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bayt });
      });
    }).catch(function (e) { throw e && e.kod ? e : xatoYasa('PUSH_OBUNA'); });
  }

  // ---------------- Server: Edge Function (kalit, sinov) ----------------
  function funksiyaSorovi(tana, qayta) {
    return Promise.resolve().then(function () { return qayta ? dep.tokenYangila() : dep.tokenOl(); }).then(function (t) {
      if (!t) throw xatoYasa('NOT_SIGNED_IN');
      return dep.fetch(dep.manzil() + FUNKSIYA_YOLI, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: dep.kalit(), Authorization: 'Bearer ' + t },
        body: JSON.stringify(tana)
      }).then(function (r) {
        return r.json().then(function (j) { return { holat: r.status, ok: r.ok, j: j }; }, function () { return { holat: r.status, ok: r.ok, j: null }; });
      }, function () { throw xatoYasa('NETWORK'); });
    }, function (e) { throw e && e.kod ? e : xatoYasa('NETWORK'); }).then(function (r) {
      if (r.holat === 401 && !qayta) return funksiyaSorovi(tana, true);
      if (r.ok && r.j && r.j.ok === true) return r.j;
      var x = r.j && r.j.xato;
      var kod = x && typeof x.kod === 'string' ? x.kod : (r.holat === 401 ? 'NOT_SIGNED_IN' : 'PUSH_SERVER');
      throw xatoYasa(kod, x && typeof x.debug === 'string' ? x.debug : '');
    });
  }
  function kalitOl() {
    if (kalitKesh) return Promise.resolve(kalitKesh);
    return funksiyaSorovi({ amal: 'kalit' }).then(function (j) {
      var b = S.base64urlBayt(j.kalit);
      if (!b || b.length !== 65) throw xatoYasa('PUSH_SERVER');
      kalitKesh = j.kalit;
      return kalitKesh;
    });
  }

  // ---------------- Server: jadval (PostgREST, foydalanuvchi tokeni bilan) ----------------
  function jadvalXatosi(e, status) {
    if (e && e.kod) return e;
    var x = new Error(String((e && e.message) || 'jadval'));
    x.kod = status === 401 || (e && e.code === 'PGRST301') ? 'NOT_SIGNED_IN' : S.xatoKodi(e || { status: status }, 'PUSH_SERVER');
    return x;
  }
  function serverYoz(s, sub) {
    var q = S.serverQatori(s, sub && sub.toJSON ? sub.toJSON() : sub, dep.tz());
    if (!q) return Promise.reject(xatoYasa('PUSH_OBUNA'));
    return Promise.resolve().then(function () {
      return dep.mijoz().from(JADVAL).upsert(q, { onConflict: 'user_id,endpoint' });
    }).then(function (r) { if (r && r.error) throw jadvalXatosi(r.error, r.status); }, function (e) { throw jadvalXatosi(e); });
  }
  function serverdanOchir(endpoint) {
    return Promise.resolve().then(function () {
      return dep.mijoz().from(JADVAL).delete().eq('endpoint', endpoint);
    }).then(function (r) { if (r && r.error) throw jadvalXatosi(r.error, r.status); }, function (e) { throw jadvalXatosi(e); });
  }

  // ---------------- Amallar ----------------
  function ishla(f) {
    band = true; xato = null; natija = ''; xabarla();
    return Promise.resolve().then(f).then(function (n) { band = false; xabarla(); return n; }, function (e) { band = false; xatoQoy(e); return { ok: false }; });
  }

  // Yoqish (foydalanuvchi toggle'ni bosganda; ruxsat so'rovi shu bosish ichida SINXRON chaqiriladi — iPhone talabi).
  // yamoq: masalan { kunlikYoqiq: true }. Muvaffaqiyatsiz bo'lsa sozlama O'ZGARMAYDI (toggle yoqilmaydi).
  function yoq(yamoq) {
    if (band) return Promise.resolve({ ok: false });
    if (!dep.kirgan()) { xatoQoy(xatoYasa('NOT_SIGNED_IN')); return Promise.resolve({ ok: false }); }
    var N = dep.notification();
    var ruxsat;
    try { ruxsat = !N ? Promise.resolve('denied') : N.permission === 'granted' ? Promise.resolve('granted') : Promise.resolve(N.requestPermission()); } catch (e) { ruxsat = Promise.resolve('denied'); }
    ruxsat = ruxsat.then(function (r) { return r; }, function () { return 'denied'; });
    band = true; xato = null; natija = ''; xabarla();
    var oldin = sozlama();
    return ruxsat.then(function (r) {
      if (r !== 'granted') throw xatoYasa('PUSH_RUXSAT');
      return kalitOl();
    }).then(obunaYasash).then(function (sub) {
      var yangi = Object.assign({}, oldin, yamoq, { egasi: dep.foydalanuvchiId(), serverda: true });
      return serverYoz(yangi, sub).then(function () { sozlamaYoz(yangi); return { ok: true }; }, function (e) {
        // Server yozmadi: boshqa eslatma yoqiq bo'lmasa, tayyor turgan obunani qaytarib olamiz (serverda qatori yo'q obuna bo'lmasin)
        if (!S.obunaKerakmi(oldin)) return sub.unsubscribe().then(function () { throw e; }, function () { throw e; });
        throw e;
      });
    }).then(function (n) { band = false; xabarla(); return n; }, function (e) { band = false; xatoQoy(e, 'PUSH_OBUNA'); return { ok: false }; });
  }

  // O'zgartirish (o'chirish, vaqt, chip, "ism va summa"): qurilmada darhol saqlanadi, serverga 600 ms dan keyin yoziladi
  function ozgartir(yamoq) {
    var s = Object.assign(sozlama(), yamoq, { egasi: dep.foydalanuvchiId(), serverda: false });
    sozlamaYoz(s);
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () { timer = null; yubor(); }, KECHIKISH_MS);
    xabarla();
  }

  // Serverdagi qatorni joriy sozlamaga moslash (ikkala asosiy toggle o'chiq bo'lsa — obuna ham o'chiriladi)
  function yubor() {
    if (timer) { clearTimeout(timer); timer = null; }
    var s = sozlama();
    if (s.serverda && S.obunaKerakmi(s)) return Promise.resolve({ ok: true });
    if (!dep.kirgan()) return Promise.resolve({ ok: false });
    return ishla(function () {
      if (!S.obunaKerakmi(s)) {
        return obunaniOchir(true).then(function (e) {
          var t = sozlama(); t.serverda = true; sozlamaYoz(t);
          if (e) throw e;
          return { ok: true };
        });
      }
      return joriyObuna().then(function (sub) { return sub || kalitOl().then(obunaYasash); }).then(function (sub) {
        return serverYoz(s, sub);
      }).then(function () { var t = sozlama(); t.serverda = true; sozlamaYoz(t); return { ok: true }; });
    });
  }

  // Obunani bekor qiladi: serverdagi qator (serverdan=true bo'lsa) va brauzer obunasi. Server xatosi bo'lsa shu xato QAYTADI (tashlanmaydi),
  // brauzer obunasi baribir bekor qilinadi, manzil keyingi kirishda tozalash uchun eslab qolinadi.
  function obunaniOchir(serverdan) {
    return joriyObuna().catch(function () { return null; }).then(function (sub) {
      if (!sub) return null;
      var ep = sub.endpoint, savdo = Promise.resolve(null);
      if (serverdan) {
        qolganQosh(ep);
        savdo = serverdanOchir(ep).then(function () { qolganOlibTashla(ep); return null; }, function (e) { return e; });
      }
      return savdo.then(function (e) { return sub.unsubscribe().then(function () { return e; }, function () { return e; }); });
    });
  }

  // "Sinab ko'rish": avval kutilayotgan o'zgarish serverga yoziladi, keyin funksiya shu qurilmaga test bildirishnoma yuboradi
  function sinov() {
    if (band) return Promise.resolve({ ok: false });
    if (!dep.kirgan()) { xatoQoy(xatoYasa('NOT_SIGNED_IN')); return Promise.resolve({ ok: false }); }
    if (!S.obunaKerakmi(sozlama())) { xato = { matn: 'Avval kunlik yoki qarz eslatmasini yoqing.', kod: '' }; natija = ''; xabarla(); return Promise.resolve({ ok: false }); }
    if (timer) { clearTimeout(timer); timer = null; }
    band = true; sinovBand = true; xato = null; natija = ''; xabarla();
    var s = sozlama(), eskirgan = false;
    return joriyObuna().then(function (sub) {
      if (!sub) throw xatoYasa('PUSH_OBUNA');
      return serverYoz(s, sub).then(function () { s.serverda = true; sozlamaYoz(s); return funksiyaSorovi({ amal: 'sinov', endpoint: sub.endpoint }); });
    }).catch(function (e) { if (e && e.kod === 'PUSH_ESKIRGAN') eskirgan = true; throw e; }).then(function () {
      band = false; sinovBand = false; natija = 'Sinov yuborildi. Bir necha soniyada bildirishnoma keladi.'; xabarla(); return { ok: true };
    }, function (e) {
      band = false; sinovBand = false;
      // Obuna eskirgan: server qatorni o'chirdi; qurilmada ham tozalanadi, foydalanuvchi qayta yoqadi
      if (eskirgan) return localTozala().then(function () { xatoQoy(e); return { ok: false }; });
      xatoQoy(e); return { ok: false };
    });
  }

  // Qurilmadagi holatni tozalash (serverga tegmaydi): eslatmalar o'chiq, brauzer obunasi bekor. Chiqishdan, hisob o'chirilgandan va eskirgan obunada
  function localTozala() {
    if (timer) { clearTimeout(timer); timer = null; }
    var s = sozlama();
    if (s.kunlikYoqiq || s.qarzYoqiq || s.egasi || !s.serverda) {
      s.kunlikYoqiq = false; s.qarzYoqiq = false; s.egasi = ''; s.serverda = true;
      sozlamaYoz(s);
    }
    return obunaniOchir(false).catch(function () { /* ahamiyatsiz */ }).then(function () { xabarla(); });
  }

  // Chiqishdan OLDIN (token hali bor): shu qurilmaning serverdagi qatorini o'chirish. Ko'pi bilan 4 soniya kutadi, HECH QACHON rad etmaydi:
  // muvaffaqiyatsiz bo'lsa manzil eslab qolinadi va keyingi kirishda tozalanadi. Brauzer obunasi Kirish kuzatuvchisi orqali chiqqach bekor qilinadi.
  function chiqishdan() {
    if (timer) { clearTimeout(timer); timer = null; }
    var ish = joriyObuna().catch(function () { return null; }).then(function (sub) {
      if (!sub) return;
      var ep = sub.endpoint;
      qolganQosh(ep);
      return serverdanOchir(ep).then(function () { qolganOlibTashla(ep); }, function () { /* qolgan ro'yxatda turadi */ });
    }).catch(function () { /* chiqishni to'xtatmaydi */ });
    return Promise.race([ish, kut(CHIQISH_KUTISH_MS)]).then(function () { return true; });
  }

  // Keyingi kirishda: serverdan o'chirib bo'lmagan eski obuna qatorlari (o'z akkaunti bo'lsa) tozalanadi
  function qolganlarniTozala() {
    var a = qolganlar();
    if (!a.length || !dep.kirgan()) return Promise.resolve();
    return a.reduce(function (p, ep) {
      return p.then(function () { return serverdanOchir(ep).then(function () { qolganOlibTashla(ep); }, function (e) { if (e && e.kod !== 'NETWORK') qolganOlibTashla(ep); }); });
    }, Promise.resolve());
  }

  // Ekran ochilganda: boshqa akkaunt sozlamasi o'tkazilmaydi; ochiq kalit oldindan olinadi (ruxsat so'rovi bosish ichida qolishi uchun); yozilmay qolgan o'zgarish qayta uriniladi
  function ekranOchildi() {
    oldingiKirgan = !!dep.kirgan();   // kuzatuvchi (pastda) haqiqiy holatdan boshlab solishtiradi
    if (!dep.kirgan()) return Promise.resolve();
    var s = sozlama(), id = dep.foydalanuvchiId();
    var oldin = Promise.resolve();
    if (s.egasi && id && s.egasi !== id) oldin = localTozala();
    return oldin.then(function () {
      var e = muhit();
      if (S.ekranHolati(e).tur !== 'tayyor') return;
      kalitOl().catch(function () { /* bosilganda qayta uriniladi */ });
      var t = sozlama();
      if (!t.serverda && !timer && S.obunaKerakmi(t)) yubor();
    });
  }

  // Kirish holati o'zgarsa: chiqilganda (yoki sessiya yo'qolganda) shu qurilma eslatmalari o'chiriladi; kirilganda eski qoldiq tozalanadi
  if (typeof Kirish !== 'undefined' && Kirish.kuzat) {
    oldingiKirgan = !!Kirish.holat().kirgan;
    Kirish.kuzat(function (h) {
      var hozir = !!h.kirgan;
      if (oldingiKirgan === hozir) return;
      oldingiKirgan = hozir;
      if (!hozir) localTozala(); else qolganlarniTozala();
    });
  }

  // ---------------- Ekran ----------------
  // y: ui.js ning yordamchilari { el, tugma, karta, qisqaXabar, xatoKodBilan, profilgaOt }. Ekran bir marta quriladi, keyin joyida yangilanadi
  // (vaqt maydoni yozilayotganda qayta chizilmaydi).
  function bloklar(y) {
    var el = y.el, tugma = y.tugma;
    var q = {};   // kerakli elementlar

    function belgiKatagi(ikon, rang) {
      var k = el('span', undefined, 'eslatma-belgi');
      k.style.background = rang;
      k.setAttribute('aria-hidden', 'true');
      k.appendChild(Ikonlar.chiz(ikon, 22));
      return k;
    }
    function almashtirgich(id, nom, bosilganda) {
      var sw = tugma(undefined, 'almashtirgich', bosilganda);
      sw.id = id;
      sw.setAttribute('role', 'switch');
      sw.setAttribute('aria-label', nom);
      sw.setAttribute('aria-checked', 'false');
      sw.appendChild(el('span', undefined, 'almashtirgich-dona'));
      return sw;
    }
    function sarlavhaQatori(ikon, rang, nom, izoh, sw) {
      var qator = el('div', undefined, 'almashtirgich-qator eslatma-qator');
      var chap = el('div', undefined, 'eslatma-chap');
      chap.appendChild(belgiKatagi(ikon, rang));
      var matn = el('div', undefined, 'almashtirgich-matn');
      matn.appendChild(el('div', nom, 'yozuv-nom'));
      matn.appendChild(el('div', izoh, 'yozuv-izoh'));
      chap.appendChild(matn);
      qator.appendChild(chap);
      qator.appendChild(sw);
      return qator;
    }
    function vaqtQatori(id, nom, ozgarganda) {
      var qator = el('div', undefined, 'eslatma-vaqt-qator');
      var yorliq = el('label', 'Vaqt', 'yozuv-nom');
      yorliq.setAttribute('for', id);
      var inp = el('input', undefined, 'eslatma-vaqt');
      inp.type = 'time';
      inp.id = id;
      inp.step = '60';
      inp.setAttribute('aria-label', nom);
      inp.addEventListener('change', function () {
        if (!S.vaqtTogrimi(inp.value)) { yangila(); return; }   // bo'sh yoki noto'g'ri: eski qiymat qaytadi
        ozgarganda(inp.value);
      });
      qator.appendChild(yorliq);
      qator.appendChild(inp);
      return { qator: qator, inp: inp };
    }
    function boshqaruvOchiqmi() { var h = holat(); return h.ekran.boshqaruv && !h.band; }

    // 1) Holat kartasi (matnli)
    var holatK = y.karta();
    holatK.id = 'eslatma-holat';
    holatK.classList.add('eslatma-holat');
    holatK.setAttribute('role', 'status');
    q.holatMatn = el('p', '', 'yozuv-nom');
    holatK.appendChild(q.holatMatn);
    q.profil = tugma('Profilga o\'tish', 'asosiy-tugma', function () { if (y.profilgaOt) y.profilgaOt(); });
    q.profil.id = 'eslatma-profil';
    holatK.appendChild(q.profil);

    // 2) Kunlik eslatma
    var kunlikK = y.karta();
    kunlikK.classList.add('eslatma-karta');
    q.kunlik = almashtirgich('eslatma-kunlik', 'Kunlik eslatma', function () {
      if (!boshqaruvOchiqmi()) return;
      if (sozlama().kunlikYoqiq) ozgartir({ kunlikYoqiq: false }); else yoq({ kunlikYoqiq: true });
    });
    kunlikK.appendChild(sarlavhaQatori('bell-ringing', '#1E8FFF', 'Kunlik eslatma', 'Yozuv kiritishni eslatadi', q.kunlik));
    q.kunlikVaqt = vaqtQatori('eslatma-kunlik-vaqt', 'Kunlik eslatma vaqti', function (v) { ozgartir({ kunlikVaqt: v }); });
    kunlikK.appendChild(q.kunlikVaqt.qator);

    // 3) Qarz muddati
    var qarzK = y.karta();
    qarzK.classList.add('eslatma-karta');
    q.qarz = almashtirgich('eslatma-qarz', 'Qarz muddati', function () {
      if (!boshqaruvOchiqmi()) return;
      if (sozlama().qarzYoqiq) ozgartir({ qarzYoqiq: false }); else yoq({ qarzYoqiq: true });
    });
    qarzK.appendChild(sarlavhaQatori('calendar-due', '#FF5252', 'Qarz muddati', 'Qaytarish kuni yaqinlashganda', q.qarz));
    var chiplar = el('div', undefined, 'eslatma-chiplar');
    chiplar.setAttribute('role', 'group');
    chiplar.setAttribute('aria-label', 'Qarz eslatmasi qachon');
    q.chip = {};
    [[0, 'Muddat kuni'], [1, '1 kun oldin'], [3, '3 kun oldin']].forEach(function (c) {
      var b = tugma(undefined, 'eslatma-chip', function () {
        if (!boshqaruvOchiqmi()) return;
        ozgartir({ qarzKunlar: S.qarzKuniniAlmashtir(sozlama().qarzKunlar, c[0]) });
      });
      b.id = 'eslatma-kun-' + c[0];
      b.setAttribute('aria-pressed', 'false');
      var ich = el('span', undefined, 'eslatma-chip-ich');
      var belgi = el('span', undefined, 'eslatma-chip-belgi');
      belgi.appendChild(Ikonlar.chiz('check', 14));
      ich.appendChild(belgi);
      ich.appendChild(el('span', c[1]));
      b.appendChild(ich);
      q.chip[c[0]] = b;
      chiplar.appendChild(b);
    });
    qarzK.appendChild(chiplar);
    q.qarzVaqt = vaqtQatori('eslatma-qarz-vaqt', 'Qarz eslatmasi vaqti', function (v) { ozgartir({ qarzVaqt: v }); });
    qarzK.appendChild(q.qarzVaqt.qator);

    // 4) Ism va summani ko'rsatish
    var korK = y.karta();
    korK.classList.add('eslatma-karta');
    q.korsatish = almashtirgich('eslatma-korsatish', 'Ism va summani ko\'rsatish', function () {
      if (!boshqaruvOchiqmi()) return;
      ozgartir({ korsatish: !sozlama().korsatish });
    });
    var korQator = el('div', undefined, 'almashtirgich-qator eslatma-qator');
    var korMatn = el('div', undefined, 'almashtirgich-matn');
    korMatn.appendChild(el('div', 'Ism va summani ko\'rsatish', 'yozuv-nom'));
    korMatn.appendChild(el('div', 'O\'chiq bo\'lsa: "Qarz muddati bugun" (ismsiz)', 'yozuv-izoh'));
    korQator.appendChild(korMatn);
    korQator.appendChild(q.korsatish);
    korK.appendChild(korQator);

    // 5) Sinab ko'rish
    var sinovK = el('div', undefined, 'eslatma-sinov-blok');
    q.sinov = tugma(undefined, 'ikkinchi-tugma eslatma-sinov', function () { sinov(); });
    q.sinov.id = 'eslatma-sinov';
    q.sinovIkon = Ikonlar.chiz('bell', 20);
    q.sinovMatn = el('span', 'Sinab ko\'rish');
    q.sinov.appendChild(q.sinovIkon);
    q.sinov.appendChild(q.sinovMatn);
    sinovK.appendChild(q.sinov);
    q.xato = el('div', '', 'xato-matn eslatma-xato');
    q.xato.id = 'eslatma-xato';
    q.xato.setAttribute('role', 'alert');
    q.natija = el('div', '', 'xira eslatma-natija');
    q.natija.id = 'eslatma-natija';
    q.natija.setAttribute('role', 'status');
    sinovK.appendChild(q.xato);
    sinovK.appendChild(q.natija);

    var hammasi = [holatK, kunlikK, qarzK, korK, sinovK];

    function yangila() {
      var h = holat(), s = h.sozlama, ochiq = h.ekran.boshqaruv && !h.band;
      holatK.hidden = h.ekran.tur === 'tayyor';
      q.holatMatn.textContent = h.ekran.matn;
      q.profil.hidden = !h.ekran.profilTugma;
      [kunlikK, qarzK, korK, sinovK].forEach(function (k) { k.classList.toggle('eslatma-ochiq-emas', !h.ekran.boshqaruv); });
      function toggle(sw, yoqiq) { sw.classList.toggle('yoqiq', yoqiq); sw.setAttribute('aria-checked', String(yoqiq)); sw.disabled = !ochiq; }
      toggle(q.kunlik, s.kunlikYoqiq);
      toggle(q.qarz, s.qarzYoqiq);
      toggle(q.korsatish, s.korsatish);
      function vaqt(v, qiymat) { if (document.activeElement !== v.inp) v.inp.value = qiymat; v.inp.disabled = !h.ekran.boshqaruv; }
      vaqt(q.kunlikVaqt, s.kunlikVaqt);
      vaqt(q.qarzVaqt, s.qarzVaqt);
      S.QARZ_KUNLAR.forEach(function (k) { q.chip[k].setAttribute('aria-pressed', String(s.qarzKunlar.indexOf(k) >= 0)); q.chip[k].disabled = !h.ekran.boshqaruv || h.band; });
      q.sinov.disabled = !h.ekran.boshqaruv || h.band;
      q.sinovMatn.textContent = h.sinovBand ? 'Yuborilmoqda…' : 'Sinab ko\'rish';
      q.xato.textContent = h.xato ? y.xatoKodBilan(h.xato.matn, h.xato.kod) : '';
      q.natija.textContent = h.natija;
    }
    // Ekran yopilgach (DOM'da yo'q) kuzatuvchi o'zini o'chiradi
    var olib = kuzat(function () {
      if (!document.getElementById('eslatma-holat')) { olib(); return; }
      yangila();
    });
    xato = null; natija = '';
    yangila();
    ekranOchildi().then(yangila);
    return hammasi;
  }

  return {
    sozla: sozla, sozlama: sozlama, holat: holat, kuzat: kuzat, menyuIzohi: menyuIzohi,
    yoq: yoq, ozgartir: ozgartir, yubor: yubor, sinov: sinov, chiqishdan: chiqishdan, localTozala: localTozala, qolganlarniTozala: qolganlarniTozala,
    ekranOchildi: ekranOchildi, bloklar: bloklar, kalitOl: kalitOl,
    KECHIKISH_MS: KECHIKISH_MS, FUNKSIYA_YOLI: FUNKSIYA_YOLI, JADVAL: JADVAL
  };
})();
