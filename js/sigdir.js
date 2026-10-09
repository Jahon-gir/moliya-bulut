// Raqamlar kartadan chiqib ketmasligi uchun (fit-text). DOM kerak, lekin hisob-kitobga tegmaydi.
// Element: bitta qatorli (white-space: nowrap), kengligi qutiga bog'liq (display: block; overflow: hidden) va class="sig".
// 1) Sig'masa shrift 1 pikseldan kichraytiriladi (eng kichigi MIN_SHRIFT);
// 2) eng kichik shriftda ham sig'masa, matn qisqa ko'rinishga almashadi ("10,8 mln"): data-qiymat (butun son) kerak.
// Asl matn data-toli da saqlanadi, shuning uchun qayta o'lchash (masalan ekran kengligi o'zgarsa) hamisha asl holatdan boshlanadi.
var Sigdir = (function () {
  'use strict';

  var MIN_SHRIFT = 11;

  function sigadimi(e) { return e.scrollWidth <= e.clientWidth + 0.5; }

  // Natija: 'asl' (o'zgarmadi) | 'kichik' (shrift kichraydi) | 'qisqa' (qisqa ko'rinishga o'tdi) | 'yashirin' (element ko'rinmaydi, o'lchab bo'lmaydi)
  function sigdir(e) {
    var toli = e.getAttribute('data-toli');
    if (toli === null) { toli = e.textContent; e.setAttribute('data-toli', toli); }
    e.textContent = toli;
    e.style.fontSize = '';
    e.removeAttribute('data-qisqa');
    if (e.clientWidth === 0) return 'yashirin';
    if (sigadimi(e)) return 'asl';
    var s = parseFloat(window.getComputedStyle(e).fontSize) || 16;
    while (s > MIN_SHRIFT && !sigadimi(e)) { s -= 1; e.style.fontSize = s + 'px'; }
    if (sigadimi(e)) return 'kichik';
    var q = e.getAttribute('data-qiymat');
    if (q !== null && q !== '' && isFinite(Number(q))) {
      var n = Number(q);
      e.textContent = (e.getAttribute('data-plyus') === '1' && n > 0 ? '+' : '') + Calc.qisqaSum(n);
      e.setAttribute('data-qisqa', '1');
      return 'qisqa';
    }
    return 'kichik';
  }

  // Kun sarlavhasi (TZ 22.4): chapda sana (.kun-sana, hech qachon siqilmaydi) va kichik qator (.kun-hafta), o'ngda xarajat/daromad belgilari (.pill, data-qiymat).
  // Joy yetsa belgilar TO'LIQ raqamda; yetmasa ikkalasi birga qisqa ko'rinishga ("−2,75 mln") o'tadi; shunda ham sig'masa chapdagi kichik qator qisqaradi (…).
  // Tuzilma: .kun-sarlavha > .kun-chap (> .kun-sana, .kun-hafta) + .pill-quti (> .pill-ich > .pill*). Natija: 'asl' | 'qisqa' | 'yashirin'
  function kunQatori(qator) {
    var chap = qator.querySelector('.kun-chap'), sana = qator.querySelector('.kun-sana'), quti = qator.querySelector('.pill-quti'), ich = qator.querySelector('.pill-ich');
    if (!chap || !sana || !quti || !ich) return 'asl';
    var pillar = ich.querySelectorAll('.pill'), i;
    for (i = 0; i < pillar.length; i++) {
      var toli = pillar[i].getAttribute('data-toli');
      if (toli === null) { toli = pillar[i].textContent; pillar[i].setAttribute('data-toli', toli); }
      pillar[i].textContent = toli; pillar[i].removeAttribute('data-qisqa');
    }
    chap.style.minWidth = ''; quti.style.flex = '';
    if (qator.clientWidth === 0) return 'yashirin';
    chap.style.minWidth = sana.offsetWidth + 'px';   // sana hech qachon siqilmasin
    function sigadimi() { return ich.offsetWidth <= quti.clientWidth + 0.5; }
    if (!pillar.length || sigadimi()) return 'asl';
    for (i = 0; i < pillar.length; i++) {
      var q = pillar[i].getAttribute('data-qiymat');
      if (q !== null && isFinite(Number(q))) { pillar[i].textContent = Calc.qisqaBelgi(Number(q), pillar[i].getAttribute('data-plyus') === '1'); pillar[i].setAttribute('data-qisqa', '1'); }
    }
    if (!sigadimi()) quti.style.flex = '0 0 auto';   // belgilar o'z kengligini oladi, chapdagi kichik qator qisqaradi
    return 'qisqa';
  }

  // Izoh (TZ 22.4): bir qator, oxiri "…". Qisqartirilgan bo'lsa bosish to'liq ochadi, yana bossa yig'adi. Qisqa (qisqartirilmagan) izohda hech narsa o'zgarmaydi.
  // Natija: 'ochildi' | 'yopildi' | 'qisqa' (qisqa izoh: o'zgarmadi, bosish qatorning o'ziga o'tadi)
  function izohAlmashtir(e) {
    var ochiq = e.classList.contains('ochiq');
    if (!ochiq && e.scrollWidth <= e.clientWidth + 1) return 'qisqa';
    e.classList.toggle('ochiq', !ochiq);
    e.setAttribute('aria-expanded', String(!ochiq));
    return ochiq ? 'yopildi' : 'ochildi';
  }

  function hammasi(ildiz) {
    var r = ildiz || document, royxat = r.querySelectorAll('.sig'), i;
    for (i = 0; i < royxat.length; i++) sigdir(royxat[i]);
    var qatorlar = r.querySelectorAll('.kun-sarlavha');
    for (i = 0; i < qatorlar.length; i++) kunQatori(qatorlar[i]);
  }

  var kutilmoqda = false;
  function keyinroq(ildiz) {
    if (kutilmoqda) return;
    kutilmoqda = true;
    var ish = function () { kutilmoqda = false; hammasi(ildiz); };
    if (window.requestAnimationFrame) window.requestAnimationFrame(ish); else setTimeout(ish, 0);
  }

  // Ekran kengligi o'zgarsa (burilish) va shriftlar yuklangach qayta o'lchanadi
  function kuzat(ildiz) {
    window.addEventListener('resize', function () { keyinroq(ildiz); });
    window.addEventListener('orientationchange', function () { keyinroq(ildiz); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { keyinroq(ildiz); });
  }

  return { sigdir: sigdir, kunQatori: kunQatori, izohAlmashtir: izohAlmashtir, hammasi: hammasi, keyinroq: keyinroq, kuzat: kuzat, MIN_SHRIFT: MIN_SHRIFT };
})();
