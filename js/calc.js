// Hisob-kitoblar. Bu faylda ekran bilan ishlaydigan kod bo'lmaydi.
// Summa va sana yordamchilari, kiritilgan ma'lumotni tekshirish, hisob qoldig'i, yozuvlarni kunlar bo'yicha guruhlash.
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

  // Hisob qoldig'i = boshlang'ich qoldiq + daromadlar - xarajatlar + kirgan o'tkazmalar - chiqqan o'tkazmalar
  // (TZ 8-band, 1-qoida). Qarz qismi 8-bosqichda qo'shiladi.
  function hisobQoldigi(hisob, yozuvlar) {
    var q = hisob.boshlangich_qoldiq;
    yozuvlar.forEach(function (y) {
      if (y.tur === 'daromad' && y.hisob_id === hisob.id) q += y.summa;
      else if (y.tur === 'xarajat' && y.hisob_id === hisob.id) q -= y.summa;
      else if (y.tur === 'otkazma') {
        if (y.hisob_id === hisob.id) q -= y.summa;          // chiqqan o'tkazma
        if (y.qabul_hisob_id === hisob.id) q += y.summa;    // kirgan o'tkazma
      }
    });
    return q;
  }

  // Arxivlanmagan hisoblardagi pulning yig'indisi
  function umumiyBalans(hisoblar, yozuvlar) {
    return hisoblar.reduce(function (j, h) {
      return h.arxivlangan ? j : j + hisobQoldigi(h, yozuvlar);
    }, 0);
  }

  // O'tkazmada ikki hisob tanlangan va ular har xil bo'lishi kerak. Xato bo'lsa matn, bo'lmasa null.
  function otkazmaTekshir(hisobId, qabulId) {
    if (!hisobId || !qabulId) return 'Ikkala hisobni ham tanlang';
    if (hisobId === qabulId) return 'Qayerdan va qayerga hisoblari har xil bo\'lsin';
    return null;
  }

  // Hisob nomi bo'sh bo'lmasligi kerak. Natija: { nom } yoki { xato }
  function hisobNomTekshir(matn) {
    var nom = String(matn == null ? '' : matn).trim();
    return nom ? { nom: nom } : { xato: 'Hisob nomini kiriting' };
  }

  // Boshlang'ich qoldiq: bo'sh yoki 0 mumkin, manfiy mumkin emas. Natija: { summa } yoki { xato }
  function qoldiqTekshir(matn) {
    var s = String(matn == null ? '' : matn).replace(/\s/g, '');
    if (s === '') return { summa: 0 };
    if (s.charAt(0) === '-') return { xato: 'Qoldiq manfiy bo\'lishi mumkin emas' };
    if (!/^\d+$/.test(s)) return { xato: 'Qoldiq faqat raqamlardan iborat bo\'lsin' };
    if (s.replace(/^0+/, '').length > 15) return { xato: 'Qoldiq juda katta' };
    return { summa: parseInt(s, 10) };
  }

  // Kategoriya nomi bo'sh bo'lmasligi kerak. Natija: { nom } yoki { xato }
  function kategoriyaNomTekshir(matn) {
    var nom = String(matn == null ? '' : matn).trim();
    return nom ? { nom: nom } : { xato: 'Kategoriya nomini kiriting' };
  }

  // Yozuvlarni filtr bo'yicha saralaydi (asl massivga tegmaydi). Filtr maydonlari (hammasi ixtiyoriy):
  // tur, hisob (yozuvning hisobi yoki o'tkazmaning qabul hisobi), kategoriya,
  // dan / gacha (sana oralig'i, chegaralari bilan), qidiruv (izoh ichidan, harf kattaligiga qaramay).
  function yozuvlarniSuz(yozuvlar, f) {
    f = f || {};
    var q = String(f.qidiruv || '').trim().toLowerCase();
    return yozuvlar.filter(function (y) {
      if (f.tur && y.tur !== f.tur) return false;
      if (f.hisob && y.hisob_id !== f.hisob && y.qabul_hisob_id !== f.hisob) return false;
      if (f.kategoriya && y.kategoriya_id !== f.kategoriya) return false;
      if (f.dan && y.sana < f.dan) return false;
      if (f.gacha && y.sana > f.gacha) return false;
      if (q && String(y.izoh || '').toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
  }

  // Filtrda biror shart (qidiruvdan tashqari) tanlanganmi
  function filtrFaolmi(f) {
    return !!(f && (f.tur || f.hisob || f.kategoriya || f.dan || f.gacha));
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
    qoldiqTekshir: qoldiqTekshir, kategoriyaNomTekshir: kategoriyaNomTekshir,
    yozuvlarniSuz: yozuvlarniSuz, filtrFaolmi: filtrFaolmi, hisobNomTekshir: hisobNomTekshir, otkazmaTekshir: otkazmaTekshir,
    hisobQoldigi: hisobQoldigi, umumiyBalans: umumiyBalans,
    oxirgiYozuvlar: oxirgiYozuvlar, kunlarBoyicha: kunlarBoyicha, oxirgiHisobId: oxirgiHisobId
  };
})(typeof window !== 'undefined' ? window : this);
