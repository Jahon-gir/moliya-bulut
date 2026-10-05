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
  // past (ixtiyoriy) — eng erta ruxsat etilgan sana "YYYY-MM-DD" (faqat sana tanlagichi uchun: erkin davrning tugash sanasi)
  function glidirakTuzat(t, hozirgi, past) {
    var n = vaqtdanTanlov(hozirgi.sana, hozirgi.vaqt);
    var r = { y: Math.max(GLIDIRAK_BOSHI, Math.min(t.y, n.y)) };
    r.m = Math.max(1, Math.min(t.m, r.y === n.y ? n.m : 12));
    r.d = Math.max(1, Math.min(t.d, glidirakChegarasi({ y: r.y, m: r.m, d: 1 }, hozirgi).kun));
    var bugun = r.y === n.y && r.m === n.m && r.d === n.d;
    r.H = Math.max(0, Math.min(t.H, bugun ? n.H : 23));
    r.M = Math.max(0, Math.min(t.M, bugun && r.H === n.H ? n.M : 59));
    if (past) {
      var q = sanaQismlari(past);
      if (r.y < q.y) r.y = q.y;
      if (r.y === q.y && r.m < q.m) r.m = q.m;
      if (r.y === q.y && r.m === q.m && r.d < q.d) r.d = q.d;
    }
    return r;
  }

  // Ustun qiymatlari ro'yxati: [{ qiymat, ochiq }], ochiq=false — kulrang, tanlanmaydi.
  // ustun: 'yil' | 'oy' | 'kun' | 'soat' | 'daqiqa'
  function glidirakQiymatlari(ustun, t, hozirgi, past) {
    var n = vaqtdanTanlov(hozirgi.sana, hozirgi.vaqt), ch = glidirakChegarasi(t, hozirgi), r = [], i;
    var boshi = { yil: GLIDIRAK_BOSHI, oy: 1, kun: 1, soat: 0, daqiqa: 0 }[ustun];
    var oxiri = { yil: n.y, oy: 12, kun: oyKunlari(t.y, t.m), soat: 23, daqiqa: 59 }[ustun];
    var q = past ? sanaQismlari(past) : null, pastChegara = !q ? boshi : ustun === 'yil' ? q.y
      : ustun === 'oy' ? (t.y <= q.y ? q.m : 1) : ustun === 'kun' ? (t.y === q.y && t.m === q.m ? q.d : 1) : boshi;
    for (i = boshi; i <= oxiri; i++) r.push({ qiymat: i, ochiq: i <= ch[ustun] && i >= pastChegara });
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

  // ---- Hisobot filtri: davr (kun/hafta/oy/yil yoki erkin oraliq), filtr oynasi, ustunli diagramma guruhlari ----
  // Kunlar soni (ikkala chekka ham kiradi)
  function kunlarSoni(dan, gacha) { return Math.round((sanaUTC(gacha) - sanaUTC(dan)) / 86400000) + 1; }

  // "01.10.2026 – 07.10.2026"; bitta kun bo'lsa "01.10.2026"
  function oraliqNomi(dan, gacha) { return dan === gacha ? sanaKorsat(dan) : sanaKorsat(dan) + ' – ' + sanaKorsat(gacha); }

  // Erkin davr tekshiruvi: tugash boshlanishdan oldin bo'lmasin, ikkalasi ham bugundan keyin bo'lmasin.
  // Natija: { soni } yoki { xato }
  function oraliqTekshir(dan, gacha, bugunSana) {
    if (!dan || !gacha) return { xato: 'Boshlanish va tugash sanasini tanlang' };
    if (dan > bugunSana) return { xato: 'Boshlanish sanasi bugundan keyin bo\'lmasin' };
    if (gacha > bugunSana) return { xato: 'Tugash sanasi bugundan keyin bo\'lmasin' };
    if (gacha < dan) return { xato: 'Tugash sanasi boshlanishdan oldin bo\'lmasin' };
    return { soni: kunlarSoni(dan, gacha) };
  }

  // Erkin davrni n davr uzunligiga suradi (n = -1: xuddi shuncha kunlik oldingi oraliq)
  function oraliqSur(dan, gacha, n) {
    var k = kunlarSoni(dan, gacha) * n;
    return { dan: kunQosh(dan, k), gacha: kunQosh(gacha, k) };
  }

  // Hisobot davri va taqqoslash uchun oldingi davr. tur: 'kun' | 'hafta' | 'oy' | 'yil' | 'davr'.
  // 'davr' uchun dan va gacha beriladi, oldingi davr — xuddi shuncha kunlik oldingi oraliq; boshqalarda sana tushgan davr.
  // Natija: { dan, gacha, nom, soni, oldingi: { dan, gacha, nom } }
  function hisobotDavri(tur, sana, dan, gacha) {
    if (tur === 'davr') {
      var o = oraliqSur(dan, gacha, -1);
      return { tur: tur, dan: dan, gacha: gacha, nom: oraliqNomi(dan, gacha), soni: kunlarSoni(dan, gacha),
        oldingi: { dan: o.dan, gacha: o.gacha, nom: oraliqNomi(o.dan, o.gacha) } };
    }
    var c = davrChegarasi(tur, sana), oldSana = davrniSur(tur, sana, -1), oc = davrChegarasi(tur, oldSana);
    return { tur: tur, dan: c.dan, gacha: c.gacha, nom: davrNomi(tur, sana), soni: kunlarSoni(c.dan, c.gacha),
      oldingi: { dan: oc.dan, gacha: oc.gacha, nom: davrNomi(tur, oldSana) } };
  }

  // Filtr oynasi: yilning 12 oyi, kelajak oylar ochiq emas (kulrang). Natija: [{ oy: 1..12, ochiq }]
  function filtrOylari(yil, bugunSana) {
    var b = sanaQismlari(bugunSana), r = [];
    for (var m = 1; m <= 12; m++) r.push({ oy: m, ochiq: yil < b.y || (yil === b.y && m <= b.m) });
    return r;
  }
  // Filtr oynasi: yillar ro'yxati — eng erta yozuv yilidan (yoki oxirgi 4 yildan) bugungi yilgacha; kelajak yillar yo'q
  function filtrYillari(birinchiSana, bugunSana) {
    var bu = sanaQismlari(bugunSana).y, boshi = bu - 3, r = [];
    if (birinchiSana) boshi = Math.min(boshi, sanaQismlari(birinchiSana).y);
    for (var y = boshi; y <= bu; y++) r.push(y);
    return r;
  }
  // Filtr oynasidagi tanlovni hisobot holatiga aylantiradi (yoki xato). chastota: 'oy' | 'yil' | 'davr'
  function filtrQollash(t, bugunSana) {
    var b = sanaQismlari(bugunSana);
    if (t.chastota === 'oy') {
      if (t.yil > b.y || (t.yil === b.y && t.oy > b.m)) return { xato: 'Kelajak oyni tanlab bo\'lmaydi' };
      return { tur: 'oy', sana: t.yil + '-' + ikki(t.oy) + '-01' };
    }
    if (t.chastota === 'yil') {
      if (t.yil > b.y) return { xato: 'Kelajak yilni tanlab bo\'lmaydi' };
      return { tur: 'yil', sana: t.yil + '-01-01' };
    }
    var r = oraliqTekshir(t.dan, t.gacha, bugunSana);
    return r.xato ? r : { tur: 'davr', dan: t.dan, gacha: t.gacha };
  }

  // Erkin davr uchun ustunli diagramma ma'lumoti (diagrammaVaqt bilan bir xil tuzilma va hisoblash qoidasi).
  // 31 kungacha — kunlar, 366 kungacha (1 yil) — haftalar (dushanba–yakshanba, davr chetlarida qisqartiriladi),
  // undan uzunda — oylar. Natija: { tur: 'oraliq', birlik: 'kun'|'hafta'|'oy', birlikNomi, bucketlar, jami, eng, davrNomi, dan, gacha }
  function diagrammaOraliq(yozuvlar, dan, gacha, hisobId) {
    var soni = kunlarSoni(dan, gacha), birlik = soni <= 31 ? 'kun' : soni <= 366 ? 'hafta' : 'oy', bucketlar = [];
    function qosh(kalit, d1, d2, qisqa, qisqa2, toliq) {
      bucketlar.push({ kalit: kalit, dan: d1, gacha: d2, qisqa: qisqa, qisqa2: qisqa2, toliq: toliq, daromad: 0, xarajat: 0, soni: 0 });
    }
    var haftaBoshi = kunQosh(dan, -((sanaUTC(dan).getUTCDay() + 6) % 7)), pb = sanaQismlari(dan);
    if (birlik === 'kun') {
      for (var k = dan; k <= gacha; k = kunQosh(k, 1)) {
        var q = sanaQismlari(k);
        qosh(k, k, k, String(q.d), (k === dan || q.d === 1) ? OY_QISQA[q.m - 1] : '', sanaKorsat(k));
      }
    } else if (birlik === 'hafta') {
      for (var h = haftaBoshi; h <= gacha; h = kunQosh(h, 7)) {
        var d1 = h < dan ? dan : h, e = kunQosh(h, 6), d2 = e > gacha ? gacha : e, p1 = sanaQismlari(d1);
        qosh(d1, d1, d2, ikki(p1.d) + '.' + ikki(p1.m), '', oraliqNomi(d1, d2));
      }
    } else {
      var y = pb.y, m = pb.m;
      while (y + '-' + ikki(m) + '-01' <= gacha) {
        var oc = davrChegarasi('oy', y + '-' + ikki(m) + '-01');
        qosh(y + '-' + ikki(m), oc.dan < dan ? dan : oc.dan, oc.gacha > gacha ? gacha : oc.gacha, OY_QISQA[m - 1],
          (m === 1 || (y === pb.y && m === pb.m)) ? String(y) : '', OY_NOMLARI[m - 1] + ' ' + y);
        if (++m > 12) { m = 1; y++; }
      }
    }
    function indeks(sana) {
      if (birlik === 'kun') return kunlarSoni(dan, sana) - 1;
      if (birlik === 'hafta') return Math.floor((kunlarSoni(haftaBoshi, sana) - 1) / 7);
      var q = sanaQismlari(sana);
      return (q.y - pb.y) * 12 + q.m - pb.m;
    }
    var jami = { daromad: 0, xarajat: 0 }, eng = 0;
    yozuvlar.forEach(function (y) {
      if (y.tur !== 'daromad' && y.tur !== 'xarajat') return;
      if (y.sana < dan || y.sana > gacha) return;
      if (hisobId && y.hisob_id !== hisobId) return;
      var b = bucketlar[indeks(y.sana)];
      if (!b) return;
      b[y.tur] += y.summa; b.soni++; jami[y.tur] += y.summa;
    });
    bucketlar.forEach(function (b) { eng = Math.max(eng, b.daromad, b.xarajat); });
    return { tur: 'oraliq', birlik: birlik, birlikNomi: { kun: 'kunlar', hafta: 'haftalar', oy: 'oylar' }[birlik], dan: dan, gacha: gacha,
      bucketlar: bucketlar, jami: jami, eng: eng, davrNomi: oraliqNomi(dan, gacha) };
  }

  // ---- Qarzlar (TZ F8) ----
  // Qarz: { id, yonalish: 'berdim' | 'oldim', shaxs, summa, hisob_id, sana, vaqt, muddat ('' yoki sana), izoh,
  //         tolovlar: [{ id, sana, vaqt, summa, hisob_id }], yopilgan }. Qolgan summa va "yopilgan" holati to'lovlardan hisoblanadi.
  function tolanganSumma(q) {
    return (q.tolovlar || []).reduce(function (a, t) { return a + t.summa; }, 0);
  }
  function qarzQolgan(q) { return Math.max(0, q.summa - tolanganSumma(q)); }
  function qarzYopilganmi(q) { return tolanganSumma(q) >= q.summa; }
  // Muddati o'tgan: muddat bor, qarz yopilmagan va muddat sanasi bugundan oldin (muddat kuni o'zi hali o'tmagan)
  function qarzMuddatiOtdimi(q, bugunSana) { return !!q.muddat && !qarzYopilganmi(q) && q.muddat < bugunSana; }

  // Sxema 2 -> 3 va saqlashdan oldin: qarzda tushib qolgan maydonlarni to'ldiradi, hech narsani o'chirmaydi.
  // Hamma narsa joyida bo'lsa, o'sha obyektning o'zi qaytadi (ikkinchi marta ishlasa ham buzilmaydi).
  function qarzniYangilash(q) {
    var yangi = {}, ozgardi = false;
    Object.keys(q).forEach(function (k) { yangi[k] = q[k]; });
    if (!Array.isArray(q.tolovlar)) { yangi.tolovlar = []; ozgardi = true; }
    else if (q.tolovlar.some(function (t) { return !t.id; })) {   // to'lovni tahrirlash/o'chirish uchun har to'lovda id bo'lsin
      yangi.tolovlar = q.tolovlar.map(function (t, i) { return t.id ? t : Object.assign({}, t, { id: (q.id || 'q') + '-t' + (i + 1) }); });
      ozgardi = true;
    }
    if (!vaqtFormatiTogrimi(q.vaqt)) { yangi.vaqt = '00:00'; ozgardi = true; }
    if (q.muddat === undefined || q.muddat === null) { yangi.muddat = ''; ozgardi = true; }
    if (q.izoh === undefined || q.izoh === null) { yangi.izoh = ''; ozgardi = true; }
    var yopilgan = qarzYopilganmi(yangi);
    if (q.yopilgan !== yopilgan) { yangi.yopilgan = yopilgan; ozgardi = true; }
    return ozgardi ? yangi : q;
  }

  function sanaVaqtKaliti(sana, vaqt) { return sana + ' ' + (vaqt || '00:00'); }

  // Qarz shaklini tekshiradi. h: { yonalish, shaxs, summa (matn), hisob, sana, vaqt, muddat, izoh }.
  // mavjud — tahrirlanayotgan qarz (summa to'langandan kam bo'lmasin, vaqt to'lovlardan keyin bo'lmasin).
  // Natija: { qarz: {yonalish, shaxs, summa, hisob_id, sana, vaqt, muddat, izoh} } yoki { xato, maydon }
  function qarzniTekshir(h, hozirgi, mavjud) {
    if (h.yonalish !== 'berdim' && h.yonalish !== 'oldim') return { xato: 'Yo\'nalishni tanlang', maydon: 'yonalish' };
    var shaxs = String(h.shaxs == null ? '' : h.shaxs).replace(/\s+/g, ' ').trim();
    if (!shaxs) return { xato: 'Shaxs ismini kiriting', maydon: 'shaxs' };
    var t = summaTekshir(h.summa);
    if (t.xato) return { xato: t.xato, maydon: 'summa' };
    if (mavjud && t.summa < tolanganSumma(mavjud)) {
      return { xato: 'Summa to\'langan ' + sumFormat(tolanganSumma(mavjud)) + 'dan kam bo\'lmasin', maydon: 'summa' };
    }
    if (!h.hisob) return { xato: 'Hisobni tanlang', maydon: 'hisob' };
    var v = vaqtTekshir(h.sana, h.vaqt, hozirgi);
    if (v.xato) return { xato: v.xato.replace('Yozuv vaqti', 'Qarz vaqti'), maydon: 'vaqt' };
    var muddat = h.muddat ? String(h.muddat) : '';
    // Qaytarish muddati kelajakda bo'lishi mumkin (vaqt qoidasi unga tegmaydi), lekin qarz sanasidan oldin bo'lmaydi
    if (muddat && (!/^\d{4}-\d{2}-\d{2}$/.test(muddat))) return { xato: 'Qaytarish muddatini to\'g\'ri kiriting', maydon: 'muddat' };
    if (muddat && muddat < h.sana) return { xato: 'Qaytarish muddati qarz sanasidan oldin bo\'lmasin', maydon: 'muddat' };
    if (mavjud) {
      var kalit = sanaVaqtKaliti(h.sana, h.vaqt), oldin = (mavjud.tolovlar || []).filter(function (x) { return sanaVaqtKaliti(x.sana, x.vaqt) < kalit; })[0];
      if (oldin) return { xato: 'Qarz vaqti to\'lovlardan (' + sanaKorsat(oldin.sana) + ' ' + oldin.vaqt + ') keyin bo\'lmasin', maydon: 'vaqt' };
    }
    return { qarz: { yonalish: h.yonalish, shaxs: shaxs, summa: t.summa, hisob_id: h.hisob, sana: h.sana, vaqt: h.vaqt,
      muddat: muddat, izoh: String(h.izoh || '').trim() } };
  }

  // To'lovni tekshiradi. h: { summa (matn), hisob, sana, vaqt }. istisnoId — tahrirlanayotgan to'lovning o'zi.
  // Summa qolgan qarzdan oshmasin; vaqt qarz vaqtidan oldin ham, hozirdan keyin ham bo'lmasin.
  // Natija: { tolov: {summa, hisob_id, sana, vaqt} } yoki { xato, maydon }
  function tolovniTekshir(q, h, hozirgi, istisnoId) {
    var t = summaTekshir(h.summa);
    if (t.xato) return { xato: t.xato, maydon: 'summa' };
    var boshqa = (q.tolovlar || []).filter(function (x) { return x.id !== istisnoId; }).reduce(function (a, x) { return a + x.summa; }, 0);
    var qolgan = Math.max(0, q.summa - boshqa);
    if (t.summa > qolgan) return { xato: 'To\'lov summasi qolgan qarzdan oshmasin (qolgan: ' + sumFormat(qolgan) + ')', maydon: 'summa' };
    if (!h.hisob) return { xato: 'Hisobni tanlang', maydon: 'hisob' };
    var v = vaqtTekshir(h.sana, h.vaqt, hozirgi);
    if (v.xato) return { xato: v.xato.replace('Yozuv vaqti', 'To\'lov vaqti'), maydon: 'vaqt' };
    if (sanaVaqtKaliti(h.sana, h.vaqt) < sanaVaqtKaliti(q.sana, q.vaqt)) {
      return { xato: 'To\'lov vaqti qarz vaqtidan (' + sanaKorsat(q.sana) + ' ' + (q.vaqt || '00:00') + ') oldin bo\'lmasin', maydon: 'vaqt' };
    }
    return { tolov: { summa: t.summa, hisob_id: h.hisob, sana: h.sana, vaqt: h.vaqt } };
  }

  // Qarz va to'lov yig'indilari: { olishKerak: menga qaytarilishi kerak, qaytarishKerak: men qaytarishim kerak }
  function qarzlarJami(qarzlar) {
    var j = { olishKerak: 0, qaytarishKerak: 0 };
    qarzlar.forEach(function (q) { j[q.yonalish === 'berdim' ? 'olishKerak' : 'qaytarishKerak'] += qarzQolgan(q); });
    return j;
  }

  // Ko'rsatiladigan foiz rangga o'xshab ziddiyatsiz: 0 dan katta to'langan 1% dan kam ko'rinmaydi, to'liq bo'lmaganda 100% ko'rinmaydi
  function tolashFoizi(tolangan, summa) {
    if (!summa) return 0;
    var f = Math.round(tolangan * 100 / summa);
    if (tolangan > 0 && f < 1) f = 1;
    if (tolangan < summa && f > 99) f = 99;
    return f;
  }

  // Ro'yxat uchun: ochiq qarzlar shaxs va yo'nalish bo'yicha guruhlanadi (nom katta-kichik harf va apostrofga e'tiborsiz),
  // yopilganlar alohida. Guruh: { kalit, shaxs, yonalish, summa, tolangan, qolgan, foiz, chiziq, muddatiOtgan, qarzlar }.
  // Guruhlar: muddati o'tganlar birinchi, keyin qolgan summasi kattasi.
  function qarzlarShaxsBoyicha(qarzlar, bugunSana) {
    var xarita = {}, tartib = [], yopilgan = [];
    qarzlar.slice().sort(function (a, b) {
      return sanaVaqtKaliti(b.sana, b.vaqt) < sanaVaqtKaliti(a.sana, a.vaqt) ? -1 : sanaVaqtKaliti(b.sana, b.vaqt) > sanaVaqtKaliti(a.sana, a.vaqt) ? 1 : 0;
    }).forEach(function (q) {
      if (qarzYopilganmi(q)) { yopilgan.push(q); return; }
      var kalit = nomKaliti(q.shaxs) + '|' + q.yonalish, g = xarita[kalit];
      if (!g) {
        g = xarita[kalit] = { kalit: kalit, shaxs: q.shaxs, yonalish: q.yonalish, summa: 0, tolangan: 0, qolgan: 0, muddatiOtgan: false, qarzlar: [] };
        tartib.push(g);
      }
      g.summa += q.summa; g.tolangan += tolanganSumma(q); g.qolgan += qarzQolgan(q);
      if (qarzMuddatiOtdimi(q, bugunSana)) g.muddatiOtgan = true;
      g.qarzlar.push(q);
    });
    tartib.forEach(function (g) { g.foiz = tolashFoizi(g.tolangan, g.summa); g.chiziq = g.summa ? g.tolangan * 100 / g.summa : 0; });
    tartib.sort(function (a, b) { return (b.muddatiOtgan ? 1 : 0) - (a.muddatiOtgan ? 1 : 0) || b.qolgan - a.qolgan; });
    return { ochiq: tartib, yopilgan: yopilgan };
  }

  // Hisobga bog'langan ochiq qarzlar (hisobni arxivlashdan oldin ogohlantirish uchun): shu hisobdan berilgan/olingan
  // yoki shu hisobga to'lov qilingan, hali yopilmagan qarzlar
  function hisobgaBogliqQarzlar(qarzlar, hisobId) {
    return qarzlar.filter(function (q) {
      return !qarzYopilganmi(q) && (q.hisob_id === hisobId || (q.tolovlar || []).some(function (t) { return t.hisob_id === hisobId; }));
    });
  }

  // ---- Zaxira va eksport (TZ F9) ----
  // Mavzu (sozlamalarda `tema`): qurilma sozlamasi, yorug' yoki qorong'i
  var TEMALAR = ['qurilma', 'yorug', 'qorongi'];
  function temaTogrimi(t) { return TEMALAR.indexOf(t) !== -1; }

  var ZAXIRA_TOPLAMLARI = ['hisoblar', 'yozuvlar', 'kategoriyalar', 'byudjetlar', 'qarzlar', 'sozlamalar'];
  var ZAXIRA_ESLATMA_KUNI = 14;   // oxirgi zaxiradan shuncha kundan oshsa, eslatma chiqadi

  function sanaYaroqli(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var p = s.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return d.getUTCFullYear() === +p[0] && d.getUTCMonth() === +p[1] - 1 && d.getUTCDate() === +p[2];
  }

  // Zaxira fayli obyekti: hamma to'plam, sxema versiyasi va har to'plam soni (fayl butunligini tekshirish uchun).
  // malumot: { hisoblar, yozuvlar, kategoriyalar, byudjetlar, qarzlar, sozlamalar }; sxema — joriy sxema versiyasi
  function zaxiraYasash(malumot, sxema, hozirgi) {
    var f = { ilova: 'moliya', sxema_versiyasi: sxema, zaxira_vaqti: (hozirgi || new Date()).toISOString(), soni: {} };
    ZAXIRA_TOPLAMLARI.forEach(function (t) { f[t] = malumot[t] || []; f.soni[t] = f[t].length; });
    return f;
  }

  // Fayl nomi: moliya-zaxira-2026-10-05-2130.json (mahalliy sana va vaqt)
  function zaxiraNomi(d, old) {
    var h = hozir(d);
    return 'moliya-' + (old || 'zaxira') + '-' + h.sana + '-' + h.vaqt.replace(':', '') + '.json';
  }

  // Zaxira matnini tekshiradi va joriy sxemaga o'tkazadi. HECH NARSAGA TEGMAYDI (faqat yangi obyekt qaytaradi).
  // Rad etiladi: JSON emas / yarim, boshqa ilovaniki, noma'lum yoki yangi sxema, to'plam yetishmaydi, sonlar mos emas, buzuq yozuvlar,
  // yo'q hisob/kategoriyaga havolalar, takroriy id, ortiqcha to'lov. Vaqti hozirdan keyin bo'lgan yozuv rad etilmaydi (TZ F9): sanaladi,
  // ro'yxatda "Kelajak" belgisi bilan ko'rinadi. Natija: { malumot, soni, kelajak: { yozuv, qarz, tolov }, eskiSxema } yoki { xato }
  function zaxiraniTekshir(matn, sxema, hozirgi) {
    try { return zaxiraniTekshirIch(matn, sxema, hozirgi || hozir()); } catch (e) {
      return { xato: e && e.zaxira ? e.message : 'Zaxira fayli buzuq: ' + (e && e.message ? e.message : e) };
    }
  }
  function rad(xabar) { var e = new Error(xabar); e.zaxira = true; throw e; }
  function zaxiraniTekshirIch(matn, sxema, h) {
    if (typeof matn !== 'string' || !matn.trim()) rad('Fayl bo\'sh');
    var f;
    try { f = JSON.parse(matn.charCodeAt(0) === 0xFEFF ? matn.slice(1) : matn); } catch (e) { rad('Fayl buzuq yoki yarim (JSON o\'qilmadi)'); }
    if (!f || typeof f !== 'object' || Array.isArray(f)) rad('Bu Moliya zaxira fayli emas');
    if (f.ilova !== 'moliya') rad('Bu Moliya zaxira fayli emas');
    var v = f.sxema_versiyasi;
    if (typeof v !== 'number' || v !== Math.floor(v) || v < 1) rad('Zaxira faylida sxema versiyasi yo\'q yoki noto\'g\'ri');
    if (v > sxema) rad('Zaxira yangiroq versiyadagi ilovadan olingan (sxema ' + v + '). Avval ilovani yangilang');
    ZAXIRA_TOPLAMLARI.forEach(function (t) {
      if (!Array.isArray(f[t])) rad('Zaxira to\'liq emas: "' + t + '" bo\'limi yo\'q');
      f[t].forEach(function (x, i) { if (!x || typeof x !== 'object' || Array.isArray(x)) rad('"' + t + '" ' + (i + 1) + '-qatori buzuq'); });
    });
    if (f.soni) ZAXIRA_TOPLAMLARI.forEach(function (t) { if (f.soni[t] !== undefined && f.soni[t] !== f[t].length) rad('Zaxira to\'liq emas: "' + t + '" da ' + f.soni[t] + ' ta bo\'lishi kerak edi, ' + f[t].length + ' ta bor'); });

    function butun(x) { return typeof x === 'number' && isFinite(x) && x === Math.floor(x); }
    function musbat(x) { return butun(x) && x > 0 && x <= 999999999999999; }
    function matnli(x) { return typeof x === 'string' && x.trim() !== ''; }
    var ids = {};
    ZAXIRA_TOPLAMLARI.forEach(function (t) {
      if (t === 'sozlamalar' || t === 'byudjetlar') return;
      ids[t] = {};
      f[t].forEach(function (x, i) {
        if (!matnli(x.id)) rad('"' + t + '" ' + (i + 1) + '-qatorida id yo\'q');
        if (ids[t][x.id]) rad('"' + t + '" da takroriy id: ' + x.id);
        ids[t][x.id] = x;
      });
    });
    f.hisoblar.forEach(function (x, i) {
      var n = (i + 1) + '-hisobda ';
      if (!matnli(x.nom)) rad(n + 'nom yo\'q');
      if (HISOB_TURLARI.indexOf(x.tur) === -1) rad(n + 'tur noto\'g\'ri');
      if (x.belgi !== undefined && (typeof x.belgi !== 'string' || !x.belgi)) rad(n + 'belgi noto\'g\'ri');
      if (x.rang !== undefined && (typeof x.rang !== 'string' || !x.rang)) rad(n + 'rang noto\'g\'ri');
      if (x.oxirgi4 !== undefined && (typeof x.oxirgi4 !== 'string' || (x.oxirgi4 !== '' && !/^\d{4}$/.test(x.oxirgi4)))) rad(n + 'karta raqamining oxirgi 4 raqami noto\'g\'ri');
      if (!butun(x.boshlangich_qoldiq)) rad(n + 'boshlang\'ich qoldiq noto\'g\'ri');
      if (x.arxivlangan !== undefined && typeof x.arxivlangan !== 'boolean') rad(n + 'arxiv belgisi noto\'g\'ri');
    });
    if (!f.hisoblar.some(function (x) { return !x.arxivlangan; })) rad('Zaxirada bitta ham faol hisob yo\'q');
    f.kategoriyalar.forEach(function (x, i) {
      var n = (i + 1) + '-kategoriyada ';
      if (!matnli(x.nom)) rad(n + 'nom yo\'q');
      if (x.tur !== 'daromad' && x.tur !== 'xarajat') rad(n + 'tur noto\'g\'ri');
      if (x.belgi !== undefined && (typeof x.belgi !== 'string' || !x.belgi)) rad(n + 'belgi noto\'g\'ri');
    });
    var kelajak = { yozuv: 0, qarz: 0, tolov: 0 };
    f.yozuvlar.forEach(function (x, i) {
      var n = (i + 1) + '-yozuvda ';
      if (['daromad', 'xarajat', 'otkazma'].indexOf(x.tur) === -1) rad(n + 'tur noto\'g\'ri');
      if (!musbat(x.summa)) rad(n + 'summa noto\'g\'ri');
      if (!sanaYaroqli(x.sana)) rad(n + 'sana noto\'g\'ri');
      if (x.vaqt !== undefined && !vaqtFormatiTogrimi(x.vaqt)) rad(n + 'vaqt noto\'g\'ri');
      if (!ids.hisoblar[x.hisob_id]) rad(n + 'hisob topilmadi');
      if (x.tur === 'otkazma') {
        if (!ids.hisoblar[x.qabul_hisob_id]) rad(n + 'qabul qiluvchi hisob topilmadi');
        if (x.qabul_hisob_id === x.hisob_id) rad(n + 'o\'tkazma bir hisobning o\'zida');
      } else {
        var k = ids.kategoriyalar[x.kategoriya_id];
        if (!k) rad(n + 'kategoriya topilmadi');
        if (k.tur !== x.tur) rad(n + 'kategoriya turi yozuv turiga mos emas');
      }
      if (x.izoh !== undefined && typeof x.izoh !== 'string') rad(n + 'izoh noto\'g\'ri');
    });
    var kalitlar = {};
    f.byudjetlar.forEach(function (x, i) {
      var n = (i + 1) + '-byudjetda ';
      if (x.kategoriya_id !== 'umumiy' && !(ids.kategoriyalar[x.kategoriya_id] && ids.kategoriyalar[x.kategoriya_id].tur === 'xarajat')) rad(n + 'kategoriya topilmadi');
      if (!musbat(x.oylik_limit)) rad(n + 'limit noto\'g\'ri');
      if (kalitlar[x.kategoriya_id]) rad('Byudjetda takroriy kategoriya');
      kalitlar[x.kategoriya_id] = 1;
    });
    f.qarzlar.forEach(function (x, i) {
      var n = (i + 1) + '-qarzda ';
      if (x.yonalish !== 'berdim' && x.yonalish !== 'oldim') rad(n + 'yo\'nalish noto\'g\'ri');
      if (!matnli(x.shaxs)) rad(n + 'shaxs yo\'q');
      if (!musbat(x.summa)) rad(n + 'summa noto\'g\'ri');
      if (!sanaYaroqli(x.sana)) rad(n + 'sana noto\'g\'ri');
      if (x.vaqt !== undefined && !vaqtFormatiTogrimi(x.vaqt)) rad(n + 'vaqt noto\'g\'ri');
      if (x.muddat && !sanaYaroqli(x.muddat)) rad(n + 'muddat noto\'g\'ri');
      if (!ids.hisoblar[x.hisob_id]) rad(n + 'hisob topilmadi');
      if (x.tolovlar !== undefined && !Array.isArray(x.tolovlar)) rad(n + 'to\'lovlar noto\'g\'ri');
      var jami = 0, tid = {};
      (x.tolovlar || []).forEach(function (t, j) {
        var m = (i + 1) + '-qarzning ' + (j + 1) + '-to\'lovida ';
        if (!t || typeof t !== 'object') rad(m + 'xato');
        if (!musbat(t.summa)) rad(m + 'summa noto\'g\'ri');
        if (!sanaYaroqli(t.sana)) rad(m + 'sana noto\'g\'ri');
        if (t.vaqt !== undefined && !vaqtFormatiTogrimi(t.vaqt)) rad(m + 'vaqt noto\'g\'ri');
        if (!ids.hisoblar[t.hisob_id]) rad(m + 'hisob topilmadi');
        if (t.id !== undefined) { if (tid[t.id]) rad(m + 'takroriy id'); tid[t.id] = 1; }
        jami += t.summa;
        if (kelajakmi(t.sana, t.vaqt || '00:00', h)) kelajak.tolov++;
      });
      if (jami > x.summa) rad(n + 'to\'lovlar yig\'indisi qarz summasidan oshib ketgan');
      if (kelajakmi(x.sana, x.vaqt || '00:00', h)) kelajak.qarz++;
    });
    f.yozuvlar.forEach(function (x) { if (kelajakmi(x.sana, yozuvVaqti(x), h)) kelajak.yozuv++; });
    f.sozlamalar.forEach(function (x, i) { if (!matnli(x.kalit)) rad((i + 1) + '-sozlamada kalit yo\'q'); });

    // Joriy sxemaga o'tkazish (hech narsa o'chirilmaydi): yozuvlarga vaqt (1 -> 2), qarzlarda tushib qolgan maydonlar (2 -> 3)
    var m = {
      hisoblar: f.hisoblar.map(function (x) { return hisobniYangilash(x.arxivlangan === undefined ? Object.assign({}, x, { arxivlangan: false }) : x); }),
      kategoriyalar: f.kategoriyalar.map(function (x) { return kategoriyaniYangilash(x.arxivlangan === undefined ? Object.assign({}, x, { arxivlangan: false }) : x); }),
      yozuvlar: f.yozuvlar.map(yozuvniYangilash), byudjetlar: f.byudjetlar.slice(), qarzlar: f.qarzlar.map(qarzniYangilash),
      sozlamalar: f.sozlamalar.slice()
    };
    var asosiy = m.sozlamalar.filter(function (x) { return x.kalit === 'asosiy'; })[0];
    if (!asosiy) { asosiy = { kalit: 'asosiy', oxirgi_zaxira_sanasi: null, balans_yashirin: false, tema: 'qurilma' }; m.sozlamalar.push(asosiy); }
    else if (asosiy.oxirgi_zaxira_sanasi && !sanaYaroqli(asosiy.oxirgi_zaxira_sanasi)) rad('Oxirgi zaxira sanasi noto\'g\'ri');
    if (asosiy.balans_yashirin !== undefined && typeof asosiy.balans_yashirin !== 'boolean') rad('Sozlamalarda balansni yashirish belgisi noto\'g\'ri');
    if (asosiy.tema !== undefined && !temaTogrimi(asosiy.tema)) rad('Sozlamalarda mavzu noto\'g\'ri (qurilma, yorug yoki qorongi bo\'lishi kerak)');
    m.sozlamalar = m.sozlamalar.map(function (x) { return x.kalit === 'asosiy' ? Object.assign({}, x, { sxema_versiyasi: sxema, balans_yashirin: x.balans_yashirin === true, tema: temaTogrimi(x.tema) ? x.tema : 'qurilma' }) : x; });
    var soni = {}; ZAXIRA_TOPLAMLARI.forEach(function (t) { soni[t] = m[t].length; });
    return { malumot: m, soni: soni, kelajak: kelajak, eskiSxema: v < sxema, fayldagiSxema: v };
  }

  // Oxirgi zaxira holati bosh sahifa uchun: { holat: 'yoq' | 'yaqinda' | 'eski', kun }.
  // Hech qachon olinmagan bo'lsa 'yoq'. 14 kundan OSHSA 'eski' (aynan 14 kun hali eslatmasiz).
  function zaxiraHolati(oxirgiSana, bugunSana) {
    if (!oxirgiSana || !sanaYaroqli(oxirgiSana)) return { holat: 'yoq', kun: null };
    var kun = Math.round((sanaUTC(bugunSana) - sanaUTC(oxirgiSana)) / 86400000);
    return { holat: kun > ZAXIRA_ESLATMA_KUNI ? 'eski' : 'yaqinda', kun: kun };
  }

  // CSV: ajratuvchi nuqtali vergul, qatorlar CRLF, boshida UTF-8 BOM (Excel o'zbekcha harflarni to'g'ri ochishi uchun).
  // Maydon ; " yoki qator oxiri belgisi bo'lsa, qo'sh tirnoqqa o'raladi (ichidagi " ikkilanadi).
  // Formula in'ektsiyasidan saqlanish: matn = + - @ yoki tab/CR bilan boshlansa, oldiga bitta tirnoq (') qo'yiladi.
  function csvMatn(x) {
    var s = x === undefined || x === null ? '' : String(x);
    if (/^[=+\-@\t\r]/.test(s)) s = '\'' + s;
    return csvMaydon(s);
  }
  function csvMaydon(s) {
    return /[;"\r\n,]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function csvQator(maydonlar) { return maydonlar.join(';'); }
  function csvFayl(sarlavha, qatorlar) {
    return '﻿' + [csvQator(sarlavha)].concat(qatorlar.map(csvQator)).join('\r\n') + '\r\n';
  }
  function sanaDMY(iso) { var p = iso.split('-'); return p[2] + '.' + p[1] + '.' + p[0]; }

  // Eksport davri: { tur: 'hammasi' } | { tur: 'oy', yil, oy } | { tur: 'yil', yil } -> { dan, gacha } yoki null (hammasi)
  function eksportDavri(d) {
    if (!d || d.tur === 'hammasi') return null;
    if (d.tur === 'yil') return { dan: d.yil + '-01-01', gacha: d.yil + '-12-31' };
    return davrChegarasi('oy', d.yil + '-' + ikki(d.oy) + '-01');
  }
  function davrdami(sana, c) { return !c || (sana >= c.dan && sana <= c.gacha); }

  // ---- Eksport (F9): bitta jadval — yozuvlar va qarz amallari birga, eng yangisi tepada ----
  var EKSPORT_SARLAVHA = ['Sana va vaqt', 'ID', 'Tur', 'Hisob', 'Qayerga', 'Kategoriya', 'Summa', 'Valyuta', 'Qarz nomi', 'Qarz turi', 'Izoh'];
  var EKSPORT_TURI = { daromad: 'Daromad', xarajat: 'Xarajat', otkazma: 'O\'tkazma' };
  function eksportRaqam(prefiks, n) { return prefiks + '-' + ('000000' + n).slice(-6); }
  function eksportTartib(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

  // Natija: { sarlavha, qatorlar: [{ sana, vaqt, id, tur, hisob, qayerga, kategoriya, summa, valyuta, qarzNomi, qarzTuri, izoh }], soni }
  // ID: ilovadagi yaratilish tartibi bo'yicha raqam (Y-000001 yozuv, Q-000001 qarz, T-000001 qarz to'lovi); davr tanlashga bog'liq emas.
  // Summa har doim musbat: yo'nalishni "Tur" (va "Qarz turi") aytadi.
  function eksport(malumot, davr) {
    var c = eksportDavri(davr), hn = {}, kn = {}, qatorlar = [];
    (malumot.hisoblar || []).forEach(function (x) { hn[x.id] = x.nom; });
    (malumot.kategoriyalar || []).forEach(function (x) { kn[x.id] = x.nom; });
    var yozuvlar = (malumot.yozuvlar || []).slice().sort(function (a, b) { return eksportTartib((a.yaratilgan || '') + ' ' + a.id, (b.yaratilgan || '') + ' ' + b.id); });
    yozuvlar.forEach(function (y, i) {
      if (!davrdami(y.sana, c)) return;
      var o = y.tur === 'otkazma';
      qatorlar.push({ sana: y.sana, vaqt: yozuvVaqti(y), ord: (y.yaratilgan || '') + ' ' + y.id, id: eksportRaqam('Y', i + 1), tur: EKSPORT_TURI[y.tur] || y.tur,
        hisob: hn[y.hisob_id] || '', qayerga: o ? (hn[y.qabul_hisob_id] || '') : '', kategoriya: o ? '' : (kn[y.kategoriya_id] || ''),
        summa: y.summa, valyuta: 'UZS', qarzNomi: '', qarzTuri: '', izoh: y.izoh || '' });
    });
    var qarzlar = (malumot.qarzlar || []).slice().sort(function (a, b) { return eksportTartib((a.yaratilgan || '') + ' ' + a.id, (b.yaratilgan || '') + ' ' + b.id); }), tn = 0;
    qarzlar.forEach(function (z, i) {
      var turi = z.yonalish === 'berdim' ? 'Berilgan' : 'Olingan';
      if (davrdami(z.sana, c)) {
        qatorlar.push({ sana: z.sana, vaqt: z.vaqt || '00:00', ord: (z.yaratilgan || '') + ' ' + z.id, id: eksportRaqam('Q', i + 1), tur: 'Qarz', hisob: hn[z.hisob_id] || '', qayerga: '', kategoriya: '',
          summa: z.summa, valyuta: 'UZS', qarzNomi: z.shaxs || '', qarzTuri: turi, izoh: z.izoh || '' });
      }
      (z.tolovlar || []).slice().sort(function (a, b) { return eksportTartib(a.sana + ' ' + (a.vaqt || '') + ' ' + a.id, b.sana + ' ' + (b.vaqt || '') + ' ' + b.id); }).forEach(function (t) {
        tn++;
        if (!davrdami(t.sana, c)) return;
        qatorlar.push({ sana: t.sana, vaqt: t.vaqt || '00:00', ord: t.sana + ' ' + (t.vaqt || '') + ' ' + t.id, id: eksportRaqam('T', tn), tur: 'Qarz to\'lovi', hisob: hn[t.hisob_id] || '', qayerga: '', kategoriya: '',
          summa: t.summa, valyuta: 'UZS', qarzNomi: z.shaxs || '', qarzTuri: turi, izoh: '' });
      });
    });
    // eng yangisi tepada: sana va vaqt kamayish tartibida, teng bo'lsa — keyin yaratilgani tepada
    qatorlar.sort(function (a, b) { var x = a.sana + ' ' + a.vaqt, y = b.sana + ' ' + b.vaqt; return x !== y ? (x < y ? 1 : -1) : (a.ord < b.ord ? 1 : a.ord > b.ord ? -1 : 0); });
    return { sarlavha: EKSPORT_SARLAVHA, qatorlar: qatorlar, soni: qatorlar.length };
  }

  // CSV: xuddi shu ustunlar. Sana va vaqt "KK.OO.YYYY SS:DD" matni, summa mingliksiz butun son; matnlarda formula himoyasi (csvMatn).
  function eksportCSV(e) {
    var q = e.qatorlar.map(function (r) {
      return [sanaDMY(r.sana) + ' ' + r.vaqt, r.id, csvMatn(r.tur), csvMatn(r.hisob), csvMatn(r.qayerga), csvMatn(r.kategoriya), String(r.summa), r.valyuta, csvMatn(r.qarzNomi), r.qarzTuri, csvMatn(r.izoh)];
    });
    return csvFayl(e.sarlavha, q);
  }

  // ---- Asosiy sahifa va Tarix: faqat ko'rsatish uchun yordamchilar (hisob-kitob qoidalari o'zgarmagan) ----
  function oyKalitiSur(kalit, n) {
    var p = kalit.split('-'), j = parseInt(p[0], 10) * 12 + parseInt(p[1], 10) - 1 + n;
    return Math.floor(j / 12) + '-' + ikki(j % 12 + 1);
  }
  // "Naqd pul oqimi" oy ro'yxati: eng yangisi birinchi, bu oydan KELAJAKKA chiqmaydi. Eng erta yozuv oyidan (kamida 12 oy) bugungi oygacha.
  function oqimOylari(birinchiSana, bugunSana) {
    var bu = bugunSana.slice(0, 7), boshi = oyKalitiSur(bu, -11);
    if (birinchiSana && birinchiSana.slice(0, 7) < boshi) boshi = birinchiSana.slice(0, 7);
    var r = [];
    for (var k = bu; k >= boshi; k = oyKalitiSur(k, -1)) r.push(k);
    return r;
  }
  // Tarix oy yorliqlari: eng eskisidan boshlab o'sish tartibida, OXIRGISI joriy oy. Faqat bazada oldindan qolgan kelajak yozuvlari
  // bo'lgan kelajak oylar ham qo'shiladi (ular ko'rinmay qolmasligi uchun).
  function tarixOylari(sanalar, bugunSana) {
    var bu = bugunSana.slice(0, 7), eng = bu, bor = {};
    sanalar.forEach(function (s) { var k = s.slice(0, 7); bor[k] = true; if (k < eng) eng = k; });
    var r = [];
    for (var k = eng; k <= bu; k = oyKalitiSur(k, 1)) r.push(k);
    Object.keys(bor).filter(function (k) { return k > bu; }).sort().forEach(function (k) { r.push(k); });
    return r;
  }
  // Oy jami (hisobot() bilan bir xil qoida): { daromad, xarajat, qoldiq, soni }
  function oyJami(yozuvlar, kalit) {
    var c = davrChegarasi('oy', kalit + '-01'), h = hisobot(yozuvlar, c.dan, c.gacha, '');
    return { daromad: h.daromad, xarajat: h.xarajat, qoldiq: h.qoldiq, soni: h.soni };
  }
  // Tarixda ko'rinadigan qarz amallari: har qarz va har to'lov alohida qator. Ular oylik xarajat/daromadga KIRMAYDI.
  function qarzSatrlari(qarzlar) {
    var r = [];
    qarzlar.forEach(function (z) {
      r.push({ turi: 'qarz', id: 'q:' + z.id, qarz_id: z.id, sana: z.sana, vaqt: z.vaqt || '00:00', summa: z.summa, hisob_id: z.hisob_id, shaxs: z.shaxs, yonalish: z.yonalish, izoh: z.izoh || '', yaratilgan: z.yaratilgan || '' });
      (z.tolovlar || []).forEach(function (t) {
        r.push({ turi: 'tolov', id: 't:' + (t.id || '') + ':' + z.id, qarz_id: z.id, sana: t.sana, vaqt: t.vaqt || '00:00', summa: t.summa, hisob_id: t.hisob_id, shaxs: z.shaxs, yonalish: z.yonalish, izoh: '', yaratilgan: t.yaratilgan || '' });
      });
    });
    return r;
  }
  // Qarz qatorlarini Tarix filtri/qidiruvi bo'yicha suzadi (yozuvlarniSuz bilan bir xil mantiq): tur va kategoriya tanlangan bo'lsa qarz
  // qatorlari chiqmaydi; hisob — shu hisobdagi amal; qidiruv — izoh yoki shaxs ismi. oyKalit berilsa, faqat shu oy.
  function qarzSatrlariniSuz(satrlar, f, oyKalit) {
    f = f || {};
    var q = String(f.qidiruv || '').trim().toLowerCase();
    return satrlar.filter(function (x) {
      if (oyKalit && x.sana.slice(0, 7) !== oyKalit) return false;
      if (f.tur || f.kategoriya || (f.kategoriyalar && f.kategoriyalar.length)) return false;
      if (f.hisob && x.hisob_id !== f.hisob) return false;
      if (f.dan && x.sana < f.dan) return false;
      if (f.gacha && x.sana > f.gacha) return false;
      if (q && (String(x.izoh || '') + ' ' + String(x.shaxs || '')).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
  }
  // Tarix: yozuvlar va qarz qatorlari kunlar bo'yicha (eng yangi kun birinchi; kun ichida soat bo'yicha kamayish).
  // Kun jami (xarajat, daromad) faqat yozuvlardan: o'tkazma va qarz kirmaydi.
  // Natija: [{ sana, xarajat, daromad, elementlar: [{ turi: 'yozuv', yozuv } | { turi: 'qarz' | 'tolov', satr }] }]
  function tarixGuruhlari(yozuvlar, qarzQatorlari) {
    var el = [];
    yozuvlar.forEach(function (y) { el.push({ turi: 'yozuv', yozuv: y, sana: y.sana, vaqt: yozuvVaqti(y), yaratilgan: y.yaratilgan || '', t: 0 }); });
    qarzQatorlari.forEach(function (x) { el.push({ turi: x.turi, satr: x, sana: x.sana, vaqt: x.vaqt, yaratilgan: x.yaratilgan || '', t: 1 }); });
    el.sort(function (a, b) {
      if (a.sana !== b.sana) return a.sana < b.sana ? 1 : -1;
      if (a.vaqt !== b.vaqt) return a.vaqt < b.vaqt ? 1 : -1;
      if (a.yaratilgan !== b.yaratilgan) return a.yaratilgan < b.yaratilgan ? 1 : -1;
      return a.t - b.t;
    });
    var guruhlar = [];
    el.forEach(function (e) {
      var g = guruhlar[guruhlar.length - 1];
      if (!g || g.sana !== e.sana) { g = { sana: e.sana, xarajat: 0, daromad: 0, elementlar: [] }; guruhlar.push(g); }
      g.elementlar.push(e);
      if (e.turi === 'yozuv') { if (e.yozuv.tur === 'xarajat') g.xarajat += e.yozuv.summa; else if (e.yozuv.tur === 'daromad') g.daromad += e.yozuv.summa; }
    });
    return guruhlar;
  }

  // ---- Belgi (ikonka), hisob turlari va yangi maydonlar (sxema 5) ----
  var HISOB_TURLARI = ['karta', 'bank', 'naqd', 'boshqa'];
  var HISOB_TURI_NOMI = { karta: 'Karta', bank: 'Bank hisobi', naqd: 'Naqd pul', boshqa: 'Boshqa' };
  var HISOB_RANGLARI = { naqd: '#43a047', karta: '#1e88e5', bank: '#7e57c2', boshqa: '#78909c' };
  var HISOB_BELGISI = { naqd: 'naqd', karta: 'karta', bank: 'bank', boshqa: 'hamyon' };

  function belgiTaxmin(nom, guruh) { return global.Belgilar ? global.Belgilar.taxmin(nom, guruh) : 'umumiy'; }
  // Eski hisobga tur berish: faqat tur yo'q yoki noto'g'ri bo'lsa. Nomida "naqd" bo'lsa naqd pul, bo'lmasa karta.
  function hisobTuriTaxmin(nom) { return /naqd/i.test(String(nom || '')) ? 'naqd' : 'karta'; }

  // Sxema 4 -> 5: hisobga tur (bo'lsa saqlanadi), belgi, rang va oxirgi4 beriladi. Hech narsa o'chirilmaydi; hammasi joyida bo'lsa
  // o'sha obyektning o'zi qaytadi (ikkinchi marta ishlasa ham buzilmaydi).
  function hisobniYangilash(h) {
    var yangi = {}, o = false;
    Object.keys(h).forEach(function (k) { yangi[k] = h[k]; });
    if (HISOB_TURLARI.indexOf(h.tur) === -1) { yangi.tur = hisobTuriTaxmin(h.nom); o = true; }
    if (typeof h.belgi !== 'string' || !h.belgi) { yangi.belgi = HISOB_BELGISI[yangi.tur]; o = true; }
    if (typeof h.rang !== 'string' || !h.rang) { yangi.rang = HISOB_RANGLARI[yangi.tur]; o = true; }
    if (typeof h.oxirgi4 !== 'string') { yangi.oxirgi4 = ''; o = true; }
    return o ? yangi : h;
  }
  // Sxema 4 -> 5: kategoriyaga belgi nomiga qarab beriladi (topilmasa umumiy belgi)
  function kategoriyaniYangilash(k) {
    if (typeof k.belgi === 'string' && k.belgi) return k;
    var yangi = {};
    Object.keys(k).forEach(function (x) { yangi[x] = k[x]; });
    yangi.belgi = belgiTaxmin(k.nom, k.tur);
    return yangi;
  }
  // Ko'rsatish uchun: hisobning belgisi va rangi (maydon yo'q bo'lsa turga qarab)
  function hisobBelgisiOl(h) { return h.belgi || HISOB_BELGISI[h.tur] || 'hamyon'; }
  function hisobRangiOl(h) { return h.rang || HISOB_RANGLARI[h.tur] || HISOB_RANGLARI.boshqa; }
  // Kartaning OXIRGI 4 raqami: bo'sh (ixtiyoriy) yoki aynan 4 ta raqam. To'liq karta raqami qabul qilinmaydi va saqlanmaydi.
  function oxirgi4Tekshir(matn) {
    var s = String(matn == null ? '' : matn).replace(/\s+/g, '');
    if (s === '') return { oxirgi4: '' };
    if (!/^\d+$/.test(s)) return { xato: 'Faqat raqam kiriting (kartaning oxirgi 4 raqami)' };
    if (s.length > 4) return { xato: 'To\'liq karta raqamini kiritmang: faqat oxirgi 4 raqam' };
    if (s.length < 4) return { xato: 'Aynan 4 ta raqam kiriting' };
    return { oxirgi4: s };
  }
  // "•••• 1234" (faqat kartada va raqam berilgan bo'lsa), aks holda ''
  function hisobMaskasi(h) { return h.tur === 'karta' && /^\d{4}$/.test(h.oxirgi4 || '') ? '•••• ' + h.oxirgi4 : ''; }
  // Hisoblar ekrani filtri: faqat faol hisoblar; tur '' yoki 'hammasi' bo'lsa hammasi
  function hisoblarniSuz(hisoblar, tur) {
    return hisoblar.filter(function (h) { return !h.arxivlangan && (!tur || tur === 'hammasi' || h.tur === tur); });
  }
  // Standart kategoriyalar: har biriga "bor" (shu turda faol kategoriya shu nom bilan allaqachon bor — apostrof va harf kattaligiga e'tiborsiz)
  function standartHolati(standart, kategoriyalar, tur) {
    var bor = {};
    kategoriyalar.forEach(function (k) { if (!k.arxivlangan) bor[k.tur + '|' + nomKaliti(k.nom)] = true; });
    return standart.filter(function (x) { return !tur || x.tur === tur; }).map(function (x) {
      return { nom: x.nom, tur: x.tur, belgi: x.belgi, rang: x.rang, bor: !!bor[x.tur + '|' + nomKaliti(x.nom)] };
    });
  }
  // Oy strelkalari: oylar — oqimOylari() natijasi (eng yangisi birinchi). n = -1 oldingi oy, +1 keyingi oy. Chegarada joyida qoladi.
  // Natija: { oy, oldingiBor, keyingiBor }
  function oyKochir(oylar, joriy, n) {
    var i = oylar.indexOf(joriy);
    if (i === -1) i = 0;
    var yangi = Math.max(0, Math.min(oylar.length - 1, i - n));   // ro'yxat yangidan eskiga: keyingi oy = indeks - 1
    return { oy: oylar[yangi], oldingiBor: yangi < oylar.length - 1, keyingiBor: yangi > 0 };
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
  // - bergan qarzlarim + menga qaytarilganlar + olgan qarzlarim - men qaytarganlarim (TZ 8-band, 1-qoida).
  // qarzlar ixtiyoriy. Qarz amallari faqat qoldiqqa ta'sir qiladi: hisobot(), byudjet va diagrammalar ularni ko'rmaydi.
  function hisobQoldigi(hisob, yozuvlar, qarzlar) {
    var q = hisob.boshlangich_qoldiq;
    yozuvlar.forEach(function (y) {
      if (y.tur === 'daromad' && y.hisob_id === hisob.id) q += y.summa;
      else if (y.tur === 'xarajat' && y.hisob_id === hisob.id) q -= y.summa;
      else if (y.tur === 'otkazma') {
        if (y.hisob_id === hisob.id) q -= y.summa;          // chiqqan o'tkazma
        if (y.qabul_hisob_id === hisob.id) q += y.summa;    // kirgan o'tkazma
      }
    });
    (qarzlar || []).forEach(function (z) {
      var berdim = z.yonalish === 'berdim';
      if (z.hisob_id === hisob.id) q += berdim ? -z.summa : z.summa;   // bergan qarz hisobdan chiqadi, olgani kiradi
      (z.tolovlar || []).forEach(function (t) {
        if (t.hisob_id === hisob.id) q += berdim ? t.summa : -t.summa;   // qaytarilgani teskari yo'nalishda
      });
    });
    return q;
  }

  // Arxivlanmagan hisoblardagi pulning yig'indisi
  function umumiyBalans(hisoblar, yozuvlar, qarzlar) {
    return hisoblar.reduce(function (j, h) {
      return h.arxivlangan ? j : j + hisobQoldigi(h, yozuvlar, qarzlar);
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
  function yangiBoshlangichQoldiq(hisob, yozuvlar, yangiJoriy, qarzlar) {
    return hisob.boshlangich_qoldiq + (yangiJoriy - hisobQoldigi(hisob, yozuvlar, qarzlar));
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
    tolanganSumma: tolanganSumma, qarzQolgan: qarzQolgan, qarzYopilganmi: qarzYopilganmi, qarzMuddatiOtdimi: qarzMuddatiOtdimi,
    qarzniYangilash: qarzniYangilash, qarzniTekshir: qarzniTekshir, tolovniTekshir: tolovniTekshir, qarzlarJami: qarzlarJami,
    tolashFoizi: tolashFoizi, qarzlarShaxsBoyicha: qarzlarShaxsBoyicha, hisobgaBogliqQarzlar: hisobgaBogliqQarzlar,
    davrChegarasi: davrChegarasi, davrniSur: davrniSur, davrNomi: davrNomi, kunQosh: kunQosh,
    foizlar: foizlar, hisobot: hisobot, taqqoslash: taqqoslash, belgiliSum: belgiliSum, belgiliFoiz: belgiliFoiz,
    qadamlar: qadamlar, wizardBoshlash: wizardBoshlash, wizardKeyingi: wizardKeyingi, wizardOrqaga: wizardOrqaga,
    wizardTurAlmashtir: wizardTurAlmashtir, yozuvniTayyorlash: yozuvniTayyorlash,
    oxirgiKategoriyaId: oxirgiKategoriyaId, matnRangi: matnRangi,
    oyKunlari: oyKunlari, vaqtdanTanlov: vaqtdanTanlov, tanlovdanVaqt: tanlovdanVaqt,
    glidirakChegarasi: glidirakChegarasi, glidirakTuzat: glidirakTuzat, glidirakQiymatlari: glidirakQiymatlari,
    kunlarSoni: kunlarSoni, oraliqNomi: oraliqNomi, oraliqTekshir: oraliqTekshir, oraliqSur: oraliqSur, hisobotDavri: hisobotDavri,
    filtrOylari: filtrOylari, filtrYillari: filtrYillari, filtrQollash: filtrQollash, diagrammaOraliq: diagrammaOraliq,
    ZAXIRA_ESLATMA_KUNI: ZAXIRA_ESLATMA_KUNI, sanaYaroqli: sanaYaroqli, zaxiraYasash: zaxiraYasash, zaxiraNomi: zaxiraNomi, zaxiraniTekshir: zaxiraniTekshir, zaxiraHolati: zaxiraHolati,
    TEMALAR: TEMALAR, temaTogrimi: temaTogrimi,
    csvMatn: csvMatn, csvFayl: csvFayl, eksportDavri: eksportDavri, eksport: eksport, eksportCSV: eksportCSV, EKSPORT_SARLAVHA: EKSPORT_SARLAVHA,
    oyKalitiSur: oyKalitiSur, oqimOylari: oqimOylari, tarixOylari: tarixOylari, oyJami: oyJami, qarzSatrlari: qarzSatrlari, qarzSatrlariniSuz: qarzSatrlariniSuz, tarixGuruhlari: tarixGuruhlari,
    HISOB_TURLARI: HISOB_TURLARI, HISOB_TURI_NOMI: HISOB_TURI_NOMI, HISOB_RANGLARI: HISOB_RANGLARI, HISOB_BELGISI: HISOB_BELGISI, belgiTaxmin: belgiTaxmin, hisobTuriTaxmin: hisobTuriTaxmin,
    hisobniYangilash: hisobniYangilash, kategoriyaniYangilash: kategoriyaniYangilash, hisobBelgisiOl: hisobBelgisiOl, hisobRangiOl: hisobRangiOl, oxirgi4Tekshir: oxirgi4Tekshir,
    hisobMaskasi: hisobMaskasi, hisoblarniSuz: hisoblarniSuz, standartHolati: standartHolati, oyKochir: oyKochir,
    donaGuruhlash: donaGuruhlash, DONA_ENG_KATTA: DONA_ENG_KATTA, byudjetHolati: byudjetHolati, byudjetHisobi: byudjetHisobi,
    BYUDJET_OGOHLANTIRISH: BYUDJET_OGOHLANTIRISH, OY_QISQA: OY_QISQA, HAFTA_KUNI_QISQA: HAFTA_KUNI_QISQA, qisqaSum: qisqaSum, chiroyliTiklar: chiroyliTiklar,
    diagrammaVaqt: diagrammaVaqt, tilimBurchaklari: tilimBurchaklari, yoyYoli: yoyYoli, ustunBalandligi: ustunBalandligi,
    hozir: hozir, kelajakmi: kelajakmi, vaqtTekshir: vaqtTekshir, yozuvVaqti: yozuvVaqti,
    vaqtFormatiTogrimi: vaqtFormatiTogrimi, yozuvniYangilash: yozuvniYangilash,
    oxirgiYozuvlar: oxirgiYozuvlar, kunlarBoyicha: kunlarBoyicha, oxirgiHisobId: oxirgiHisobId
  };
})(typeof window !== 'undefined' ? window : this);
