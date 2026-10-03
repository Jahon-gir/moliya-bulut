// Hisob-kitoblar. Bu faylda ekran bilan ishlaydigan kod bo'lmaydi.
// Summa va sana yordamchilari, summani tekshirish, hisob qoldig'i, yozuvlarni kunlar bo'yicha guruhlash.
(function (global) {
  'use strict';

  // 1250000 -> "1 250 000 so'm" (butun son, mingliklar oddiy bo'sh joy bilan)
  function sumFormat(n) {
    var manfiy = n < 0;
    var s = String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (manfiy ? '−' : '') + s + ' so\'m';
  }

  // "2026-10-03" -> "03.10.2026"
  function sanaKorsat(iso) {
    var q = String(iso).split('-');
    return q[2] + '.' + q[1] + '.' + q[0];
  }

  // Qurilmaning mahalliy sanasi "YYYY-MM-DD" ko'rinishida
  function bugun(d) {
    d = d || new Date();
    var oy = ('0' + (d.getMonth() + 1)).slice(-2);
    var kun = ('0' + d.getDate()).slice(-2);
    return d.getFullYear() + '-' + oy + '-' + kun;
  }

  // Kiritilayotgan matndagi mingliklarni ajratadi: "1250000" -> "1 250 000".
  // Boshidagi minus saqlanadi (keyin tekshiruvda xato bo'lib chiqishi uchun), boshqa belgilar tashlanadi.
  function raqamFormat(matn) {
    var minus = String(matn).trim().charAt(0) === '-';
    var raqam = String(matn).replace(/\D/g, '');
    return (minus ? '-' : '') + raqam.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  // Summani tekshiradi. Natija: { summa: butun son } yoki { xato: "xabar" }
  function summaTekshir(matn) {
    var s = String(matn == null ? '' : matn).replace(/\s/g, '');
    if (s === '') return { xato: 'Summani kiriting' };
    if (s.charAt(0) === '-') return { xato: 'Summa manfiy bo\'lishi mumkin emas' };
    if (!/^\d+$/.test(s)) return { xato: 'Summa faqat raqamlardan iborat bo\'lsin' };
    if (s.replace(/^0+/, '').length > 15) return { xato: 'Summa juda katta' };
    var n = parseInt(s, 10);
    if (n === 0) return { xato: 'Summa noldan katta bo\'lsin' };
    return { summa: n };
  }

  // Hisob qoldig'i = boshlang'ich qoldiq + daromadlar - xarajatlar (TZ 8-band, 1-qoida).
  // O'tkazma va qarz qismlari 3- va 8-bosqichlarda qo'shiladi.
  function hisobQoldigi(hisob, yozuvlar) {
    var q = hisob.boshlangich_qoldiq;
    yozuvlar.forEach(function (y) {
      if (y.hisob_id !== hisob.id) return;
      if (y.tur === 'daromad') q += y.summa;
      else if (y.tur === 'xarajat') q -= y.summa;
    });
    return q;
  }

  // Barcha berilgan hisoblardagi pulning yig'indisi
  function umumiyBalans(hisoblar, yozuvlar) {
    return hisoblar.reduce(function (j, h) { return j + hisobQoldigi(h, yozuvlar); }, 0);
  }

  // Yangisi tepada: avval sana, bir xil sanada yaratilgan vaqti bo'yicha
  function yangiTartib(a, b) {
    if (a.sana !== b.sana) return a.sana < b.sana ? 1 : -1;
    if (a.yaratilgan !== b.yaratilgan) return a.yaratilgan < b.yaratilgan ? 1 : -1;
    return 0;
  }

  // Oxirgi n ta yozuv (eng yangisi birinchi)
  function oxirgiYozuvlar(yozuvlar, n) {
    return yozuvlar.slice().sort(yangiTartib).slice(0, n);
  }

  // Kunlar bo'yicha guruhlash: [{ sana, xarajat (o'sha kun jami), yozuvlar }], eng yangi kun birinchi
  function kunlarBoyicha(yozuvlar) {
    var guruhlar = [];
    yozuvlar.slice().sort(yangiTartib).forEach(function (y) {
      var oxirgi = guruhlar[guruhlar.length - 1];
      if (!oxirgi || oxirgi.sana !== y.sana) {
        oxirgi = { sana: y.sana, xarajat: 0, yozuvlar: [] };
        guruhlar.push(oxirgi);
      }
      oxirgi.yozuvlar.push(y);
      if (y.tur === 'xarajat') oxirgi.xarajat += y.summa;
    });
    return guruhlar;
  }

  // Oxirgi yozuv ishlatilgan hisobning id si (yo'q bo'lsa undefined)
  function oxirgiHisobId(yozuvlar) {
    var y = oxirgiYozuvlar(yozuvlar, 1)[0];
    return y ? y.hisob_id : undefined;
  }

  global.Calc = {
    sumFormat: sumFormat, sanaKorsat: sanaKorsat, bugun: bugun,
    raqamFormat: raqamFormat, summaTekshir: summaTekshir,
    hisobQoldigi: hisobQoldigi, umumiyBalans: umumiyBalans,
    oxirgiYozuvlar: oxirgiYozuvlar, kunlarBoyicha: kunlarBoyicha, oxirgiHisobId: oxirgiHisobId
  };
})(typeof window !== 'undefined' ? window : this);
