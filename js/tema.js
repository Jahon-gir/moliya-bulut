// Mavzu: "qurilma" (qurilma sozlamasi), "yorug", "qorongi". Bu fayl <head> ichida, sahifa chizilishidan OLDIN yuklanadi:
// tanlov qurilmada (localStorage) nusxalanadi, shuning uchun ilova ochilganda oq yoki qora chaqnash bo'lmaydi.
// Asosiy saqlash joyi — IndexedDB sozlamalari (zaxiraga kiradi); localStorage faqat tez boshlash uchun nusxa.
var Tema = (function () {
  'use strict';
  var QIYMATLAR = ['qurilma', 'yorug', 'qorongi'];
  var KALIT = 'moliya-tema';
  var RANG = { yorug: '#f4f6f5', qorongi: '#101614' };   // brauzer tepasidagi rang: ilova foni bilan bir xil

  function togrimi(t) { return QIYMATLAR.indexOf(t) !== -1; }
  function nusxaOl() { try { var t = localStorage.getItem(KALIT); return togrimi(t) ? t : 'qurilma'; } catch (e) { return 'qurilma'; } }
  function nusxaYoz(t) { try { localStorage.setItem(KALIT, t); } catch (e) { /* maxfiy rejim: nusxasiz ishlayveradi */ } }

  // <meta name="theme-color"> — qurilma rejimida ikkalasi o'z media sharti bilan; aniq tanlovda ikkalasi bir xil rang
  function brauzerRangi(t) {
    var metalar = document.querySelectorAll('meta[name="theme-color"]');
    Array.prototype.forEach.call(metalar, function (m) {
      var qorongi = (m.getAttribute('media') || '').indexOf('dark') !== -1;
      m.setAttribute('content', t === 'qurilma' ? (qorongi ? RANG.qorongi : RANG.yorug) : RANG[t]);
    });
  }

  // Mavzuni darhol qo'llaydi (sahifani qayta yuklamasdan); nusxani yangilaydi
  function qollash(t) {
    if (!togrimi(t)) t = 'qurilma';
    var h = document.documentElement;
    if (t === 'qurilma') h.removeAttribute('data-tema'); else h.setAttribute('data-tema', t);
    brauzerRangi(t);
    nusxaYoz(t);
    return t;
  }

  qollash(nusxaOl());
  return { QIYMATLAR: QIYMATLAR, togrimi: togrimi, qollash: qollash, nusxaOl: nusxaOl, RANG: RANG };
})();
