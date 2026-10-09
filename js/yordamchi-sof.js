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

  var TUSHUNARSIZ_MATNI = 'Savolni tushunmadim. Masalan: «Shu oy taksiga qancha ketdi?»';

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

  // Asosiy kirish. m = { hisoblar, kategoriyalar, yozuvlar, qarzlar } (mantiqiy o'chirilganlar allaqachon chiqarilgan), s = serverdan kelgan tuzilgan so'rov.
  // Qaytaradi: { natija, karta, gap } yoki null (amal "tushunarsiz" yoki noma'lum). natija — serverga, karta — faqat ekranga, gap — karta yo'q amalda ilovaning o'z gapi.
  function tahlil(s, m, bugunSana, savol) {
    if (!s || !s.davr && s.amal !== 'qarzlar' && s.amal !== 'hisoblar') return null;
    switch (s.amal) {
      case 'yigindi': return yigindiTahlili(m, s, bugunSana);
      case 'kategoriyalar': return kategoriyalarTahlili(m, s, bugunSana);
      case 'qidiruv': return qidiruvTahlili(m, s, bugunSana);
      case 'taqqoslash': return taqqoslashTahlili(m, s, bugunSana);
      case 'qarzlar': return qarzlarTahlili(m, s, bugunSana, savol);
      case 'hisoblar': return hisoblarTahlili(m, s);
      case 'oylik_hisobot': return oylikTahlili(m, s, bugunSana);
      default: return null;
    }
  }
  function hisobla(s, m, bugunSana) { var t = tahlil(s, m, bugunSana); return t ? t.natija : null; }

  return {
    SAVOL_MAX: SAVOL_MAX, TUSHUNARSIZ_MATNI: TUSHUNARSIZ_MATNI, XATOLAR: XATOLAR, TAQIQ_KALIT: TAQIQ_KALIT,
    xatoMatni: xatoMatni, xatoQaytaMi: xatoQaytaMi, tayyorSavollar: tayyorSavollar, nomlar: nomlar,
    natijaTekshir: natijaTekshir, natijaYuborsaBoladimi: natijaYuborsaBoladimi, hisobla: hisobla, tahlil: tahlil, izohTasnifi: izohTasnifi, davrMatni: davrMatni
  };
})();
