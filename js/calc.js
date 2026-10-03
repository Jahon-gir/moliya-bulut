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

  // ---- Yozuv qo'shish qadamlari (wizard): holat obyekti o'zgartirilmaydi, har safar yangi nusxa qaytadi ----
  var QADAMLAR = {
    xarajat: ['summa', 'kategoriya', 'hisob', 'vaqt', 'izoh'],
    daromad: ['summa', 'kategoriya', 'hisob', 'vaqt', 'izoh'],
    otkazma: ['summa', 'qayerdan', 'qayerga', 'vaqt', 'izoh']   // kategoriya va hisob o'rniga "Qayerdan" va "Qayerga"
  };

  // Tur bo'yicha qadamlar tartibi (har doim 5 ta)
  function qadamlar(tur) { return QADAMLAR[tur] || QADAMLAR.xarajat; }

  function nusxa(h, ozgarish) {
    var r = {};
    Object.keys(h).forEach(function (k) { r[k] = h[k]; });
    Object.keys(ozgarish || {}).forEach(function (k) { r[k] = ozgarish[k]; });
    return r;
  }

  // Yangi wizard holati. hisob — oxirgi ishlatilgan hisob (oldindan tanlangan), qabul — o'tkazmada "Qayerga"
  function wizardBoshlash(hisob, qabul) {
    return { qadam: 0, tur: 'xarajat', summa: '', kategoriya: null, hisob: hisob || '', qabul: qabul || '',
      vaqt: null, izoh: '', xato: null };   // vaqt null = "Hozir"
  }
  // Keyingi qadam (oxirgisidan keyin o'zgarmaydi). Kiritilgan qiymatlar saqlanadi.
  function wizardKeyingi(h) { return nusxa(h, { qadam: Math.min(h.qadam + 1, 4), xato: null }); }
  // Oldingi qadam; birinchi qadamda null (shakl yopiladi va tozalanadi). Kiritilgan qiymatlar saqlanadi.
  function wizardOrqaga(h) { return h.qadam === 0 ? null : nusxa(h, { qadam: h.qadam - 1, xato: null }); }
  // Turni almashtirish: kategoriya tozalanadi (turga qarab ro'yxat almashadi), o'tkazmada "Qayerga" "Qayerdan" dan farq qiladi
  function wizardTurAlmashtir(h, tur, faolIdlar) {
    if (h.tur === tur) return h;
    var o = { tur: tur, kategoriya: null, xato: null };
    if (tur === 'otkazma' && (!h.qabul || h.qabul === h.hisob)) {
      o.qabul = (faolIdlar || []).filter(function (id) { return id !== h.hisob; })[0] || '';
    }
    return nusxa(h, o);
  }

  // Wizard holatidan yozuv yasaydi (to'liq yoki tezkor saqlash uchun). Hali kirilmagan qadamlar standart qiymat oladi:
  // hisob — oldindan tanlangan (oxirgi ishlatilgani), sana va vaqt — hozirgi (`vaqt` null bo'lsa), izoh — bo'sh.
  // Tekshiruvlar avvalgidek: summa, kategoriya, hisob, o'tkazmada ikki hisob va yozuv vaqti (hozirgi vaqt hozirgi
  // bilan solishtiriladi, ya'ni g'ildirakdan keyingi ikkinchi himoya). Natija: { yozuv } yoki { xato, qadam }.
  function yozuvniTayyorlash(h, hozirgi) {
    var t = summaTekshir(h.summa);
    if (t.xato) return { xato: t.xato, qadam: 'summa' };
    var otkazma = h.tur === 'otkazma';
    if (!otkazma && !h.kategoriya) return { xato: 'Kategoriyani tanlang', qadam: 'kategoriya' };
    if (!h.hisob) return { xato: 'Hisobni tanlang', qadam: otkazma ? 'qayerdan' : 'hisob' };
    if (otkazma) {
      var ox = otkazmaTekshir(h.hisob, h.qabul);
      if (ox) return { xato: ox, qadam: 'qayerga' };
    }
    var v = h.vaqt || { sana: hozirgi.sana, vaqt: hozirgi.vaqt };
    var vt = vaqtTekshir(v.sana, v.vaqt, hozirgi);
    if (vt.xato) return { xato: vt.xato, qadam: 'vaqt' };
    var y = { tur: h.tur, summa: t.summa, sana: v.sana, vaqt: v.vaqt, hisob_id: h.hisob,
      kategoriya_id: otkazma ? null : h.kategoriya, izoh: String(h.izoh || '').trim() };
    if (otkazma) y.qabul_hisob_id = h.qabul;
    return { yozuv: y };
  }

  // Shu turdagi oxirgi ishlatilgan (faol) kategoriya. Hisobdagi kabi tartib: yangi yozuv birinchi.
  function oxirgiKategoriyaId(yozuvlar, tur, faolIdlar) {
    var royxat = yozuvlar.filter(function (y) { return y.tur === tur && y.kategoriya_id; }).sort(yangiTartib);
    for (var i = 0; i < royxat.length; i++) {
      if (faolIdlar.indexOf(royxat[i].kategoriya_id) !== -1) return royxat[i].kategoriya_id;
    }
    return undefined;
  }

  // Rang ustidagi matn rangi: qora yoki oq, qaysi biri bilan kontrast kattaroq bo'lsa (WCAG).
  // Tayyor kategoriya ranglarida qora matn kamida 5.7:1 kontrast beradi
  function matnRangi(hex) {
    function nur(r, g, b) {
      return [r, g, b].map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); })
        .reduce(function (a, v, i) { return a + v * [0.2126, 0.7152, 0.0722][i]; }, 0);
    }
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex));
    if (!m) return '#000000';
    var L = nur(parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16));
    // qora matn bilan kontrast (L+0.05)/0.05, oq matn bilan 1.05/(L+0.05)
    return (L + 0.05) / 0.05 >= 1.05 / (L + 0.05) ? '#000000' : '#ffffff';
  }

  // ---- Sana va vaqt g'ildiragi: qaysi qiymatlar tanlanadi, qaysilari kulrang (kelajak) ----
  var GLIDIRAK_BOSHI = 2000;   // g'ildirakdagi eng erta yil

  function oyKunlari(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }

  // "2026-10-03", "21:00" -> { y: 2026, m: 10, d: 3, H: 21, M: 0 }
  function vaqtdanTanlov(sana, vaqt) {
    var p = sanaQismlari(sana), q = String(vaqt || '00:00').split(':');
    return { y: p.y, m: p.m, d: p.d, H: parseInt(q[0], 10) || 0, M: parseInt(q[1], 10) || 0 };
  }
  // { y, m, d, H, M } -> { sana: "YYYY-MM-DD", vaqt: "HH:MM" }
  function tanlovdanVaqt(t) {
    return { sana: t.y + '-' + ikki(t.m) + '-' + ikki(t.d), vaqt: ikki(t.H) + ':' + ikki(t.M) };
  }

  // Har ustun uchun eng katta ruxsat etilgan qiymat (boshqa ustunlardagi tanlovga qarab). hozirgi — hozir() natijasi.
  function glidirakChegarasi(t, hozirgi) {
    var n = vaqtdanTanlov(hozirgi.sana, hozirgi.vaqt);
    var buOy = t.y === n.y && t.m === n.m, bugun = buOy && t.d === n.d;
    return {
      yil: n.y,
      oy: t.y >= n.y ? n.m : 12,
      kun: Math.min(oyKunlari(t.y, t.m), buOy ? n.d : 31),
      soat: bugun ? n.H : 23,
      daqiqa: bugun && t.H === n.H ? n.M : 59
    };
  }

  // Tanlovni ruxsat etilgan eng yaqin qiymatga keltiradi: kelajak qiymatlar hozirgi vaqtga qaytariladi,
  // oyning kunlari soniga (28/29/30/31) moslanadi. Takror chaqirilsa o'zgarmaydi.
  function glidirakTuzat(t, hozirgi) {
    var n = vaqtdanTanlov(hozirgi.sana, hozirgi.vaqt);
    var r = { y: Math.max(GLIDIRAK_BOSHI, Math.min(t.y, n.y)) };
    r.m = Math.max(1, Math.min(t.m, r.y === n.y ? n.m : 12));
    r.d = Math.max(1, Math.min(t.d, glidirakChegarasi({ y: r.y, m: r.m, d: 1 }, hozirgi).kun));
    var bugun = r.y === n.y && r.m === n.m && r.d === n.d;
    r.H = Math.max(0, Math.min(t.H, bugun ? n.H : 23));
    r.M = Math.max(0, Math.min(t.M, bugun && r.H === n.H ? n.M : 59));
    return r;
  }

  // Ustun qiymatlari ro'yxati: [{ qiymat, ochiq }], ochiq=false — kulrang, tanlanmaydi.
  // ustun: 'yil' | 'oy' | 'kun' | 'soat' | 'daqiqa'
  function glidirakQiymatlari(ustun, t, hozirgi) {
    var n = vaqtdanTanlov(hozirgi.sana, hozirgi.vaqt), ch = glidirakChegarasi(t, hozirgi), r = [], i;
    var boshi = { yil: GLIDIRAK_BOSHI, oy: 1, kun: 1, soat: 0, daqiqa: 0 }[ustun];
    var oxiri = { yil: n.y, oy: 12, kun: oyKunlari(t.y, t.m), soat: 23, daqiqa: 59 }[ustun];
    for (i = boshi; i <= oxiri; i++) r.push({ qiymat: i, ochiq: i <= ch[ustun] });
    return r;
  }

  // ---- Diagrammalar uchun hisob-kitoblar (ekran bilan ishlamaydi) ----
  var OY_QISQA = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
  var HAFTA_KUNI_QISQA = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];   // dushanbadan yakshanbagacha

  // Katta summalarni qisqartiradi (o'qlar uchun): 1200000 -> "1,2 mln", 5000 -> "5 ming", 2500000000 -> "2,5 mlrd"
  function qisqaSum(n) {
    var manfiy = n < 0, a = Math.abs(Math.round(n)), birliklar = [[1e12, 'trln'], [1e9, 'mlrd'], [1e6, 'mln'], [1e3, 'ming']];
    function yoz(v, nom) { return String(v).replace('.', ',') + ' ' + nom; }
    var natija = String(a);
    for (var i = 0; i < birliklar.length; i++) {
      if (a < birliklar[i][0]) continue;
      var r = Math.round(a / birliklar[i][0] * 10) / 10;
      if (r >= 1000 && i > 0) {   // 999 950 -> "1000 ming" emas, "1 mln"
        natija = yoz(Math.round(a / birliklar[i - 1][0] * 10) / 10, birliklar[i - 1][1]);
      } else natija = yoz(r, birliklar[i][1]);
      break;
    }
    return (manfiy && a ? '−' : '') + natija;
  }

  // O'q uchun "chiroyli" qadamlar: eng katta qiymatni qoplaydigan 0, q, 2q, ... (q = 1, 2, 2.5, 5 × 10^k, butun so'm).
  // Natija: { tiklar: [0, ...], eng: oxirgi tik }
  function chiroyliTiklar(eng, soni) {
    soni = soni || 4;
    if (!(eng > 0)) return { tiklar: [0, 1], eng: 1 };
    var xom = eng / soni, daraja = Math.pow(10, Math.floor(Math.log10(xom))), qadam = daraja * 10;
    [1, 2, 2.5, 5, 10].some(function (m) { if (m * daraja >= xom) { qadam = m * daraja; return true; } return false; });
    qadam = Math.max(1, Math.round(qadam));
    var n = Math.ceil(eng / qadam - 1e-9), tiklar = [];
    for (var i = 0; i <= n; i++) tiklar.push(i * qadam);
    return { tiklar: tiklar, eng: tiklar[n] };
  }

  // Vaqt bo'yicha ustunli diagramma ma'lumoti: hafta va oyda kunlar, yilda oylar (kun davri uchun null).
  // Har ustunda daromad va xarajat. Yig'indilar hisobot (hisobot()) bilan bir xil qoidada: faqat daromad va xarajat,
  // o'tkazma kirmaydi, hisobId berilsa shu hisob bo'yicha. Natija: { bucketlar, jami, eng, davrNomi }
  function diagrammaVaqt(yozuvlar, tur, sana, hisobId) {
    if (tur === 'kun') return null;
    var c = davrChegarasi(tur, sana), bucketlar = [], indeks = {};
    function qosh(kalit, dan, gacha, qisqa, qisqa2, toliq) {
      indeks[kalit] = bucketlar.length;
      bucketlar.push({ kalit: kalit, dan: dan, gacha: gacha, qisqa: qisqa, qisqa2: qisqa2, toliq: toliq, daromad: 0, xarajat: 0, soni: 0 });
    }
    if (tur === 'yil') {
      var yil = sanaQismlari(c.dan).y;
      for (var m = 1; m <= 12; m++) {
        var oyChegara = davrChegarasi('oy', yil + '-' + ikki(m) + '-01');
        qosh(yil + '-' + ikki(m), oyChegara.dan, oyChegara.gacha, OY_QISQA[m - 1], '', OY_NOMLARI[m - 1] + ' ' + yil);
      }
    } else {
      for (var kun = c.dan; kun <= c.gacha; kun = kunQosh(kun, 1)) {
        var q = sanaQismlari(kun);
        qosh(kun, kun, kun, tur === 'hafta' ? HAFTA_KUNI_QISQA[(sanaUTC(kun).getUTCDay() + 6) % 7] : String(q.d),
          tur === 'hafta' ? ikki(q.d) + '.' + ikki(q.m) : '', sanaKorsat(kun));
      }
    }
    var jami = { daromad: 0, xarajat: 0 }, eng = 0;
    yozuvlar.forEach(function (y) {
      if (y.tur !== 'daromad' && y.tur !== 'xarajat') return;
      if (y.sana < c.dan || y.sana > c.gacha) return;
      if (hisobId && y.hisob_id !== hisobId) return;
      var b = bucketlar[indeks[tur === 'yil' ? y.sana.slice(0, 7) : y.sana]];
      if (!b) return;
      b[y.tur] += y.summa; b.soni++; jami[y.tur] += y.summa;
    });
    bucketlar.forEach(function (b) { eng = Math.max(eng, b.daromad, b.xarajat); });
    return { tur: tur, dan: c.dan, gacha: c.gacha, bucketlar: bucketlar, jami: jami, eng: eng, davrNomi: davrNomi(tur, sana) };
  }

  // Doira tilimlari burchaklari: taqsimot [{ kategoriya_id, summa, foiz }] -> har tilimga a0, a1 (radian), ulush.
  // Burchak summaga aniq mutanosib (foiz yaxlitlanadi, burchak yaxlitlanmaydi). Boshlanish — tepada (−90°), soat mili bo'yicha.
  function tilimBurchaklari(taqsimot, boshBurchak) {
    var jami = taqsimot.reduce(function (a, x) { return a + x.summa; }, 0), a = boshBurchak === undefined ? -Math.PI / 2 : boshBurchak;
    if (!jami) return [];
    return taqsimot.map(function (x) {
      var burchak = 2 * Math.PI * x.summa / jami, r = { kategoriya_id: x.kategoriya_id, summa: x.summa, foiz: x.foiz, ulush: x.summa / jami, a0: a, a1: a + burchak };
      a += burchak;
      return r;
    });
  }

  // Halqa (donut) tilimining SVG yo'li: tashqi radius r2, ichki r1, a0 dan a1 gacha (radian, soat mili bo'yicha)
  function yoyYoli(cx, cy, r1, r2, a0, a1) {
    var katta = (a1 - a0) > Math.PI ? 1 : 0;
    function n(r, a) { return (Math.round((cx + r * Math.cos(a)) * 100) / 100) + ' ' + (Math.round((cy + r * Math.sin(a)) * 100) / 100); }
    return 'M' + n(r2, a0) + ' A' + r2 + ' ' + r2 + ' 0 ' + katta + ' 1 ' + n(r2, a1) + ' L' + n(r1, a1) +
      ' A' + r1 + ' ' + r1 + ' 0 ' + katta + ' 0 ' + n(r1, a0) + ' Z';
  }

  // Ustun balandligi: qiymatga mutanosib, lekin 0 dan katta qiymat ko'rinmay qolmasligi uchun kamida `minimal` piksel
  function ustunBalandligi(qiymat, eng, balandlik, minimal) {
    if (!(qiymat > 0) || !(eng > 0)) return 0;
    return Math.max(minimal === undefined ? 2 : minimal, Math.min(balandlik, qiymat / eng * balandlik));
  }

  // ---- Doira: eng katta kategoriyalar alohida, qolganlari "Boshqalar" ----
  var DONA_ENG_KATTA = 6;
  // taqsimot — kattasidan kichigiga [{ kategoriya_id, summa, foiz }]. Eng katta `soni` (6) ta kategoriya alohida tilim,
  // qolganlari bitta "Boshqalar" tilimiga birlashadi: summa — yig'indi, foiz — kategoriyalar foizlari yig'indisi
  // (shunda ro'yxat va diagramma foizlari mos, jami 100 qoladi). Qolgani bitta kategoriya bo'lsa, birlashtirish ma'nosiz,
  // u o'z tilimida qoladi (7 ta kategoriya = 7 tilim). Natija: { tilimlar, boshqalar | null, dum: [birlashganlar] }
  function donaGuruhlash(taqsimot, soni) {
    soni = soni || DONA_ENG_KATTA;
    if (taqsimot.length < soni + 2) return { tilimlar: taqsimot.slice(), boshqalar: null, dum: [] };
    var dum = taqsimot.slice(soni);
    var guruh = {
      kategoriya_id: 'boshqalar', soni: dum.length,
      summa: dum.reduce(function (a, x) { return a + x.summa; }, 0), foiz: dum.reduce(function (a, x) { return a + x.foiz; }, 0),
      idlar: dum.map(function (x) { return x.kategoriya_id; })
    };
    return { tilimlar: taqsimot.slice(0, soni).concat([guruh]), boshqalar: guruh, dum: dum };
  }

  // ---- Byudjet (TZ F7): joriy kalendar oyi xarajatlari bo'yicha oylik chegaralar ----
  var BYUDJET_OGOHLANTIRISH = 80;   // foiz: shundan oshsa sariq, 100 dan oshsa qizil

  // Chegara holati. sarflangan va limit — butun so'm. Chegaralar aniq (butun sonlarda) solishtiriladi:
  // 80% dan oshsa (aynan 80% emas) — 'sariq', 100% dan oshsa (aynan 100% emas) — 'qizil', aks holda 'yaxshi'.
  // foiz — ko'rsatish uchun butun son, u hech qachon rangga zid kelmaydi (sariqda kamida 81, qizilda kamida 101).
  // chiziq — to'lish chizig'ining kengligi (0..100, aniq nisbat).
  function byudjetHolati(sarflangan, limit) {
    var daraja = sarflangan > limit ? 'qizil' : sarflangan * 5 > limit * 4 ? 'sariq' : 'yaxshi';
    var foiz = limit > 0 ? Math.round(sarflangan * 100 / limit) : 0;
    if (daraja === 'qizil' && foiz < 101) foiz = 101;
    else if (daraja === 'sariq' && foiz < 81) foiz = 81;
    return {
      sarflangan: sarflangan, limit: limit, daraja: daraja, foiz: foiz,
      qolgan: Math.max(0, limit - sarflangan), oshgan: Math.max(0, sarflangan - limit),
      chiziq: limit > 0 ? Math.min(100, sarflangan * 100 / limit) : 0
    };
  }

  // Joriy oy byudjet hisoboti. byudjetlar — [{ kategoriya_id | 'umumiy', oylik_limit }]; kategoriyalar — hamma kategoriyalar;
  // bugunSana — bugungi sana (joriy kalendar oyi shundan olinadi). Sarflangan summalar hisobot() bilan bir xil (shu oy, barcha
  // hisoblar, faqat xarajat; o'tkazma kirmaydi). Arxivlangan kategoriyalar ko'rsatilmaydi.
  // Natija: { oy, umumiy | null, chegarali: [...], chegarasiz: [...], ogohlantirishlar: [...] } (ogohlantirishlar: sariq va qizil, ko'pi bilan to'lganlari birinchi)
  function byudjetHisobi(byudjetlar, kategoriyalar, yozuvlar, bugunSana) {
    var oy = davrChegarasi('oy', bugunSana), h = hisobot(yozuvlar, oy.dan, oy.gacha, ''), sarf = {}, limitlar = {};
    h.xarajatTaqsimoti.forEach(function (x) { sarf[x.kategoriya_id] = x.summa; });
    byudjetlar.forEach(function (b) { if (b.oylik_limit > 0) limitlar[b.kategoriya_id] = b.oylik_limit; });
    function nisbat(a, b) { return b.holat.sarflangan * a.holat.limit - a.holat.sarflangan * b.holat.limit; }   // kattasi birinchi
    var chegarali = [], chegarasiz = [];
    kategoriyalar.forEach(function (k) {
      if (k.tur !== 'xarajat' || k.arxivlangan) return;
      var sarflangan = sarf[k.id] || 0;
      if (limitlar[k.id]) chegarali.push({ kategoriya: k, holat: byudjetHolati(sarflangan, limitlar[k.id]) });
      else chegarasiz.push({ kategoriya: k, sarflangan: sarflangan });
    });
    chegarali.sort(nisbat);
    var umumiy = limitlar.umumiy ? { umumiy: true, holat: byudjetHolati(h.xarajat, limitlar.umumiy) } : null;
    var ogoh = chegarali.concat(umumiy ? [umumiy] : []).filter(function (x) { return x.holat.daraja !== 'yaxshi'; }).sort(nisbat);
    return { oy: oy, oyNomi: davrNomi('oy', bugunSana), umumiy: umumiy, chegarali: chegarali, chegarasiz: chegarasiz, ogohlantirishlar: ogoh, jami: h.xarajat };
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
  // tur, hisob (yozuvning hisobi yoki o'tkazmaning qabul hisobi), kategoriya (bitta) yoki kategoriyalar (bir nechta: "Boshqalar"),
  // dan / gacha (sana oralig'i, chegaralari bilan), qidiruv (izoh ichidan, harf kattaligiga qaramay).
  function yozuvlarniSuz(yozuvlar, f) {
    f = f || {};
    var q = String(f.qidiruv || '').trim().toLowerCase();
    return yozuvlar.filter(function (y) {
      if (f.tur && y.tur !== f.tur) return false;
      if (f.hisob && y.hisob_id !== f.hisob && y.qabul_hisob_id !== f.hisob) return false;
      if (f.kategoriya && y.kategoriya_id !== f.kategoriya) return false;
      if (f.kategoriyalar && f.kategoriyalar.length && f.kategoriyalar.indexOf(y.kategoriya_id) === -1) return false;
      if (f.dan && y.sana < f.dan) return false;
      if (f.gacha && y.sana > f.gacha) return false;
      if (q && String(y.izoh || '').toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
  }

  // Filtrda biror shart (qidiruvdan tashqari) tanlanganmi
  function filtrFaolmi(f) {
    return !!(f && (f.tur || f.hisob || f.kategoriya || (f.kategoriyalar && f.kategoriyalar.length) || f.dan || f.gacha));
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
    qadamlar: qadamlar, wizardBoshlash: wizardBoshlash, wizardKeyingi: wizardKeyingi, wizardOrqaga: wizardOrqaga,
    wizardTurAlmashtir: wizardTurAlmashtir, yozuvniTayyorlash: yozuvniTayyorlash,
    oxirgiKategoriyaId: oxirgiKategoriyaId, matnRangi: matnRangi,
    oyKunlari: oyKunlari, vaqtdanTanlov: vaqtdanTanlov, tanlovdanVaqt: tanlovdanVaqt,
    glidirakChegarasi: glidirakChegarasi, glidirakTuzat: glidirakTuzat, glidirakQiymatlari: glidirakQiymatlari,
    donaGuruhlash: donaGuruhlash, DONA_ENG_KATTA: DONA_ENG_KATTA, byudjetHolati: byudjetHolati, byudjetHisobi: byudjetHisobi,
    BYUDJET_OGOHLANTIRISH: BYUDJET_OGOHLANTIRISH, OY_QISQA: OY_QISQA, HAFTA_KUNI_QISQA: HAFTA_KUNI_QISQA, qisqaSum: qisqaSum, chiroyliTiklar: chiroyliTiklar,
    diagrammaVaqt: diagrammaVaqt, tilimBurchaklari: tilimBurchaklari, yoyYoli: yoyYoli, ustunBalandligi: ustunBalandligi,
    hozir: hozir, kelajakmi: kelajakmi, vaqtTekshir: vaqtTekshir, yozuvVaqti: yozuvVaqti,
    vaqtFormatiTogrimi: vaqtFormatiTogrimi, yozuvniYangilash: yozuvniYangilash,
    oxirgiYozuvlar: oxirgiYozuvlar, kunlarBoyicha: kunlarBoyicha, oxirgiHisobId: oxirgiHisobId
  };
})(typeof window !== 'undefined' ? window : this);
