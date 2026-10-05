// Ilova nomi — BITTA joyda. Ilova ichidagi matnlar, sahifa sarlavhasi va fayl nomlari shu yerdan olinadi.
// Statik fayllar (manifest.json, index.html <title> va apple-mobile-web-app-title) o'zgaruvchini o'qiy olmaydi:
// ularning nomi shu qiymat bilan bir xil ekani tests.html da tekshiriladi. Nomni o'zgartirsangiz, ularni ham yangilang.
var ILOVA = {
  nom: 'Chuntak AI',
  qisqaNom: 'Chuntak',
  faylBelgisi: 'chuntak'   // yuklab olinadigan fayl nomlarining boshi: chuntak-zaxira-…, chuntak-eksport-…
};
if (typeof document !== 'undefined') document.title = ILOVA.nom;
