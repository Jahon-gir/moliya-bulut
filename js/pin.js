// PIN-kod bilan himoya (TZ F11). 4 raqamli PIN; ochiq holda SAQLANMAYDI: tuz (salt) bilan PBKDF2-SHA-256 (Web Crypto) xeshi saqlanadi.
// PIN yozuvi IndexedDB ning `sozlamalar` to'plamida alohida kalit ("pin") bilan turadi: zaxira fayliga kirmaydi, tiklash uni o'chirmaydi.
// Fayl ikki qismdan iborat: (1) sof mantiq (DOM'siz, tests.html da sinaladi), (2) ekranlar (qulf ekrani, PINni sozlash, "PINni unutdim").
var Pin = (function () {
  'use strict';

  var UZUNLIK = 4;              // PIN raqamlari soni
  var ITERATSIYA = 100000;      // PBKDF2 aylanishlari (qo'pol kuch bilan topishni sekinlashtiradi)
  var URINISH_CHEGARASI = 5;    // shuncha noto'g'ri kiritishdan keyin...
  var KUTISH_MS = 30000;        // ...30 soniya kutish
  var FON_CHEGARASI_MS = 60000; // fondan shundan keyin qaytilsa, PIN qayta so'raladi
  var KALIT = 'pin';
  var BAYROQ = 'moliya-pin-bor';

  // ---------------- 1) Sof mantiq ----------------
  function formatTogrimi(p) { return typeof p === 'string' && /^\d{4}$/.test(p); }

  function hex(bayt) { return Array.prototype.map.call(new Uint8Array(bayt), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function bayt(hexMatn) { var a = new Uint8Array(hexMatn.length / 2); for (var i = 0; i < a.length; i++) a[i] = parseInt(hexMatn.substr(i * 2, 2), 16); return a; }
  function tasodifiyTuz() { var a = new Uint8Array(16); crypto.getRandomValues(a); return hex(a); }

  // PBKDF2-HMAC-SHA-256 (Web Crypto): PIN + tuz -> 256 bit xesh (hex)
  function xeshlash(pin, tuzHex, iteratsiya) {
    return crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']).then(function (kalit) {
      return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: bayt(tuzHex), iterations: iteratsiya || ITERATSIYA }, kalit, 256);
    }).then(hex);
  }

  function yangiYozuv(pin) {
    var tuz = tasodifiyTuz();
    return xeshlash(pin, tuz, ITERATSIYA).then(function (x) { return { kalit: KALIT, tuz: tuz, xesh: x, iteratsiya: ITERATSIYA, xato: 0, bloklash_gacha: 0 }; });
  }

  function tengMatn(a, b) { if (a.length !== b.length) return false; var f = 0; for (var i = 0; i < a.length; i++) f |= a.charCodeAt(i) ^ b.charCodeAt(i); return f === 0; }   // vaqt bo'yicha bir xil
  function tekshir(pin, yozuv) {
    if (!formatTogrimi(pin) || !yozuv || !yozuv.xesh) return Promise.resolve(false);
    return xeshlash(pin, yozuv.tuz, yozuv.iteratsiya).then(function (x) { return tengMatn(x, yozuv.xesh); });
  }

  // Kutish: hozir yana qancha ms bloklangan (0 — bloklanmagan)
  function qolganKutish(yozuv, hozir) { var q = (yozuv && yozuv.bloklash_gacha || 0) - hozir; return q > 0 ? q : 0; }
  // Urinish natijasi: to'g'ri bo'lsa hisoblagich nolga; noto'g'ri bo'lsa +1, 5 ga yetsa 30 soniya bloklanadi (hisoblagich nolga qaytadi)
  function urinishdan(yozuv, togri, hozir) {
    var y = Object.assign({}, yozuv);
    if (togri) { y.xato = 0; y.bloklash_gacha = 0; return y; }
    y.xato = (y.xato || 0) + 1;
    if (y.xato >= URINISH_CHEGARASI) { y.xato = 0; y.bloklash_gacha = hozir + KUTISH_MS; }
    return y;
  }
  function qolganUrinish(yozuv) { return URINISH_CHEGARASI - ((yozuv && yozuv.xato) || 0); }
  function qaytaQulflash(yashirinVaqt, hozir) { return typeof yashirinVaqt === 'number' && hozir - yashirinVaqt >= FON_CHEGARASI_MS; }

  // ---------------- 2) Holat va saqlash ----------------
  var yozuv = null;      // joriy PIN yozuvi (null — PIN yoqilmagan)
  var qulfda = false;
  var yashirinVaqt = null;
  var kuzatuvOrnatilgan = false;

  function bayroqYoz(bor) {
    try { if (bor) localStorage.setItem(BAYROQ, '1'); else localStorage.removeItem(BAYROQ); } catch (e) { /* ahamiyatsiz */ }
    document.documentElement.classList.toggle('pin-qulf', !!bor && qulfda);
  }
  function yozuvniSaqla(y) { return Data.saqlash('sozlamalar', y).then(function () { yozuv = y; }); }
  function yoqilgan() { return !!yozuv; }

  // ---------------- 3) Ekranlar ----------------
  function el(teg, matn, klass) { var e = document.createElement(teg); if (matn !== undefined) e.textContent = matn; if (klass) e.className = klass; return e; }
  function tugma(matn, klass, bosilganda) { var b = el('button', matn, klass); b.type = 'button'; if (bosilganda) b.addEventListener('click', bosilganda); return b; }

  var ochiqEkran = null;   // { qism, yop }

  function orqaHolatni(qulflash) {
    // ilovaning qolgan qismi PIN ekrani ustida emas, ostida: ekran o'qigichlar va Tab uni ko'rmasin
    ['ekran'].forEach(function (id) { var e = document.getElementById(id); if (e) { if (qulflash) e.setAttribute('inert', ''); else e.removeAttribute('inert'); } });
    var nav = document.querySelector('.pastki'); if (nav) { if (qulflash) nav.setAttribute('inert', ''); else nav.removeAttribute('inert'); }
  }

  // PIN kiritish paneli: sarlavha, 4 nuqta, raqam tugmalari. opts: { sarlavha, izoh, pastki: [tugmalar], toliq(pin) }
  function ekranYasash(opts) {
    var parda = el('div', undefined, 'pin-ekran');
    parda.id = 'pin-ekran';
    parda.setAttribute('role', 'dialog');
    parda.setAttribute('aria-modal', 'true');
    parda.setAttribute('aria-labelledby', 'pin-sarlavha');
    var ichki = el('div', undefined, 'pin-ichki');
    parda.appendChild(ichki);
    var qism = { parda: parda, ichki: ichki, kiritilgan: '', band: false };

    qism.korsat = function (o) {
      ichki.textContent = '';
      qism.kiritilgan = '';
      qism.opts = o;
      var s = el('h1', o.sarlavha, 'pin-sarlavha'); s.id = 'pin-sarlavha'; ichki.appendChild(s);
      ichki.appendChild(el('p', o.izoh || '', 'pin-izoh'));
      var nuq = el('div', undefined, 'pin-nuqtalar'); nuq.setAttribute('role', 'img'); nuq.id = 'pin-nuqtalar';
      for (var i = 0; i < UZUNLIK; i++) nuq.appendChild(el('span', undefined, 'pin-nuqta'));
      ichki.appendChild(nuq);
      var xato = el('p', '', 'pin-xato'); xato.id = 'pin-xato'; xato.setAttribute('role', 'alert'); ichki.appendChild(xato);
      var tarmoq = el('div', undefined, 'pin-tugmalar'); tarmoq.id = 'pin-tugmalar';
      [1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, 'o'].forEach(function (k) {
        if (k === '') { tarmoq.appendChild(el('span')); return; }
        var b;
        if (k === 'o') { b = tugma(undefined, 'pin-raqam pin-ochirish', function () { qism.ochir(); }); b.setAttribute('aria-label', 'Oxirgi raqamni o\'chirish'); b.appendChild(ochirishBelgisi()); }
        else { b = tugma(String(k), 'pin-raqam', function () { qism.raqam(String(k)); }); b.setAttribute('aria-label', String(k)); }
        tarmoq.appendChild(b);
      });
      ichki.appendChild(tarmoq);
      var past = el('div', undefined, 'pin-past');
      (o.pastki || []).forEach(function (b) { past.appendChild(b); });
      ichki.appendChild(past);
      qism.nuqtalar();
    };
    qism.nuqtalar = function () {
      var nuq = ichki.querySelector('#pin-nuqtalar'); if (!nuq) return;
      Array.prototype.forEach.call(nuq.children, function (n, i) { n.classList.toggle('to-ldi', i < qism.kiritilgan.length); });
      nuq.setAttribute('aria-label', 'Kiritilgan raqamlar: ' + qism.kiritilgan.length + ' / ' + UZUNLIK);
    };
    qism.xato = function (m) { var x = ichki.querySelector('#pin-xato'); if (x) x.textContent = m || ''; };
    qism.tozalash = function () { qism.kiritilgan = ''; qism.nuqtalar(); };
    qism.bloklash = function (ha) { Array.prototype.forEach.call(ichki.querySelectorAll('.pin-raqam'), function (b) { b.disabled = !!ha; }); qism.band = !!ha; };
    qism.raqam = function (r) {
      if (qism.band || qism.kiritilgan.length >= UZUNLIK || !qism.opts || !qism.opts.toliq) return;
      qism.kiritilgan += r; qism.xato(''); qism.nuqtalar();
      if (qism.kiritilgan.length === UZUNLIK) {
        var pin = qism.kiritilgan;
        qism.band = true;
        Promise.resolve(qism.opts.toliq(pin)).then(function () { qism.band = false; }, function () { qism.band = false; });
      }
    };
    qism.ochir = function () { if (qism.band) return; qism.kiritilgan = qism.kiritilgan.slice(0, -1); qism.nuqtalar(); };
    qism.klaviatura = function (e) {
      if (!qism.opts || !qism.opts.toliq) return;
      if (/^\d$/.test(e.key)) { e.preventDefault(); qism.raqam(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); qism.ochir(); }
    };
    document.addEventListener('keydown', qism.klaviatura);
    qism.yop = function () { document.removeEventListener('keydown', qism.klaviatura); if (parda.parentNode) parda.parentNode.removeChild(parda); if (ochiqEkran === qism) ochiqEkran = null; };
    qism.fokus = function () { var b = ichki.querySelector('.pin-raqam'); if (b) b.focus(); };
    return qism;
  }

  function ochirishBelgisi() {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('width', '26'); s.setAttribute('height', '26');
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', 'M9 5h11v14H9L3 12l6-7zM12 9l5 6M17 9l-5 6');
    s.appendChild(p);
    return s;
  }

  function ekranQo(qism) {
    if (ochiqEkran) ochiqEkran.yop();
    ochiqEkran = qism;
    document.body.appendChild(qism.parda);
  }

  // Bloklash soati: kutish tugaguncha sanaydi
  function kutishSoati(qism, y) {
    var id = null;
    function yangila() {
      var q = qolganKutish(y, Date.now());
      if (q <= 0) { clearInterval(id); qism.bloklash(false); qism.xato(''); return; }
      qism.xato('Juda ko\'p noto\'g\'ri urinish. ' + Math.ceil(q / 1000) + ' soniyadan keyin qayta urinib ko\'ring.');
    }
    qism.bloklash(true);
    yangila();
    id = setInterval(yangila, 500);
    var eskiYop = qism.yop;
    qism.yop = function () { clearInterval(id); eskiYop(); };
  }

  // PINni tekshirish (qulf ekrani va "joriy PIN" bosqichlari uchun umumiy): urinishlar hisoblanadi va saqlanadi
  function tasdiqlash(pin, qism, togriBulsa) {
    var hozir = Date.now();
    if (qolganKutish(yozuv, hozir) > 0) { kutishSoati(qism, yozuv); qism.tozalash(); return Promise.resolve(); }
    return tekshir(pin, yozuv).then(function (togri) {
      var yangi = urinishdan(yozuv, togri, Date.now());
      return yozuvniSaqla(yangi).then(function () {
        if (togri) return togriBulsa();
        qism.tozalash();
        if (qolganKutish(yozuv, Date.now()) > 0) { kutishSoati(qism, yozuv); }
        else qism.xato('PIN noto\'g\'ri. Qolgan urinish: ' + qolganUrinish(yozuv));
      });
    }).catch(function (x) { qism.tozalash(); qism.xato('Tekshirib bo\'lmadi: ' + (x && x.message ? x.message : x)); });
  }

  // ---- Qulf ekrani ----
  function qulfEkrani() {
    return new Promise(function (resolve) {
      qulfda = true;
      document.documentElement.classList.add('pin-qulf');
      orqaHolatni(true);
      var qism = ekranYasash({});
      ekranQo(qism);
      function asosiy() {
        var unut = tugma('PINni unutdim', 'pin-matn-tugma', function () { unutdim1(); });
        unut.id = 'pin-unutdim';
        qism.korsat({
          sarlavha: ILOVA.nom, izoh: 'PIN-kodni kiriting', pastki: [unut],
          toliq: function (pin) { return tasdiqlash(pin, qism, function () { ochish(); }); }
        });
        if (qolganKutish(yozuv, Date.now()) > 0) kutishSoati(qism, yozuv);
        qism.fokus();
      }
      function ochish() {
        qulfda = false;
        qism.yop();
        orqaHolatni(false);
        document.documentElement.classList.remove('pin-qulf');
        resolve();
      }
      function unutdim1() {
        var bekor = tugma('Bekor qilish', 'pin-ikkinchi', function () { asosiy(); }), davom = tugma('Davom etish', 'pin-asosiy', function () { unutdim2(); });
        ogohlantirish(qism, 'PINni unutdingizmi?', [
          'PIN-kodni tiklab bo\'lmaydi. Davom etsangiz, ilovadagi BARCHA ma\'lumot (yozuvlar, hisoblar, qarzlar, byudjet) shu qurilmadan o\'chiriladi.',
          'Agar Google bilan kirib sinxronlash yoqilgan bo\'lsa, qayta kirganingizda ma\'lumot serverdan qaytadi. Aks holda ma\'lumotni qaytarib bo\'lmaydi.'
        ], [bekor, davom], '1 / 2');
        davom.id = 'pin-unutdim-1';
      }
      function unutdim2() {
        var bekor = tugma('Bekor qilish', 'pin-ikkinchi', function () { asosiy(); }), ochir = tugma('Hammasini o\'chirish', 'pin-xavfli', function () { tozalash(ochir, bekor); });
        ogohlantirish(qism, 'Ishonchingiz komilmi?', ['Bu amalni qaytarib bo\'lmaydi. Hamma ma\'lumot o\'chiriladi va ilova bo\'sh holatda qayta ochiladi.'], [bekor, ochir], '2 / 2');
        ochir.id = 'pin-unutdim-2';
      }
      function tozalash(ochir, bekor) {
        ochir.disabled = true; bekor.disabled = true; ochir.textContent = 'O\'chirilmoqda…';
        hammasiniOchirish().then(function () { location.reload(); }, function (x) {
          ochir.disabled = false; bekor.disabled = false; ochir.textContent = 'Hammasini o\'chirish';
          qism.xato('O\'chirib bo\'lmadi: ' + (x && x.message ? x.message : x));
        });
      }
      asosiy();
    });
  }

  // "PINni unutdim": ogohlantirish matni va tugmalar (PIN panelining o'rniga)
  function ogohlantirish(qism, sarlavha, abzaslar, tugmalar, qadam) {
    var ichki = qism.ichki;
    qism.opts = {};   // bu bosqichda raqam kiritilmaydi
    ichki.textContent = '';
    ichki.appendChild(el('p', 'Qadam ' + qadam, 'pin-izoh'));
    var s = el('h1', sarlavha, 'pin-sarlavha'); s.id = 'pin-sarlavha';
    ichki.appendChild(s);
    abzaslar.forEach(function (a) { ichki.appendChild(el('p', a, 'pin-ogoh')); });
    var xato = el('p', '', 'pin-xato'); xato.id = 'pin-xato'; xato.setAttribute('role', 'alert'); ichki.appendChild(xato);
    var past = el('div', undefined, 'pin-juft'); tugmalar.forEach(function (b) { past.appendChild(b); }); ichki.appendChild(past);
    tugmalar[0].focus();
  }

  // Butun ma'lumotni va PIN ni o'chirish (bazani o'chiradi; qurilmadagi ilova sozlamalari ham tozalanadi)
  function hammasiniOchirish() {
    return Data.bazaniOchirish().then(function () {
      try { Object.keys(localStorage).filter(function (k) { return k.indexOf('moliya-') === 0; }).forEach(function (k) { localStorage.removeItem(k); }); } catch (e) { /* ahamiyatsiz */ }
      try { sessionStorage.clear(); } catch (e) { /* ahamiyatsiz */ }
      yozuv = null;
    });
  }

  // ---- PINni sozlash: yoqish / o'zgartirish / o'chirish (Ko'proq → PIN-kod). Natija: Promise<true|false> ----
  function sozlash(rejim) {
    return new Promise(function (resolve) {
      var qism = ekranYasash({});
      ekranQo(qism);
      orqaHolatni(true);
      var tugadi = false;
      function yop(natija) { if (tugadi) return; tugadi = true; qism.yop(); orqaHolatni(false); resolve(natija); }
      function bekorTugma() { return tugma('Bekor qilish', 'pin-matn-tugma', function () { yop(false); }); }
      function joriy(keyingi, sarlavha) {
        qism.korsat({ sarlavha: sarlavha, izoh: 'Joriy PIN-kodni kiriting', pastki: [bekorTugma()], toliq: function (pin) { return tasdiqlash(pin, qism, keyingi); } });
        if (qolganKutish(yozuv, Date.now()) > 0) kutishSoati(qism, yozuv);
        qism.fokus();
      }
      function yangi(sarlavha) {
        qism.korsat({ sarlavha: sarlavha, izoh: 'Yangi 4 raqamli PIN-kodni kiriting', pastki: [bekorTugma()], toliq: function (pin) { takror(sarlavha, pin); return Promise.resolve(); } });
        qism.fokus();
      }
      function takror(sarlavha, birinchi) {
        qism.korsat({ sarlavha: sarlavha, izoh: 'PIN-kodni takrorlang', pastki: [bekorTugma()], toliq: function (pin) {
          if (pin !== birinchi) { yangi(sarlavha); qism.xato('PIN-kodlar mos kelmadi. Qaytadan kiriting.'); return Promise.resolve(); }
          return yangiYozuv(pin).then(yozuvniSaqla).then(function () { bayroqYoz(true); yop(true); }).catch(function (x) { qism.tozalash(); qism.xato('Saqlab bo\'lmadi: ' + (x && x.message ? x.message : x)); });
        } });
        qism.fokus();
      }
      if (rejim === 'yoqish') yangi('PIN-kodni yoqish');
      else if (rejim === 'ozgartirish') joriy(function () { yangi('PIN-kodni o\'zgartirish'); }, 'PIN-kodni o\'zgartirish');
      else joriy(function () { return Data.ochirish('sozlamalar', KALIT).then(function () { yozuv = null; bayroqYoz(false); yop(true); }); }, 'PIN-kodni o\'chirish');
    });
  }

  // ---- Ilova ochilganda ----
  function kuzatuv() {
    if (kuzatuvOrnatilgan) return;
    kuzatuvOrnatilgan = true;
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') { yashirinVaqt = Date.now(); return; }
      if (yozuv && !qulfda && qaytaQulflash(yashirinVaqt, Date.now())) { yashirinVaqt = null; if (ochiqEkran) ochiqEkran.yop(); qulfEkrani(); }
    });
  }

  // Natija: PIN yoqilmagan bo'lsa darhol, yoqilgan bo'lsa to'g'ri PIN kiritilgandan keyin bajariladigan Promise
  function boshlash() {
    kuzatuv();
    return Data.olish('sozlamalar', KALIT).then(function (y) {
      yozuv = y && y.xesh ? y : null;
      if (!yozuv) { qulfda = false; bayroqYoz(false); return; }
      try { localStorage.setItem(BAYROQ, '1'); } catch (e) { /* ahamiyatsiz */ }
      return qulfEkrani();
    });
  }

  return {
    UZUNLIK: UZUNLIK, ITERATSIYA: ITERATSIYA, URINISH_CHEGARASI: URINISH_CHEGARASI, KUTISH_MS: KUTISH_MS, FON_CHEGARASI_MS: FON_CHEGARASI_MS,
    formatTogrimi: formatTogrimi, xeshlash: xeshlash, yangiYozuv: yangiYozuv, tekshir: tekshir, qolganKutish: qolganKutish, urinishdan: urinishdan, qolganUrinish: qolganUrinish, qaytaQulflash: qaytaQulflash,
    boshlash: boshlash, yoqilgan: yoqilgan, sozlash: sozlash, hammasiniOchirish: hammasiniOchirish
  };
})();
