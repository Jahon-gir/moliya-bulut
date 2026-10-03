// Ekranlar: bo'limlar almashishi, yozuv qo'shish/tahrirlash, yozuvlar ro'yxati, hisoblar, bosh sahifa.
(function () {
  'use strict';

  var ekran = document.getElementById('ekran');
  var tugmalar = document.querySelectorAll('[data-bolim]');
  var keyingiBosqich = 'Bu bo\'lim keyingi bosqichlarda quriladi.';

  var malumot = { hisoblar: [], kategoriyalar: [], yozuvlar: [] };
  var xabar = '';          // "Saqlandi" xabari, faqat qo'shish ekranida bir marta ko'rsatiladi
  var joriy = 'bosh';      // hozirgi bo'lim
  var stek = [];           // bo'lim ichidagi ochiq ekranlar: [{ yasash, forma }]; "Orqaga" oxirgisini yopadi
  var hisobotHolat = { tur: 'oy', sana: null, hisob: '' };   // Hisobot bo'limi: davr turi, davrdagi sana, hisob filtri
  var filtr = bosFiltr();  // "Barcha yozuvlar" filtri (ilova ochiq turguncha eslab qolinadi)
  var VERSIYA = (document.querySelector('meta[name="versiya"]') || {}).content || '?';
  var YOZUVLAR_SAHIFASI = 300;   // "Barcha yozuvlar" da bir vaqtda ko'rsatiladigan yozuvlar (butun kunlar bilan)
  var RANGLAR = ['#e57373', '#f06292', '#ba68c8', '#9575cd', '#64b5f6', '#4dd0e1', '#26a69a',
    '#81c784', '#aed581', '#ffd54f', '#ffb74d', '#a1887f', '#90a4ae'];

  var TUR_NOMI = { xarajat: 'Xarajat', daromad: 'Daromad', otkazma: 'O\'tkazma' };
  var HISOB_TURI = [['naqd', 'Naqd'], ['karta', 'Karta'], ['boshqa', 'Boshqa']];

  function bosFiltr() {
    return { tur: '', hisob: '', kategoriya: '', dan: '', gacha: '', qidiruv: '' };
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
    var nuqta = el('span', undefined, 'nuqta');
    nuqta.style.background = otkazma ? '#90a4ae' : (k ? k.rang : '#90a4ae');
    nom.appendChild(nuqta);
    nom.appendChild(document.createTextNode(otkazma ? 'O\'tkazma' : (k ? k.nom : 'Kategoriyasiz')));
    // Bazada oldindan qolgan, vaqti hozirdan keyingi yozuvlar belgilab ko'rsatiladi
    if (hozirgi && Calc.kelajakmi(y.sana, Calc.yozuvVaqti(y), hozirgi)) nom.appendChild(el('span', 'Kelajak', 'belgi-kelajak'));
    chap.appendChild(nom);
    var tafsilot = Calc.yozuvVaqti(y) + ' · ' + (otkazma
      ? hisobNomi(y.hisob_id) + ' → ' + hisobNomi(y.qabul_hisob_id)
      : hisobNomi(y.hisob_id));
    if (y.izoh) tafsilot += ' · ' + y.izoh;
    chap.appendChild(el('div', tafsilot, 'yozuv-izoh'));
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
        var n = el('span', undefined, 'nuqta');
        n.style.background = k.rang;
        c.appendChild(n);
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
    else { wiz = null; korsat('bosh'); }   // 1-qadamda "Orqaga" shaklni yopadi va tozalaydi
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
      b.appendChild(el('span', k.nom, 'katak-nom'));
      if (k.id === oxirgi) { b.classList.add('oxirgi'); b.appendChild(el('span', '★ Oxirgi', 'katak-oxirgi')); }
      tur.appendChild(b);
    });
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
      var chap = el('span', undefined, 'yozuv-chap');
      chap.appendChild(el('span', h.nom, 'yozuv-nom'));
      chap.appendChild(el('span', hisobTuriNomi(h.tur), 'yozuv-izoh hisob-turi'));
      b.appendChild(chap);
      b.appendChild(el('span', Calc.sumFormat(Calc.hisobQoldigi(h, malumot.yozuvlar)), 'yozuv-summa'));
      quti.appendChild(b);
    });
    if (!royxat.length) {
      quti.appendChild(el('p', 'O\'tkazma uchun kamida ikkita hisob kerak. "Yana" bo\'limida hisob qo\'shing.', 'xira'));
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

  function hisoblarEkrani() {
    var bloklar = [orqagaTugmasi(), el('h1', 'Hisoblar')];
    var k = karta();
    faolHisoblar().forEach(function (h) {
      var q = tugma(undefined, 'yozuv', function () { ochish(function () { return hisobShakli(h); }, true); });
      var chap = el('div', undefined, 'yozuv-chap');
      chap.appendChild(el('div', h.nom, 'yozuv-nom'));
      chap.appendChild(el('div', hisobTuriNomi(h.tur), 'yozuv-izoh'));
      q.appendChild(chap);
      q.appendChild(el('div', Calc.sumFormat(Calc.hisobQoldigi(h, malumot.yozuvlar)), 'yozuv-summa'));
      k.appendChild(q);
    });
    bloklar.push(k);
    bloklar.push(tugma('+ Hisob qo\'shish', 'ikkinchi-tugma', function () {
      ochish(function () { return hisobShakli(null); }, true);
    }));
    return bloklar;
  }

  // Yangi hisob qo'shish yoki mavjudining nomini o'zgartirish / arxivlash
  function hisobShakli(h) {
    var bloklar = [orqagaTugmasi(), el('h1', h ? 'Hisobni tahrirlash' : 'Yangi hisob')];
    var forma = document.createElement('form');
    forma.noValidate = true;
    forma.className = 'karta';

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

    var tur = h ? h.tur : 'karta';
    var qoldiq = null;
    if (h) {
      var q = el('div', undefined, 'maydon');
      q.appendChild(el('span', 'Turi: ' + hisobTuriNomi(h.tur), 'xira'));
      forma.appendChild(q);
      // Joriy qoldiq ko'rsatiladi va tahrirlanadi; yozuvlar o'zgarmaydi (farq boshlang'ich qoldiqqa qo'shiladi)
      qoldiq = summaMaydoni('h-qoldiq', 'Hozirgi qoldiq (so\'m)', Calc.raqamFormat(String(Calc.hisobQoldigi(h, malumot.yozuvlar))));
      forma.appendChild(qoldiq.quti);
      forma.appendChild(el('p', 'Qoldiqni to\'g\'rilasangiz, yozuvlar va hisobotlar o\'zgarmaydi.', 'xira'));
    } else {
      var turMaydon = el('div', undefined, 'maydon');
      turMaydon.appendChild(el('span', 'Turi', 'belgi'));
      var turQator = el('div', undefined, 'tanlov');
      var turTugmalari = {};
      HISOB_TURI.forEach(function (t) {
        turTugmalari[t[0]] = tugma(t[1], undefined, function () {
          tur = t[0];
          Object.keys(turTugmalari).forEach(function (x) { turTugmalari[x].setAttribute('aria-pressed', String(x === tur)); });
        });
        turTugmalari[t[0]].setAttribute('aria-pressed', String(t[0] === tur));
        turQator.appendChild(turTugmalari[t[0]]);
      });
      turMaydon.appendChild(turQator);
      forma.appendChild(turMaydon);
      qoldiq = summaMaydoni('h-qoldiq', 'Hozirgi qoldiq (so\'m)', '');
      forma.appendChild(qoldiq.quti);
    }

    var saqla = el('button', 'Saqlash', 'asosiy-tugma');
    saqla.type = 'submit';
    forma.appendChild(saqla);

    forma.addEventListener('submit', function (e) {
      e.preventDefault();
      var n = Calc.hisobNomTekshir(nom.value, faolHisoblar(), h ? h.id : undefined);
      var b = Calc.qoldiqTekshir(qoldiq.input.value, !!h);   // tahrirda manfiy mumkin, bo'sh qoldirib bo'lmaydi
      if (n.xato) { nomXato.textContent = n.xato; nom.classList.add('xatoli'); }
      if (b.xato) { qoldiq.xato.textContent = b.xato; qoldiq.input.classList.add('xatoli'); }
      if (n.xato || b.xato) { (n.xato ? nom : qoldiq.input).focus(); return; }
      var yangi = h
        ? { id: h.id, yaratilgan: h.yaratilgan, nom: n.nom, tur: h.tur,
            boshlangich_qoldiq: Calc.yangiBoshlangichQoldiq(h, malumot.yozuvlar, b.summa), arxivlangan: h.arxivlangan }
        : { id: Data.yangiId(), yaratilgan: new Date().toISOString(), nom: n.nom, tur: tur,
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
        var qoldigi = Calc.hisobQoldigi(h, malumot.yozuvlar);
        var matn = '"' + h.nom + '" hisobi ro\'yxatdan yashiriladi, eski yozuvlari saqlanadi.' +
          (qoldigi !== 0 ? '\n\nUnda ' + Calc.sumFormat(qoldigi) + ' bor. Arxivlansa, umumiy balansga kirmaydi.' : '') +
          '\n\nArxivlansinmi?';
        if (!window.confirm(matn)) return;
        hisobniSaqlash({ id: h.id, yaratilgan: h.yaratilgan, nom: h.nom, tur: h.tur,
          boshlangich_qoldiq: h.boshlangich_qoldiq, arxivlangan: true }, 'Hisob arxivlandi');
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
  function kategoriyalarEkrani() {
    var bloklar = [orqagaTugmasi(), el('h1', 'Kategoriyalar')];
    [['xarajat', 'Xarajat kategoriyalari'], ['daromad', 'Daromad kategoriyalari']].forEach(function (t) {
      var k = karta();
      k.appendChild(el('h2', t[1]));
      malumot.kategoriyalar.filter(function (x) { return x.tur === t[0] && !x.arxivlangan; }).forEach(function (x) {
        var q = tugma(undefined, 'yozuv', function () { ochish(function () { return kategoriyaShakli(x); }, true); });
        var nom = el('div', undefined, 'yozuv-nom');
        var n = el('span', undefined, 'nuqta');
        n.style.background = x.rang;
        nom.appendChild(n);
        nom.appendChild(document.createTextNode(x.nom));
        q.appendChild(nom);
        k.appendChild(q);
      });
      bloklar.push(k);
    });
    bloklar.push(tugma('+ Kategoriya qo\'shish', 'ikkinchi-tugma', function () {
      ochish(function () { return kategoriyaShakli(null); }, true);
    }));
    return bloklar;
  }

  // Yangi kategoriya qo'shish yoki mavjudining nomi/rangini o'zgartirish yoki arxivlash
  function kategoriyaShakli(k) {
    var holat = { tur: k ? k.tur : 'xarajat', rang: k ? k.rang : RANGLAR[0] };
    var bloklar = [orqagaTugmasi(), el('h1', k ? 'Kategoriyani tahrirlash' : 'Yangi kategoriya')];
    var forma = document.createElement('form');
    forma.noValidate = true;
    forma.className = 'karta';

    if (k) {
      var t = el('div', undefined, 'maydon');
      t.appendChild(el('span', 'Turi: ' + (k.tur === 'daromad' ? 'daromad' : 'xarajat'), 'xira'));
      forma.appendChild(t);
    } else {
      var turMaydon = el('div', undefined, 'maydon');
      turMaydon.appendChild(el('span', 'Turi', 'belgi'));
      var turQator = el('div', undefined, 'tanlov');
      var turTugmalari = {};
      [['xarajat', 'Xarajat'], ['daromad', 'Daromad']].forEach(function (x) {
        turTugmalari[x[0]] = tugma(x[1], undefined, function () {
          holat.tur = x[0];
          Object.keys(turTugmalari).forEach(function (y) { turTugmalari[y].setAttribute('aria-pressed', String(y === holat.tur)); });
        });
        turTugmalari[x[0]].setAttribute('aria-pressed', String(x[0] === holat.tur));
        turQator.appendChild(turTugmalari[x[0]]);
      });
      turMaydon.appendChild(turQator);
      forma.appendChild(turMaydon);
    }

    var nomMaydon = el('div', undefined, 'maydon');
    var nomBelgi = el('label', 'Nomi');
    nomBelgi.setAttribute('for', 'k-nom');
    var nom = document.createElement('input');
    nom.id = 'k-nom';
    nom.type = 'text';
    nom.autocomplete = 'off';
    nom.value = k ? k.nom : '';
    var nomXato = el('div', undefined, 'xato-matn');
    nomMaydon.appendChild(nomBelgi);
    nomMaydon.appendChild(nom);
    nomMaydon.appendChild(nomXato);
    forma.appendChild(nomMaydon);
    nom.addEventListener('input', function () { nomXato.textContent = ''; nom.classList.remove('xatoli'); });

    // Rang: tayyor ranglardan tanlanadi (kategoriyaning hozirgi rangi ro'yxatda bo'lmasa, u ham qo'shiladi)
    var rangMaydon = el('div', undefined, 'maydon');
    rangMaydon.appendChild(el('span', 'Rang', 'belgi'));
    var ranglar = el('div', undefined, 'ranglar');
    var royxat = RANGLAR.indexOf(holat.rang) === -1 ? [holat.rang].concat(RANGLAR) : RANGLAR;
    royxat.forEach(function (r, i) {
      var b = tugma(undefined, 'rang-tugma', function () {
        holat.rang = r;
        Array.prototype.forEach.call(ranglar.children, function (x) { x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
      });
      b.style.background = r;
      b.setAttribute('aria-label', 'Rang ' + (i + 1));
      b.setAttribute('aria-pressed', String(r === holat.rang));
      ranglar.appendChild(b);
    });
    rangMaydon.appendChild(ranglar);
    forma.appendChild(rangMaydon);

    var saqla = el('button', 'Saqlash', 'asosiy-tugma');
    saqla.type = 'submit';
    forma.appendChild(saqla);

    forma.addEventListener('submit', function (e) {
      e.preventDefault();
      var n = Calc.kategoriyaNomTekshir(nom.value, malumot.kategoriyalar.filter(function (x) {
        return x.tur === holat.tur && !x.arxivlangan;
      }), k ? k.id : undefined);
      if (n.xato) { nomXato.textContent = n.xato; nom.classList.add('xatoli'); nom.focus(); return; }
      saqla.disabled = true;
      kategoriyaniSaqlash({
        id: k ? k.id : Data.yangiId(), yaratilgan: k ? k.yaratilgan : new Date().toISOString(),
        nom: n.nom, tur: holat.tur, rang: holat.rang, arxivlangan: k ? k.arxivlangan : false
      }, k ? 'Kategoriya yangilandi' : 'Kategoriya qo\'shildi');
    });
    bloklar.push(forma);

    if (k) {
      bloklar.push(tugma('Arxivlash', 'xavfli-tugma', function () {
        var shuTurda = malumot.kategoriyalar.filter(function (x) { return x.tur === k.tur && !x.arxivlangan; });
        if (shuTurda.length < 2) {
          qisqaXabar('Bu turdagi oxirgi kategoriyani arxivlab bo\'lmaydi');
          return;
        }
        if (!window.confirm('"' + k.nom + '" kategoriyasi yangi yozuv shaklida ko\'rinmaydi, eski yozuvlari va hisobotlarda saqlanadi.\n\nArxivlansinmi?')) return;
        kategoriyaniSaqlash({ id: k.id, yaratilgan: k.yaratilgan, nom: k.nom, tur: k.tur, rang: k.rang, arxivlangan: true },
          'Kategoriya arxivlandi');
      }));
    }
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

  function yozuvlarEkrani() {
    var bloklar = [orqagaTugmasi(), el('h1', 'Barcha yozuvlar')];
    var chegara = YOZUVLAR_SAHIFASI;

    var qidiruv = document.createElement('input');
    qidiruv.type = 'search';
    qidiruv.id = 'q-izoh';
    qidiruv.placeholder = 'Izoh bo\'yicha qidirish';
    qidiruv.setAttribute('aria-label', 'Izoh bo\'yicha qidirish');
    qidiruv.autocomplete = 'off';
    qidiruv.value = filtr.qidiruv;
    var qidiruvQuti = el('div', undefined, 'maydon');
    qidiruvQuti.appendChild(qidiruv);
    bloklar.push(qidiruvQuti);

    var tafsilot = document.createElement('details');
    tafsilot.className = 'karta filtr-quti';
    tafsilot.open = Calc.filtrFaolmi(filtr);
    tafsilot.appendChild(el('summary', 'Filtr'));

    var natija = el('div');
    var son = el('p', undefined, 'xira');
    var sanaXabar = el('div', undefined, 'xato-matn');
    var kategoriyaTanlovi = null;

    function kategoriyaVariantlari() {
      var v = [['', 'Barchasi']];
      malumot.kategoriyalar.filter(function (k) { return !filtr.tur || k.tur === filtr.tur; }).forEach(function (k) {
        v.push([k.id, k.nom + (filtr.tur ? '' : ' · ' + (k.tur === 'daromad' ? 'daromad' : 'xarajat')) + (k.arxivlangan ? ' (arxiv)' : '')]);
      });
      return v;
    }
    function kategoriyaniYangila() {
      var s = kategoriyaTanlovi.select;
      s.textContent = '';
      kategoriyaVariantlari().forEach(function (v) { var o = el('option', v[1]); o.value = v[0]; s.appendChild(o); });
      s.value = filtr.kategoriya;
      s.disabled = filtr.tur === 'otkazma';
    }

    var turT = tanlov('q-tur', 'Tur', [['', 'Barchasi'], ['xarajat', 'Xarajat'], ['daromad', 'Daromad'], ['otkazma', 'O\'tkazma']],
      filtr.tur, function (v) {
        filtr.tur = v;
        var k = kategoriyaOl(filtr.kategoriya);
        if (v === 'otkazma' || (k && v && k.tur !== v)) filtr.kategoriya = '';
        kategoriyaniYangila();
        chiz();
      });
    var hisobT = tanlov('q-hisob', 'Hisob',
      [['', 'Barchasi']].concat(malumot.hisoblar.map(function (h) { return [h.id, h.nom + (h.arxivlangan ? ' (arxiv)' : '')]; })),
      filtr.hisob, function (v) { filtr.hisob = v; chiz(); });
    kategoriyaTanlovi = tanlov('q-kategoriya', 'Kategoriya', kategoriyaVariantlari(), filtr.kategoriya,
      function (v) { filtr.kategoriya = v; chiz(); });
    kategoriyaTanlovi.select.disabled = filtr.tur === 'otkazma';
    tafsilot.appendChild(turT.quti);
    tafsilot.appendChild(hisobT.quti);
    tafsilot.appendChild(kategoriyaTanlovi.quti);
    tafsilot.appendChild(sanaTanlovi('q-dan', 'Sanadan', filtr.dan, function (v) { filtr.dan = v; chiz(); }));
    tafsilot.appendChild(sanaTanlovi('q-gacha', 'Sanagacha', filtr.gacha, function (v) { filtr.gacha = v; chiz(); }));
    tafsilot.appendChild(sanaXabar);
    tafsilot.appendChild(tugma('Filtrni tozalash', 'ikkinchi-tugma', function () {
      filtr = bosFiltr();
      chizish(yozuvlarEkrani());
    }));
    bloklar.push(tafsilot);
    bloklar.push(son);
    bloklar.push(natija);

    function chiz() {
      filtr.qidiruv = qidiruv.value;
      sanaXabar.textContent = filtr.dan && filtr.gacha && filtr.dan > filtr.gacha
        ? 'Boshlanish sanasi tugash sanasidan keyin bo\'lishi mumkin emas' : '';
      var r = Calc.yozuvlarniSuz(malumot.yozuvlar, filtr);
      natija.textContent = '';
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

  // ---- "Yana" bo'limi: ichki ekranlarga menyu ----
  function yanaMenyusi() {
    var bloklar = [el('h1', 'Yana')];
    var k = karta();
    [
      ['Barcha yozuvlar', malumot.yozuvlar.length + ' ta', yozuvlarEkrani],
      ['Hisoblar', faolHisoblar().length + ' ta', hisoblarEkrani],
      ['Kategoriyalar', malumot.kategoriyalar.filter(function (x) { return !x.arxivlangan; }).length + ' ta', kategoriyalarEkrani]
    ].forEach(function (m) {
      var q = tugma(undefined, 'yozuv', function () { ochish(m[2], false); });
      q.appendChild(el('div', m[0], 'yozuv-nom'));
      q.appendChild(el('div', m[1] + ' ›', 'yozuv-izoh'));
      k.appendChild(q);
    });
    bloklar.push(k);
    bloklar.push(el('p', 'Moliya · versiya ' + VERSIYA, 'versiya'));
    return bloklar;
  }

  // ---- Hisobot ----
  var DAVR_TURLARI = [['kun', 'Kun'], ['hafta', 'Hafta'], ['oy', 'Oy'], ['yil', 'Yil']];

  function taqsimotKartasi(sarlavha, royxat) {
    var k = karta();
    k.appendChild(el('h2', sarlavha));
    if (!royxat.length) {
      k.appendChild(el('p', 'Bu davrda yozuv yo\'q.', 'xira'));
      return k;
    }
    royxat.forEach(function (x) {
      var kat = kategoriyaOl(x.kategoriya_id);
      var q = el('div', undefined, 'qator taqsimot-qator');
      var chap = el('span', undefined, 'yozuv-nom');
      var nuqta = el('span', undefined, 'nuqta');
      nuqta.style.background = kat ? kat.rang : '#90a4ae';
      chap.appendChild(nuqta);
      chap.appendChild(document.createTextNode(kat ? kat.nom : 'Kategoriyasiz'));
      q.appendChild(chap);
      q.appendChild(el('span', Calc.sumFormat(x.summa) + ' · ' + x.foiz + '%', 'taqsimot-summa'));
      k.appendChild(q);
    });
    return k;
  }

  function hisobotEkrani() {
    var h = hisobotHolat;
    if (!h.sana) h.sana = Calc.bugun();
    var bloklar = [el('h1', 'Hisobot')];
    function qayta() { chizish(hisobotEkrani(), true); }

    // Davr turi
    var turQator = el('div', undefined, 'tanlov');
    DAVR_TURLARI.forEach(function (t) {
      var b = tugma(t[1], undefined, function () { h.tur = t[0]; qayta(); });
      b.setAttribute('aria-pressed', String(h.tur === t[0]));
      turQator.appendChild(b);
    });
    var turMaydon = el('div', undefined, 'maydon');
    turMaydon.appendChild(turQator);
    bloklar.push(turMaydon);

    // Oldingi / bugun / keyingi
    var chegara = Calc.davrChegarasi(h.tur, h.sana);
    var nav = el('div', undefined, 'davr-nav');
    nav.appendChild(tugma('‹ Oldingi', 'ikkinchi-tugma', function () { h.sana = Calc.davrniSur(h.tur, h.sana, -1); qayta(); }));
    nav.appendChild(tugma('Bugun', 'ikkinchi-tugma', function () { h.sana = Calc.bugun(); qayta(); }));
    nav.appendChild(tugma('Keyingi ›', 'ikkinchi-tugma', function () { h.sana = Calc.davrniSur(h.tur, h.sana, 1); qayta(); }));
    bloklar.push(nav);
    var nom = el('div', Calc.davrNomi(h.tur, h.sana), 'davr-nomi');
    nom.setAttribute('aria-live', 'polite');
    bloklar.push(nom);

    // Hisob filtri
    var hisobT = tanlov('r-hisob', 'Hisob',
      [['', 'Barcha hisoblar']].concat(malumot.hisoblar.map(function (x) { return [x.id, x.nom + (x.arxivlangan ? ' (arxiv)' : '')]; })),
      h.hisob, function (v) { h.hisob = v; qayta(); });
    bloklar.push(hisobT.quti);

    var joriyH = Calc.hisobot(malumot.yozuvlar, chegara.dan, chegara.gacha, h.hisob);
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

    // Oldingi davr bilan taqqoslash (xarajat)
    var oldingiSana = Calc.davrniSur(h.tur, h.sana, -1);
    var oldingiC = Calc.davrChegarasi(h.tur, oldingiSana);
    var oldingiH = Calc.hisobot(malumot.yozuvlar, oldingiC.dan, oldingiC.gacha, h.hisob);
    var t = Calc.taqqoslash(joriyH.xarajat, oldingiH.xarajat);
    var tk = karta();
    tk.appendChild(el('h2', 'Oldingi davr bilan (' + Calc.davrNomi(h.tur, oldingiSana) + ')'));
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

    bloklar.push(taqsimotKartasi('Xarajatlar kategoriyalar bo\'yicha', joriyH.xarajatTaqsimoti));
    bloklar.push(taqsimotKartasi('Daromadlar kategoriyalar bo\'yicha', joriyH.daromadTaqsimoti));
    return bloklar;
  }

  // ---- Bo'limlar ----
  var bolimlar = {
    bosh: function (m) {
      var bloklar = [el('h1', 'Bosh sahifa')];

      var jami = karta();
      jami.appendChild(el('div', 'Umumiy balans', 'xira'));
      jami.appendChild(el('div', Calc.sumFormat(Calc.umumiyBalans(m.hisoblar, m.yozuvlar)), 'balans-katta'));
      bloklar.push(jami);

      // Joriy oy (bugungi sana tushgan oy): faqat daromad va xarajat, o'tkazma kirmaydi
      var oy = Calc.davrChegarasi('oy', Calc.bugun());
      var oyHisoboti = Calc.hisobot(m.yozuvlar, oy.dan, oy.gacha, '');
      var juft = el('div', undefined, 'juft');
      [['Shu oy daromadi', oyHisoboti.daromad, 'plus'], ['Shu oy xarajati', oyHisoboti.xarajat, 'minus']].forEach(function (x) {
        var c = karta();
        c.appendChild(el('div', x[0], 'xira'));
        c.appendChild(el('div', Calc.sumFormat(x[1]), 'oy-summa ' + x[2]));
        juft.appendChild(c);
      });
      bloklar.push(juft);

      var k = karta();
      k.appendChild(el('h2', 'Hisoblar'));
      faolHisoblar().forEach(function (h) {
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
    hisobot: hisobotEkrani,
    qoshish: wizardEkrani,
    byudjet: function () { return tayyorBolim('Byudjet'); },
    yana: yanaMenyusi
  };

  function chizish(bloklar, scrollniSaqla) {
    var y = window.pageYOffset;
    ekran.textContent = '';
    bloklar.forEach(function (b) { ekran.appendChild(b); });
    window.scrollTo(0, scrollniSaqla ? y : 0);
    // data-fokus belgili maydon (yozuv qo'shishning 1-qadamida summa) tayyor turadi: telefonda raqamli klaviatura ochiladi
    var f = ekran.querySelector('[data-fokus]');
    if (f) f.focus();
  }

  function korsat(nom) {
    if (!bolimlar[nom]) nom = 'bosh';
    if (nom !== 'qoshish') { xabar = ''; wiz = null; }   // boshqa bo'limga o'tilsa, yozuv shakli tozalanadi
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
    else if (joriy === 'bosh' || joriy === 'yana') korsat(joriy);
  }

  tugmalar.forEach(function (t) {
    t.addEventListener('click', function () { korsat(t.getAttribute('data-bolim')); });
  });

  function yuklash() {
    return Promise.all([Data.hammasi('hisoblar'), Data.hammasi('kategoriyalar'), Data.hammasi('yozuvlar')]).then(function (r) {
      malumot.hisoblar = r[0].sort(function (a, b) { return a.yaratilgan < b.yaratilgan ? -1 : 1; });
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
