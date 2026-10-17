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
  var DAROMAD_RANGI = '#1D9E75', XARAJAT_RANGI = '#D85A30';   // grafik seriyalari (tasdiqlangan maket)

  // ---- Tanlovni saqlash (localStorage matni <-> { tur, davr, daromad, xarajat, ulush }); yaroqsiz bo'lsa boshlang'ich ----
  // daromad / xarajat — seriya grafikda ko'rinadimi (kamida bittasi ko'rinadi); ulush — doira: 'xarajat' | 'daromad'
  function korinishTekshir(daromad, xarajat) {
    var d = daromad !== false, x = xarajat !== false;
    return d || x ? { daromad: d, xarajat: x } : { daromad: true, xarajat: true };
  }
  function grafikTanlovi(matn) {
    var j = null;
    try { j = JSON.parse(matn); } catch (e) { j = null; }
    if (!j || typeof j !== 'object') j = {};
    var k = korinishTekshir(j.daromad, j.xarajat);
    return {
      tur: TURLAR.indexOf(j.tur) >= 0 ? j.tur : 'ustun',
      davr: DAVRLAR.indexOf(j.davr) >= 0 ? j.davr : 'oy',
      daromad: k.daromad, xarajat: k.xarajat,
      ulush: j.ulush === 'daromad' ? 'daromad' : 'xarajat'
    };
  }
  function grafikTanloviMatni(t) {
    var k = korinishTekshir(t.daromad, t.xarajat);
    return JSON.stringify({ tur: t.tur, davr: t.davr, daromad: k.daromad, xarajat: k.xarajat, ulush: t.ulush === 'daromad' ? 'daromad' : 'xarajat' });
  }
  // Seriyani yashirish/qaytarish: oxirgi ko'rinib turganini yashirib bo'lmaydi (o'zgarmaydi). Natija: { daromad, xarajat, ozgardi }
  function seriyaniAlmashtir(korinadi, kalit) {
    var y = { daromad: korinadi.daromad !== false, xarajat: korinadi.xarajat !== false };
    var boshqa = kalit === 'daromad' ? 'xarajat' : 'daromad';
    if (y[kalit] && !y[boshqa]) return { daromad: y.daromad, xarajat: y.xarajat, ozgardi: false };
    y[kalit] = !y[kalit];
    return { daromad: y.daromad, xarajat: y.xarajat, ozgardi: true };
  }

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

  // ---- 2) Daromad va xarajat grafigi ma'lumoti (ustun, chiziq, maydon) ----
  // Natija: { davr, dan, gacha, nom, jami: { daromad, xarajat }, bucketlar: [{ qisqa, belgi (yorliq ko'rsatiladimi), toliq, daromad, xarajat }], eng, bosh, vaqtsiz }
  // jami — davrdagi BARCHA daromad va xarajat (Asosiy "Naqd pul oqimi" bilan bir xil qoida: qarz amallari ham, o'tkazma yo'q); kunda vaqti yo'q yozuvlar
  // ustunlarga kirmaydi (vaqtsiz — shularning soni), lekin jamiga kiradi. eng — faqat KO'RINIB TURGAN seriyalar bo'yicha (umumiy shkala).
  // bosh — ko'rinib turgan seriyalarda davrda hech narsa yo'q.
  function grafikMalumoti(yozuvlar, davr, sana, korinadi) {
    var kor = korinishTekshir(korinadi && korinadi.daromad, korinadi && korinadi.xarajat);
    var c = Calc.davrChegarasi(davr, sana), bucketlar = [], jami = { daromad: 0, xarajat: 0 }, vaqtsiz = 0, eng = 0;
    if (davr === 'kun') {
      KUN_ORALIQLARI.forEach(function (q) { bucketlar.push({ qisqa: q, belgi: true, toliq: q.replace('–', ':00 – ') + ':00', daromad: 0, xarajat: 0 }); });
      yozuvlar.forEach(function (y) {
        if ((y.tur !== 'xarajat' && y.tur !== 'daromad') || y.sana !== sana) return;
        jami[y.tur] += y.summa;
        if (!Calc.vaqtFormatiTogrimi(y.vaqt)) { vaqtsiz++; return; }
        bucketlar[Math.floor(parseInt(y.vaqt.slice(0, 2), 10) / 4)][y.tur] += y.summa;
      });
    } else {
      var d = Calc.diagrammaVaqt(yozuvlar, davr, sana, '');
      jami = { daromad: d.jami.daromad, xarajat: d.jami.xarajat };
      d.bucketlar.forEach(function (b, i) {
        bucketlar.push({ qisqa: b.qisqa, belgi: davr === 'oy' ? i % 3 === 0 : true, toliq: b.toliq, daromad: b.daromad, xarajat: b.xarajat });   // oy: yorliqlar siyrak (har 3-si)
      });
    }
    bucketlar.forEach(function (b) {
      if (kor.daromad && b.daromad > eng) eng = b.daromad;
      if (kor.xarajat && b.xarajat > eng) eng = b.xarajat;
    });
    var korinibJami = (kor.daromad ? jami.daromad : 0) + (kor.xarajat ? jami.xarajat : 0);
    return { davr: davr, dan: c.dan, gacha: c.gacha, nom: Calc.davrNomi(davr, sana), jami: jami, bucketlar: bucketlar, eng: eng, bosh: korinibJami === 0, vaqtsiz: vaqtsiz, korinadi: kor };
  }

  // ---- Doira: tanlangan oyning xarajat yoki daromad ulushi (kategoriyalar/manbalar bo'yicha). Legenda ≤ 6 ta; qolgani "Boshqa"ga. Foizlar yig'indisi 100 ----
  // ulush: 'xarajat' (boshlang'ich) | 'daromad'. Natija: { ulush, dan, gacha, nom, jami, bosh, royxat: [{ id, summa, foiz }] }  (id 'boshqa' — qo'shilgan qism)
  function doiraMalumoti(yozuvlar, sana, ulush) {
    var daromad = ulush === 'daromad';
    var c = Calc.davrChegarasi('oy', sana), h = Calc.hisobot(yozuvlar, c.dan, c.gacha, ''), t = daromad ? h.daromadTaqsimoti : h.xarajatTaqsimoti, jami = daromad ? h.daromad : h.xarajat, royxat;
    if (t.length <= DOIRA_ENG_KOP) royxat = t.map(function (x) { return { id: x.kategoriya_id, summa: x.summa }; });
    else {
      royxat = t.slice(0, DOIRA_ENG_KOP - 1).map(function (x) { return { id: x.kategoriya_id, summa: x.summa }; });
      royxat.push({ id: 'boshqa', summa: t.slice(DOIRA_ENG_KOP - 1).reduce(function (a, x) { return a + x.summa; }, 0) });
    }
    var f = Calc.foizlar(royxat.map(function (x) { return x.summa; }));
    royxat.forEach(function (x, i) { x.foiz = f[i]; });
    return { ulush: daromad ? 'daromad' : 'xarajat', dan: c.dan, gacha: c.gacha, nom: Calc.davrNomi('oy', sana), jami: jami, bosh: jami === 0, royxat: royxat };
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
  // ---- 6) Tejash ulushi: qoldi% = (kirim − chiqim) / kirim × 100 (kirim/chiqim grafikdagi qoida bilan: Calc.oyJami, qarzlar hisobotdagidek) ----
  // Natija: { kirim, chiqim, qoldi (butun foiz | null: kirim 0), sarflandi (0..100, chiziq uchun: qoldi + sarflandi = 100), manfiy (chiqim kirimdan ko'p),
  //   ball (o'tgan oyga nisbatan foiz ballar farqi | null), yon: 'yuqori' (ko'proq tejagan) | 'past' | 'teng' | 'yoq' }
  function qoldiFoizi(j) { return j.daromad > 0 ? (Math.round((j.daromad - j.xarajat) * 100 / j.daromad) || 0) : null; }
  function tejash(yozuvlar, oy) {
    var j = Calc.oyJami(yozuvlar, oy), o = Calc.oyJami(yozuvlar, Calc.oyKalitiSur(oy, -1));
    var qoldi = qoldiFoizi(j), oldingi = qoldiFoizi(o), ball = qoldi === null || oldingi === null ? null : qoldi - oldingi;
    return {
      kirim: j.daromad, chiqim: j.xarajat, qoldi: qoldi, oldingi: oldingi,
      sarflandi: qoldi === null ? 0 : Math.max(0, Math.min(100, 100 - qoldi)), manfiy: qoldi !== null && qoldi < 0,
      ball: ball, yon: ball === null ? 'yoq' : ball > 0 ? 'yuqori' : ball < 0 ? 'past' : 'teng'
    };
  }

  // ---- 7) Eng katta 5 xarajat (alohida yozuvlar) va eng kam 5 kun ----
  var OY_QISQA_NOMI = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
  function qisqaSana(sana) { return parseInt(sana.slice(8, 10), 10) + ' ' + OY_QISQA_NOMI[parseInt(sana.slice(5, 7), 10) - 1]; }
  // Tanlangan oydagi eng katta n ta xarajat yozuvi. Qarz amallari (virtual: Berilgan qarz va qarz to'lovlari) haqiqiy xarajat emas — kirmaydi.
  // Natija: [{ id, summa, izoh, kategoriya_id, sana }], teng bo'lsa yangisi birinchi
  function engKattaXarajatlar(yozuvlar, oy, n) {
    var c = Calc.davrChegarasi('oy', oyBoshi(oy));
    return yozuvlar.filter(function (y) { return y.tur === 'xarajat' && !y.virtual && !Calc.qarzKategoriyami(y.kategoriya_id) && y.sana >= c.dan && y.sana <= c.gacha; })
      .sort(function (a, b) { return b.summa - a.summa || (a.sana < b.sana ? 1 : a.sana > b.sana ? -1 : 0); })
      .slice(0, n || 5).map(function (y) { return { id: y.id, summa: y.summa, izoh: String(y.izoh || '').trim(), kategoriya_id: y.kategoriya_id, sana: y.sana }; });
  }
  // Kunlik jami xarajati eng kam n ta kun (xarajati 0 kunlar KIRMAYDI), o'sish tartibida; kunlik jami grafikdagi qoida bilan (qarz amallari ham).
  // Faqat o'tib bo'lgan kunlar (joriy oyda bugungacha). Natija: { bor, royxat: [{ sana, kun (hafta kuni qisqa), summa, soni }], nolKunlar }
  function engKamKunlar(yozuvlar, oy, bugunSana, n) {
    var marka = oyMarkazi(oy, bugunSana), jami = {}, soni = {}, kunlar = 0;
    yozuvlar.forEach(function (y) {
      if (!xarajatmi(y) || y.sana < oyBoshi(oy) || y.sana > marka) return;
      jami[y.sana] = (jami[y.sana] || 0) + y.summa; soni[y.sana] = (soni[y.sana] || 0) + 1;
    });
    kunlar = kunRaqami(marka);
    var royxat = Object.keys(jami).filter(function (k) { return jami[k] > 0; }).sort(function (a, b) { return jami[a] - jami[b] || (a < b ? -1 : 1); }).slice(0, n || 5)
      .map(function (k) { return { sana: k, kun: Calc.HAFTA_KUNI_QISQA[haftaKuniIndeksi(k)], summa: jami[k], soni: soni[k] }; });
    var xarajatliKunlar = Object.keys(jami).filter(function (k) { return jami[k] > 0; }).length;
    return { bor: xarajatliKunlar > 0, royxat: royxat, nolKunlar: kunlar - xarajatliKunlar };
  }

  // ---- 8) Qarz hisoboti ----
  // Joriy qoldiq (tanlangan oydan qat'i nazar, hozirgi holat): Calc.qarzlarJami — menga qarzdor (olishKerak) va men qarzdorman (qaytarishKerak); sof = menga − men.
  // Oy harakati: Calc.qarzYozuvlari (Asosiy hisobot bilan bir xil qoida) dan: q: — qarzning o'zi (Olindi — kirim, Berildi — chiqim), t: — to'lov
  // (Menga qaytdi — kirim, Men qaytardim — chiqim). Eng katta 3 qoldiq — shaxs va yo'nalish bo'yicha (Calc.qarzlarShaxsBoyicha).
  function qarzHisoboti(qarzlar, oy, bugunSana) {
    if (!qarzlar || !qarzlar.length) return { bor: false };
    var j = Calc.qarzlarJami(qarzlar), c = Calc.davrChegarasi('oy', oyBoshi(oy)), h = { olindi: 0, berildi: 0, menQaytardim: 0, mengaQaytdi: 0 };
    Calc.qarzYozuvlari(qarzlar).forEach(function (y) {
      if (y.sana < c.dan || y.sana > c.gacha) return;
      var qarz = y.id.charAt(0) === 'q', kirim = y.tur === 'daromad';
      if (qarz) h[kirim ? 'olindi' : 'berildi'] += y.summa; else h[kirim ? 'mengaQaytdi' : 'menQaytardim'] += y.summa;
    });
    var eng = Calc.qarzlarShaxsBoyicha(qarzlar, bugunSana).ochiq.slice().sort(function (a, b) { return b.qolgan - a.qolgan; }).slice(0, 3)
      .map(function (g) { return { shaxs: g.shaxs, yonalish: g.yonalish, qolgan: g.qolgan }; });
    return { bor: true, men: j.qaytarishKerak, menga: j.olishKerak, sof: j.olishKerak - j.qaytarishKerak, harakat: h, eng: eng };
  }

  // Qisqa summa tor kataklar uchun: 500 000 -> "500 k", 1 250 000 -> "1,3 M", 2 000 000 000 -> "2 B" (bitta o'nlik xona, nol bo'lsa tushadi)
  function qisqaK(n) {
    var a = Math.abs(Math.round(n)), b = [[1e9, 'B'], [1e6, 'M'], [1e3, 'k']];
    for (var i = 0; i < b.length; i++) {
      if (a < b[i][0]) continue;
      var r = Math.round(a / b[i][0] * 10) / 10;
      if (r >= 1000 && i > 0) return String(Math.round(a / b[i - 1][0] * 10) / 10).replace('.', ',') + ' ' + b[i - 1][1];   // 999 950 -> "1 M"
      return String(r).replace('.', ',') + ' ' + b[i][1];
    }
    return String(a);
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
  // Tanlangan oy daromadi: Asosiy "Naqd pul oqimi" daromadi bilan AYNAN bir xil (Olingan qarz kirim sifatida kiradi)
  function oyDaromadi(yozuvlar, oy) { return Calc.oyJami(yozuvlar, oy).daromad; }

  return {
    TURLAR: TURLAR, DAVRLAR: DAVRLAR, SAQLASH_KALITI: SAQLASH_KALITI, KUN_ORALIQLARI: KUN_ORALIQLARI, HAFTA_KUNI_TOLIQ: HAFTA_KUNI_TOLIQ, DOIRA_ENG_KOP: DOIRA_ENG_KOP,
    grafikTanlovi: grafikTanlovi, grafikTanloviMatni: grafikTanloviMatni, seriyaniAlmashtir: seriyaniAlmashtir, korinishTekshir: korinishTekshir,
    DAROMAD_RANGI: DAROMAD_RANGI, XARAJAT_RANGI: XARAJAT_RANGI, oyMarkazi: oyMarkazi, oyChiplari: oyChiplari, chipSanasi: chipSanasi,
    suril: suril, surishMumkinmi: surishMumkinmi, birinchiSana: birinchiSana, grafikMalumoti: grafikMalumoti, doiraMalumoti: doiraMalumoti,
    taqqosla: taqqosla, kunlikOrtacha: kunlikOrtacha, engQimmatKun: engQimmatKun, kategoriyaFarqi: kategoriyaFarqi,
    tejash: tejash, engKattaXarajatlar: engKattaXarajatlar, engKamKunlar: engKamKunlar, qarzHisoboti: qarzHisoboti, qisqaSana: qisqaSana, qisqaK: qisqaK,
    belgiliRaqam: belgiliRaqam, foizMatni: foizMatni, oyXarajati: oyXarajati, oyDaromadi: oyDaromadi
  };
})();
