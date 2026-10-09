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
  // Doira (donut): kategoriyalar bo'yicha taqsimot (0.30.0 dizayni)
  // opts: { taqsimot: [{ kategoriya_id, summa, foiz }] (kattasidan kichigiga), jami,
  //         kategoriya: function (id) -> { nom, rang, belgi } | undefined,
  //         bosilganda: function (id), guruhBosilganda: function (idlar), turNomi, markazNom, yashirin, yonTugmalari }
  // Eng katta 5 ta kategoriya alohida tilim; qolganlari va jami summaning 3% idan kichiklari bitta "Boshqalar" tilimida (Calc.donaGuruhlash).
  // Ro'yxatda "Boshqalar" qatori "N ta, bosib oching" yozuvi bilan turadi: bosilsa ichidagi kategoriyalar shu qator ostida ochiladi, yana bossa yopiladi.
  // Tilim ranglari — yarqin, to'yingan palitra (CSS: --dona-1 … --dona-8), har bo'lak boshqa rang; "Boshqalar" — kulrang.
  // Tilimlar: stroke-dasharray bilan chizilgan aylana yoylari (uchlari tekis: stroke-linecap butt), orasida ≈7 px ochiq joy.
  // ======================================================================
  var DONA_VB = 180, DONA_R = 64, DONA_QALINLIK = 22, DONA_BOSHLIQ = 7, DONA_RANGLAR = 8;
  function donaRangi(indeks) { return 'var(--dona-' + (indeks % DONA_RANGLAR + 1) + ')'; }

  // Ikon katagi (40 px yumaloq-kvadrat, fon — rangning ≈15% tusi): ui.js dagi belgiKatak bilan bir xil ko'rinish
  function belgiKatagi(kalit, rang, olcham) {
    var d = el('span', undefined, 'belgi-katak');
    d.style.width = d.style.height = olcham + 'px';
    d.style.setProperty('--r', rang);
    d.style.setProperty('--r-tus', 'color-mix(in srgb, ' + rang + ' 15%, transparent)');
    d.appendChild(global.Belgilar.chiz(kalit, Math.round(olcham * 0.58)));
    return d;
  }

  function dona(opts) {
    function sum(n) { return opts.yashirin ? '••••' : Calc.sumFormat(n); }   // summalar yashirilgan bo'lsa ••••
    function qisqa(n) { return opts.yashirin ? '••••' : Calc.qisqaSum(n); }
    var quti = el('div', undefined, 'dona-quti');
    var guruh = Calc.donaGuruhlash(opts.taqsimot);
    var tilimlar = Calc.tilimBurchaklari(guruh.tilimlar);
    var BOSHQALAR = 'boshqalar';
    var ranglar = {};   // kalit -> rang (tilim va ro'yxat belgisi bir xil rangda)
    var tartib = 0;
    guruh.tilimlar.forEach(function (t) { ranglar[t.kategoriya_id] = t.kategoriya_id === BOSHQALAR ? 'var(--g-boshqa)' : donaRangi(tartib++); });
    function malumot(id) {
      if (id === BOSHQALAR) return { nom: 'Boshqalar', rang: ranglar[BOSHQALAR], belgi: 'boshqa' };
      var k = opts.kategoriya(id);
      return { nom: k ? k.nom : 'Kategoriyasiz', rang: ranglar[id] || 'var(--g-boshqa)', belgi: k ? k.belgi || Calc.belgiTaxmin(k.nom, k.tur) : 'umumiy' };
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

    var CX = DONA_VB / 2, CY = DONA_VB / 2, R = DONA_R, C = 2 * Math.PI * R;
    var s = svg('svg', { viewBox: '0 0 ' + DONA_VB + ' ' + DONA_VB, role: 'group', 'aria-label':
      (opts.turNomi || 'Xarajatlar') + ' kategoriyalar bo\'yicha doira diagrammasi' + (opts.markazNom ? ', ' + opts.markazNom : '') + '. Jami ' + sum(opts.jami) + ', ' + opts.taqsimot.length + ' ta kategoriya' +
      (guruh.boshqalar ? ', ' + (guruh.tilimlar.length - 1) + ' tasi alohida, qolgan ' + guruh.boshqalar.soni + ' tasi "Boshqalar" tilimida.' : '.') }, 'dona-svg');
    var tilimElementlari = {};

    tilimlar.forEach(function (t) {
      var m = malumot(t.kategoriya_id), e;
      var bosh = (t.a0 + Math.PI / 2) / (2 * Math.PI) * C, uzun = t.ulush * C;
      var kerak = tilimlar.length > 1;
      var korinadigan = kerak ? Math.max(1.5, uzun - DONA_BOSHLIQ) : C;   // tilimlar orasida ≈7 px ochiq joy; bitta tilim — butun halqa
      e = svg('circle', { cx: CX, cy: CY, r: R, fill: 'none', stroke: m.rang, 'stroke-width': DONA_QALINLIK, 'stroke-linecap': 'butt',
        'stroke-dasharray': korinadigan.toFixed(2) + ' ' + (C - korinadigan + 0.01).toFixed(2),
        'stroke-dashoffset': (-(bosh + (kerak ? DONA_BOSHLIQ / 2 : 0))).toFixed(2), transform: 'rotate(-90 ' + CX + ' ' + CY + ')' });
      e.style.stroke = m.rang;
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

    // Markaz: "Xarajat" (kichik) va jami summa (qisqa: "8,4 mln"); tilim ustida — tilim nomi va summasi
    var markaz1 = svg('text', { x: CX, y: CY - 11, 'text-anchor': 'middle', 'aria-hidden': 'true' }, 'dona-markaz-1');
    var markaz2 = svg('text', { x: CX, y: CY + 15, 'text-anchor': 'middle', 'aria-hidden': 'true' }, 'dona-markaz-2');
    s.appendChild(markaz1);
    s.appendChild(markaz2);
    function markazYoz(sarlavha, qiymat) {
      markaz1.textContent = sarlavha.length > 16 ? sarlavha.slice(0, 15) + '…' : sarlavha;
      markaz1.setAttribute('class', 'dona-markaz-1' + (sarlavha.length > 11 ? ' kichik' : ''));
      markaz2.textContent = qiymat;
      markaz2.setAttribute('class', 'dona-markaz-2' + (qiymat.length > 8 ? ' kichik' : ''));
    }
    var markazSarlavha = opts.markazSarlavha || (opts.turNomi === 'Daromadlar' ? 'Daromad' : 'Xarajat');
    function jamiKorsat() { markazYoz(markazSarlavha, qisqa(opts.jami)); }
    jamiKorsat();

    var qatorlar = {};   // ro'yxat qatorlari (kategoriya yoki "boshqalar" guruhi sarlavhasi)
    function vurgula(kalit, x, y) {
      quti.classList.add('faol');
      Object.keys(tilimElementlari).forEach(function (k) { tilimElementlari[k].classList.toggle('vurgulangan', k === kalit); });
      Object.keys(qatorlar).forEach(function (k) {
        qatorlar[k].classList.toggle('vurgulangan', k === kalit || guruhIdlari[k] === kalit);
      });
      var t = tilimlar.filter(function (z) { return z.kategoriya_id === kalit; })[0], m = malumot(kalit);
      markazYoz(t.kategoriya_id === BOSHQALAR ? 'Boshqalar' : m.nom, qisqa(t.summa));
      if (x !== undefined) maslahatKorsat(nomi(t), [{ rang: m.rang, qiymat: sum(t.summa), nom: t.foiz + '%' }], x, y);
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

    // Ro'yxat: har kategoriya uchun ikon katagi, nomi, foizi (va summasi). "Boshqalar" qatori yopiq turadi, bosilsa ichidagilar ochiladi.
    // Bu — diagrammaning matnli (jadval) nusxasi
    var royxat = el('ul', undefined, 'dona-royxat');
    function qator(kalit, nom, rang, summa, foiz, ariya, bosilganda, qoshimcha, belgiKaliti, izoh) {
      var li = el('li', undefined, qoshimcha || '');
      var b = el('button', undefined, 'dona-qator');
      b.type = 'button';
      b.setAttribute('aria-label', ariya);
      b.setAttribute('data-kategoriya', kalit);
      b.setAttribute('data-summa', summa);
      b.setAttribute('data-foiz', foiz);
      b.appendChild(belgiKatagi(belgiKaliti || 'umumiy', rang, 40));
      var matnQism = el('span', undefined, 'dona-matn');
      matnQism.appendChild(el('span', nom, 'dona-nom'));
      matnQism.appendChild(el('span', izoh || sum(summa), 'dona-qiymat'));
      b.appendChild(matnQism);
      b.appendChild(el('span', foiz + '%', 'dona-foiz'));
      var tilimKaliti = guruhIdlari[kalit] || kalit;
      b.addEventListener('pointerenter', function () { vurgula(tilimKaliti); });
      b.addEventListener('pointerleave', vurgulashniOlish);
      b.addEventListener('focus', function () { vurgula(tilimKaliti); });
      b.addEventListener('blur', vurgulashniOlish);
      b.addEventListener('click', function () { vurgulashniOlish(); bosilganda(b, li); });
      qatorlar[kalit] = b;
      li.appendChild(b);
      royxat.appendChild(li);
      return li;
    }
    function kategoriyaQatori(x, ichki) {
      var m = malumot(x.kategoriya_id);
      return qator(x.kategoriya_id, m.nom, ichki ? 'var(--g-boshqa)' : m.rang, x.summa, x.foiz, matn({ kategoriya_id: x.kategoriya_id, summa: x.summa, foiz: x.foiz }) + '. Yozuvlarni ochish',
        function () { opts.bosilganda(x.kategoriya_id); }, ichki ? 'dona-ichki' : '', m.belgi);
    }
    var alohida = guruh.tilimlar.filter(function (t) { return t.kategoriya_id !== BOSHQALAR || !guruh.boshqalar; });
    alohida.forEach(function (x) { kategoriyaQatori(x, false); });
    if (guruh.boshqalar) {
      var g = guruh.boshqalar, ichkilar = [];
      var gQator = qator(BOSHQALAR, 'Boshqalar', 'var(--g-boshqa)', g.summa, g.foiz, 'Boshqalar: ' + g.soni + ' ta kategoriya, ' + sum(g.summa) + ', ' + g.foiz + ' foiz. Ochish yoki yopish', function (b) {
        var ochiq = b.getAttribute('aria-expanded') !== 'true';
        b.setAttribute('aria-expanded', String(ochiq));
        ichkilar.forEach(function (li) { li.hidden = !ochiq; });
        gQator.classList.toggle('ochiq', ochiq);
        b.querySelector('.dona-qiymat').textContent = ochiq ? g.soni + ' ta kategoriya, yopish uchun bosing' : g.soni + ' ta, bosib oching';
      }, 'dona-guruh', 'boshqa', g.soni + ' ta, bosib oching');
      gQator.querySelector('.dona-qator').setAttribute('aria-expanded', 'false');
      guruh.dum.forEach(function (x) { var li = kategoriyaQatori(x, true); li.hidden = true; ichkilar.push(li); });
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
