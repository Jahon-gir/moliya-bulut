// Belgilar (ikonkalar) — bitta joyda. Hammasi o'zimiz chizgan oddiy chiziqli SVG (24x24, tashqi kutubxonasiz).
// Kategoriya va hisobda faqat belgi KALITI saqlanadi (masalan "oziq"); chizish shu yerdan.
// Bu fayl calc.js dan OLDIN yuklanadi: ro'yxat va nom bo'yicha taxmin DOM siz ishlaydi, chizish (chiz) faqat brauzerda.
// Yo'l yozuvi: oddiy satr — path "d"; "o<cx>,<cy>,<r>" — aylana; "r<x>,<y>,<w>,<h>,<rx>" — to'rtburchak.
(function (global) {
  'use strict';

  // guruh: 'xarajat' | 'daromad' | 'umumiy' (ikkala turda ishlatiladi) | 'hisob'. soz — nom bo'yicha taxmin uchun kalit so'zlar (boshlanishi).
  var RO_YXAT = [
    // --- xarajat ---
    { kalit: 'oziq', nom: 'Oziq-ovqat', guruh: 'xarajat', soz: ['oziq', 'ovqat', 'food', 'non', 'taom', 'tushlik'], yol: ['M6 3v6a3 3 0 0 0 6 0V3M9 3v18', 'M17 21V3c-2 1.5-3 4-3 7h3'] },
    { kalit: 'transport', nom: 'Transport', guruh: 'xarajat', soz: ['transport', 'taksi', 'avtobus', 'metro', 'yol'], yol: ['r4,3,16,14,3', 'M4 11h16', 'M7 17v3M17 17v3', 'o8,14,0.6', 'o16,14,0.6'] },
    { kalit: 'uy', nom: 'Uy', guruh: 'xarajat', soz: ['uy', 'ijarauy', 'kvartira', 'rozgor', 'ro\'zg\'or', 'rozg'], yol: ['M3 11l9-8 9 8', 'M5 10v10h14V10', 'M10 20v-6h4v6'] },
    { kalit: 'kommunal', nom: 'Kommunal', guruh: 'xarajat', soz: ['kommunal', 'elektr', 'chiroq', 'gaz'], yol: ['M9 18h6M10 21h4', 'M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z'] },
    { kalit: 'suv', nom: 'Suv', guruh: 'xarajat', soz: ['suv', 'water'], yol: ['M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z'] },
    { kalit: 'sogliq', nom: 'Sog\'liq', guruh: 'xarajat', soz: ['sog', 'shifokor', 'klinika', 'tibbiy', 'salomatlik'], yol: ['M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z'] },
    { kalit: 'dori', nom: 'Dori-darmon', guruh: 'xarajat', soz: ['dori', 'apteka', 'tabletka'], yol: ['M10.5 20.5l-7-7a4.9 4.9 0 0 1 7-7l7 7a4.9 4.9 0 0 1-7 7z', 'M8.5 8.5l7 7'] },
    { kalit: 'bolalar', nom: 'Bolalar', guruh: 'xarajat', soz: ['bola', 'farzand', 'bog\'cha', 'bogcha', 'o\'yinchoq', 'oyinchoq', 'child'], yol: ['o12,12,9', 'o9,10.5,0.7', 'o15,10.5,0.7', 'M8.5 14.5a4.5 4.5 0 0 0 7 0'] },
    { kalit: 'talim', nom: 'Ta\'lim', guruh: 'xarajat', soz: ['talim', 'o\'qish', 'oqish', 'kurs', 'maktab', 'universitet', 'repetitor'], yol: ['M2 9l10-5 10 5-10 5z', 'M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5', 'M22 9v6'] },
    { kalit: 'kitob', nom: 'Kitob', guruh: 'xarajat', soz: ['kitob', 'book'], yol: ['M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z', 'M4 21h15'] },
    { kalit: 'kiyim', nom: 'Kiyim', guruh: 'xarajat', soz: ['kiyim', 'poyabzal', 'ko\'ylak', 'koylak', 'kostyum'], yol: ['M8 3l-5 4 3 3 2-1v12h8V9l2 1 3-3-5-4a4 4 0 0 1-8 0z'] },
    { kalit: 'aloqa', nom: 'Aloqa', guruh: 'xarajat', soz: ['aloqa', 'telefon', 'mobil', 'sim'], yol: ['r7,2,10,20,2', 'M11 18h2'] },
    { kalit: 'internet', nom: 'Internet', guruh: 'xarajat', soz: ['internet', 'wifi', 'tarmoq'], yol: ['M2 9a15 15 0 0 1 20 0', 'M5 12.5a10.5 10.5 0 0 1 14 0', 'M8.5 16a5.5 5.5 0 0 1 7 0', 'o12,19.5,1'] },
    { kalit: 'kongilochar', nom: 'Ko\'ngilochar', guruh: 'xarajat', soz: ['ko\'ngil', 'kongil', 'kino', 'o\'yin', 'oyin', 'dam'], yol: ['M6 8h12a4 4 0 0 1 4 4v1a3 3 0 0 1-5 2l-1-1H8l-1 1a3 3 0 0 1-5-2v-1a4 4 0 0 1 4-4z', 'M8 10v3M6.5 11.5h3', 'M16 11h.01M18 13h.01'] },
    { kalit: 'sovga', nom: 'Sovg\'a', guruh: 'umumiy', soz: ['sovg', 'sovga', 'gift', 'tug\'ilgan', 'tugilgan'], yol: ['r3,8,18,4,1', 'r5,12,14,9,1', 'M12 8v13', 'M12 8C9 8 8 4.5 10 4.5S12 6.5 12 8zM12 8c3 0 4-3.5 2-3.5S12 6.5 12 8z'] },
    { kalit: 'sport', nom: 'Sport', guruh: 'xarajat', soz: ['sport', 'zal', 'fitnes', 'futbol'], yol: ['M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12'] },
    { kalit: 'soliq', nom: 'Soliq', guruh: 'xarajat', soz: ['soliq', 'jarima', 'davlat', 'tax'], yol: ['M6 3h9l4 4v14H6z', 'M15 3v4h4', 'M9 17l6-6', 'o9.5,11.5,0.8', 'o14.5,16.5,0.8'] },
    { kalit: 'tamirlash', nom: 'Ta\'mirlash', guruh: 'xarajat', soz: ['ta\'mir', 'tamir', 'remont', 'usta', 'qurilish'], yol: ['M15 4a5 5 0 0 0-4.5 6.7L3.5 17.7a2 2 0 0 0 2.8 2.8l7-7A5 5 0 0 0 20 9l-3 3-3-1-1-3z'] },
    { kalit: 'texnika', nom: 'Texnika', guruh: 'xarajat', soz: ['texnika', 'noutbuk', 'kompyuter', 'gadjet', 'elektron'], yol: ['M5 6h14v9H5z', 'M2 19h20'] },
    { kalit: 'yoqilgi', nom: 'Yoqilg\'i', guruh: 'xarajat', soz: ['yoqilg', 'benzin', 'metan', 'propan', 'zapravka'], yol: ['r4,4,9,17,1', 'M4 9h9', 'M13 8h3l2 2v7a1.5 1.5 0 0 0 3 0V9l-3-3'] },
    { kalit: 'avto', nom: 'Avtomobil', guruh: 'xarajat', soz: ['avto', 'mashina', 'moshina', 'car'], yol: ['M4 15v-4l2-5h12l2 5v4', 'M4 15h16', 'M4 15v3h3v-3M17 15v3h3v-3', 'M5 11h14'] },
    { kalit: 'sayohat', nom: 'Sayohat', guruh: 'xarajat', soz: ['sayohat', 'safar', 'aviachipta', 'mehmonxona', 'travel'], yol: ['M21 3L3 10l7 3 3 7z', 'M10 13l11-10'] },
    { kalit: 'hayvon', nom: 'Uy hayvonlari', guruh: 'xarajat', soz: ['hayvon', 'mushuk', 'veterinar'], yol: ['o7,10,1.6', 'o11,6.5,1.6', 'o15,6.5,1.6', 'o19,10,1.6', 'M8 17c0-3 2-5 4-5s4 2 4 5-2 3-4 3-4 0-4-3z'] },
    { kalit: 'xayriya', nom: 'Xayriya', guruh: 'xarajat', soz: ['xayriya', 'sadaqa', 'zakot', 'ehson'], yol: ['M12 14s-4-2.5-4-5.5a2.3 2.3 0 0 1 4-1.5 2.3 2.3 0 0 1 4 1.5c0 3-4 5.5-4 5.5z', 'M4 18h4l4 2h6a2 2 0 0 0 0-4h-4'] },
    { kalit: 'kredit', nom: 'Kredit', guruh: 'xarajat', soz: ['kredit', 'qarz', 'ipoteka', 'loan', 'nasiya'], yol: ['M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z', 'M4 7v5c0 1.7 3.6 3 8 3s8-1.3 8-3V7', 'M4 12v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5'] },
    { kalit: 'komissiya', nom: 'Komissiya', guruh: 'xarajat', soz: ['komissiya', 'foiz', 'xizmat'], yol: ['M19 5L5 19', 'o7,7,2.5', 'o17,17,2.5'] },
    { kalit: 'obuna', nom: 'Obuna', guruh: 'xarajat', soz: ['obuna', 'abonent', 'subscription', 'netflix', 'musiqa'], yol: ['M4 11V9a3 3 0 0 1 3-3h12l-3-3', 'M20 13v2a3 3 0 0 1-3 3H5l3 3'] },
    { kalit: 'goz', nom: 'Go\'zallik', guruh: 'xarajat', soz: ['go\'zal', 'gozal', 'salon', 'parfyum', 'kosmetika', 'soch'], yol: ['M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z', 'M19 16l.8 2.2 2.2.8-2.2.8L19 22l-.8-2.2-2.2-.8 2.2-.8z'] },
    { kalit: 'kafe', nom: 'Kafe', guruh: 'xarajat', soz: ['kafe', 'restoran', 'choyxona', 'kofe', 'coffee'], yol: ['M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z', 'M16 9h2a2.5 2.5 0 0 1 0 5h-2', 'M8 3v2M12 3v2'] },
    { kalit: 'market', nom: 'Do\'kon', guruh: 'xarajat', soz: ['do\'kon', 'dokon', 'market', 'bozor', 'xarid', 'savdo'], yol: ['M3 4h3l2.4 11h9.4l2-8H7.5', 'o10,20,1.3', 'o17,20,1.3'] },
    // --- daromad ---
    { kalit: 'ishhaqi', nom: 'Ish haqi', guruh: 'daromad', soz: ['maosh', 'ish', 'oylik', 'salary', 'ish haqi'], yol: ['r3,7,18,13,2', 'M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2', 'M3 13h18'] },
    { kalit: 'qoshimcha', nom: 'Qo\'shimcha daromad', guruh: 'daromad', soz: ['qo\'shimcha', 'qoshimcha', 'bonus', 'mukofot', 'frilans', 'freelance'], yol: ['o12,12,9', 'M12 8v8M8 12h8'] },
    { kalit: 'keshbek', nom: 'Keshbek', guruh: 'daromad', soz: ['keshbek', 'cashback', 'qaytarilgan'], yol: ['M20 12a8 8 0 1 1-2.3-5.7', 'M20 4v4h-4', 'o12,12,2'] },
    { kalit: 'investitsiya', nom: 'Investitsiya', guruh: 'daromad', soz: ['investitsiya', 'dividend', 'aksiya', 'depozit', 'foyda'], yol: ['M3 17l6-6 4 4 8-8', 'M15 7h6v6'] },
    { kalit: 'pensiya', nom: 'Pensiya', guruh: 'daromad', soz: ['pensiya', 'nafaqa', 'stipendiya', 'yordam'], yol: ['M3 12a9 9 0 0 1 18 0z', 'M12 12v6a2 2 0 0 0 4 0'] },
    { kalit: 'ijara', nom: 'Ijara daromadi', guruh: 'daromad', soz: ['ijara', 'rent'], yol: ['o8,15,4', 'M11.5 12.5L20 4', 'M17 7l3 3', 'M14 10l2 2'] },
    // --- umumiy ---
    { kalit: 'boshqa', nom: 'Boshqa', guruh: 'umumiy', soz: ['boshqa', 'other'], yol: ['M5 12h.01M12 12h.01M19 12h.01'] },
    { kalit: 'umumiy', nom: 'Umumiy', guruh: 'umumiy', soz: [], yol: ['M3 12V4h8l10 10-8 8z', 'o7.5,8.5,1'] },
    { kalit: 'almashuv', nom: 'O\'tkazma', guruh: 'tizim', soz: [], yol: ['M7 7h11l-3-3M17 17H6l3 3'] },
    { kalit: 'odam', nom: 'Odam', guruh: 'tizim', soz: [], yol: ['o12,8,4', 'M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7'] },
    // --- hisob ---
    { kalit: 'naqd', nom: 'Naqd pul', guruh: 'hisob', soz: ['naqd', 'cash'], yol: ['r2,6,20,12,2', 'o12,12,3', 'M6 12h.01M18 12h.01'] },
    { kalit: 'karta', nom: 'Karta', guruh: 'hisob', soz: ['karta', 'card', 'uzcard', 'humo', 'visa', 'mastercard'], yol: ['r2,5,20,14,2', 'M2 10h20', 'M6 15h4'] },
    { kalit: 'bank', nom: 'Bank', guruh: 'hisob', soz: ['bank'], yol: ['M3 9l9-6 9 6z', 'M5 9v9M9 9v9M15 9v9M19 9v9', 'M3 21h18'] },
    { kalit: 'hamyon', nom: 'Hamyon', guruh: 'hisob', soz: ['hamyon', 'wallet', 'click', 'payme'], yol: ['M3 7a2 2 0 0 1 2-2h13v4', 'M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z', 'M16 14h.01'] },
    { kalit: 'sejf', nom: 'Omonat', guruh: 'hisob', soz: ['omonat', 'jamg\'arma', 'jamgarma', 'zaxira', 'sejf'], yol: ['r5,11,14,10,2', 'M8 11V8a4 4 0 0 1 8 0v3', 'M12 15v2'] }
  ];

  function topish(kalit) {
    for (var i = 0; i < RO_YXAT.length; i++) if (RO_YXAT[i].kalit === kalit) return RO_YXAT[i];
    return null;
  }
  function bormi(kalit) { return !!topish(kalit); }

  // Nom bo'yicha mos belgi kaliti: nom so'zlarga bo'linadi (harf bo'lmagan belgilar bo'yicha, apostroflar olib tashlanadi);
  // ro'yxat tartibida birinchi mos kelgan (so'z kalit so'zdan boshlansa). Topilmasa "umumiy". Hisob belgilari (guruh "hisob") nomdan ham topiladi.
  function taxmin(nom, guruh) {
    var soz = String(nom == null ? '' : nom).toLowerCase().replace(/[ʻʼ‘’`´']/g, '').split(/[^a-z0-9Ѐ-ӿ]+/).filter(Boolean);
    if (!soz.length) return guruh === 'hisob' ? 'hamyon' : 'umumiy';
    for (var i = 0; i < RO_YXAT.length; i++) {
      var b = RO_YXAT[i];
      if (guruh === 'hisob' ? b.guruh !== 'hisob' : b.guruh === 'hisob') continue;
      if (guruh && guruh !== 'hisob' && b.guruh !== 'umumiy' && b.guruh !== guruh) continue;
      for (var j = 0; j < b.soz.length; j++) {
        var k = b.soz[j].replace(/'/g, '');
        if (soz.some(function (s) { return s.indexOf(k) === 0; })) return b.kalit;
      }
    }
    return guruh === 'hisob' ? 'hamyon' : 'umumiy';
  }

  // Turga mos standart kategoriyalar ro'yxati ("Standart kategoriya" oynasi): { nom, tur, belgi, rang }
  var STANDART = [];
  [
    ['xarajat', [['Oziq-ovqat', 'oziq', '#e57373'], ['Transport', 'transport', '#64b5f6'], ['Kommunal to\'lovlar', 'kommunal', '#ffb74d'], ['Uy-ro\'zg\'or', 'uy', '#a1887f'],
      ['Sog\'liq', 'sogliq', '#81c784'], ['Dori-darmon', 'dori', '#4db6ac'], ['Bolalar', 'bolalar', '#f48fb1'], ['Ta\'lim', 'talim', '#9575cd'], ['Kiyim', 'kiyim', '#f06292'],
      ['Aloqa va internet', 'aloqa', '#4dd0e1'], ['Ko\'ngilochar', 'kongilochar', '#ba68c8'], ['Sovg\'a', 'sovga', '#ff8a65'], ['Sport', 'sport', '#7986cb'], ['Soliq', 'soliq', '#90a4ae'],
      ['Ta\'mirlash', 'tamirlash', '#bcaaa4'], ['Texnika', 'texnika', '#64b5f6'], ['Yoqilg\'i', 'yoqilgi', '#ffd54f'], ['Avtomobil', 'avto', '#ef9a9a'], ['Sayohat', 'sayohat', '#4fc3f7'],
      ['Uy hayvonlari', 'hayvon', '#a5d6a7'], ['Xayriya', 'xayriya', '#aed581'], ['Kredit', 'kredit', '#b0bec5'], ['Komissiya', 'komissiya', '#e0e0e0'], ['Obuna', 'obuna', '#ce93d8'],
      ['Go\'zallik', 'goz', '#f8bbd0'], ['Kafe va restoran', 'kafe', '#ffcc80'], ['Do\'kon', 'market', '#80cbc4'], ['Boshqa', 'boshqa', '#90a4ae']]],
    ['daromad', [['Oylik maosh', 'ishhaqi', '#43a047'], ['Qo\'shimcha daromad', 'qoshimcha', '#26a69a'], ['Sovg\'a', 'sovga', '#ffd54f'], ['Keshbek', 'keshbek', '#66bb6a'],
      ['Investitsiya', 'investitsiya', '#29b6f6'], ['Pensiya', 'pensiya', '#9ccc65'], ['Ijara daromadi', 'ijara', '#ffa726'], ['Boshqa', 'boshqa', '#90a4ae']]]
  ].forEach(function (g) { g[1].forEach(function (x) { STANDART.push({ nom: x[0], tur: g[0], belgi: x[1], rang: x[2] }); }); });

  // SVG chizish (faqat brauzerda). Rang — currentColor. olcham — piksel.
  function chiz(kalit, olcham) {
    var NS = 'http://www.w3.org/2000/svg', b = topish(kalit) || topish('umumiy');
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('width', String(olcham || 20));
    s.setAttribute('height', String(olcham || 20));
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '2');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    b.yol.forEach(function (y) {
      var e, m;
      if ((m = /^o([\d.]+),([\d.]+),([\d.]+)$/.exec(y))) {
        e = document.createElementNS(NS, 'circle');
        e.setAttribute('cx', m[1]); e.setAttribute('cy', m[2]); e.setAttribute('r', m[3]);
      } else if ((m = /^r([\d.]+),([\d.]+),([\d.]+),([\d.]+),([\d.]+)$/.exec(y))) {
        e = document.createElementNS(NS, 'rect');
        e.setAttribute('x', m[1]); e.setAttribute('y', m[2]); e.setAttribute('width', m[3]); e.setAttribute('height', m[4]); e.setAttribute('rx', m[5]);
      } else {
        e = document.createElementNS(NS, 'path');
        e.setAttribute('d', y);
      }
      s.appendChild(e);
    });
    return s;
  }

  global.Belgilar = { royxat: RO_YXAT, standart: STANDART, topish: topish, bormi: bormi, taxmin: taxmin, chiz: chiz };
})(typeof window !== 'undefined' ? window : this);
