// Diagrammalar (SVG, tashqi kutubxonasiz): xarajatlarning kategoriyalar bo'yicha doirasi va vaqt bo'yicha ustunli diagramma.
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

  // ======================================================================
  // Doira (donut): xarajatlarning kategoriyalar bo'yicha taqsimoti
  // opts: { taqsimot: [{ kategoriya_id, summa, foiz }] (kattasidan kichigiga), jami,
  //         kategoriya: function (id) -> { nom, rang } | undefined, bosilganda: function (id) }
  // Tilim rangi — kategoriyaning o'z rangi (4-bosqichdagi bilan bir xil). Nomlar so'z o'rtasidan sinmaydigan ro'yxatda.
  // ======================================================================
  function dona(opts) {
    var quti = el('div', undefined, 'dona-quti');
    var tilimlar = Calc.tilimBurchaklari(opts.taqsimot);
    function malumot(id) {
      var k = opts.kategoriya(id);
      return { nom: k ? k.nom : 'Kategoriyasiz', rang: k ? k.rang : '#90a4ae' };
    }
    function matn(t) { return malumot(t.kategoriya_id).nom + ': ' + sum(t.summa) + ', ' + t.foiz + ' foiz'; }

    var CX = 120, CY = 120, R2 = 108, R1 = 68, ORTA = (R1 + R2) / 2, FARQ = 2 / ORTA;   // tilimlar orasida 2 px bo'shliq
    var s = svg('svg', { viewBox: '0 0 240 240', role: 'group', 'aria-label':
      'Xarajatlar kategoriyalar bo\'yicha doira diagrammasi. Jami ' + sum(opts.jami) + ', ' + tilimlar.length + ' ta kategoriya.' }, 'dona-svg');
    var tilimElementlari = {};

    tilimlar.forEach(function (t) {
      var m = malumot(t.kategoriya_id), e;
      if (tilimlar.length === 1) {   // bitta kategoriya: to'liq halqa
        e = svg('circle', { cx: CX, cy: CY, r: ORTA, fill: 'none', 'stroke-width': R2 - R1, stroke: m.rang });
      } else {
        var kirish = Math.min(FARQ / 2, (t.a1 - t.a0) * 0.2);
        e = svg('path', { d: Calc.yoyYoli(CX, CY, R1, R2, t.a0 + kirish, t.a1 - kirish), fill: m.rang });
      }
      e.setAttribute('class', 'dona-tilim');
      e.setAttribute('role', 'img');
      e.setAttribute('aria-label', matn(t) + '. Yozuvlarni ochish uchun bosing');
      e.setAttribute('data-kategoriya', t.kategoriya_id);
      e.setAttribute('data-summa', t.summa);
      e.setAttribute('data-foiz', t.foiz);
      tilimElementlari[t.kategoriya_id] = e;
      s.appendChild(e);
    });

    // Markaz: jami yoki ko'rsatilayotgan tilim
    var markaz1 = svg('text', { x: CX, y: CY - 6, 'text-anchor': 'middle', 'aria-hidden': 'true' }, 'dona-markaz-1');
    var markaz2 = svg('text', { x: CX, y: CY + 16, 'text-anchor': 'middle', 'aria-hidden': 'true' }, 'dona-markaz-2');
    s.appendChild(markaz1);
    s.appendChild(markaz2);
    function markazYoz(nom, qiymat) {
      markaz1.textContent = nom.length > 20 ? nom.slice(0, 19) + '…' : nom;
      markaz1.setAttribute('class', 'dona-markaz-1' + (nom.length > 14 ? ' kichik' : ''));
      markaz2.textContent = qiymat;
      markaz2.setAttribute('class', 'dona-markaz-2' + (qiymat.length > 14 ? ' kichik' : ''));
    }
    function jamiKorsat() {
      var t = sum(opts.jami);
      markazYoz('Jami xarajat', t.length > 14 ? Calc.qisqaSum(opts.jami) + ' so\'m' : t);
    }
    jamiKorsat();

    var qatorlar = {};
    function vurgula(id, x, y) {
      quti.classList.add('faol');
      Object.keys(tilimElementlari).forEach(function (k) {
        tilimElementlari[k].classList.toggle('vurgulangan', k === id);
        if (qatorlar[k]) qatorlar[k].classList.toggle('vurgulangan', k === id);
      });
      var t = tilimlar.filter(function (z) { return z.kategoriya_id === id; })[0], m = malumot(id);
      markazYoz(m.nom, sum(t.summa));
      if (x !== undefined) maslahatKorsat(m.nom, [{ rang: m.rang, qiymat: sum(t.summa), nom: t.foiz + '%' }], x, y);
    }
    function vurgulashniOlish() {
      quti.classList.remove('faol');
      Object.keys(tilimElementlari).forEach(function (k) {
        tilimElementlari[k].classList.remove('vurgulangan');
        if (qatorlar[k]) qatorlar[k].classList.remove('vurgulangan');
      });
      jamiKorsat();
      maslahatYashir();
    }
    tilimlar.forEach(function (t) {
      var e = tilimElementlari[t.kategoriya_id];
      e.addEventListener('pointerenter', function (ev) { vurgula(t.kategoriya_id, ev.clientX, ev.clientY); });
      e.addEventListener('pointermove', function (ev) { vurgula(t.kategoriya_id, ev.clientX, ev.clientY); });
      e.addEventListener('pointerleave', vurgulashniOlish);
      e.addEventListener('click', function () { vurgulashniOlish(); opts.bosilganda(t.kategoriya_id); });
    });
    var rasm = el('div', undefined, 'dona-rasm');
    rasm.appendChild(s);
    quti.appendChild(rasm);

    // Ro'yxat: har kategoriya rangi, nomi (so'z o'rtasidan sinmaydi), summasi va foizi. Bu — diagrammaning matnli (jadval) nusxasi
    var royxat = el('ul', undefined, 'dona-royxat');
    tilimlar.forEach(function (t) {
      var m = malumot(t.kategoriya_id);
      var li = el('li');
      var b = el('button', undefined, 'dona-qator');
      b.type = 'button';
      b.setAttribute('aria-label', matn(t) + '. Yozuvlarni ochish');
      b.setAttribute('data-kategoriya', t.kategoriya_id);
      b.setAttribute('data-summa', t.summa);
      b.setAttribute('data-foiz', t.foiz);
      var kalit = el('span', undefined, 'dona-kalit');
      kalit.style.background = m.rang;
      b.appendChild(kalit);
      b.appendChild(el('span', m.nom, 'dona-nom'));
      b.appendChild(el('span', sum(t.summa) + ' · ' + t.foiz + '%', 'dona-qiymat'));
      b.addEventListener('pointerenter', function () { vurgula(t.kategoriya_id); });
      b.addEventListener('pointerleave', vurgulashniOlish);
      b.addEventListener('focus', function () { vurgula(t.kategoriya_id); });
      b.addEventListener('blur', vurgulashniOlish);
      b.addEventListener('click', function () { vurgulashniOlish(); opts.bosilganda(t.kategoriya_id); });
      qatorlar[t.kategoriya_id] = b;
      li.appendChild(b);
      royxat.appendChild(li);
    });
    quti.appendChild(royxat);
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
      var H = v.tur === 'hafta' ? 250 : 236, yuqori = 14, osti = v.tur === 'hafta' ? 40 : 26;
      var t = Calc.chiroyliTiklar(v.eng, 4);
      var uzun = Math.max.apply(null, t.tiklar.map(function (x) { return Calc.qisqaSum(x).length; }));
      var x0 = Math.round(uzun * 6.3) + 12, x1 = W - 8, y0 = yuqori, y1 = H - osti, balandlik = y1 - y0;
      var slot = (x1 - x0) / n, bw = Math.max(1.5, Math.min(24, (slot * 0.8 - 2) / 2));
      var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'group', tabindex: '0', 'aria-label':
        'Daromad va xarajat, ' + v.davrNomi + ', ' + (v.tur === 'yil' ? 'oylar' : 'kunlar') + ' bo\'yicha. Jami daromad ' + sum(v.jami.daromad) +
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
          var q = svg('text', { x: gx + (engJoy.bar ? bw + 2 : 0) + bw / 2, y: y1 - Calc.ustunBalandligi(v.eng, t.eng, balandlik, 2) - 4,
            'text-anchor': 'middle', 'aria-hidden': 'true' }, 'g-eng');
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
        if (v.tur === 'oy') {
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

  global.Diagramma = { dona: dona, ustunli: ustunli, maslahatYashir: maslahatYashir };
})(typeof window !== 'undefined' ? window : this);
