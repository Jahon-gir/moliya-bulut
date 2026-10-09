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

  function hammasi(ildiz) {
    var royxat = (ildiz || document).querySelectorAll('.sig');
    for (var i = 0; i < royxat.length; i++) sigdir(royxat[i]);
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

  return { sigdir: sigdir, hammasi: hammasi, keyinroq: keyinroq, kuzat: kuzat, MIN_SHRIFT: MIN_SHRIFT };
})();
