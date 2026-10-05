// G'ildirakli sana va vaqt tanlagich: yil, oy, kun, soat, daqiqa ustunlari va "Tasdiqlash" tugmasi.
// Tashqi kutubxonasiz: ustunlar CSS scroll-snap bilan, qiymatlarni hisoblash (kelajak qiymatlarni
// kulrang qilish va tanlatmaslik) Calc ichida. Hozirgi vaqtdan keyingi qiymatlar tanlanmaydi.
(function (global) {
  'use strict';

  var BALANDLIK = 44;   // bitta qatorning balandligi (piksel); style.css dagi .g-element bilan bir xil bo'lishi kerak
  // [ustun kaliti, sarlavha, tanlov maydoni]
  var USTUNLAR = [['yil', 'Yil', 'y'], ['oy', 'Oy', 'm'], ['kun', 'Kun', 'd'], ['soat', 'Soat', 'H'], ['daqiqa', 'Daqiqa', 'M']];
  var OY_QISQA = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
  var BOSHI = { yil: 2000, oy: 1, kun: 1, soat: 0, daqiqa: 0 };

  function el(teg, matn, klass) {
    var e = document.createElement(teg);
    if (matn !== undefined) e.textContent = matn;
    if (klass) e.className = klass;
    return e;
  }
  function ikki(n) { return (n < 10 ? '0' : '') + n; }
  function matn(kalit, q) {
    if (kalit === 'oy') return OY_QISQA[q - 1];
    return kalit === 'soat' || kalit === 'daqiqa' ? ikki(q) : String(q);
  }

  // Tanlagichni ochadi. opts: { sana: "YYYY-MM-DD", vaqt: "HH:MM", tasdiq: function (sana, vaqt) }
  // Boshlang'ich qiymat kelajakda bo'lsa, eng yaqin ruxsat etilgan (hozirgi) qiymatga keltiriladi.
  function ochish(opts) {
    var oldingiFokus = document.activeElement;
    var oldingiOverflow = document.body.style.overflow;
    // faqatSana: faqat yil, oy va kun (erkin davr sanalari). katta — eng kech sana (standart: bugun), kichik — eng erta sana.
    var ustunRoyxat = opts.faqatSana ? USTUNLAR.slice(0, 3) : USTUNLAR;
    function hozirgi() { return opts.faqatSana ? { sana: opts.katta || Calc.bugun(), vaqt: '23:59' } : Calc.hozir(); }
    var holat = Calc.glidirakTuzat(Calc.vaqtdanTanlov(opts.sana, opts.vaqt), hozirgi(), opts.kichik);
    var ustunlar = {};   // kalit -> { s: ustun elementi, vaqt: kechiktirish taymeri }

    var parda = el('div', undefined, 'g-parda');
    var oyna = el('div', undefined, 'g-oyna');
    oyna.setAttribute('role', 'dialog');
    oyna.setAttribute('aria-modal', 'true');
    oyna.setAttribute('aria-label', opts.sarlavha || (opts.faqatSana ? 'Sanani tanlash' : 'Sana va vaqtni tanlash'));
    oyna.tabIndex = -1;
    oyna.appendChild(el('div', opts.sarlavha || (opts.faqatSana ? 'Sana' : 'Sana va vaqt'), 'g-sarlavha'));
    var korinish = el('div', undefined, 'g-korinish');
    korinish.setAttribute('aria-live', 'polite');
    oyna.appendChild(korinish);

    var nomlar = el('div', undefined, 'g-nomlar');
    var quti = el('div', undefined, 'g-ustunlar');
    quti.appendChild(el('div', undefined, 'g-chiziq'));
    ustunRoyxat.forEach(function (u) {
      nomlar.appendChild(el('span', u[1]));
      var s = el('div', undefined, 'g-ustun');
      s.setAttribute('role', 'listbox');
      s.setAttribute('aria-label', u[1]);
      s.tabIndex = 0;
      s.setAttribute('data-ustun', u[0]);
      ustunlar[u[0]] = { s: s, taymer: null };
      quti.appendChild(s);
      s.addEventListener('scroll', function () {
        // g'ildirak to'xtagach (snap tugagach) qiymatni o'qiymiz
        clearTimeout(ustunlar[u[0]].taymer);
        ustunlar[u[0]].taymer = setTimeout(function () { tinch(u); }, 110);
      });
      s.addEventListener('click', function (e) {
        var x = e.target.closest ? e.target.closest('.g-element') : null;
        if (!x || x.getAttribute('aria-disabled') === 'true') return;   // kulrang (kelajak) qiymat tanlanmaydi
        tanla(u, parseInt(x.getAttribute('data-q'), 10), true);
      });
      s.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
        if (!d) return;
        e.preventDefault();
        tanla(u, holat[u[2]] + d, true);
      });
    });
    oyna.appendChild(nomlar);
    oyna.appendChild(quti);

    var xato = el('div', undefined, 'xato-matn');
    oyna.appendChild(xato);
    var tugmalar = el('div', undefined, 'g-tugmalar');
    var bekor = el('button', 'Bekor qilish', 'ikkinchi-tugma');
    bekor.type = 'button';
    var tasdiqTugma = el('button', 'Tasdiqlash', 'asosiy-tugma');
    tasdiqTugma.type = 'button';
    tugmalar.appendChild(bekor);
    tugmalar.appendChild(tasdiqTugma);
    oyna.appendChild(tugmalar);
    parda.appendChild(oyna);

    // Ustun elementlarini holatga moslaydi (oyning kunlari soni o'zgarsa, qayta quriladi; kulrang qiymatlar belgilanadi)
    function elementlar(u) {
      var s = ustunlar[u[0]].s, royxat = Calc.glidirakQiymatlari(u[0], holat, hozirgi(), opts.kichik);
      if (s.children.length !== royxat.length) {
        s.textContent = '';
        royxat.forEach(function (r) {
          var x = el('div', matn(u[0], r.qiymat), 'g-element');
          x.setAttribute('role', 'option');
          x.setAttribute('data-q', r.qiymat);
          s.appendChild(x);
        });
      }
      royxat.forEach(function (r, i) {
        var x = s.children[i];
        x.setAttribute('aria-disabled', String(!r.ochiq));
        x.setAttribute('aria-selected', String(r.qiymat === holat[u[2]]));
        x.classList.toggle('tanlangan', r.qiymat === holat[u[2]]);
      });
    }
    function joyi(u) { return (holat[u[2]] - BOSHI[u[0]]) * BALANDLIK; }

    // Hammasini yangilaydi. faol — foydalanuvchi aylantirgan ustun (u silliq qaytadi, qolganlari bir zumda)
    function yangila(faol) {
      var v = Calc.tanlovdanVaqt(holat);
      korinish.textContent = opts.faqatSana ? Calc.sanaKorsat(v.sana) : Calc.sanaKorsat(v.sana) + ' · ' + v.vaqt;
      ustunRoyxat.forEach(function (u) {
        elementlar(u);
        var s = ustunlar[u[0]].s, kerak = joyi(u);
        if (Math.abs(s.scrollTop - kerak) > 1) s.scrollTo({ top: kerak, behavior: faol === u[0] ? 'smooth' : 'auto' });
      });
    }

    function tanla(u, qiymat, silliq) {
      var t = {};
      Object.keys(holat).forEach(function (k) { t[k] = holat[k]; });
      t[u[2]] = qiymat;
      holat = Calc.glidirakTuzat(t, hozirgi(), opts.kichik);   // kelajak qiymat bo'lsa, ruxsat etilgan eng yaqinga qaytadi
      xato.textContent = '';
      yangila(silliq ? u[0] : null);
    }
    function tinch(u) {
      var s = ustunlar[u[0]].s, royxat = Calc.glidirakQiymatlari(u[0], holat, hozirgi(), opts.kichik);
      var i = Math.max(0, Math.min(royxat.length - 1, Math.round(s.scrollTop / BALANDLIK)));
      var q = royxat[i].qiymat;
      if (q === holat[u[2]] && royxat[i].ochiq) return;   // allaqachon shu qiymat
      tanla(u, q, true);
    }

    function yop() {
      document.removeEventListener('keydown', tugmaBosildi, true);
      if (parda.parentNode) parda.parentNode.removeChild(parda);
      document.body.style.overflow = oldingiOverflow;
      if (oldingiFokus && oldingiFokus.focus) oldingiFokus.focus();
    }
    function tugmaBosildi(e) {
      if (e.key === 'Escape') { e.preventDefault(); yop(); return; }
      if (e.key !== 'Tab') return;
      // fokus oyna ichida qoladi
      var f = Array.prototype.slice.call(oyna.querySelectorAll('.g-ustun, button'));
      var i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
    bekor.addEventListener('click', yop);
    parda.addEventListener('click', function (e) { if (e.target === parda) yop(); });
    tasdiqTugma.addEventListener('click', function () {
      // ikkinchi himoya: tasdiqlash paytidagi hozirgi vaqt bilan yana tekshiramiz
      var h = hozirgi();
      var v = Calc.tanlovdanVaqt(Calc.glidirakTuzat(holat, h, opts.kichik));
      var r = opts.faqatSana
        ? ((opts.kichik && v.sana < opts.kichik) || v.sana > h.sana ? { xato: 'Bu sanani tanlab bo\'lmaydi' } : {})
        : Calc.vaqtTekshir(v.sana, v.vaqt, h);
      if (r.xato) { xato.textContent = r.xato; return; }
      yop();
      opts.tasdiq(v.sana, v.vaqt);
    });

    document.body.appendChild(parda);
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', tugmaBosildi, true);
    yangila(null);
    // boshlang'ich joylashuv (element joylashgandan keyin)
    ustunRoyxat.forEach(function (u) { ustunlar[u[0]].s.scrollTop = joyi(u); });
    oyna.focus();
    return { yop: yop };
  }

  global.Glidirak = { ochish: ochish };
})(typeof window !== 'undefined' ? window : this);
