// Statistika (TZ-sinxronlash.md 34-band): toza hisoblash mantiqi. Bu yerda DOM, xotira va tarmoq YO'Q.
// Hamma raqam mavjud Calc funksiyalaridan olinadi (hisobot, diagrammaVaqt, taqqoslash, oyJami ...), shuning uchun "Jami" Asosiy sahifadagi
// "Naqd pul oqimi" bilan AYNAN bir xil chiqadi. Yozuvlar: ui.js dagi hisobotYozuvlari() (yozuvlar + qarz amallari: "Olingan qarz" — kirim,
// "Berilgan qarz" — chiqim; o'tkazma kirmaydi). Hammasi tests.html da uydirma raqamlar bilan sinaladi.
var StatSof = (function () {
  'use strict';

  var TURLAR = ['ustun', 'chiziq', 'maydon', 'doira'];
  var DAVRLAR = ['kun', 'hafta', 'oy', 'yil'];
  var SAQLASH_KALITI = 'moliya-stat-grafik';   // "moliya-" bilan boshlanadi: "PINni unutdim" to'liq tozalashi uni ham o'chiradi
  var KUN_ORALIQLARI = ['0–4', '4–8', '8–12', '12–16', '16–20', '20–24'];   // kun grafigi: 4 soatlik oraliqlar
  var HAFTA_KUNI_TOLIQ = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
  var DOIRA_ENG_KOP = 6;   // legendada ko'pi bilan 6 ta element (oxirgisi "Boshqa")
  var UCH_OY = 3;          // "eng qimmat kun": oxirgi 3 oy

  // ---- Tanlovni saqlash (localStorage matni <-> { tur, davr }); yaroqsiz bo'lsa boshlang'ich ----
  function grafikTanlovi(matn) {
    var j = null;
    try { j = JSON.parse(matn); } catch (e) { j = null; }
    return {
      tur: j && TURLAR.indexOf(j.tur) >= 0 ? j.tur : 'ustun',
      davr: j && DAVRLAR.indexOf(j.davr) >= 0 ? j.davr : 'oy'
    };
  }
  function grafikTanloviMatni(t) { return JSON.stringify({ tur: t.tur, davr: t.davr }); }

  // ---- Yordamchilar ----
  function xarajatmi(y) { return y.tur === 'xarajat'; }
  function oyBoshi(oy) { return oy + '-01'; }
  function oyOxiri(oy) { return Calc.davrChegarasi('oy', oyBoshi(oy)).gacha; }
  // Tanlangan oyning "hozirgi kuni": joriy oy bo'lsa bugun, o'tgan oy bo'lsa uning oxirgi kuni (kelajak oyda ham bugundan oshmaydi)
  function oyMarkazi(oy, bugunSana) {
    if (oy >= bugunSana.slice(0, 7)) return bugunSana;
    return oyOxiri(oy);
  }
  // Oraliqdagi xarajat jami (dan..gacha, ikkalasi ham kiradi)
  function xarajatJami(yozuvlar, dan, gacha) {
    var j = 0;
    yozuvlar.forEach(function (y) { if (xarajatmi(y) && y.sana >= dan && y.sana <= gacha) j += y.summa; });
    return j;
  }
  // Eng erta yozuv sanasi (daromad yoki xarajat); yo'q bo'lsa ''
  function birinchiSana(yozuvlar) {
    var b = '';
    yozuvlar.forEach(function (y) { if ((y.tur === 'xarajat' || y.tur === 'daromad') && (!b || y.sana < b)) b = y.sana; });
    return b;
  }
  function kunRaqami(sana) { return parseInt(sana.slice(8, 10), 10); }
  function haftaKuniIndeksi(sana) { return (new Date(Date.UTC(+sana.slice(0, 4), +sana.slice(5, 7) - 1, +sana.slice(8, 10))).getUTCDay() + 6) % 7; }

  // Oy oraliq ro'yxati (chiplar): eng eskisidan boshlab, OXIRGISI joriy oy
  function oyChiplari(yozuvlar, bugunSana) {
    return Calc.oqimOylari(birinchiSana(yozuvlar), bugunSana).slice().reverse();
  }
  // Oy chipi bosilganda grafik sanasi: joriy oy — bugun, boshqasi — oyning oxirgi kuni
  function chipSanasi(oy, bugunSana) { return oyMarkazi(oy, bugunSana); }

  // ---- Davrni oldinga/orqaga surish (grafikdagi ‹ ›). Sana bugundan oshmaydi ----
  function suril(davr, sana, n, bugunSana) {
    var yangi;
    if (davr === 'kun') yangi = Calc.kunQosh(sana, n);
    else if (davr === 'hafta') yangi = Calc.kunQosh(sana, 7 * n);
    else {
      var oy = Calc.oyKalitiSur(sana.slice(0, 7), davr === 'oy' ? n : 12 * n);
      yangi = oy + '-' + (davr === 'yil' ? ('0' + Math.min(kunRaqami(sana), Calc.oyKunlari(+oy.slice(0, 4), +oy.slice(5, 7)))).slice(-2) : '01');
    }
    return yangi > bugunSana ? bugunSana : yangi;
  }
  // Surish mumkinmi: oldinga — keyingi davr bugundan keyin boshlanmasa; orqaga — oldingi davr oxiri birinchi yozuvdan oldin bo'lmasa
  function surishMumkinmi(davr, sana, n, bugunSana, birinchi) {
    var s = suril(davr, sana, n, bugunSana), c = Calc.davrChegarasi(davr, sana), c2 = Calc.davrChegarasi(davr, s);
    if (n > 0) return c.gacha < bugunSana && c2.dan <= bugunSana && c2.dan !== c.dan;
    return !!birinchi && c2.gacha >= birinchi && c2.dan !== c.dan;
  }

  // ---- 2) Xarajat grafigi ma'lumoti (ustun, chiziq, maydon). Natija: { davr, dan, gacha, nom, jami, bucketlar: [{ qisqa, belgi (ko'rsatiladimi), toliq, summa }], eng, bosh, vaqtsiz }
  // jami — davrdagi BARCHA xarajat (Asosiy bilan bir xil); kunda vaqti yo'q yozuvlar ustunlarga kirmaydi (vaqtsiz — shularning soni)
  function grafikMalumoti(yozuvlar, davr, sana) {
    var c = Calc.davrChegarasi(davr, sana), bucketlar = [], jami = 0, vaqtsiz = 0, eng = 0;
    if (davr === 'kun') {
      KUN_ORALIQLARI.forEach(function (q) { bucketlar.push({ qisqa: q, belgi: true, toliq: q.replace('–', ':00 – ') + ':00', summa: 0 }); });
      yozuvlar.forEach(function (y) {
        if (!xarajatmi(y) || y.sana !== sana) return;
        jami += y.summa;
        if (!Calc.vaqtFormatiTogrimi(y.vaqt)) { vaqtsiz++; return; }
        bucketlar[Math.floor(parseInt(y.vaqt.slice(0, 2), 10) / 4)].summa += y.summa;
      });
    } else {
      var d = Calc.diagrammaVaqt(yozuvlar, davr, sana, '');
      jami = d.jami.xarajat;
      d.bucketlar.forEach(function (b, i) {
        bucketlar.push({ qisqa: b.qisqa, belgi: davr === 'oy' ? i % 3 === 0 : true, toliq: b.toliq, summa: b.xarajat });   // oy: yorliqlar siyrak (har 3-si)
      });
    }
    bucketlar.forEach(function (b) { if (b.summa > eng) eng = b.summa; });
    return { davr: davr, dan: c.dan, gacha: c.gacha, nom: Calc.davrNomi(davr, sana), jami: jami, bucketlar: bucketlar, eng: eng, bosh: jami === 0, vaqtsiz: vaqtsiz };
  }

  // ---- Doira: tanlangan oyning xarajat ulushi (kategoriyalar bo'yicha). Legenda ≤ 6 ta; qolgani "Boshqa"ga. Foizlar yig'indisi 100 ----
  // Natija: { dan, gacha, nom, jami, bosh, royxat: [{ id, summa, foiz }] }  (id 'boshqa' — qo'shilgan qism)
  function doiraMalumoti(yozuvlar, sana) {
    var c = Calc.davrChegarasi('oy', sana), h = Calc.hisobot(yozuvlar, c.dan, c.gacha, ''), t = h.xarajatTaqsimoti, royxat;
    if (t.length <= DOIRA_ENG_KOP) royxat = t.map(function (x) { return { id: x.kategoriya_id, summa: x.summa }; });
    else {
      royxat = t.slice(0, DOIRA_ENG_KOP - 1).map(function (x) { return { id: x.kategoriya_id, summa: x.summa }; });
      royxat.push({ id: 'boshqa', summa: t.slice(DOIRA_ENG_KOP - 1).reduce(function (a, x) { return a + x.summa; }, 0) });
    }
    var f = Calc.foizlar(royxat.map(function (x) { return x.summa; }));
    royxat.forEach(function (x, i) { x.foiz = f[i]; });
    return { dan: c.dan, gacha: c.gacha, nom: Calc.davrNomi('oy', sana), jami: h.xarajat, bosh: h.xarajat === 0, royxat: royxat };
  }

  // ---- 3) Kunlik o'rtacha xarajat ----
  // Taqqoslash: { qiymat, foiz (null — taqqoslanadigan 0: "—"), yon: 'yuqori' | 'past' | 'teng' | 'yoq' }. Foiz = (sizniki − taqqoslanadigan) / taqqoslanadigan
  function taqqosla(mening, boshqa) {
    var t = Calc.taqqoslash(mening, boshqa);
    if (t.foiz === null) return { foiz: null, yon: 'yoq' };
    return { foiz: t.foiz, yon: t.foiz > 0 ? 'yuqori' : t.foiz < 0 ? 'past' : 'teng' };
  }
  // Natija: { marka (tanlangan oyning "hozirgi kuni"), kunlar, ortacha, kataklar: [{ kalit, nom, qiymat, foiz, yon }] }
  // Sizniki — tanlangan oyning 1-kunidan marka kunigacha xarajat / kunlar soni (joriy oyda bugun ham sanaladi).
  function kunlikOrtacha(yozuvlar, oy, bugunSana) {
    var marka = oyMarkazi(oy, bugunSana), kunlar = kunRaqami(marka);
    var ortacha = xarajatJami(yozuvlar, oyBoshi(oy), marka) / kunlar;
    // 1) shu hafta: marka kuni tushgan haftaning dushanbasidan marka kunigacha
    var hafta = Calc.davrChegarasi('hafta', marka), haftaKunlari = Calc.kunlarSoni(hafta.dan, marka);
    var shuHafta = xarajatJami(yozuvlar, hafta.dan, marka) / haftaKunlari;
    // 2) o'tgan oyning aynan shu sanasidagi bitta kun (o'tgan oy qisqa bo'lsa uning oxirgi kuni)
    var oldingi = Calc.oyKalitiSur(oy, -1), oldingiKunlari = Calc.oyKunlari(+oldingi.slice(0, 4), +oldingi.slice(5, 7));
    var shuKuni = oldingi + '-' + ('0' + Math.min(kunlar, oldingiKunlari)).slice(-2);
    var otganShuKuni = xarajatJami(yozuvlar, shuKuni, shuKuni);
    // 3) o'tgan oy: butun oy xarajati / oy kunlari
    var otganOy = xarajatJami(yozuvlar, oyBoshi(oldingi), oyOxiri(oldingi)) / oldingiKunlari;
    // 4) hamma vaqt: birinchi yozuvdan marka kunigacha
    var birinchi = birinchiSana(yozuvlar), hammasi = 0;
    if (birinchi && birinchi <= marka) hammasi = xarajatJami(yozuvlar, birinchi, marka) / Calc.kunlarSoni(birinchi, marka);
    var kataklar = [['hafta', 'Shu hafta', shuHafta], ['otgan-kun', 'O\'tgan oy shu kuni', otganShuKuni], ['otgan-oy', 'O\'tgan oy', otganOy], ['hamma', 'Hamma vaqt', hammasi]].map(function (k) {
      var t = taqqosla(ortacha, k[2]);
      return { kalit: k[0], nom: k[1], qiymat: Math.round(k[2]), foiz: t.foiz, yon: t.yon };
    });
    return { marka: marka, kunlar: kunlar, ortacha: Math.round(ortacha), kataklar: kataklar };
  }

  // ---- 4) Eng qimmat kun: oxirgi 3 oy (tanlangan oy va undan oldingi 2 oy, marka kunigacha; birinchi yozuvdan oldingi kunlar sanalmaydi) ----
  // Natija: { bor, dan, gacha, hafta: [{ qisqa, toliq, ortacha }] (7), oy: [{ kun, ortacha }] (31), engHafta (indeks), engOy (kun raqami) }
  function engQimmatKun(yozuvlar, oy, bugunSana) {
    var marka = oyMarkazi(oy, bugunSana), birinchi = birinchiSana(yozuvlar);
    var dan = oyBoshi(Calc.oyKalitiSur(oy, -(UCH_OY - 1)));
    if (birinchi && birinchi > dan) dan = birinchi;
    var hJami = [0, 0, 0, 0, 0, 0, 0], hSoni = [0, 0, 0, 0, 0, 0, 0], oJami = [], oSoni = [], i, kun;
    for (i = 0; i <= 31; i++) { oJami.push(0); oSoni.push(0); }
    var kunJami = {};
    yozuvlar.forEach(function (y) { if (xarajatmi(y) && y.sana >= dan && y.sana <= marka) kunJami[y.sana] = (kunJami[y.sana] || 0) + y.summa; });
    var bor = Object.keys(kunJami).length > 0;
    if (birinchi && dan <= marka) {
      for (kun = dan; kun <= marka; kun = Calc.kunQosh(kun, 1)) {
        var s = kunJami[kun] || 0, hi = haftaKuniIndeksi(kun), ki = kunRaqami(kun);
        hJami[hi] += s; hSoni[hi]++; oJami[ki] += s; oSoni[ki]++;
      }
    }
    var hafta = HAFTA_KUNI_TOLIQ.map(function (nom, k) { return { qisqa: Calc.HAFTA_KUNI_QISQA[k], toliq: nom, ortacha: hSoni[k] ? Math.round(hJami[k] / hSoni[k]) : 0 }; });
    var oyKunlari = [];
    for (i = 1; i <= 31; i++) oyKunlari.push({ kun: i, ortacha: oSoni[i] ? Math.round(oJami[i] / oSoni[i]) : 0 });
    var engHafta = 0, engOy = 1;
    hafta.forEach(function (x, k) { if (x.ortacha > hafta[engHafta].ortacha) engHafta = k; });
    oyKunlari.forEach(function (x) { if (x.ortacha > oyKunlari[engOy - 1].ortacha) engOy = x.kun; });
    return { bor: bor, dan: dan, gacha: marka, hafta: hafta, oy: oyKunlari, engHafta: engHafta, engOy: engOy };
  }

  // ---- 5) Kategoriyalar o'tgan oyga nisbatan: shu oyning top 5 xarajat kategoriyasi ----
  // Natija: [{ id, summa, oldingi, farq, foiz (null — o'tgan oyda 0: "yangi"), yon: 'yuqori' | 'past' | 'teng' | 'yangi' }]
  function kategoriyaFarqi(yozuvlar, oy, soni) {
    var c = Calc.davrChegarasi('oy', oyBoshi(oy)), o = Calc.davrChegarasi('oy', oyBoshi(Calc.oyKalitiSur(oy, -1)));
    var hozir = Calc.hisobot(yozuvlar, c.dan, c.gacha, '').xarajatTaqsimoti, oldin = Calc.hisobot(yozuvlar, o.dan, o.gacha, '').xarajatTaqsimoti, oldinXarita = {};
    oldin.forEach(function (x) { oldinXarita[x.kategoriya_id] = x.summa; });
    return hozir.slice(0, soni || 5).map(function (x) {
      var ol = oldinXarita[x.kategoriya_id] || 0, t = Calc.taqqoslash(x.summa, ol);
      return { id: x.kategoriya_id, summa: x.summa, oldingi: ol, farq: t.farq, foiz: t.foiz, yon: t.foiz === null ? 'yangi' : t.foiz > 0 ? 'yuqori' : t.foiz < 0 ? 'past' : 'teng' };
    });
  }
  // "+190 000" / "−52 000" / "0" (so'msiz)
  function belgiliRaqam(n) {
    var s = String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (n < 0 ? '−' : n > 0 ? '+' : '') + s;
  }
  // "+12%" / "−8%" / "0%" / "—"
  function foizMatni(f) { return Calc.belgiliFoiz(f); }

  // Tanlangan oy xarajati: Asosiy sahifadagi "Naqd pul oqimi" bilan AYNAN bir xil (Calc.oyJami)
  function oyXarajati(yozuvlar, oy) { return Calc.oyJami(yozuvlar, oy).xarajat; }

  return {
    TURLAR: TURLAR, DAVRLAR: DAVRLAR, SAQLASH_KALITI: SAQLASH_KALITI, KUN_ORALIQLARI: KUN_ORALIQLARI, HAFTA_KUNI_TOLIQ: HAFTA_KUNI_TOLIQ, DOIRA_ENG_KOP: DOIRA_ENG_KOP,
    grafikTanlovi: grafikTanlovi, grafikTanloviMatni: grafikTanloviMatni, oyMarkazi: oyMarkazi, oyChiplari: oyChiplari, chipSanasi: chipSanasi,
    suril: suril, surishMumkinmi: surishMumkinmi, birinchiSana: birinchiSana, grafikMalumoti: grafikMalumoti, doiraMalumoti: doiraMalumoti,
    taqqosla: taqqosla, kunlikOrtacha: kunlikOrtacha, engQimmatKun: engQimmatKun, kategoriyaFarqi: kategoriyaFarqi,
    belgiliRaqam: belgiliRaqam, foizMatni: foizMatni, oyXarajati: oyXarajati
  };
})();
