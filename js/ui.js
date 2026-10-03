// Ekranlar: bo'limlar almashishi, yozuv qo'shish shakli, yozuvlar ro'yxati, bosh sahifa.
(function () {
  'use strict';

  var ekran = document.getElementById('ekran');
  var tugmalar = document.querySelectorAll('[data-bolim]');
  var keyingiBosqich = 'Bu bo\'lim keyingi bosqichlarda quriladi.';

  function el(teg, matn, klass) {
    var e = document.createElement(teg);
    if (matn !== undefined) e.textContent = matn;
    if (klass) e.className = klass;
    return e;
  }
  function karta() { return el('div', undefined, 'karta'); }

  function tayyorBolim(sarlavha, izoh) {
    var k = karta();
    k.appendChild(el('p', izoh || keyingiBosqich, 'xira'));
    return [el('h1', sarlavha), k];
  }

  // Nom + rang nuqtasi ko'rinishidagi ro'yxat
  function kategoriyaRoyxati(royxat) {
    var ul = el('ul', undefined, 'royxat');
    royxat.forEach(function (k) {
      var li = el('li');
      var n = el('span', undefined, 'nuqta');
      n.style.background = k.rang;
      li.appendChild(n);
      li.appendChild(document.createTextNode(k.nom));
      ul.appendChild(li);
    });
    return ul;
  }

  var malumot = { hisoblar: [], kategoriyalar: [], yozuvlar: [] };
  var xabar = '';   // "Saqlandi" xabari, faqat qo'shish ekranida bir marta ko'rsatiladi

  function kategoriyaOl(id) {
    return malumot.kategoriyalar.filter(function (k) { return k.id === id; })[0];
  }
  function hisobOl(id) {
    return malumot.hisoblar.filter(function (h) { return h.id === id; })[0];
  }

  // Bitta yozuv qatori
  function yozuvQatori(y) {
    var k = kategoriyaOl(y.kategoriya_id);
    var h = hisobOl(y.hisob_id);
    var q = el('div', undefined, 'yozuv');
    var chap = el('div', undefined, 'yozuv-chap');
    var nom = el('div', undefined, 'yozuv-nom');
    var nuqta = el('span', undefined, 'nuqta');
    nuqta.style.background = k ? k.rang : '#90a4ae';
    nom.appendChild(nuqta);
    nom.appendChild(document.createTextNode(k ? k.nom : 'Kategoriyasiz'));
    chap.appendChild(nom);
    var tafsilot = (h ? h.nom : '') + (y.izoh ? ' · ' + y.izoh : '');
    if (tafsilot) chap.appendChild(el('div', tafsilot, 'yozuv-izoh'));
    q.appendChild(chap);
    var daromad = y.tur === 'daromad';
    q.appendChild(el('div', (daromad ? '+' : '−') + Calc.sumFormat(y.summa),
      'yozuv-summa ' + (daromad ? 'plus' : 'minus')));
    return q;
  }

  // Kunlar bo'yicha guruhlangan ro'yxat; har kun sarlavhasida o'sha kunning jami xarajati
  function yozuvlarRoyxati(guruhlar) {
    var quti = document.createElement('div');
    guruhlar.forEach(function (g) {
      var kun = karta();
      kun.classList.add('kun');
      var sarlavha = el('div', undefined, 'kun-sarlavha');
      sarlavha.appendChild(el('strong', Calc.sanaKorsat(g.sana)));
      sarlavha.appendChild(el('span', 'Xarajat: ' + Calc.sumFormat(g.xarajat)));
      kun.appendChild(sarlavha);
      g.yozuvlar.forEach(function (y) { kun.appendChild(yozuvQatori(y)); });
      quti.appendChild(kun);
    });
    return quti;
  }

  function bosYozuvlar() {
    var k = karta();
    k.appendChild(el('p', 'Hozircha yozuvlar yo\'q. Pastdagi + tugmasi bilan birinchi yozuvni qo\'shing.', 'xira'));
    return k;
  }

  // ---- Yozuv qo'shish shakli ----
  function qoshishShakli() {
    var holat = { tur: 'xarajat', kategoriya: null };
    var bloklar = [el('h1', 'Yozuv qo\'shish')];
    if (xabar) { bloklar.push(el('div', xabar, 'xabar')); xabar = ''; }

    var forma = document.createElement('form');
    forma.noValidate = true;
    forma.className = 'karta';

    // Tur: xarajat / daromad
    var turMaydon = el('div', undefined, 'maydon');
    turMaydon.appendChild(el('span', 'Tur', 'belgi'));
    var turQator = el('div', undefined, 'tanlov');
    var turTugmalari = {};
    [['xarajat', 'Xarajat'], ['daromad', 'Daromad']].forEach(function (t) {
      var b = el('button', t[1]);
      b.type = 'button';
      turTugmalari[t[0]] = b;
      b.addEventListener('click', function () {
        holat.tur = t[0];
        holat.kategoriya = null;
        yangila();
      });
      turQator.appendChild(b);
    });
    turMaydon.appendChild(turQator);
    forma.appendChild(turMaydon);

    // Summa: yozilgan sari mingliklar ajratiladi
    var summaMaydon = el('div', undefined, 'maydon');
    var summaBelgi = el('label', 'Summa (so\'m)');
    summaBelgi.setAttribute('for', 'f-summa');
    var summa = document.createElement('input');
    summa.id = 'f-summa';
    summa.type = 'text';
    summa.inputMode = 'numeric';
    summa.autocomplete = 'off';
    summa.placeholder = '0';
    summa.className = 'summa-kiritish';
    var summaXato = el('div', undefined, 'xato-matn');
    summaMaydon.appendChild(summaBelgi);
    summaMaydon.appendChild(summa);
    summaMaydon.appendChild(summaXato);
    forma.appendChild(summaMaydon);
    summa.addEventListener('input', function () {
      var poz = summa.selectionStart;
      var raqamgacha = summa.value.slice(0, poz).replace(/\D/g, '').length;
      var f = Calc.raqamFormat(summa.value);
      summa.value = f;
      // kursorni yozilgan raqamdan keyin qoldiramiz
      var yangi = f.charAt(0) === '-' ? 1 : 0, sanoq = 0;
      if (raqamgacha > 0) {
        for (yangi = 0; yangi < f.length; yangi++) {
          if (/\d/.test(f.charAt(yangi))) sanoq++;
          if (sanoq === raqamgacha) { yangi++; break; }
        }
      }
      summa.setSelectionRange(yangi, yangi);
      summaXato.textContent = '';
      summa.classList.remove('xatoli');
    });

    // Kategoriya
    var katMaydon = el('div', undefined, 'maydon');
    katMaydon.appendChild(el('span', 'Kategoriya', 'belgi'));
    var chiplar = el('div', undefined, 'chiplar');
    var katXato = el('div', undefined, 'xato-matn');
    katMaydon.appendChild(chiplar);
    katMaydon.appendChild(katXato);
    forma.appendChild(katMaydon);

    // Hisob (oxirgi ishlatilgani oldindan tanlanadi)
    var hisobMaydon = el('div', undefined, 'maydon');
    var hisobBelgi = el('label', 'Hisob');
    hisobBelgi.setAttribute('for', 'f-hisob');
    var hisob = document.createElement('select');
    hisob.id = 'f-hisob';
    var faolHisoblar = malumot.hisoblar.filter(function (h) { return !h.arxivlangan; });
    faolHisoblar.forEach(function (h) {
      var o = el('option', h.nom);
      o.value = h.id;
      hisob.appendChild(o);
    });
    var oxirgiId = Calc.oxirgiHisobId(malumot.yozuvlar);
    if (faolHisoblar.some(function (h) { return h.id === oxirgiId; })) hisob.value = oxirgiId;
    hisobMaydon.appendChild(hisobBelgi);
    hisobMaydon.appendChild(hisob);
    forma.appendChild(hisobMaydon);

    // Sana (standart: bugun; kelajak sanasi ham mumkin)
    var sanaMaydon = el('div', undefined, 'maydon');
    var sanaBelgi = el('label', 'Sana');
    sanaBelgi.setAttribute('for', 'f-sana');
    var sana = document.createElement('input');
    sana.id = 'f-sana';
    sana.type = 'date';
    sana.value = Calc.bugun();
    var sanaXato = el('div', undefined, 'xato-matn');
    sanaMaydon.appendChild(sanaBelgi);
    sanaMaydon.appendChild(sana);
    sanaMaydon.appendChild(sanaXato);
    forma.appendChild(sanaMaydon);

    // Izoh (ixtiyoriy)
    var izohMaydon = el('div', undefined, 'maydon');
    var izohBelgi = el('label', 'Izoh (ixtiyoriy)');
    izohBelgi.setAttribute('for', 'f-izoh');
    var izoh = document.createElement('input');
    izoh.id = 'f-izoh';
    izoh.type = 'text';
    izoh.autocomplete = 'off';
    izohMaydon.appendChild(izohBelgi);
    izohMaydon.appendChild(izoh);
    forma.appendChild(izohMaydon);

    var saqla = el('button', 'Saqlash', 'asosiy-tugma');
    saqla.type = 'submit';
    forma.appendChild(saqla);

    // Tanlangan turga qarab tugmalar va kategoriyalarni qayta chizadi
    function yangila() {
      Object.keys(turTugmalari).forEach(function (t) {
        turTugmalari[t].setAttribute('aria-pressed', String(holat.tur === t));
      });
      chiplar.textContent = '';
      katXato.textContent = '';
      malumot.kategoriyalar.filter(function (k) {
        return k.tur === holat.tur && !k.arxivlangan;
      }).forEach(function (k) {
        var c = el('button', undefined, 'chip');
        c.type = 'button';
        var n = el('span', undefined, 'nuqta');
        n.style.background = k.rang;
        c.appendChild(n);
        c.appendChild(document.createTextNode(k.nom));
        c.setAttribute('aria-pressed', String(holat.kategoriya === k.id));
        c.addEventListener('click', function () {
          holat.kategoriya = k.id;
          katXato.textContent = '';
          Array.prototype.forEach.call(chiplar.children, function (x) { x.setAttribute('aria-pressed', 'false'); });
          c.setAttribute('aria-pressed', 'true');
        });
        chiplar.appendChild(c);
      });
    }
    yangila();

    forma.addEventListener('submit', function (e) {
      e.preventDefault();
      var xatolik = false;
      var t = Calc.summaTekshir(summa.value);
      if (t.xato) {
        summaXato.textContent = t.xato; summa.classList.add('xatoli'); xatolik = true;
      }
      if (!holat.kategoriya) { katXato.textContent = 'Kategoriyani tanlang'; xatolik = true; }
      if (!sana.value) { sanaXato.textContent = 'Sanani kiriting'; xatolik = true; }
      if (!hisob.value) { xatolik = true; }
      if (xatolik) {
        var birinchi = forma.querySelector('.xatoli, .xato-matn:not(:empty)');
        if (birinchi) birinchi.scrollIntoView({ block: 'center' });
        if (t.xato) summa.focus();
        return;
      }
      var yozuv = {
        id: Data.yangiId(), yaratilgan: new Date().toISOString(),
        tur: holat.tur, summa: t.summa, sana: sana.value,
        hisob_id: hisob.value, kategoriya_id: holat.kategoriya, izoh: izoh.value.trim()
      };
      saqla.disabled = true;
      Data.saqlash('yozuvlar', yozuv).then(function () {
        malumot.yozuvlar.push(yozuv);
        xabar = 'Saqlandi: ' + (yozuv.tur === 'daromad' ? '+' : '−') + Calc.sumFormat(yozuv.summa);
        korsat('qoshish');   // shakl tozalanadi, balans va ro'yxat yangilanadi
      }).catch(function (xato) {
        saqla.disabled = false;
        summaXato.textContent = 'Saqlab bo\'lmadi: ' + xato;
      });
    });

    bloklar.push(forma);
    return bloklar;
  }

  var bolimlar = {
    bosh: function (m) {
      var bloklar = [el('h1', 'Bosh sahifa')];
      var faol = m.hisoblar.filter(function (h) { return !h.arxivlangan; });

      var jami = karta();
      jami.appendChild(el('div', 'Umumiy balans', 'xira'));
      jami.appendChild(el('div', Calc.sumFormat(Calc.umumiyBalans(m.hisoblar, m.yozuvlar)), 'balans-katta'));
      bloklar.push(jami);

      var k = karta();
      k.appendChild(el('h2', 'Hisoblar'));
      faol.forEach(function (h) {
        var q = el('div', undefined, 'qator');
        q.appendChild(el('span', h.nom));
        q.appendChild(el('strong', Calc.sumFormat(Calc.hisobQoldigi(h, m.yozuvlar))));
        k.appendChild(q);
      });
      bloklar.push(k);

      bloklar.push(el('h2', 'Oxirgi yozuvlar'));
      if (m.yozuvlar.length === 0) bloklar.push(bosYozuvlar());
      else bloklar.push(yozuvlarRoyxati(Calc.kunlarBoyicha(Calc.oxirgiYozuvlar(m.yozuvlar, 10))));
      return bloklar;
    },
    hisobot: function () { return tayyorBolim('Hisobot'); },
    qoshish: qoshishShakli,
    byudjet: function () { return tayyorBolim('Byudjet'); },
    yana: function (m) {
      var bloklar = [el('h1', 'Yana')];
      bloklar.push(el('h2', 'Barcha yozuvlar'));
      if (m.yozuvlar.length === 0) bloklar.push(bosYozuvlar());
      else bloklar.push(yozuvlarRoyxati(Calc.kunlarBoyicha(m.yozuvlar)));

      var xar = m.kategoriyalar.filter(function (k) { return k.tur === 'xarajat'; });
      var dar = m.kategoriyalar.filter(function (k) { return k.tur === 'daromad'; });
      var k1 = karta();
      k1.appendChild(el('h2', 'Xarajat kategoriyalari (' + xar.length + ')'));
      k1.appendChild(kategoriyaRoyxati(xar));
      var k2 = karta();
      k2.appendChild(el('h2', 'Daromad kategoriyalari (' + dar.length + ')'));
      k2.appendChild(kategoriyaRoyxati(dar));
      bloklar.push(k1, k2);
      return bloklar;
    }
  };

  function korsat(nom) {
    if (!bolimlar[nom]) nom = 'bosh';
    if (nom !== 'qoshish') xabar = '';
    ekran.textContent = '';
    bolimlar[nom](malumot).forEach(function (b) { ekran.appendChild(b); });
    tugmalar.forEach(function (t) {
      var faol = t.getAttribute('data-bolim') === nom;
      t.classList.toggle('faol', faol);
      if (faol) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    try { sessionStorage.setItem('bolim', nom); } catch (e) { /* ahamiyatsiz */ }
    window.scrollTo(0, 0);
  }

  tugmalar.forEach(function (t) {
    t.addEventListener('click', function () { korsat(t.getAttribute('data-bolim')); });
  });

  function yuklash() {
    return Promise.all([Data.hammasi('hisoblar'), Data.hammasi('kategoriyalar'), Data.hammasi('yozuvlar')]).then(function (r) {
      malumot.hisoblar = r[0];
      malumot.yozuvlar = r[2];
      malumot.kategoriyalar = r[1].sort(function (a, b) { return a.yaratilgan < b.yaratilgan ? -1 : 1; });
    });
  }

  Data.boshlash().then(yuklash).then(function () {
    var oxirgi = 'bosh';
    try { oxirgi = sessionStorage.getItem('bolim') || 'bosh'; } catch (e) { /* ahamiyatsiz */ }
    korsat(oxirgi);
  }).catch(function (xato) {
    ekran.textContent = '';
    var k = karta();
    k.appendChild(el('p', 'Ma\'lumotni ochib bo\'lmadi. Sahifani qayta yuklang. (' + xato + ')'));
    ekran.appendChild(k);
  });
})();
