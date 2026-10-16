// "Gap bilan qo'shish" (TZ-sinxronlash.md 29-band): sof mantiq. Bu faylda DOM, tarmoq va xotira yo'q, tests.html da sinaladi.
// So'rov tanasini yig'ish (limitlar, `eski` tanlash), serverning Yozuv'ini ilova yozuviga moslash, majburiy maydonlarni tekshirish.
// Yozuvni tekshirish va saqlash uchun yangi yo'l yaratilmaydi: tekshiruv mavjud Calc funksiyalari (yozuvniTayyorlash, qarzniTekshir, tolovniTekshir) bilan.
// Gap matni va `eski` hech qayerda saqlanmaydi (na log, na localStorage, na baza): faqat so'rov tanasida serverga ketadi.
var GapSof = (function () {
  'use strict';

  var GAP_MAX = 300;          // serverdagi chegara (28.2)
  var HISOBLAGICH_BOSHI = 250; // shundan keyin belgilar hisoblagichi ko'rinadi
  var NOM_MAX = 60;
  var RO_YXAT_MAX = 100;
  var ESKI_MAX = 20;
  var ESKI_IZOH_MAX = 40;
  var IZOH_MAX = 200;
  var KARTA_MAX = 6;
  var OGOH_MAX = 160;         // bitta ogohlantirish matni (belgi)
  var KUTISH_MS = 60000;      // mijoz kutish chegarasi
  var UMUMIY_OGOHLANTIRISH = 'AI adashishi mumkin: summani tekshiring.';
  var MISOLLAR = ['taksiga 15 ming', 'oylik tushdi 5 mln', 'Aliga 500 ming qarz berdim'];

  var TURLAR = [['xarajat', 'Xarajat'], ['daromad', 'Daromad'], ['qarz', 'Qarz'], ['otkazma', 'O\'tkazma']];
  var QARZ_AMALLAR = [['berdim', 'Berdim'], ['oldim', 'Oldim'], ['qaytardim', 'Qaytardim'], ['qaytarildi', 'Qaytarildi']];
  // Serverning `tur` qiymati -> kartadagi [tur, qarzAmal]
  var SERVER_TUR = {
    xarajat: ['xarajat', null], daromad: ['daromad', null], otkazma: ['otkazma', null],
    qarz_berdim: ['qarz', 'berdim'], qarz_oldim: ['qarz', 'oldim'], qarz_qaytardim: ['qarz', 'qaytardim'], qarz_qaytarildi: ['qarz', 'qaytarildi']
  };

  // ---- Xato matnlari (mavjud xato xabarlari uslubida: oddiy gap + "(kod: ...)") ----
  var YOZUV_YOQ_MATNI = 'Gapda yozuv topilmadi. Masalan: «taksiga 15 ming».';
  var TUSHUNARSIZ_MATNI = 'Tushunmadim. Boshqacha yozib ko\'ring.';
  var XATOLAR = {
    NETWORK_OFFLINE: 'Internet kerak. Ulanib, qayta urinib ko\'ring.',
    NETWORK: 'Serverga ulanib bo\'lmadi. Internetni tekshirib, qayta urinib ko\'ring.',
    VAQT: 'Javob juda kech keldi. Qayta urinib ko\'ring.',
    AUTH_EXPIRED: 'Kirish muddati tugagan. Menyu → Profil dan chiqib, qayta kiring.',
    AI_RUXSAT: 'Kirish muddati tugagan. Menyu → Profil dan chiqib, qayta kiring.',
    AI_LIMIT: 'Bugungi limit tugadi. Ertaga qayta urinib ko\'ring.',
    AI_UZUN: 'Gap juda uzun (300 belgigacha yozing).',
    AI_PROVAYDER: 'Yordamchi hozir javob bera olmayapti. Birozdan keyin qayta urinib ko\'ring.',
    AI_KIRISH: 'So\'rov noto\'g\'ri tuzilgan. Gapni boshqacha yozib ko\'ring.'
  };
  function xatoMatni(kod) {
    var k = String(kod || '').length ? String(kod) : 'JS_UNKNOWN';
    var matn = XATOLAR[k] || (/^HTTP_/.test(k) ? 'Yordamchi serveri kutilgan javob bermadi.' : 'Kutilmagan xato. Qayta urinib ko\'ring.');
    return matn + '\n(kod: ' + k + ')';
  }
  // Server `ok:true` qaytarib, yozuv bermagan bo'lsa: sababiga qarab xabar (kodsiz)
  function sababMatni(sabab) { return sabab === 'yozuv_yoq' ? YOZUV_YOQ_MATNI : TUSHUNARSIZ_MATNI; }

  // ---- Yordamchilar ----
  function tozaMatn(s) { return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ''); }
  function birQator(s) { return tozaMatn(s).replace(/\s+/g, ' ').trim(); }
  function kalitNom(s) { return Calc.nomKaliti(s); }
  function jonli(x) { return x && x.deleted !== true; }
  function faolKategoriyalar(m) { return (m.kategoriyalar || []).filter(function (k) { return jonli(k) && !k.arxivlangan; }); }
  function faolHisoblar(m) { return (m.hisoblar || []).filter(function (h) { return jonli(h) && !h.arxivlangan; }); }
  function hisobTuri(h) { return h.tur === 'naqd' ? 'naqd' : 'karta'; }   // ilovadagi karta/bank/naqd/boshqa -> serverdagi karta|naqd
  function summaFormat(n) { return Calc.raqamFormat(String(n)); }
  function nusxa(k, ozgarish) { var r = {}; Object.keys(k).forEach(function (x) { r[x] = k[x]; }); Object.keys(ozgarish || {}).forEach(function (x) { r[x] = ozgarish[x]; }); return r; }

  // ---- So'rov tanasi ----
  // Kategoriya nomlari: faol, takrorlanmaydigan (harf, bo'shliq, apostrofga e'tiborsiz), nom ≤ 60, ko'pi bilan 100 ta
  function kategoriyaNomlari(m) {
    var korilgan = {}, chiq = [];
    faolKategoriyalar(m).forEach(function (k) {
      var t = birQator(k.nom), kalit = kalitNom(t);
      if (!t || t.length > NOM_MAX || korilgan[kalit] || chiq.length >= RO_YXAT_MAX) return;
      korilgan[kalit] = true; chiq.push(t);
    });
    return chiq;
  }
  function hisobRoyxati(m) {
    var korilgan = {}, chiq = [];
    faolHisoblar(m).forEach(function (h) {
      var t = birQator(h.nom), kalit = kalitNom(t);
      if (!t || t.length > NOM_MAX || korilgan[kalit] || chiq.length >= RO_YXAT_MAX) return;
      korilgan[kalit] = true; chiq.push({ nom: t, turi: hisobTuri(h) });
    });
    return chiq;
  }
  // `eski`: so'nggi oddiy yozuvlardan (xarajat/daromad, kategoriyasi bor) takrorlanmaydigan (izoh, kategoriya) juftlar, eng yangisidan boshlab,
  // ko'pi bilan 20 ta, izoh ≤ 40 belgi va kichik harfda, bo'shlari tashlanadi. kategoriyalar — serverga yuboriladigan nomlar (ro'yxatda yo'q kategoriya tashlanadi).
  function eskiTanla(yozuvlar, m, kategoriyalar) {
    var yuborilgan = {}, nomlar = {}, korilgan = {}, chiq = [];
    (kategoriyalar || []).forEach(function (n) { yuborilgan[kalitNom(n)] = n; });
    faolKategoriyalar(m).forEach(function (k) { var n = yuborilgan[kalitNom(birQator(k.nom))]; if (n) nomlar[k.id] = n; });
    var kalit = function (y) { return String(y.sana || '') + ' ' + String(y.vaqt || '00:00') + ' ' + String(y.yaratilgan || ''); };
    var tartib = (yozuvlar || []).filter(function (y) { return y && jonli(y) && (y.tur === 'xarajat' || y.tur === 'daromad') && y.kategoriya_id && nomlar[y.kategoriya_id]; })
      .sort(function (a, b) { var x = kalit(a), z = kalit(b); return x < z ? 1 : x > z ? -1 : 0; });
    for (var i = 0; i < tartib.length && chiq.length < ESKI_MAX; i++) {
      var izoh = birQator(tartib[i].izoh).toLowerCase().slice(0, ESKI_IZOH_MAX).trim();
      if (!izoh) continue;
      var nom = nomlar[tartib[i].kategoriya_id], j = izoh + '|' + kalitNom(nom);
      if (korilgan[j]) continue;
      korilgan[j] = true; chiq.push({ izoh: izoh, kategoriya: nom });
    }
    return chiq;
  }
  // Serverga ketadigan to'liq tana (28.2). `bugun` — qurilmaning mahalliy sanasi.
  function sorovTanasi(gap, m, bugun) {
    var kategoriyalar = kategoriyaNomlari(m);
    return {
      rejim: 'yozuv', gap: birQator(gap).slice(0, GAP_MAX), bugun: bugun,
      kategoriyalar: kategoriyalar, hisoblar: hisobRoyxati(m), eski: eskiTanla(m.yozuvlar, m, kategoriyalar)
    };
  }

  // ---- Server javobi -> kartalar ----
  // Javobdagi yaroqli yozuvlar (≤ 6): tur ma'lum bo'lgan obyektlar. Natija bo'sh bo'lsa chaqiruvchi sababMatni() ni ishlatadi.
  function yozuvlarniOl(javob) {
    var r = javob && Array.isArray(javob.yozuvlar) ? javob.yozuvlar : [];
    return r.filter(function (y) { return y && typeof y === 'object' && SERVER_TUR[y.tur]; }).slice(0, KARTA_MAX);
  }
  function nomBilanTop(royxat, nom) {
    if (typeof nom !== 'string' || !nom.trim()) return null;
    var k = kalitNom(nom);
    return royxat.filter(function (x) { return kalitNom(x.nom) === k; })[0] || null;
  }
  // ---- Soat va oxirgi ishlatilgan hisob (30-band) ----
  function soatYaroqli(s) { return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s); }
  // Oxirgi hisob qurilmada turga qarab eslab qolinadi: oxirgi = { xarajat: { hisob, hisob2 }, ... } (qarz amallari "qarz" ostida). Hisob endi faol bo'lmasa — '' (Tanlang)
  function oxirgiHisob(oxirgi, tur, m, qaysi) {
    var yozuv = oxirgi && oxirgi[tur], id = yozuv && typeof yozuv[qaysi] === 'string' ? yozuv[qaysi] : '';
    return id && faolHisoblar(m).some(function (h) { return h.id === id; }) ? id : '';
  }
  // Hisob bo'sh bo'lsa oxirgi ishlatilgani qo'yiladi (model topgan hisob ustun). O'tkazmada ikkinchi hisob birinchisiga teng bo'lmasin.
  function oxirgiHisobQoy(k, m, oxirgi) {
    var o = {};
    if (!k.hisob) { var h = oxirgiHisob(oxirgi, k.tur, m, 'hisob'); if (h) o.hisob = h; }
    if (k.tur === 'otkazma' && !k.hisob2) {
      var h2 = oxirgiHisob(oxirgi, k.tur, m, 'hisob2');
      if (h2 && h2 !== (o.hisob || k.hisob)) o.hisob2 = h2;
    }
    return Object.keys(o).length ? nusxa(k, o) : k;
  }
  // Saqlangan karta uchun yangilangan `oxirgi` (xotiradagi obyektga tegmaydi). Faqat to'ldirilgan hisoblar yoziladi.
  function oxirgiYangila(oxirgi, k) {
    var r = nusxa(oxirgi || {}), y = nusxa(r[k.tur] || {});
    if (k.hisob) y.hisob = k.hisob;
    if (k.tur === 'otkazma' && k.hisob2) y.hisob2 = k.hisob2;
    r[k.tur] = y;
    return r;
  }
  function sanaYaroqli(s, bugun) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && s <= bugun; }
  // Serverning Yozuv'i -> tahrirlanadigan karta (ilova yozuvi shaklida: id lar, summa matn ko'rinishida)
  // qosh (ixtiyoriy): { soat: 'HH:MM' (soat maydonining standart qiymati), oxirgi: oxirgi ishlatilgan hisoblar }
  function kartaYasash(y, m, bugun, qosh) {
    qosh = qosh || {};
    var t = SERVER_TUR[y.tur] || SERVER_TUR.xarajat;
    var katTop = t[0] === 'xarajat' || t[0] === 'daromad' ? nomBilanTop(faolKategoriyalar(m).filter(function (k) { return k.tur === t[0]; }), y.kategoriya) : null;
    var his = faolHisoblar(m);
    var h = nomBilanTop(his, y.hisob), h2 = t[0] === 'otkazma' ? nomBilanTop(his, y.hisob2) : null;
    var summa = typeof y.summa === 'number' && isFinite(y.summa) && y.summa > 0 && y.summa === Math.floor(y.summa) ? summaFormat(y.summa) : '';
    var ogoh = (Array.isArray(y.ogohlantirish) ? y.ogohlantirish : []).filter(function (x) { return typeof x === 'string' && birQator(x); })
      .map(function (x) { return birQator(x).slice(0, OGOH_MAX); }).slice(0, 5);
    var karta = {
      tur: t[0], qarzAmal: t[1], summa: summa, kategoriya: katTop ? katTop.id : '', hisob: h ? h.id : '', hisob2: h2 && (!h || h2.id !== h.id) ? h2.id : '',
      shaxs: typeof y.shaxs === 'string' ? birQator(y.shaxs).slice(0, NOM_MAX) : '', sana: sanaYaroqli(y.sana, bugun) ? y.sana : bugun,
      izoh: birQator(y.izoh).slice(0, IZOH_MAX), vaqt: soatYaroqli(qosh.soat) ? qosh.soat : '', ogohlantirish: ogoh, xatolar: {}, saqlanmoqda: false
    };
    return oxirgiHisobQoy(karta, m, qosh.oxirgi);
  }
  // Tepada doim bitta qator, undan keyin serverning ogohlantirishlari
  function ogohlantirishlar(k) { return [UMUMIY_OGOHLANTIRISH].concat(k.ogohlantirish || []); }

  // ---- Tur almashtirish: summa, izoh, sana, hisob saqlanadi; kategoriya faqat yangi tur uchun mos bo'lsa ----
  function turAlmashtir(k, yangiTur, m, oxirgi) {
    var o = { tur: yangiTur, xatolar: {} };
    if (yangiTur === 'qarz') o.qarzAmal = k.qarzAmal || 'berdim';
    if (yangiTur === 'xarajat' || yangiTur === 'daromad') {
      var kat = faolKategoriyalar(m).filter(function (x) { return x.id === k.kategoriya; })[0];
      o.kategoriya = kat && kat.tur === yangiTur ? kat.id : '';
    } else o.kategoriya = '';
    return oxirgiHisobQoy(nusxa(k, o), m, oxirgi);
  }
  function qarzAmalAlmashtir(k, amal) { return nusxa(k, { qarzAmal: amal, xatolar: {} }); }

  // ---- Kartadagi yozuvlar ----
  function kategoriyaRoyxati(m, tur) { return faolKategoriyalar(m).filter(function (k) { return k.tur === tur; }); }
  // Qarzdagi "Kim" tavsiyalari: qaytarishda faqat shu yo'nalishdagi ochiq qarz egalari, aks holda barcha shaxslar
  function shaxslar(m, amal) {
    var yon = amal === 'qaytardim' ? 'oldim' : amal === 'qaytarildi' ? 'berdim' : null, korilgan = {}, chiq = [];
    (m.qarzlar || []).forEach(function (q) {
      if (!jonli(q) || (yon && (q.yonalish !== yon || Calc.qarzYopilganmi(q)))) return;
      var kalit = kalitNom(q.shaxs);
      if (!kalit || korilgan[kalit]) return;
      korilgan[kalit] = true; chiq.push(q.shaxs);
    });
    return chiq;
  }
  function hisobBelgisi(k, qaysi) {
    if (k.tur === 'otkazma') return qaysi === 2 ? 'Qaysi hisobga' : 'Qaysi hisobdan';
    if (k.tur === 'qarz') return k.qarzAmal === 'berdim' || k.qarzAmal === 'qaytardim' ? 'Pul qaysi hisobdan chiqdi' : 'Pul qaysi hisobga tushdi';
    return 'Hisob';
  }
  function shaxsBelgisi(k) { return k.qarzAmal === 'berdim' || k.qarzAmal === 'qaytardim' ? 'Kimga' : 'Kimdan'; }

  // ---- Majburiy maydonlar va saqlashga tayyorlash ----
  // Qaytarish (qaytardim/qaytarildi) mavjud ochiq qarzga to'lov bo'ladi: shaxs bo'yicha eng eski ochiq qarz tanlanadi
  function ochiqQarzTop(m, amal, shaxs) {
    var yon = amal === 'qaytardim' ? 'oldim' : 'berdim', kalit = kalitNom(shaxs);
    var royxat = (m.qarzlar || []).filter(function (q) { return jonli(q) && q.yonalish === yon && !Calc.qarzYopilganmi(q) && kalitNom(q.shaxs) === kalit; });
    royxat.sort(function (a, b) { var x = a.sana + ' ' + (a.vaqt || '00:00'), z = b.sana + ' ' + (b.vaqt || '00:00'); return x < z ? -1 : x > z ? 1 : 0; });
    return royxat[0] || null;
  }
  // To'ldirilmagan majburiy maydonlar: { maydon: 'Tanlang' | 'Kiriting' }. Maydonlar: summa, kategoriya, hisob, hisob2, shaxs, sana
  function majburiyXatolar(k, m) {
    var x = {};
    if (!String(k.summa || '').replace(/\s/g, '')) x.summa = 'Kiriting';
    var his = faolHisoblar(m);
    var hisobBor = function (id) { return his.some(function (h) { return h.id === id; }); };
    if (k.tur === 'xarajat' || k.tur === 'daromad') {
      if (!kategoriyaRoyxati(m, k.tur).some(function (c) { return c.id === k.kategoriya; })) x.kategoriya = 'Tanlang';
    }
    if (!hisobBor(k.hisob)) x.hisob = 'Tanlang';
    if (k.tur === 'otkazma' && !hisobBor(k.hisob2)) x.hisob2 = 'Tanlang';
    if (k.tur === 'qarz' && !birQator(k.shaxs)) x.shaxs = 'Kiriting';
    if (!k.sana) x.sana = 'Kiriting';
    if (k.vaqt && !soatYaroqli(k.vaqt)) x.vaqt = 'Soatni to\'g\'ri kiriting';
    return x;
  }
  var QADAM_MAYDON = { summa: 'summa', kategoriya: 'kategoriya', hisob: 'hisob', qayerdan: 'hisob', qayerga: 'hisob2', vaqt: 'sana' };
  var QARZ_MAYDON = { shaxs: 'shaxs', summa: 'summa', hisob: 'hisob', vaqt: 'sana', muddat: 'sana', yonalish: 'shaxs' };
  // Natija: { xatolar: { maydon: matn } } yoki { amal: 'yozuv', yozuv } | { amal: 'qarz', qarz } | { amal: 'tolov', qarzId, tolov }.
  // hozir — Calc.hozir() (saqlash paytida qayta olinadi). Sana bugun bo'lsa soat hozirgi, aks holda 00:00.
  function saqlashNatijasi(k, m, hozir) {
    var xatolar = majburiyXatolar(k, m);
    if (Object.keys(xatolar).length) return { xatolar: xatolar };
    // Soat kiritilgan bo'lsa shu, bo'sh bo'lsa eskicha: sana bugun bo'lsa hozirgi soat, aks holda 00:00
    var vaqt = soatYaroqli(k.vaqt) ? k.vaqt : k.sana === hozir.sana ? hozir.vaqt : '00:00';
    var izoh = birQator(k.izoh).slice(0, IZOH_MAX);
    var xato = function (maydon, matn) { var e = {}; e[maydon] = matn; return { xatolar: e }; };
    if (k.tur === 'qarz' && (k.qarzAmal === 'qaytardim' || k.qarzAmal === 'qaytarildi')) {
      var q = ochiqQarzTop(m, k.qarzAmal, k.shaxs);
      if (!q) return xato('shaxs', 'Bu shaxsda ochiq qarz topilmadi');
      var t = Calc.tolovniTekshir(q, { summa: k.summa, hisob: k.hisob, sana: k.sana, vaqt: vaqt }, hozir);
      if (t.xato) return xato(QARZ_MAYDON[t.maydon] || 'summa', t.xato);
      return { amal: 'tolov', qarzId: q.id, tolov: t.tolov };
    }
    if (k.tur === 'qarz') {
      var r = Calc.qarzniTekshir({ yonalish: k.qarzAmal, shaxs: k.shaxs, summa: k.summa, hisob: k.hisob, sana: k.sana, vaqt: vaqt, muddat: '', izoh: izoh }, hozir);
      if (r.xato) return xato(QARZ_MAYDON[r.maydon] || 'summa', r.xato);
      return { amal: 'qarz', qarz: r.qarz };
    }
    var otk = k.tur === 'otkazma';
    var n = Calc.yozuvniTayyorlash({ tur: k.tur, summa: k.summa, kategoriya: otk ? null : k.kategoriya, hisob: k.hisob, qabul: otk ? k.hisob2 : '', vaqt: { sana: k.sana, vaqt: vaqt }, izoh: izoh }, hozir);
    if (n.xato) return xato(QADAM_MAYDON[n.qadam] || 'summa', n.xato);
    return { amal: 'yozuv', yozuv: n.yozuv };
  }

  return {
    GAP_MAX: GAP_MAX, HISOBLAGICH_BOSHI: HISOBLAGICH_BOSHI, ESKI_MAX: ESKI_MAX, ESKI_IZOH_MAX: ESKI_IZOH_MAX, IZOH_MAX: IZOH_MAX, KARTA_MAX: KARTA_MAX, KUTISH_MS: KUTISH_MS,
    MISOLLAR: MISOLLAR, TURLAR: TURLAR, QARZ_AMALLAR: QARZ_AMALLAR, UMUMIY_OGOHLANTIRISH: UMUMIY_OGOHLANTIRISH, YOZUV_YOQ_MATNI: YOZUV_YOQ_MATNI, TUSHUNARSIZ_MATNI: TUSHUNARSIZ_MATNI,
    soatYaroqli: soatYaroqli, oxirgiHisobQoy: oxirgiHisobQoy, oxirgiYangila: oxirgiYangila, xatoMatni: xatoMatni, sababMatni: sababMatni, hisobTuri: hisobTuri, summaFormat: summaFormat,
    kategoriyaNomlari: kategoriyaNomlari, hisobRoyxati: hisobRoyxati, eskiTanla: eskiTanla, sorovTanasi: sorovTanasi,
    yozuvlarniOl: yozuvlarniOl, kartaYasash: kartaYasash, ogohlantirishlar: ogohlantirishlar,
    turAlmashtir: turAlmashtir, qarzAmalAlmashtir: qarzAmalAlmashtir, kategoriyaRoyxati: kategoriyaRoyxati, shaxslar: shaxslar,
    hisobBelgisi: hisobBelgisi, shaxsBelgisi: shaxsBelgisi, ochiqQarzTop: ochiqQarzTop, majburiyXatolar: majburiyXatolar, saqlashNatijasi: saqlashNatijasi
  };
})();
