// Ekranlar. 1-bosqichda: bo'limlar almashishi va boshlang'ich ma'lumotni ko'rsatish.
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

  var bolimlar = {
    bosh: function (m) {
      var bloklar = [el('h1', 'Bosh sahifa')];
      var k = karta();
      k.appendChild(el('h2', 'Hisoblar'));
      m.hisoblar.filter(function (h) { return !h.arxivlangan; }).forEach(function (h) {
        var q = el('div', undefined, 'qator');
        q.appendChild(el('span', h.nom));
        q.appendChild(el('strong', Calc.sumFormat(h.boshlangich_qoldiq)));
        k.appendChild(q);
      });
      bloklar.push(k);
      bloklar.push(tayyorBolim('', 'Balans, yozuvlar va ogohlantirishlar keyingi bosqichlarda qo\'shiladi.')[1]);
      return bloklar;
    },
    hisobot: function () { return tayyorBolim('Hisobot'); },
    qoshish: function () { return tayyorBolim('Yozuv qo\'shish', 'Yozuv qo\'shish shakli 2-bosqichda quriladi.'); },
    byudjet: function () { return tayyorBolim('Byudjet'); },
    yana: function (m) {
      var bloklar = [el('h1', 'Yana')];
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

  var malumot = { hisoblar: [], kategoriyalar: [] };

  function korsat(nom) {
    if (!bolimlar[nom]) nom = 'bosh';
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
    return Promise.all([Data.hammasi('hisoblar'), Data.hammasi('kategoriyalar')]).then(function (r) {
      malumot.hisoblar = r[0];
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
