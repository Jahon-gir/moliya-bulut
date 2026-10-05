// Ekranlar: bo'limlar almashishi, yozuv qo'shish/tahrirlash, yozuvlar ro'yxati, hisoblar, bosh sahifa.
(function () {
  'use strict';

  var ekran = document.getElementById('ekran');
  var tugmalar = document.querySelectorAll('[data-bolim]');
  var keyingiBosqich = 'Bu bo\'lim keyingi bosqichlarda quriladi.';

  var malumot = { hisoblar: [], kategoriyalar: [], yozuvlar: [], byudjetlar: [], qarzlar: [], zaxiraSanasi: null, balansYashirin: false };
  var xabar = '';          // "Saqlandi" xabari, faqat qo'shish ekranida bir marta ko'rsatiladi
  var joriy = 'bosh';      // hozirgi bo'lim
  var stek = [];           // bo'lim ichidagi ochiq ekranlar: [{ yasash, forma }]; "Orqaga" oxirgisini yopadi
  // Hisobot bo'limi holati: tur ('kun' | 'hafta' | 'oy' | 'yil' | 'davr'), davrdagi sana (davr bo'lmasa), erkin davr dan/gacha,
  // hisob filtri, yorliq (xarajat | daromad), ko'rinish (dona | ustun; eslab qolinadi)
  var hisobotHolat = { tur: 'oy', sana: null, dan: null, gacha: null, hisob: '', turi: 'xarajat', korinish: korinishniOl() };
  var filtr = bosFiltr();  // "Barcha yozuvlar" filtri (ilova ochiq turguncha eslab qolinadi)
  var VERSIYA = (document.querySelector('meta[name="versiya"]') || {}).content || '?';
  var YOZUVLAR_SAHIFASI = 300;   // "Barcha yozuvlar" da bir vaqtda ko'rsatiladigan yozuvlar (butun kunlar bilan)
  var RANGLAR = ['#e57373', '#f06292', '#ba68c8', '#9575cd', '#64b5f6', '#4dd0e1', '#26a69a',
    '#81c784', '#aed581', '#ffd54f', '#ffb74d', '#a1887f', '#90a4ae'];

  var TUR_NOMI = { xarajat: 'Xarajat', daromad: 'Daromad', otkazma: 'O\'tkazma' };
  var HISOB_TURI = Calc.HISOB_TURLARI.map(function (t) { return [t, Calc.HISOB_TURI_NOMI[t]]; });   // karta, bank, naqd, boshqa

  function bosFiltr() {
    return { tur: '', hisob: '', kategoriya: '', kategoriyalar: [], dan: '', gacha: '', qidiruv: '' };
  }

  function el(teg, matn, klass) {
    var e = document.createElement(teg);
    if (matn !== undefined) e.textContent = matn;
    if (klass) e.className = klass;
    return e;
  }
  function tugma(matn, klass, bosilganda) {
    var b = el('button', matn, klass);
    b.type = 'button';
    if (bosilganda) b.addEventListener('click', bosilganda);
    return b;
  }
  function karta() { return el('div', undefined, 'karta'); }

  function tayyorBolim(sarlavha, izoh) {
    var k = karta();
    k.appendChild(el('p', izoh || keyingiBosqich, 'xira'));
    return [el('h1', sarlavha), k];
  }

  // ---- Belgilar (ikonka): rangli doira ichida; faqat belgi kaliti saqlanadi, chizish js/belgilar.js da ----
  function belgiDumi(kalit, rang, olcham) {
    var d = el('span', undefined, 'belgi-dum');
    d.style.width = d.style.height = olcham + 'px';
    d.style.background = rang;
    d.style.color = Calc.matnRangi(rang);
    d.appendChild(Belgilar.chiz(kalit, Math.round(olcham * 0.58)));
    return d;
  }
  function kategBadge(k, olcham) {
    return belgiDumi(k ? (k.belgi || Calc.belgiTaxmin(k.nom, k.tur)) : 'umumiy', k ? k.rang : '#90a4ae', olcham || 28);
  }
  function hisobBadge(h, olcham) {
    return belgiDumi(Calc.hisobBelgisiOl(h), Calc.hisobRangiOl(h), olcham || 28);
  }

  // ---- Pastdan chiqadigan oyna (umumiy): sarlavha, "Orqaga" va yopish belgisi; Esc, tashqariga bosish, Tab oyna ichida aylanadi ----
  // qur(oyna, yop) tanasini to'ldiradi. Natija: { yop }. Yopilganda fokus oldingi elementga qaytadi.
  function pastkiOyna(sarlavha, qur, klass) {
    var oldingiFokus = document.activeElement, oldingiOverflow = document.body.style.overflow;
    var parda = el('div', undefined, 'sheet-parda');
    var oyna = el('div', undefined, 'sheet ' + (klass || ''));
    oyna.setAttribute('role', 'dialog');
    oyna.setAttribute('aria-modal', 'true');
    oyna.setAttribute('aria-label', sarlavha);
    oyna.tabIndex = -1;
    parda.appendChild(oyna);
    function yop(fokus) {
      document.removeEventListener('keydown', tugmaBosildi, true);
      if (parda.parentNode) parda.parentNode.removeChild(parda);
      document.body.style.overflow = oldingiOverflow;
      if (fokus !== false && oldingiFokus && oldingiFokus.focus && oldingiFokus.isConnected) oldingiFokus.focus();
    }
    function tugmaBosildi(e) {
      if (document.querySelector('.g-parda')) return;
      if (e.key === 'Escape') { e.preventDefault(); yop(); return; }
      if (e.key !== 'Tab') return;
      var f = Array.prototype.slice.call(oyna.querySelectorAll('button:not([disabled]), input, select, textarea, summary'));
      if (!f.length) return;
      var i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
    var bosh = el('div', undefined, 'sheet-bosh tanlov-bosh');
    var orqa = tugma('← Orqaga', 'matn-tugma', function () { yop(); });
    orqa.setAttribute('aria-label', 'Orqaga, oynani yopish');
    bosh.appendChild(orqa);
    var yopT = belgiTugmasi('yopish', 'Yopish', function () { yop(); });
    yopT.classList.add('yopish-tugma');
    bosh.appendChild(yopT);
    oyna.appendChild(bosh);
    var h = el('h2', sarlavha);
    oyna.appendChild(h);
    parda.addEventListener('click', function (e) { if (e.target === parda) yop(); });
    document.body.appendChild(parda);
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', tugmaBosildi, true);
    qur(oyna, yop);
    return { yop: yop, oyna: oyna };
  }

  // Nom + rang nuqtasi ko'rinishidagi ro'yxat
  function kategoriyaRoyxati(royxat) {
    var ul = el('ul', undefined, 'royxat');
    royxat.forEach(function (k) {
      var li = el('li');
      li.appendChild(kategBadge(k, 22));
      li.appendChild(document.createTextNode(' ' + k.nom));
      ul.appendChild(li);
    });
    return ul;
  }

  function kategoriyaOl(id) {
    return malumot.kategoriyalar.filter(function (k) { return k.id === id; })[0];
  }
  function hisobOl(id) {
    return malumot.hisoblar.filter(function (h) { return h.id === id; })[0];
  }
  function hisobNomi(id) {
    var h = hisobOl(id);
    return h ? h.nom : '';
  }
  function faolHisoblar() {
    return malumot.hisoblar.filter(function (h) { return !h.arxivlangan; });
  }

  // ---- Qisqa xabar (pastda), ixtiyoriy tugma bilan: masalan "Bekor qilish" ----
  var xabarEl = el('div', undefined, 'toast');
  xabarEl.setAttribute('role', 'status');
  xabarEl.hidden = true;
  document.body.appendChild(xabarEl);
  var xabarTaymeri = null;

  function xabarYashir() {
    clearTimeout(xabarTaymeri);
    xabarEl.hidden = true;
  }
  function qisqaXabar(matn, harakat, millisekund) {
    clearTimeout(xabarTaymeri);
    xabarEl.textContent = '';
    xabarEl.appendChild(el('span', matn));
    if (harakat) {
      xabarEl.appendChild(tugma(harakat.nom, 'toast-tugma', function () {
        xabarYashir();
        harakat.fn();
      }));
    }
    xabarEl.hidden = false;
    xabarTaymeri = setTimeout(xabarYashir, millisekund || 3000);
  }

  // ---- Summa maydoni: yozilgan sari mingliklar ajratiladi ----
  function summaMaydoni(id, belgiMatn, boshlangich) {
    var quti = el('div', undefined, 'maydon');
    var belgi = el('label', belgiMatn);
    belgi.setAttribute('for', id);
    var input = document.createElement('input');
    input.id = id;
    input.type = 'text';
    input.inputMode = 'numeric';
    input.autocomplete = 'off';
    input.placeholder = '0';
    input.className = 'summa-kiritish';
    input.value = boshlangich || '';
    var xato = el('div', undefined, 'xato-matn');
    quti.appendChild(belgi);
    quti.appendChild(input);
    quti.appendChild(xato);
    input.addEventListener('input', function () {
      var poz = input.selectionStart;
      var raqamgacha = input.value.slice(0, poz).replace(/\D/g, '').length;
      var f = Calc.raqamFormat(input.value);
      input.value = f;
      // kursorni yozilgan raqamdan keyin qoldiramiz
      var yangi = f.charAt(0) === '-' ? 1 : 0, sanoq = 0;
      if (raqamgacha > 0) {
        for (yangi = 0; yangi < f.length; yangi++) {
          if (/\d/.test(f.charAt(yangi))) sanoq++;
          if (sanoq === raqamgacha) { yangi++; break; }
        }
      }
      input.setSelectionRange(yangi, yangi);
      xato.textContent = '';
      input.classList.remove('xatoli');
    });
    return { quti: quti, input: input, xato: xato };
  }

  function orqagaTugmasi() {
    return tugma('← Orqaga', 'orqaga-tugma', orqaga);
  }

  // ---- Yozuv qatori va ro'yxatlar ----
  function yozuvQatori(y, hozirgi) {
    var otkazma = y.tur === 'otkazma';
    var k = kategoriyaOl(y.kategoriya_id);
    var q = tugma(undefined, 'yozuv', function () { ochish(function () { return tahrirShakli(y); }, true); });
    var chap = el('div', undefined, 'yozuv-chap');
    var nom = el('div', undefined, 'yozuv-nom');
    nom.appendChild(otkazma ? belgiDumi('almashuv', '#90a4ae', 26) : kategBadge(k, 26));
    nom.appendChild(document.createTextNode(otkazma ? 'O\'tkazma' : (k ? k.nom : 'Kategoriyasiz')));
    // Bazada oldindan qolgan, vaqti hozirdan keyingi yozuvlar belgilab ko'rsatiladi
    if (hozirgi && Calc.kelajakmi(y.sana, Calc.yozuvVaqti(y), hozirgi)) nom.appendChild(el('span', 'Kelajak', 'belgi-kelajak'));
    chap.appendChild(nom);
    var tafsilot = Calc.yozuvVaqti(y) + ' · ' + (otkazma
      ? hisobNomi(y.hisob_id) + ' → ' + hisobNomi(y.qabul_hisob_id)
      : hisobNomi(y.hisob_id));
    if (y.izoh) tafsilot += ' · ' + y.izoh;
    var izohQator = el('div', undefined, 'yozuv-izoh yozuv-hisob');
    var hb = hisobOl(y.hisob_id);
    if (hb) { var mini = hisobBadge(hb, 16); mini.classList.add('mini'); izohQator.appendChild(mini); }
    izohQator.appendChild(document.createTextNode(tafsilot));
    chap.appendChild(izohQator);
    q.appendChild(chap);
    if (otkazma) {
      q.appendChild(el('div', Calc.sumFormat(y.summa), 'yozuv-summa'));
    } else {
      var daromad = y.tur === 'daromad';
      q.appendChild(el('div', (daromad ? '+' : '−') + Calc.sumFormat(y.summa),
        'yozuv-summa ' + (daromad ? 'plus' : 'minus')));
    }
    return q;
  }

  // Kunlar bo'yicha guruhlangan ro'yxat; har kun sarlavhasida o'sha kunning jami xarajati
  function yozuvlarRoyxati(guruhlar) {
    var quti = document.createElement('div');
    var hozirgi = Calc.hozir();
    guruhlar.forEach(function (g) {
      var kun = karta();
      kun.classList.add('kun');
      var sarlavha = el('div', undefined, 'kun-sarlavha');
      sarlavha.appendChild(el('strong', Calc.sanaKorsat(g.sana)));
      sarlavha.appendChild(el('span', 'Xarajat: ' + Calc.sumFormat(g.xarajat)));
      kun.appendChild(sarlavha);
      g.yozuvlar.forEach(function (y) { kun.appendChild(yozuvQatori(y, hozirgi)); });
      quti.appendChild(kun);
    });
    return quti;
  }

  function bosYozuvlar() {
    var k = karta();
    k.appendChild(el('p', 'Hozircha yozuvlar yo\'q. Pastdagi + tugmasi bilan birinchi yozuvni qo\'shing.', 'xira'));
    return k;
  }

  // ---- Yozuvni tahrirlash: hamma maydon bitta ekranda (wizard emas). Sana va vaqt g'ildirak bilan tanlanadi ----
  function tahrirShakli(tahrir) {
    var holat = { tur: tahrir.tur, kategoriya: tahrir.kategoriya_id };
    var bloklar = [orqagaTugmasi(), el('h1', 'Yozuvni tahrirlash')];

    var forma = document.createElement('form');
    forma.noValidate = true;
    forma.className = 'karta';

    // Tur: xarajat / daromad / o'tkazma
    var turMaydon = el('div', undefined, 'maydon');
    turMaydon.appendChild(el('span', 'Tur', 'belgi'));
    var turQator = el('div', undefined, 'tanlov');
    var turTugmalari = {};
    ['xarajat', 'daromad', 'otkazma'].forEach(function (t) {
      turTugmalari[t] = tugma(TUR_NOMI[t], undefined, function () {
        holat.tur = t;
        holat.kategoriya = null;
        yangila();
      });
      turQator.appendChild(turTugmalari[t]);
    });
    turMaydon.appendChild(turQator);
    forma.appendChild(turMaydon);

    var summa = summaMaydoni('f-summa', 'Summa (so\'m)', Calc.raqamFormat(String(tahrir.summa)));
    forma.appendChild(summa.quti);

    // Kategoriya (o'tkazmada yo'q)
    var katMaydon = el('div', undefined, 'maydon');
    katMaydon.appendChild(el('span', 'Kategoriya', 'belgi'));
    var chiplar = el('div', undefined, 'chiplar');
    var katXato = el('div', undefined, 'xato-matn');
    katMaydon.appendChild(chiplar);
    katMaydon.appendChild(katXato);
    forma.appendChild(katMaydon);

    // Hisob. Arxivlangan bo'lsa ham yozuvning o'z hisobi ko'rinadi.
    var kerakli = [tahrir.hisob_id, tahrir.qabul_hisob_id];
    var variantlar = malumot.hisoblar.filter(function (h) {
      return !h.arxivlangan || kerakli.indexOf(h.id) !== -1;
    });
    function hisobTanlovi(id) {
      var s = document.createElement('select');
      s.id = id;
      variantlar.forEach(function (h) {
        var o = el('option', h.nom + (h.arxivlangan ? ' (arxiv)' : ''));
        o.value = h.id;
        s.appendChild(o);
      });
      return s;
    }
    var hisobMaydon = el('div', undefined, 'maydon');
    var hisobBelgi = el('label', 'Hisob');
    hisobBelgi.setAttribute('for', 'f-hisob');
    var hisob = hisobTanlovi('f-hisob');
    var hisobXato = el('div', undefined, 'xato-matn');
    hisobMaydon.appendChild(hisobBelgi);
    hisobMaydon.appendChild(hisob);
    hisobMaydon.appendChild(hisobXato);
    forma.appendChild(hisobMaydon);

    var qabulMaydon = el('div', undefined, 'maydon');
    var qabulBelgi = el('label', 'Qayerga');
    qabulBelgi.setAttribute('for', 'f-qabul');
    var qabul = hisobTanlovi('f-qabul');
    var qabulXato = el('div', undefined, 'xato-matn');
    qabulMaydon.appendChild(qabulBelgi);
    qabulMaydon.appendChild(qabul);
    qabulMaydon.appendChild(qabulXato);
    forma.appendChild(qabulMaydon);

    hisob.value = tahrir.hisob_id;
    if (tahrir.qabul_hisob_id) qabul.value = tahrir.qabul_hisob_id;
    else {
      // "Qayerga" uchun "Qayerdan" dan boshqa birinchi hisob
      var boshqa = variantlar.filter(function (h) { return h.id !== hisob.value; })[0];
      if (boshqa) qabul.value = boshqa.id;
    }

    // Sana va vaqt: bosilsa g'ildirakli tanlagich ochiladi. Hozirdan keyingi qiymatlar tanlanmaydi.
    var tanlangan = { sana: tahrir.sana, vaqt: Calc.yozuvVaqti(tahrir) };
    var vaqtMaydon = el('div', undefined, 'maydon');
    vaqtMaydon.appendChild(el('span', 'Sana va vaqt', 'belgi'));
    var vaqtTugma = tugma(undefined, 'vaqt-tugma', function () {
      Glidirak.ochish({
        sana: tanlangan.sana, vaqt: tanlangan.vaqt,
        tasdiq: function (sana, vaqt) { tanlangan = { sana: sana, vaqt: vaqt }; vaqtniKorsat(); }
      });
    });
    vaqtTugma.id = 'f-vaqt-tugma';
    var vaqtXato = el('div', undefined, 'xato-matn');
    vaqtMaydon.appendChild(vaqtTugma);
    vaqtMaydon.appendChild(vaqtXato);
    forma.appendChild(vaqtMaydon);
    function vaqtniKorsat() {
      vaqtTugma.textContent = Calc.sanaKorsat(tanlangan.sana) + ' · ' + tanlangan.vaqt;
      var r = Calc.vaqtTekshir(tanlangan.sana, tanlangan.vaqt, Calc.hozir());   // hozirgi vaqt har safar yangidan olinadi
      vaqtXato.textContent = r.xato || '';
      vaqtTugma.classList.toggle('xatoli', !!r.xato);
      return r;
    }
    vaqtniKorsat();
    if (Calc.kelajakmi(tanlangan.sana, tanlangan.vaqt, Calc.hozir())) {
      // shakl (forma) keyinroq qo'shiladi, shuning uchun bu ogohlantirish uning tepasida chiqadi
      bloklar.push(el('div', 'Bu yozuvning vaqti kelajakda. Saqlash uchun sana va soatni o\'tmishga to\'g\'rilang.', 'ogohlantirish'));
    }

    // Izoh (ixtiyoriy)
    var izohMaydon = el('div', undefined, 'maydon');
    var izohBelgi = el('label', 'Izoh (ixtiyoriy)');
    izohBelgi.setAttribute('for', 'f-izoh');
    var izoh = document.createElement('input');
    izoh.id = 'f-izoh';
    izoh.type = 'text';
    izoh.autocomplete = 'off';
    izoh.value = tahrir.izoh || '';
    izohMaydon.appendChild(izohBelgi);
    izohMaydon.appendChild(izoh);
    forma.appendChild(izohMaydon);

    var saqla = el('button', 'Saqlash', 'asosiy-tugma');
    saqla.type = 'submit';
    forma.appendChild(saqla);

    // Tanlangan turga qarab ko'rinadigan maydonlarni qayta chizadi
    function yangila() {
      var otkazma = holat.tur === 'otkazma';
      Object.keys(turTugmalari).forEach(function (t) {
        turTugmalari[t].setAttribute('aria-pressed', String(holat.tur === t));
      });
      katMaydon.hidden = otkazma;
      qabulMaydon.hidden = !otkazma;
      hisobBelgi.textContent = otkazma ? 'Qayerdan' : 'Hisob';
      hisobXato.textContent = '';
      qabulXato.textContent = '';
      chiplar.textContent = '';
      katXato.textContent = '';
      malumot.kategoriyalar.filter(function (k) {
        return k.tur === holat.tur && (!k.arxivlangan || k.id === holat.kategoriya);
      }).forEach(function (k) {
        var c = tugma(undefined, 'chip', function () {
          holat.kategoriya = k.id;
          katXato.textContent = '';
          Array.prototype.forEach.call(chiplar.children, function (x) { x.setAttribute('aria-pressed', 'false'); });
          c.setAttribute('aria-pressed', 'true');
        });
        c.appendChild(kategBadge(k, 22));
        c.appendChild(document.createTextNode(k.nom));
        c.setAttribute('aria-pressed', String(holat.kategoriya === k.id));
        chiplar.appendChild(c);
      });
    }
    yangila();

    forma.addEventListener('submit', function (e) {
      e.preventDefault();
      var otkazma = holat.tur === 'otkazma';
      var xatolik = false;
      var t = Calc.summaTekshir(summa.input.value);
      if (t.xato) {
        summa.xato.textContent = t.xato; summa.input.classList.add('xatoli'); xatolik = true;
      }
      if (!otkazma && !holat.kategoriya) { katXato.textContent = 'Kategoriyani tanlang'; xatolik = true; }
      if (vaqtniKorsat().xato) xatolik = true;   // saqlash paytida ham hozirgi vaqt qayta tekshiriladi
      if (!hisob.value) { hisobXato.textContent = 'Hisobni tanlang'; xatolik = true; }
      if (otkazma) {
        var ox = variantlar.length < 2
          ? 'O\'tkazma uchun kamida ikkita hisob kerak. "Yana" bo\'limida hisob qo\'shing'
          : Calc.otkazmaTekshir(hisob.value, qabul.value);
        if (ox) { qabulXato.textContent = ox; xatolik = true; }
      }
      if (xatolik) {
        var birinchi = forma.querySelector('.xatoli, .xato-matn:not(:empty)');
        if (birinchi) birinchi.scrollIntoView({ block: 'center' });
        if (t.xato) summa.input.focus();
        return;
      }
      var yozuv = {
        id: tahrir.id, yaratilgan: tahrir.yaratilgan,
        tur: holat.tur, summa: t.summa, sana: tanlangan.sana, vaqt: tanlangan.vaqt,
        hisob_id: hisob.value,
        kategoriya_id: otkazma ? null : holat.kategoriya,
        izoh: izoh.value.trim()
      };
      if (otkazma) yozuv.qabul_hisob_id = qabul.value;
      saqla.disabled = true;
      Data.saqlash('yozuvlar', yozuv).then(function () {
        malumot.yozuvlar = malumot.yozuvlar.map(function (x) { return x.id === yozuv.id ? yozuv : x; });
        qisqaXabar('Yozuv yangilandi');
        orqaga();
      }).catch(function (xato) {
        saqla.disabled = false;
        summa.xato.textContent = 'Saqlab bo\'lmadi: ' + xato;
      });
    });

    bloklar.push(forma);
    bloklar.push(tugma('O\'chirish', 'xavfli-tugma', function () { yozuvniOchirish(tahrir); }));
    return bloklar;
  }

  // ---- Yozuv qo'shish: 5 qadamli wizard ----
  // Qadamlar: 1 tur va summa, 2 kategoriya, 3 hisob, 4 sana va vaqt, 5 izoh va saqlash.
  // O'tkazmada 2 va 3 o'rniga "Qayerdan" va "Qayerga". Holat shakl yopilguncha (yoki saqlanguncha) saqlanadi.
  var wiz = null;
  var QADAM_SARLAVHASI = { summa: 'Yozuv qo\'shish', kategoriya: 'Kategoriya', hisob: 'Hisob', qayerdan: 'Qayerdan',
    qayerga: 'Qayerga', vaqt: 'Sana va vaqt', izoh: 'Izoh va saqlash' };

  function wizardYangi() {
    var faol = faolHisoblar(), oxirgi = Calc.oxirgiHisobId(malumot.yozuvlar);
    var hisob = faol.some(function (x) { return x.id === oxirgi; }) ? oxirgi : (faol[0] ? faol[0].id : '');
    var boshqa = faol.filter(function (x) { return x.id !== hisob; })[0];
    return Calc.wizardBoshlash(hisob, boshqa ? boshqa.id : '');
  }
  function wizardChiz() { chizish(wizardEkrani()); }
  function wizardKeyingi() { wiz = Calc.wizardKeyingi(wiz); wizardChiz(); }
  function wizardOrqaga() {
    var y = Calc.wizardOrqaga(wiz);
    if (y) { wiz = y; wizardChiz(); }
    else { wiz = null; korsat(qoshishOldingi || 'bosh'); }   // 1-qadamda "Orqaga" shaklni yopadi, tozalaydi va "+" bosilgan bo'limga qaytaradi
  }

  // Joriy qadamdagi xato (tezkor saqlash yoki ikkinchi himoya bergan) shu qadam tagida ko'rsatiladi
  function qadamXatosi(kalit) {
    return el('div', wiz.xato && wiz.xato.qadam === kalit ? wiz.xato.matn : undefined, 'xato-matn');
  }

  function summaQadami() {
    var forma = document.createElement('form');
    forma.noValidate = true;
    forma.className = 'karta';
    var turMaydon = el('div', undefined, 'maydon');
    turMaydon.appendChild(el('span', 'Tur', 'belgi'));
    var turQator = el('div', undefined, 'tanlov');
    var turTugmalari = {};
    ['xarajat', 'daromad', 'otkazma'].forEach(function (t) {
      turTugmalari[t] = tugma(TUR_NOMI[t], undefined, function () {
        wiz = Calc.wizardTurAlmashtir(wiz, t, faolHisoblar().map(function (x) { return x.id; }));
        Object.keys(turTugmalari).forEach(function (x) { turTugmalari[x].setAttribute('aria-pressed', String(x === wiz.tur)); });
        summa.input.focus();   // tur tanlangach summa kiritishga qaytiladi
      });
      turTugmalari[t].setAttribute('aria-pressed', String(wiz.tur === t));
      turQator.appendChild(turTugmalari[t]);
    });
    turMaydon.appendChild(turQator);
    forma.appendChild(turMaydon);

    var summa = summaMaydoni('w-summa', 'Summa (so\'m)', wiz.summa);
    summa.input.classList.add('summa-katta');
    summa.input.setAttribute('data-fokus', '1');
    summa.input.addEventListener('input', function () { wiz.summa = summa.input.value; });
    forma.appendChild(summa.quti);

    var davom = el('button', 'Davom etish ›', 'asosiy-tugma');
    davom.type = 'submit';
    forma.appendChild(davom);
    forma.addEventListener('submit', function (e) {
      e.preventDefault();
      var t = Calc.summaTekshir(summa.input.value);
      if (t.xato) { summa.xato.textContent = t.xato; summa.input.classList.add('xatoli'); summa.input.focus(); return; }
      wiz.summa = summa.input.value;
      wizardKeyingi();
    });
    return [forma];
  }

  // Kategoriya: rangli kataklar, bosilishi bilan keyingi qadamga o'tadi. Oxirgi ishlatilgani ajralib turadi.
  function kategoriyaQadami() {
    var royxat = malumot.kategoriyalar.filter(function (k) { return k.tur === wiz.tur && !k.arxivlangan; });
    var oxirgi = Calc.oxirgiKategoriyaId(malumot.yozuvlar, wiz.tur, royxat.map(function (k) { return k.id; }));
    var tur = el('div', undefined, 'katak-tur');
    royxat.forEach(function (k) {
      var b = tugma(undefined, 'katak', function () { wiz.kategoriya = k.id; wizardKeyingi(); });
      b.style.background = k.rang;
      b.style.color = Calc.matnRangi(k.rang);
      b.setAttribute('aria-pressed', String(wiz.kategoriya === k.id));
      b.appendChild(Belgilar.chiz(k.belgi || Calc.belgiTaxmin(k.nom, k.tur), 22));
      b.appendChild(el('span', k.nom, 'katak-nom'));
      if (k.id === oxirgi) { b.classList.add('oxirgi'); b.appendChild(el('span', '★ Oxirgi', 'katak-oxirgi')); }
      tur.appendChild(b);
    });
    // "+ Kategoriya qo'shish": ikki yo'lli oyna (standart yoki maxsus); qo'shilgach shu kategoriya tanlanib, keyingi qadamga o'tiladi
    var qosh = tugma(undefined, 'katak katak-qosh', function () {
      kategoriyaQoshishOynasi(wiz.tur, function (yangi) { wiz.kategoriya = yangi.id; wizardKeyingi(); });
    });
    qosh.id = 'kategoriya-qoshish';
    qosh.setAttribute('aria-label', 'Kategoriya qo\'shish');
    qosh.appendChild(svgBelgi('plus', 22));
    qosh.appendChild(el('span', 'Kategoriya qo\'shish', 'katak-nom'));
    tur.appendChild(qosh);
    return [tur, qadamXatosi('kategoriya')];
  }

  // Hisob (yoki o'tkazmada "Qayerdan" / "Qayerga"): nomi va qoldig'i bilan; bitta bosish bilan keyingi qadamga o'tadi
  function hisobQadami(kalit) {
    var maydon = kalit === 'qayerga' ? 'qabul' : 'hisob';
    var royxat = faolHisoblar().filter(function (h) { return kalit !== 'qayerga' || h.id !== wiz.hisob; });
    var quti = document.createElement('div');
    royxat.forEach(function (h) {
      var b = tugma(undefined, 'hisob-qator', function () {
        wiz[maydon] = h.id;
        if (kalit === 'qayerdan' && wiz.qabul === h.id) {   // "Qayerga" "Qayerdan" bilan bir xil bo'lib qolmasin
          var boshqa = faolHisoblar().filter(function (x) { return x.id !== h.id; })[0];
          wiz.qabul = boshqa ? boshqa.id : '';
        }
        wizardKeyingi();
      });
      b.setAttribute('aria-pressed', String(wiz[maydon] === h.id));
      b.appendChild(hisobBadge(h, 34));
      var chap = el('span', undefined, 'yozuv-chap');
      chap.appendChild(el('span', h.nom, 'yozuv-nom'));
      chap.appendChild(el('span', hisobTuriNomi(h.tur) + (Calc.hisobMaskasi(h) ? ' · ' + Calc.hisobMaskasi(h) : ''), 'yozuv-izoh hisob-turi'));
      b.appendChild(chap);
      b.appendChild(el('span', Calc.sumFormat(Calc.hisobQoldigi(h, malumot.yozuvlar, malumot.qarzlar)), 'yozuv-summa'));
      quti.appendChild(b);
    });
    if (!royxat.length) {
      quti.appendChild(el('p', 'O\'tkazma uchun kamida ikkita hisob kerak. "Ko\'proq" → Hisoblar bo\'limida hisob qo\'shing.', 'xira'));
    }
    return [quti, qadamXatosi(kalit)];
  }

  // Sana va vaqt: standart "Hozir"; bosilsa g'ildirakli tanlagich ochiladi
  function vaqtQadami() {
    var h = Calc.hozir(), korinadigan = wiz.vaqt || h;
    var b = tugma(undefined, 'vaqt-katta', function () {
      Glidirak.ochish({
        sana: korinadigan.sana, vaqt: korinadigan.vaqt,
        tasdiq: function (sana, vaqt) { wiz.vaqt = { sana: sana, vaqt: vaqt }; wiz.xato = null; wizardChiz(); }
      });
    });
    b.id = 'w-vaqt';
    b.appendChild(el('span', wiz.vaqt ? 'Tanlangan vaqt' : 'Hozir', 'vaqt-katta-nom'));
    b.appendChild(el('span', Calc.sanaKorsat(korinadigan.sana) + ' · ' + korinadigan.vaqt, 'vaqt-katta-qiymat'));
    b.appendChild(el('span', 'O\'zgartirish uchun bosing', 'xira'));
    var bloklar = [b, qadamXatosi('vaqt')];
    if (wiz.vaqt) {
      bloklar.push(tugma('Hozirga qaytarish', 'ikkinchi-tugma', function () { wiz.vaqt = null; wiz.xato = null; wizardChiz(); }));
    }
    var keyingi = tugma('Keyingi ›', 'asosiy-tugma', wizardKeyingi);
    keyingi.id = 'w-keyingi';
    bloklar.push(keyingi);
    return bloklar;
  }

  // Izoh va qisqa xulosa
  function izohQadami() {
    var h = Calc.hozir(), v = wiz.vaqt || h, otkazma = wiz.tur === 'otkazma';
    var k = karta();
    k.classList.add('xulosa');
    function qator(nom, qiymat, klass) {
      var q = el('div', undefined, 'qator');
      q.appendChild(el('span', nom, 'xira'));
      q.appendChild(el('strong', qiymat, klass));
      k.appendChild(q);
    }
    qator('Tur', TUR_NOMI[wiz.tur]);
    qator('Summa', Calc.sumFormat(Calc.summaTekshir(wiz.summa).summa || 0),
      wiz.tur === 'daromad' ? 'plus' : wiz.tur === 'xarajat' ? 'minus' : '');
    if (otkazma) {
      qator('Qayerdan', hisobNomi(wiz.hisob));
      qator('Qayerga', hisobNomi(wiz.qabul));
    } else {
      var kat = kategoriyaOl(wiz.kategoriya);
      qator('Kategoriya', kat ? kat.nom : '—');
      qator('Hisob', hisobNomi(wiz.hisob));
    }
    qator('Sana va vaqt', Calc.sanaKorsat(v.sana) + ' · ' + v.vaqt + (wiz.vaqt ? '' : ' (hozir)'));

    var forma = document.createElement('form');
    forma.noValidate = true;
    var maydon = el('div', undefined, 'maydon');
    var belgi = el('label', 'Izoh (ixtiyoriy)');
    belgi.setAttribute('for', 'w-izoh');
    var izoh = document.createElement('input');
    izoh.id = 'w-izoh';
    izoh.type = 'text';
    izoh.autocomplete = 'off';
    izoh.value = wiz.izoh;
    izoh.addEventListener('input', function () { wiz.izoh = izoh.value; });
    maydon.appendChild(belgi);
    maydon.appendChild(izoh);
    forma.appendChild(maydon);
    forma.addEventListener('submit', function (e) { e.preventDefault(); wizardSaqlash(); });   // klaviaturadagi "Enter" ham saqlaydi
    return [k, forma, qadamXatosi('izoh')];
  }

  // To'liq yoki tezkor saqlash: kiritilmagan qadamlar standart qiymat oladi (hisob — oxirgi ishlatilgani,
  // sana va vaqt — hozirgi). Tekshiruvlar avvalgidek, vaqt tekshiruvi esa saqlash paytidagi hozirgi vaqt bilan.
  function wizardSaqlash() {
    if (wiz.saqlanmoqda) return;
    var natija = wiz.tur === 'otkazma' && faolHisoblar().length < 2
      ? { xato: 'O\'tkazma uchun kamida ikkita hisob kerak. "Yana" bo\'limida hisob qo\'shing', qadam: 'qayerga' }
      : Calc.yozuvniTayyorlash(wiz, Calc.hozir());
    if (natija.xato) {
      // xato qaysi qadamga tegishli bo'lsa, o'sha qadamga qaytib, xabar ko'rsatiladi
      wiz.xato = { qadam: natija.qadam, matn: natija.xato };
      wiz.qadam = Calc.qadamlar(wiz.tur).indexOf(natija.qadam);
      wizardChiz();
      return;
    }
    var yozuv = Object.assign({ id: Data.yangiId(), yaratilgan: new Date().toISOString() }, natija.yozuv);
    wiz.saqlanmoqda = true;
    Data.saqlash('yozuvlar', yozuv).then(function () {
      malumot.yozuvlar.push(yozuv);
      xabar = 'Saqlandi: ' + (yozuv.tur === 'daromad' ? '+' : yozuv.tur === 'xarajat' ? '−' : '') +
        Calc.sumFormat(yozuv.summa);
      wiz = null;            // saqlangach shakl tozalanadi
      korsat('qoshish');     // balans va ro'yxat yangilanadi, yangi shakl 1-qadamdan boshlanadi
    }).catch(function (xato) {
      wiz.saqlanmoqda = false;
      qisqaXabar('Saqlab bo\'lmadi: ' + xato);
    });
  }

  function wizardEkrani() {
    if (!wiz) wiz = wizardYangi();
    var qadamlar = Calc.qadamlar(wiz.tur), kalit = qadamlar[wiz.qadam];
    var bloklar = [];

    var bosh = el('div', undefined, 'qadam-bosh');
    bosh.appendChild(tugma('← Orqaga', 'orqaga-tugma', wizardOrqaga));
    var korsatkich = el('span', (wiz.qadam + 1) + ' / ' + qadamlar.length, 'qadam-korsatkich');
    korsatkich.setAttribute('aria-label', (wiz.qadam + 1) + '-qadam, jami ' + qadamlar.length);
    bosh.appendChild(korsatkich);
    bloklar.push(bosh);
    var chiziq = el('div', undefined, 'qadam-chiziq');
    qadamlar.forEach(function (_, i) { chiziq.appendChild(el('span', undefined, i <= wiz.qadam ? 'tugagan' : '')); });
    bloklar.push(chiziq);

    bloklar.push(el('h1', QADAM_SARLAVHASI[kalit]));
    if (xabar && wiz.qadam === 0) { bloklar.push(el('div', xabar, 'xabar')); xabar = ''; }

    var tana = { summa: summaQadami, kategoriya: kategoriyaQadami, vaqt: vaqtQadami, izoh: izohQadami,
      hisob: function () { return hisobQadami('hisob'); }, qayerdan: function () { return hisobQadami('qayerdan'); },
      qayerga: function () { return hisobQadami('qayerga'); } }[kalit];
    tana().forEach(function (b) { bloklar.push(b); });

    // Tezkor yo'l: 2-qadamdan boshlab pastda "Saqlash" ko'rinib turadi
    if (wiz.qadam >= 1) {
      bloklar.push(el('div', undefined, 'qadam-joy'));
      var pastki = el('div', undefined, 'qadam-pastki');
      var saqla = tugma('Saqlash', 'asosiy-tugma', wizardSaqlash);
      saqla.id = 'w-saqlash';
      pastki.appendChild(saqla);
      bloklar.push(pastki);
    }
    return bloklar;
  }

  // O'chiradi va 10 soniya davomida "Bekor qilish" imkonini beradi
  function yozuvniOchirish(yozuv) {
    Data.ochirish('yozuvlar', yozuv.id).then(function () {
      malumot.yozuvlar = malumot.yozuvlar.filter(function (x) { return x.id !== yozuv.id; });
      orqaga();
      qisqaXabar('Yozuv o\'chirildi', { nom: 'Bekor qilish', fn: function () { yozuvniQaytarish(yozuv); } }, 10000);
    }).catch(function (xato) {
      qisqaXabar('O\'chirib bo\'lmadi: ' + xato);
    });
  }

  function yozuvniQaytarish(yozuv) {
    Data.saqlash('yozuvlar', yozuv).then(function () {
      malumot.yozuvlar.push(yozuv);
      qisqaXabar('Yozuv qaytarildi');
      yangilash();
    });
  }

  // ---- Hisoblar ----
  function hisobTuriNomi(tur) {
    var t = HISOB_TURI.filter(function (x) { return x[0] === tur; })[0];
    return t ? t[1] : tur;
  }

  var hisobFiltri = 'hammasi';   // Hisoblar ekrani: tur bo'yicha filtr yorlig'i
  var HISOB_TURI_IZOHI = {
    karta: 'Qo\'lda yuritiladigan karta hisobi',
    bank: 'Bank orqali yuritiladigan hisob',
    naqd: 'Qo\'ldagi yoki uydagi naqd pul',
    boshqa: 'Boshqa turdagi hisob'
  };

  function hisoblarEkrani() {
    var bloklar = [orqagaTugmasi(), el('h1', 'Hisoblar')];
    // tur bo'yicha filtr yorliqlari (yon tomonga suriladi)
    var yorliqlar = el('div', undefined, 'oy-yorliqlar hisob-yorliqlar');
    yorliqlar.setAttribute('role', 'tablist');
    yorliqlar.setAttribute('aria-label', 'Hisob turi');
    [['hammasi', 'Hammasi']].concat(HISOB_TURI).forEach(function (t) {
      var b = tugma(t[1], 'oy-yorliq', function () { hisobFiltri = t[0]; chizish(hisoblarEkrani(), true); });
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(hisobFiltri === t[0]));
      b.setAttribute('data-tur', t[0]);
      yorliqlar.appendChild(b);
    });
    bloklar.push(yorliqlar);
    var k = karta();
    var royxat = Calc.hisoblarniSuz(malumot.hisoblar, hisobFiltri);
    if (!royxat.length) k.appendChild(el('p', 'Bu turda hisob yo\'q.', 'xira'));
    royxat.forEach(function (h) {
      var q = tugma(undefined, 'yozuv hisob-qatori', function () { ochish(function () { return hisobShakli(h); }, true); });
      q.setAttribute('data-hisob', h.id);
      q.appendChild(hisobBadge(h, 38));
      var chap = el('div', undefined, 'yozuv-chap');
      chap.appendChild(el('div', h.nom, 'yozuv-nom'));
      var mask = Calc.hisobMaskasi(h);
      chap.appendChild(el('div', hisobTuriNomi(h.tur) + (mask ? ' · ' : ''), 'yozuv-izoh'));
      if (mask) chap.lastChild.appendChild(el('span', mask, 'hisob-maska'));
      q.appendChild(chap);
      q.appendChild(el('div', Calc.sumFormat(Calc.hisobQoldigi(h, malumot.yozuvlar, malumot.qarzlar)), 'yozuv-summa'));
      k.appendChild(q);
    });
    bloklar.push(k);
    var qosh = tugma('+ Hisob qo\'shish', 'ikkinchi-tugma', function () { hisobTuriOynasi(); });
    qosh.id = 'hisob-qoshish';
    bloklar.push(qosh);
    return bloklar;
  }

  // "+ Hisob": pastdan "Hisob turini tanlang" oynasi; tur tanlansa shu turdagi yangi hisob formasi ochiladi
  function hisobTuriOynasi() {
    pastkiOyna('Hisob turini tanlang', function (oyna, yop) {
      HISOB_TURI.forEach(function (t) {
        var b = tugma(undefined, 'tanlov-qator', function () {
          yop(false);
          ochish(function () { return hisobShakli(null, t[0]); }, true);
        });
        b.setAttribute('data-tur', t[0]);
        b.setAttribute('aria-label', t[1] + '. ' + HISOB_TURI_IZOHI[t[0]]);
        var rasm = el('span', undefined, 'tanlov-belgi');
        rasm.appendChild(Belgilar.chiz(Calc.HISOB_BELGISI[t[0]], 24));
        b.appendChild(rasm);
        var matn = el('span', undefined, 'tanlov-matn');
        matn.appendChild(el('strong', t[1]));
        matn.appendChild(el('span', HISOB_TURI_IZOHI[t[0]], 'xira'));
        b.appendChild(matn);
        var q = svgBelgi('keyingi', 20);
        q.classList.add('tanlov-keyingi');
        b.appendChild(q);
        oyna.appendChild(b);
      });
    });
  }

  // Yangi hisob (tur tanlangan: yangiTur) yoki mavjudini tahrirlash: nom, hozirgi qoldiq, rang, belgi (+ kartada oxirgi 4 raqam); arxivlash
  function hisobShakli(h, yangiTur) {
    var tur = h ? h.tur : (HISOB_TURI.some(function (x) { return x[0] === yangiTur; }) ? yangiTur : 'karta');
    var holat = { rang: h ? Calc.hisobRangiOl(h) : Calc.HISOB_RANGLARI[tur], belgi: h ? Calc.hisobBelgisiOl(h) : Calc.HISOB_BELGISI[tur], belgiQoldaTanlandi: true };
    var bloklar = [orqagaTugmasi(), el('h1', h ? 'Hisobni tahrirlash' : 'Yangi hisob')];
    var forma = document.createElement('form');
    forma.noValidate = true;
    forma.className = 'karta';

    var turQator = el('div', undefined, 'maydon');
    var turBelgi = el('div', undefined, 'hisob-turi-qator');
    turBelgi.appendChild(el('span', 'Turi: ', 'xira'));
    turBelgi.appendChild(el('strong', hisobTuriNomi(tur)));
    turQator.appendChild(turBelgi);
    forma.appendChild(turQator);

    var nomMaydon = el('div', undefined, 'maydon');
    var nomBelgi = el('label', 'Nomi');
    nomBelgi.setAttribute('for', 'h-nom');
    var nom = document.createElement('input');
    nom.id = 'h-nom';
    nom.type = 'text';
    nom.autocomplete = 'off';
    nom.value = h ? h.nom : '';
    var nomXato = el('div', undefined, 'xato-matn');
    nomMaydon.appendChild(nomBelgi);
    nomMaydon.appendChild(nom);
    nomMaydon.appendChild(nomXato);
    forma.appendChild(nomMaydon);
    nom.addEventListener('input', function () { nomXato.textContent = ''; nom.classList.remove('xatoli'); });

    // Joriy qoldiq ko'rsatiladi va tahrirlanadi; yozuvlar o'zgarmaydi (farq boshlang'ich qoldiqqa qo'shiladi)
    var qoldiq = summaMaydoni('h-qoldiq', 'Hozirgi qoldiq (so\'m)', h ? Calc.raqamFormat(String(Calc.hisobQoldigi(h, malumot.yozuvlar, malumot.qarzlar))) : '');
    forma.appendChild(qoldiq.quti);
    if (h) forma.appendChild(el('p', 'Qoldiqni to\'g\'rilasangiz, yozuvlar va hisobotlar o\'zgarmaydi.', 'xira'));

    // Faqat kartada: ixtiyoriy OXIRGI 4 raqam. To'liq karta raqami, amal qilish muddati va CVV so'ralmaydi va saqlanmaydi.
    var oxirgi4 = null, oxirgi4Xato = null;
    if (tur === 'karta') {
      var oM = el('div', undefined, 'maydon');
      var oB = el('label', 'Kartaning oxirgi 4 raqami (ixtiyoriy)');
      oB.setAttribute('for', 'h-oxirgi4');
      oxirgi4 = document.createElement('input');
      oxirgi4.id = 'h-oxirgi4';
      oxirgi4.type = 'text';
      oxirgi4.inputMode = 'numeric';
      oxirgi4.autocomplete = 'off';
      oxirgi4.placeholder = '1234';
      oxirgi4.value = h && h.oxirgi4 ? h.oxirgi4 : '';
      oxirgi4Xato = el('div', undefined, 'xato-matn');
      oM.appendChild(oB);
      oM.appendChild(oxirgi4);
      oM.appendChild(oxirgi4Xato);
      oM.appendChild(el('p', 'Faqat oxirgi 4 raqam saqlanadi ("•••• 1234" ko\'rinishida). To\'liq karta raqami, amal qilish muddati va CVV so\'ralmaydi va saqlanmaydi.', 'xira oxirgi4-izoh'));
      forma.appendChild(oM);
      oxirgi4.addEventListener('input', function () { oxirgi4Xato.textContent = ''; oxirgi4.classList.remove('xatoli'); });
    }

    var oniz = el('div', undefined, 'kq-oniz');
    function onizlash() {
      oniz.textContent = '';
      oniz.appendChild(belgiDumi(holat.belgi, holat.rang, 38));
      oniz.appendChild(el('strong', nom.value.trim() || 'Hisob nomi', 'kq-oniz-nom'));
    }
    holat.rangOzgarganda = onizlash;
    holat.belgiOzgarganda = onizlash;
    nom.addEventListener('input', onizlash);
    forma.appendChild(oniz);
    forma.appendChild(rangTanlagich(holat));
    forma.appendChild(belgiTanlagich(holat, ['hisob'], 'Belgi'));
    onizlash();

    var saqla = el('button', 'Saqlash', 'asosiy-tugma');
    saqla.type = 'submit';
    forma.appendChild(saqla);

    forma.addEventListener('submit', function (e) {
      e.preventDefault();
      var n = Calc.hisobNomTekshir(nom.value, faolHisoblar(), h ? h.id : undefined);
      var b = Calc.qoldiqTekshir(qoldiq.input.value, !!h);   // tahrirda manfiy mumkin, bo'sh qoldirib bo'lmaydi
      var o = oxirgi4 ? Calc.oxirgi4Tekshir(oxirgi4.value) : { oxirgi4: '' };
      if (n.xato) { nomXato.textContent = n.xato; nom.classList.add('xatoli'); }
      if (b.xato) { qoldiq.xato.textContent = b.xato; qoldiq.input.classList.add('xatoli'); }
      if (o.xato) { oxirgi4Xato.textContent = o.xato; oxirgi4.classList.add('xatoli'); }
      if (n.xato || b.xato || o.xato) { (n.xato ? nom : b.xato ? qoldiq.input : oxirgi4).focus(); return; }
      var yangi = h
        ? Object.assign({}, h, { nom: n.nom, rang: holat.rang, belgi: holat.belgi, oxirgi4: o.oxirgi4,
            boshlangich_qoldiq: Calc.yangiBoshlangichQoldiq(h, malumot.yozuvlar, b.summa, malumot.qarzlar) })
        : { id: Data.yangiId(), yaratilgan: new Date().toISOString(), nom: n.nom, tur: tur, belgi: holat.belgi, rang: holat.rang, oxirgi4: o.oxirgi4,
            boshlangich_qoldiq: b.summa, arxivlangan: false };
      saqla.disabled = true;
      hisobniSaqlash(yangi, h ? 'Hisob yangilandi' : 'Hisob qo\'shildi');
    });
    bloklar.push(forma);

    if (h) {
      bloklar.push(tugma('Arxivlash', 'xavfli-tugma', function () {
        if (faolHisoblar().length < 2) {
          qisqaXabar('Oxirgi hisobni arxivlab bo\'lmaydi');
          return;
        }
        var qoldigi = Calc.hisobQoldigi(h, malumot.yozuvlar, malumot.qarzlar);
        var bogliq = Calc.hisobgaBogliqQarzlar(malumot.qarzlar, h.id);
        var matn = '"' + h.nom + '" hisobi ro\'yxatdan yashiriladi, eski yozuvlari saqlanadi.' +
          (qoldigi !== 0 ? '\n\nUnda ' + Calc.sumFormat(qoldigi) + ' bor. Arxivlansa, umumiy balansga kirmaydi.' : '') +
          (bogliq.length ? '\n\n⚠ Bu hisobga ' + bogliq.length + ' ta hali yopilmagan qarz bog\'langan (' +
            bogliq.slice(0, 3).map(function (z) { return z.shaxs; }).join(', ') + (bogliq.length > 3 ? ' va boshqalar' : '') +
            '). Ular saqlanadi va ro\'yxatda arxiv belgisi bilan ko\'rinadi.' : '') +
          '\n\nArxivlansinmi?';
        if (!window.confirm(matn)) return;
        hisobniSaqlash(Object.assign({}, h, { arxivlangan: true }), 'Hisob arxivlandi');
      }));
    }
    return bloklar;
  }

  function hisobniSaqlash(hisob, xabarMatni) {
    Data.saqlash('hisoblar', hisob).then(function () {
      var bor = malumot.hisoblar.some(function (x) { return x.id === hisob.id; });
      malumot.hisoblar = bor
        ? malumot.hisoblar.map(function (x) { return x.id === hisob.id ? hisob : x; })
        : malumot.hisoblar.concat([hisob]);
      qisqaXabar(xabarMatni);
      orqaga();
    }).catch(function (xato) {
      qisqaXabar('Saqlab bo\'lmadi: ' + xato);
    });
  }

  // ---- Kategoriyalar ----
  // Rang tanlagich (tayyor ranglar). holat.rang o'zgaradi. Natija: element
  function rangTanlagich(holat, belgi) {
    var rangMaydon = el('div', undefined, 'maydon');
    rangMaydon.appendChild(el('span', belgi || 'Rang', 'belgi'));
    var ranglar = el('div', undefined, 'ranglar');
    var royxat = RANGLAR.indexOf(holat.rang) === -1 ? [holat.rang].concat(RANGLAR) : RANGLAR;
    royxat.forEach(function (r, i) {
      var b = tugma(undefined, 'rang-tugma', function () {
        holat.rang = r;
        Array.prototype.forEach.call(ranglar.children, function (x) { x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        if (holat.rangOzgarganda) holat.rangOzgarganda();
      });
      b.style.background = r;
      b.setAttribute('aria-label', 'Rang ' + (i + 1));
      b.setAttribute('aria-pressed', String(r === holat.rang));
      b.setAttribute('data-rang', r);
      ranglar.appendChild(b);
    });
    rangMaydon.appendChild(ranglar);
    return rangMaydon;
  }

  // Belgi tanlagich: tanlangan guruhlardagi hamma belgi (SVG), har biri 44 px, aria-label bilan. holat.belgi o'zgaradi.
  function belgiTanlagich(holat, guruhlar, belgi) {
    var quti = el('div', undefined, 'maydon');
    quti.appendChild(el('span', belgi || 'Belgi', 'belgi'));
    var tarmoq = el('div', undefined, 'belgi-tarmoq');
    tarmoq.setAttribute('role', 'listbox');
    Belgilar.royxat.filter(function (x) { return guruhlar.indexOf(x.guruh) !== -1; }).forEach(function (x) {
      var b = tugma(undefined, 'belgi-tanlov', function () {
        holat.belgi = x.kalit;
        holat.belgiQoldaTanlandi = true;
        Array.prototype.forEach.call(tarmoq.children, function (y) { y.setAttribute('aria-selected', 'false'); y.classList.remove('tanlangan'); });
        b.setAttribute('aria-selected', 'true');
        b.classList.add('tanlangan');
        if (holat.belgiOzgarganda) holat.belgiOzgarganda();
      });
      b.setAttribute('role', 'option');
      b.setAttribute('aria-label', x.nom);
      b.setAttribute('data-belgi', x.kalit);
      b.setAttribute('aria-selected', String(holat.belgi === x.kalit));
      if (holat.belgi === x.kalit) b.classList.add('tanlangan');
      b.appendChild(Belgilar.chiz(x.kalit, 22));
      tarmoq.appendChild(b);
    });
    quti.appendChild(tarmoq);
    holat.belgiTanlagich = tarmoq;
    return quti;
  }
  function belginiBelgila(holat, kalit) {   // dastur tomonidan (nom bo'yicha taxmin) tanlash
    holat.belgi = kalit;
    if (!holat.belgiTanlagich) return;
    Array.prototype.forEach.call(holat.belgiTanlagich.children, function (y) {
      var t = y.getAttribute('data-belgi') === kalit;
      y.setAttribute('aria-selected', String(t));
      y.classList.toggle('tanlangan', t);
    });
  }

  function kategoriyalarEkrani() {
    var bloklar = [orqagaTugmasi(), el('h1', 'Kategoriyalar')];
    [['xarajat', 'Xarajat kategoriyalari'], ['daromad', 'Daromad kategoriyalari']].forEach(function (t) {
      var k = karta();
      k.appendChild(el('h2', t[1]));
      malumot.kategoriyalar.filter(function (x) { return x.tur === t[0] && !x.arxivlangan; }).forEach(function (x) {
        var q = tugma(undefined, 'yozuv', function () { ochish(function () { return kategoriyaShakli(x); }, true); });
        q.setAttribute('data-kategoriya', x.id);
        var nom = el('div', undefined, 'yozuv-nom');
        nom.appendChild(kategBadge(x, 30));
        nom.appendChild(document.createTextNode(x.nom));
        q.appendChild(nom);
        k.appendChild(q);
      });
      bloklar.push(k);
    });
    var qosh = tugma('+ Kategoriya qo\'shish', 'ikkinchi-tugma', function () {
      kategoriyaQoshishOynasi('xarajat', function () { chizish(kategoriyalarEkrani(), true); });
    });
    qosh.id = 'kategoriya-qoshish-tugma';
    bloklar.push(qosh);
    return bloklar;
  }

  // Yangi kategoriya obyektini saqlaydi (xotira ham yangilanadi). Natija: Promise<kategoriya>
  function kategoriyaniQoshish(nom, tur, belgi, rang) {
    var kat = { id: Data.yangiId(), yaratilgan: new Date().toISOString(), nom: nom, tur: tur, rang: rang, belgi: belgi, arxivlangan: false };
    return Data.saqlash('kategoriyalar', kat).then(function () { malumot.kategoriyalar = malumot.kategoriyalar.concat([kat]); return kat; });
  }

  // "Kategoriya qo'shish" oynasi (pastdan): "Standart kategoriya" (tayyor ro'yxat) yoki "Maxsus kategoriya" (nom, rang, belgi).
  // qoshilgandan(kategoriya) — qo'shilgach chaqiriladi (oyna yopiladi)
  function kategoriyaQoshishOynasi(boshTur, qoshilgandan) {
    var holat = { rejim: 'standart', tur: boshTur === 'daromad' ? 'daromad' : 'xarajat', rang: RANGLAR[0], belgi: 'umumiy', belgiQoldaTanlandi: false };
    pastkiOyna('Kategoriya qo\'shish', function (oyna, yop) {
      var tana = el('div', undefined, 'kq-tana');
      function tugatish(kat) { yop(false); qisqaXabar('Kategoriya qo\'shildi'); if (qoshilgandan) qoshilgandan(kat); }
      function chiz() {
        tana.textContent = '';
        var rej = el('div', undefined, 'tanlov kq-rejim');
        [['standart', 'Standart kategoriya'], ['maxsus', 'Maxsus kategoriya']].forEach(function (r) {
          var b = tugma(r[1], undefined, function () { holat.rejim = r[0]; chiz(); });
          b.setAttribute('aria-pressed', String(holat.rejim === r[0]));
          b.id = 'kq-' + r[0];
          rej.appendChild(b);
        });
        tana.appendChild(rej);
        var turQator = el('div', undefined, 'yorliqlar kq-tur');
        turQator.setAttribute('role', 'tablist');
        [['xarajat', 'Xarajat'], ['daromad', 'Daromadlar']].forEach(function (t) {
          var b = tugma(t[1], 'yorliq', function () { holat.tur = t[0]; chiz(); });
          b.setAttribute('role', 'tab');
          b.setAttribute('aria-selected', String(holat.tur === t[0]));
          b.setAttribute('data-turi', t[0]);
          turQator.appendChild(b);
        });
        tana.appendChild(turQator);
        if (holat.rejim === 'standart') standartRoyxati(); else maxsusForma();
      }
      function standartRoyxati() {
        var royxat = el('div', undefined, 'kq-royxat');
        Calc.standartHolati(Belgilar.standart, malumot.kategoriyalar, holat.tur).forEach(function (x) {
          var q = el('div', undefined, 'kq-qator' + (x.bor ? ' bor' : ''));
          q.setAttribute('data-nom', x.nom);
          q.appendChild(belgiDumi(x.belgi, x.rang, 34));
          q.appendChild(el('span', x.nom, 'kq-nom'));
          if (x.bor) {
            q.appendChild(el('span', 'Qo\'shilgan', 'kq-bor'));
          } else {
            var b = tugma(undefined, 'kq-plus', function () {
              b.disabled = true;
              kategoriyaniQoshish(x.nom, x.tur, x.belgi, x.rang).then(tugatish).catch(function (e) { b.disabled = false; qisqaXabar('Saqlab bo\'lmadi: ' + e); });
            });
            b.setAttribute('aria-label', x.nom + ' kategoriyasini qo\'shish');
            b.appendChild(svgBelgi('plus', 22));
            q.appendChild(b);
          }
          royxat.appendChild(q);
        });
        tana.appendChild(royxat);
      }
      function maxsusForma() {
        var forma = el('div', undefined, 'kq-maxsus');
        var nomM = el('div', undefined, 'maydon');
        var nomB = el('label', 'Nomi');
        nomB.setAttribute('for', 'kq-nom');
        var nom = document.createElement('input');
        nom.id = 'kq-nom';
        nom.type = 'text';
        nom.autocomplete = 'off';
        nom.value = holat.nom || '';
        nomM.appendChild(nomB);
        nomM.appendChild(nom);
        var xato = el('div', undefined, 'xato-matn');
        xato.id = 'kq-xato';
        nomM.appendChild(xato);
        forma.appendChild(nomM);
        holat.rangOzgarganda = onizlash;
        forma.appendChild(rangTanlagich(holat));
        holat.belgiOzgarganda = onizlash;
        forma.appendChild(belgiTanlagich(holat, [holat.tur, 'umumiy'], 'Belgi'));
        var oniz = el('div', undefined, 'kq-oniz');
        forma.appendChild(oniz);
        var qosh = tugma('Qo\'shish', 'asosiy-tugma', function () {
          var n = tekshir();
          if (n.xato) return;
          qosh.disabled = true;
          kategoriyaniQoshish(n.nom, holat.tur, holat.belgi, holat.rang).then(tugatish).catch(function (e) { qosh.disabled = false; qisqaXabar('Saqlab bo\'lmadi: ' + e); });
        });
        qosh.id = 'kq-qosh';
        function tekshir() {
          return Calc.kategoriyaNomTekshir(nom.value, malumot.kategoriyalar.filter(function (x) { return x.tur === holat.tur && !x.arxivlangan; }));
        }
        function onizlash() {
          oniz.textContent = '';
          oniz.appendChild(belgiDumi(holat.belgi, holat.rang, 36));
          oniz.appendChild(el('strong', nom.value.trim() || 'Nomi', 'kq-oniz-nom'));
        }
        function yangila() {
          holat.nom = nom.value;
          if (!holat.belgiQoldaTanlandi) belginiBelgila(holat, Calc.belgiTaxmin(nom.value, holat.tur));   // nomga qarab taxmin (qo'lda tanlanmagan bo'lsa)
          var n = tekshir();
          xato.textContent = n.xato || '';
          qosh.disabled = !!n.xato;
          nom.classList.toggle('xatoli', !!n.xato && nom.value.trim() !== '');
          onizlash();
        }
        nom.addEventListener('input', yangila);
        forma.appendChild(qosh);
        tana.appendChild(forma);
        yangila();
      }
      oyna.appendChild(tana);
      chiz();
    }, 'kategoriya-oynasi');
  }

  // Mavjud kategoriyani tahrirlash: nom, rang, belgi; arxivlash
  function kategoriyaShakli(k) {
    var holat = { tur: k.tur, rang: k.rang, belgi: k.belgi || Calc.belgiTaxmin(k.nom, k.tur), belgiQoldaTanlandi: true };
    var bloklar = [orqagaTugmasi(), el('h1', 'Kategoriyani tahrirlash')];
    var forma = document.createElement('form');
    forma.noValidate = true;
    forma.className = 'karta';

    var t = el('div', undefined, 'maydon');
    t.appendChild(el('span', 'Turi: ' + (k.tur === 'daromad' ? 'daromad' : 'xarajat'), 'xira'));
    forma.appendChild(t);

    var nomMaydon = el('div', undefined, 'maydon');
    var nomBelgi = el('label', 'Nomi');
    nomBelgi.setAttribute('for', 'k-nom');
    var nom = document.createElement('input');
    nom.id = 'k-nom';
    nom.type = 'text';
    nom.autocomplete = 'off';
    nom.value = k.nom;
    var nomXato = el('div', undefined, 'xato-matn');
    nomMaydon.appendChild(nomBelgi);
    nomMaydon.appendChild(nom);
    nomMaydon.appendChild(nomXato);
    forma.appendChild(nomMaydon);
    nom.addEventListener('input', function () { nomXato.textContent = ''; nom.classList.remove('xatoli'); });

    forma.appendChild(rangTanlagich(holat));
    forma.appendChild(belgiTanlagich(holat, [k.tur, 'umumiy'], 'Belgi'));

    var saqla = el('button', 'Saqlash', 'asosiy-tugma');
    saqla.type = 'submit';
    forma.appendChild(saqla);

    forma.addEventListener('submit', function (e) {
      e.preventDefault();
      var n = Calc.kategoriyaNomTekshir(nom.value, malumot.kategoriyalar.filter(function (x) {
        return x.tur === holat.tur && !x.arxivlangan;
      }), k.id);
      if (n.xato) { nomXato.textContent = n.xato; nom.classList.add('xatoli'); nom.focus(); return; }
      saqla.disabled = true;
      kategoriyaniSaqlash({
        id: k.id, yaratilgan: k.yaratilgan, nom: n.nom, tur: holat.tur, rang: holat.rang, belgi: holat.belgi, arxivlangan: k.arxivlangan
      }, 'Kategoriya yangilandi');
    });
    bloklar.push(forma);

    bloklar.push(tugma('Arxivlash', 'xavfli-tugma', function () {
      var shuTurda = malumot.kategoriyalar.filter(function (x) { return x.tur === k.tur && !x.arxivlangan; });
      if (shuTurda.length < 2) {
        qisqaXabar('Bu turdagi oxirgi kategoriyani arxivlab bo\'lmaydi');
        return;
      }
      if (!window.confirm('"' + k.nom + '" kategoriyasi yangi yozuv shaklida ko\'rinmaydi, eski yozuvlari va hisobotlarda saqlanadi.\n\nArxivlansinmi?')) return;
      kategoriyaniSaqlash({ id: k.id, yaratilgan: k.yaratilgan, nom: k.nom, tur: k.tur, rang: k.rang, belgi: k.belgi, arxivlangan: true },
        'Kategoriya arxivlandi');
    }));
    return bloklar;
  }

  function kategoriyaniSaqlash(kat, xabarMatni) {
    Data.saqlash('kategoriyalar', kat).then(function () {
      var bor = malumot.kategoriyalar.some(function (x) { return x.id === kat.id; });
      malumot.kategoriyalar = bor
        ? malumot.kategoriyalar.map(function (x) { return x.id === kat.id ? kat : x; })
        : malumot.kategoriyalar.concat([kat]);
      qisqaXabar(xabarMatni);
      orqaga();
    }).catch(function (xato) {
      qisqaXabar('Saqlab bo\'lmadi: ' + xato);
    });
  }

  // ---- Barcha yozuvlar: filtr va qidiruv ----
  function tanlov(id, belgiMatn, variantlar, qiymat, ozgarganda) {
    var quti = el('div', undefined, 'maydon');
    var belgi = el('label', belgiMatn);
    belgi.setAttribute('for', id);
    var s = document.createElement('select');
    s.id = id;
    variantlar.forEach(function (v) {
      var o = el('option', v[1]);
      o.value = v[0];
      s.appendChild(o);
    });
    s.value = qiymat;
    s.addEventListener('change', function () { ozgarganda(s.value); });
    quti.appendChild(belgi);
    quti.appendChild(s);
    return { quti: quti, select: s };
  }

  function sanaTanlovi(id, belgiMatn, qiymat, ozgarganda) {
    var quti = el('div', undefined, 'maydon');
    var belgi = el('label', belgiMatn);
    belgi.setAttribute('for', id);
    var i = document.createElement('input');
    i.id = id;
    i.type = 'date';
    i.value = qiymat;
    i.addEventListener('change', function () { ozgarganda(i.value); });
    quti.appendChild(belgi);
    quti.appendChild(i);
    return quti;
  }

  var tarixFiltr = bosFiltr();   // Tarix bo'limining filtri va qidiruvi (ilova ochiq turguncha eslab qolinadi)
  var tarixOy = Calc.bugun().slice(0, 7);

  // Tarixdagi qarz amali qatori: qarz yoki to'lov. Hisobga ta'sir qiladi, lekin xarajat/daromadga kirmaydi ("Qarz" belgisi)
  function qarzSatri(x) {
    var berdim = x.yonalish === 'berdim', kirim = x.turi === 'qarz' ? !berdim : berdim;   // pul hisobga kirdimi
    var q = tugma(undefined, 'yozuv qarz-satr', function () { ochish(function () { return qarzEkrani(x.qarz_id); }, false); });
    q.setAttribute('data-turi', x.turi);
    var chap = el('div', undefined, 'yozuv-chap');
    var nom = el('div', undefined, 'yozuv-nom');
    nom.appendChild(belgiDumi('kredit', '#90a4ae', 26));
    nom.appendChild(document.createTextNode((x.turi === 'qarz' ? (berdim ? 'Qarz berdim' : 'Qarz oldim') : (berdim ? 'Qaytarildi' : 'Qaytardim')) + ' · ' + x.shaxs));
    nom.appendChild(el('span', 'Qarz', 'qarz-belgi-tarix'));
    chap.appendChild(nom);
    chap.appendChild(el('div', x.vaqt + ' · ' + hisobNomi(x.hisob_id) + (x.izoh ? ' · ' + x.izoh : ''), 'yozuv-izoh'));
    q.appendChild(chap);
    q.appendChild(el('div', (kirim ? '+' : '−') + Calc.sumFormat(x.summa), 'yozuv-summa ' + (kirim ? 'plus' : 'minus')));
    return q;
  }

  // Kunlar bo'yicha guruh: har kun jami (xarajat, daromad) faqat yozuvlardan
  function tarixRoyxati(guruhlar) {
    var quti = document.createElement('div'), hozirgi = Calc.hozir();
    guruhlar.forEach(function (g) {
      var kun = karta();
      kun.classList.add('kun');
      var sarlavha = el('div', undefined, 'kun-sarlavha');
      sarlavha.appendChild(el('strong', Calc.sanaKorsat(g.sana)));
      var jami = el('span', undefined, 'kun-jami');
      if (g.xarajat || !g.daromad) jami.appendChild(el('span', 'Xarajat: ' + Calc.sumFormat(g.xarajat)));
      if (g.daromad) jami.appendChild(el('span', (g.xarajat ? ' · ' : '') + 'Daromad: ' + Calc.sumFormat(g.daromad)));
      sarlavha.appendChild(jami);
      kun.appendChild(sarlavha);
      g.elementlar.forEach(function (e) { kun.appendChild(e.turi === 'yozuv' ? yozuvQatori(e.yozuv, hozirgi) : qarzSatri(e.satr)); });
      quti.appendChild(kun);
    });
    return quti;
  }

  // tarix=true: "Tarix" bo'limi (oy yorliqlari, oylik jami, qidiruv/F belgilari, qarz amallari ham); aks holda diagramma
  // bo'lagi bosilganda ochiladigan filtrlangan ro'yxat ("Barcha yozuvlar", ichki ekran)
  function yozuvlarEkrani(tarix) {
    var F = tarix ? tarixFiltr : filtr;
    var bloklar = tarix ? [] : [orqagaTugmasi(), el('h1', 'Barcha yozuvlar')];
    var chegara = YOZUVLAR_SAHIFASI;
    var bugun = Calc.bugun(), qSatrlar = tarix ? Calc.qarzSatrlari(malumot.qarzlar) : [];
    var oylar = tarix ? Calc.tarixOylari(malumot.yozuvlar.map(function (y) { return y.sana; }).concat(qSatrlar.map(function (x) { return x.sana; })), bugun) : [];
    if (tarix && oylar.indexOf(tarixOy) === -1) tarixOy = bugun.slice(0, 7);

    var qidiruvQuti = el('div', undefined, 'maydon');
    var tafsilot = document.createElement('details');
    if (tarix) {
      var tb = el('div', undefined, 'hisobot-bosh');
      tb.appendChild(el('h1', 'Tarix'));
      var bl = el('div', undefined, 'belgilar');
      var qT = belgiTugmasi('qidiruv', 'Qidirish', function () { qidiruvQuti.hidden = !qidiruvQuti.hidden; qT.setAttribute('aria-expanded', String(!qidiruvQuti.hidden)); if (!qidiruvQuti.hidden) qidiruv.focus(); }, 'qidiruv-tugma');
      var fT = belgiTugmasi('filtr', 'Filtr', function () { tafsilot.hidden = !tafsilot.hidden; fT.setAttribute('aria-expanded', String(!tafsilot.hidden)); if (!tafsilot.hidden) tafsilot.open = true; }, 'filtr-tugma');
      bl.appendChild(qT);
      bl.appendChild(fT);
      tb.appendChild(bl);
      bloklar.push(tb);
      // oy yorliqlari (yon tomonga suriladi, oxirgisi joriy oy)
      var yorliqlar = el('div', undefined, 'oy-yorliqlar');
      yorliqlar.setAttribute('role', 'tablist');
      yorliqlar.setAttribute('aria-label', 'Oylar');
      oylar.forEach(function (k) {
        var yil = k.slice(0, 4), oyNom = OY_QISQA[parseInt(k.slice(5, 7), 10) - 1];
        var t = tugma(oyNom + (yil !== bugun.slice(0, 4) ? ' ' + yil : ''), 'oy-yorliq', function () { tarixOy = k; chizish(yozuvlarEkrani(true), true); });
        t.setAttribute('role', 'tab');
        t.setAttribute('aria-selected', String(k === tarixOy));
        t.setAttribute('data-oy', k);
        yorliqlar.appendChild(t);
      });
      bloklar.push(yorliqlar);
      setTimeout(function () { var t = yorliqlar.querySelector('[aria-selected=true]'); if (t) yorliqlar.scrollLeft = Math.max(0, t.offsetLeft - yorliqlar.clientWidth / 2 + t.offsetWidth / 2); }, 0);
      // oylik jami: hisobot() bilan bir xil qoida (o'tkazma va qarz kirmaydi)
      var oj = Calc.oyJami(malumot.yozuvlar, tarixOy), jk = karta();
      jk.classList.add('tarix-jami');
      [['Balans', (oj.qoldiq > 0 ? '+' : '') + Calc.sumFormat(oj.qoldiq), oj.qoldiq < 0 ? 'minus' : '', 'tj-balans'], ['Xarajat', Calc.sumFormat(oj.xarajat), 'minus', 'tj-xarajat'], ['Daromad', Calc.sumFormat(oj.daromad), 'plus', 'tj-daromad']].forEach(function (x) {
        var c = el('div', undefined, 'tarix-jami-katak ' + x[3]);
        c.appendChild(el('div', x[0], 'xira'));
        c.appendChild(el('strong', x[1], x[2]));
        jk.appendChild(c);
      });
      bloklar.push(jk);
    }
    var qidiruv = document.createElement('input');
    qidiruv.type = 'search';
    qidiruv.id = 'q-izoh';
    qidiruv.placeholder = 'Izoh bo\'yicha qidirish';
    qidiruv.setAttribute('aria-label', 'Izoh bo\'yicha qidirish');
    qidiruv.autocomplete = 'off';
    qidiruv.value = F.qidiruv;
    qidiruvQuti.appendChild(qidiruv);
    if (tarix) qidiruvQuti.hidden = !F.qidiruv;
    bloklar.push(qidiruvQuti);

    tafsilot.className = 'karta filtr-quti';
    tafsilot.open = Calc.filtrFaolmi(F);
    if (tarix) tafsilot.hidden = !Calc.filtrFaolmi(F);
    tafsilot.appendChild(el('summary', 'Filtr'));

    var natija = el('div');
    var son = el('p', undefined, 'xira');
    var sanaXabar = el('div', undefined, 'xato-matn');
    var kategoriyaTanlovi = null;
    var guruhIzohi = el('p', undefined, 'xira guruh-izohi');
    guruhIzohi.setAttribute('data-guruh', '1');

    var GURUH = '__guruh';   // "Boshqalar" doirasidan kelgan bir nechta kategoriya
    function kategoriyaVariantlari() {
      var v = [['', 'Barchasi']];
      if (F.kategoriyalar.length) v.push([GURUH, 'Boshqalar (' + F.kategoriyalar.length + ' ta kategoriya)']);
      malumot.kategoriyalar.filter(function (k) { return !F.tur || k.tur === F.tur; }).forEach(function (k) {
        v.push([k.id, k.nom + (F.tur ? '' : ' · ' + (k.tur === 'daromad' ? 'daromad' : 'xarajat')) + (k.arxivlangan ? ' (arxiv)' : '')]);
      });
      return v;
    }
    function kategoriyaniYangila() {
      var s = kategoriyaTanlovi.select;
      s.textContent = '';
      kategoriyaVariantlari().forEach(function (v) { var o = el('option', v[1]); o.value = v[0]; s.appendChild(o); });
      s.value = F.kategoriyalar.length ? GURUH : F.kategoriya;
      s.disabled = F.tur === 'otkazma';
      guruhIzohi.hidden = !F.kategoriyalar.length;
      guruhIzohi.textContent = F.kategoriyalar.map(function (id) { var k = kategoriyaOl(id); return k ? k.nom : 'Kategoriyasiz'; }).join(', ');
    }

    var turT = tanlov('q-tur', 'Tur', [['', 'Barchasi'], ['xarajat', 'Xarajat'], ['daromad', 'Daromad'], ['otkazma', 'O\'tkazma']],
      F.tur, function (v) {
        F.tur = v;
        var k = kategoriyaOl(F.kategoriya);
        if (v === 'otkazma' || (k && v && k.tur !== v)) F.kategoriya = '';
        if (v && v !== 'xarajat') F.kategoriyalar = [];   // "Boshqalar" guruhi faqat xarajat kategoriyalaridan iborat
        kategoriyaniYangila();
        chiz();
      });
    var hisobT = tanlov('q-hisob', 'Hisob',
      [['', 'Barchasi']].concat(malumot.hisoblar.map(function (h) { return [h.id, h.nom + (h.arxivlangan ? ' (arxiv)' : '')]; })),
      F.hisob, function (v) { F.hisob = v; chiz(); });
    kategoriyaTanlovi = tanlov('q-kategoriya', 'Kategoriya', kategoriyaVariantlari(), F.kategoriyalar.length ? GURUH : F.kategoriya,
      function (v) {
        if (v === GURUH) return;
        F.kategoriyalar = [];   // bitta kategoriya tanlansa, "Boshqalar" guruhi o'chadi
        F.kategoriya = v;
        kategoriyaniYangila();
        chiz();
      });
    kategoriyaTanlovi.quti.appendChild(guruhIzohi);
    kategoriyaniYangila();
    tafsilot.appendChild(turT.quti);
    tafsilot.appendChild(hisobT.quti);
    tafsilot.appendChild(kategoriyaTanlovi.quti);
    if (!tarix) tafsilot.appendChild(sanaTanlovi('q-dan', 'Sanadan', F.dan, function (v) { F.dan = v; chiz(); }));
    if (!tarix) tafsilot.appendChild(sanaTanlovi('q-gacha', 'Sanagacha', F.gacha, function (v) { F.gacha = v; chiz(); }));
    tafsilot.appendChild(sanaXabar);
    tafsilot.appendChild(tugma('Filtrni tozalash', 'ikkinchi-tugma', function () {
      Object.assign(F, bosFiltr());
      chizish(yozuvlarEkrani(tarix));
    }));
    bloklar.push(tafsilot);
    bloklar.push(son);
    bloklar.push(natija);

    function chiz() {
      F.qidiruv = qidiruv.value;
      sanaXabar.textContent = F.dan && F.gacha && F.dan > F.gacha
        ? 'Boshlanish sanasi tugash sanasidan keyin bo\'lishi mumkin emas' : '';
      var r = Calc.yozuvlarniSuz(tarix ? malumot.yozuvlar.filter(function (y) { return y.sana.slice(0, 7) === tarixOy; }) : malumot.yozuvlar, F);
      natija.textContent = '';
      if (tarix) {
        var qs = Calc.qarzSatrlariniSuz(qSatrlar, F, tarixOy), jamiSon = r.length + qs.length;
        son.textContent = jamiSon + ' ta yozuv topildi';
        if (!jamiSon) {
          var bosT = karta();
          bosT.appendChild(el('p', Calc.filtrFaolmi(F) || F.qidiruv ? 'Shartlarga mos yozuv topilmadi.' : 'Bu oyda yozuvlar yo\'q.', 'xira'));
          natija.appendChild(bosT);
          return;
        }
        var gl = Calc.tarixGuruhlari(r, qs), kor = [], n = 0;
        for (var gi = 0; gi < gl.length && n < chegara; gi++) { kor.push(gl[gi]); n += gl[gi].elementlar.length; }
        natija.appendChild(tarixRoyxati(kor));
        if (n < jamiSon) {
          natija.appendChild(tugma('Yana ko\'rsatish (' + (jamiSon - n) + ' ta qoldi)', 'ikkinchi-tugma', function () { chegara += YOZUVLAR_SAHIFASI; chiz(); }));
        }
        return;
      }
      son.textContent = r.length + ' ta yozuv topildi';
      if (r.length === 0) {
        var bos = karta();
        bos.appendChild(el('p', malumot.yozuvlar.length ? 'Shartlarga mos yozuv topilmadi.' : 'Hozircha yozuvlar yo\'q.', 'xira'));
        natija.appendChild(bos);
        return;
      }
      // butun kunlar bilan kesamiz, shunda kun sarlavhasidagi jami xarajat to'liq bo'ladi
      var guruhlar = Calc.kunlarBoyicha(r), korsatiladi = [], sana = 0;
      for (var i = 0; i < guruhlar.length && sana < chegara; i++) {
        korsatiladi.push(guruhlar[i]);
        sana += guruhlar[i].yozuvlar.length;
      }
      natija.appendChild(yozuvlarRoyxati(korsatiladi));
      if (sana < r.length) {
        natija.appendChild(tugma('Yana ko\'rsatish (' + (r.length - sana) + ' ta qoldi)', 'ikkinchi-tugma', function () {
          chegara += YOZUVLAR_SAHIFASI;
          chiz();
        }));
      }
    }

    var kechikish = null;
    qidiruv.addEventListener('input', function () {
      clearTimeout(kechikish);
      kechikish = setTimeout(chiz, 200);
    });
    chiz();
    return bloklar;
  }

  // ---- "Ko'proq" bo'limi: Hisobot, Byudjet, Hisoblar, Kategoriyalar, Zaxira va eksport, versiya ----
  function koproqMenyusi() {
    var bloklar = [el('h1', 'Ko\'proq')];
    var k = karta();
    [
      ['kp-hisobot', 'Hisobot', 'davr, taqqoslash, diagrammalar', hisobotEkrani],
      ['kp-byudjet', 'Byudjet', 'oylik chegaralar', byudjetEkrani],
      ['kp-hisoblar', 'Hisoblar', faolHisoblar().length + ' ta', hisoblarEkrani],
      ['kp-kategoriyalar', 'Kategoriyalar', malumot.kategoriyalar.filter(function (x) { return !x.arxivlangan; }).length + ' ta', kategoriyalarEkrani],
      ['kp-zaxira', 'Zaxira va eksport', malumot.zaxiraSanasi ? 'oxirgi: ' + Calc.sanaKorsat(malumot.zaxiraSanasi) : 'zaxira yo\'q', zaxiraEkrani]
    ].forEach(function (m) {
      var q = tugma(undefined, 'yozuv', function () { ochish(m[3], false); });
      q.id = m[0];
      q.appendChild(el('div', m[1], 'yozuv-nom'));
      q.appendChild(el('div', m[2] + ' ›', 'yozuv-izoh'));
      k.appendChild(q);
    });
    bloklar.push(k);
    bloklar.push(el('p', 'Moliya · versiya ' + VERSIYA, 'versiya'));
    return bloklar;
  }

  // ---- Hisobot ----
  var DAVR_TURLARI = [['kun', 'Kun'], ['hafta', 'Hafta'], ['oy', 'Oy'], ['yil', 'Yil']];
  var OY_QISQA = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];

  // Doira yoki ustunli diagramma tanlovi qurilmada eslab qolinadi (xotira ishlamasa, doira)
  function korinishniOl() {
    try { return localStorage.getItem('moliya-hisobot-korinish') === 'ustun' ? 'ustun' : 'dona'; } catch (e) { return 'dona'; }
  }
  function korinishniSaqla(k) {
    try { localStorage.setItem('moliya-hisobot-korinish', k); } catch (e) { /* ahamiyatsiz */ }
  }

  // Kichik SVG belgilar (kutubxonasiz): ustunlar, doira, filtr
  var BELGILAR = {
    ustun: [['rect', { x: 4, y: 12, width: 4, height: 8, rx: 1 }], ['rect', { x: 10, y: 4, width: 4, height: 16, rx: 1 }], ['rect', { x: 16, y: 9, width: 4, height: 11, rx: 1 }]],
    dona: [['circle', { cx: 12, cy: 12, r: 7.5, fill: 'none', stroke: 'currentColor', 'stroke-width': 4, 'stroke-dasharray': '13.2 2.5', 'stroke-dashoffset': 6.6 }]],
    filtr: [['path', { d: 'M3 5h18l-7 8.5V20l-4-2v-4.5L3 5z', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linejoin': 'round' }]],
    almashuv: [['path', { d: 'M7 7h11l-3-3M17 17H6l3 3', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }]],
    qarz: [['circle', { cx: 12, cy: 12, r: 8.5, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }], ['path', { d: 'M9 12.5l2.2 2.2L15.5 9.5', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }]],
    keyingi: [['path', { d: 'M9 5l7 7-7 7', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }]],
    koz: [['path', { d: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linejoin': 'round' }], ['circle', { cx: 12, cy: 12, r: 3, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }]],
    kozYopiq: [['path', { d: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linejoin': 'round' }], ['path', { d: 'M4 4l16 16', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2, 'stroke-linecap': 'round' }]],
    qidiruv: [['circle', { cx: 11, cy: 11, r: 6, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }], ['path', { d: 'M16 16l4 4', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2, 'stroke-linecap': 'round' }]],
    arxiv: [['path', { d: 'M4 7h16v4H4zM6 11v8h12v-8M10 14h4', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }]],
    chiqim: [['path', { d: 'M7 17L17 7M9 7h8v8', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }]],
    kirim: [['path', { d: 'M17 7L7 17M15 17H7V9', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }]],
    minus: [['path', { d: 'M5 12h14', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-linecap': 'round' }]],
    plus: [['path', { d: 'M12 5v14M5 12h14', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-linecap': 'round' }]],
    yopish: [['path', { d: 'M6 6l12 12M18 6L6 18', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2, 'stroke-linecap': 'round' }]]
  };
  function svgBelgi(nom, olcham) {
    var NS = 'http://www.w3.org/2000/svg', s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('width', String(olcham || 22));
    s.setAttribute('height', String(olcham || 22));
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    BELGILAR[nom].forEach(function (x) {
      var e = document.createElementNS(NS, x[0]);
      Object.keys(x[1]).forEach(function (k) { e.setAttribute(k, x[1][k]); });
      if (x[0] === 'rect') e.setAttribute('fill', 'currentColor');
      s.appendChild(e);
    });
    return s;
  }
  function belgiTugmasi(nom, ariya, bosilganda, klass) {
    var b = tugma(undefined, 'belgi-tugma' + (klass ? ' ' + klass : ''), bosilganda);
    b.setAttribute('aria-label', ariya);
    b.appendChild(svgBelgi(nom));
    return b;
  }

  // Diagramma bo'lagi bosilganda: shu kategoriya yoki kunning yozuvlari filtrlangan ro'yxat sifatida ochiladi ("Orqaga" hisobotga qaytaradi)
  function yozuvlarniOchish(f) {
    filtr = Object.assign(bosFiltr(), f);
    ochish(yozuvlarEkrani, false);
  }

  // Doira va ro'yxat: tanlangan tur (xarajat yoki daromad) bo'yicha
  function donaKartasi(turi, joriyH, davr, hisob) {
    var xarajat = turi === 'xarajat', nom = xarajat ? 'Xarajatlar' : 'Daromadlar';
    var k = karta();
    k.classList.add('diagramma-karta');
    k.appendChild(el('h2', nom + ' kategoriyalar bo\'yicha'));
    var taqsimot = xarajat ? joriyH.xarajatTaqsimoti : joriyH.daromadTaqsimoti;
    if (!taqsimot.length) {
      k.appendChild(el('p', 'Bu davrda ' + (xarajat ? 'xarajat' : 'daromad') + ' yo\'q.', 'xira'));
      return k;
    }
    k.appendChild(Diagramma.dona({
      taqsimot: taqsimot, jami: xarajat ? joriyH.xarajat : joriyH.daromad, kategoriya: kategoriyaOl,
      turNomi: nom, markazNom: davr.nom,
      bosilganda: function (id) { yozuvlarniOchish({ tur: turi, kategoriya: id, dan: davr.dan, gacha: davr.gacha, hisob: hisob }); },
      // "Boshqalar": birlashgan kategoriyalar filtrlangan ro'yxat sifatida ochiladi
      guruhBosilganda: function (idlar) { yozuvlarniOchish({ tur: turi, kategoriyalar: idlar, dan: davr.dan, gacha: davr.gacha, hisob: hisob }); }
    }));
    return k;
  }

  // Vaqt bo'yicha ustunlar: hafta va oyda kunlar, yilda oylar, erkin davrda kunlar/haftalar/oylar (kun davrida yo'q)
  function vaqtDiagrammasi(h, davr) {
    var v = h.tur === 'davr' ? Calc.diagrammaOraliq(malumot.yozuvlar, davr.dan, davr.gacha, h.hisob)
      : Calc.diagrammaVaqt(malumot.yozuvlar, h.tur, h.sana, h.hisob);
    if (!v) return null;
    var k = karta();
    k.classList.add('diagramma-karta');
    k.appendChild(el('h2', 'Daromad va xarajat: ' + (v.birlikNomi || (h.tur === 'yil' ? 'oylar' : 'kunlar')) + ' bo\'yicha'));
    k.appendChild(Diagramma.ustunli({
      vaqt: v,
      bosilganda: function (b) { yozuvlarniOchish({ dan: b.dan, gacha: b.gacha, hisob: h.hisob }); }
    }));
    return k;
  }

  // ---- Filtr oynasi (pastdan chiqadi): chastota (Oylik / Yillik / Davr), qo'shimcha: hisob ----
  function filtrOynasi(qayta) {
    var h = hisobotHolat, bugun = Calc.bugun(), bp = bugun.split('-'), buYil = parseInt(bp[0], 10), buOy = parseInt(bp[1], 10);
    var oldingiFokus = document.activeElement, oldingiOverflow = document.body.style.overflow;
    var birinchi = malumot.yozuvlar.reduce(function (a, y) { return !a || y.sana < a ? y.sana : a; }, '');
    var yillar = Calc.filtrYillari(birinchi, bugun);

    // Qoralama: "Amalga oshirish" bosilguncha hisobotga tegmaydi
    function qoralama() {
      var q = { chastota: null, yil: buYil, oy: buOy, dan: '', gacha: '', hisob: h.hisob };
      var c = Calc.hisobotDavri(h.tur, h.sana || bugun, h.dan, h.gacha), p = c.dan.split('-');
      if (h.tur === 'oy' || h.tur === 'yil') q.chastota = h.tur;
      if (h.tur === 'davr') q.chastota = 'davr';
      if (h.tur !== 'davr') { q.yil = parseInt(p[0], 10); q.oy = parseInt(p[1], 10); }
      q.dan = c.dan > bugun ? bugun : c.dan;
      q.gacha = c.gacha > bugun ? bugun : c.gacha;
      return q;
    }
    var q = qoralama();

    var parda = el('div', undefined, 'sheet-parda');
    var oyna = el('div', undefined, 'sheet');
    oyna.setAttribute('role', 'dialog');
    oyna.setAttribute('aria-modal', 'true');
    oyna.setAttribute('aria-label', 'Filtrlar');
    oyna.tabIndex = -1;
    parda.appendChild(oyna);

    function yop() {
      document.removeEventListener('keydown', tugmaBosildi, true);
      if (parda.parentNode) parda.parentNode.removeChild(parda);
      document.body.style.overflow = oldingiOverflow;
      if (oldingiFokus && oldingiFokus.focus && oldingiFokus.isConnected) oldingiFokus.focus();
    }
    function tugmaBosildi(e) {
      if (document.querySelector('.g-parda')) return;   // g'ildirakli tanlagich ochiq: u o'zi boshqaradi
      if (e.key === 'Escape') { e.preventDefault(); yop(); return; }
      if (e.key !== 'Tab') return;
      var f = Array.prototype.slice.call(oyna.querySelectorAll('button:not([disabled]), select, summary'));
      var i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }

    function katakTarmogi(belgi, elementlar, tanlangan, tanlanganda) {
      var quti = el('div', undefined, 'maydon');
      quti.appendChild(el('span', belgi, 'belgi'));
      var t = el('div', undefined, 'filtr-tarmoq');
      elementlar.forEach(function (x) {
        var b = tugma(x.matn, 'filtr-katak', function () { if (x.ochiq) tanlanganda(x.qiymat); });
        b.setAttribute('aria-pressed', String(x.qiymat === tanlangan));
        if (!x.ochiq) { b.disabled = true; b.classList.add('kulrang'); b.title = 'Kelajak: tanlab bo\'lmaydi'; }
        t.appendChild(b);
      });
      quti.appendChild(t);
      return quti;
    }

    function chiz() {
      var fokus = document.activeElement && document.activeElement.getAttribute ? document.activeElement.getAttribute('data-f') : null;
      oyna.textContent = '';
      var bosh = el('div', undefined, 'sheet-bosh');
      bosh.appendChild(el('h2', 'Filtrlar'));
      bosh.appendChild(tugma('Tozalash', 'matn-tugma', function () {
        q = { chastota: 'oy', yil: buYil, oy: buOy, dan: q.dan, gacha: q.gacha, hisob: '' };
        chiz();
      }));
      var yopTugma = belgiTugmasi('yopish', 'Yopish', yop);
      yopTugma.setAttribute('data-f', 'yop');
      bosh.appendChild(yopTugma);
      oyna.appendChild(bosh);

      // Chastota
      var cm = el('div', undefined, 'maydon');
      cm.appendChild(el('span', 'Chastota', 'belgi'));
      var cq = el('div', undefined, 'tanlov');
      [['oy', 'Oylik'], ['yil', 'Yillik'], ['davr', 'Davr']].forEach(function (c) {
        var b = tugma(c[1], undefined, function () {
          q.chastota = c[0];
          if (c[0] === 'oy' && q.yil === buYil && q.oy > buOy) q.oy = buOy;
          chiz();
        });
        b.setAttribute('aria-pressed', String(q.chastota === c[0]));
        b.setAttribute('data-f', 'c-' + c[0]);
        cq.appendChild(b);
      });
      cm.appendChild(cq);
      oyna.appendChild(cm);
      if (!q.chastota) oyna.appendChild(el('p', 'Hozir: ' + Calc.hisobotDavri(h.tur, h.sana || bugun, h.dan, h.gacha).nom + '. Chastotani tanlasangiz, davr o\'zgaradi.', 'xira'));

      var yilElementlari = yillar.map(function (y) { return { qiymat: y, matn: String(y), ochiq: true }; });
      if (q.chastota === 'oy' || q.chastota === 'yil') {
        oyna.appendChild(katakTarmogi('Yil', yilElementlari, q.yil, function (y) {
          q.yil = y;
          if (q.chastota === 'oy' && y === buYil && q.oy > buOy) q.oy = buOy;
          chiz();
        }));
      }
      if (q.chastota === 'oy') {
        oyna.appendChild(katakTarmogi('Oy', Calc.filtrOylari(q.yil, bugun).map(function (x) { return { qiymat: x.oy, matn: OY_QISQA[x.oy - 1], ochiq: x.ochiq }; }),
          q.oy, function (m) { q.oy = m; chiz(); }));
      }
      if (q.chastota === 'davr') {
        var xatoEl = el('div', undefined, 'xato-matn');
        xatoEl.setAttribute('role', 'alert');
        [['dan', 'Boshlanish sanasi'], ['gacha', 'Tugash sanasi']].forEach(function (x) {
          var m = el('div', undefined, 'maydon');
          m.appendChild(el('span', x[1], 'belgi'));
          var t = tugma(Calc.sanaKorsat(q[x[0]]), 'vaqt-tugma', function () {
            Glidirak.ochish({
              faqatSana: true, sarlavha: x[1], sana: q[x[0]], katta: bugun, kichik: x[0] === 'gacha' ? q.dan : undefined,
              tasdiq: function (sana) {
                q[x[0]] = sana;
                if (x[0] === 'dan' && q.gacha < sana) q.gacha = sana;
                chiz();
              }
            });
          });
          t.id = 'fd-' + x[0];
          t.setAttribute('data-f', 'd-' + x[0]);
          m.appendChild(t);
          oyna.appendChild(m);
        });
        var natija = Calc.oraliqTekshir(q.dan, q.gacha, bugun);
        if (natija.xato) xatoEl.textContent = natija.xato;
        else oyna.appendChild(el('p', natija.soni + ' kun', 'xira davr-kunlari'));
        oyna.appendChild(xatoEl);
      }

      // Qo'shimcha variantlar (yig'iladigan blok): hisobni tanlash
      var det = document.createElement('details');
      det.className = 'filtr-quti qoshimcha-quti';
      det.open = !!q.hisob;
      det.appendChild(el('summary', 'Qo\'shimcha variantlar'));
      var hisobT = tanlov('fl-hisob', 'Hisob',
        [['', 'Barcha hisoblar']].concat(malumot.hisoblar.map(function (x) { return [x.id, x.nom + (x.arxivlangan ? ' (arxiv)' : '')]; })),
        q.hisob, function (v) { q.hisob = v; });
      det.appendChild(hisobT.quti);
      oyna.appendChild(det);

      var xatoUmumiy = el('div', undefined, 'xato-matn');
      oyna.appendChild(xatoUmumiy);
      var qollash = tugma('Amalga oshirish', 'asosiy-tugma', function () {
        var r = q.chastota ? Calc.filtrQollash(q, bugun) : {};
        if (r.xato) { xatoUmumiy.textContent = r.xato; return; }
        h.hisob = q.hisob;
        if (r.tur) {
          h.tur = r.tur;
          if (r.sana) h.sana = r.sana;
          if (r.tur === 'davr') { h.dan = r.dan; h.gacha = r.gacha; }
        }
        yop();
        qayta();
      });
      qollash.setAttribute('data-f', 'qollash');
      if (q.chastota === 'davr' && Calc.oraliqTekshir(q.dan, q.gacha, bugun).xato) qollash.disabled = true;
      oyna.appendChild(qollash);

      if (fokus) { var f = oyna.querySelector('[data-f="' + fokus + '"]'); if (f && !f.disabled) f.focus(); }
    }

    parda.addEventListener('click', function (e) { if (e.target === parda) yop(); });
    document.body.appendChild(parda);
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', tugmaBosildi, true);
    chiz();
    oyna.focus();
  }

  function hisobotEkrani() {
    var h = hisobotHolat;
    if (!h.sana) h.sana = Calc.bugun();
    var bloklar = [orqagaTugmasi()];   // Hisobot — ichki ekran (Asosiy yoki Ko'proq dan ochiladi)
    function qayta() { chizish(hisobotEkrani(), true); }
    var korinish = h.tur === 'kun' ? 'dona' : h.korinish;   // kun davrida ustunli diagramma yo'q

    // Sarlavha va o'ngdagi ikki belgi: diagramma turini almashtirish va filtr
    var bosh = el('div', undefined, 'hisobot-bosh');
    bosh.appendChild(el('h1', 'Hisobot'));
    var belgilar = el('div', undefined, 'belgilar');
    if (h.tur !== 'kun') {
      var d = belgiTugmasi(korinish === 'dona' ? 'ustun' : 'dona',
        korinish === 'dona' ? 'Ustunli diagrammaga o\'tish' : 'Doira diagrammasiga qaytish', function () {
          h.korinish = korinish === 'dona' ? 'ustun' : 'dona';
          korinishniSaqla(h.korinish);
          qayta();
        }, 'korinish-tugma');
      d.setAttribute('data-korinish', korinish);
      belgilar.appendChild(d);
    }
    belgilar.appendChild(belgiTugmasi('filtr', 'Filtrlar', function () { filtrOynasi(qayta); }, 'filtr-tugma'));
    bosh.appendChild(belgilar);
    bloklar.push(bosh);

    // Xarajat / Daromadlar yorliqlari
    var yorliqlar = el('div', undefined, 'yorliqlar');
    yorliqlar.setAttribute('role', 'tablist');
    [['xarajat', 'Xarajat'], ['daromad', 'Daromadlar']].forEach(function (t) {
      var b = tugma(t[1], 'yorliq', function () { h.turi = t[0]; qayta(); });
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(h.turi === t[0]));
      b.setAttribute('data-turi', t[0]);
      yorliqlar.appendChild(b);
    });
    bloklar.push(yorliqlar);

    // Tezkor yo'l: Kun / Hafta / Oy / Yil (filtr oynasi bilan bir xil holat); "Davr" tanlansa hech biri tanlanmagan bo'ladi
    var turQator = el('div', undefined, 'tanlov');
    DAVR_TURLARI.forEach(function (t) {
      var b = tugma(t[1], undefined, function () {
        if (h.tur === 'davr') h.sana = h.gacha;
        h.tur = t[0];
        qayta();
      });
      b.setAttribute('aria-pressed', String(h.tur === t[0]));
      turQator.appendChild(b);
    });
    var turMaydon = el('div', undefined, 'maydon');
    turMaydon.appendChild(turQator);
    bloklar.push(turMaydon);

    // Oldingi / bugun / keyingi (erkin davrda — davr uzunligiga qadam bilan; kelajakka chiqmaydi)
    var davr = Calc.hisobotDavri(h.tur, h.sana, h.dan, h.gacha), bugun = Calc.bugun();
    var nav = el('div', undefined, 'davr-nav');
    nav.appendChild(tugma('‹ Oldingi', 'ikkinchi-tugma', function () {
      if (h.tur === 'davr') { var o = Calc.oraliqSur(h.dan, h.gacha, -1); h.dan = o.dan; h.gacha = o.gacha; } else h.sana = Calc.davrniSur(h.tur, h.sana, -1);
      qayta();
    }));
    nav.appendChild(tugma('Bugun', 'ikkinchi-tugma', function () {
      if (h.tur === 'davr') { h.dan = Calc.kunQosh(bugun, -(Calc.kunlarSoni(h.dan, h.gacha) - 1)); h.gacha = bugun; } else h.sana = bugun;
      qayta();
    }));
    var keyingi = tugma('Keyingi ›', 'ikkinchi-tugma', function () {
      if (h.tur === 'davr') { var o = Calc.oraliqSur(h.dan, h.gacha, 1); h.dan = o.dan; h.gacha = o.gacha; } else h.sana = Calc.davrniSur(h.tur, h.sana, 1);
      qayta();
    });
    if (h.tur === 'davr' && Calc.oraliqSur(h.dan, h.gacha, 1).gacha > bugun) keyingi.disabled = true;   // tugash bugundan keyin bo'lmasin
    nav.appendChild(keyingi);
    bloklar.push(nav);
    var nom = el('div', davr.nom, 'davr-nomi');
    nom.setAttribute('aria-live', 'polite');
    bloklar.push(nom);
    if (h.hisob) bloklar.push(el('p', 'Hisob: ' + (hisobNomi(h.hisob) || '—'), 'xira hisob-izohi'));

    var joriyH = Calc.hisobot(malumot.yozuvlar, davr.dan, davr.gacha, h.hisob);
    if (joriyH.soni === 0) {
      var bos = karta();
      bos.appendChild(el('p', 'Bu davrda yozuvlar yo\'q', 'xira'));
      bloklar.push(bos);
      return bloklar;
    }

    // Jami ko'rsatkichlar
    var jami = karta();
    [['Daromad', joriyH.daromad, 'plus'], ['Xarajat', joriyH.xarajat, 'minus'],
      ['Qoldiq', joriyH.qoldiq, joriyH.qoldiq < 0 ? 'minus' : '']].forEach(function (x) {
      var q = el('div', undefined, 'qator');
      q.appendChild(el('span', x[0]));
      q.appendChild(el('strong', (x[0] === 'Qoldiq' && x[1] > 0 ? '+' : '') + Calc.sumFormat(x[1]), x[2]));
      jami.appendChild(q);
    });
    bloklar.push(jami);

    // Oldingi davr bilan taqqoslash (xarajat); erkin davrda — xuddi shuncha kunlik oldingi oraliq
    var oldingiH = Calc.hisobot(malumot.yozuvlar, davr.oldingi.dan, davr.oldingi.gacha, h.hisob);
    var t = Calc.taqqoslash(joriyH.xarajat, oldingiH.xarajat);
    var tk = karta();
    tk.appendChild(el('h2', 'Oldingi davr bilan (' + davr.oldingi.nom + ')'));
    var q1 = el('div', undefined, 'qator');
    q1.appendChild(el('span', 'Oldingi davr xarajati'));
    q1.appendChild(el('strong', Calc.sumFormat(oldingiH.xarajat)));
    tk.appendChild(q1);
    var q2 = el('div', undefined, 'qator');
    q2.appendChild(el('span', 'Xarajat o\'zgarishi'));
    // xarajat ko'paysa qizil, kamaysa yashil
    q2.appendChild(el('strong', Calc.belgiliSum(t.farq) + ' (' + Calc.belgiliFoiz(t.foiz) + ')',
      t.farq > 0 ? 'minus' : t.farq < 0 ? 'plus' : ''));
    tk.appendChild(q2);
    bloklar.push(tk);

    // Bir vaqtda bitta diagramma: doira (tanlangan tur bo'yicha) yoki ustunlar
    var asosiy = korinish === 'ustun' ? vaqtDiagrammasi(h, davr) : null;
    bloklar.push(asosiy || donaKartasi(h.turi, joriyH, davr, h.hisob));
    return bloklar;
  }

  // ---- Byudjet (F7): kategoriyalar bo'yicha oylik chegaralar va ularning holati (joriy kalendar oyi) ----
  function byudjetHisobi() {
    return Calc.byudjetHisobi(malumot.byudjetlar, malumot.kategoriyalar, malumot.yozuvlar, Calc.bugun());
  }

  // Chegara qatori: nomi va to'lish chizig'i. qisqa — bosh sahifadagi ixcham ko'rinish
  function byudjetQatori(nom, rang, holat, bosilganda, qisqa, yashirin) {
    var b = tugma(undefined, 'byudjet-qator' + (qisqa ? ' qisqa' : ''), bosilganda);
    var bosh = el('div', undefined, 'byudjet-bosh');
    if (rang) bosh.appendChild(typeof rang === 'object' ? kategBadge(rang, 24) : belgiDumi('umumiy', rang, 24));
    bosh.appendChild(el('span', nom, 'byudjet-nom'));
    b.appendChild(bosh);
    b.appendChild(Diagramma.byudjetChizigi(holat, nom, yashirin));
    return b;
  }

  function byudjetEkrani() {
    var h = byudjetHisobi();
    var bloklar = [orqagaTugmasi(), el('h1', 'Byudjet'), el('p', h.oyNomi + ' · joriy oy xarajatlari bo\'yicha', 'xira')];

    var umumiyKarta = karta();
    umumiyKarta.classList.add('byudjet-karta');
    umumiyKarta.appendChild(el('h2', 'Umumiy oylik chegara'));
    if (h.umumiy) {
      umumiyKarta.appendChild(byudjetQatori('Umumiy oylik chegara', null, h.umumiy.holat, function () {
        ochish(function () { return byudjetShakli('umumiy'); }, true);
      }));
    } else {
      umumiyKarta.appendChild(el('p', 'Barcha xarajatlar uchun umumiy chegara qo\'yilmagan. Shu oy sarflangan: ' + Calc.sumFormat(h.jami) + '.', 'xira'));
      umumiyKarta.appendChild(tugma('+ Umumiy chegara qo\'yish', 'ikkinchi-tugma', function () {
        ochish(function () { return byudjetShakli('umumiy'); }, true);
      }));
    }
    bloklar.push(umumiyKarta);

    bloklar.push(el('h2', 'Kategoriyalar bo\'yicha chegaralar'));
    if (!h.chegarali.length) {
      var bos = karta();
      bos.appendChild(el('p', 'Hozircha kategoriya chegaralari yo\'q. Quyidagi kategoriyani bosib, oylik chegara qo\'ying (majburiy emas).', 'xira'));
      bloklar.push(bos);
    }
    h.chegarali.forEach(function (x) {
      var k = karta();
      k.classList.add('byudjet-karta');
      k.appendChild(byudjetQatori(x.kategoriya.nom, x.kategoriya, x.holat, function () {
        ochish(function () { return byudjetShakli(x.kategoriya.id); }, true);
      }));
      bloklar.push(k);
    });

    if (h.chegarasiz.length) {
      bloklar.push(el('h2', 'Chegarasiz kategoriyalar'));
      var royxat = karta();
      h.chegarasiz.forEach(function (x) {
        var q = tugma(undefined, 'yozuv', function () { ochish(function () { return byudjetShakli(x.kategoriya.id); }, true); });
        var chap = el('div', undefined, 'yozuv-chap');
        var nom = el('div', undefined, 'yozuv-nom');
        nom.appendChild(kategBadge(x.kategoriya, 26));
        nom.appendChild(document.createTextNode(x.kategoriya.nom));
        chap.appendChild(nom);
        chap.appendChild(el('div', 'Shu oy: ' + Calc.sumFormat(x.sarflangan), 'yozuv-izoh'));
        q.appendChild(chap);
        q.appendChild(el('div', 'Chegara qo\'yish ›', 'yozuv-izoh'));
        royxat.appendChild(q);
      });
      bloklar.push(royxat);
    }
    return bloklar;
  }

  // Chegara qo'yish, o'zgartirish yoki olib tashlash (id — kategoriya id si yoki 'umumiy')
  function byudjetShakli(id) {
    var umumiy = id === 'umumiy', k = umumiy ? null : kategoriyaOl(id);
    var mavjud = malumot.byudjetlar.filter(function (b) { return b.kategoriya_id === id; })[0];
    var h = byudjetHisobi();
    var sarflangan = umumiy ? h.jami : (h.chegarali.concat(h.chegarasiz).filter(function (x) { return x.kategoriya.id === id; })
      .map(function (x) { return x.holat ? x.holat.sarflangan : x.sarflangan; })[0] || 0);
    var nom = umumiy ? 'Umumiy oylik chegara' : (k ? k.nom : 'Kategoriya');
    var bloklar = [orqagaTugmasi(), el('h1', nom)];

    var forma = document.createElement('form');
    forma.noValidate = true;
    forma.className = 'karta';
    forma.appendChild(el('p', h.oyNomi + ' uchun shu oy sarflangan: ' + Calc.sumFormat(sarflangan), 'xira'));
    var limit = summaMaydoni('b-limit', 'Oylik chegara (so\'m)', mavjud ? Calc.raqamFormat(String(mavjud.oylik_limit)) : '');
    limit.input.classList.add('summa-katta');
    limit.input.setAttribute('data-fokus', '1');
    forma.appendChild(limit.quti);
    var saqla = el('button', 'Saqlash', 'asosiy-tugma');
    saqla.type = 'submit';
    forma.appendChild(saqla);
    forma.addEventListener('submit', function (e) {
      e.preventDefault();
      var t = Calc.summaTekshir(limit.input.value);
      if (t.xato) { limit.xato.textContent = t.xato; limit.input.classList.add('xatoli'); limit.input.focus(); return; }
      saqla.disabled = true;
      var yozuv = { kategoriya_id: id, oylik_limit: t.summa };
      Data.saqlash('byudjetlar', yozuv).then(function () {
        malumot.byudjetlar = malumot.byudjetlar.filter(function (b) { return b.kategoriya_id !== id; }).concat([yozuv]);
        qisqaXabar('Chegara saqlandi');
        orqaga();
      }).catch(function (xato) {
        saqla.disabled = false;
        limit.xato.textContent = 'Saqlab bo\'lmadi: ' + xato;
      });
    });
    bloklar.push(forma);

    if (mavjud) {
      bloklar.push(tugma('Chegarani olib tashlash', 'xavfli-tugma', function () {
        if (!window.confirm('"' + nom + '" uchun oylik chegara olib tashlansinmi? Xarajatlar saqlanadi.')) return;
        Data.ochirish('byudjetlar', id).then(function () {
          malumot.byudjetlar = malumot.byudjetlar.filter(function (b) { return b.kategoriya_id !== id; });
          qisqaXabar('Chegara olib tashlandi');
          orqaga();
        }).catch(function (xato) { qisqaXabar('O\'chirib bo\'lmadi: ' + xato); });
      }));
    }
    return bloklar;
  }

  // ---- Qarzlar (F8): pastki menyudagi "Qarzlar" bo'limi ----
  var YONALISH_NOMI = { berdim: 'Men berdim', oldim: 'Men oldim' };
  var YONALISH_IZOHI = { berdim: 'Menga qaytarilishi kerak', oldim: 'Men qaytarishim kerak' };

  function qarzniOl(id) { return malumot.qarzlar.filter(function (q) { return q.id === id; })[0]; }

  // Saqlash va xotirani yangilash; muvaffaqiyatli bo'lsa keyingi qadam chaqiriladi
  function qarzniSaqlash(q) {
    var yangi = Calc.qarzniYangilash(q);   // `yopilgan` doim to'lovlarga mos
    return Data.saqlash('qarzlar', yangi).then(function () {
      var bor = malumot.qarzlar.some(function (x) { return x.id === yangi.id; });
      malumot.qarzlar = bor ? malumot.qarzlar.map(function (x) { return x.id === yangi.id ? yangi : x; }) : malumot.qarzlar.concat([yangi]);
      return yangi;
    });
  }

  // Hisob tanlovi: faol hisoblar (tanlangan arxivlangan bo'lsa, u ham ko'rinadi)
  function hisobTanloviQarz(id, tanlangan) {
    var s = document.createElement('select');
    s.id = id;
    malumot.hisoblar.filter(function (h) { return !h.arxivlangan || h.id === tanlangan; }).forEach(function (h) {
      var o = el('option', h.nom + (h.arxivlangan ? ' (arxiv)' : ''));
      o.value = h.id;
      s.appendChild(o);
    });
    if (tanlangan) s.value = tanlangan;
    return s;
  }

  // Sana va soat maydoni: g'ildirakli tanlagich, hozirdan keyingi qiymatlar tanlanmaydi
  function vaqtMaydoniYasash(id, belgiMatn, boshlangich) {
    var holat = { sana: boshlangich.sana, vaqt: boshlangich.vaqt };
    var quti = el('div', undefined, 'maydon');
    quti.appendChild(el('span', belgiMatn, 'belgi'));
    var tg = tugma(undefined, 'vaqt-tugma', function () {
      Glidirak.ochish({
        sana: holat.sana, vaqt: holat.vaqt,
        tasdiq: function (sana, vaqt) { holat.sana = sana; holat.vaqt = vaqt; korsat(); }
      });
    });
    tg.id = id;
    var xato = el('div', undefined, 'xato-matn');
    quti.appendChild(tg);
    quti.appendChild(xato);
    function korsat() {
      tg.textContent = Calc.sanaKorsat(holat.sana) + ' · ' + holat.vaqt;
      tg.classList.remove('xatoli');
      xato.textContent = '';
    }
    korsat();
    return { quti: quti, holat: holat, tugma: tg, xato: xato };
  }

  function qarzChizigi(tolangan, summa, nom) {
    var c = el('div', undefined, 'qarz-chiziq');
    c.setAttribute('role', 'progressbar');
    c.setAttribute('aria-valuemin', '0');
    c.setAttribute('aria-valuemax', '100');
    c.setAttribute('aria-valuenow', String(Calc.tolashFoizi(tolangan, summa)));
    c.setAttribute('aria-label', nom + ': ' + Calc.sumFormat(tolangan) + ' qaytarilgan, jami ' + Calc.sumFormat(summa));
    var t = el('span', undefined, 'qarz-tolgan');
    t.style.width = (summa ? Math.min(100, tolangan * 100 / summa) : 0) + '%';
    c.appendChild(t);
    return c;
  }

  function muddatBelgisi(q) {
    return el('span', '⚠ Muddati o\'tgan', 'qarz-belgi muddat-otgan');
  }

  // Qarzlar bo'limi (pastki menyudan): berilgan/olingan jami, har qarz kartasi, tepa o'ngda arxiv belgisi (yopilganlar)
  function qarzKartasi(q, bugun, mini) {
    var berdim = q.yonalish === 'berdim', tolangan = Calc.tolanganSumma(q), qolgan = Calc.qarzQolgan(q);
    var k = tugma(undefined, (mini ? 'qarz-mini ' : 'karta qarz-karta ') + 'qarz-karta-tugma', function () { ochish(function () { return qarzEkrani(q.id); }, false); });
    k.setAttribute('data-shaxs', q.shaxs);
    k.setAttribute('data-yonalish', q.yonalish);
    var bosh = el('div', undefined, 'qarz-bosh');
    bosh.appendChild(el('strong', q.shaxs, 'qarz-shaxs'));
    bosh.appendChild(el('span', mini ? pul(qolgan) : Calc.sumFormat(qolgan), 'qarz-qolgan ' + (berdim ? 'plus' : 'minus')));
    k.appendChild(bosh);
    k.appendChild(el('div', (berdim ? 'Men berdim' : 'Men oldim') + ' · ' + Calc.sanaKorsat(q.sana), 'xira qarz-raqam'));
    k.appendChild(qarzChizigi(tolangan, q.summa, q.shaxs));
    k.appendChild(el('div', 'Qaytarilgan: ' + (mini ? pul(tolangan) : Calc.sumFormat(tolangan)) + ' / ' + (mini ? pul(q.summa) : Calc.sumFormat(q.summa)), 'xira qarz-raqam'));
    if (!mini) {
      k.appendChild(el('div', 'Qolgan: ' + Calc.sumFormat(qolgan) + ' · Jami: ' + Calc.sumFormat(q.summa), 'qarz-qatori'));
    }
    var det = el('div', undefined, 'qarz-muddat xira');
    det.appendChild(document.createTextNode(q.muddat ? 'Muddat: ' + Calc.sanaKorsat(q.muddat) + ' ' : 'Muddat yo\'q'));
    if (Calc.qarzMuddatiOtdimi(q, bugun)) det.appendChild(muddatBelgisi());
    if ((malumot.hisoblar.filter(function (h) { return h.id === q.hisob_id; })[0] || {}).arxivlangan) det.appendChild(el('span', '⚠ Hisob arxivda', 'qarz-belgi'));
    k.appendChild(det);
    return k;
  }

  function qarzlarBolimi() {
    var bloklar = [], bugun = Calc.bugun(), jami = Calc.qarzlarJami(malumot.qarzlar), g = Calc.qarzlarShaxsBoyicha(malumot.qarzlar, bugun);
    var bosh = el('div', undefined, 'hisobot-bosh');
    bosh.appendChild(el('h1', 'Qarzlar'));
    var bl = el('div', undefined, 'belgilar');
    bl.appendChild(belgiTugmasi('arxiv', 'Yopilgan qarzlar (arxiv): ' + g.yopilgan.length + ' ta', function () { ochish(yopilganQarzlarEkrani, false); }, 'arxiv-tugma'));
    bosh.appendChild(bl);
    bloklar.push(bosh);

    var juft = el('div', undefined, 'juft');
    [['Berilgan qarzlar', jami.olishKerak, 'plus', 'olish-jami'], ['Olingan qarzlar', jami.qaytarishKerak, 'minus', 'qaytarish-jami']].forEach(function (x) {
      var c = karta();
      c.classList.add(x[3]);
      c.appendChild(el('div', x[0], 'xira'));
      c.appendChild(el('div', Calc.sumFormat(x[1]), 'oy-summa ' + x[2]));
      juft.appendChild(c);
    });
    bloklar.push(juft);
    var qosh = tugma('+ Qarz qo\'shish', 'asosiy-tugma', function () { ochish(function () { return qarzShakli(null); }, true); });
    qosh.id = 'qarz-qoshish';
    bloklar.push(qosh);

    var ochiq = [];
    g.ochiq.forEach(function (gr) { gr.qarzlar.forEach(function (q) { ochiq.push(q); }); });   // tartib: muddati o'tganlar, keyin qolgani kattasi
    if (!ochiq.length) {
      var bos = karta();
      bos.appendChild(el('p', malumot.qarzlar.length ? 'Ochiq qarzlar yo\'q.' : 'Hozircha qarzlar yo\'q. Birovga qarz bersangiz yoki olsangiz, shu yerga yozing.', 'xira'));
      bloklar.push(bos);
    }
    ochiq.forEach(function (q) { bloklar.push(qarzKartasi(q, bugun, false)); });
    return bloklar;
  }

  function yopilganQarzlarEkrani() {
    var bloklar = [orqagaTugmasi(), el('h1', 'Yopilgan qarzlar')];
    var g = Calc.qarzlarShaxsBoyicha(malumot.qarzlar, Calc.bugun());
    if (!g.yopilgan.length) {
      var bos = karta();
      bos.appendChild(el('p', 'Yopilgan qarzlar yo\'q.', 'xira'));
      bloklar.push(bos);
    }
    var det = g.yopilgan.length ? karta() : null;
    g.yopilgan.forEach(function (q) {
      var r = tugma(undefined, 'yozuv qarz-qator', function () { ochish(function () { return qarzEkrani(q.id); }, false); });
      r.setAttribute('data-shaxs', q.shaxs);
      var chap = el('div', undefined, 'yozuv-chap');
      chap.appendChild(el('div', q.shaxs, 'yozuv-nom'));
      chap.appendChild(el('div', YONALISH_NOMI[q.yonalish] + ' · ' + Calc.sanaKorsat(q.sana) + ' · ✓ Yopilgan', 'yozuv-izoh'));
      r.appendChild(chap);
      r.appendChild(el('div', Calc.sumFormat(q.summa), 'yozuv-summa'));
      det.appendChild(r);
    });
    if (det) bloklar.push(det);
    return bloklar;
  }

  function qarzEkrani(id) {
    var q = qarzniOl(id);
    if (!q) return [orqagaTugmasi(), el('h1', 'Qarz'), el('p', 'Bu qarz topilmadi.', 'xira')];
    var bugun = Calc.bugun(), tolangan = Calc.tolanganSumma(q), qolgan = Calc.qarzQolgan(q), yopilgan = Calc.qarzYopilganmi(q);
    var hisob = malumot.hisoblar.filter(function (h) { return h.id === q.hisob_id; })[0];
    var bloklar = [orqagaTugmasi(), el('h1', q.shaxs)];

    var k = karta();
    k.classList.add('qarz-tafsilot');
    function qator(nom, qiymat, klass) {
      var r = el('div', undefined, 'qator');
      r.appendChild(el('span', nom));
      r.appendChild(typeof qiymat === 'string' ? el('strong', qiymat, klass) : qiymat);
      k.appendChild(r);
    }
    qator('Yo\'nalish', YONALISH_NOMI[q.yonalish] + ' (' + YONALISH_IZOHI[q.yonalish].toLowerCase() + ')');
    qator('Qarz summasi', Calc.sumFormat(q.summa));
    qator('Qaytarilgan', Calc.sumFormat(tolangan));
    qator('Qolgan', Calc.sumFormat(qolgan), q.yonalish === 'berdim' ? 'plus' : 'minus');
    k.appendChild(qarzChizigi(tolangan, q.summa, q.shaxs));
    k.appendChild(el('div', Calc.tolashFoizi(tolangan, q.summa) + '% qaytarilgan', 'xira qarz-raqam'));
    if (yopilgan) k.appendChild(el('div', '✓ Qarz yopilgan', 'qarz-belgi yopilgan'));
    qator('Hisob', hisob ? hisob.nom + (hisob.arxivlangan ? ' (arxiv)' : '') : '—');
    qator('Sana va soat', Calc.sanaKorsat(q.sana) + ' · ' + (q.vaqt || '00:00'));
    if (q.muddat) {
      var m = el('span');
      m.appendChild(el('strong', Calc.sanaKorsat(q.muddat)));
      if (Calc.qarzMuddatiOtdimi(q, bugun)) { m.appendChild(document.createTextNode(' ')); m.appendChild(muddatBelgisi()); }
      qator('Qaytarish muddati', m);
    }
    if (q.izoh) qator('Izoh', q.izoh);
    if (hisob && hisob.arxivlangan && !yopilgan) k.appendChild(el('div', '⚠ Bu qarz arxivlangan hisobga bog\'langan. To\'lovni boshqa hisobga yozishingiz mumkin.', 'ogohlantirish'));
    bloklar.push(k);

    var tk = karta();
    tk.appendChild(el('h2', 'To\'lovlar'));
    if (!q.tolovlar.length) tk.appendChild(el('p', 'Hali to\'lov yo\'q.', 'xira'));
    q.tolovlar.slice().sort(function (a, b) { return (a.sana + a.vaqt) < (b.sana + b.vaqt) ? 1 : -1; }).forEach(function (t) {
      var r = tugma(undefined, 'yozuv tolov-qator', function () { ochish(function () { return tolovShakli(q.id, t.id); }, true); });
      var chap = el('div', undefined, 'yozuv-chap');
      chap.appendChild(el('div', Calc.sanaKorsat(t.sana) + ' · ' + (t.vaqt || '00:00'), 'yozuv-nom'));
      chap.appendChild(el('div', hisobNomi(t.hisob_id), 'yozuv-izoh'));
      r.appendChild(chap);
      r.appendChild(el('div', Calc.sumFormat(t.summa), 'yozuv-summa ' + (q.yonalish === 'berdim' ? 'plus' : 'minus')));
      tk.appendChild(r);
    });
    bloklar.push(tk);

    if (!yopilgan) {
      bloklar.push(tugma(q.yonalish === 'berdim' ? '+ Qaytarildi (to\'lov)' : '+ Qaytardim (to\'lov)', 'asosiy-tugma', function () {
        ochish(function () { return tolovShakli(q.id, null); }, true);
      }));
    }
    bloklar.push(tugma('Tahrirlash', 'ikkinchi-tugma', function () { ochish(function () { return qarzShakli(q); }, true); }));
    bloklar.push(tugma('O\'chirish', 'xavfli-tugma', function () { qarzniOchirish(q); }));
    return bloklar;
  }

  // rejim (ixtiyoriy): "+" tugmasidan ochilganda { orqaga: tanlov oynasiga qaytadi, saqlandi: qarzlar ro'yxatiga o'tadi }
  function qarzShakli(q, rejim, boshYonalish) {
    var bloklar = [rejim ? tugma('← Orqaga', 'orqaga-tugma', rejim.orqaga) : orqagaTugmasi(), el('h1', q ? 'Qarzni tahrirlash' : 'Yangi qarz')];
    var forma = document.createElement('form');
    forma.noValidate = true;
    forma.className = 'karta';
    var yonalish = q ? q.yonalish : (boshYonalish === 'oldim' ? 'oldim' : 'berdim');

    var yMaydon = el('div', undefined, 'maydon');
    yMaydon.appendChild(el('span', 'Yo\'nalish', 'belgi'));
    var yQator = el('div', undefined, 'tanlov');
    var yTugmalar = {};
    ['berdim', 'oldim'].forEach(function (y) {
      yTugmalar[y] = tugma(YONALISH_NOMI[y], undefined, function () {
        yonalish = y;
        Object.keys(yTugmalar).forEach(function (x) { yTugmalar[x].setAttribute('aria-pressed', String(x === y)); });
        shaxsBelgi.textContent = y === 'berdim' ? 'Kimga' : 'Kimdan';
      });
      yTugmalar[y].setAttribute('aria-pressed', String(y === yonalish));
      yTugmalar[y].setAttribute('data-yonalish', y);
      yQator.appendChild(yTugmalar[y]);
    });
    yMaydon.appendChild(yQator);
    forma.appendChild(yMaydon);

    var shMaydon = el('div', undefined, 'maydon');
    var shaxsBelgi = el('label', yonalish === 'berdim' ? 'Kimga' : 'Kimdan');
    shaxsBelgi.setAttribute('for', 'q-shaxs');
    var shaxs = document.createElement('input');
    shaxs.id = 'q-shaxs';
    shaxs.type = 'text';
    shaxs.autocomplete = 'off';
    shaxs.value = q ? q.shaxs : '';
    var shaxsXato = el('div', undefined, 'xato-matn');
    shMaydon.appendChild(shaxsBelgi);
    shMaydon.appendChild(shaxs);
    shMaydon.appendChild(shaxsXato);
    forma.appendChild(shMaydon);

    var summa = summaMaydoni('q-summa', 'Summa (so\'m)', q ? Calc.raqamFormat(String(q.summa)) : '');
    forma.appendChild(summa.quti);

    var hMaydon = el('div', undefined, 'maydon');
    var hBelgi = el('label', 'Hisob');
    hBelgi.setAttribute('for', 'q-hisob');
    var oxirgiHisob = (faolHisoblar()[0] || {}).id;
    var hisob = hisobTanloviQarz('q-hisob', q ? q.hisob_id : oxirgiHisob);
    var hisobXato = el('div', undefined, 'xato-matn');
    hMaydon.appendChild(hBelgi);
    hMaydon.appendChild(hisob);
    hMaydon.appendChild(hisobXato);
    forma.appendChild(hMaydon);

    var vaqt = vaqtMaydoniYasash('q-vaqt-tugma', 'Sana va soat', q ? { sana: q.sana, vaqt: q.vaqt || '00:00' } : Calc.hozir());
    forma.appendChild(vaqt.quti);

    // Qaytarish muddati: ixtiyoriy, kelajakda bo'lishi mumkin
    var muddatMaydon = el('div', undefined, 'maydon');
    var muddatBel = el('label', 'Qaytarish muddati (ixtiyoriy)');
    muddatBel.setAttribute('for', 'q-muddat');
    var muddat = document.createElement('input');
    muddat.id = 'q-muddat';
    muddat.type = 'date';
    muddat.value = q && q.muddat ? q.muddat : '';
    var muddatXato = el('div', undefined, 'xato-matn');
    muddatMaydon.appendChild(muddatBel);
    muddatMaydon.appendChild(muddat);
    muddatMaydon.appendChild(muddatXato);
    forma.appendChild(muddatMaydon);

    var izMaydon = el('div', undefined, 'maydon');
    var izBelgi = el('label', 'Izoh (ixtiyoriy)');
    izBelgi.setAttribute('for', 'q-izoh');
    var izoh = document.createElement('input');
    izoh.id = 'q-izoh';
    izoh.type = 'text';
    izoh.autocomplete = 'off';
    izoh.value = q ? q.izoh || '' : '';
    izMaydon.appendChild(izBelgi);
    izMaydon.appendChild(izoh);
    forma.appendChild(izMaydon);

    var saqla = el('button', 'Saqlash', 'asosiy-tugma');
    saqla.type = 'submit';
    forma.appendChild(saqla);

    [shaxs, muddat].forEach(function (i) { i.addEventListener('input', function () { shaxsXato.textContent = ''; muddatXato.textContent = ''; i.classList.remove('xatoli'); }); });
    hisob.addEventListener('change', function () { hisobXato.textContent = ''; });

    forma.addEventListener('submit', function (e) {
      e.preventDefault();
      // saqlash paytida hozirgi vaqt qayta olinadi (g'ildirakdan keyingi ikkinchi himoya)
      var r = Calc.qarzniTekshir({ yonalish: yonalish, shaxs: shaxs.value, summa: summa.input.value, hisob: hisob.value,
        sana: vaqt.holat.sana, vaqt: vaqt.holat.vaqt, muddat: muddat.value, izoh: izoh.value }, Calc.hozir(), q || undefined);
      if (r.xato) {
        var maydon = { shaxs: [shaxsXato, shaxs], summa: [summa.xato, summa.input], hisob: [hisobXato, hisob], vaqt: [vaqt.xato, vaqt.tugma], muddat: [muddatXato, muddat] }[r.maydon];
        if (maydon) { maydon[0].textContent = r.xato; maydon[1].classList.add('xatoli'); maydon[1].focus(); }
        else qisqaXabar(r.xato);
        return;
      }
      var yangi = Object.assign({}, q || { id: Data.yangiId(), yaratilgan: new Date().toISOString(), tolovlar: [] }, r.qarz);
      saqla.disabled = true;
      qarzniSaqlash(yangi).then(function () {
        qisqaXabar(q ? 'Qarz yangilandi' : 'Qarz qo\'shildi');
        if (rejim) rejim.saqlandi(); else orqaga();
      }).catch(function (xato) {
        saqla.disabled = false;
        summa.xato.textContent = 'Saqlab bo\'lmadi: ' + xato;
      });
    });
    bloklar.push(forma);
    return bloklar;
  }

  // To'lov qo'shish yoki tahrirlash (tolovId bo'lsa); tahrirda "To'lovni o'chirish" ham bor
  function tolovShakli(qarzId, tolovId) {
    var q = qarzniOl(qarzId);
    if (!q) return [orqagaTugmasi(), el('h1', 'To\'lov'), el('p', 'Qarz topilmadi.', 'xira')];
    var t = tolovId ? q.tolovlar.filter(function (x) { return x.id === tolovId; })[0] : null;
    var bloklar = [orqagaTugmasi(), el('h1', t ? 'To\'lovni tahrirlash' : (q.yonalish === 'berdim' ? 'Qaytarildi' : 'Qaytardim'))];
    var boshqa = q.tolovlar.filter(function (x) { return !t || x.id !== t.id; }).reduce(function (a, x) { return a + x.summa; }, 0);
    var qolgan = Math.max(0, q.summa - boshqa);

    var forma = document.createElement('form');
    forma.noValidate = true;
    forma.className = 'karta';
    forma.appendChild(el('p', q.shaxs + ' · qolgan qarz: ' + Calc.sumFormat(qolgan), 'xira'));
    var summa = summaMaydoni('t-summa', 'To\'lov summasi (so\'m)', t ? Calc.raqamFormat(String(t.summa)) : '');
    summa.input.classList.add('summa-katta');
    summa.input.setAttribute('data-fokus', '1');
    forma.appendChild(summa.quti);
    var hammasi = tugma('Hammasi (' + Calc.sumFormat(qolgan) + ')', 'ikkinchi-tugma', function () {
      summa.input.value = Calc.raqamFormat(String(qolgan));
      summa.xato.textContent = '';
    });
    hammasi.id = 't-hammasi';
    forma.appendChild(hammasi);

    var hMaydon = el('div', undefined, 'maydon');
    var hBelgi = el('label', q.yonalish === 'berdim' ? 'Pul qaysi hisobga tushdi' : 'Pul qaysi hisobdan chiqdi');
    hBelgi.setAttribute('for', 't-hisob');
    var boshHisob = t ? t.hisob_id : (((malumot.hisoblar.filter(function (h) { return h.id === q.hisob_id; })[0] || {}).arxivlangan ? (faolHisoblar()[0] || {}).id : q.hisob_id));
    var hisob = hisobTanloviQarz('t-hisob', boshHisob);
    var hisobXato = el('div', undefined, 'xato-matn');
    hMaydon.appendChild(hBelgi);
    hMaydon.appendChild(hisob);
    hMaydon.appendChild(hisobXato);
    forma.appendChild(hMaydon);

    var vaqt = vaqtMaydoniYasash('t-vaqt-tugma', 'Sana va soat', t ? { sana: t.sana, vaqt: t.vaqt || '00:00' } : Calc.hozir());
    forma.appendChild(vaqt.quti);

    var saqla = el('button', 'Saqlash', 'asosiy-tugma');
    saqla.type = 'submit';
    forma.appendChild(saqla);
    forma.addEventListener('submit', function (e) {
      e.preventDefault();
      var r = Calc.tolovniTekshir(q, { summa: summa.input.value, hisob: hisob.value, sana: vaqt.holat.sana, vaqt: vaqt.holat.vaqt }, Calc.hozir(), t ? t.id : undefined);
      if (r.xato) {
        var maydon = { summa: [summa.xato, summa.input], hisob: [hisobXato, hisob], vaqt: [vaqt.xato, vaqt.tugma] }[r.maydon];
        maydon[0].textContent = r.xato; maydon[1].classList.add('xatoli'); maydon[1].focus();
        return;
      }
      var yangiTolov = Object.assign({ id: Data.yangiId(), yaratilgan: new Date().toISOString() }, t || {}, r.tolov);
      var yangi = Object.assign({}, q, { tolovlar: t ? q.tolovlar.map(function (x) { return x.id === t.id ? yangiTolov : x; }) : q.tolovlar.concat([yangiTolov]) });
      saqla.disabled = true;
      qarzniSaqlash(yangi).then(function (s) {
        qisqaXabar(Calc.qarzYopilganmi(s) ? 'Qarz to\'liq yopildi' : (t ? 'To\'lov yangilandi' : 'To\'lov qo\'shildi'));
        orqaga();
      }).catch(function (xato) {
        saqla.disabled = false;
        summa.xato.textContent = 'Saqlab bo\'lmadi: ' + xato;
      });
    });
    bloklar.push(forma);
    if (t) bloklar.push(tugma('To\'lovni o\'chirish', 'xavfli-tugma', function () { tolovniOchirish(q, t); }));
    return bloklar;
  }

  // O'chiradi va 10 soniya davomida "Bekor qilish" imkonini beradi
  function qarzniOchirish(q) {
    Data.ochirish('qarzlar', q.id).then(function () {
      malumot.qarzlar = malumot.qarzlar.filter(function (x) { return x.id !== q.id; });
      orqaga();   // qarz ekranidan ro'yxatga qaytamiz
      qisqaXabar('Qarz o\'chirildi', { nom: 'Bekor qilish', fn: function () {
        qarzniSaqlash(q).then(function () { qisqaXabar('Qarz qaytarildi'); yangilash(); });
      } }, 10000);
    }).catch(function (xato) { qisqaXabar('O\'chirib bo\'lmadi: ' + xato); });
  }

  function tolovniOchirish(q, t) {
    var eski = q;
    qarzniSaqlash(Object.assign({}, q, { tolovlar: q.tolovlar.filter(function (x) { return x.id !== t.id; }) })).then(function () {
      orqaga();
      qisqaXabar('To\'lov o\'chirildi', { nom: 'Bekor qilish', fn: function () {
        qarzniSaqlash(eski).then(function () { qisqaXabar('To\'lov qaytarildi'); yangilash(); });
      } }, 10000);
    }).catch(function (xato) { qisqaXabar('O\'chirib bo\'lmadi: ' + xato); });
  }

  // ---- "+" tugmasi: pastdan chiqadigan tanlov oynasi ("Yangi yozuv yaratish") ----
  var qoshishRejimi = 'yozuv';   // "qoshish" bo'limida nima ko'rinadi: yozuv shakli (wizard) yoki qarz shakli
  var tanlovOynasi = null;       // ochiq oyna (bo'lsa)
  var qoshishOldingi = 'bosh';   // "+" bosilgan paytdagi bo'lim
  var qoshishManba = 'oyna';     // qarz/yozuv shakli qayerdan ochildi: 'oyna' ("+" tanlov oynasi) yoki 'tez' (Asosiydagi tez qo'shish)
  var qarzBoshYonalish = 'berdim';

  function yangiYozuvOynasi() {
    if (tanlovOynasi) return;
    var oldingiFokus = document.activeElement, oldingiOverflow = document.body.style.overflow;
    if (joriy !== 'qoshish') qoshishOldingi = joriy;   // qarz oynasidan "Orqaga" shu bo'limga qaytaradi
    var parda = el('div', undefined, 'sheet-parda');
    var oyna = el('div', undefined, 'sheet tanlov-oynasi');
    oyna.setAttribute('role', 'dialog');
    oyna.setAttribute('aria-modal', 'true');
    oyna.setAttribute('aria-labelledby', 'yy-sarlavha');
    oyna.tabIndex = -1;
    parda.appendChild(oyna);
    tanlovOynasi = parda;

    function yop(fokus) {
      document.removeEventListener('keydown', tugmaBosildi, true);
      if (parda.parentNode) parda.parentNode.removeChild(parda);
      document.body.style.overflow = oldingiOverflow;
      tanlovOynasi = null;
      if (fokus !== false && oldingiFokus && oldingiFokus.focus && oldingiFokus.isConnected) oldingiFokus.focus();
    }
    function tugmaBosildi(e) {
      if (e.key === 'Escape') { e.preventDefault(); yop(); return; }
      if (e.key !== 'Tab') return;
      var f = Array.prototype.slice.call(oyna.querySelectorAll('button:not([disabled])'));
      var i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }

    var bosh = el('div', undefined, 'sheet-bosh tanlov-bosh');
    var orqa = tugma('← Orqaga', 'matn-tugma', function () { yop(); });
    orqa.setAttribute('aria-label', 'Orqaga, oynani yopish');
    bosh.appendChild(orqa);
    var yopTugma = belgiTugmasi('yopish', 'Yopish', function () { yop(); });
    yopTugma.classList.add('yopish-tugma');
    bosh.appendChild(yopTugma);
    oyna.appendChild(bosh);
    var sarlavha = el('h2', 'Yangi yozuv yaratish');
    sarlavha.id = 'yy-sarlavha';
    oyna.appendChild(sarlavha);

    function qator(klass, belgi, nom, izoh, bosilganda) {
      var b = tugma(undefined, 'tanlov-qator ' + klass, bosilganda);
      b.setAttribute('aria-label', nom + '. ' + izoh);
      var rasm = el('span', undefined, 'tanlov-belgi');
      rasm.appendChild(svgBelgi(belgi, 24));
      b.appendChild(rasm);
      var matn = el('span', undefined, 'tanlov-matn');
      matn.appendChild(el('strong', nom));
      matn.appendChild(el('span', izoh, 'xira'));
      b.appendChild(matn);
      var q = svgBelgi('keyingi', 20);
      q.classList.add('tanlov-keyingi');
      b.appendChild(q);
      oyna.appendChild(b);
      return b;
    }
    // Birinchi qator ajralib turadi va oyna ochilganda tayyor turadi: Enter bilan tezkor yo'l
    var tranzaksiya = qator('birinchi', 'almashuv', 'Tranzaksiya qo\'shish', 'Daromad, xarajat yoki o\'tkazma qo\'shing', function () {
      yop(false);
      qoshishRejimi = 'yozuv';
      qoshishManba = 'oyna';
      korsat('qoshish');
    });
    tranzaksiya.id = 'yy-tranzaksiya';
    var qarz = qator('', 'qarz', 'Qarz qo\'shish', 'Berilgan yoki olingan qarz. Hisob qoldig\'ini o\'zgartiradi, hisobotga kirmaydi', function () {
      yop(false);
      qoshishRejimi = 'qarz';
      qoshishManba = 'oyna';
      qarzBoshYonalish = 'berdim';
      korsat('qoshish');
    });
    qarz.id = 'yy-qarz';

    parda.addEventListener('click', function (e) { if (e.target === parda) yop(); });
    document.body.appendChild(parda);
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', tugmaBosildi, true);
    tranzaksiya.focus();
  }

  // Qarz oynasidan "Orqaga": avvalgi bo'limga qaytib, tanlov oynasini qayta ochadi
  function qarzdanOrqaga() {
    qoshishRejimi = 'yozuv';
    korsat(qoshishOldingi);
    yangiYozuvOynasi();
  }

  // ---- Zaxira va eksport (F9) ----
  var eksportHolat = { tur: 'hammasi', yil: null, oy: null };   // CSV davri

  // Faylni yuklab berish (Blob). Hech qayerga yuborilmaydi: hammasi qurilmada
  function faylYuklash(nom, matn, tur) {
    var url = URL.createObjectURL(new Blob([matn], { type: tur }));
    var a = document.createElement('a');
    a.href = url;
    a.download = nom;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
  }

  // Joriy holatning to'liq zaxirasi (JSON). Muvaffaqiyatli bo'lsa va oldin=false bo'lsa, oxirgi zaxira sanasi yangilanadi.
  function zaxiraniOlish(oldinTiklash) {
    return Data.hammasiniOqish().then(function (m) {
      var bugun = Calc.bugun();
      if (!oldinTiklash) {
        // fayl ichidagi sozlamalarda ham yangi sana bo'ladi: tiklangach "oxirgi zaxira" shu faylning sanasi
        var bor = m.sozlamalar.some(function (x) { return x.kalit === 'asosiy'; });
        m.sozlamalar = bor ? m.sozlamalar.map(function (x) { return x.kalit === 'asosiy' ? Object.assign({}, x, { oxirgi_zaxira_sanasi: bugun }) : x; })
          : m.sozlamalar.concat([{ kalit: 'asosiy', sxema_versiyasi: Data.SXEMA_VERSIYASI, oxirgi_zaxira_sanasi: bugun }]);
      }
      var fayl = Calc.zaxiraYasash(m, Data.SXEMA_VERSIYASI, new Date());
      faylYuklash(Calc.zaxiraNomi(new Date(), oldinTiklash ? 'zaxira-tiklashdan-oldin' : 'zaxira'), JSON.stringify(fayl), 'application/json');
      if (oldinTiklash) return fayl;
      var asosiy = m.sozlamalar.filter(function (x) { return x.kalit === 'asosiy'; })[0];
      return Data.saqlash('sozlamalar', asosiy).then(function () { malumot.zaxiraSanasi = bugun; return fayl; });
    });
  }

  // Tiklash: tekshirish (hech narsaga tegmasdan) -> tasdiq -> joriy holat zaxirasi yuklanadi -> bitta tranzaksiyada almashtirish
  function zaxiradanTiklash(fayl, xatoChiqar) {
    if (fayl.size > 200 * 1024 * 1024) { xatoChiqar('Fayl juda katta (200 MB dan oshmasin)'); return; }
    var oqish = fayl.text ? fayl.text() : new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; r.readAsText(fayl); });
    oqish.then(function (matn) {
      var t = Calc.zaxiraniTekshir(matn, Data.SXEMA_VERSIYASI, Calc.hozir());
      if (t.xato) { xatoChiqar(t.xato + '. Mavjud ma\'lumotga tegilmadi.'); return; }
      var s = t.soni, kj = t.kelajak;
      var matnTasdiq = 'Zaxiradan tiklash\n\nFaylda: ' + s.yozuvlar + ' ta yozuv, ' + s.hisoblar + ' ta hisob, ' + s.kategoriyalar + ' ta kategoriya, ' + s.qarzlar + ' ta qarz.\n\n' +
        'Mavjud ma\'lumot (' + malumot.yozuvlar.length + ' ta yozuv, ' + malumot.qarzlar.length + ' ta qarz) shu fayldagi bilan ALMASHTIRILADI. Avval joriy holatning zaxirasi avtomatik yuklab beriladi.' +
        (t.eskiSxema ? '\n\nBu eski versiya zaxirasi: yangi tuzilishga o\'tkaziladi, hech narsa o\'chmaydi.' : '') +
        (kj.yozuv + kj.qarz + kj.tolov ? '\n\n⚠ Vaqti hozirdan keyin bo\'lgan: ' + kj.yozuv + ' ta yozuv, ' + kj.qarz + ' ta qarz, ' + kj.tolov + ' ta to\'lov. Ular o\'chirilmaydi, "Kelajak" belgisi bilan ko\'rinadi; tahrirlashda vaqtni o\'tmishga to\'g\'rilang.' : '') +
        '\n\nDavom etilsinmi?';
      if (!window.confirm(matnTasdiq)) return;
      return zaxiraniOlish(true).then(function () { return Data.almashtirish(t.malumot); })
        .then(yuklash).then(function () {
          korsat('bosh');
          qisqaXabar('Zaxiradan tiklandi: ' + s.yozuvlar + ' ta yozuv, ' + s.qarzlar + ' ta qarz', undefined, 6000);
        });
    }).catch(function (xato) { xatoChiqar('Tiklab bo\'lmadi: ' + (xato && xato.message ? xato.message : xato) + '. Mavjud ma\'lumot o\'zgarmadi.'); });
  }

  function zaxiraEkrani() {
    var bloklar = [orqagaTugmasi(), el('h1', 'Zaxira va eksport')];
    var xatoQutisi = el('div', undefined, 'xato-karta');
    xatoQutisi.setAttribute('role', 'alert');
    xatoQutisi.hidden = true;
    function xatoChiqar(m) { xatoQutisi.textContent = m; xatoQutisi.hidden = false; xatoQutisi.scrollIntoView({ block: 'center' }); }

    var k = karta();
    k.appendChild(el('h2', 'Zaxira nusxa'));
    var z = Calc.zaxiraHolati(malumot.zaxiraSanasi, Calc.bugun());
    k.appendChild(el('p', z.holat === 'yoq' ? 'Zaxira hali olinmagan.' : 'Oxirgi zaxira: ' + Calc.sanaKorsat(malumot.zaxiraSanasi) + (z.kun === 0 ? ' (bugun)' : ' (' + z.kun + ' kun oldin)'), 'xira zaxira-sana'));
    k.appendChild(el('p', 'Ma\'lumotlar faqat shu qurilmada saqlanadi, hech qayerga yuborilmaydi. Zaxira — barcha yozuv, hisob, kategoriya, byudjet va qarzlar bitta JSON faylda.', 'xira'));
    var olish = tugma('Zaxira nusxa olish', 'asosiy-tugma', function () {
      olish.disabled = true;
      zaxiraniOlish(false).then(function () { qisqaXabar('Zaxira yuklab olindi'); chizish(zaxiraEkrani(), true); })
        .catch(function (x) { olish.disabled = false; xatoChiqar('Zaxira olib bo\'lmadi: ' + x); });
    });
    olish.id = 'zaxira-olish';
    k.appendChild(olish);
    var kiritish = document.createElement('input');
    kiritish.type = 'file';
    kiritish.id = 'zaxira-fayl';
    kiritish.accept = '.json,application/json';
    kiritish.hidden = true;
    kiritish.addEventListener('change', function () {
      var f = kiritish.files && kiritish.files[0];
      kiritish.value = '';
      xatoQutisi.hidden = true;
      if (f) zaxiradanTiklash(f, xatoChiqar);
    });
    var tikla = tugma('Zaxiradan tiklash', 'ikkinchi-tugma', function () { kiritish.click(); });
    tikla.id = 'zaxira-tikla';
    k.appendChild(tikla);
    k.appendChild(kiritish);
    k.appendChild(el('p', 'Tiklashdan oldin joriy holatning zaxirasi avtomatik yuklab beriladi. Buzuq yoki yarim fayl rad etiladi, mavjud ma\'lumotga tegilmaydi.', 'xira'));
    bloklar.push(k);
    bloklar.push(xatoQutisi);

    // Excel uchun eksport (CSV)
    var e = karta();
    e.appendChild(el('h2', 'Excel uchun eksport (CSV)'));
    var buYil = parseInt(Calc.bugun().slice(0, 4), 10), buOy = parseInt(Calc.bugun().slice(5, 7), 10);
    var birinchi = malumot.yozuvlar.concat(malumot.qarzlar).reduce(function (a, y) { return !a || y.sana < a ? y.sana : a; }, '');
    var yillar = Calc.filtrYillari(birinchi, Calc.bugun());
    if (!eksportHolat.yil) { eksportHolat.yil = buYil; eksportHolat.oy = buOy; }
    var davrMaydon = el('div', undefined, 'maydon');
    davrMaydon.appendChild(el('span', 'Davr', 'belgi'));
    var turQator = el('div', undefined, 'tanlov');
    [['hammasi', 'Hammasi'], ['oy', 'Oy'], ['yil', 'Yil']].forEach(function (t) {
      var b = tugma(t[1], undefined, function () { eksportHolat.tur = t[0]; chizish(zaxiraEkrani(), true); });
      b.setAttribute('aria-pressed', String(eksportHolat.tur === t[0]));
      b.setAttribute('data-davr', t[0]);
      turQator.appendChild(b);
    });
    davrMaydon.appendChild(turQator);
    e.appendChild(davrMaydon);
    if (eksportHolat.tur !== 'hammasi') {
      var tanlar = el('div', undefined, 'juft');
      var yilT = tanlov('e-yil', 'Yil', yillar.map(function (y) { return [String(y), String(y)]; }), String(eksportHolat.yil), function (v) { eksportHolat.yil = parseInt(v, 10); chizish(zaxiraEkrani(), true); });
      yilT.quti.style.flex = '1';
      tanlar.appendChild(yilT.quti);
      if (eksportHolat.tur === 'oy') {
        var oyT = tanlov('e-oy', 'Oy', OY_NOMLARI_UI.map(function (n, i) { return [String(i + 1), n]; }), String(eksportHolat.oy), function (v) { eksportHolat.oy = parseInt(v, 10); chizish(zaxiraEkrani(), true); });
        oyT.quti.style.flex = '1';
        tanlar.appendChild(oyT.quti);
      }
      e.appendChild(tanlar);
    }
    var davr = { tur: eksportHolat.tur, yil: eksportHolat.yil, oy: eksportHolat.oy };
    var davrNomi = eksportHolat.tur === 'hammasi' ? 'hammasi' : eksportHolat.tur === 'yil' ? String(eksportHolat.yil) : eksportHolat.yil + '-' + (eksportHolat.oy < 10 ? '0' : '') + eksportHolat.oy;
    var yz = Calc.yozuvlarCSV(malumot.yozuvlar, malumot.hisoblar, malumot.kategoriyalar, davr), qz = Calc.qarzlarCSV(malumot.qarzlar, malumot.hisoblar, davr);
    e.appendChild(el('p', 'Fayl: UTF-8, ustunlar ";" bilan ajratilgan (Excel to\'g\'ri ochadi).', 'xira'));
    var yTugma = tugma('Yozuvlarni yuklab olish (' + yz.soni + ' ta)', 'ikkinchi-tugma', function () {
      if (!yz.soni) { qisqaXabar('Tanlangan davrda yozuv yo\'q'); return; }
      faylYuklash('moliya-yozuvlar-' + davrNomi + '.csv', yz.matn, 'text/csv;charset=utf-8');
      qisqaXabar('Yozuvlar yuklab olindi');
    });
    yTugma.id = 'eksport-yozuvlar';
    e.appendChild(yTugma);
    var qTugma = tugma('Qarzlar va to\'lovlarni yuklab olish (' + qz.soni + ' ta qator)', 'ikkinchi-tugma', function () {
      if (!qz.soni) { qisqaXabar('Tanlangan davrda qarz yoki to\'lov yo\'q'); return; }
      faylYuklash('moliya-qarzlar-' + davrNomi + '.csv', qz.matn, 'text/csv;charset=utf-8');
      qisqaXabar('Qarzlar yuklab olindi');
    });
    qTugma.id = 'eksport-qarzlar';
    e.appendChild(qTugma);
    bloklar.push(e);
    return bloklar;
  }
  var OY_NOMLARI_UI = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];

  // Bosh sahifa: oxirgi zaxira sanasi; 14 kundan oshsa (yoki hali olinmagan, lekin yozuv bor) eslatma
  function zaxiraKartasi() {
    var z = Calc.zaxiraHolati(malumot.zaxiraSanasi, Calc.bugun());
    var bor = malumot.yozuvlar.length + malumot.qarzlar.length > 0;
    var eslatma = z.holat === 'eski' || (z.holat === 'yoq' && bor);
    var k = karta();
    k.classList.add('zaxira-karta');
    if (eslatma) k.classList.add('ogohlantirish-karta');
    k.appendChild(el('h2', 'Zaxira nusxa'));
    k.appendChild(el('div', z.holat === 'yoq' ? 'Zaxira hali olinmagan' : 'Oxirgi zaxira: ' + Calc.sanaKorsat(malumot.zaxiraSanasi) + (z.kun === 0 ? ' (bugun)' : ' (' + z.kun + ' kun oldin)'), 'zaxira-sana'));
    if (eslatma) {
      var m = el('div', undefined, 'zaxira-eslatma');
      m.appendChild(el('strong', '⚠ ' + (z.holat === 'yoq' ? 'Zaxira olinmagan. ' : 'Oxirgi zaxiradan ' + z.kun + ' kun o\'tdi. ')));
      m.appendChild(document.createTextNode('Ma\'lumotlar faqat shu qurilmada saqlanadi: yo\'qolib qolmasligi uchun zaxira nusxa oling.'));
      k.appendChild(m);
      var t = tugma('Hozir zaxira olish', 'ikkinchi-tugma', function () {
        t.disabled = true;
        zaxiraniOlish(false).then(function () { qisqaXabar('Zaxira yuklab olindi'); korsat('bosh'); }).catch(function (x) { t.disabled = false; qisqaXabar('Zaxira olib bo\'lmadi: ' + x); });
      });
      t.id = 'bosh-zaxira';
      k.appendChild(t);
    }
    return k;
  }

  // Asosiydagi Xarajat / Daromadlar tanlovi qurilmada eslab qolinadi (xotira ishlamasa, xarajat)
  function asosiyTurniOl() {
    try { return localStorage.getItem('moliya-asosiy-tur') === 'daromad' ? 'daromad' : 'xarajat'; } catch (e) { return 'xarajat'; }
  }
  function asosiyTurniSaqla(t) {
    try { localStorage.setItem('moliya-asosiy-tur', t); } catch (e) { /* ahamiyatsiz */ }
  }

  // ---- Asosiy sahifa (faqat ko'rinish; hisob-kitoblar Calc dan) ----
  var asosiyOy = Calc.bugun().slice(0, 7);   // "Naqd pul oqimi" va "Kategoriyalar" uchun tanlangan oy (YYYY-MM)
  var asosiyTur = asosiyTurniOl();           // "Kategoriyalar": xarajat yoki daromad (qurilmada eslab qolinadi)

  // Summalar yashirilgan bo'lsa ••••
  function pul(n) { return malumot.balansYashirin ? '••••' : Calc.sumFormat(n); }
  function pulBelgili(n) { return malumot.balansYashirin ? '••••' : (n > 0 ? '+' : '') + Calc.sumFormat(n); }
  function asosiyniQayta() { chizish(bolimlar.bosh(malumot), true); }

  function balansniYashirish(yashirin) {
    var sozlama;
    return Data.olish('sozlamalar', 'asosiy').then(function (z) {
      sozlama = Object.assign({ kalit: 'asosiy', sxema_versiyasi: Data.SXEMA_VERSIYASI, oxirgi_zaxira_sanasi: null }, z || {}, { balans_yashirin: yashirin });
      return Data.saqlash('sozlamalar', sozlama);
    }).then(function () { malumot.balansYashirin = yashirin; asosiyniQayta(); })
      .catch(function (x) { qisqaXabar('Saqlab bo\'lmadi: ' + x); });
  }

  function bolimSarlavhasi(nom, ustId, hammasiMatni, hammasiFn, hammasiId) {
    var bosh = el('div', undefined, 'bolim-bosh');
    bosh.appendChild(el('h2', nom));
    if (hammasiFn) {
      var t = tugma(hammasiMatni || 'Hammasi', 'matn-tugma', hammasiFn);
      if (hammasiId) t.id = hammasiId;
      t.setAttribute('aria-label', nom.replace(/\s*\(.*\)/, '') + ': ' + (hammasiMatni || 'Hammasi'));
      bosh.appendChild(t);
    }
    return bosh;
  }

  function balansKartasi() {
    var k = karta();
    k.classList.add('balans-karta');
    var yuqori = el('div', undefined, 'balans-yuqori');
    yuqori.appendChild(el('span', 'Umumiy balans', 'xira'));
    var koz = belgiTugmasi(malumot.balansYashirin ? 'kozYopiq' : 'koz', malumot.balansYashirin ? 'Summalarni ko\'rsatish' : 'Summalarni yashirish',
      function () { balansniYashirish(!malumot.balansYashirin); }, 'koz-tugma');
    koz.setAttribute('aria-pressed', String(malumot.balansYashirin));
    koz.id = 'koz-tugma';
    yuqori.appendChild(koz);
    k.appendChild(yuqori);
    var katta = el('div', pul(Calc.umumiyBalans(malumot.hisoblar, malumot.yozuvlar, malumot.qarzlar)), 'balans-katta');
    katta.id = 'umumiy-balans';
    k.appendChild(katta);
    var past = el('div', undefined, 'balans-past');
    var son = el('span', faolHisoblar().length + ' ta hisob', 'xira hisob-soni');
    son.id = 'hisob-soni';
    past.appendChild(son);
    var bosh = tugma('Boshqarish ›', 'matn-tugma', function () { ochish(hisoblarEkrani, false); });
    bosh.id = 'hisoblarni-boshqarish';
    past.appendChild(bosh);
    k.appendChild(past);
    return k;
  }

  // Hisobotni berilgan oy bilan ochadi
  function hisobotniOchish(oyKalit) {
    hisobotHolat.tur = 'oy';
    hisobotHolat.sana = oyKalit + '-01';
    hisobotHolat.hisob = '';
    ochish(hisobotEkrani, false);
  }

  function oqimKartasi() {
    var k = karta();
    k.classList.add('oqim-karta');
    var bosh = el('div', undefined, 'bolim-bosh');
    bosh.appendChild(el('h2', 'Naqd pul oqimi'));
    var birinchi = malumot.yozuvlar.reduce(function (a, y) { return !a || y.sana < a ? y.sana : a; }, '');
    var oylar = Calc.oqimOylari(birinchi, Calc.bugun());
    if (oylar.indexOf(asosiyOy) === -1) asosiyOy = oylar[0];
    var sel = document.createElement('select');
    sel.id = 'asosiy-oy';
    sel.className = 'oy-tanlagich';
    sel.setAttribute('aria-label', 'Oyni tanlash');
    oylar.forEach(function (o) {
      var op = el('option', OY_NOMLARI_UI[parseInt(o.slice(5, 7), 10) - 1] + ' ' + o.slice(0, 4));
      op.value = o;
      sel.appendChild(op);
    });
    sel.value = asosiyOy;
    sel.addEventListener('change', function () { asosiyOy = sel.value; asosiyniQayta(); });
    bosh.appendChild(sel);
    k.appendChild(bosh);
    var oj = Calc.oyJami(malumot.yozuvlar, asosiyOy);
    var b = tugma(undefined, 'oqim-qator', function () { hisobotniOchish(asosiyOy); });
    b.id = 'oqim-qator';
    b.setAttribute('aria-label', 'Hisobotni ochish: ' + OY_NOMLARI_UI[parseInt(asosiyOy.slice(5, 7), 10) - 1] + ' ' + asosiyOy.slice(0, 4));
    [['Xarajat', pul(oj.xarajat), 'minus', 'oqim-xarajat'], ['Daromad', pul(oj.daromad), 'plus', 'oqim-daromad'], ['Sof balans', pulBelgili(oj.qoldiq), oj.qoldiq < 0 ? 'minus' : '', 'oqim-sof']].forEach(function (x) {
      var c = el('div', undefined, 'oqim-katak ' + x[3]);
      c.appendChild(el('div', x[0], 'xira'));
      c.appendChild(el('strong', x[1], x[2]));
      b.appendChild(c);
    });
    k.appendChild(b);
    return k;
  }

  // Tez qo'shish: tegishli tur oldindan tanlangan holda yozuv (5 qadam) yoki qarz oynasini ochadi
  function tezQoshish(tur) {
    qoshishOldingi = joriy === 'qoshish' ? qoshishOldingi : joriy;
    qoshishManba = 'tez';
    if (tur === 'berdim' || tur === 'oldim') {
      wiz = null;
      qoshishRejimi = 'qarz';
      qarzBoshYonalish = tur;
    } else {
      qoshishRejimi = 'yozuv';
      wiz = Calc.wizardTurAlmashtir(wizardYangi(), tur, faolHisoblar().map(function (h) { return h.id; }));
    }
    korsat('qoshish');
  }

  function tezQoshishKartasi() {
    var k = karta();
    k.classList.add('tez-karta-quti');
    k.appendChild(el('h2', 'Tez qo\'shish'));
    var surma = el('div', undefined, 'surma');
    surma.setAttribute('role', 'list');
    [['otkazma', 'O\'tkazma', 'almashuv'], ['xarajat', 'Xarajat qo\'shish', 'minus'], ['daromad', 'Daromad qo\'shish', 'plus'], ['berdim', 'Qarz berish', 'chiqim'], ['oldim', 'Qarz olish', 'kirim']].forEach(function (x) {
      var b = tugma(undefined, 'tez-karta', function () { tezQoshish(x[0]); });
      b.setAttribute('role', 'listitem');
      b.setAttribute('data-tez', x[0]);
      b.setAttribute('aria-label', x[1]);
      var rasm = el('span', undefined, 'tanlov-belgi');
      rasm.appendChild(svgBelgi(x[2], 24));
      b.appendChild(rasm);
      b.appendChild(el('span', x[1], 'tez-nom'));
      surma.appendChild(b);
    });
    k.appendChild(surma);
    return k;
  }

  function hisoblarKartasi() {
    var k = karta();
    k.classList.add('hisoblar-karta');
    var faol = faolHisoblar();
    var bosh = bolimSarlavhasi('Hisoblar (' + faol.length + ')', null, 'Hammasi', function () { ochish(hisoblarEkrani, false); }, 'hisoblar-hammasi');
    bosh.querySelector('h2').id = 'hisoblar-sarlavha';
    k.appendChild(bosh);
    var surma = el('div', undefined, 'surma');
    surma.setAttribute('role', 'list');
    faol.forEach(function (h) {
      var b = tugma(undefined, 'hisob-mini', function () { ochish(function () { return hisobShakli(h); }, true); });
      b.setAttribute('role', 'listitem');
      b.setAttribute('data-hisob', h.id);
      var ust = el('span', undefined, 'hisob-mini-ust');
      ust.appendChild(hisobBadge(h, 30));
      ust.appendChild(el('span', h.nom, 'hisob-mini-nom'));
      b.appendChild(ust);
      b.appendChild(el('strong', pul(Calc.hisobQoldigi(h, malumot.yozuvlar, malumot.qarzlar)), 'hisob-mini-qoldiq'));
      b.appendChild(el('span', hisobTuriNomi(h.tur) + (Calc.hisobMaskasi(h) ? ' · ' + Calc.hisobMaskasi(h) : ''), 'xira hisob-mini-tur'));
      surma.appendChild(b);
    });
    k.appendChild(surma);
    return k;
  }

  function kategoriyalarKartasi() {
    var k = karta();
    k.classList.add('kategoriyalar-karta', 'diagramma-karta');
    var birinchi = malumot.yozuvlar.reduce(function (a, y) { return !a || y.sana < a ? y.sana : a; }, '');
    var oylar = Calc.oqimOylari(birinchi, Calc.bugun());
    if (oylar.indexOf(asosiyOy) === -1) asosiyOy = oylar[0];
    var davr = Calc.hisobotDavri('oy', asosiyOy + '-01'), h = Calc.hisobot(malumot.yozuvlar, davr.dan, davr.gacha, '');
    var xarajat = asosiyTur === 'xarajat', taqsimot = xarajat ? h.xarajatTaqsimoti : h.daromadTaqsimoti;

    // sarlavha: nom, kichik son belgisi (tanlangan oy va turdagi, yozuvi bor kategoriyalar soni), "Hammasi"
    var bosh = el('div', undefined, 'bolim-bosh');
    var nomQism = el('div', undefined, 'bolim-nom');
    nomQism.appendChild(el('h2', 'Kategoriyalar'));
    var son = el('span', String(taqsimot.length), 'son-belgi');
    son.id = 'kategoriya-soni';
    son.setAttribute('aria-label', taqsimot.length + ' ta kategoriya');
    nomQism.appendChild(son);
    bosh.appendChild(nomQism);
    var hammasi = tugma('Hammasi', 'matn-tugma', function () { hisobotniOchish(asosiyOy); });
    hammasi.id = 'kategoriyalar-hammasi';
    hammasi.setAttribute('aria-label', 'Kategoriyalar: Hammasi (Hisobot)');
    bosh.appendChild(hammasi);
    k.appendChild(bosh);

    // Xarajat / Daromadlar: tugmaga o'xshash (tanlangani asosiy rangda to'ldirilgan); tanlov qurilmada eslab qolinadi
    var turlar = el('div', undefined, 'tanlov tur-tugmalari');
    turlar.setAttribute('role', 'group');
    turlar.setAttribute('aria-label', 'Kategoriya turi');
    [['xarajat', 'Xarajat'], ['daromad', 'Daromadlar']].forEach(function (t) {
      var b = tugma(t[1], undefined, function () { asosiyTur = t[0]; asosiyTurniSaqla(t[0]); asosiyniQayta(); });
      b.setAttribute('aria-pressed', String(asosiyTur === t[0]));
      b.setAttribute('data-turi', t[0]);
      turlar.appendChild(b);
    });
    k.appendChild(turlar);

    // oy strelkalari: "Naqd pul oqimi" oy tanlagichi bilan bitta umumiy oy holati (asosiyOy)
    function kochir(n) { asosiyOy = Calc.oyKochir(oylar, asosiyOy, n).oy; asosiyniQayta(); }
    var yon = [
      { belgi: '‹', ariya: 'Oldingi oy', bosilganda: function () { kochir(-1); }, ochiq: oylar.indexOf(asosiyOy) < oylar.length - 1 },
      { belgi: '›', ariya: 'Keyingi oy', bosilganda: function () { kochir(1); }, ochiq: oylar.indexOf(asosiyOy) > 0 }
    ];
    if (!taqsimot.length) {
      var bosM = el('div', undefined, 'dona-bosh');
      bosM.appendChild(el('strong', OY_NOMLARI_UI[parseInt(asosiyOy.slice(5, 7), 10) - 1] + ' ' + asosiyOy.slice(0, 4)));
      bosM.appendChild(el('p', 'Bu oyda ' + (xarajat ? 'xarajat' : 'daromad') + ' yo\'q.', 'xira'));
      k.appendChild(Diagramma.donaQatori(bosM, yon));
      return k;
    }
    k.appendChild(Diagramma.dona({
      taqsimot: taqsimot, jami: xarajat ? h.xarajat : h.daromad, kategoriya: kategoriyaOl, turNomi: xarajat ? 'Xarajatlar' : 'Daromadlar', markazNom: davr.nom, yashirin: malumot.balansYashirin,
      yonTugmalari: yon,
      bosilganda: function (id) { yozuvlarniOchish({ tur: asosiyTur, kategoriya: id, dan: davr.dan, gacha: davr.gacha, hisob: '' }); },
      guruhBosilganda: function (idlar) { yozuvlarniOchish({ tur: asosiyTur, kategoriyalar: idlar, dan: davr.dan, gacha: davr.gacha, hisob: '' }); }
    }));
    return k;
  }

  function byudjetlarKartasi() {
    var k = karta();
    k.classList.add('byudjetlar-karta', 'byudjet-karta');
    var h = byudjetHisobi(), bor = h.chegarali.length || h.umumiy;
    k.appendChild(bolimSarlavhasi('Byudjetlar', null, bor ? 'Hammasi' : null, bor ? function () { ochish(byudjetEkrani, false); } : null, 'byudjetlar-hammasi'));
    if (!bor) {
      var q = tugma('+ Byudjet qo\'shish', 'ikkinchi-tugma byudjet-qoshish', function () { ochish(byudjetEkrani, false); });
      q.id = 'byudjet-qoshish';
      k.appendChild(q);
      return k;
    }
    if (!h.ogohlantirishlar.length) {
      k.appendChild(el('p', '✓ Hamma chegara me\'yorda (80% dan past).', 'xira'));
      return k;
    }
    h.ogohlantirishlar.forEach(function (x) {
      k.appendChild(byudjetQatori(x.umumiy ? 'Umumiy oylik chegara' : x.kategoriya.nom, x.umumiy ? null : x.kategoriya, x.holat, function () { ochish(byudjetEkrani, false); }, true, malumot.balansYashirin));
    });
    return k;
  }

  function qarzlarKartasi() {
    var k = karta();
    k.classList.add('qarzlar-karta');
    var bugun = Calc.bugun(), g = Calc.qarzlarShaxsBoyicha(malumot.qarzlar, bugun), ochiq = [];
    g.ochiq.forEach(function (gr) { gr.qarzlar.forEach(function (q) { ochiq.push(q); }); });
    var bosh = bolimSarlavhasi('Qarzlar (' + ochiq.length + ')', null, 'Hammasi', function () { korsat('qarzlar'); }, 'qarzlar-hammasi');
    bosh.querySelector('h2').id = 'qarzlar-sarlavha';
    k.appendChild(bosh);
    if (!ochiq.length) { k.appendChild(el('p', 'Ochiq qarzlar yo\'q.', 'xira')); return k; }
    var surma = el('div', undefined, 'surma');
    surma.setAttribute('role', 'list');
    ochiq.forEach(function (q) { var c = qarzKartasi(q, bugun, true); c.setAttribute('role', 'listitem'); surma.appendChild(c); });
    k.appendChild(surma);
    return k;
  }

  function asosiyBolimi() {
    return [el('h1', 'Asosiy'), balansKartasi(), oqimKartasi(), tezQoshishKartasi(), hisoblarKartasi(), kategoriyalarKartasi(), byudjetlarKartasi(), qarzlarKartasi(), zaxiraKartasi()];
  }

  // ---- Bo'limlar ----
  var bolimlar = {
    bosh: asosiyBolimi,
    tarix: function () { return yozuvlarEkrani(true); },
    qoshish: function () {
      if (qoshishRejimi !== 'qarz') return wizardEkrani();
      var tez = qoshishManba === 'tez';
      return qarzShakli(null, {
        orqaga: tez ? function () { qoshishRejimi = 'yozuv'; korsat(qoshishOldingi); } : qarzdanOrqaga,
        saqlandi: function () { qoshishRejimi = 'yozuv'; korsat('qarzlar'); }
      }, qarzBoshYonalish);
    },
    qarzlar: qarzlarBolimi,
    koproq: koproqMenyusi
  };

  function chizish(bloklar, scrollniSaqla) {
    var y = window.pageYOffset;
    Diagramma.maslahatYashir();
    ekran.textContent = '';
    bloklar.forEach(function (b) { ekran.appendChild(b); });
    window.scrollTo(0, scrollniSaqla ? y : 0);
    // data-fokus belgili maydon (yozuv qo'shishning 1-qadamida summa) tayyor turadi: telefonda raqamli klaviatura ochiladi
    var f = ekran.querySelector('[data-fokus]');
    if (f) f.focus();
  }

  function korsat(nom) {
    if (nom === 'yana' || nom === 'hisobot' || nom === 'byudjet') nom = 'koproq';   // eski saqlangan tanlov
    if (!bolimlar[nom]) nom = 'bosh';
    if (nom !== 'qoshish') { xabar = ''; wiz = null; qoshishRejimi = 'yozuv'; }   // boshqa bo'limga o'tilsa, yozuv shakli tozalanadi
    joriy = nom;
    stek = [];
    tugmalar.forEach(function (t) {
      var faol = t.getAttribute('data-bolim') === nom;
      t.classList.toggle('faol', faol);
      if (faol) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    try { sessionStorage.setItem('bolim', nom); } catch (e) { /* ahamiyatsiz */ }
    chizish(bolimlar[nom](malumot));
  }

  // Bo'lim ichidagi ekranni ochadi. forma=true bo'lsa, ro'yxatlar yangilanganda u buzilmaydi.
  function ochish(yasash, forma) {
    stek.push({ yasash: yasash, forma: !!forma });
    chizish(yasash());
  }

  // Bitta ekran orqaga: oldingi ichki ekranga (yangi ma'lumot bilan), yo'q bo'lsa bo'limning o'ziga
  function orqaga() {
    stek.pop();
    if (stek.length) chizish(stek[stek.length - 1].yasash());
    else korsat(joriy);
  }

  // Ko'rinib turgan ro'yxatni yangilaydi (yozilayotgan shaklga tegmaydi)
  function yangilash() {
    var oxirgi = stek[stek.length - 1];
    if (oxirgi) { if (!oxirgi.forma) chizish(oxirgi.yasash()); }
    else if (joriy === 'bosh' || joriy === 'tarix' || joriy === 'qarzlar' || joriy === 'koproq') korsat(joriy);
  }

  tugmalar.forEach(function (t) {
    t.addEventListener('click', function () {
      // "+" darhol shaklni emas, tanlov oynasini ochadi
      if (t.getAttribute('data-bolim') === 'qoshish') yangiYozuvOynasi(); else korsat(t.getAttribute('data-bolim'));
    });
  });

  function yuklash() {
    return Promise.all([Data.hammasi('hisoblar'), Data.hammasi('kategoriyalar'), Data.hammasi('yozuvlar'), Data.hammasi('byudjetlar'), Data.hammasi('qarzlar')]).then(function (r) {
      malumot.byudjetlar = r[3];
      malumot.qarzlar = r[4];
      malumot.hisoblar = r[0].sort(function (a, b) { return a.yaratilgan < b.yaratilgan ? -1 : 1; });
      malumot.yozuvlar = r[2];
      malumot.kategoriyalar = r[1].sort(function (a, b) { return a.yaratilgan < b.yaratilgan ? -1 : 1; });
      return Data.olish('sozlamalar', 'asosiy');
    }).then(function (sozlama) {
      malumot.zaxiraSanasi = sozlama ? sozlama.oxirgi_zaxira_sanasi || null : null;
      malumot.balansYashirin = !!(sozlama && sozlama.balans_yashirin === true);
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
