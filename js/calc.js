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

  // ---- Yozuv vaqti (soat:daqiqa, qurilmaning mahalliy vaqti) ----
  function vaqtFormatiTogrimi(v) {
    return typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
  }

  // Hozirgi mahalliy sana va soat, daqiqa aniqligida: { sana: "YYYY-MM-DD", vaqt: "HH:MM" }
  function hozir(d) {
    d = d || new Date();
    return { sana: bugun(d), vaqt: ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) };
  }

  // Yozuvning soati; yozuvda yo'q yoki noto'g'ri bo'lsa "00:00"
  function yozuvVaqti(y) {
    return vaqtFormatiTogrimi(y && y.vaqt) ? y.vaqt : '00:00';
  }

  // Sana va soat hozirgi vaqtdan keyinmi (daqiqa aniqligida: hozir 21:00 bo'lsa, 21:00 mumkin, 21:01 mumkin emas)
  function kelajakmi(sana, vaqt, h) {
    h = h || hozir();
    return sana > h.sana || (sana === h.sana && vaqt > h.vaqt);
  }

  // Yozuvning sanasi va soatini tekshiradi. h — hozirgi vaqt (hozir()), har safar yangidan olinadi.
  // Natija: { xato: "xabar" } yoki {}
  function vaqtTekshir(sana, vaqt, h) {
    if (!sana) return { xato: 'Sanani kiriting' };
    if (!vaqt) return { xato: 'Soatni kiriting' };
    if (!vaqtFormatiTogrimi(vaqt)) return { xato: 'Soatni SS:DD ko\'rinishida kiriting' };
    if (kelajakmi(sana, vaqt, h)) return { xato: 'Yozuv vaqti hozirgi vaqtdan keyin bo\'lishi mumkin emas' };
    return {};
  }

  // Sxema 1 -> 2: yozuvga `vaqt` qo'shadi, boshqa hech narsaga tegmaydi.
  // Yaratilgan sanasi (mahalliy vaqtda) yozuv sanasi bilan bir xil bo'lsa, yaratilgan soati olinadi, aks holda "00:00".
  // Yozuvda to'g'ri `vaqt` allaqachon bo'lsa, o'sha obyektning o'zi qaytadi (ikkinchi marta ishlasa ham buzilmaydi).
  function yozuvniYangilash(y) {
    if (vaqtFormatiTogrimi(y.vaqt)) return y;
    var vaqt = '00:00';
    var d = new Date(y.yaratilgan);
    if (y.yaratilgan && !isNaN(d.getTime())) {
      var h = hozir(d);
      if (h.sana === y.sana) vaqt = h.vaqt;
    }
    var yangi = {};
    Object.keys(y).forEach(function (k) { yangi[k] = y[k]; });
    yangi.vaqt = vaqt;
    return yangi;
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

  // Nomlarni solishtirish uchun kalit: harf kattaligi, barcha bo'sh joylar va apostrof turlari
  // (' ʻ ʼ ‘ ’ ` ´) hisobga olinmaydi: ularning hammasi bir xil sanaladi
  function nomKaliti(nom) {
    return String(nom == null ? '' : nom).toLowerCase()
      .replace(/[\u02BB\u02BC\u2018\u2019\u0060\u00B4]/g, '\'')
      .replace(/\s+/g, '');
  }

  // Shu nom ro'yxatda (istisnoId dan boshqa elementlar orasida) bormi
  function nomBandmi(nom, mavjud, istisnoId) {
    var kalit = nomKaliti(nom);
    return (mavjud || []).some(function (x) { return x.id !== istisnoId && nomKaliti(x.nom) === kalit; });
  }

  // Hisob nomi: bo'sh bo'lmasin va faol hisoblar orasida takrorlanmasin.
  // mavjud — faol hisoblar, istisnoId — tahrirlanayotgan hisobning o'zi. Natija: { nom } yoki { xato }
  function hisobNomTekshir(matn, mavjud, istisnoId) {
    var nom = String(matn == null ? '' : matn).trim();
    if (!nom) return { xato: 'Hisob nomini kiriting' };
    if (nomBandmi(nom, mavjud, istisnoId)) return { xato: 'Bu nom bilan hisob allaqachon bor' };
    return { nom: nom };
  }

  // Hisob qoldig'i. Yangi hisobda bo'sh = 0 va manfiy mumkin emas. Mavjud hisobni tahrirlashda (tahrir=true)
  // joriy qoldiq manfiy bo'lishi mumkin, bo'sh qoldirish esa xato: tasodifan nolga tushib ketmasligi uchun.
  // Natija: { summa } yoki { xato }
  function qoldiqTekshir(matn, tahrir) {
    var s = String(matn == null ? '' : matn).replace(/\s/g, '');
    if (s === '') return tahrir ? { xato: 'Qoldiqni kiriting (nol bo\'lsa, 0 yozing)' } : { summa: 0 };
    var minus = s.charAt(0) === '-';
    if (minus) {
      if (!tahrir) return { xato: 'Qoldiq manfiy bo\'lishi mumkin emas' };
      s = s.slice(1);
    }
    if (!/^\d+$/.test(s)) return { xato: 'Qoldiq faqat raqamlardan iborat bo\'lsin' };
    if (s.replace(/^0+/, '').length > 15) return { xato: 'Qoldiq juda katta' };
    var n = parseInt(s, 10);
    return { summa: minus && n ? -n : n };
  }

  // Foydalanuvchi hisobning HOZIRGI qoldig'ini o'zgartirsa, yozuvlarga tegmaymiz: farqni boshlang'ich qoldiqqa
  // qo'shamiz. yangi boshlang'ich = eski boshlang'ich + (yangi joriy - eski joriy)
  function yangiBoshlangichQoldiq(hisob, yozuvlar, yangiJoriy) {
    return hisob.boshlangich_qoldiq + (yangiJoriy - hisobQoldigi(hisob, yozuvlar));
  }

  // Kategoriya nomi: bo'sh bo'lmasin va bir turdagi faol kategoriyalar orasida takrorlanmasin.
  // mavjud — shu turdagi faol kategoriyalar, istisnoId — tahrirlanayotgan kategoriyaning o'zi.
  function kategoriyaNomTekshir(matn, mavjud, istisnoId) {
    var nom = String(matn == null ? '' : matn).trim();
    if (!nom) return { xato: 'Kategoriya nomini kiriting' };
    if (nomBandmi(nom, mavjud, istisnoId)) return { xato: 'Bu nom bilan kategoriya allaqachon bor' };
    return { nom: nom };
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

  // ---- Davrlar va hisobotlar (TZ 8-band) ----
  var OY_NOMLARI = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
    'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];

  function ikki(n) { return (n < 10 ? '0' : '') + n; }
  function sanaQismlari(iso) {
    var q = String(iso).split('-');
    return { y: parseInt(q[0], 10), m: parseInt(q[1], 10), d: parseInt(q[2], 10) };
  }
  // Sanalar bilan hisob-kitob UTC da qilinadi: qurilmaning vaqt zonasi va yozgi vaqt natijaga ta'sir qilmasin
  function sanaUTC(iso) {
    var p = sanaQismlari(iso);
    return new Date(Date.UTC(p.y, p.m - 1, p.d));
  }
  function isoSana(dt) {
    return dt.getUTCFullYear() + '-' + ikki(dt.getUTCMonth() + 1) + '-' + ikki(dt.getUTCDate());
  }
  // Sanaga n kun qo'shadi (manfiy bo'lsa ayiradi)
  function kunQosh(iso, n) {
    var dt = sanaUTC(iso);
    dt.setUTCDate(dt.getUTCDate() + n);
    return isoSana(dt);
  }

  // Berilgan sana tushadigan davrning chegarasi: { dan, gacha } (ikkalasi ham kiradi).
  // tur: 'kun' | 'hafta' (dushanbadan yakshanbagacha) | 'oy' | 'yil'
  function davrChegarasi(tur, sana) {
    var p = sanaQismlari(sana);
    if (tur === 'kun') return { dan: sana, gacha: sana };
    if (tur === 'hafta') {
      var dushanbadan = (sanaUTC(sana).getUTCDay() + 6) % 7;   // dushanba = 0
      var dan = kunQosh(sana, -dushanbadan);
      return { dan: dan, gacha: kunQosh(dan, 6) };
    }
    if (tur === 'oy') {
      var oxirgi = new Date(Date.UTC(p.y, p.m, 0)).getUTCDate();   // oyning oxirgi kuni (kabisa yili ham to'g'ri)
      return { dan: p.y + '-' + ikki(p.m) + '-01', gacha: p.y + '-' + ikki(p.m) + '-' + ikki(oxirgi) };
    }
    return { dan: p.y + '-01-01', gacha: p.y + '-12-31' };
  }

  // Davrni n ta oldinga (musbat) yoki orqaga (manfiy) suradi. Natija: yangi davr ichidagi sana
  function davrniSur(tur, sana, n) {
    var p = sanaQismlari(sana);
    if (tur === 'kun') return kunQosh(sana, n);
    if (tur === 'hafta') return kunQosh(sana, 7 * n);
    if (tur === 'oy') {
      var jami = p.y * 12 + (p.m - 1) + n;
      return Math.floor(jami / 12) + '-' + ikki(jami % 12 + 1) + '-01';
    }
    return (p.y + n) + '-01-01';
  }

  // Davrning ko'rinadigan nomi: "03.10.2026", "28.09.2026 – 04.10.2026", "Oktabr 2026", "2026"
  function davrNomi(tur, sana) {
    var c = davrChegarasi(tur, sana), p = sanaQismlari(c.dan);
    if (tur === 'kun') return sanaKorsat(c.dan);
    if (tur === 'hafta') return sanaKorsat(c.dan) + ' – ' + sanaKorsat(c.gacha);
    if (tur === 'oy') return OY_NOMLARI[p.m - 1] + ' ' + p.y;
    return String(p.y);
  }

  // Foizlar butun songa yaxlitlanadi; yaxlitlash farqi eng katta qiymatga qo'shiladi,
  // shunda yig'indi aniq 100 bo'ladi (TZ 8-band, 4-qoida). Jami 0 bo'lsa, hammasi 0.
  function foizlar(summalar) {
    var jami = summalar.reduce(function (a, b) { return a + b; }, 0);
    if (!jami) return summalar.map(function () { return 0; });
    var f = summalar.map(function (x) { return Math.round(x * 100 / jami); });
    var farq = 100 - f.reduce(function (a, b) { return a + b; }, 0);
    if (farq) {
      var eng = 0;
      summalar.forEach(function (x, i) { if (x > summalar[eng]) eng = i; });
      f[eng] += farq;
    }
    return f;
  }

  // { kategoriya_id: summa } -> [{ kategoriya_id, summa, foiz }], kattasidan kichigiga
  function taqsimot(xarita) {
    var royxat = Object.keys(xarita).map(function (id) { return { kategoriya_id: id, summa: xarita[id] }; });
    royxat.sort(function (a, b) {
      return b.summa - a.summa || (a.kategoriya_id < b.kategoriya_id ? -1 : 1);
    });
    var f = foizlar(royxat.map(function (x) { return x.summa; }));
    royxat.forEach(function (x, i) { x.foiz = f[i]; });
    return royxat;
  }

  // Davr hisoboti: faqat daromad va xarajat yozuvlari (o'tkazma va qarz kirmaydi), sana chegaralari bilan.
  // hisobId berilsa, faqat shu hisob bo'yicha. Yozuv o'z sanasi tushgan davrga kiradi.
  function hisobot(yozuvlar, dan, gacha, hisobId) {
    var daromad = 0, xarajat = 0, soni = 0, dKat = {}, xKat = {};
    yozuvlar.forEach(function (y) {
      if (y.tur !== 'daromad' && y.tur !== 'xarajat') return;
      if (y.sana < dan || y.sana > gacha) return;
      if (hisobId && y.hisob_id !== hisobId) return;
      soni++;
      var xarita = y.tur === 'daromad' ? dKat : xKat;
      xarita[y.kategoriya_id] = (xarita[y.kategoriya_id] || 0) + y.summa;
      if (y.tur === 'daromad') daromad += y.summa; else xarajat += y.summa;
    });
    return {
      daromad: daromad, xarajat: xarajat, qoldiq: daromad - xarajat, soni: soni,
      xarajatTaqsimoti: taqsimot(xKat), daromadTaqsimoti: taqsimot(dKat)
    };
  }

  // Xarajatni oldingi davr bilan solishtirish: { farq, foiz }. Oldingi davrda xarajat 0 bo'lsa, foiz = null ("—")
  function taqqoslash(joriy, oldingi) {
    var farq = joriy - oldingi;
    if (oldingi === 0) return { farq: farq, foiz: null };
    var f = Math.round(Math.abs(farq) * 100 / oldingi);
    return { farq: farq, foiz: farq < 0 ? -f : f };
  }

  // "+50 000 so'm" / "−50 000 so'm" / "0 so'm"
  function belgiliSum(n) { return (n > 0 ? '+' : '') + sumFormat(n); }
  // "+20%" / "−20%" / "0%" ; null -> "—"
  function belgiliFoiz(f) {
    if (f === null || f === undefined) return '—';
    return (f > 0 ? '+' : f < 0 ? '−' : '') + Math.abs(f) + '%';
  }

  // Yangisi tepada: avval sana, keyin shu kundagi soat, soat ham teng bo'lsa yaratilgan vaqti bo'yicha
  function yangiTartib(a, b) {
    if (a.sana !== b.sana) return a.sana < b.sana ? 1 : -1;
    var va = yozuvVaqti(a), vb = yozuvVaqti(b);
    if (va !== vb) return va < vb ? 1 : -1;
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
    qoldiqTekshir: qoldiqTekshir, yangiBoshlangichQoldiq: yangiBoshlangichQoldiq, nomKaliti: nomKaliti, kategoriyaNomTekshir: kategoriyaNomTekshir,
    yozuvlarniSuz: yozuvlarniSuz, filtrFaolmi: filtrFaolmi, hisobNomTekshir: hisobNomTekshir, otkazmaTekshir: otkazmaTekshir,
    hisobQoldigi: hisobQoldigi, umumiyBalans: umumiyBalans,
    davrChegarasi: davrChegarasi, davrniSur: davrniSur, davrNomi: davrNomi, kunQosh: kunQosh,
    foizlar: foizlar, hisobot: hisobot, taqqoslash: taqqoslash, belgiliSum: belgiliSum, belgiliFoiz: belgiliFoiz,
    hozir: hozir, kelajakmi: kelajakmi, vaqtTekshir: vaqtTekshir, yozuvVaqti: yozuvVaqti,
    vaqtFormatiTogrimi: vaqtFormatiTogrimi, yozuvniYangilash: yozuvniYangilash,
    oxirgiYozuvlar: oxirgiYozuvlar, kunlarBoyicha: kunlarBoyicha, oxirgiHisobId: oxirgiHisobId
  };
})(typeof window !== 'undefined' ? window : this);
