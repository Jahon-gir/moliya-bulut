// AI yordamchi chati: toza mantiq (TZ-sinxronlash.md 33-band). Bu yerda DOM, xotira (localStorage) va tarmoq YO'Q:
// sana guruhlash, nom olish va qirqish, cheklovlar, akkaunt bo'yicha tozalash, ism ajratish. Hammasi tests.html da sinaladi.
var ChatSof = (function () {
  'use strict';

  var NOM_MAX = 40;          // suhbat nomi
  var SUHBAT_MAX = 50;       // saqlanadigan suhbatlar soni (eng eskisi o'chadi)
  var XABAR_MAX = 100;       // bitta suhbatdagi xabarlar soni
  var XOTIRA_MAX = 3;        // AI uchun suhbat xotirasi: oxirgi almashinuvlar
  var OYLAR = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
  var GURUHLAR = [['bugun', 'Bugun'], ['kecha', 'Kecha'], ['hafta', 'Oxirgi 7 kun'], ['oldin', 'Oldinroq']];

  function ikki(n) { return (n < 10 ? '0' : '') + n; }
  function kunBoshi(ms) { var d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
  function kunFarqi(ms, hozir) { return Math.round((kunBoshi(hozir) - kunBoshi(ms)) / 86400000); }   // 0 = bugun, 1 = kecha

  // ---- Ism: faqat Google hisobidagi to'liq ism (full_name yoki name), faqat birinchi so'z. Email bo'lagi ishlatilmaydi ----
  function ismAjrat(meta) {
    var m = meta && typeof meta === 'object' ? meta : {};
    var s = typeof m.full_name === 'string' && m.full_name.trim() ? m.full_name : (typeof m.name === 'string' ? m.name : '');
    var soz = s.trim().split(/\s+/)[0] || '';
    return soz.slice(0, 30);
  }
  function salomMatni(ism) { var i = String(ism || '').trim(); return i ? 'Salom, ' + i + '!' : 'Salom!'; }

  // ---- Nom ----
  function nomTozala(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  // Birinchi savoldan nom: bo'shliqlar bitta, 40 belgigacha
  function nomOl(savol) { return nomTozala(savol).slice(0, NOM_MAX); }
  // Tahrirlangan nom: bo'sh bo'lsa null (qabul qilinmaydi), uzun bo'lsa 40 belgigacha qirqiladi
  function nomTekshir(s) { var n = nomOl(s); return n || null; }

  // ---- Vaqt ----
  function soatMatni(ms) { var d = new Date(ms); return ikki(d.getHours()) + ':' + ikki(d.getMinutes()); }
  function guruhOl(ms, hozir) {
    var f = kunFarqi(ms, hozir);
    return f <= 0 ? 'bugun' : f === 1 ? 'kecha' : f <= 7 ? 'hafta' : 'oldin';
  }
  // Ro'yxat qatoridagi vaqt: bugun/kecha — "14:05", qolganlari — "12-okt"
  function qatorVaqti(ms, hozir) {
    var g = guruhOl(ms, hozir);
    if (g === 'bugun' || g === 'kecha') return soatMatni(ms);
    var d = new Date(ms);
    return d.getDate() + '-' + OYLAR[d.getMonth()];
  }

  // ---- Ro'yxat: qidiruv (nom bo'yicha) va sana guruhlari. Yangisi tepada ----
  function guruhla(suhbatlar, hozir, qidiruv) {
    var q = nomTozala(qidiruv).toLowerCase();
    var royxat = (suhbatlar || []).filter(function (s) { return !q || String(s.nom || '').toLowerCase().indexOf(q) >= 0; })
      .sort(function (a, b) { return (b.yangilangan || 0) - (a.yangilangan || 0); });
    return GURUHLAR.map(function (g) {
      return { kalit: g[0], nom: g[1], royxat: royxat.filter(function (s) { return guruhOl(s.yangilangan || 0, hozir) === g[0]; }) };
    }).filter(function (g) { return g.royxat.length; });
  }

  // ---- Cheklovlar ----
  // Ko'pi bilan 50 ta suhbat: eng eski (yangilangan) o'chadi
  function suhbatlarniCheklash(suhbatlar) {
    var r = (suhbatlar || []).slice().sort(function (a, b) { return (b.yangilangan || 0) - (a.yangilangan || 0); });
    return r.slice(0, SUHBAT_MAX);
  }
  // Ko'pi bilan 100 ta xabar: eng eskilari tashlanadi; ro'yxat doim savoldan boshlanadi (javob o'z savolisiz qolmasin)
  function xabarlarniCheklash(xabarlar) {
    var r = (xabarlar || []).slice(-XABAR_MAX);
    while (r.length && r[0].rol !== 'savol') r.shift();
    return r;
  }

  // ---- Xotiraga yoziladigan va undan o'qiladigan shakl ----
  // Faqat savol, javob va xato saqlanadi (kutish — vaqtinchalik). Javob kartalari tuzilgan ma'lumot (HTML emas).
  function saqlanadiganXabar(x) {
    if (!x || typeof x !== 'object') return null;
    var t = typeof x.t === 'number' ? x.t : 0;
    if (x.rol === 'savol') return typeof x.matn === 'string' ? { rol: 'savol', matn: x.matn, t: t } : null;
    if (x.rol === 'javob') return { rol: 'javob', matn: String(x.matn || ''), kartalar: Array.isArray(x.kartalar) ? x.kartalar : [], davom: Array.isArray(x.davom) ? x.davom : [], reja: x.reja && typeof x.reja === 'object' ? x.reja : null, zaxira: !!x.zaxira, t: t };
    if (x.rol === 'xato') return { rol: 'xato', matn: String(x.matn || ''), savol: String(x.savol || ''), kod: String(x.kod || ''), qayta: !!x.qayta, t: t };
    return null;
  }
  function saqlanadiganSuhbat(s) {
    var xab = xabarlarniCheklash((s.xabarlar || []).map(saqlanadiganXabar).filter(Boolean));
    return { id: String(s.id), nom: nomOl(s.nom) || 'Suhbat', yaratilgan: s.yaratilgan || 0, yangilangan: s.yangilangan || 0, xabarlar: xab };
  }
  // Butun xotira yozuvi: akkaunt id bilan bog'langan
  function yozuvYasash(akkaunt, suhbatlar) {
    return { v: 1, akkaunt: String(akkaunt || ''), suhbatlar: suhbatlarniCheklash(suhbatlar || []).map(saqlanadiganSuhbat) };
  }
  // Xotiradan o'qish: yaroqsiz/boshqa akkaunt bo'lsa bo'sh ro'yxat (umumiy qurilma xavfsizligi). Ikkinchi qiymat: tozalash kerakmi
  function yozuvOqi(matn, akkaunt) {
    if (matn == null || matn === '') return { suhbatlar: [], tozalash: false };
    var j;
    try { j = JSON.parse(matn); } catch (e) { return { suhbatlar: [], tozalash: true }; }
    if (!j || typeof j !== 'object' || j.v !== 1 || !Array.isArray(j.suhbatlar)) return { suhbatlar: [], tozalash: true };
    if (!akkaunt || j.akkaunt !== String(akkaunt)) return { suhbatlar: [], tozalash: true };   // boshqa akkaunt: tozalanadi
    var r = j.suhbatlar.filter(function (s) { return s && typeof s === 'object' && s.id && Array.isArray(s.xabarlar); }).map(saqlanadiganSuhbat);
    return { suhbatlar: suhbatlarniCheklash(r), tozalash: false };
  }

  // ---- AI xotirasi: suhbatdagi oxirgi 3 muvaffaqiyatli savol-javob [{ savol, reja, matn }] ----
  function xotiraYasash(xabarlar) {
    var r = [];
    (xabarlar || []).forEach(function (x, i) {
      if (x.rol !== 'javob' || !x.reja) return;
      var oldingi = xabarlar[i - 1];
      if (oldingi && oldingi.rol === 'savol') r.push({ savol: oldingi.matn, reja: x.reja, matn: x.matn || '' });
    });
    return r.slice(-XOTIRA_MAX);
  }

  function yangiId(hozir) { return 'c' + hozir.toString(36) + Math.random().toString(36).slice(2, 8); }

  return {
    NOM_MAX: NOM_MAX, SUHBAT_MAX: SUHBAT_MAX, XABAR_MAX: XABAR_MAX, XOTIRA_MAX: XOTIRA_MAX, GURUHLAR: GURUHLAR,
    ismAjrat: ismAjrat, salomMatni: salomMatni, nomOl: nomOl, nomTekshir: nomTekshir, soatMatni: soatMatni, guruhOl: guruhOl, qatorVaqti: qatorVaqti,
    guruhla: guruhla, suhbatlarniCheklash: suhbatlarniCheklash, xabarlarniCheklash: xabarlarniCheklash,
    yozuvYasash: yozuvYasash, yozuvOqi: yozuvOqi, xotiraYasash: xotiraYasash, yangiId: yangiId
  };
})();
