// Statistika ekrani (TZ-sinxronlash.md 34-band): to'liq ekran, "Ko'proq" bo'limidan ochiladi. Faqat chizadi; hamma raqam js/stat-sof.js
// (va u orqali Calc) dan keladi. SVG o'zimiz chizamiz (tashqi kutubxona yo'q). Faqat grafik tanlovi (tur va davr) qurilmada eslab qolinadi.
// Tashqi bog'liqlik: h = { yozuvlar(), kategoriya(id), belgi(kat, olcham), pul(n), bugun(), qayta() } (ui.js beradi).
var Stat = (function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var OY_NOMLARI = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
  var TUR_NOMI = { ustun: 'Ustun', chiziq: 'Chiziq', maydon: 'Maydon', doira: 'Doira' };
  var TUR_IKONI = { ustun: 'chart-bar', chiziq: 'chart-line', maydon: 'chart-area', doira: 'chart-pie' };
  var DAVR_NOMI = { kun: 'Kun', hafta: 'Hafta', oy: 'Oy', yil: 'Yil' };

  var holat = { sana: '', tur: 'ustun', davr: 'oy', daromad: true, xarajat: true, ulush: 'xarajat', menyuOchiq: false };

  function el(teg, matn, klass) { var e = document.createElement(teg); if (matn !== undefined) e.textContent = matn; if (klass) e.className = klass; return e; }
  function tugma(matn, klass, bosilganda) { var b = el('button', matn, klass); b.type = 'button'; if (bosilganda) b.addEventListener('click', bosilganda); return b; }
  function svg(teg, atr, klass) {
    var e = document.createElementNS(NS, teg);
    Object.keys(atr || {}).forEach(function (k) { e.setAttribute(k, atr[k]); });
    if (klass) e.setAttribute('class', klass);
    return e;
  }
  function xotira() { try { return localStorage; } catch (e) { return null; } }
  function oqi() { try { var x = xotira(); return x ? x.getItem(StatSof.SAQLASH_KALITI) : null; } catch (e) { return null; } }
  function saqla() { try { var x = xotira(); if (x) x.setItem(StatSof.SAQLASH_KALITI, StatSof.grafikTanloviMatni(holat)); } catch (e) { /* xotira ishlamasa ham ekran ishlayveradi */ } }
  function belgi(nom, olcham) { return Ikonlar.chiz(nom, olcham || 20); }
  function oyNomi(oy, bugunSana) { return OY_NOMLARI[parseInt(oy.slice(5, 7), 10) - 1] + (oy.slice(0, 4) !== bugunSana.slice(0, 4) ? ' ' + oy.slice(0, 4) : ''); }

  // Ekran ochilganda: sana — bugun, tur va davr — qurilmada saqlangan (yaroqsiz bo'lsa ustun / oy)
  function boshlash(bugunSana) {
    var t = StatSof.grafikTanlovi(oqi());
    holat.tur = t.tur; holat.davr = t.davr; holat.daromad = t.daromad; holat.xarajat = t.xarajat; holat.ulush = t.ulush; holat.sana = bugunSana; holat.menyuOchiq = false; qimmatRejimi = 'hafta';
  }

  function karta(klass) { return el('div', undefined, 'karta st-karta' + (klass ? ' ' + klass : '')); }
  function sarlavha(matn, ong) {
    var b = el('div', undefined, 'bolim-bosh st-bosh');
    b.appendChild(el('h2', matn));
    if (ong) b.appendChild(ong);
    return b;
  }

  // ---- 1) Oy chiplari (Tarixdagi oy yorliqlari bilan bir xil uslub) ----
  function oyChiplari(h) {
    var bugun = h.bugun(), oylar = StatSof.oyChiplari(h.yozuvlar(), bugun), oy = holat.sana.slice(0, 7);
    var q = el('div', undefined, 'oy-yorliqlar st-oylar'); q.setAttribute('role', 'tablist'); q.setAttribute('aria-label', 'Oy');
    oylar.forEach(function (o) {
      var b = tugma(oyNomi(o, bugun), 'oy-yorliq', function () { holat.sana = StatSof.chipSanasi(o, bugun); h.qayta(); });
      b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(o === oy)); b.setAttribute('data-oy', o);
      q.appendChild(b);
    });
    function korsat() {   // tanlangan chip ko'rinib tursin
      var t = q.querySelector('[aria-selected="true"]');
      if (t && q.isConnected && q.clientWidth) q.scrollLeft = Math.max(0, t.offsetLeft - (q.clientWidth - t.offsetWidth) / 2);
    }
    setTimeout(korsat, 0); setTimeout(korsat, 80);   // ikkinchisi: ekran joylashib bo'lgach
    return q;
  }

  // ---- 2) Daromad va xarajat grafigi ----
  function turTugmasi(h) {
    var quti = el('div', undefined, 'st-tur');
    var t = tugma(undefined, 'st-tur-tugma', null);
    t.id = 'stat-tur'; t.setAttribute('aria-haspopup', 'menu'); t.setAttribute('aria-expanded', String(holat.menyuOchiq));
    t.setAttribute('aria-label', 'Grafik turi: ' + TUR_NOMI[holat.tur]);
    t.appendChild(belgi(TUR_IKONI[holat.tur], 20)); t.appendChild(el('span', TUR_NOMI[holat.tur])); t.appendChild(belgi('chevron-down', 16));
    var menyu = el('div', undefined, 'st-tur-menyu'); menyu.setAttribute('role', 'menu'); menyu.hidden = !holat.menyuOchiq;
    StatSof.TURLAR.forEach(function (x) {
      var b = tugma(undefined, 'st-tur-band', function () { holat.tur = x; holat.menyuOchiq = false; saqla(); h.qayta(); });
      b.setAttribute('role', 'menuitemradio'); b.setAttribute('aria-checked', String(x === holat.tur)); b.setAttribute('data-tur', x);
      b.appendChild(belgi(TUR_IKONI[x], 20)); b.appendChild(el('span', TUR_NOMI[x]));
      menyu.appendChild(b);
    });
    function yop() { holat.menyuOchiq = false; menyu.hidden = true; t.setAttribute('aria-expanded', 'false'); document.removeEventListener('click', tashqari, true); document.removeEventListener('keydown', tugmaBosildi, true); }
    function tashqari(e) { if (!quti.contains(e.target)) yop(); }
    function tugmaBosildi(e) { if (e.key === 'Escape') { e.stopPropagation(); yop(); t.focus(); } }
    t.addEventListener('click', function () {
      if (menyu.hidden) {
        holat.menyuOchiq = true; menyu.hidden = false; t.setAttribute('aria-expanded', 'true');
        document.addEventListener('click', tashqari, true); document.addEventListener('keydown', tugmaBosildi, true);
        var tanlangan = menyu.querySelector('[aria-checked="true"]'); if (tanlangan) tanlangan.focus();
      } else yop();
    });
    quti.appendChild(t); quti.appendChild(menyu);
    if (holat.menyuOchiq) { document.addEventListener('click', tashqari, true); document.addEventListener('keydown', tugmaBosildi, true); }
    return quti;
  }

  function davrTugmalari(h) {
    var doira = holat.tur === 'doira';
    var q = el('div', undefined, 'tanlov st-davr' + (doira ? ' st-xira' : '')); q.setAttribute('role', 'group'); q.setAttribute('aria-label', 'Davr');
    StatSof.DAVRLAR.forEach(function (d) {
      var b = tugma(DAVR_NOMI[d], undefined, function () { holat.davr = d; saqla(); h.qayta(); });
      b.setAttribute('aria-pressed', String(d === holat.davr)); b.setAttribute('data-davr', d);
      if (doira) { b.disabled = true; }
      q.appendChild(b);
    });
    return q;
  }

  function surish(h, davr, n) {
    holat.sana = StatSof.suril(davr, holat.sana, n, h.bugun()); h.qayta();
  }
  function navQatori(h, davr, nom) {
    var bugun = h.bugun(), birinchi = StatSof.birinchiSana(h.yozuvlar());
    var q = el('div', undefined, 'st-nav');
    var o = tugma(undefined, 'st-nav-tugma', function () { surish(h, davr, -1); });
    o.setAttribute('aria-label', 'Oldingi davr'); o.appendChild(belgi('chevron-left', 22)); o.disabled = !StatSof.surishMumkinmi(davr, holat.sana, -1, bugun, birinchi);
    var k = tugma(undefined, 'st-nav-tugma', function () { surish(h, davr, 1); });
    k.setAttribute('aria-label', 'Keyingi davr'); k.appendChild(belgi('chevron-right', 22)); k.disabled = !StatSof.surishMumkinmi(davr, holat.sana, 1, bugun, birinchi);
    var n = el('div', nom, 'st-nav-nom'); n.id = 'stat-davr-nomi'; n.setAttribute('aria-live', 'polite');
    q.appendChild(o); q.appendChild(n); q.appendChild(k);
    return q;
  }

  // Ustun / chiziq / maydon (SVG). Hamma tur bir xil o'q va tarmoqdan foydalanadi; shkala faqat ko'rinib turgan seriyalar bo'yicha (umumiy)
  var W = 300, H = 180, CHAP = 44, ONG = 8, TEPA = 10, PAST = 26;
  var SERIYALAR = [['daromad', 'Daromad', 'd'], ['xarajat', 'Xarajat', 'x']];
  function vaqtDiagrammasi(h, m, tur, oqish) {
    var kor = m.korinadi, korinadigan = SERIYALAR.filter(function (q) { return kor[q[0]]; });
    var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Daromad va xarajat grafigi: ' + m.nom }, 'st-svg');
    var kenglik = W - CHAP - ONG, balandlik = H - TEPA - PAST, tik = Calc.chiroyliTiklar(m.eng, 4), n = m.bucketlar.length, slot = kenglik / n;
    function y(q) { return TEPA + balandlik - (tik.eng > 0 ? q / tik.eng * balandlik : 0); }
    tik.tiklar.forEach(function (q) {
      s.appendChild(svg('line', { x1: CHAP, x2: W - ONG, y1: y(q), y2: y(q) }, 'st-tarmoq'));
      var t = svg('text', { x: CHAP - 5, y: y(q) + 3, 'text-anchor': 'end' }, 'st-yorliq'); t.textContent = q === 0 ? '0' : Calc.qisqaSum(q);
      s.appendChild(t);
    });
    function x(i) { return CHAP + slot * (i + 0.5); }
    function qiymatMatni(b) { return b.toliq + ' — ' + korinadigan.map(function (q) { return q[1] + ' ' + h.pul(b[q[0]]); }).join(' · '); }
    if (tur === 'ustun') {
      var juft = korinadigan.length === 2, keng = juft ? Math.min(11, slot * 0.36) : Math.min(22, slot * 0.62);
      m.bucketlar.forEach(function (b, i) {
        korinadigan.forEach(function (q, k) {
          var bal = Calc.ustunBalandligi(b[q[0]], tik.eng, balandlik, 2), cx = juft ? x(i) + (k === 0 ? -keng / 2 : keng / 2) : x(i);   // juft ustun: daromad chapda, xarajat o'ngda
          s.appendChild(svg('rect', { x: cx - keng / 2, y: TEPA + balandlik - bal, width: keng, height: bal, rx: Math.min(3, keng / 2) }, 'st-ustun-' + q[2]));
        });
      });
    } else {
      korinadigan.forEach(function (q) {
        var nuqtalar = m.bucketlar.map(function (b, i) { return [x(i), y(b[q[0]])]; });
        if (tur === 'maydon') {
          var yo = 'M' + nuqtalar[0][0] + ' ' + (TEPA + balandlik) + nuqtalar.map(function (p) { return ' L' + p[0] + ' ' + p[1]; }).join('') + ' L' + nuqtalar[n - 1][0] + ' ' + (TEPA + balandlik) + ' Z';
          s.appendChild(svg('path', { d: yo }, 'st-maydon st-maydon-' + q[2]));
        }
        s.appendChild(svg('polyline', { points: nuqtalar.map(function (p) { return p[0] + ',' + p[1]; }).join(' ') }, 'st-chiziq st-chiziq-' + q[2]));
        if (tur === 'chiziq' || n <= 12) nuqtalar.forEach(function (p) { s.appendChild(svg('circle', { cx: p[0], cy: p[1], r: 2.6 }, 'st-nuqta st-nuqta-' + q[2])); });
      });
    }
    // bosiladigan (va klaviaturadan fokus oladigan) joylar: qiymat tagida ko'rinadi
    m.bucketlar.forEach(function (b, i) {
      var tg = svg('rect', { x: CHAP + slot * i, y: TEPA, width: slot, height: balandlik, tabindex: 0, role: 'button', 'aria-label': qiymatMatni(b) }, 'st-tegish');
      tg.addEventListener('click', function () { oqish.textContent = qiymatMatni(b); });
      tg.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); oqish.textContent = qiymatMatni(b); } });
      s.appendChild(tg);
      if (b.belgi) {
        var t = svg('text', { x: x(i), y: H - 8, 'text-anchor': 'middle' }, 'st-yorliq'); t.textContent = b.qisqa; s.appendChild(t);
      }
    });
    return s;
  }

  // Doira (halqa): kategoriyalar/manbalar ulushi, tagida legenda (≤ 6 ta, foiz bilan)
  function doira(h, d) {
    var q = el('div', undefined, 'st-doira');
    var s = svg('svg', { viewBox: '0 0 120 120', role: 'img', 'aria-label': (d.ulush === 'daromad' ? 'Daromad ulushi: ' : 'Xarajat ulushi: ') + d.nom }, 'st-doira-svg');
    var elementlar = d.royxat.map(function (x) {
      var k = x.id === 'boshqa' ? null : h.kategoriya(x.id);
      return { id: x.id, nom: x.id === 'boshqa' ? 'Boshqa' : (k ? k.nom : 'Kategoriyasiz'), rang: x.id === 'boshqa' ? Ikonlar.KULRANG : ((k && /^#[0-9a-f]{6}$/i.test(k.rang || '')) ? k.rang : Ikonlar.KULRANG), summa: x.summa, foiz: x.foiz };
    });
    if (elementlar.length === 1) s.appendChild(svg('circle', { cx: 60, cy: 60, r: 40, fill: 'none', stroke: elementlar[0].rang, 'stroke-width': 24 }));
    else {
      Calc.tilimBurchaklari(elementlar.map(function (x) { return { kategoriya_id: x.id, summa: x.summa, foiz: x.foiz }; })).forEach(function (t, i) {
        s.appendChild(svg('path', { d: Calc.yoyYoli(60, 60, 28, 52, t.a0, t.a1), fill: elementlar[i].rang, stroke: 'var(--karta)', 'stroke-width': 1.5 }));
      });
    }
    q.appendChild(s);
    var leg = el('ul', undefined, 'st-legenda');
    elementlar.forEach(function (x) {
      var li = el('li', undefined, 'st-leg-qator'); li.setAttribute('data-id', x.id);
      var nuqta = el('span', undefined, 'st-leg-nuqta'); nuqta.style.background = x.rang; li.appendChild(nuqta);
      li.appendChild(el('span', x.nom, 'st-leg-nom'));
      li.appendChild(el('strong', x.foiz + '%', 'st-leg-foiz'));
      li.setAttribute('title', x.nom + ': ' + h.pul(x.summa));
      leg.appendChild(li);
    });
    q.appendChild(leg);
    return q;
  }

  // Daromad / Xarajat katakchalari (davr jami bilan). Bosilsa seriya grafikdan yashiriladi (xira), qayta bosilsa qaytadi; oxirgisini yashirib bo'lmaydi
  function seriyaKatakchalari(h, jami) {
    var q = el('div', undefined, 'st-seriyalar'); q.setAttribute('role', 'group'); q.setAttribute('aria-label', 'Grafikdagi seriyalar');
    var yagona = !(holat.daromad && holat.xarajat);
    SERIYALAR.forEach(function (c) {
      var kor = holat[c[0]];
      var b = tugma(undefined, 'st-seriya' + (kor ? '' : ' st-seriya-yopiq'), function () {
        var y = StatSof.seriyaniAlmashtir(holat, c[0]);
        if (!y.ozgardi) return;
        holat.daromad = y.daromad; holat.xarajat = y.xarajat; saqla(); h.qayta();
      });
      b.id = 'stat-seriya-' + c[0]; b.setAttribute('data-seriya', c[0]); b.setAttribute('aria-pressed', String(kor));
      if (kor && yagona) b.setAttribute('aria-disabled', 'true');   // oxirgi ko'rinib turgani
      b.setAttribute('aria-label', c[1] + ': ' + h.pul(jami[c[0]]) + (kor ? ', grafikda ko\'rinadi' : ', grafikdan yashirilgan'));
      var ust = el('span', undefined, 'st-seriya-ust');
      var kv = el('span', undefined, 'st-seriya-kv st-seriya-kv-' + c[2]); ust.appendChild(kv); ust.appendChild(el('span', c[1], 'st-seriya-nom'));
      b.appendChild(ust);
      var summa = el('span', h.pul(jami[c[0]]), 'st-seriya-summa'); summa.id = 'stat-jami-' + c[0];
      b.appendChild(summa);
      q.appendChild(b);
    });
    return q;
  }
  // Doira: "Xarajat ulushi" | "Daromad ulushi"
  function ulushAlmashtirgichi(h) {
    var q = el('div', undefined, 'tanlov st-ulush'); q.setAttribute('role', 'group'); q.setAttribute('aria-label', 'Doira turi');
    [['xarajat', 'Xarajat ulushi'], ['daromad', 'Daromad ulushi']].forEach(function (t) {
      var b = tugma(t[1], undefined, function () { holat.ulush = t[0]; saqla(); h.qayta(); });
      b.setAttribute('aria-pressed', String(holat.ulush === t[0])); b.setAttribute('data-ulush', t[0]);
      q.appendChild(b);
    });
    return q;
  }

  function grafikKartasi(h) {
    var k = karta('st-grafik');
    k.appendChild(sarlavha('Daromad va xarajat grafigi', turTugmasi(h)));
    k.appendChild(davrTugmalari(h));
    var yozuvlar = h.yozuvlar(), doiramu = holat.tur === 'doira', davr = doiramu ? 'oy' : holat.davr;
    var d = doiramu ? StatSof.doiraMalumoti(yozuvlar, holat.sana, holat.ulush) : StatSof.grafikMalumoti(yozuvlar, davr, holat.sana, holat);
    k.appendChild(navQatori(h, davr, d.nom));
    if (doiramu) {
      k.appendChild(ulushAlmashtirgichi(h));
      var j = el('div', undefined, 'st-jami'); j.id = 'stat-jami';
      j.appendChild(document.createTextNode('Jami: ')); j.appendChild(el('strong', h.pul(d.jami)));
      k.appendChild(j);
    } else k.appendChild(seriyaKatakchalari(h, d.jami));
    if (d.bosh) { var b = el('p', 'Bu davrda yozuv yo\'q.', 'xira st-bosh-matn'); b.id = 'stat-bosh'; k.appendChild(b); }
    else if (doiramu) k.appendChild(doira(h, d));
    else {
      var oqish = el('div', 'Ustunni bosing: qiymati shu yerda ko\'rinadi', 'xira st-oqish'); oqish.id = 'stat-oqish'; oqish.setAttribute('aria-live', 'polite');
      k.appendChild(vaqtDiagrammasi(h, d, holat.tur, oqish));
      k.appendChild(oqish);
    }
    if (!doiramu && davr === 'kun') k.appendChild(el('p', 'Vaqti yozilmagan yozuvlar kunlik grafikka kirmaydi.', 'xira st-izoh'));
    return k;
  }

  // ---- 3) Kunlik o'rtacha xarajat ----
  function foizBelgisi(foiz, yon, klassQosh) {
    var q = el('div', undefined, 'st-foiz st-' + yon + (klassQosh ? ' ' + klassQosh : ''));
    if (yon === 'yuqori') q.appendChild(belgi('arrow-up', 14));
    else if (yon === 'past') q.appendChild(belgi('arrow-down', 14));
    q.appendChild(el('span', StatSof.foizMatni(foiz)));
    return q;
  }
  function ortachaKartasi(h) {
    var o = StatSof.kunlikOrtacha(h.yozuvlar(), holat.sana.slice(0, 7), h.bugun());
    var k = karta('st-ortacha');
    var ong = el('div', undefined, 'st-katta-quti');
    var katta = el('span', h.pul(o.ortacha).replace(' so\'m', ''), 'st-katta sig'); katta.id = 'stat-ortacha-katta'; katta.setAttribute('data-qiymat', String(o.ortacha));
    ong.appendChild(katta); ong.appendChild(el('span', 'so\'m', 'xira'));
    k.appendChild(sarlavha('Kunlik o\'rtacha xarajat', ong));
    var q = el('div', undefined, 'st-kataklar');
    o.kataklar.forEach(function (c) {
      var x = el('div', undefined, 'st-katak'); x.setAttribute('data-katak', c.kalit);
      x.appendChild(foizBelgisi(c.foiz, c.yon));
      var s = el('div', h.pul(c.qiymat).replace(' so\'m', ''), 'st-katak-summa sig'); s.setAttribute('data-qiymat', String(c.qiymat));
      x.appendChild(s);
      x.appendChild(el('div', c.nom, 'st-katak-nom'));
      q.appendChild(x);
    });
    k.appendChild(q);
    return k;
  }

  // ---- 4) Eng qimmat kun ----
  var qimmatRejimi = 'hafta';   // 'hafta' | 'oy' (ekran ochilganda "Hafta kuni")
  function qimmatKartasi(h) {
    var m = StatSof.engQimmatKun(h.yozuvlar(), holat.sana.slice(0, 7), h.bugun());
    var k = karta('st-qimmat');
    var hafta = qimmatRejimi === 'hafta';
    var ong = m.bor ? el('span', hafta ? m.hafta[m.engHafta].toliq : m.engOy + '-kun', 'st-qizil st-qimmat-nom') : null;
    k.appendChild(sarlavha('Eng qimmat kun', ong));
    var tanlov = el('div', undefined, 'tanlov st-almashtirgich'); tanlov.setAttribute('role', 'group'); tanlov.setAttribute('aria-label', 'Eng qimmat kun turi');
    [['hafta', 'Hafta kuni'], ['oy', 'Oy kuni']].forEach(function (t) {
      var b = tugma(t[1], undefined, function () { qimmatRejimi = t[0]; h.qayta(); });
      b.setAttribute('aria-pressed', String(qimmatRejimi === t[0])); b.setAttribute('data-rejim', t[0]);
      tanlov.appendChild(b);
    });
    k.appendChild(tanlov);
    if (!m.bor) { var yo = el('p', 'Hali yetarli ma\'lumot yo\'q.', 'xira st-bosh-matn'); yo.id = 'stat-qimmat-bosh'; k.appendChild(yo); return k; }
    var royxat = hafta ? m.hafta.map(function (x) { return { qisqa: x.qisqa, ortacha: x.ortacha, toliq: x.toliq }; })
      : m.oy.map(function (x) { return { qisqa: String(x.kun), ortacha: x.ortacha, toliq: x.kun + '-kun' }; });
    var eng = royxat.reduce(function (a, x) { return Math.max(a, x.ortacha); }, 0), engIdx = hafta ? m.engHafta : m.engOy - 1;
    var s = svg('svg', { viewBox: '0 0 ' + W + ' 130', role: 'img', 'aria-label': 'Eng qimmat kun: ' + (hafta ? m.hafta[m.engHafta].toliq : m.engOy + '-kun') }, 'st-svg st-svg-qimmat');
    var kenglik = W - 2 * ONG, balandlik = 100, slot = kenglik / royxat.length, kengUstun = Math.min(26, slot * 0.62);
    s.appendChild(svg('line', { x1: ONG, x2: W - ONG, y1: 108, y2: 108 }, 'st-tarmoq'));
    royxat.forEach(function (x, i) {
      var bal = Calc.ustunBalandligi(x.ortacha, eng, balandlik - 6, 2), cx = ONG + slot * (i + 0.5);
      var r = svg('rect', { x: cx - kengUstun / 2, y: 108 - bal, width: kengUstun, height: bal, rx: Math.min(3, kengUstun / 2), 'data-i': i }, i === engIdx && eng > 0 ? 'st-ustun st-ustun-eng' : 'st-ustun');
      var t = svg('title'); t.textContent = x.toliq + ': ' + h.pul(x.ortacha); r.appendChild(t);
      s.appendChild(r);
      if (hafta || i % 3 === 0) {
        var l = svg('text', { x: cx, y: 123, 'text-anchor': 'middle' }, 'st-yorliq'); l.textContent = x.qisqa; s.appendChild(l);
      }
    });
    k.appendChild(s);
    var izoh = hafta
      ? m.hafta[m.engHafta].toliq + ' kuni o\'rtacha ' + h.pul(m.hafta[m.engHafta].ortacha) + ' sarflaysiz (oxirgi 3 oy).'
      : 'Oyning ' + m.engOy + '-kuni eng qimmat: o\'rtacha ' + h.pul(m.oy[m.engOy - 1].ortacha) + ' (oxirgi 3 oy).';
    var p = el('p', izoh, 'xira st-izoh'); p.id = 'stat-qimmat-izoh';
    k.appendChild(p);
    return k;
  }

  // ---- 5) Kategoriyalar o'tgan oyga nisbatan ----
  function farqKartasi(h) {
    var royxat = StatSof.kategoriyaFarqi(h.yozuvlar(), holat.sana.slice(0, 7), 5);
    var k = karta('st-farq');
    k.appendChild(sarlavha('Kategoriyalar o\'tgan oyga nisbatan'));
    if (!royxat.length) { k.appendChild(el('p', 'Bu oyda xarajat yo\'q.', 'xira st-bosh-matn')); return k; }
    royxat.forEach(function (x) {
      var kat = h.kategoriya(x.id), q = el('div', undefined, 'st-farq-qator'); q.setAttribute('data-id', x.id);
      q.appendChild(h.belgi(kat, 28));
      var chap = el('div', undefined, 'st-farq-chap');
      chap.appendChild(el('div', kat ? kat.nom : 'Kategoriyasiz', 'st-farq-nom'));
      chap.appendChild(el('div', h.pul(x.summa), 'xira st-farq-summa'));
      q.appendChild(chap);
      var ong = el('div', undefined, 'st-farq-ong');
      var yon = x.yon === 'yangi' ? 'yuqori' : x.yon;
      var f = el('div', undefined, 'st-foiz st-' + yon);
      if (yon === 'yuqori') f.appendChild(belgi('arrow-up', 14)); else if (yon === 'past') f.appendChild(belgi('arrow-down', 14));
      f.appendChild(el('span', x.yon === 'yangi' ? 'yangi' : StatSof.foizMatni(x.foiz)));
      ong.appendChild(f);
      ong.appendChild(el('div', h.yashirin && h.yashirin() ? '••••' : StatSof.belgiliRaqam(x.farq), 'xira st-farq-farq'));
      q.appendChild(ong);
      k.appendChild(q);
    });
    return k;
  }

  function bloklar(h) {
    return [oyChiplari(h), grafikKartasi(h), ortachaKartasi(h), qimmatKartasi(h), farqKartasi(h)];
  }

  return { boshlash: boshlash, bloklar: bloklar, holat: function () { return holat; } };
})();
