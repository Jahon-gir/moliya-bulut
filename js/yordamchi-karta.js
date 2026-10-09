// AI yordamchi: kartochkali javoblar (TZ-sinxronlash.md 25-band). Kartadagi HAMMA raqam ilova hisoblagan natijadan (YordamchiSof.tahlil) olinadi, AI matnidan emas.
// Karta ma'lumotida ismlar va izohlar bo'lishi mumkin: ular faqat ekranda ko'rinadi, serverga ketmaydi (server natijasi alohida).
// Tashqi bog'liqlik: hamyon = { belgi(kat, olcham) -> element, ochish(nom, parametr) } (ui.js beradi).
var YordamchiKarta = (function () {
  'use strict';

  var SOZ_KOP = 5;   // qidiruvda birdaniga ko'rinadigan toza yozuvlar

  function e(teg, matn, klass) { var x = document.createElement(teg); if (matn !== undefined) x.textContent = matn; if (klass) x.className = klass; return x; }
  function tugma(matn, klass, bosilganda) { var b = e('button', matn, klass); b.type = 'button'; b.addEventListener('click', bosilganda); return b; }
  // Raqam elementi: kartadan chiqmaydi (js/sigdir.js): bitta qator, sig'masa kichrayadi, eng kichikda ham sig'masa "10,8 mln"
  function sig(matn, qiymat, klass) {
    var x = e('div', matn, 'sig ' + (klass || ''));
    if (typeof qiymat === 'number') x.setAttribute('data-qiymat', String(Math.round(qiymat)));
    return x;
  }
  function bosh(matn) { return e('div', matn, 'yk-izoh'); }
  function karta(klass) { var k = e('div', undefined, 'yk-karta' + (klass ? ' ' + klass : '')); return k; }
  function ikkiRaqam(n) { return (n < 10 ? '0' : '') + n; }
  function qisqaSana(iso) { var q = String(iso).split('-'); return q[2] + '.' + q[1] + '.' + q[0].slice(2); }
  function foizniBelgila(x, jami) { return jami > 0 ? Math.max(2, Math.min(100, x * 100 / jami)) : 0; }
  var SIDE_RANG = '#7b8498';

  function chiziq(foiz, rang, balandlik) {
    var c = e('div', undefined, 'yk-chiziq'); if (balandlik) c.style.height = balandlik + 'px';
    var i = e('i'); i.style.width = (foiz > 0 ? foiz : 0).toFixed(1) + '%'; i.style.background = rang; c.appendChild(i);
    return c;
  }
  function tugmaQatori(matn, bosilganda) { return tugma(matn, 'yk-tugma', bosilganda); }

  // ---- 1. kategoriyalar ----
  function kategoriyalar(k, h) {
    var c = karta();
    c.appendChild(bosh(bosh_(k.davrNomi) + (k.hisob ? ' · ' + k.hisob : '') + ' · jami ' + (k.tur === 'daromad' ? 'daromad' : 'xarajat')));
    c.appendChild(sig(Calc.sumFormat(k.jami), k.jami, 'yk-katta ' + (k.tur === 'daromad' ? 'yk-plyus' : 'yk-minus')));
    var eng = k.qatorlar.length ? k.qatorlar[0].summa : 0;
    if (!k.qatorlar.length) c.appendChild(e('p', 'Bu davrda yozuv yo\'q.', 'yk-bosh'));
    k.qatorlar.forEach(function (q) {
      var qator = e('div', undefined, 'yk-kat');
      qator.appendChild(h.belgi(q.kat, 28));
      var o = e('div', undefined, 'yk-kat-ich'), ust = e('div', undefined, 'yk-ust');
      ust.appendChild(e('span', q.nom, 'yk-nom'));
      ust.appendChild(sig(Calc.sumFormat(q.summa), q.summa, 'yk-summa'));
      o.appendChild(ust);
      o.appendChild(chiziq(foizniBelgila(q.summa, eng), (q.kat && /^#[0-9a-f]{6}$/i.test(q.kat.rang || '')) ? q.kat.rang : SIDE_RANG, 6));
      qator.appendChild(o);
      c.appendChild(qator);
    });
    c.appendChild(tugmaQatori('Hisobotni ochish', function () { h.ochish('hisobot', { dan: k.davr.dan, gacha: k.davr.gacha, tur: k.tur, hisob_id: k.hisob_id }); }));
    return c;
  }
  function bosh_(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  // ---- 2. qidiruv ----
  function yozuvQatori(q, h) {
    var b = e('button', undefined, 'yk-yozuv'); b.type = 'button';
    b.setAttribute('aria-label', 'Yozuvni tahrirlash: ' + q.izoh);
    b.appendChild(e('span', qisqaSana(q.sana), 'yk-sana'));
    b.appendChild(e('span', q.izoh, 'yk-yozuv-izoh'));
    b.appendChild(sig(Calc.sumFormat(q.summa), q.summa, 'yk-summa'));
    b.addEventListener('click', function () { h.ochish('yozuv', { id: q.id }); });
    return b;
  }
  function qidiruv(k, h) {
    var c = karta();
    var soz = bosh_(k.soz);
    c.appendChild(bosh(soz + ' · ' + k.davrNomi));
    var tur = k.tur === 'daromad' ? 'daromad' : 'xarajat';
    if (!k.toza.length) {
      c.appendChild(e('p', 'Faqat «' + k.soz + '» deb yozilgan yozuv topilmadi', 'yk-katta-matn'));
    } else {
      c.appendChild(e('div', 'Jami: ' + Calc.sumFormat(k.toza_jami) + (k.jami_dona ? ' · ' + k.jami_dona + ' dona' : ' · ' + k.toza.length + ' ta yozuv'), 'yk-jami-qator ' + (tur === 'daromad' ? 'yk-plyus' : 'yk-minus')));
      if (k.jami_dona) c.appendChild(e('div', 'O\'rtacha 1 donasi: ' + Calc.sumFormat(k.ortacha_narx), 'yk-ortacha'));
      var royxat = e('div', undefined, 'yk-yozuvlar');
      k.toza.slice(0, SOZ_KOP).forEach(function (q) { royxat.appendChild(yozuvQatori(q, h)); });
      c.appendChild(royxat);
      if (k.toza.length > SOZ_KOP) {
        var qolgan = e('div', undefined, 'yk-yozuvlar'); qolgan.hidden = true;
        k.toza.slice(SOZ_KOP).forEach(function (q) { qolgan.appendChild(yozuvQatori(q, h)); });
        var yana = tugma('Yana ' + (k.toza.length - SOZ_KOP) + ' ta', 'yk-yana', function () {
          qolgan.hidden = !qolgan.hidden; yana.textContent = qolgan.hidden ? 'Yana ' + (k.toza.length - SOZ_KOP) + ' ta' : 'Yashirish'; yana.setAttribute('aria-expanded', String(!qolgan.hidden));
          if (!qolgan.hidden) Sigdir.hammasi(c);
        });
        yana.setAttribute('aria-expanded', 'false');
        c.appendChild(yana); c.appendChild(qolgan);
      }
    }
    if (k.aralash.length) {   // aralash yozuvlar jamiga qo'shilmaydi: alohida qatorda
      var ar = e('div', undefined, 'yk-yozuvlar'); ar.hidden = true;
      ar.appendChild(e('div', 'Bu yozuvlar jamiga qo\'shilmagan: izohda boshqa so\'zlar ham bor.', 'yk-ogoh'));
      k.aralash.forEach(function (q) { ar.appendChild(yozuvQatori(q, h)); });
      var ab = tugma('Yana ' + k.aralash.length + ' ta aralash yozuv sanalmadi', 'yk-yana yk-aralash', function () {
        ar.hidden = !ar.hidden; ab.setAttribute('aria-expanded', String(!ar.hidden));
        if (!ar.hidden) Sigdir.hammasi(c);
      });
      ab.setAttribute('aria-expanded', 'false');
      c.appendChild(ab); c.appendChild(ar);
    }
    return c;
  }

  // ---- 3. taqqoslash ----
  function taqqoslash(k) {
    var c = karta();
    c.appendChild(bosh('Taqqoslash · ' + (k.tur === 'daromad' ? 'daromad' : 'xarajat') + (k.soz ? ' · ' + bosh_(k.soz) : '')));
    var eng = Math.max(k.davr1.jami, k.davr2.jami);
    [k.davr1, k.davr2].forEach(function (d, i) {
      var b = e('div', undefined, 'yk-davr');
      var ust = e('div', undefined, 'yk-ust');
      ust.appendChild(e('span', bosh_(d.nom), 'yk-nom'));
      ust.appendChild(sig(Calc.sumFormat(d.jami), d.jami, 'yk-summa yk-qalin'));
      b.appendChild(ust);
      b.appendChild(chiziq(d.jami > 0 ? foizniBelgila(d.jami, eng) : 0, i === 0 ? 'var(--yo-savol-matn)' : 'var(--yo-xira)', 10));
      c.appendChild(b);
    });
    var yonalish = k.yonalish;   // davr1 davr2 ga nisbatan
    var matn = yonalish === 'teng' ? 'Farq yo\'q' : Calc.sumFormat(k.farq) + (k.foiz !== null ? ' (' + k.foiz + '%)' : '') + (yonalish === 'oshgan' ? ' ko\'p' : ' kam');
    // xarajat ko'paysa qizil, kamaysa yashil; daromadda aksincha
    var yomon = yonalish === 'teng' ? null : ((yonalish === 'oshgan') === (k.tur !== 'daromad'));
    c.appendChild(e('div', matn, 'yk-tasma ' + (yomon === null ? 'yk-tasma-neytral' : yomon ? 'yk-tasma-qizil' : 'yk-tasma-yashil')));
    return c;
  }

  // ---- 4. qarzlar ----
  function qarzlar(k, h) {
    var c = karta(), tanlangan = k.boshlang;
    var joy = e('div');
    function chiz() {
      joy.textContent = '';
      var t = k[tanlangan];
      var tabs = e('div', undefined, 'yk-tablar'); tabs.setAttribute('role', 'tablist');
      [['berdim', 'Berilgan'], ['oldim', 'Olingan']].forEach(function (x) {
        var b = tugma(x[1], 'yk-tab', function () { tanlangan = x[0]; chiz(); Sigdir.hammasi(c); });
        b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(tanlangan === x[0]));
        tabs.appendChild(b);
      });
      joy.appendChild(tabs);
      joy.appendChild(bosh((tanlangan === 'berdim' ? 'Berilgan' : 'Olingan') + ' qarzlar · ' + t.kishi + ' kishi'));
      joy.appendChild(sig(Calc.sumFormat(t.jami), t.jami, 'yk-katta'));
      if (!t.qatorlar.length) joy.appendChild(e('p', 'Ochiq qarz yo\'q.', 'yk-bosh'));
      t.qatorlar.forEach(function (q) {
        var r = e('div', undefined, 'yk-qarz');
        var ikon = e('span', undefined, 'yk-odam'); ikon.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8zM4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        r.appendChild(ikon);
        var ich = e('div', undefined, 'yk-kat-ich');
        ich.appendChild(e('div', q.shaxs, 'yk-nom'));
        ich.appendChild(e('div', q.muddat ? 'Muddat: ' + Calc.sanaKorsat(q.muddat) : 'Muddat yo\'q', 'yk-kichik' + (q.otgan ? ' yk-minus' : '')));
        r.appendChild(ich);
        r.appendChild(sig(Calc.sumFormat(q.qolgan), q.qolgan, 'yk-summa yk-qalin'));
        joy.appendChild(r);
      });
    }
    chiz();
    c.appendChild(joy);
    c.appendChild(tugmaQatori('Qarzlarni ochish', function () { h.ochish('qarzlar'); }));
    return c;
  }

  // ---- 5. hisoblar ----
  function hisoblar(k, h) {
    var c = karta();
    c.appendChild(bosh('Jami balans · ' + k.qatorlar.length + ' ta hisob'));
    c.appendChild(sig(Calc.sumFormat(k.jami), k.jami, 'yk-katta' + (k.jami < 0 ? ' yk-minus' : '')));
    if (!k.qatorlar.length) c.appendChild(e('p', 'Hisob yo\'q.', 'yk-bosh'));
    k.qatorlar.forEach(function (q) {
      var r = e('div', undefined, 'yk-hisob');
      r.appendChild(e('span', q.nom, 'yk-nom'));
      r.appendChild(sig(Calc.sumFormat(q.qoldiq), q.qoldiq, 'yk-summa yk-qalin' + (q.qoldiq < 0 ? ' yk-minus' : '')));
      c.appendChild(r);
    });
    c.appendChild(tugmaQatori('Hisoblarni ochish', function () { h.ochish('hisoblar'); }));
    return c;
  }

  // ---- 6. oylik_hisobot ----
  function oylik(k, h) {
    var c = karta();
    c.appendChild(bosh(bosh_(k.davrNomi) + (k.hisob ? ' · ' + k.hisob : '') + ' · hisobot'));
    var juft = e('div', undefined, 'yk-juft');
    [['Xarajat', k.xarajat, 'yk-minus'], ['Daromad', k.daromad, 'yk-plyus']].forEach(function (x) {
      var katak = e('div', undefined, 'yk-katak');
      katak.appendChild(e('div', x[0], 'yk-izoh'));
      katak.appendChild(sig(Calc.sumFormat(x[1]), x[1], 'yk-katak-raqam ' + x[2]));
      juft.appendChild(katak);
    });
    c.appendChild(juft);
    var sof = e('div', undefined, 'yk-sof');
    sof.appendChild(e('span', 'Sof balans', 'yk-sof-nom'));
    sof.appendChild(sig(Calc.sumFormat(k.sof), k.sof, 'yk-sof-raqam'));
    c.appendChild(sof);
    c.appendChild(e('div', k.eng ? 'Eng katta xarajat — ' + k.eng.nom + ' · ' + Calc.sumFormat(k.eng.summa) : 'Bu davrda xarajat yo\'q', 'yk-eng'));
    c.appendChild(tugmaQatori('Hisobotni ochish', function () { h.ochish('hisobot', { dan: k.davr.dan, gacha: k.davr.gacha, tur: 'xarajat', hisob_id: k.hisob_id }); }));
    return c;
  }

  // ---- 7. jadval (guruhlangan natija, "Hisoblar" kartasi shaklida) ----
  function raqamMatni(n) { return Calc.sumFormat(n).replace(/ so'm$/, ''); }
  function jadvalQatori(q, soni) {
    var r = e('div', undefined, 'yk-hisob');
    r.appendChild(e('span', q.nom, 'yk-nom'));
    r.appendChild(sig(soni ? q.qiymat + ' ta' : Calc.sumFormat(q.qiymat), soni ? undefined : q.qiymat, 'yk-summa yk-qalin'));
    if (q.foiz !== null && q.foiz !== undefined) r.appendChild(e('span', q.foiz + '%', 'yk-foiz'));
    return r;
  }
  function jadval(k) {
    var c = karta(), soni = k.olchov === 'soni';
    c.appendChild(bosh(k.sarlavha));
    if (k.olchov === 'jami') c.appendChild(sig(Calc.sumFormat(k.umumiy), k.umumiy, 'yk-katta' + (k.tur === 'daromad' ? ' yk-plyus' : k.tur === 'xarajat' ? ' yk-minus' : '')));
    if (!k.qatorlar.length) c.appendChild(e('p', 'Bu davrda yozuv yo\'q.', 'yk-bosh'));
    k.qatorlar.slice(0, SOZ_KOP).forEach(function (q) { c.appendChild(jadvalQatori(q, soni)); });
    if (k.qatorlar.length > SOZ_KOP) {
      var qolgan = e('div'); qolgan.hidden = true;
      k.qatorlar.slice(SOZ_KOP).forEach(function (q) { qolgan.appendChild(jadvalQatori(q, soni)); });
      var yana = tugma('Yana ' + (k.qatorlar.length - SOZ_KOP) + ' ta', 'yk-yana', function () {
        qolgan.hidden = !qolgan.hidden; yana.textContent = qolgan.hidden ? 'Yana ' + (k.qatorlar.length - SOZ_KOP) + ' ta' : 'Yashirish'; yana.setAttribute('aria-expanded', String(!qolgan.hidden));
        if (!qolgan.hidden) Sigdir.hammasi(c);
      });
      yana.setAttribute('aria-expanded', 'false');
      c.appendChild(qolgan); c.appendChild(yana);
    }
    return c;
  }

  // ---- 8. chegara (birinchi va oxirgi yozuv sanasi, jami soni): uch qatorli karta ----
  function chegara(k) {
    var c = karta();
    c.appendChild(bosh(k.sarlavha));
    [['Birinchi yozuv', k.birinchi ? Calc.sanaKorsat(k.birinchi) : '—'], ['Oxirgi yozuv', k.oxirgi ? Calc.sanaKorsat(k.oxirgi) : '—'], ['Jami yozuvlar', k.soni + ' ta']].forEach(function (x) {
      var r = e('div', undefined, 'yk-hisob');
      r.appendChild(e('span', x[0], 'yk-nom')); r.appendChild(e('span', x[1], 'yk-qiymat'));
      c.appendChild(r);
    });
    return c;
  }

  // ---- 9. eng_katta_yozuvlar (qidiruv kartasidagi yozuvlar ro'yxati shaklida; izoh faqat ekranda) ----
  function engKatta(k, h) {
    var c = karta();
    c.appendChild(bosh(k.sarlavha));
    if (!k.qatorlar.length) c.appendChild(e('p', 'Bu davrda yozuv yo\'q.', 'yk-bosh'));
    var royxat = e('div', undefined, 'yk-yozuvlar');
    k.qatorlar.forEach(function (q) {
      var b = e('button', undefined, 'yk-yozuv'); b.type = 'button';
      b.setAttribute('aria-label', 'Yozuvni ochish: ' + q.kategoriya);
      b.appendChild(e('span', qisqaSana(q.sana), 'yk-sana'));
      var o = e('span', undefined, 'yk-yozuv-matn');
      o.appendChild(e('span', q.kategoriya, 'yk-nom yk-nom-bir'));
      if (q.izoh) o.appendChild(e('span', q.izoh, 'yk-kichik yk-bir-qator'));
      b.appendChild(o);
      b.appendChild(sig(Calc.sumFormat(q.summa), q.summa, 'yk-summa yk-qalin'));
      b.addEventListener('click', function () { h.ochish('yozuv', { id: q.id }); });
      royxat.appendChild(b);
    });
    c.appendChild(royxat);
    return c;
  }

  // ---- 10. byudjet: har qator nom, "sarflangan / chegara", 6 px chiziq (oshgan bo'lsa qizil) ----
  function byudjet(k, h) {
    var c = karta();
    c.appendChild(bosh(bosh_(k.oyNomi) + ' · byudjet'));
    if (!k.belgilangan) {
      c.appendChild(e('p', 'Byudjet belgilanmagan', 'yk-katta-matn'));
    } else {
      k.qatorlar.forEach(function (q) {
        var b = e('div', undefined, 'yk-davr');
        var ust = e('div', undefined, 'yk-ust');
        ust.appendChild(e('span', q.nom, 'yk-nom'));
        ust.appendChild(sig(raqamMatni(q.sarflangan) + ' / ' + Calc.sumFormat(q.limit), q.sarflangan, 'yk-summa yk-qalin' + (q.oshib ? ' yk-minus' : '')));
        b.appendChild(ust);
        b.appendChild(chiziq(q.chiziq, q.oshib ? 'var(--oqim-xarajat, #c62828)' : (q.kat && /^#[0-9a-f]{6}$/i.test(q.kat.rang || '') ? q.kat.rang : 'var(--yo-savol-matn)'), 6));
        b.appendChild(e('div', (q.oshib ? 'Oshgan: ' + Calc.sumFormat(q.oshgan) : 'Qolgan: ' + Calc.sumFormat(q.qolgan)) + ' · ' + q.foiz + '%', 'yk-kichik' + (q.oshib ? ' yk-minus' : '')));
        c.appendChild(b);
      });
    }
    c.appendChild(tugmaQatori('Byudjetni ochish', function () { h.ochish('byudjet'); }));
    return c;
  }

  var YASOVCHILAR = { kategoriyalar: kategoriyalar, qidiruv: qidiruv, taqqoslash: taqqoslash, qarzlar: qarzlar, hisoblar: hisoblar, oylik_hisobot: oylik, jadval: jadval, chegara: chegara, eng_katta_yozuvlar: engKatta, byudjet: byudjet };
  // Karta elementi yoki null (bu amal uchun karta yo'q)
  function yasa(k, hamyon) { var f = k && YASOVCHILAR[k.amal]; return f ? f(k, hamyon) : null; }

  return { yasa: yasa, AMALLAR: Object.keys(YASOVCHILAR), SOZ_KOP: SOZ_KOP };
})();
