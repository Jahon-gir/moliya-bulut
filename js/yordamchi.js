// AI yordamchi (TZ-sinxronlash.md 24-band): suzuvchi "Ko'zlar" tugmasi, chat ekrani va server bilan aloqa.
// Oqim: savol -> funksiya "reja" -> tuzilgan so'rov -> ilova telefonda hisoblaydi (js/yordamchi-sof.js) -> funksiya "javob" -> matn.
// Suhbatlar tarixi (TZ 33) faqat shu qurilmada (localStorage, akkaunt id bilan) saqlanadi: bazaga, serverga, zaxiraga va Excel eksportiga kirmaydi; chiqilsa tozalanadi.
// Server funksiyasi (supabase/functions/yordamchi): reja -> { sorovlar | suhbat | tashqari }, javob -> { matn, davom } (TZ 26). Sinxron mantig'iga tegilmaydi.
var Yordamchi = (function () {
  'use strict';

  var SUHBAT_KALIT = 'moliya-chat-suhbatlar';   // "moliya-" bilan boshlanadi: "PINni unutdim" to'liq tozalashi uni ham o'chiradi
  var YOPIQ_KALIT = 'moliya-yordamchi-yopiq';   // "moliya-" bilan boshlanadi: "PINni unutdim" to'liq tozalashi uni ham o'chiradi
  var FUNKSIYA_YOLI = '/functions/v1/yordamchi';
  var YOPIQ_XABARI = 'Yordamchi hozircha siz uchun yopiq';

  // Tashqi bog'liqliklar (tests.html da almashtiriladi)
  var dep = {
    fetch: function (u, i) { return window.fetch(u, i); },
    tokenOl: function () { return Kirish.tokenOl(); },
    tokenYangila: function () { return Kirish.tokenYangila(); },
    manzil: function () { return Kirish.SUPABASE_MANZIL; },
    kalit: function () { return Kirish.OCHIQ_KALIT; },
    kirgan: function () { return !!Kirish.holat().kirgan; },
    foydalanuvchiId: function () { return Kirish.holat().id || ''; },
    onlayn: function () { return navigator.onLine !== false; },
    xotira: function () { try { return localStorage; } catch (e) { return null; } },
    hozir: function () { return Date.now(); },
    ism: function () { return ChatSof.ismAjrat(Kirish.holat().meta); }   // Google hisobidagi ism: faqat ekranda ko'rinadi, serverga/logga yuborilmaydi
  };
  function sozla(o) { Object.keys(o || {}).forEach(function (k) { dep[k] = o[k]; }); }

  var ui = { malumot: null, korinadi: null, xabar: null, belgi: null, ochish: null };
  // Ochiq suhbatning xabarlari: [{ rol: 'savol' | 'javob' | 'kutish' | 'xato', matn, kartalar, davom, savol, kod, qayta, t }] (joriy.xabarlar)
  // AI xotirasi (oxirgi 3 almashinuv) ochiq suhbatdan olinadi (ChatSof.xotiraYasash): tanlangan suhbat davom ettirilsa xotira shu suhbatdan
  var tugmaEl = null, ekranEl = null, royxatEl = null, kirishEl = null, yuborEl = null;
  var menuTugma = null, sarlavhaEl = null, nomEl = null, panelEl = null, fonEl = null, panelRoyxatEl = null;

  // ---- "Yopiq" belgisi (server 403, AI_RUXSAT): shu qurilmada tugma yashiriladi; chiqib-kirilsa o'chadi. Email saqlanmaydi (faqat foydalanuvchi id si) ----
  function belgiOqi() { try { var x = dep.xotira(); return x ? x.getItem(YOPIQ_KALIT) : null; } catch (e) { return null; } }
  function yopiqmi() {
    var b = belgiOqi();
    if (!b) return false;
    var id = dep.foydalanuvchiId();
    return b === '1' || !id || b === id;   // boshqa akkaunt bilan kirilgan bo'lsa, u akkaunt uchun yopiq emas
  }
  function yopiqQil() { try { var x = dep.xotira(); if (x) x.setItem(YOPIQ_KALIT, dep.foydalanuvchiId() || '1'); } catch (e) { /* xotira ishlamasa ham ilova ishlayveradi */ } }
  function belginiOchir() { try { var x = dep.xotira(); if (x) x.removeItem(YOPIQ_KALIT); } catch (e) { /* ahamiyatsiz */ } }

  // ---- Server bilan aloqa ----
  function xato(kod, holat) { var e = new Error(kod); e.kod = kod; e.holat = holat || 0; return e; }

  // ms berilsa: shu vaqtdan keyin so'rov to'xtatiladi (xato kodi VAQT). Chat uchun berilmaydi (o'zgarishsiz).
  // tashqi (ixtiyoriy AbortController): chaqiruvchi so'rovni o'zi to'xtata oladi ("Bekor", 36-band)
  function yubor(tana, token, ms, tashqi) {
    var ac = tashqi || (ms && typeof AbortController !== 'undefined' ? new AbortController() : null);
    var p = dep.fetch(dep.manzil() + FUNKSIYA_YOLI, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: dep.kalit(), Authorization: 'Bearer ' + token },
      body: JSON.stringify(tana),
      signal: ac ? ac.signal : undefined
    }).then(function (r) {
      return r.json().then(function (j) { return { holat: r.status, ok: r.ok, j: j }; }, function () { return { holat: r.status, ok: r.ok, j: null }; });
    }, function () { throw xato('NETWORK'); });
    if (!ms) return p;
    return new Promise(function (ok, no) {
      var t = setTimeout(function () { if (ac) { try { ac.abort(); } catch (x) { /* ahamiyatsiz */ } } no(xato('VAQT')); }, ms);
      p.then(function (v) { clearTimeout(t); ok(v); }, function (e) { clearTimeout(t); no(e); });
    });
  }
  // Bitta so'rov. 401 bo'lsa token bir marta yangilanib qayta yuboriladi; shunda ham 401 bo'lsa kirish muddati tugagan.
  function chaqir(tana, ms, tashqi) {
    function tokenBilan(qayta) {
      return (qayta ? dep.tokenYangila() : dep.tokenOl()).then(function (t) {
        if (!t) throw xato('AUTH_EXPIRED');
        return yubor(tana, t, ms, tashqi);
      }, function (e) { if (e && e.kod) throw e; throw xato('NETWORK'); }).then(function (r) {
        if (r.holat === 401) { if (!qayta) return tokenBilan(true); throw xato('AUTH_EXPIRED', 401); }
        if (r.ok && r.j && r.j.ok === true) return r.j;
        if (r.ok && r.j && r.j.ok === false && r.j.sabab === 'ovoz_yoq') throw xato('OVOZ_YOQ', r.holat);   // ovoz rejimi: gap eshitilmadi
        var kod = r.j && r.j.xato && typeof r.j.xato.kod === 'string' ? r.j.xato.kod : '';
        if (r.holat === 403 && kod === 'AI_RUXSAT') { yopiqQil(); throw xato('AI_RUXSAT', 403); }
        var e = xato(kod || ('HTTP_' + r.holat), r.holat);
        var dbg = r.j && r.j.xato && r.j.xato.debug;
        if (typeof dbg === 'string' && /^[a-z0-9_]{1,40}$/.test(dbg)) e.debug = dbg;   // serverning qisqa sababi (masalan gemini_400_mime)
        throw e;
      });
    }
    return tokenBilan(false);
  }

  // Oxirgi 3 almashinuv (savol, reja, javob matni): serverga "tarix" sifatida beriladi, shunda "taksigachi?" kabi davom savollari tushuniladi
  function tarixYasash() {
    return suhbatXotirasi().slice(-YordamchiSof.XOTIRA_MAX).map(function (x) { return { savol: x.savol, reja: x.reja, matn: String(x.matn || '').slice(0, 600) }; });
  }

  // Savolga javob: Promise -> { matn, kartalar, davom, reja, zaxira }  yoki rad (Error.kod)
  // Oqim: "reja" -> { tur: "tashqari" | "suhbat" | "sorovlar" (1..5) }; so'rovlar ilovada ketma-ket hisoblanadi; "javob" -> matn va davom savollari.
  // "javob" AI_RAQAM yoki AI_SXEMA bilan tugasa xato ko'rsatilmaydi: kartalar ilova hisoblagan raqamlar bilan, AI gapisiz (zaxira javob);
  // karta bo'lmagan amalda ilovaning o'z sodda gapi chiqadi. "suhbat" matni o'tmasa tayyor umumiy javob. Tarmoq, limit va ruxsat xatolari xato bo'lib qoladi.
  function javobOl(savol, malumot, bugunSana) {
    if (!dep.onlayn()) return Promise.reject(xato('NETWORK_OFFLINE'));   // internet yo'q: serverga so'rov ketmaydi
    var n = YordamchiSof.nomlar(malumot), tarix = tarixYasash();
    return chaqir({ rejim: 'reja', savol: savol, bugun: bugunSana, kategoriyalar: n.kategoriyalar, hisoblar: n.hisoblar, tarix: tarix }).then(function (j) {
      var reja = j.reja;
      if (!reja || typeof reja !== 'object') throw xato('AI_SXEMA');
      if (reja.tur === 'tashqari') return { matn: YordamchiSof.TASHQARI_MATNI, kartalar: [], davom: YordamchiSof.TASHQARI_SAVOLLAR.slice(), reja: { tur: 'tashqari' } };
      if (reja.tur === 'suhbat') {
        if (typeof reja.matn !== 'string' || !reja.matn) throw xato('AI_SXEMA');
        return { matn: reja.matn, kartalar: [], davom: [], reja: { tur: 'suhbat', matn: reja.matn } };
      }
      var t = reja.tur === 'sorovlar' ? YordamchiSof.tahlillar(reja.sorovlar, malumot, bugunSana, savol) : [];
      if (!t.length) return { matn: YordamchiSof.TUSHUNARSIZ_MATNI, kartalar: [], davom: YordamchiSof.TUSHUNARSIZ_SAVOLLAR.slice(), reja: { tur: 'sorovlar', sorovlar: [{ amal: 'tushunarsiz' }] }, tushunarsiz: true };   // ikkinchi so'rov yuborilmaydi
      var natijalar = t.map(function (x) { return x.natija; });
      if (!YordamchiSof.natijalarYuborsaBoladimi(natijalar)) throw xato('JS_NATIJA');
      var kartalar = t.map(function (x) { return x.karta; }).filter(Boolean);
      function zaxira() { return { matn: t.filter(function (x) { return !x.karta && x.gap; }).map(function (x) { return x.gap; }).join(' '), kartalar: kartalar, davom: [], reja: reja, zaxira: true }; }
      return chaqir({ rejim: 'javob', savol: savol, tarix: tarix, sorovlar: t.map(function (x) { return x.sorov; }), natijalar: natijalar }).then(function (j2) {
        if (typeof j2.matn !== 'string' || !j2.matn) return zaxira();
        return { matn: j2.matn, kartalar: kartalar, davom: YordamchiSof.davomniTekshir(j2.davom), reja: reja };
      }, function (e) {
        if (e && (e.kod === 'AI_RAQAM' || e.kod === 'AI_SXEMA')) return zaxira();
        throw e;
      });
    }, function (e) {
      // "suhbat" matnida begona raqam bo'lsa server AI_RAQAM beradi: tayyor umumiy javob chiqadi
      if (e && (e.kod === 'AI_RAQAM' || e.kod === 'AI_SXEMA')) return { matn: YordamchiSof.UMUMIY_JAVOB, kartalar: [], davom: YordamchiSof.UMUMIY_SAVOLLAR.slice(), reja: { tur: 'suhbat', matn: YordamchiSof.UMUMIY_JAVOB }, zaxira: true };
      throw e;
    });
  }

  // ---- Suhbatlar tarixi (TZ 33): faqat shu qurilmada (localStorage), akkaunt id bilan bog'langan. Serverga yozilmaydi, zaxira va eksportga kirmaydi ----
  var saqlangan = [];       // saqlangan suhbatlar [{ id, nom, yaratilgan, yangilangan, xabarlar }]
  var yuklandi = false, hisobId = '', avlod = 0;   // avlod: akkaunt tozalanganda eski (kutilayotgan) javoblar tashlab yuboriladi
  function yangiBosh() { return { id: null, nom: '', yaratilgan: 0, yangilangan: 0, xabarlar: [] }; }
  var joriy = yangiBosh();  // ochiq suhbat; birinchi xabar yuborilgandagina saqlangan ro'yxatga qo'shiladi
  function hozir() { return dep.hozir(); }
  function xotiraOl() { try { return dep.xotira(); } catch (x) { return null; } }

  function xotiradanOchir() { try { var x = xotiraOl(); if (x) x.removeItem(SUHBAT_KALIT); } catch (x) { /* ahamiyatsiz */ } }
  // Xotiradan o'qish: boshqa akkaunt (yoki buzuq yozuv) bo'lsa xotira tozalanadi
  function yuklash() {
    var id = dep.foydalanuvchiId();
    if (yuklandi && hisobId === id) return;
    var matn = null;
    try { var x = xotiraOl(); matn = x ? x.getItem(SUHBAT_KALIT) : null; } catch (x) { matn = null; }
    var r = ChatSof.yozuvOqi(matn, id);
    if (r.tozalash) xotiradanOchir();
    var oldingi = joriy.id;
    saqlangan = r.suhbatlar; yuklandi = true; hisobId = id;
    if (oldingi && hisobId && !saqlangan.some(function (s) { return s.id === oldingi; })) joriy = yangiBosh();   // boshqa akkaunt: ochiq suhbat ham tashlanadi
  }
  // Xotiraga yozish. Joy yetmasa eng eski suhbatlar (ochiq suhbatdan tashqari) tashlanib qayta uriniladi; baribir bo'lmasa xotirada ishlayveradi
  function saqla() {
    if (!hisobId) return;
    var royxat = saqlangan.slice();
    for (var urinish = 0; urinish < 6; urinish++) {
      try {
        var x = xotiraOl();
        if (!x) return;
        x.setItem(SUHBAT_KALIT, JSON.stringify(ChatSof.yozuvYasash(hisobId, royxat)));
        return;
      } catch (e) {
        var eski = royxat.filter(function (s) { return s !== joriy; }).sort(function (a, b) { return a.yangilangan - b.yangilangan; })[0];
        if (!eski) return;
        royxat.splice(royxat.indexOf(eski), 1);
      }
    }
  }
  function royxatniCheklash() {
    var qolgan = ChatSof.suhbatlarniCheklash(saqlangan);
    saqlangan = saqlangan.filter(function (s) { return qolgan.indexOf(s) >= 0; });
  }
  function belgila(kon) {   // suhbat o'zgardi: vaqti yangilanadi va saqlanadi
    kon.yangilangan = hozir();
    if (kon.id && saqlangan.indexOf(kon) < 0) return;   // o'chirilgan suhbat qayta tiklanmasin
    kon.xabarlar = ChatSof.xabarlarniCheklash(kon.xabarlar);
    saqla();
  }
  // Hamma saqlangan suhbatlarni tozalash (akkauntdan chiqilganda)
  function hammasiniTozala() {
    avlod++; saqlangan = []; yuklandi = false; hisobId = ''; joriy = yangiBosh(); xotiradanOchir();
  }

  // ---- Suhbat ----
  function sanasi() { return Calc.bugun(); }
  function band() { return joriy.xabarlar.some(function (x) { return x.rol === 'kutish'; }); }
  function suhbatXotirasi() { return ChatSof.xotiraYasash(joriy.xabarlar); }

  function natijaniQoy(kon, kutish, p) {
    var mening = avlod;
    p.then(function (r) { return { rol: 'javob', matn: r.matn, kartalar: r.kartalar || [], davom: r.davom || [], reja: r.reja || null, zaxira: !!r.zaxira }; }, function (e) {
      var kod = (e && e.kod) || ('JS_' + String((e && e.name) || 'XATO').replace(/[^A-Za-z0-9]/g, '').toUpperCase());
      return { rol: 'xato', matn: YordamchiSof.xatoMatni(kod), savol: kutish.savol, kod: kod, qayta: YordamchiSof.xatoQaytaMi(kod), yopiq: kod === 'AI_RUXSAT' && yopiqmi() };
    }).then(function (yangi) {
      var i = kon.xabarlar.indexOf(kutish);
      if (i < 0 || mening !== avlod) return;   // suhbat o'chirilgan yoki akkaunt almashgan: eski javob ko'rsatilmaydi
      if (yangi.yopiq) {   // 403: xabar chiqadi, shu savol olib tashlanadi, chat yopiladi va tugma yashiriladi
        kon.xabarlar.splice(i > 0 && kon.xabarlar[i - 1].rol === 'savol' ? i - 1 : i, i > 0 && kon.xabarlar[i - 1].rol === 'savol' ? 2 : 1);
        if (!kon.xabarlar.length) suhbatniOchir(kon.id); else belgila(kon);
        yop(); if (ui.xabar) ui.xabar(YOPIQ_XABARI); yangila(); return;
      }
      yangi.t = hozir();
      kon.xabarlar[i] = yangi;
      belgila(kon);
      if (kon === joriy) chiz();
    });
  }
  function boshlaSavol(savol) {
    var kutish = { rol: 'kutish', savol: savol };
    var p;
    try { p = javobOl(savol, ui.malumot(), sanasi()); } catch (e) { p = Promise.reject(e); }
    return { kutish: kutish, p: p };
  }
  function savolBer(matn) {
    var savol = String(matn || '').trim();
    if (!savol || band()) return;
    if (savol.length > YordamchiSof.SAVOL_MAX) savol = savol.slice(0, YordamchiSof.SAVOL_MAX);
    yuklash();
    var kon = joriy;
    if (!kon.id) {   // suhbat birinchi xabar yuborilgandagina yaratiladi; nomi birinchi savoldan
      kon.id = ChatSof.yangiId(hozir()); kon.nom = ChatSof.nomOl(savol) || 'Suhbat'; kon.yaratilgan = kon.yangilangan = hozir();
      saqlangan.push(kon); royxatniCheklash();
    }
    kon.xabarlar.push({ rol: 'savol', matn: savol, t: hozir() });
    var b = boshlaSavol(savol);   // AI xotirasi shu suhbatning oxirgi 3 savol-javobidan olinadi
    kon.xabarlar.push(b.kutish);
    belgila(kon);
    chiz();
    natijaniQoy(kon, b.kutish, b.p);
  }
  function qaytaUrin(xatoXabar) {
    var i = joriy.xabarlar.indexOf(xatoXabar);
    if (i < 0 || band()) return;
    var kon = joriy;
    var b = boshlaSavol(xatoXabar.savol);
    kon.xabarlar[i] = b.kutish;
    chiz();
    natijaniQoy(kon, b.kutish, b.p);
  }
  // Yangi (bo'sh) chat: eski suhbat tarixda qoladi
  function yangiChat() { joriy = yangiBosh(); panelniYop(true); tahrirNomi = false; chiz(); }
  function tozala() { yangiChat(); }
  function suhbatniOch(id) {
    var s = saqlangan.filter(function (x) { return x.id === id; })[0];
    if (!s) return;
    joriy = s; tahrirNomi = false; panelniYop(true); chiz();
  }
  function suhbatniOchir(id) {
    saqlangan = saqlangan.filter(function (x) { return x.id !== id; });
    if (joriy.id === id) joriy = yangiBosh();
    saqla();
    chiz();
  }
  function nomniOzgartir(id, yangi) {
    var n = ChatSof.nomTekshir(yangi), s = saqlangan.filter(function (x) { return x.id === id; })[0];
    if (!n || !s) return false;
    s.nom = n; saqla(); chiz();
    return true;
  }

  // ---- Ko'rinish ----
  function e(teg, matn, klass) { var x = document.createElement(teg); if (matn !== undefined) x.textContent = matn; if (klass) x.className = klass; return x; }
  function tugmaYasa(klass, ariya, bosilganda) {
    var b = e('button', undefined, klass); b.type = 'button'; b.setAttribute('aria-label', ariya); b.addEventListener('click', bosilganda); return b;
  }
  var NS = 'http://www.w3.org/2000/svg';
  function svg(vb, ichi, klass) {
    var s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', vb); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
    if (klass) s.setAttribute('class', klass);
    s.innerHTML = ichi;   // faqat shu fayldagi qat'iy matn (foydalanuvchi matni emas)
    return s;
  }
  var KOZ_SVG = '<g class="yo-koz"><ellipse cx="10" cy="15" rx="7" ry="11" fill="#fff"/><ellipse cx="26" cy="15" rx="7" ry="11" fill="#fff"/>' +
    '<circle class="yo-qorachiq" cx="10" cy="15" r="3.6" fill="#1F2A3A"/><circle class="yo-qorachiq" cx="26" cy="15" r="3.6" fill="#1F2A3A"/></g>';
  var CHIZIQLI = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  var ORQAGA_SVG = '<path ' + CHIZIQLI + ' d="M15 5l-7 7l7 7"/>';
  var MENU_SVG = '<path ' + CHIZIQLI + ' d="M4 7h16M4 12h16M4 17h16"/>';
  var YANGI_SVG = '<path ' + CHIZIQLI + ' d="M12 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5M17 4l3 3l-8 8l-4 1l1-4z"/>';
  var QALAM_SVG = '<path ' + CHIZIQLI + ' d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16zM14 6l4 4"/>';
  var UCH_SVG = '<circle cx="5" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="19" cy="12" r="1.8" fill="currentColor"/>';
  var YUBORISH_SVG = '<path ' + CHIZIQLI + ' d="M12 19V5M6 11l6-6l6 6"/>';

  // Suzuvchi tugma: faqat Asosiy sahifada, Google bilan kirgan va yopilmagan bo'lsa ko'rinadi
  function tugmaYasash() {
    var b = tugmaYasa('yordamchi-tugma', 'Yordamchi', ochish);
    b.id = 'yordamchi-tugma';
    b.appendChild(svg('0 0 36 30', KOZ_SVG, 'yo-koz-svg'));
    // bosilganda qorachiqlar markazga keladi
    b.addEventListener('pointerdown', function () { b.classList.add('bosildi'); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (h) { b.addEventListener(h, function () { setTimeout(function () { b.classList.remove('bosildi'); }, 350); }); });
    document.body.appendChild(b);
    return b;
  }
  function korinadimi() {
    return !!(ui.korinadi && ui.korinadi()) && dep.kirgan() && !yopiqmi() && !ekranEl;
  }
  function yangila() {
    if (!ui.malumot) return;
    if (!tugmaEl) tugmaEl = tugmaYasash();
    tugmaEl.hidden = !korinadimi();
    if (typeof Gap !== 'undefined' && Gap.yangila) Gap.yangila();   // "Gap bilan" tugmasi ham shu qoida bilan ko'rinadi
  }

  function nuqtalar() {
    var k = e('div', undefined, 'yo-javob yo-kutish'); k.setAttribute('role', 'status'); k.setAttribute('aria-label', 'Yordamchi o\'ylayapti');
    for (var i = 0; i < 3; i++) k.appendChild(e('span', undefined, 'yo-nuqta'));
    return k;
  }
  // Bo'sh chat: salom (faqat ekranda; ism serverga ketmaydi), savol va tayyor savollar
  function bosHolat() {
    var q = e('div', undefined, 'yo-bosh-holat');
    var ism = ''; try { ism = dep.ism(); } catch (x) { ism = ''; }
    q.appendChild(e('h2', ChatSof.salomMatni(ism), 'yo-salom'));
    q.appendChild(e('p', 'Nima haqida bilmoqchisiz?', 'yo-izoh'));
    var r = e('div', undefined, 'yo-tayyorlar');
    YordamchiSof.tayyorSavollar(sanasi()).forEach(function (s) { r.appendChild(Object.assign(e('button', s, 'yo-tayyor'), { type: 'button', onclick: function () { savolBer(s); } })); });
    q.appendChild(r);
    return q;
  }
  // Kartalardagi tugmalar: tegishli bo'limni ochadi va chat yopiladi (suhbat tarixda qoladi)
  function hamyon() {
    return {
      belgi: function (k, o) { return ui.belgi ? ui.belgi(k, o) : e('span'); },
      ochish: function (nom, p) { yop(); if (ui.ochish) ui.ochish(nom, p || {}); }
    };
  }
  function oynaKattaldi() { if (royxatEl) Sigdir.hammasi(royxatEl); }
  function vaqtEl(ms, klass) { var v = e('div', ms ? ChatSof.soatMatni(ms) : '', 'yo-vaqt ' + klass); return v; }

  function chiz() {
    if (!royxatEl) return;
    var xab = joriy.xabarlar;
    var ichki = royxatEl.scrollTop;
    royxatEl.textContent = '';
    royxatEl.classList.toggle('yo-bosh-royxat', !xab.length);
    if (!xab.length) royxatEl.appendChild(bosHolat());
    xab.forEach(function (x, i) {
      if (x.rol === 'savol') {
        var o = e('div', undefined, 'yo-xabar yo-xabar-savol');
        o.appendChild(e('div', x.matn, 'yo-savol'));
        if (x.t) o.appendChild(vaqtEl(x.t, 'yo-vaqt-savol'));
        royxatEl.appendChild(o);
      } else if (x.rol === 'kutish') royxatEl.appendChild(nuqtalar());
      else if (x.rol === 'javob') {
        if (x.kartalar && x.kartalar.length) {   // kartochkali javob: AI gapi (bo'lsa) eng tepada oddiy matn, kartalar ketma-ket (saqlangan ma'lumotdan qayta chiziladi)
          if (x.matn) royxatEl.appendChild(e('p', x.matn, 'yo-matn'));
          x.kartalar.forEach(function (k) { var kk = YordamchiKarta.yasa(k, hamyon()); if (kk) royxatEl.appendChild(kk); });
        } else royxatEl.appendChild(e('div', x.matn, 'yo-javob'));
        if (x.t) royxatEl.appendChild(vaqtEl(x.t, 'yo-vaqt-javob'));
        // davom savollari: faqat eng oxirgi javob ostida, bosiladigan tugmalar
        if (x.davom && x.davom.length && i === xab.length - 1) {
          var dv = e('div', undefined, 'yo-davom');
          x.davom.forEach(function (d) { dv.appendChild(Object.assign(e('button', d, 'yo-tayyor yo-davom-tugma'), { type: 'button', onclick: function () { savolBer(d); } })); });
          royxatEl.appendChild(dv);
        }
      } else {
        var k = e('div', x.matn, 'yo-javob yo-xato');
        k.setAttribute('role', 'alert');
        if (x.qayta) { var q = e('button', 'Qayta urinish', 'yo-qayta'); q.type = 'button'; q.addEventListener('click', function () { qaytaUrin(x); }); k.appendChild(q); }
        royxatEl.appendChild(k);
      }
    });
    Sigdir.hammasi(royxatEl);   // raqamlar kartadan chiqib ketmasin
    royxatEl.scrollTop = xab.length ? royxatEl.scrollHeight : ichki;
    if (yuborEl) yuborEl.disabled = band();
    sarlavhaniChiz();
    if (panelEl && panelOchiq) royxatniChiz();
  }

  // ---- Sarlavha: chat nomi (bosilsa tahrirlanadi) ----
  var tahrirNomi = false;
  // Nomni tahrirlash maydoni: Enter yoki "Saqlash" saqlaydi, Escape bekor qiladi; 40 belgigacha, bo'sh nom qabul qilinmaydi
  function tahrirMaydoni(boshlangich, saqlash, bekor, klass) {
    var f = e('form', undefined, 'yo-tahrir ' + (klass || ''));
    var inp = document.createElement('input');
    inp.type = 'text'; inp.className = 'yo-tahrir-kiritish'; inp.maxLength = ChatSof.NOM_MAX; inp.value = boshlangich; inp.autocomplete = 'off';
    inp.setAttribute('aria-label', 'Suhbat nomi');
    var xb = e('span', 'Nom bo\'sh bo\'lmasligi kerak', 'yo-tahrir-xato'); xb.hidden = true; xb.setAttribute('role', 'alert');
    var sb = e('button', 'Saqlash', 'yo-saqlash'); sb.type = 'submit'; sb.setAttribute('aria-label', 'Nomni saqlash');
    f.appendChild(inp); f.appendChild(sb); f.appendChild(xb);
    f.addEventListener('submit', function (h) {
      h.preventDefault();
      if (!ChatSof.nomTekshir(inp.value)) { xb.hidden = false; inp.focus(); return; }
      saqlash(inp.value);
    });
    inp.addEventListener('input', function () { xb.hidden = true; });
    inp.addEventListener('keydown', function (h) { if (h.key === 'Escape') { h.preventDefault(); h.stopPropagation(); bekor(); } });
    setTimeout(function () { try { inp.focus(); inp.select(); } catch (x) { /* ahamiyatsiz */ } }, 0);
    return f;
  }
  function sarlavhaniChiz() {
    if (!sarlavhaEl) return;
    sarlavhaEl.textContent = '';
    if (joriy.id && tahrirNomi) {
      var id = joriy.id;
      sarlavhaEl.appendChild(tahrirMaydoni(joriy.nom, function (m) { nomniOzgartir(id, m); tahrirNomi = false; sarlavhaniChiz(); if (nomEl) nomEl.focus(); },
        function () { tahrirNomi = false; sarlavhaniChiz(); if (nomEl) nomEl.focus(); }, 'yo-tahrir-bosh'));
      return;
    }
    if (!joriy.id) { nomEl = null; sarlavhaEl.appendChild(e('span', 'Yangi chat', 'yo-nom yo-nom-bosh')); return; }
    nomEl = tugmaYasa('yo-nom', 'Chat nomini o\'zgartirish: ' + joriy.nom, function () { tahrirNomi = true; sarlavhaniChiz(); });
    nomEl.appendChild(e('span', joriy.nom, 'yo-nom-matn'));
    nomEl.appendChild(svg('0 0 24 24', QALAM_SVG, 'yo-qalam'));
    sarlavhaEl.appendChild(nomEl);
  }

  // ---- Yon panel: suhbatlar tarixi ----
  var panelOchiq = false, qidiruvMatni = '', menuId = null, tahrirId = null, tasdiqId = null;
  function panelniOch() {
    if (!ekranEl) return;
    yuklash();
    panelOchiq = true; menuId = null; tahrirId = null; tasdiqId = null;
    panelniChiz();
    panelEl.classList.add('ochiq'); fonEl.classList.add('ochiq');
    panelEl.setAttribute('aria-hidden', 'false');
    menuTugma.setAttribute('aria-expanded', 'true');
    setTimeout(function () { var b = panelEl.querySelector('.yo-panel-yangi'); if (b && panelOchiq) b.focus(); }, 0);
  }
  function panelniYop(fokussiz) {
    if (!panelEl || !panelOchiq) return;
    panelOchiq = false; menuId = null; tahrirId = null; tasdiqId = null;
    panelEl.classList.remove('ochiq'); fonEl.classList.remove('ochiq');
    panelEl.setAttribute('aria-hidden', 'true');
    menuTugma.setAttribute('aria-expanded', 'false');
    if (!fokussiz && menuTugma) menuTugma.focus();
  }
  function panelniChiz() {
    if (!panelEl) return;
    var ichki = panelRoyxatEl ? panelRoyxatEl.scrollTop : 0;
    panelRoyxatEl = null;
    panelEl.textContent = '';
    var yangi = e('button', undefined, 'yo-panel-yangi'); yangi.type = 'button'; yangi.setAttribute('aria-label', 'Yangi chat');
    yangi.appendChild(svg('0 0 24 24', YANGI_SVG)); yangi.appendChild(e('span', 'Yangi chat'));
    yangi.addEventListener('click', yangiChat);
    panelEl.appendChild(yangi);
    var q = document.createElement('input');
    q.type = 'search'; q.className = 'yo-qidiruv'; q.placeholder = 'Suhbatlardan qidirish'; q.value = qidiruvMatni; q.autocomplete = 'off'; q.maxLength = 60;
    q.setAttribute('aria-label', 'Suhbatlardan qidirish');
    q.addEventListener('input', function () { qidiruvMatni = q.value; royxatniChiz(); });
    panelEl.appendChild(q);
    panelRoyxatEl = e('div', undefined, 'yo-panel-royxat');
    panelEl.appendChild(panelRoyxatEl);
    royxatniChiz();
    panelRoyxatEl.scrollTop = ichki;
    // Maketda "Orqaga" tugmasi yo'q (tepa: menyu, nom, yangi chat), shuning uchun chatdan chiqish yo'li panelning pastida
    var chiq = e('button', undefined, 'yo-panel-chiq'); chiq.type = 'button'; chiq.id = 'yordamchi-orqaga'; chiq.setAttribute('aria-label', 'Yordamchidan chiqish');
    chiq.appendChild(svg('0 0 24 24', ORQAGA_SVG)); chiq.appendChild(e('span', 'Ilovaga qaytish'));
    chiq.addEventListener('click', function () { yop(); });
    panelEl.appendChild(chiq);
  }
  function royxatniChiz() {
    if (!panelRoyxatEl) return;
    panelRoyxatEl.textContent = '';
    var t = hozir(), guruhlar = ChatSof.guruhla(saqlangan, t, qidiruvMatni);
    if (!guruhlar.length) { panelRoyxatEl.appendChild(e('p', saqlangan.length ? 'Hech narsa topilmadi' : 'Hali suhbatlar yo\'q', 'yo-panel-bosh')); return; }
    guruhlar.forEach(function (g) {
      var sec = e('section', undefined, 'yo-guruh'); sec.setAttribute('aria-label', g.nom);
      sec.appendChild(e('h3', g.nom, 'yo-guruh-nom'));
      g.royxat.forEach(function (s) { sec.appendChild(qatorYasash(s, t)); });
      panelRoyxatEl.appendChild(sec);
    });
  }
  function qatorYasash(s, t) {
    var q = e('div', undefined, 'yo-qator' + (s === joriy ? ' joriy' : ''));
    if (tahrirId === s.id) {   // nomni shu qatorning o'zida tahrirlash
      q.classList.add('tahrirda');
      q.appendChild(tahrirMaydoni(s.nom, function (m) { nomniOzgartir(s.id, m); tahrirId = null; royxatniChiz(); }, function () { tahrirId = null; royxatniChiz(); }));
      return q;
    }
    var b = e('button', undefined, 'yo-qator-nom'); b.type = 'button'; b.setAttribute('aria-label', 'Suhbatni ochish: ' + s.nom);
    b.appendChild(e('span', s.nom, 'yo-qator-matn')); b.appendChild(e('span', ChatSof.qatorVaqti(s.yangilangan, t), 'yo-qator-vaqt'));
    b.addEventListener('click', function () { suhbatniOch(s.id); });
    q.appendChild(b);
    var u = tugmaYasa('yo-uch', 'Suhbat amallari: ' + s.nom, function (h) { h.stopPropagation(); menuId = menuId === s.id ? null : s.id; royxatniChiz(); });
    u.setAttribute('aria-haspopup', 'menu'); u.setAttribute('aria-expanded', menuId === s.id ? 'true' : 'false');
    u.appendChild(svg('0 0 24 24', UCH_SVG));
    q.appendChild(u);
    if (menuId === s.id) {
      var m = e('div', undefined, 'yo-menu'); m.setAttribute('role', 'menu');
      var a = e('button', 'Nomini o\'zgartirish', 'yo-menu-band'); a.type = 'button'; a.setAttribute('role', 'menuitem');
      a.addEventListener('click', function (h) { h.stopPropagation(); menuId = null; tahrirId = s.id; royxatniChiz(); });
      var o = e('button', 'O\'chirish', 'yo-menu-band yo-menu-ochirish'); o.type = 'button'; o.setAttribute('role', 'menuitem');
      o.addEventListener('click', function (h) { h.stopPropagation(); menuId = null; tasdiqId = s.id; tasdiqniChiz(); });
      m.appendChild(a); m.appendChild(o); q.appendChild(m);
      setTimeout(function () { try { a.focus(); } catch (x) { /* ahamiyatsiz */ } }, 0);
    }
    return q;
  }
  // O'chirishdan oldin tasdiq
  function tasdiqniChiz() {
    royxatniChiz();
    if (!panelEl) return;
    var eski = ekranEl.querySelector('.yo-tasdiq-fon'); if (eski) eski.parentNode.removeChild(eski);
    var s = saqlangan.filter(function (x) { return x.id === tasdiqId; })[0];
    if (!s) { tasdiqId = null; return; }
    var fon = e('div', undefined, 'yo-tasdiq-fon');
    var d = e('div', undefined, 'yo-tasdiq'); d.setAttribute('role', 'alertdialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', 'Suhbat o\'chirilsinmi?');
    d.appendChild(e('p', 'Suhbat o\'chirilsinmi?', 'yo-tasdiq-matn'));
    d.appendChild(e('p', s.nom, 'yo-tasdiq-nom'));
    var qator = e('div', undefined, 'yo-tasdiq-qator');
    var yoq = e('button', 'Bekor qilish', 'yo-tasdiq-tugma'); yoq.type = 'button';
    var ha = e('button', 'O\'chirish', 'yo-tasdiq-tugma yo-tasdiq-ha'); ha.type = 'button';
    function yop2() { tasdiqId = null; if (fon.parentNode) fon.parentNode.removeChild(fon); }
    yoq.addEventListener('click', yop2);
    ha.addEventListener('click', function () { var id = tasdiqId; yop2(); suhbatniOchir(id); royxatniChiz(); });
    fon.addEventListener('click', function (h) { if (h.target === fon) yop2(); });
    d.addEventListener('keydown', function (h) { if (h.key === 'Escape') { h.stopPropagation(); yop2(); } });
    qator.appendChild(yoq); qator.appendChild(ha); d.appendChild(qator); fon.appendChild(d);
    ekranEl.appendChild(fon);
    yoq.focus();
  }

  function ekranYasash() {
    var ek = e('div', undefined, 'yo-ekran');
    ek.setAttribute('role', 'dialog'); ek.setAttribute('aria-modal', 'true'); ek.setAttribute('aria-label', 'Yordamchi');
    var bosh = e('div', undefined, 'yo-bosh');
    menuTugma = tugmaYasa('yo-doira', 'Suhbatlar menyusi', function () { if (panelOchiq) panelniYop(); else panelniOch(); });
    menuTugma.appendChild(svg('0 0 24 24', MENU_SVG)); menuTugma.id = 'yordamchi-menyu';
    menuTugma.setAttribute('aria-haspopup', 'true'); menuTugma.setAttribute('aria-expanded', 'false');
    bosh.appendChild(menuTugma);
    var h1 = e('h1', undefined, 'yo-sarlavha'); sarlavhaEl = h1;
    bosh.appendChild(h1);
    var yangi = tugmaYasa('yo-doira', 'Yangi chat', yangiChat); yangi.appendChild(svg('0 0 24 24', YANGI_SVG)); yangi.id = 'yordamchi-yangi';
    bosh.appendChild(yangi);
    ek.appendChild(bosh);
    royxatEl = e('div', undefined, 'yo-royxat'); royxatEl.id = 'yordamchi-royxat'; royxatEl.setAttribute('aria-live', 'polite');
    ek.appendChild(royxatEl);
    var forma = e('form', undefined, 'yo-pastki');
    kirishEl = document.createElement('input');
    kirishEl.type = 'text'; kirishEl.id = 'yordamchi-kiritish'; kirishEl.className = 'yo-kiritish';
    kirishEl.maxLength = YordamchiSof.SAVOL_MAX; kirishEl.placeholder = 'Savolingizni yozing…';
    kirishEl.setAttribute('aria-label', 'Savolingizni yozing'); kirishEl.setAttribute('enterkeyhint', 'send'); kirishEl.autocomplete = 'off';
    forma.appendChild(kirishEl);
    yuborEl = tugmaYasa('yo-yubor', 'Yuborish', function () { /* forma submit qiladi */ }); yuborEl.type = 'submit'; yuborEl.id = 'yordamchi-yubor';
    yuborEl.appendChild(svg('0 0 24 24', YUBORISH_SVG));
    forma.appendChild(yuborEl);
    forma.addEventListener('submit', function (h) {
      h.preventDefault();
      if (band() || !kirishEl.value.trim()) return;
      var m = kirishEl.value; kirishEl.value = '';
      savolBer(m);
    });
    ek.appendChild(forma);
    // Yon panel: chapdan ochiladi (eni ~78%), o'ng tomoni xira fon (bosilsa yopiladi)
    fonEl = e('div', undefined, 'yo-panel-fon'); fonEl.addEventListener('click', function () { panelniYop(); });
    panelEl = e('aside', undefined, 'yo-panel'); panelEl.setAttribute('aria-label', 'Suhbatlar tarixi'); panelEl.setAttribute('aria-hidden', 'true');
    panelEl.addEventListener('click', function () { if (menuId) { menuId = null; royxatniChiz(); } });
    ek.appendChild(fonEl); ek.appendChild(panelEl);
    panelniChiz();
    return ek;
  }

  // Klaviatura ochilganda ekran ko'rinadigan oynaga moslashadi (iPhone)
  function oynaniMoslash() {
    var v = window.visualViewport;
    if (!ekranEl || !v) return;
    ekranEl.style.height = v.height + 'px';
    ekranEl.style.top = v.offsetTop + 'px';
  }
  function tugmaBosildi(h) {
    if (h.key !== 'Escape' || !ekranEl) return;
    if (tasdiqId || menuId) { tasdiqId = null; menuId = null; var t = ekranEl.querySelector('.yo-tasdiq-fon'); if (t) t.parentNode.removeChild(t); royxatniChiz(); return; }
    if (tahrirId) { tahrirId = null; royxatniChiz(); return; }
    if (panelOchiq) { panelniYop(); return; }
    if (tahrirNomi) { tahrirNomi = false; sarlavhaniChiz(); return; }
    yop();
  }
  // Telefonning "orqaga" tugmasi (Android) chatni yopadi, ilovadan chiqarib yubormaydi: chat ochilganda bitta tarix yozuvi qo'shiladi
  var tarixBor = false;
  function orqagaBosildi() { if (ekranEl) yop(true); }

  function ochish() {
    if (ekranEl) return;
    ekranEl = ekranYasash();
    document.body.appendChild(ekranEl);
    document.body.style.overflow = 'hidden';
    if (window.visualViewport) { window.visualViewport.addEventListener('resize', oynaniMoslash); window.visualViewport.addEventListener('scroll', oynaniMoslash); }
    document.addEventListener('keydown', tugmaBosildi);
    window.addEventListener('resize', oynaKattaldi);
    try { history.pushState({ yordamchi: true }, ''); tarixBor = true; window.addEventListener('popstate', orqagaBosildi); } catch (x) { tarixBor = false; }
    yuklash();
    chiz();
    yangila();
  }
  function yop(tarixdan) {
    if (!ekranEl) return;
    window.removeEventListener('resize', oynaKattaldi);
    window.removeEventListener('popstate', orqagaBosildi);
    if (tarixBor) { tarixBor = false; if (tarixdan !== true && history.state && history.state.yordamchi) { try { history.back(); } catch (x) { /* ahamiyatsiz */ } } }
    if (window.visualViewport) { window.visualViewport.removeEventListener('resize', oynaniMoslash); window.visualViewport.removeEventListener('scroll', oynaniMoslash); }
    document.removeEventListener('keydown', tugmaBosildi);
    if (ekranEl.parentNode) ekranEl.parentNode.removeChild(ekranEl);
    ekranEl = royxatEl = kirishEl = yuborEl = menuTugma = sarlavhaEl = nomEl = panelEl = fonEl = panelRoyxatEl = null;
    panelOchiq = false; tahrirNomi = false; menuId = tahrirId = tasdiqId = null; qidiruvMatni = '';
    joriy = yangiBosh();   // chat qayta ochilsa bo'sh yangi chat ochiladi; suhbat tarixda qoladi
    document.body.style.overflow = '';
    yangila();
    if (tugmaEl && !tugmaEl.hidden) tugmaEl.focus();
  }

  // ui.js chaqiradi: malumot() — ilovaning joriy ma'lumoti, korinadi() — Asosiy sahifa ochiqmi, xabar(matn) — qisqa xabar
  function boshlash(o) {
    ui.malumot = o.malumot; ui.korinadi = o.korinadi; ui.xabar = o.xabar; ui.belgi = o.belgi; ui.ochish = o.ochish;
    var oldingiKirgan = dep.kirgan();
    if (typeof Kirish !== 'undefined' && Kirish.kuzat) {
      Kirish.kuzat(function (h) {
        // Chiqilsa (kirgan -> kirmagan) "yopiq" belgisi o'chadi; qayta kirilsa tugma yana ko'rinadi
        if (oldingiKirgan && !h.kirgan) { belginiOchir(); hammasiniTozala(); }   // chiqilsa saqlangan suhbatlar ham tozalanadi (umumiy qurilma xavfsizligi)
        oldingiKirgan = !!h.kirgan;
        if (!h.kirgan && ekranEl) yop();
        yangila();
      });
    }
    yangila();
  }

  return {
    boshlash: boshlash, yangila: yangila, sozla: sozla, ochish: ochish, yop: yop, tozala: tozala, savolBer: savolBer,
    javobOl: javobOl, chaqir: chaqir, korinishi: korinadimi, suhbat: function () { return joriy.xabarlar; }, xotira: suhbatXotirasi, joriy: function () { return joriy; }, saqlangan: function () { return saqlangan; },
    yangiChat: yangiChat, suhbatniOch: suhbatniOch, suhbatniOchir: suhbatniOchir, nomniOzgartir: nomniOzgartir, hammasiniTozala: hammasiniTozala, panelniOch: panelniOch, panelniYop: panelniYop, SUHBAT_KALIT: SUHBAT_KALIT, yopiqmi: yopiqmi, belginiOchir: belginiOchir,
    YOPIQ_KALIT: YOPIQ_KALIT, YOPIQ_XABARI: YOPIQ_XABARI
  };
})();
