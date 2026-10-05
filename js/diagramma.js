// Diagrammalar (SVG, tashqi kutubxonasiz): xarajatlarning kategoriyalar bo'yicha doirasi, vaqt bo'yicha ustunli diagramma
// va byudjetning to'lish chizig'i.
// Barcha raqamlar Calc dan olinadi (hisobotdagi bilan bir xil); bu fayl faqat chizadi va bosishlarni qabul qiladi.
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  function el(teg, matn, klass) {
    var e = document.createElement(teg);
    if (matn !== undefined) e.textContent = matn;
    if (klass) e.className = klass;
    return e;
  }
  function svg(teg, atr, klass) {
    var e = document.createElementNS(NS, teg);
    Object.keys(atr || {}).forEach(function (k) { e.setAttribute(k, atr[k]); });
    if (klass) e.setAttribute('class', klass);
    return e;
  }
  function sum(n) { return Calc.sumFormat(n); }

  // ---- Tooltip (hover va klaviatura fokusida bir xil). Matnlar faqat textContent bilan qo'yiladi ----
  var maslahat = null;
  function maslahatOl() {
    if (!maslahat) {
      maslahat = el('div', undefined, 'g-maslahat');
      maslahat.setAttribute('role', 'tooltip');
      maslahat.hidden = true;
      document.body.appendChild(maslahat);
    }
    return maslahat;
  }
  // qatorlar: [{ rang, qiymat, nom }] — qiymat birinchi (qalin), nom ikkinchi; rang — qisqa chiziq
  function maslahatKorsat(sarlavha, qatorlar, x, y) {
    var m = maslahatOl();
    m.textContent = '';
    m.appendChild(el('div', sarlavha, 'g-m-sarlavha'));
    qatorlar.forEach(function (q) {
      var r = el('div', undefined, 'g-m-qator');
      var k = el('span', undefined, 'g-m-kalit');
      k.style.background = q.rang;
      r.appendChild(k);
      r.appendChild(el('strong', q.qiymat));
      r.appendChild(el('span', q.nom, 'g-m-nom'));
      m.appendChild(r);
    });
    m.hidden = false;
    var w = m.offsetWidth, h = m.offsetHeight;
    var chap = Math.max(8, Math.min(x + 14, window.innerWidth - w - 8));
    var tepa = y - h - 14 >= 8 ? y - h - 14 : y + 18;
    m.style.left = chap + 'px';
    m.style.top = tepa + 'px';
  }
  function maslahatYashir() { if (maslahat) maslahat.hidden = true; }
  function elementMarkazi(e) {
    var b = e.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  }

  // Doira yonidagi chap/o'ng tugmalar (masalan oldingi/keyingi oy): [chap, ong], har biri { belgi, ariya, bosilganda, ochiq }.
  // Tugmalar kamida 44 px; ochiq false bo'lsa o'chiq. markaz — doira (yoki doira o'rnidagi matn) elementi.
  function donaQatori(markaz, yon) {
    var q = el('div', undefined, 'dona-qatori');
    function tugma(t, klass) {
      var b = el('button', t.belgi, 'yon-tugma ' + klass);
      b.type = 'button';
      b.setAttribute('aria-label', t.ariya);
      b.disabled = !t.ochiq;
      b.addEventListener('click', t.bosilganda);
      return b;
    }
    q.appendChild(tugma(yon[0], 'yon-chap'));
    q.appendChild(markaz);
    q.appendChild(tugma(yon[1], 'yon-ong'));
    return q;
  }

  // ======================================================================
  // Doira (donut): xarajatlarning kategoriyalar bo'yicha taqsimoti
  // opts: { taqsimot: [{ kategoriya_id, summa, foiz }] (kattasidan kichigiga), jami,
  //         kategoriya: function (id) -> { nom, rang } | undefined,
  //         bosilganda: function (id), guruhBosilganda: function (idlar) }
  // Eng katta 6 ta kategoriya alohida tilim, qolganlari bitta "Boshqalar" tilimida (Calc.donaGuruhlash). Ro'yxatda esa hamma kategoriya
  // to'liq turadi ("Boshqalar" guruhi sarlavhasi ostida). Tilim rangi — kategoriyaning o'z rangi (4-bosqichdagi bilan bir xil).
  // ======================================================================
  function dona(opts) {
    function sum(n) { return opts.yashirin ? '••••' : Calc.sumFormat(n); }   // summalar yashirilgan bo'lsa ••••
    var quti = el('div', undefined, 'dona-quti');
    var guruh = Calc.donaGuruhlash(opts.taqsimot);
    var tilimlar = Calc.tilimBurchaklari(guruh.tilimlar);
    var BOSHQALAR = 'boshqalar';
    function malumot(id) {
      if (id === BOSHQALAR) return { nom: 'Boshqalar', rang: null, belgi: 'boshqa' };
      var k = opts.kategoriya(id);
      return { nom: k ? k.nom : 'Kategoriyasiz', rang: k ? k.rang : '#90a4ae', belgi: k ? k.belgi || Calc.belgiTaxmin(k.nom, k.tur) : 'umumiy' };
    }
    function nomi(t) {
      return t.kategoriya_id === BOSHQALAR ? 'Boshqalar (' + guruh.boshqalar.soni + ' ta kategoriya)' : malumot(t.kategoriya_id).nom;
    }
    function matn(t) { return nomi(t) + ': ' + sum(t.summa) + ', ' + t.foiz + ' foiz'; }
    function ochish(id) {
      if (id === BOSHQALAR) opts.guruhBosilganda(guruh.boshqalar.idlar); else opts.bosilganda(id);
    }
    var guruhIdlari = {};   // "Boshqalar" ga kirgan kategoriya -> tilim kaliti
    guruh.dum.forEach(function (x) { guruhIdlari[x.kategoriya_id] = BOSHQALAR; });

    var CX = 120, CY = 120, R2 = 108, R1 = 88, ORTA = (R1 + R2) / 2, FARQ = 2 / ORTA;   // ingichka halqa (qalinligi 20); tilimlar orasida 2 px bo'shliq
    var MIN_BURCHAK = 0.034;   // juda kichik tilim ham ko'rinsin (taxminan 3 px): faqat chizishda, hisob-kitobga ta'sir qilmaydi
    var s = svg('svg', { viewBox: '0 0 240 240', role: 'group', 'aria-label':
      (opts.turNomi || 'Xarajatlar') + ' kategoriyalar bo\'yicha doira diagrammasi' + (opts.markazNom ? ', ' + opts.markazNom : '') + '. Jami ' + sum(opts.jami) + ', ' + opts.taqsimot.length + ' ta kategoriya' +
      (guruh.boshqalar ? ', eng kattasi ' + Calc.DONA_ENG_KATTA + ' tasi alohida, qolgan ' + guruh.boshqalar.soni + ' tasi "Boshqalar" tilimida.' : '.') }, 'dona-svg');
    var tilimElementlari = {};

    tilimlar.forEach(function (t) {
      var m = malumot(t.kategoriya_id), e;
      if (tilimlar.length === 1) {   // bitta kategoriya: to'liq halqa
        e = svg('circle', { cx: CX, cy: CY, r: ORTA, fill: 'none', 'stroke-width': R2 - R1, stroke: m.rang });
      } else {
        var a0 = t.a0, a1 = t.a1;
        if (a1 - a0 < MIN_BURCHAK) { var orta = (a0 + a1) / 2; a0 = orta - MIN_BURCHAK / 2; a1 = orta + MIN_BURCHAK / 2; }
        var kirish = Math.min(FARQ / 2, (a1 - a0) * 0.2);
        e = svg('path', { d: Calc.yoyYoli(CX, CY, R1, R2, a0 + kirish, a1 - kirish) });
        if (m.rang) e.setAttribute('fill', m.rang);
      }
      e.setAttribute('class', 'dona-tilim' + (t.kategoriya_id === BOSHQALAR ? ' dona-boshqalar' : ''));
      e.setAttribute('role', 'img');
      e.setAttribute('aria-label', matn(t) + '. Yozuvlarni ochish uchun bosing');
      e.setAttribute('data-kategoriya', t.kategoriya_id);
      e.setAttribute('data-summa', t.summa);
      e.setAttribute('data-foiz', t.foiz);
      if (t.kategoriya_id === BOSHQALAR) e.setAttribute('data-soni', guruh.boshqalar.soni);
      tilimElementlari[t.kategoriya_id] = e;
      s.appendChild(e);
    });

    // Markaz: jami yoki ko'rsatilayotgan tilim
    var markaz1 = svg('text', { x: CX, y: CY - 6, 'text-anchor': 'middle', 'aria-hidden': 'true' }, 'dona-markaz-1');
    var markaz2 = svg('text', { x: CX, y: CY + 16, 'text-anchor': 'middle', 'aria-hidden': 'true' }, 'dona-markaz-2');
    s.appendChild(markaz1);
    s.appendChild(markaz2);
    // Markazda 1-2 qator kichik matn (davr nomi yoki tilim nomi) va katta summa
    function markazYoz(satrlar, qiymat) {
      var uzun = Math.max.apply(null, satrlar.map(function (x) { return x.length; }));
      markaz1.textContent = '';
      markaz1.setAttribute('y', satrlar.length > 1 ? CY - 19 : CY - 6);
      satrlar.forEach(function (x, i) {
        var ts = svg('tspan', { x: CX, dy: i ? 13 : 0 });
        ts.textContent = x.length > 20 ? x.slice(0, 19) + '…' : x;
        markaz1.appendChild(ts);
      });
      markaz1.setAttribute('class', 'dona-markaz-1' + (uzun > 14 ? ' kichik' : ''));
      markaz2.setAttribute('y', satrlar.length > 1 ? CY + 21 : CY + 16);
      markaz2.textContent = qiymat;
      markaz2.setAttribute('class', 'dona-markaz-2' + (qiymat.length > 12 ? ' kichik' : ''));
    }
    // Davr nomi ikki qismdan iborat bo'lsa ("01.10.2026 – 07.10.2026"), ikki qatorga bo'linadi
    function davrSatrlari(nom) {
      var q = nom.split(' – ');
      return q.length === 2 ? [q[0] + ' –', q[1]] : [nom];
    }
    function jamiKorsat() {
      var t = sum(opts.jami);
      markazYoz(opts.markazNom ? davrSatrlari(opts.markazNom) : ['Jami xarajat'], t.length > 14 ? Calc.qisqaSum(opts.jami) + ' so\'m' : t);
    }
    jamiKorsat();

    var qatorlar = {};   // ro'yxat qatorlari (kategoriya yoki "boshqalar" guruhi sarlavhasi)
    function vurgula(kalit, x, y) {
      quti.classList.add('faol');
      Object.keys(tilimElementlari).forEach(function (k) { tilimElementlari[k].classList.toggle('vurgulangan', k === kalit); });
      Object.keys(qatorlar).forEach(function (k) {
        qatorlar[k].classList.toggle('vurgulangan', k === kalit || guruhIdlari[k] === kalit);
      });
      var t = tilimlar.filter(function (z) { return z.kategoriya_id === kalit; })[0], m = malumot(kalit);
      markazYoz([nomi(t)], sum(t.summa));
      if (x !== undefined) maslahatKorsat(nomi(t), [{ rang: m.rang || 'var(--g-boshqa)', qiymat: sum(t.summa), nom: t.foiz + '%' }], x, y);
    }
    function vurgulashniOlish() {
      quti.classList.remove('faol');
      Object.keys(tilimElementlari).forEach(function (k) { tilimElementlari[k].classList.remove('vurgulangan'); });
      Object.keys(qatorlar).forEach(function (k) { qatorlar[k].classList.remove('vurgulangan'); });
      jamiKorsat();
      maslahatYashir();
    }
    tilimlar.forEach(function (t) {
      var e = tilimElementlari[t.kategoriya_id];
      e.addEventListener('pointerenter', function (ev) { vurgula(t.kategoriya_id, ev.clientX, ev.clientY); });
      e.addEventListener('pointermove', function (ev) { vurgula(t.kategoriya_id, ev.clientX, ev.clientY); });
      e.addEventListener('pointerleave', vurgulashniOlish);
      e.addEventListener('click', function () { vurgulashniOlish(); ochish(t.kategoriya_id); });
    });
    var rasm = el('div', undefined, 'dona-rasm');
    rasm.appendChild(s);
    if (opts.yonTugmalari) quti.appendChild(donaQatori(rasm, opts.yonTugmalari)); else quti.appendChild(rasm);

    // Ro'yxat: HAMMA kategoriya (rangi, nomi, summasi, foizi). "Boshqalar" tilimiga kirganlar guruh sarlavhasi ostida.
    // Bu — diagrammaning matnli (jadval) nusxasi
    var royxat = el('ul', undefined, 'dona-royxat');
    function qator(kalit, nom, rangi, summa, foiz, ariya, bosilganda, qoshimcha, belgiKaliti) {
      var li = el('li', undefined, qoshimcha || '');
      var b = el('button', undefined, 'dona-qator');
      b.type = 'button';
      b.setAttribute('aria-label', ariya + '. Yozuvlarni ochish');
      b.setAttribute('data-kategoriya', kalit);
      b.setAttribute('data-summa', summa);
      b.setAttribute('data-foiz', foiz);
      var kalitEl = el('span', undefined, 'dona-kalit dona-belgi' + (rangi ? '' : ' dona-boshqalar-kalit'));
      if (rangi) { kalitEl.style.background = rangi; kalitEl.style.color = Calc.matnRangi(rangi); }
      kalitEl.appendChild(global.Belgilar.chiz(belgiKaliti || 'umumiy', 14));
      b.appendChild(kalitEl);
      b.appendChild(el('span', nom, 'dona-nom'));
      b.appendChild(el('span', sum(summa) + ' · ' + foiz + '%', 'dona-qiymat'));
      var tilimKaliti = guruhIdlari[kalit] || kalit;
      b.addEventListener('pointerenter', function () { vurgula(tilimKaliti); });
      b.addEventListener('pointerleave', vurgulashniOlish);
      b.addEventListener('focus', function () { vurgula(tilimKaliti); });
      b.addEventListener('blur', vurgulashniOlish);
      b.addEventListener('click', function () { vurgulashniOlish(); bosilganda(); });
      qatorlar[kalit] = b;
      li.appendChild(b);
      royxat.appendChild(li);
    }
    function kategoriyaQatori(x, ichki) {
      var m = malumot(x.kategoriya_id);
      qator(x.kategoriya_id, m.nom, m.rang, x.summa, x.foiz, matn({ kategoriya_id: x.kategoriya_id, summa: x.summa, foiz: x.foiz }),
        function () { opts.bosilganda(x.kategoriya_id); }, ichki ? 'dona-ichki' : '', m.belgi);
    }
    var boshQism = guruh.boshqalar ? opts.taqsimot.slice(0, Calc.DONA_ENG_KATTA) : opts.taqsimot;
    boshQism.forEach(function (x) { kategoriyaQatori(x, false); });
    if (guruh.boshqalar) {
      var g = guruh.boshqalar;
      qator(BOSHQALAR, 'Boshqalar (' + g.soni + ' ta kategoriya)', null, g.summa, g.foiz, matn(g), function () { opts.guruhBosilganda(g.idlar); }, 'dona-guruh', 'boshqa');
      guruh.dum.forEach(function (x) { kategoriyaQatori(x, true); });
    }
    quti.appendChild(royxat);
    return quti;
  }

  // ======================================================================
  // Byudjet ko'rsatkichi (to'lish chizig'i): sarflangan / chegara.
  // holat: Calc.byudjetHolati() natijasi. Rang holatga qarab: me'yorda — asosiy rang, 80% dan oshsa — sariq,
  // 100% dan oshsa — qizil. Rang bir o'zi emas: belgi (✓ ⚠ ✕) va matn ham bor.
  // ======================================================================
  var DARAJA_MATNI = { yaxshi: ['✓', 'Me\'yorda'], sariq: ['⚠', 'Chegaraga yaqin'], qizil: ['✕', 'Chegaradan oshdi'] };
  function byudjetChizigi(holat, nom, yashirin) {
    function sum(n) { return yashirin ? '••••' : Calc.sumFormat(n); }
    var quti = el('div', undefined, 'byudjet-quti');
    quti.setAttribute('data-daraja', holat.daraja);
    quti.setAttribute('data-foiz', holat.foiz);
    var d = DARAJA_MATNI[holat.daraja];
    var chiziq = el('div', undefined, 'byudjet-chiziq');
    chiziq.setAttribute('role', 'progressbar');
    chiziq.setAttribute('aria-valuemin', '0');
    chiziq.setAttribute('aria-valuemax', '100');
    chiziq.setAttribute('aria-valuenow', String(Math.min(100, holat.foiz)));
    chiziq.setAttribute('aria-label', nom + ': ' + sum(holat.sarflangan) + ' sarflandi, chegara ' + sum(holat.limit) + ', ' + holat.foiz + ' foiz, ' +
      d[1] + (holat.oshgan ? ', oshgan summa ' + sum(holat.oshgan) : ', qolgan ' + sum(holat.qolgan)));
    var tolgan = el('span', undefined, 'byudjet-tolgan');
    tolgan.style.width = holat.chiziq + '%';
    chiziq.appendChild(tolgan);
    quti.appendChild(chiziq);
    var holatQatori = el('div', undefined, 'byudjet-holat');
    holatQatori.appendChild(el('span', d[0], 'byudjet-belgi'));
    holatQatori.appendChild(el('span', holat.foiz + '% · ' + d[1]));
    quti.appendChild(holatQatori);
    var raqamlar = el('div', undefined, 'byudjet-raqamlar');
    raqamlar.appendChild(el('span', 'Sarflangan: ' + sum(holat.sarflangan)));
    raqamlar.appendChild(el('span', 'Chegara: ' + sum(holat.limit)));
    quti.appendChild(raqamlar);
    var qoldiq = el('div', holat.oshgan ? 'Oshgan: ' + sum(holat.oshgan) : 'Qolgan: ' + sum(holat.qolgan), 'byudjet-qoldiq' + (holat.oshgan ? ' oshgan' : ''));
    quti.appendChild(qoldiq);
    return quti;
  }

  // ======================================================================
  // Ustunli diagramma: hafta va oyda kunlar bo'yicha, yilda oylar bo'yicha. Har joyda daromad va xarajat yonma-yon.
  // opts: { vaqt: Calc.diagrammaVaqt(...) natijasi, bosilganda: function (bucket) }
  // ======================================================================
  function ustunli(opts) {
    var v = opts.vaqt, n = v.bucketlar.length;
    var quti = el('div', undefined, 'ustun-quti');
    if (!(v.eng > 0)) {
      quti.appendChild(el('p', 'Bu davrda daromad va xarajat yo\'q.', 'xira'));
      return quti;
    }

    // Legenda (ikki qator uchun doim ko'rinadi): rangli kalit + matn
    var legenda = el('ul', undefined, 'g-legenda');
    [['g-d', 'Daromad'], ['g-x', 'Xarajat']].forEach(function (x) {
      var li = el('li');
      li.appendChild(el('span', undefined, 'g-kalit ' + x[0]));
      li.appendChild(el('span', x[1]));
      legenda.appendChild(li);
    });
    quti.appendChild(legenda);

    var chizma = el('div', undefined, 'ustun-chizma');
    quti.appendChild(chizma);
    var sr = el('div', undefined, 'sr-faqat');   // klaviatura bilan yurganda joriy ustun matnini e'lon qiladi
    sr.setAttribute('role', 'status');
    sr.setAttribute('aria-live', 'polite');
    quti.appendChild(sr);

    function ustunMatni(b) {
      return b.toliq + ': daromad ' + sum(b.daromad) + ', xarajat ' + sum(b.xarajat);
    }
    var faol = -1, guruhlar = [];

    function chiz(W) {
      chizma.textContent = '';
      guruhlar = [];
      var ikkiQator = v.tur === 'hafta' || (v.tur === 'oraliq' && v.bucketlar.some(function (b) { return b.qisqa2; }));
      var H = ikkiQator ? 250 : 236, yuqori = 14, osti = ikkiQator ? 40 : 26;
      var t = Calc.chiroyliTiklar(v.eng, 4);
      var uzun = Math.max.apply(null, t.tiklar.map(function (x) { return Calc.qisqaSum(x).length; }));
      var x0 = Math.round(uzun * 6.3) + 12, x1 = W - 8, y0 = yuqori, y1 = H - osti, balandlik = y1 - y0;
      var slot = (x1 - x0) / n, bw = Math.max(1.5, Math.min(24, (slot * 0.8 - 2) / 2));
      var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'group', tabindex: '0', 'aria-label':
        'Daromad va xarajat, ' + v.davrNomi + ', ' + (v.birlikNomi || (v.tur === 'yil' ? 'oylar' : 'kunlar')) + ' bo\'yicha. Jami daromad ' + sum(v.jami.daromad) +
        ', jami xarajat ' + sum(v.jami.xarajat) + '. Strelka tugmalari bilan yuring, Enter bilan yozuvlarni oching.' }, 'ustun-svg');

      // Gorizontal chiziqlar va chap o'q (summalar qisqartirilgan)
      t.tiklar.forEach(function (tik) {
        var y = y1 - tik / t.eng * balandlik;
        s.appendChild(svg('line', { x1: x0, x2: x1, y1: y, y2: y }, tik === 0 ? 'g-baza' : 'g-setka'));
        var yozuv = svg('text', { x: x0 - 6, y: y + 3.5, 'text-anchor': 'end', 'aria-hidden': 'true' }, 'g-o-q');
        yozuv.textContent = Calc.qisqaSum(tik);
        s.appendChild(yozuv);
      });

      // Eng katta qiymatga bitta yozuv (tanlab yozish: har ustunga raqam qo'yilmaydi)
      var engJoy = null;
      v.bucketlar.forEach(function (b, i) {
        [['daromad', 0], ['xarajat', 1]].forEach(function (z) {
          if (b[z[0]] === v.eng && !engJoy) engJoy = { i: i, bar: z[1] };
        });
      });

      v.bucketlar.forEach(function (b, i) {
        var g = svg('g', { 'data-kalit': b.kalit, 'data-daromad': b.daromad, 'data-xarajat': b.xarajat, role: 'img',
          'aria-label': ustunMatni(b) + '. Yozuvlarni ochish uchun bosing' }, 'ustun-guruh');
        var gx0 = x0 + i * slot;
        g.appendChild(svg('rect', { x: gx0, y: y0, width: slot, height: balandlik, rx: 3 }, 'g-yoritish'));
        var kenglik = 2 * bw + 2, gx = gx0 + (slot - kenglik) / 2;
        [['daromad', 'g-d', gx], ['xarajat', 'g-x', gx + bw + 2]].forEach(function (z) {
          var h = Calc.ustunBalandligi(b[z[0]], t.eng, balandlik, 2);
          if (!h) return;
          var r = Math.min(4, bw / 2, h), top = y1 - h, x = z[2];   // 4 px yumaloq uch, asosi tekis
          g.appendChild(svg('path', { d: 'M' + x + ' ' + y1 + ' V' + (top + r) + ' Q' + x + ' ' + top + ' ' + (x + r) + ' ' + top +
            ' H' + (x + bw - r) + ' Q' + (x + bw) + ' ' + top + ' ' + (x + bw) + ' ' + (top + r) + ' V' + y1 + ' Z' }, 'ustun-belgi ' + z[1]));
        });
        if (engJoy && engJoy.i === i) {
          var qx = gx + (engJoy.bar ? bw + 2 : 0) + bw / 2, chetda = qx > W - 26;   // o'ng chetdagi yozuv kesilmasin
          var q = svg('text', { x: chetda ? W - 2 : qx, y: y1 - Calc.ustunBalandligi(v.eng, t.eng, balandlik, 2) - 4,
            'text-anchor': chetda ? 'end' : 'middle', 'aria-hidden': 'true' }, 'g-eng');
          q.textContent = Calc.qisqaSum(v.eng);
          g.appendChild(q);
        }
        // Bosish maydoni: butun ustun kengligi va balandligi (mark o'zidan kattaroq)
        var hit = svg('rect', { x: gx0, y: y0, width: slot, height: balandlik + osti * 0.6, fill: 'transparent' }, 'ustun-hit');
        g.appendChild(hit);
        s.appendChild(g);
        guruhlar.push(g);

        function korsat(ev) {
          faollashtir(i);
          var p = ev && ev.clientX !== undefined && ev.type.indexOf('pointer') === 0 ? { x: ev.clientX, y: ev.clientY } : elementMarkazi(g);
          maslahatKorsat(b.toliq, [
            { rang: 'var(--g-1)', qiymat: sum(b.daromad), nom: 'Daromad' },
            { rang: 'var(--g-2)', qiymat: sum(b.xarajat), nom: 'Xarajat' }], p.x, p.y);
        }
        hit.addEventListener('pointerenter', korsat);
        hit.addEventListener('pointermove', korsat);
        hit.addEventListener('pointerleave', function () { faollashtir(-1); maslahatYashir(); });
        hit.addEventListener('click', function () { maslahatYashir(); opts.bosilganda(b); });
      });

      // X o'qi yozuvlari: hafta — kun nomi va sana, oy — kun raqami (har 5-kun), yil — oy nomi
      v.bucketlar.forEach(function (b, i) {
        var korsat = true;
        if (v.tur === 'oraliq') {   // erkin davr: yozuvlar bir-biriga tegmasligi uchun qadam bilan
          korsat = i % Math.max(1, Math.ceil(n / Math.max(1, Math.floor((x1 - x0) / (v.birlik === 'kun' ? 22 : v.birlik === 'hafta' ? 40 : 30))))) === 0;
        } else if (v.tur === 'oy') {
          var kun = i + 1;
          korsat = kun === 1 || kun % 5 === 0 || (i === n - 1 && kun - Math.floor(kun / 5) * 5 >= 3);
        }
        if (!korsat) return;
        var cx = x0 + (i + 0.5) * slot;
        var a = svg('text', { x: cx, y: y1 + 15, 'text-anchor': 'middle', 'aria-hidden': 'true' }, 'g-o-q');
        if (v.tur === 'yil') a.style.fontSize = Math.max(8.5, Math.min(11, slot * 0.44)) + 'px';   // 12 ta oy nomi bir-biriga tegmasin
        a.textContent = b.qisqa;
        s.appendChild(a);
        if (b.qisqa2) {
          var a2 = svg('text', { x: cx, y: y1 + 28, 'text-anchor': 'middle', 'aria-hidden': 'true' }, 'g-o-q kichik');
          a2.textContent = b.qisqa2;
          s.appendChild(a2);
        }
      });

      function faollashtir(i) {
        faol = i;
        guruhlar.forEach(function (g, j) { g.classList.toggle('faol', j === i); });
      }
      // Klaviatura: strelkalar bilan ustunlar orasida yurish, Enter — yozuvlarni ochish
      s.addEventListener('keydown', function (e) {
        var yangi = faol;
        if (e.key === 'ArrowRight') yangi = Math.min(n - 1, faol < 0 ? 0 : faol + 1);
        else if (e.key === 'ArrowLeft') yangi = Math.max(0, faol < 0 ? 0 : faol - 1);
        else if (e.key === 'Home') yangi = 0;
        else if (e.key === 'End') yangi = n - 1;
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (faol >= 0) { maslahatYashir(); opts.bosilganda(v.bucketlar[faol]); } return; }
        else if (e.key === 'Escape') { faollashtir(-1); maslahatYashir(); return; }
        else return;
        e.preventDefault();
        faollashtir(yangi);
        sr.textContent = ustunMatni(v.bucketlar[yangi]);
        var p = elementMarkazi(guruhlar[yangi]), b = v.bucketlar[yangi];
        maslahatKorsat(b.toliq, [
          { rang: 'var(--g-1)', qiymat: sum(b.daromad), nom: 'Daromad' },
          { rang: 'var(--g-2)', qiymat: sum(b.xarajat), nom: 'Xarajat' }], p.x, p.y);
      });
      s.addEventListener('blur', function () { faollashtir(-1); maslahatYashir(); });
      chizma.appendChild(s);
    }

    // Kenglik: kartaning haqiqiy kengligiga moslanadi (joylangach o'lchanadi), o'zgarsa qayta chiziladi
    var joriyKenglik = 0, kuzatuvchi = null;
    function moslash() {
      if (joriyKenglik && !chizma.isConnected) { if (kuzatuvchi) kuzatuvchi.disconnect(); return; }   // ekrandan olib tashlangan
      var w = Math.round(chizma.clientWidth) || 300;
      w = Math.max(240, Math.min(560, w));
      if (w !== joriyKenglik) { joriyKenglik = w; chiz(w); }
    }
    moslash();
    if (global.ResizeObserver) { kuzatuvchi = new global.ResizeObserver(moslash); kuzatuvchi.observe(chizma); }

    // Jadval ko'rinishi: diagrammaning matnli nusxasi (har ustun raqami, yig'indisi bilan)
    var tafsilot = document.createElement('details');
    tafsilot.className = 'g-jadval-quti';
    tafsilot.appendChild(el('summary', 'Jadval ko\'rinishi'));
    var jadval = el('table', undefined, 'g-jadval');
    var sarlavha = el('caption', 'Daromad va xarajat, ' + v.davrNomi);
    jadval.appendChild(sarlavha);
    var bosh = el('tr');
    ['Sana', 'Daromad', 'Xarajat'].forEach(function (x) { var th = el('th', x); th.setAttribute('scope', 'col'); bosh.appendChild(th); });
    var th0 = document.createElement('thead');
    th0.appendChild(bosh);
    jadval.appendChild(th0);
    var tb = document.createElement('tbody');
    v.bucketlar.forEach(function (b) {
      var tr = el('tr');
      tr.setAttribute('data-kalit', b.kalit);
      var td0 = el('th');
      td0.setAttribute('scope', 'row');
      var knopka = el('button', b.toliq, 'g-jadval-tugma');
      knopka.type = 'button';
      knopka.setAttribute('aria-label', ustunMatni(b) + '. Yozuvlarni ochish');
      knopka.addEventListener('click', function () { opts.bosilganda(b); });
      td0.appendChild(knopka);
      tr.appendChild(td0);
      var d = el('td', sum(b.daromad));
      d.setAttribute('data-daromad', b.daromad);
      var x = el('td', sum(b.xarajat));
      x.setAttribute('data-xarajat', b.xarajat);
      tr.appendChild(d);
      tr.appendChild(x);
      tb.appendChild(tr);
    });
    jadval.appendChild(tb);
    var tf = document.createElement('tfoot'), jt = el('tr');
    jt.appendChild(el('th', 'Jami'));
    var jd = el('td', sum(v.jami.daromad)), jx = el('td', sum(v.jami.xarajat));
    jd.setAttribute('data-jami-daromad', v.jami.daromad);
    jx.setAttribute('data-jami-xarajat', v.jami.xarajat);
    jt.appendChild(jd);
    jt.appendChild(jx);
    tf.appendChild(jt);
    jadval.appendChild(tf);
    var o = el('div', undefined, 'g-jadval-orash');
    o.appendChild(jadval);
    tafsilot.appendChild(o);
    quti.appendChild(tafsilot);
    return quti;
  }

  global.Diagramma = { donaQatori: donaQatori, dona: dona, ustunli: ustunli, byudjetChizigi: byudjetChizigi, maslahatYashir: maslahatYashir };
})(typeof window !== 'undefined' ? window : this);
