// Kirish ekrani va yumshoq eslatma (TZ-sinxronlash.md, 18.1): qurilmada esda qoladigan tanlov va eslatma qoidalari.
// Bu yerda DOM yo'q: xotira (localStorage) tashqaridan beriladi, shuning uchun tests.html da to'liq sinaladi.
// Sinxron mantig'iga (navbat, qulf, tortish) tegmaydi.
var Salom = (function () {
  'use strict';

  var TANLOV_KALITI = 'moliya-kirish-tanlovi';   // 'kirdi' | 'davom'  ("moliya-" bilan boshlanadi: "PINni unutdim" to'liq tozalashi uni ham o'chiradi)
  var ESLATMA_KALITI = 'moliya-eslatma';         // { korsatilgan: 'YYYY-MM-DD', yopilgan: millisekund }
  var YOPISH_MS = 7 * 24 * 60 * 60 * 1000;       // yopilgan eslatma 7 kun qaytmaydi
  var xotira = null, korsatilmoqda = false;      // korsatilmoqda: eslatma shu seansda ko'rsatilgan (yopilmaguncha ko'rinib turadi)

  function xotiraOl() {
    if (xotira) return xotira;
    try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; }
  }
  function sozla(x) { xotira = x || null; korsatilmoqda = false; }   // sinov uchun
  function oqi(k) { try { var x = xotiraOl(); return x ? x.getItem(k) : null; } catch (e) { return null; } }
  function yoz(k, v) { try { var x = xotiraOl(); if (x) x.setItem(k, v); } catch (e) { /* xotira ishlamasa ham ilova ishlayveradi */ } }
  function sana(d) { function ikki(n) { return (n < 10 ? '0' : '') + n; } return d.getFullYear() + '-' + ikki(d.getMonth() + 1) + '-' + ikki(d.getDate()); }

  function tanlovOl() { var t = oqi(TANLOV_KALITI); return t === 'kirdi' || t === 'davom' ? t : null; }
  function tanlovYoz(t) { if (t === 'kirdi' || t === 'davom') yoz(TANLOV_KALITI, t); }

  function eslatmaHolati() {
    try { var o = JSON.parse(oqi(ESLATMA_KALITI) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; }
  }
  // Eslatma ko'rsatilsinmi: shu seansda allaqachon ko'rsatilgan bo'lsa (yopilmagan) — ha; aks holda bugun hali ko'rsatilmagan va yopilganiga 7 kun o'tgan bo'lsa
  function eslatmaKerakmi(hozir) {
    if (korsatilmoqda) return true;
    var h = eslatmaHolati(), d = hozir || new Date();
    if (h.korsatilgan === sana(d)) return false;
    if (typeof h.yopilgan === 'number' && d.getTime() - h.yopilgan < YOPISH_MS) return false;
    return true;
  }
  function eslatmaKorsatildi(hozir) {
    var h = eslatmaHolati(); h.korsatilgan = sana(hozir || new Date()); yoz(ESLATMA_KALITI, JSON.stringify(h)); korsatilmoqda = true;
  }
  function eslatmaYop(hozir) {
    var h = eslatmaHolati(); h.yopilgan = (hozir || new Date()).getTime(); h.korsatilgan = sana(hozir || new Date()); yoz(ESLATMA_KALITI, JSON.stringify(h)); korsatilmoqda = false;
  }
  // "Kirmasdan davom etish" tanlangan kuni eslatma chiqmasin
  function bugunEslatmasizBelgila(hozir) { var h = eslatmaHolati(); h.korsatilgan = sana(hozir || new Date()); yoz(ESLATMA_KALITI, JSON.stringify(h)); }

  // Ilg'or rejim (JSON zaxira tugmalari): Menyu pastidagi versiya qatori 7 marta bosilsa yoqiladi/o'chadi
  var ILGOR_KALITI = 'moliya-ilgor';
  function ilgormi() { return oqi(ILGOR_KALITI) === '1'; }
  function ilgorAlmashtir() { var y = !ilgormi(); yoz(ILGOR_KALITI, y ? '1' : '0'); return y; }

  // "Qarzlarni hisobotga qo'shish" (TZ-sinxronlash.md 19-band): sukut — YOQIQ; faqat shu qurilmada saqlanadi (serverda sozlama ustuni yo'q, sxema o'zgarmaydi)
  var QARZ_HISOBOT_KALITI = 'moliya-qarz-hisobotda';
  function qarzHisobotda() { return oqi(QARZ_HISOBOT_KALITI) !== '0'; }
  function qarzHisobotdaYoz(b) { yoz(QARZ_HISOBOT_KALITI, b ? '1' : '0'); }

  return {
    qarzHisobotda: qarzHisobotda, qarzHisobotdaYoz: qarzHisobotdaYoz,
    sozla: sozla, tanlovOl: tanlovOl, tanlovYoz: tanlovYoz, eslatmaKerakmi: eslatmaKerakmi, eslatmaKorsatildi: eslatmaKorsatildi,
    eslatmaYop: eslatmaYop, bugunEslatmasizBelgila: bugunEslatmasizBelgila, ilgormi: ilgormi, ilgorAlmashtir: ilgorAlmashtir, YOPISH_MS: YOPISH_MS
  };
})();
