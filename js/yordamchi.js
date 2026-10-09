// AI yordamchi (TZ-sinxronlash.md 24-band): suzuvchi "Ko'zlar" tugmasi, chat ekrani va server bilan aloqa.
// Oqim: savol -> funksiya "reja" -> tuzilgan so'rov -> ilova telefonda hisoblaydi (js/yordamchi-sof.js) -> funksiya "javob" -> matn.
// Suhbat faqat xotirada (o'zgaruvchida) turadi: bazaga, serverga, zaxiraga va localStorage ga yozilmaydi; ilova yopilsa o'chadi.
// Server funksiyasi (supabase/functions/yordamchi) bu yerda o'zgarmaydi. Sinxron mantig'iga tegilmaydi.
var Yordamchi = (function () {
  'use strict';

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
    xotira: function () { try { return localStorage; } catch (e) { return null; } }
  };
  function sozla(o) { Object.keys(o || {}).forEach(function (k) { dep[k] = o[k]; }); }

  var ui = { malumot: null, korinadi: null, xabar: null };
  var suhbat = [];      // [{ rol: 'savol' | 'javob' | 'kutish' | 'xato', matn, savol, kod, qayta }]  (faqat xotirada)
  var tugmaEl = null, ekranEl = null, royxatEl = null, kirishEl = null, yuborEl = null, tozalashEl = null;

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

  function yubor(tana, token) {
    return dep.fetch(dep.manzil() + FUNKSIYA_YOLI, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: dep.kalit(), Authorization: 'Bearer ' + token },
      body: JSON.stringify(tana)
    }).then(function (r) {
      return r.json().then(function (j) { return { holat: r.status, ok: r.ok, j: j }; }, function () { return { holat: r.status, ok: r.ok, j: null }; });
    }, function () { throw xato('NETWORK'); });
  }
  // Bitta so'rov. 401 bo'lsa token bir marta yangilanib qayta yuboriladi; shunda ham 401 bo'lsa kirish muddati tugagan.
  function chaqir(tana) {
    function tokenBilan(qayta) {
      return (qayta ? dep.tokenYangila() : dep.tokenOl()).then(function (t) {
        if (!t) throw xato('AUTH_EXPIRED');
        return yubor(tana, t);
      }, function (e) { if (e && e.kod) throw e; throw xato('NETWORK'); }).then(function (r) {
        if (r.holat === 401) { if (!qayta) return tokenBilan(true); throw xato('AUTH_EXPIRED', 401); }
        if (r.ok && r.j && r.j.ok === true) return r.j;
        var kod = r.j && r.j.xato && typeof r.j.xato.kod === 'string' ? r.j.xato.kod : '';
        if (r.holat === 403 && kod === 'AI_RUXSAT') { yopiqQil(); throw xato('AI_RUXSAT', 403); }
        throw xato(kod || ('HTTP_' + r.holat), r.holat);
      });
    }
    return tokenBilan(false);
  }

  // Savolga javob: Promise -> { matn, tushunarsiz }  yoki rad (Error.kod)
  function javobOl(savol, malumot, bugunSana) {
    if (!dep.onlayn()) return Promise.reject(xato('NETWORK_OFFLINE'));   // internet yo'q: serverga so'rov ketmaydi
    var n = YordamchiSof.nomlar(malumot);
    return chaqir({ rejim: 'reja', savol: savol, bugun: bugunSana, kategoriyalar: n.kategoriyalar, hisoblar: n.hisoblar }).then(function (j) {
      var sorov = j.sorov;
      if (!sorov || typeof sorov !== 'object') throw xato('AI_SXEMA');
      if (sorov.amal === 'tushunarsiz') return { matn: YordamchiSof.TUSHUNARSIZ_MATNI, tushunarsiz: true };   // ikkinchi so'rov yuborilmaydi
      var natija = YordamchiSof.hisobla(sorov, malumot, bugunSana);
      if (!natija || !YordamchiSof.natijaYuborsaBoladimi(natija)) throw xato('JS_NATIJA');
      return chaqir({ rejim: 'javob', savol: savol, sorov: sorov, natija: natija }).then(function (j2) {
        if (typeof j2.matn !== 'string' || !j2.matn) throw xato('AI_SXEMA');
        return { matn: j2.matn };
      });
    });
  }

  // ---- Suhbat ----
  function sanasi() { return Calc.bugun(); }
  function band() { return suhbat.some(function (x) { return x.rol === 'kutish'; }); }

  function natijaniQoy(kutish, p) {
    p.then(function (r) { return { rol: 'javob', matn: r.matn }; }, function (e) {
      var kod = (e && e.kod) || ('JS_' + String((e && e.name) || 'XATO').replace(/[^A-Za-z0-9]/g, '').toUpperCase());
      return { rol: 'xato', matn: YordamchiSof.xatoMatni(kod), savol: kutish.savol, kod: kod, qayta: YordamchiSof.xatoQaytaMi(kod), yopiq: kod === 'AI_RUXSAT' && yopiqmi() };
    }).then(function (yangi) {
      var i = suhbat.indexOf(kutish);
      if (i < 0) return;   // suhbat tozalangan: eski javob ko'rsatilmaydi
      if (yangi.yopiq) {   // 403: xabar chiqadi, suhbat yopiladi va tugma yashiriladi
        suhbat = []; yop(); if (ui.xabar) ui.xabar(YOPIQ_XABARI); yangila(); return;
      }
      suhbat[i] = yangi;
      chiz();
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
    suhbat.push({ rol: 'savol', matn: savol });
    var b = boshlaSavol(savol);
    suhbat.push(b.kutish);
    chiz();
    natijaniQoy(b.kutish, b.p);
  }
  function qaytaUrin(xatoXabar) {
    var i = suhbat.indexOf(xatoXabar);
    if (i < 0 || band()) return;
    var b = boshlaSavol(xatoXabar.savol);
    suhbat[i] = b.kutish;
    chiz();
    natijaniQoy(b.kutish, b.p);
  }
  function tozala() { suhbat = []; chiz(); }

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
  var TOZALASH_SVG = '<path ' + CHIZIQLI + ' d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>';
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
  }

  function nuqtalar() {
    var k = e('div', undefined, 'yo-javob yo-kutish'); k.setAttribute('role', 'status'); k.setAttribute('aria-label', 'Yordamchi o\'ylayapti');
    for (var i = 0; i < 3; i++) k.appendChild(e('span', undefined, 'yo-nuqta'));
    return k;
  }
  function bosHolat() {
    var q = e('div', undefined, 'yo-bosh-holat');
    q.appendChild(e('p', 'Faqat sizning yozuvlaringizdan javob beradi', 'yo-izoh'));
    var r = e('div', undefined, 'yo-tayyorlar');
    YordamchiSof.tayyorSavollar(sanasi()).forEach(function (s) { r.appendChild(Object.assign(e('button', s, 'yo-tayyor'), { type: 'button', onclick: function () { savolBer(s); } })); });
    q.appendChild(r);
    return q;
  }
  function chiz() {
    if (!royxatEl) return;
    var ichki = royxatEl.scrollTop;
    royxatEl.textContent = '';
    if (!suhbat.length) royxatEl.appendChild(bosHolat());
    suhbat.forEach(function (x) {
      if (x.rol === 'savol') royxatEl.appendChild(e('div', x.matn, 'yo-savol'));
      else if (x.rol === 'kutish') royxatEl.appendChild(nuqtalar());
      else {
        var k = e('div', x.matn, 'yo-javob' + (x.rol === 'xato' ? ' yo-xato' : ''));
        if (x.rol === 'xato') {
          k.setAttribute('role', 'alert');
          if (x.qayta) { var q = e('button', 'Qayta urinish', 'yo-qayta'); q.type = 'button'; q.addEventListener('click', function () { qaytaUrin(x); }); k.appendChild(q); }
        }
        royxatEl.appendChild(k);
      }
    });
    royxatEl.scrollTop = suhbat.length ? royxatEl.scrollHeight : ichki;
    var kutmoqda = band();
    if (yuborEl) yuborEl.disabled = kutmoqda;
    if (tozalashEl) tozalashEl.disabled = !suhbat.length;
  }

  function ekranYasash() {
    var ek = e('div', undefined, 'yo-ekran');
    ek.setAttribute('role', 'dialog'); ek.setAttribute('aria-modal', 'true'); ek.setAttribute('aria-label', 'Yordamchi');
    var bosh = e('div', undefined, 'yo-bosh');
    var orqa = tugmaYasa('yo-doira', 'Orqaga', yop); orqa.appendChild(svg('0 0 24 24', ORQAGA_SVG)); orqa.id = 'yordamchi-orqaga';
    bosh.appendChild(orqa);
    bosh.appendChild(e('h1', 'Yordamchi'));
    tozalashEl = tugmaYasa('yo-doira', 'Suhbatni tozalash', tozala); tozalashEl.appendChild(svg('0 0 24 24', TOZALASH_SVG)); tozalashEl.id = 'yordamchi-tozalash';
    bosh.appendChild(tozalashEl);
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
    return ek;
  }

  // Klaviatura ochilganda ekran ko'rinadigan oynaga moslashadi (iPhone)
  function oynaniMoslash() {
    var v = window.visualViewport;
    if (!ekranEl || !v) return;
    ekranEl.style.height = v.height + 'px';
    ekranEl.style.top = v.offsetTop + 'px';
  }
  function tugmaBosildi(h) { if (h.key === 'Escape' && ekranEl) yop(); }

  function ochish() {
    if (ekranEl) return;
    ekranEl = ekranYasash();
    document.body.appendChild(ekranEl);
    document.body.style.overflow = 'hidden';
    if (window.visualViewport) { window.visualViewport.addEventListener('resize', oynaniMoslash); window.visualViewport.addEventListener('scroll', oynaniMoslash); }
    document.addEventListener('keydown', tugmaBosildi);
    chiz();
    yangila();
  }
  function yop() {
    if (!ekranEl) return;
    if (window.visualViewport) { window.visualViewport.removeEventListener('resize', oynaniMoslash); window.visualViewport.removeEventListener('scroll', oynaniMoslash); }
    document.removeEventListener('keydown', tugmaBosildi);
    if (ekranEl.parentNode) ekranEl.parentNode.removeChild(ekranEl);
    ekranEl = royxatEl = kirishEl = yuborEl = tozalashEl = null;
    document.body.style.overflow = '';
    yangila();
    if (tugmaEl && !tugmaEl.hidden) tugmaEl.focus();
  }

  // ui.js chaqiradi: malumot() — ilovaning joriy ma'lumoti, korinadi() — Asosiy sahifa ochiqmi, xabar(matn) — qisqa xabar
  function boshlash(o) {
    ui.malumot = o.malumot; ui.korinadi = o.korinadi; ui.xabar = o.xabar;
    var oldingiKirgan = dep.kirgan();
    if (typeof Kirish !== 'undefined' && Kirish.kuzat) {
      Kirish.kuzat(function (h) {
        // Chiqilsa (kirgan -> kirmagan) "yopiq" belgisi o'chadi; qayta kirilsa tugma yana ko'rinadi
        if (oldingiKirgan && !h.kirgan) belginiOchir();
        oldingiKirgan = !!h.kirgan;
        if (!h.kirgan && ekranEl) { suhbat = []; yop(); }
        yangila();
      });
    }
    yangila();
  }

  return {
    boshlash: boshlash, yangila: yangila, sozla: sozla, ochish: ochish, yop: yop, tozala: tozala, savolBer: savolBer,
    javobOl: javobOl, suhbat: function () { return suhbat; }, yopiqmi: yopiqmi, belginiOchir: belginiOchir,
    YOPIQ_KALIT: YOPIQ_KALIT, YOPIQ_XABARI: YOPIQ_XABARI
  };
})();
