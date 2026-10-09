// AI yordamchi: telefonda hisoblash (TZ-sinxronlash.md 24-band). Bu faylda DOM, tarmoq va xotira yo'q: faqat sof funksiyalar, tests.html da sinaladi.
// Tuzilgan so'rov (23-band) shu yerda ilovaning o'z ma'lumotidan hisoblanadi. Hisob-kitoblar mavjud Calc funksiyalari bilan (hisobot, yozuvlarniSuz,
// hisobQoldigi, qarzlarJami ...): mantiq takrorlanmaydi. Serverga FAQAT raqamlar, sanalar, kategoriya va hisob nomlari ketadi.
var YordamchiSof = (function () {
  'use strict';

  var SAVOL_MAX = 300;
  var NOM_MAX = 60;          // serverdagi chegara (23.3)
  var RO_YXAT_MAX = 100;
  var ENG_KATTA = 5;         // "kategoriyalar" amalida eng katta nechta
  var HISOB_MAX = 30;        // "hisoblar" natijasida ko'pi bilan nechta hisob
  var OY_NOMLARI = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
  // Server natijada rad etadigan kalitlar bilan bir xil (supabase/functions/yordamchi/index.ts, TAQIQ_KALIT): maxfiylik
  var TAQIQ_KALIT = /^(izoh|shaxs|ism|familiya|yozuvlar|qarzdor|kimga|kimdan|tolovlar|matn|savol)$/;

  // Tayyor javoblar (serverga ikkinchi so'rov yuborilmaydi) va ularning bosiladigan savollari
  var TUSHUNARSIZ_MATNI = 'Savolni tushunmadim.';
  var TUSHUNARSIZ_SAVOLLAR = ['Shu oy xarajatim', 'Hisoblarimda qancha bor?', 'Menga kim qarzdor?', 'Byudjetimdan qancha qoldi?'];
  var TASHQARI_MATNI = 'Men faqat Chuntak AI dagi pullaringiz haqida gaplasha olaman.';
  var TASHQARI_SAVOLLAR = ['Shu oy xarajatim', 'Hisoblarimda qancha bor?', 'Shu oy eng katta 5 ta xarajatim'];
  var UMUMIY_JAVOB = 'Men Chuntak AI yordamchisiman: pullaringiz haqidagi savollarga yozuvlaringiz asosida javob beraman. Masalan: «Shu oy xarajatim», «Hisoblarimda qancha bor?», «Byudjetimdan qancha qoldi?» yoki «Shu oy eng katta 5 ta xarajatim».';
  var UMUMIY_SAVOLLAR = ['Shu oy xarajatim', 'Hisoblarimda qancha bor?', 'Byudjetimdan qancha qoldi?'];
  var XOTIRA_MAX = 3;        // suhbat xotirasi: oxirgi almashinuvlar soni
  var SOROV_MAX = 5;         // bitta rejada so'rovlar (serverdagi chegara)
  var NATIJALAR_MAX = 10000; // hamma natijalar JSON uzunligi (serverdagi chegara)

  // Xato kodi -> { matn, qayta } (qayta: "Qayta urinish" ko'rsatilsinmi). Kod matn oxirida "(kod: ...)" bilan chiqadi.
  var XATOLAR = {
    NETWORK_OFFLINE: { matn: 'Internet yo\'q. Ulanib, qayta urinib ko\'ring.', qayta: true },
    NETWORK: { matn: 'Serverga ulanib bo\'lmadi. Internetni tekshirib, qayta urinib ko\'ring.', qayta: true },
    AUTH_EXPIRED: { matn: 'Kirish muddati tugagan. Menyu → Profil dan chiqib, qayta kiring.', qayta: true },
    AI_RUXSAT: { matn: 'Kirish muddati tugagan. Menyu → Profil dan chiqib, qayta kiring.', qayta: true },
    AI_LIMIT: { matn: 'Bugungi savollar limiti tugadi. Ertaga qayta urinib ko\'ring.', qayta: true },
    AI_PROVAYDER: { matn: 'Yordamchi hozir javob bera olmayapti. Birozdan keyin qayta urinib ko\'ring.', qayta: true },
    AI_RAQAM: { matn: 'Javob aniq chiqmadi. Qayta urinib ko\'ring.', qayta: true },
    AI_SXEMA: { matn: 'Javob aniq chiqmadi. Qayta urinib ko\'ring.', qayta: true },
    AI_UZUN: { matn: 'Savol juda uzun (300 belgigacha yozing).', qayta: false },
    AI_KIRISH: { matn: 'So\'rov noto\'g\'ri tuzilgan. Savolni boshqacha yozib ko\'ring.', qayta: true }
  };
  function xatoMatni(kod) {
    var x = XATOLAR[kod];
    var k = x ? kod : (String(kod || '').length ? String(kod) : 'JS_UNKNOWN');
    var matn = x ? x.matn : (/^HTTP_/.test(k) ? 'Yordamchi serveri kutilgan javob bermadi.' : 'Kutilmagan xato. Qayta urinib ko\'ring.');
    return matn + '\n(kod: ' + k + ')';
  }
  function xatoQaytaMi(kod) { var x = XATOLAR[kod]; return x ? x.qayta : true; }

  // ---- Tayyor savollar (bo'sh suhbatda) ----
  function tayyorSavollar(bugunSana) {
    var oy = OY_NOMLARI[parseInt(String(bugunSana).slice(5, 7), 10) - 1] || 'Oylik';
    return ['Shu oy xarajatim', 'Shu oy eng ko\'p nimaga sarfladim?', 'Menga kim qarzdor?', 'Hisoblarimda qancha bor?', oy + ' hisoboti'];
  }

  // ---- Serverga yuboriladigan nomlar (reja rejimi) ----
  function tozaNom(s) {
    // boshqaruv belgilari olib tashlanadi; server ham shunday qiladi
    return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
  }
  function nomRoyxati(royxat) {
    var korilgan = {}, chiq = [];
    royxat.forEach(function (nom) {
      var t = tozaNom(nom), k = Calc.nomKaliti(t);
      if (!t || t.length > NOM_MAX || korilgan[k] || chiq.length >= RO_YXAT_MAX) return;
      korilgan[k] = true; chiq.push(t);
    });
    return chiq;
  }
  // Kategoriya nomlari (qarz amallarining "Olingan qarz" / "Berilgan qarz" hisobot kategoriyalari ham: ular Asosiy sahifadagi hisobotda bor) va hisob nomlari
  function nomlar(malumot) {
    return {
      kategoriyalar: nomRoyxati(malumot.kategoriyalar.map(function (k) { return k.nom; }).concat(Calc.QARZ_KATEGORIYALAR.map(function (k) { return k.nom; }))),
      hisoblar: nomRoyxati(malumot.hisoblar.map(function (h) { return h.nom; }))
    };
  }

  // ---- Natija maxfiyligi: server qoidalarining nusxasi (yuborishdan oldin ilovaning o'zi ham tekshiradi) ----
  function natijaTekshir(x, chuqurlik, sanagich) {
    sanagich = sanagich || { n: 0 }; chuqurlik = chuqurlik || 0;
    if (++sanagich.n > 400 || chuqurlik > 4) return false;
    if (x === null || typeof x === 'boolean') return true;
    if (typeof x === 'number') return isFinite(x);
    if (typeof x === 'string') return x.length <= NOM_MAX && tozaNom(x) === x;
    if (Array.isArray(x)) return x.every(function (v) { return natijaTekshir(v, chuqurlik + 1, sanagich); });
    if (typeof x === 'object') {
      return Object.keys(x).every(function (k) { return /^[a-z][a-z0-9_]{0,39}$/.test(k) && !TAQIQ_KALIT.test(k) && natijaTekshir(x[k], chuqurlik + 1, sanagich); });
    }
    return false;
  }
  function natijaYuborsaBoladimi(n) {
    return !!n && typeof n === 'object' && !Array.isArray(n) && natijaTekshir(n) && JSON.stringify(n).length <= 4000;
  }

  // ---- Hisoblash ----
  function butun(n) { return Math.round(n); }
  function qirqNom(s) { var t = tozaNom(s); return t.length > NOM_MAX ? t.slice(0, NOM_MAX) : t; }
  // Hisobot yozuvlari: yozuvlar + qarz amallari ("Olingan qarz" / "Berilgan qarz"), ilovaning Asosiy sahifasidagi hisobot bilan bir xil (TZ 20.4)
  function hisobotYozuvlari(m) { return m.qarzlar.length ? m.yozuvlar.concat(Calc.qarzYozuvlari(m.qarzlar)) : m.yozuvlar; }
  function kategoriyaTop(m, nom) {
    if (nom == null) return null;
    var k = Calc.nomKaliti(nom);
    var r = m.kategoriyalar.filter(function (x) { return Calc.nomKaliti(x.nom) === k; })[0] || Calc.QARZ_KATEGORIYALAR.filter(function (x) { return Calc.nomKaliti(x.nom) === k; })[0];
    return r || { id: '__yoq__', nom: nom, tur: null };
  }
  function hisobTop(m, nom) {
    if (nom == null) return null;
    var k = Calc.nomKaliti(nom);
    return m.hisoblar.filter(function (x) { return Calc.nomKaliti(x.nom) === k; })[0] || { id: '__yoq__', nom: nom };
  }
  function kategoriyaObyekti(m, id) {
    return (Calc.qarzKategoriyami(id) ? Calc.QARZ_KATEGORIYALAR.filter(function (x) { return x.id === id; })[0] : m.kategoriyalar.filter(function (x) { return x.id === id; })[0]) || null;
  }
  function kategoriyaNomi(m, id) { var k = kategoriyaObyekti(m, id); return k ? qirqNom(k.nom) : 'Noma\'lum'; }
  // So'rovdagi filtr: tur (bo'sh bo'lsa kategoriyaning turi, u ham bo'lmasa xarajat), kategoriya, hisob, izohdan qidiriladigan so'z
  function filtrYasash(m, s) {
    var kat = kategoriyaTop(m, s.kategoriya), his = hisobTop(m, s.hisob);
    var tur = s.tur || (kat && kat.tur) || 'xarajat';
    return { tur: tur, kat: kat, his: his, matn: s.matn || '' };
  }
  function suzFiltri(f, dan, gacha, qidiruv) {
    return { tur: f.tur, kategoriya: f.kat ? f.kat.id : '', hisob: f.his ? f.his.id : '', dan: dan, gacha: gacha, qidiruv: qidiruv || '' };
  }
  function jamiOl(royxat) { return royxat.reduce(function (a, y) { return a + y.summa; }, 0); }
  function echo(natija, f) {
    natija.tur = f.tur;
    if (f.kat) natija.kategoriya = qirqNom(f.kat.nom);
    if (f.his) natija.hisob = qirqNom(f.his.nom);
    return natija;
  }

  // ---- Izohdan qidiruv: aniq qoida (TZ 25.3) ----
  // TOZA yozuv: izoh faqat qidirilgan so'zdan (o'zbekcha qo'shimchali: nonga, nonlar...) va ixtiyoriy BITTA butun sondan ("2 ta", "3ta", "4") iborat.
  // ARALASH yozuv: izohda so'z bor, lekin boshqa so'zlar ham bor ("non-choy", "non, sut", "ovqat va non") yoki son aniq emas (bir nechta son, 1–999 dan tashqari). Jamiga QO'SHILMAYDI.
  // Boshqa hollarda (so'z yo'q yoki faqat harflar ketma-ketligi ichida: "nonushta") topilmaydi.
  function bolaklar(matn) {
    return String(matn == null ? '' : matn).normalize('NFKC').toLowerCase().replace(/[ʻʼ‘’`´']/g, '').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  }
  var QOSHIMCHALAR = (function () {
    var x = {};
    ['', 'lar'].forEach(function (a) { ['', 'i', 'si', 'im', 'ing', 'imiz', 'ingiz', 'lari'].forEach(function (b) { ['', 'ga', 'ni', 'ning', 'da', 'dan', 'ka', 'ki', 'gacha'].forEach(function (c) { x[a + b + c] = true; }); }); });
    return x;
  })();
  function sonOl(t) {   // "2" yoki "3ta" / "3dona" -> son (1..999), aks holda 0
    var m = /^(\d{1,3})(?:ta|dona)?$/.exec(t);
    return m && +m[1] >= 1 ? +m[1] : 0;
  }
  // -> null (topilmadi) | { tur: 'toza' | 'aralash', son: son | null }
  function izohTasnifi(izoh, soz) {
    var t = bolaklar(izoh), w = bolaklar(soz), i, j;
    if (!w.length || !t.length) return null;
    var belgi = t.map(function () { return false; }), topildi = false;
    for (i = 0; i + w.length <= t.length; i++) {
      var ok = true;
      for (j = 0; j < w.length && ok; j++) {
        var tok = t[i + j];
        ok = j < w.length - 1 ? tok === w[j] : (tok.indexOf(w[j]) === 0 && QOSHIMCHALAR[tok.slice(w[j].length)] === true);
      }
      if (ok) { for (j = 0; j < w.length; j++) belgi[i + j] = true; topildi = true; i += w.length - 1; }
    }
    if (!topildi) return null;
    var toza = true, son = null, sonlar = 0;
    t.forEach(function (tok, k) {
      if (belgi[k]) return;
      var n = sonOl(tok);
      if (n) { sonlar++; son = n; return; }
      if ((tok === 'ta' || tok === 'dona') && k > 0 && /^\d{1,3}$/.test(t[k - 1]) && sonOl(t[k - 1])) return;   // "2 ta non"
      toza = false;
    });
    if (sonlar > 1) toza = false;
    return toza ? { tur: 'toza', son: son } : { tur: 'aralash', son: null };
  }
  function yozuvKaliti(a, b) { var x = a.sana + ' ' + (a.vaqt || ''), y = b.sana + ' ' + (b.vaqt || ''); return x < y ? 1 : x > y ? -1 : 0; }
  // Davrdagi oddiy (haqiqiy) yozuvlar bo'yicha qidiruv. Qarz amallari izohi — shaxs ismi, shuning uchun qidirilmaydi.
  function qidirish(m, f, dan, gacha) {
    var toza = [], aralash = [];
    Calc.yozuvlarniSuz(m.yozuvlar, suzFiltri(f, dan, gacha, '')).sort(yozuvKaliti).forEach(function (y) {
      var t = izohTasnifi(y.izoh, f.matn);
      if (!t) return;
      var q = { id: y.id, sana: y.sana, izoh: y.izoh || '', summa: y.summa, son: t.son };
      (t.tur === 'toza' ? toza : aralash).push(q);
    });
    var jami = jamiOl(toza), sonli = toza.filter(function (q) { return q.son; });
    var dona = sonli.reduce(function (a, q) { return a + q.son; }, 0);
    return { toza: toza, aralash: aralash, toza_jami: butun(jami), jami_dona: dona, ortacha_narx: dona ? butun(jamiOl(sonli) / dona) : 0 };
  }
  function qidiruvTahlili(m, s, bugunSana) {
    var f = filtrYasash(m, s), r = qidirish(m, f, s.davr.dan, s.davr.gacha);
    var natija = { toza_soni: r.toza.length, toza_jami: r.toza_jami, aralash_soni: r.aralash.length };
    if (r.jami_dona) { natija.jami_dona = r.jami_dona; natija.ortacha_narx = r.ortacha_narx; }
    return { natija: echo(natija, f), karta: { amal: 'qidiruv', tur: f.tur, soz: f.matn, davr: s.davr, davrNomi: davrMatni(s.davr, bugunSana), toza: r.toza, aralash: r.aralash, toza_jami: r.toza_jami, jami_dona: r.jami_dona, ortacha_narx: r.ortacha_narx, hisob_id: f.his ? f.his.id : '', kategoriya_id: f.kat ? f.kat.id : '' } };
  }

  // Davr nomi ko'rinishda: "shu hafta", "Oktabr", "2026-yil", "03.10.2026 – 09.10.2026"
  function davrMatni(d, bugunSana) {
    if (!d) return '';
    if (d.dan === d.gacha) return d.dan === bugunSana ? 'bugun' : d.dan === Calc.kunQosh(bugunSana, -1) ? 'kecha' : Calc.sanaKorsat(d.dan);
    var h = Calc.davrChegarasi('hafta', bugunSana);
    if (d.dan === h.dan && (d.gacha === h.gacha || d.gacha === bugunSana)) return 'shu hafta';
    var oy = Calc.davrChegarasi('oy', d.dan), yil = d.dan.slice(0, 4);
    if (d.dan === oy.dan && (d.gacha === oy.gacha || (d.gacha === bugunSana && bugunSana <= oy.gacha))) return OY_NOMLARI[parseInt(d.dan.slice(5, 7), 10) - 1] + (yil !== bugunSana.slice(0, 4) ? ' ' + yil : '');
    if (d.dan === yil + '-01-01' && d.gacha === yil + '-12-31') return yil + '-yil';
    return Calc.oraliqNomi(d.dan, d.gacha);
  }
  var TUR_NOMI = { xarajat: 'xarajat', daromad: 'daromad' };
  function bosh(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  // ---- Har amal: { natija (serverga ketadi), karta (faqat ekranda: ismlar, izohlar ham bo'lishi mumkin) } ----
  function yigindiTahlili(m, s, bugunSana) {
    var f = filtrYasash(m, s);
    if (f.matn) return qidiruvTahlili(m, s, bugunSana);   // izohdan qidiruv har doim yuqoridagi aniq qoida bilan
    var r = Calc.yozuvlarniSuz(hisobotYozuvlari(m), suzFiltri(f, s.davr.dan, s.davr.gacha, ''));
    var natija = echo({ jami: butun(jamiOl(r)), yozuvlar_soni: r.length }, f);
    return { natija: natija, karta: null, gap: yigindiGapi(natija, s, bugunSana) };
  }
  // Karta yo'q amalda ilova o'zi tuzgan sodda gap (AI gapi ishlamaganda ham shu chiqadi)
  function yigindiGapi(n, s, bugunSana) {
    var q = [davrMatni(s.davr, bugunSana), TUR_NOMI[n.tur] || n.tur];
    if (n.kategoriya) q.push(n.kategoriya);
    if (n.hisob) q.push(n.hisob);
    return bosh(q.join(' · ')) + ': ' + Calc.sumFormat(n.jami) + ' (' + n.yozuvlar_soni + ' ta yozuv).';
  }

  function kategoriyalarTahlili(m, s, bugunSana) {
    var f = filtrYasash(m, s);
    var h = Calc.hisobot(hisobotYozuvlari(m), s.davr.dan, s.davr.gacha, f.his ? f.his.id : '');
    var t = f.tur === 'daromad' ? h.daromadTaqsimoti : h.xarajatTaqsimoti, jami = butun(f.tur === 'daromad' ? h.daromad : h.xarajat);
    var top = t.slice(0, ENG_KATTA);
    var natija = { tur: f.tur, jami: jami, eng_katta: top.map(function (x) { return { nom: kategoriyaNomi(m, x.kategoriya_id), summa: butun(x.summa) }; }) };
    if (f.his) natija.hisob = qirqNom(f.his.nom);
    return { natija: natija, karta: { amal: 'kategoriyalar', tur: f.tur, jami: jami, davr: s.davr, davrNomi: davrMatni(s.davr, bugunSana), hisob: f.his ? qirqNom(f.his.nom) : '', hisob_id: f.his ? f.his.id : '',
      qatorlar: top.map(function (x) { return { id: x.kategoriya_id, nom: kategoriyaNomi(m, x.kategoriya_id), summa: butun(x.summa), kat: kategoriyaObyekti(m, x.kategoriya_id) }; }) } };
  }

  // Taqqoslash: ikki davr jami. Hamma son manfiy emas (server raqam tekshiruvi minusni tanimaydi): yo'nalish alohida so'z bilan
  function davrJami(m, f, dan, gacha) {
    return f.matn ? qidirish(m, f, dan, gacha).toza_jami : jamiOl(Calc.yozuvlarniSuz(hisobotYozuvlari(m), suzFiltri(f, dan, gacha, '')));
  }
  function taqqoslashTahlili(m, s, bugunSana) {
    var f = filtrYasash(m, s), d2 = s.davr2 || s.davr;
    var a = davrJami(m, f, s.davr.dan, s.davr.gacha), b = davrJami(m, f, d2.dan, d2.gacha);
    var t = Calc.taqqoslash(a, b);   // joriy (1-davr) va oldingi (2-davr)
    var natija = { davr1_jami: butun(a), davr2_jami: butun(b), farq: butun(Math.abs(t.farq)), yonalish: t.farq > 0 ? 'oshgan' : t.farq < 0 ? 'kamaygan' : 'teng' };
    if (t.foiz !== null) natija.foiz = Math.abs(t.foiz);   // 2-davr jami 0 bo'lsa foiz yo'q
    var n1 = davrMatni(s.davr, bugunSana), n2 = davrMatni(d2, bugunSana);
    if (n1 === n2) { n1 += ' (1-davr)'; n2 += ' (2-davr)'; }
    return { natija: echo(natija, f), karta: { amal: 'taqqoslash', tur: f.tur, soz: f.matn, davr1: { nom: n1, jami: natija.davr1_jami, davr: s.davr }, davr2: { nom: n2, jami: natija.davr2_jami, davr: d2 },
      farq: natija.farq, yonalish: natija.yonalish, foiz: natija.foiz === undefined ? null : natija.foiz } };
  }

  var OLINGAN_SOZLAR = /kimga|qarzman|qarz olgan|qarz oldim|oldim|olingan|qaytarishim|qaytarishim kerak/i;
  function qarzlarTahlili(m, s, bugunSana, savol) {
    var ochiq = m.qarzlar.filter(function (q) { return !Calc.qarzYopilganmi(q); });
    var j = Calc.qarzlarJami(m.qarzlar), shaxslar = {};
    ochiq.forEach(function (q) { shaxslar[Calc.nomKaliti(q.shaxs)] = true; });
    var muddatli = ochiq.filter(function (q) { return !!q.muddat; }).sort(function (a, b) { return a.muddat < b.muddat ? -1 : a.muddat > b.muddat ? 1 : 0; });
    var natija = { berilgan_jami: butun(j.olishKerak), olingan_jami: butun(j.qaytarishKerak), kishi_soni: Object.keys(shaxslar).length, eng_yaqin_muddat: null };
    if (muddatli.length) {
      var sana = muddatli[0].muddat;
      natija.eng_yaqin_muddat = { sana: sana, summa: butun(muddatli.filter(function (q) { return q.muddat === sana; }).reduce(function (a, q) { return a + Calc.qarzQolgan(q); }, 0)), otgan: sana < bugunSana };
    }
    var guruhlar = Calc.qarzlarShaxsBoyicha(m.qarzlar, bugunSana).ochiq;
    function tomon(yon) {
      var qator = guruhlar.filter(function (g) { return g.yonalish === yon; }).map(function (g) {
        var mud = g.qarzlar.filter(function (q) { return !!q.muddat; }).map(function (q) { return q.muddat; }).sort()[0] || '';
        return { shaxs: g.shaxs, muddat: mud, otgan: !!mud && mud < bugunSana, qolgan: butun(g.qolgan) };
      });
      return { jami: qator.reduce(function (a, q) { return a + q.qolgan; }, 0), kishi: qator.length, qatorlar: qator };
    }
    var bd = tomon('berdim'), ol = tomon('oldim');
    var boshlang = OLINGAN_SOZLAR.test(String(savol || '')) && ol.jami > 0 ? 'oldim' : (bd.jami === 0 && ol.jami > 0 ? 'oldim' : 'berdim');
    return { natija: natija, karta: { amal: 'qarzlar', berdim: bd, oldim: ol, boshlang: boshlang } };
  }

  // Hisoblar: arxivlanmaganlar. Qoldiq manfiy bo'lsa son musbat yoziladi, "manfiy: true" qo'shiladi
  function hisoblarTahlili(m, s) {
    var f = filtrYasash(m, s);
    var royxat = m.hisoblar.filter(function (h) { return !h.arxivlangan && (!f.his || h.id === f.his.id); });
    var qol = royxat.map(function (h) { return { id: h.id, nom: qirqNom(h.nom), qoldiq: butun(Calc.hisobQoldigi(h, m.yozuvlar, m.qarzlar)) }; });
    var jami = qol.reduce(function (a, x) { return a + x.qoldiq; }, 0);
    var natija = { jami_balans: Math.abs(jami), hisoblar: qol.slice(0, HISOB_MAX).map(function (x) { var o = { nom: x.nom, qoldiq: Math.abs(x.qoldiq) }; if (x.qoldiq < 0) o.manfiy = true; return o; }) };
    if (jami < 0) natija.jami_manfiy = true;
    var tartib = qol.slice().sort(function (a, b) { return b.qoldiq - a.qoldiq; });
    return { natija: natija, karta: { amal: 'hisoblar', jami: jami, qatorlar: tartib } };
  }

  function oylikTahlili(m, s, bugunSana) {
    var f = filtrYasash(m, s);
    var h = Calc.hisobot(hisobotYozuvlari(m), s.davr.dan, s.davr.gacha, f.his ? f.his.id : '');
    var eng = h.xarajatTaqsimoti[0], engKat = eng ? { nom: kategoriyaNomi(m, eng.kategoriya_id), summa: butun(eng.summa) } : null;
    var natija = { xarajat: butun(h.xarajat), daromad: butun(h.daromad), sof_balans: Math.abs(butun(h.qoldiq)), sof_yonalish: h.qoldiq > 0 ? 'ortiqcha' : h.qoldiq < 0 ? 'kamomad' : 'nol', eng_katta_kategoriya: engKat };
    if (f.his) natija.hisob = qirqNom(f.his.nom);
    return { natija: natija, karta: { amal: 'oylik_hisobot', davr: s.davr, davrNomi: davrMatni(s.davr, bugunSana), xarajat: natija.xarajat, daromad: natija.daromad, sof: butun(h.qoldiq), eng: engKat, hisob: f.his ? qirqNom(f.his.nom) : '', hisob_id: f.his ? f.his.id : '' } };
  }

  // ---- Yangi amallar (TZ 26): jadval, chegara, eng_katta_yozuvlar, byudjet, taxmin, jamgarma ----
  var GURUH_NOMI = { kategoriya: 'kategoriyalar bo\'yicha', hisob: 'hisoblar bo\'yicha', kun: 'kunlar bo\'yicha', hafta: 'haftalar bo\'yicha', oy: 'oylar bo\'yicha', yil: 'yillar bo\'yicha', hafta_kuni: 'hafta kunlari bo\'yicha', yoq: '' };
  function olchovNomi(o, tur) {
    if (o === 'jami') return tur === 'aylanma' ? 'aylanma' : tur;
    return { soni: (tur === 'aylanma' ? 'harakatlar' : tur + ' yozuvlari') + ' soni', ortacha: 'o\'rtacha ' + (tur === 'aylanma' ? 'harakat' : tur + ' yozuvi'), eng_katta: 'eng katta ' + (tur === 'aylanma' ? 'harakat' : tur + ' yozuvi'), eng_kichik: 'eng kichik ' + (tur === 'aylanma' ? 'harakat' : tur + ' yozuvi') }[o];
  }
  // Hisobga kirgan va chiqqan hamma pul: daromad/xarajat, o'tkazma (ikki hisob uchun ikki harakat), qarz amallari va qaytarishlar. [{ sana, summa, hisob_id, kirim }]
  function harakatlar(m, dan, gacha, hisobId) {
    var r = [];
    function qosh(sana, summa, h, kirim) { if (sana >= dan && sana <= gacha && (!hisobId || h === hisobId)) r.push({ sana: sana, summa: summa, hisob_id: h, kirim: kirim }); }
    m.yozuvlar.forEach(function (y) {
      if (y.tur === 'daromad') qosh(y.sana, y.summa, y.hisob_id, true);
      else if (y.tur === 'xarajat') qosh(y.sana, y.summa, y.hisob_id, false);
      else if (y.tur === 'otkazma') { qosh(y.sana, y.summa, y.hisob_id, false); qosh(y.sana, y.summa, y.qabul_hisob_id, true); }
    });
    m.qarzlar.forEach(function (z) {
      var berdim = z.yonalish === 'berdim';
      qosh(z.sana, z.summa, z.hisob_id, !berdim);
      (z.tolovlar || []).forEach(function (t) { if (t.deleted !== true) qosh(t.sana, t.summa, t.hisob_id, berdim); });
    });
    return r;
  }
  function hisobNomiOl(m, id) { var h = m.hisoblar.filter(function (x) { return x.id === id; })[0]; return h ? qirqNom(h.nom) : 'Noma\'lum'; }
  function ozgartir(royxat, olchov) {   // royxat: summalar; natija: bitta qiymat
    if (!royxat.length) return 0;
    if (olchov === 'soni') return royxat.length;
    var jami = royxat.reduce(function (a, x) { return a + x; }, 0);
    if (olchov === 'jami') return jami;
    if (olchov === 'ortacha') return jami / royxat.length;
    return olchov === 'eng_katta' ? Math.max.apply(null, royxat) : Math.min.apply(null, royxat);
  }
  function guruhKaliti(g, x, m) {
    if (g === 'kategoriya') return { k: x.kategoriya_id || '', nom: x.kategoriya_id ? kategoriyaNomi(m, x.kategoriya_id) : 'Kategoriyasiz' };
    if (g === 'hisob') return { k: x.hisob_id, nom: hisobNomiOl(m, x.hisob_id) };
    if (g === 'kun') return { k: x.sana, nom: x.sana };
    if (g === 'hafta') { var d = Calc.davrChegarasi('hafta', x.sana).dan; return { k: d, nom: d }; }
    if (g === 'oy') return { k: x.sana.slice(0, 7), nom: x.sana.slice(0, 7) };
    if (g === 'yil') return { k: x.sana.slice(0, 4), nom: x.sana.slice(0, 4) };
    if (g === 'hafta_kuni') { var n = Calc.haftaKuni(x.sana); return { k: n, nom: n }; }
    return { k: 'hammasi', nom: 'Hammasi' };
  }
  // Ko'rinishdagi qator nomi (natijada ISO sana/oy qoladi: server raqam tekshiruvi sana qismlarini taniydi)
  function guruhKorsatma(g, nom) {
    if (g === 'kun') return Calc.sanaKorsat(nom);
    if (g === 'hafta') return Calc.oraliqNomi(nom, Calc.kunQosh(nom, 6));
    if (g === 'oy') return OY_NOMLARI[parseInt(nom.slice(5, 7), 10) - 1] + ' ' + nom.slice(0, 4);
    return nom;
  }
  function jadvalTahlili(m, s, bugunSana) {
    var f = filtrYasash(m, s), tur = s.tur;
    var f2 = { tur: tur === 'aylanma' ? '' : tur, kat: f.kat, his: f.his };
    var elementlar;
    if (tur === 'aylanma') elementlar = harakatlar(m, s.davr.dan, s.davr.gacha, f.his ? f.his.id : '');
    else elementlar = Calc.yozuvlarniSuz(hisobotYozuvlari(m), suzFiltri(f2, s.davr.dan, s.davr.gacha, ''));
    var guruhlar = {}, tartib = [];
    elementlar.forEach(function (x) {
      var g = guruhKaliti(s.guruh, x, m), q = guruhlar[g.k];
      if (!q) { q = guruhlar[g.k] = { nom: g.nom, summalar: [] }; tartib.push(q); }
      q.summalar.push(x.summa);
    });
    var barcha = elementlar.map(function (x) { return x.summa; }), umumiy = butun(ozgartir(barcha, s.olchov));
    var qatorlar = tartib.map(function (q) { return { nom: q.nom, qiymat: butun(ozgartir(q.summalar, s.olchov)) }; });
    var yon = s.tartib === 'osish' ? 1 : -1;
    qatorlar.sort(function (a, b) { return yon * (a.qiymat - b.qiymat) || (a.nom < b.nom ? -1 : a.nom > b.nom ? 1 : 0); });
    var soniJami = qatorlar.length;
    var ulush = s.olchov === 'jami' || s.olchov === 'soni';
    qatorlar = qatorlar.slice(0, s.limit).map(function (q) {
      var o = { nom: q.nom, qiymat: q.qiymat };
      if (ulush) o.foiz = umumiy > 0 ? Math.round(q.qiymat * 100 / umumiy) : 0;
      return o;
    });
    var natija = { tur: tur, guruh: s.guruh, olchov: s.olchov, umumiy: umumiy, qatorlar_soni: soniJami, qatorlar: qatorlar };
    if (f.kat && tur !== 'aylanma') natija.kategoriya = qirqNom(f.kat.nom);
    if (f.his) natija.hisob = qirqNom(f.his.nom);
    var davrN = davrMatni(s.davr, bugunSana), gN = GURUH_NOMI[s.guruh];
    return { natija: natija, karta: { amal: 'jadval', sarlavha: bosh(davrN + ' · ' + (gN ? gN + ' ' : '') + olchovNomi(s.olchov, tur)), olchov: s.olchov, tur: tur, umumiy: umumiy,
      qatorlar: qatorlar.map(function (q) { return { nom: guruhKorsatma(s.guruh, q.nom), qiymat: q.qiymat, foiz: q.foiz === undefined ? null : q.foiz }; }), qatorlar_soni: soniJami } };
  }

  function chegaraTahlili(m, s) {
    var kat = kategoriyaTop(m, s.kategoriya), his = hisobTop(m, s.hisob);
    var r = Calc.yozuvlarniSuz(m.yozuvlar, { tur: s.tur || '', kategoriya: kat ? kat.id : '', hisob: his ? his.id : '' });
    var sanalar = r.map(function (y) { return y.sana; }).sort();
    var natija = { birinchi_sana: sanalar.length ? sanalar[0] : null, oxirgi_sana: sanalar.length ? sanalar[sanalar.length - 1] : null, yozuvlar_soni: r.length };
    if (s.tur) natija.tur = s.tur;
    if (kat) natija.kategoriya = qirqNom(kat.nom);
    if (his) natija.hisob = qirqNom(his.nom);
    return { natija: natija, karta: { amal: 'chegara', sarlavha: 'Yozuvlar chegarasi' + (s.tur ? ' · ' + s.tur : '') + (kat ? ' · ' + qirqNom(kat.nom) : '') + (his ? ' · ' + qirqNom(his.nom) : ''), birinchi: natija.birinchi_sana, oxirgi: natija.oxirgi_sana, soni: r.length } };
  }

  function engKattaTahlili(m, s, bugunSana) {
    var kat = kategoriyaTop(m, s.kategoriya);
    var r = Calc.yozuvlarniSuz(m.yozuvlar, { tur: s.tur, kategoriya: kat ? kat.id : '', dan: s.davr.dan, gacha: s.davr.gacha });
    r.sort(function (a, b) { return b.summa - a.summa || yozuvKaliti(a, b); });
    var top = r.slice(0, s.limit);
    var natija = { tur: s.tur, topilgan_soni: r.length, royxat: top.map(function (y) { return { sana: y.sana, kategoriya: kategoriyaNomi(m, y.kategoriya_id), summa: butun(y.summa) }; }) };
    if (kat) natija.kategoriya = qirqNom(kat.nom);
    return { natija: natija, karta: { amal: 'eng_katta_yozuvlar', sarlavha: bosh(davrMatni(s.davr, bugunSana) + ' · eng katta ' + (s.tur === 'daromad' ? 'daromadlar' : 'xarajatlar') + (kat ? ' · ' + qirqNom(kat.nom) : '')), tur: s.tur,
      topilgan_soni: r.length, qatorlar: top.map(function (y) { return { id: y.id, sana: y.sana, kategoriya: kategoriyaNomi(m, y.kategoriya_id), izoh: y.izoh || '', summa: butun(y.summa) }; }) } };
  }

  // Byudjet: mavjud Calc.byudjetHisobi (joriy oy; qarz byudjetga kirmaydi, o'tkazma ham)
  function byudjetTahlili(m, s, bugunSana) {
    var h = Calc.byudjetHisobi(m.byudjetlar || [], m.kategoriyalar, m.yozuvlar, bugunSana), kat = kategoriyaTop(m, s.kategoriya);
    function qator(nom, x) { var t = x.holat; return { nom: nom, limit: butun(t.limit), sarflangan: butun(t.sarflangan), qolgan: butun(t.qolgan), oshgan: butun(t.oshgan), foiz: t.foiz }; }
    var qatorlar = h.chegarali.filter(function (x) { return !kat || x.kategoriya.id === kat.id; }).slice(0, 20).map(function (x) { return qator(qirqNom(x.kategoriya.nom), x); });
    var umumiy = !kat && h.umumiy ? qator('Umumiy oylik chegara', h.umumiy) : null;
    var natija = { oy: bugunSana.slice(0, 7), belgilangan: !!(umumiy || qatorlar.length), umumiy: umumiy ? { limit: umumiy.limit, sarflangan: umumiy.sarflangan, qolgan: umumiy.qolgan, oshgan: umumiy.oshgan, foiz: umumiy.foiz } : null,
      kategoriyalar: qatorlar };
    var kartaQatorlar = (umumiy ? [umumiy] : []).concat(qatorlar).map(function (q) {
      var kk = h.chegarali.filter(function (x) { return qirqNom(x.kategoriya.nom) === q.nom; })[0];
      return Object.assign({}, q, { nom: q.nom === 'Umumiy oylik chegara' ? 'Umumiy' : q.nom, chiziq: q.limit > 0 ? Math.min(100, q.sarflangan * 100 / q.limit) : 0, oshib: q.oshgan > 0, kat: kk ? kk.kategoriya : null });
    });
    return { natija: natija, karta: { amal: 'byudjet', oyNomi: davrMatni(Calc.davrChegarasi('oy', bugunSana), bugunSana), belgilangan: natija.belgilangan, qatorlar: kartaQatorlar } };
  }

  // Taxmin (faqat joriy oy): shu kungacha xarajat + kunlik o'rtacha * oyda qolgan kunlar (butun so'mga yaxlitlanadi)
  function taxminTahlili(m, s, bugunSana) {
    var oy = Calc.davrChegarasi('oy', bugunSana), kunlar = Calc.kunlarSoni(oy.dan, oy.gacha), otgan = parseInt(bugunSana.slice(8, 10), 10), qolgan = kunlar - otgan;
    var shu = Calc.hisobot(hisobotYozuvlari(m), oy.dan, bugunSana, '').xarajat, ortacha = shu / otgan;
    var natija = { oy: bugunSana.slice(0, 7), shu_kungacha: butun(shu), otgan_kunlar: otgan, kunlik_ortacha: butun(ortacha), qolgan_kunlar: qolgan, kutilayotgan_jami: butun(shu + ortacha * qolgan) };
    return { natija: natija, karta: null, gap: 'Taxmin: oy oxirigacha jami taxminan ' + Calc.sumFormat(natija.kutilayotgan_jami) + ' xarajat bo\'ladi (shu kungacha ' + Calc.sumFormat(natija.shu_kungacha) + ', kuniga o\'rtacha ' + Calc.sumFormat(natija.kunlik_ortacha) + ', oyda ' + qolgan + ' kun qoldi).' };
  }

  // Jamg'arma: davr daromadi - xarajati; foiz = farq / daromad (daromad 0 bo'lsa foiz yo'q)
  function jamgarmaTahlili(m, s, bugunSana) {
    var h = Calc.hisobot(hisobotYozuvlari(m), s.davr.dan, s.davr.gacha, ''), farq = h.daromad - h.xarajat;
    var natija = { daromad: butun(h.daromad), xarajat: butun(h.xarajat), farq: Math.abs(butun(farq)), farq_yonalish: farq > 0 ? 'ortiqcha' : farq < 0 ? 'kamomad' : 'nol' };
    if (h.daromad > 0) natija.foiz = Math.round(Math.abs(farq) * 100 / h.daromad);
    var bosh_ = bosh(davrMatni(s.davr, bugunSana)) + ': daromad ' + Calc.sumFormat(natija.daromad) + ', xarajat ' + Calc.sumFormat(natija.xarajat) + ' — ';
    var gap = farq > 0 ? bosh_ + Calc.sumFormat(natija.farq) + ' tejaldi' + (natija.foiz !== undefined ? ' (daromadning ' + natija.foiz + '%)' : '') + '.'
      : farq < 0 ? bosh_ + 'xarajat daromaddan ' + Calc.sumFormat(natija.farq) + ' ko\'p.' : bosh_ + 'daromad va xarajat teng.';
    return { natija: natija, karta: null, gap: gap };
  }

  // Davom savollari (serverdagi davomniTekshir nusxasi): 2..3 ta, har biri ≤ 40 belgi, raqamsiz; aks holda hammasi tashlanadi
  function davomniTekshir(x) {
    if (!Array.isArray(x) || x.length < 2 || x.length > 3) return [];
    var chiq = [];
    for (var i = 0; i < x.length; i++) {
      var t = typeof x[i] === 'string' ? tozaNom(x[i]).replace(/\s+/g, ' ') : '';
      if (!t || t.length > 40 || /\d/.test(t) || chiq.indexOf(t) >= 0) return [];
      chiq.push(t);
    }
    return chiq;
  }

  // Asosiy kirish. m = { hisoblar, kategoriyalar, yozuvlar, qarzlar } (mantiqiy o'chirilganlar allaqachon chiqarilgan), s = serverdan kelgan tuzilgan so'rov.
  // Qaytaradi: { natija, karta, gap } yoki null (amal "tushunarsiz" yoki noma'lum). natija — serverga, karta — faqat ekranga, gap — karta yo'q amalda ilovaning o'z gapi.
  function tahlil(s, m, bugunSana, savol) {
    if (!s || !s.davr && ['qarzlar', 'hisoblar', 'chegara', 'byudjet', 'taxmin'].indexOf(s.amal) < 0) return null;
    switch (s.amal) {
      case 'yigindi': return yigindiTahlili(m, s, bugunSana);
      case 'kategoriyalar': return kategoriyalarTahlili(m, s, bugunSana);
      case 'qidiruv': return qidiruvTahlili(m, s, bugunSana);
      case 'taqqoslash': return taqqoslashTahlili(m, s, bugunSana);
      case 'qarzlar': return qarzlarTahlili(m, s, bugunSana, savol);
      case 'hisoblar': return hisoblarTahlili(m, s);
      case 'oylik_hisobot': return oylikTahlili(m, s, bugunSana);
      case 'jadval': return jadvalTahlili(m, s, bugunSana);
      case 'chegara': return chegaraTahlili(m, s);
      case 'eng_katta_yozuvlar': return engKattaTahlili(m, s, bugunSana);
      case 'byudjet': return byudjetTahlili(m, s, bugunSana);
      case 'taxmin': return taxminTahlili(m, s, bugunSana);
      case 'jamgarma': return jamgarmaTahlili(m, s, bugunSana);
      default: return null;
    }
  }
  // Bir rejadagi 1..5 so'rov ketma-ket hisoblanadi: [{ sorov, natija, karta, gap }] (hisoblab bo'lmaganlari tashlanadi; tushunarsiz so'rovlar ham)
  function tahlillar(sorovlar, m, bugunSana, savol) {
    var chiq = [];
    (sorovlar || []).slice(0, SOROV_MAX).forEach(function (s) {
      if (!s || s.amal === 'tushunarsiz') return;
      var t = tahlil(s, m, bugunSana, savol);
      if (t && natijaYuborsaBoladimi(t.natija)) chiq.push({ sorov: s, natija: t.natija, karta: t.karta || null, gap: t.gap || '' });
    });
    return chiq;
  }
  function natijalarYuborsaBoladimi(natijalar) { return natijalar.length > 0 && natijalar.length <= SOROV_MAX && JSON.stringify(natijalar).length <= NATIJALAR_MAX; }
  function hisobla(s, m, bugunSana) { var t = tahlil(s, m, bugunSana); return t ? t.natija : null; }

  return {
    SAVOL_MAX: SAVOL_MAX, XOTIRA_MAX: XOTIRA_MAX, SOROV_MAX: SOROV_MAX, XATOLAR: XATOLAR, TAQIQ_KALIT: TAQIQ_KALIT,
    TUSHUNARSIZ_MATNI: TUSHUNARSIZ_MATNI, TUSHUNARSIZ_SAVOLLAR: TUSHUNARSIZ_SAVOLLAR, TASHQARI_MATNI: TASHQARI_MATNI, TASHQARI_SAVOLLAR: TASHQARI_SAVOLLAR, UMUMIY_JAVOB: UMUMIY_JAVOB, UMUMIY_SAVOLLAR: UMUMIY_SAVOLLAR,
    tahlillar: tahlillar, davomniTekshir: davomniTekshir, natijalarYuborsaBoladimi: natijalarYuborsaBoladimi, harakatlar: harakatlar,
    xatoMatni: xatoMatni, xatoQaytaMi: xatoQaytaMi, tayyorSavollar: tayyorSavollar, nomlar: nomlar,
    natijaTekshir: natijaTekshir, natijaYuborsaBoladimi: natijaYuborsaBoladimi, hisobla: hisobla, tahlil: tahlil, izohTasnifi: izohTasnifi, davrMatni: davrMatni
  };
})();
