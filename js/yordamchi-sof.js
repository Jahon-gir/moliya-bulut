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
  function kategoriyaNomi(m, id) {
    var k = Calc.qarzKategoriyami(id) ? Calc.QARZ_KATEGORIYALAR.filter(function (x) { return x.id === id; })[0] : m.kategoriyalar.filter(function (x) { return x.id === id; })[0];
    return k ? qirqNom(k.nom) : 'Noma\'lum';
  }
  // So'rovdagi filtr: tur (bo'sh bo'lsa kategoriyaning turi, u ham bo'lmasa xarajat), kategoriya, hisob, izohdan qidiriladigan so'z
  function filtrYasash(m, s) {
    var kat = kategoriyaTop(m, s.kategoriya), his = hisobTop(m, s.hisob);
    var tur = s.tur || (kat && kat.tur) || 'xarajat';
    return { tur: tur, kat: kat, his: his, matn: s.matn || '' };
  }
  // Davrdagi yozuvlar (virtual qarz yozuvlari bilan): faqat tur bo'yicha daromad/xarajat. Izohdan qidirilsa, virtual yozuvlar tushmaydi (ularning "izohi" qarzdagi shaxs ismi)
  function yozuvlarOl(m, f, dan, gacha) {
    var yoz = f.matn ? m.yozuvlar : hisobotYozuvlari(m);
    return Calc.yozuvlarniSuz(yoz, { tur: f.tur, kategoriya: f.kat ? f.kat.id : '', hisob: f.his ? f.his.id : '', dan: dan, gacha: gacha, qidiruv: f.matn });
  }
  function jamiOl(royxat) { return royxat.reduce(function (a, y) { return a + y.summa; }, 0); }
  function echo(natija, f) {
    natija.tur = f.tur;
    if (f.kat) natija.kategoriya = qirqNom(f.kat.nom);
    if (f.his) natija.hisob = qirqNom(f.his.nom);
    return natija;
  }

  function yigindi(m, s) {
    var f = filtrYasash(m, s), r = yozuvlarOl(m, f, s.davr.dan, s.davr.gacha);
    return echo({ jami: butun(jamiOl(r)), yozuvlar_soni: r.length }, f);
  }

  function kategoriyalar(m, s) {
    var f = filtrYasash(m, s);
    var h = Calc.hisobot(hisobotYozuvlari(m), s.davr.dan, s.davr.gacha, f.his ? f.his.id : '');
    var t = f.tur === 'daromad' ? h.daromadTaqsimoti : h.xarajatTaqsimoti;
    var natija = { tur: f.tur, jami: butun(f.tur === 'daromad' ? h.daromad : h.xarajat), eng_katta: t.slice(0, ENG_KATTA).map(function (x) { return { nom: kategoriyaNomi(m, x.kategoriya_id), summa: butun(x.summa) }; }) };
    if (f.his) natija.hisob = qirqNom(f.his.nom);
    return natija;
  }

  function qidiruv(m, s) {
    var f = filtrYasash(m, s);
    if (!f.matn) f.matn = '';
    var r = yozuvlarOl(m, f, s.davr.dan, s.davr.gacha);
    return echo({ topilgan_soni: r.length, jami: butun(jamiOl(r)) }, f);
  }

  // Taqqoslash: ikki davr jami. Hamma son manfiy emas (server raqam tekshiruvi minusni tanimaydi): yo'nalish alohida so'z bilan
  function taqqoslash(m, s) {
    var f = filtrYasash(m, s), d2 = s.davr2 || s.davr;
    var a = jamiOl(yozuvlarOl(m, f, s.davr.dan, s.davr.gacha)), b = jamiOl(yozuvlarOl(m, f, d2.dan, d2.gacha));
    var t = Calc.taqqoslash(a, b);   // joriy (1-davr) va oldingi (2-davr)
    var natija = { davr1_jami: butun(a), davr2_jami: butun(b), farq: butun(Math.abs(t.farq)), yonalish: t.farq > 0 ? 'oshgan' : t.farq < 0 ? 'kamaygan' : 'teng' };
    if (t.foiz !== null) natija.foiz = Math.abs(t.foiz);   // 2-davr jami 0 bo'lsa foiz yo'q
    return echo(natija, f);
  }

  function qarzlar(m, s, bugunSana) {
    var ochiq = m.qarzlar.filter(function (q) { return !Calc.qarzYopilganmi(q); });
    var j = Calc.qarzlarJami(m.qarzlar);
    var shaxslar = {};
    ochiq.forEach(function (q) { shaxslar[Calc.nomKaliti(q.shaxs)] = true; });
    var muddatli = ochiq.filter(function (q) { return !!q.muddat; }).sort(function (a, b) { return a.muddat < b.muddat ? -1 : a.muddat > b.muddat ? 1 : 0; });
    var natija = { berilgan_jami: butun(j.olishKerak), olingan_jami: butun(j.qaytarishKerak), kishi_soni: Object.keys(shaxslar).length, eng_yaqin_muddat: null };
    if (muddatli.length) {
      var sana = muddatli[0].muddat;
      natija.eng_yaqin_muddat = {
        sana: sana,
        summa: butun(muddatli.filter(function (q) { return q.muddat === sana; }).reduce(function (a, q) { return a + Calc.qarzQolgan(q); }, 0)),
        otgan: sana < bugunSana
      };
    }
    return natija;
  }

  // Hisoblar: arxivlanmaganlar. Qoldiq manfiy bo'lsa son musbat yoziladi, "manfiy: true" qo'shiladi
  function hisoblar(m, s) {
    var f = filtrYasash(m, s);
    var royxat = m.hisoblar.filter(function (h) { return !h.arxivlangan && (!f.his || h.id === f.his.id); });
    var jami = royxat.reduce(function (a, h) { return a + Calc.hisobQoldigi(h, m.yozuvlar, m.qarzlar); }, 0);
    var natija = { jami_balans: Math.abs(butun(jami)), hisoblar: royxat.slice(0, HISOB_MAX).map(function (h) {
      var q = butun(Calc.hisobQoldigi(h, m.yozuvlar, m.qarzlar)), x = { nom: qirqNom(h.nom), qoldiq: Math.abs(q) };
      if (q < 0) x.manfiy = true;
      return x;
    }) };
    if (jami < 0) natija.jami_manfiy = true;
    return natija;
  }

  function oylikHisobot(m, s) {
    var f = filtrYasash(m, s);
    var h = Calc.hisobot(hisobotYozuvlari(m), s.davr.dan, s.davr.gacha, f.his ? f.his.id : '');
    var eng = h.xarajatTaqsimoti[0];
    var natija = { xarajat: butun(h.xarajat), daromad: butun(h.daromad), sof_balans: Math.abs(butun(h.qoldiq)), sof_yonalish: h.qoldiq > 0 ? 'ortiqcha' : h.qoldiq < 0 ? 'kamomad' : 'nol',
      eng_katta_kategoriya: eng ? { nom: kategoriyaNomi(m, eng.kategoriya_id), summa: butun(eng.summa) } : null };
    if (f.his) natija.hisob = qirqNom(f.his.nom);
    return natija;
  }

  // Asosiy kirish. m = { hisoblar, kategoriyalar, yozuvlar, qarzlar } (mantiqiy o'chirilganlar allaqachon chiqarilgan), s = serverdan kelgan tuzilgan so'rov.
  // Qaytaradi: natija obyekti yoki null (amal "tushunarsiz" yoki noma'lum)
  function hisobla(s, m, bugunSana) {
    if (!s || !s.davr && s.amal !== 'qarzlar' && s.amal !== 'hisoblar') return null;
    var natija;
    switch (s.amal) {
      case 'yigindi': natija = yigindi(m, s); break;
      case 'kategoriyalar': natija = kategoriyalar(m, s); break;
      case 'qidiruv': natija = qidiruv(m, s); break;
      case 'taqqoslash': natija = taqqoslash(m, s); break;
      case 'qarzlar': natija = qarzlar(m, s, bugunSana); break;
      case 'hisoblar': natija = hisoblar(m, s); break;
      case 'oylik_hisobot': natija = oylikHisobot(m, s); break;
      default: return null;
    }
    return natija;
  }

  return {
    SAVOL_MAX: SAVOL_MAX, TUSHUNARSIZ_MATNI: TUSHUNARSIZ_MATNI, XATOLAR: XATOLAR, TAQIQ_KALIT: TAQIQ_KALIT,
    xatoMatni: xatoMatni, xatoQaytaMi: xatoQaytaMi, tayyorSavollar: tayyorSavollar, nomlar: nomlar,
    natijaTekshir: natijaTekshir, natijaYuborsaBoladimi: natijaYuborsaBoladimi, hisobla: hisobla
  };
})();
