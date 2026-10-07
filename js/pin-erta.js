// PIN-kod: <head> ichida, sahifa chizilishidan OLDIN yuklanadi. PIN yoqilgan bo'lsa, ilova ichi PIN so'ralguncha ko'rinmaydi
// (ma'lumotlar bir lahza ham ko'rinib qolmasin). Bayroq faqat tez boshlash uchun nusxa; haqiqiy PIN IndexedDB da (js/pin.js).
(function () {
  'use strict';
  try { if (localStorage.getItem('moliya-pin-bor') === '1') document.documentElement.classList.add('pin-qulf'); } catch (e) { /* maxfiy rejim: js/pin.js baribir tekshiradi */ }
})();
