// Ma'lumotni saqlash va o'qish (IndexedDB). Bu faylda ekran bilan ishlaydigan kod yo'q.
(function (global) {
  'use strict';

  var DB_NOMI = 'moliya';
  var DB_VERSIYASI = 1;      // IndexedDB tuzilishi (to'plamlar ro'yxati)
  var SXEMA_VERSIYASI = 7;   // ma'lumot tuzilishi: 2 — yozuvga `vaqt` (HH:MM); 3 — qarzlar (to'lovlar ichida, `vaqt`, `yopilgan`); 4 — sozlamalarda `balans_yashirin`; 7 — mahalliy ID lar UUID, har qatorda `updated_at` va `deleted` (mantiqiy o'chirish); 6 — sozlamalarda `tema`; 5 — kategoriyada `belgi`, hisobda `tur`, `belgi`, `rang`, `oxirgi4`
  // To'plamlar (TZ 7-band). Byudjetning kaliti kategoriya_id, qolganlariniki id.
  var TOPLAMLAR = {
    hisoblar: 'id',
    yozuvlar: 'id',
    kategoriyalar: 'id',
    byudjetlar: 'kategoriya_id',
    qarzlar: 'id',
    sozlamalar: 'kalit'
  };

  var XARAJAT_KATEGORIYALARI = [
    ['Oziq-ovqat', '#e57373'], ['Transport', '#64b5f6'], ['Kommunal to\'lovlar', '#ffb74d'],
    ['Uy-ro\'zg\'or', '#a1887f'], ['Sog\'liq', '#81c784'], ['Ta\'lim', '#9575cd'],
    ['Kiyim', '#f06292'], ['Aloqa va internet', '#4dd0e1'], ['Ko\'ngilochar', '#ba68c8'],
    ['Xayriya', '#aed581'], ['Boshqa', '#90a4ae']
  ];
  var DAROMAD_KATEGORIYALARI = [
    ['Oylik maosh', '#43a047'], ['Qo\'shimcha daromad', '#26a69a'],
    ['Sovg\'a', '#ffd54f'], ['Boshqa', '#90a4ae']
  ];

  var db = null;
  var joriyNom = DB_NOMI;   // hozir ochiq bazaning nomi (sinovlarda boshqa nom bo'lishi mumkin)
  var PIN_KALITI = 'pin';   // sozlamalar ichidagi PIN yozuvining kaliti: zaxiraga KIRMAYDI va tiklashda saqlanib qoladi
  var SINXRON_KALITI = 'sinxron', NAVBAT_KALITI = 'sinxron-navbat';   // sozlamalar ichidagi mahalliy yozuvlar (S5): sinxron holati va serverga yuborilmagan o'zgarishlar navbati (zaxiraga KIRMAYDI)
  var IMPORT_KALITI = 'import-tarixi';   // sozlamalar ichida (faqat shu qurilmada): Excel dan yuklangan yozuvlar tarixi (takrorni aniqlash va oxirgi yuklashni bekor qilish uchun); zaxiraga kirmaydi
  var kuzatuvchilar = [];
  function ozgarishKuzat(f) { kuzatuvchilar.push(f); }
  function ozgarishXabari() { kuzatuvchilar.slice().forEach(function (f) { try { f(); } catch (e) { /* ahamiyatsiz */ } }); }
  var ICHKI_NUSXA_KALITI = 'migratsiya-zaxira';   // sozlamalar ichida: sxema yangilanishidan oldingi ma'lumot nusxasi (zaxiraga KIRMAYDI, tiklashda saqlanadi)

  // Noyob id yaratish: har doim UUID (v4)
  function yangiId() { return Calc.uuidYarat(); }

  function ochish(nom) {
    return new Promise(function (resolve, reject) {
      var so = indexedDB.open(nom || DB_NOMI, DB_VERSIYASI);
      so.onupgradeneeded = function () {
        var d = so.result;
        Object.keys(TOPLAMLAR).forEach(function (t) {
          if (!d.objectStoreNames.contains(t)) d.createObjectStore(t, { keyPath: TOPLAMLAR[t] });
        });
      };
      so.onsuccess = function () { resolve(so.result); };
      so.onerror = function () { reject(so.error); };
    });
  }

  function amal(toplam, rejim, fn) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(toplam, rejim);
      var natija;
      try { natija = fn(tx.objectStore(toplam)); } catch (e) { reject(e); return; }
      tx.oncomplete = function () { resolve(natija && 'result' in natija ? natija.result : undefined); };
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error); };
    });
  }

  // O'qish: mantiqiy o'chirilgan (deleted = true) qatorlar KO'RINMAYDI (ilova ularni hech qayerda ko'rmaydi: balans, hisobot, byudjet, qidiruv, eksport).
  // Qarzning o'chirilgan to'lovlari ham ko'rinmaydi. To'liq (o'chirilganlar bilan) ro'yxat — hammasiniOqish() (zaxira uchun).
  function hammasi(toplam) {
    return amal(toplam, 'readonly', function (s) { return s.getAll(); }).then(function (r) {
      return Calc.jonlilar(toplam, toplam === 'sozlamalar' ? r.filter(function (x) { return x.kalit !== ICHKI_NUSXA_KALITI && x.kalit !== 'yuklash' && x.kalit !== IMPORT_KALITI && x.kalit !== SINXRON_KALITI && x.kalit !== NAVBAT_KALITI && x.kalit !== 'rozilik'; }) : r);
    });
  }
  function olish(toplam, kalit) {
    return amal(toplam, 'readonly', function (s) { return s.get(kalit); }).then(function (x) {
      if (!x || x.deleted === true) return undefined;
      return toplam === 'qarzlar' ? Calc.jonliQarz(x) : x;
    });
  }

  // Saqlash (qo'shish yoki o'zgartirish): updated_at HAR safar yangilanadi, deleted = false (o'chirilgan qatorni qayta saqlash uni qaytaradi),
  // id bo'lmasa beriladi (byudjet va sozlamada mavjud qatorning id si saqlanadi). Qarzda to'lovlar bazadagi bilan birlashtiriladi:
  // ro'yxatdan olib tashlangan to'lov butunlay o'chmaydi, deleted = true bo'ladi. PIN va ichki nusxa o'zgarishsiz yoziladi.
  function saqlash(toplam, qiymat) {
    return new Promise(function (resolve, reject) {
      var kalitMaydoni = TOPLAMLAR[toplam];
      if (toplam === 'sozlamalar' && Calc.yerelKalitmi(qiymat)) { amal(toplam, 'readwrite', function (s) { s.put(qiymat); }).then(resolve, reject); return; }
      var q = Object.assign({}, qiymat);
      if (kalitMaydoni === 'id' && !q.id) q.id = yangiId();
      var tx = db.transaction(toplam === 'sozlamalar' ? ['sozlamalar'] : [toplam, 'sozlamalar'], 'readwrite'), s = tx.objectStore(toplam);
      tx.oncomplete = function () { resolve(); ozgarishXabari(); };
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error); };
      var so = s.get(q[kalitMaydoni]);
      so.onsuccess = function () {
        var mavjud = so.result, hozir = new Date().toISOString();
        if (!q.id) q.id = mavjud && mavjud.id ? mavjud.id : yangiId();
        if (mavjud && mavjud.eski_id !== undefined && q.eski_id === undefined) q.eski_id = mavjud.eski_id;
        q.deleted = q.deleted === true;
        q.updated_at = hozir;
        if (toplam === 'qarzlar') q.tolovlar = Calc.tolovlarniBirlashtir(mavjud && mavjud.tolovlar, q.tolovlar, hozir, yangiId);
        s.put(q);
        navbatgaYoz(tx, toplam, q[kalitMaydoni], hozir);   // serverga yuborish navbati: shu tranzaksiyada (yozuv va navbat birga saqlanadi yoki birga bekor bo'ladi)
      };
    });
  }

  // O'chirish MANTIQIY: qator bazadan o'chmaydi, deleted = true va updated_at yangilanadi (boshqa qurilma ham o'chirishni biladi).
  // Faqat PIN yozuvi (faqat shu qurilmada) butunlay o'chadi. Hisob va kategoriyani arxivlash (arxivlangan) — boshqa narsa.
  function ochirish(toplam, kalit) {
    if (toplam === 'sozlamalar' && Calc.yerelKalitmi({ kalit: kalit })) return haqiqiyOchirish(toplam, kalit);
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(toplam === 'sozlamalar' ? ['sozlamalar'] : [toplam, 'sozlamalar'], 'readwrite'), s = tx.objectStore(toplam);
      tx.oncomplete = function () { resolve(); ozgarishXabari(); };
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error); };
      var so = s.get(kalit);
      so.onsuccess = function () {
        var x = so.result;
        if (!x) return;
        var hozir = new Date().toISOString();
        s.put(Object.assign({}, x, { deleted: true, updated_at: hozir }));
        navbatgaYoz(tx, toplam, kalit, hozir);
      };
    });
  }
  // Serverga yuborish navbati (S5). Faqat sinxron yoqilgan bo'lsa (sinxron yozuvida navbat = true) yoziladi. Navbat — o'zgargan qatorlarning
  // KALITLARI (qator mazmuni emas): yuborish paytida bazadan oxirgi holati o'qiladi, shuning uchun bir qator ko'p marta o'zgarsa ham bir marta yuboriladi.
  // Qiymat — qatorning updated_at i: yuborilgandan keyin navbatdan shu qiymat bo'yicha olinadi (yuborish paytida yana o'zgargan qator navbatda qoladi).
  function navbatgaYoz(tx, toplam, kalit, vaqt) {
    var s = tx.objectStore('sozlamalar');
    s.get(SINXRON_KALITI).onsuccess = function (e) {
      if (!e.target.result || e.target.result.navbat !== true) return;
      s.get(NAVBAT_KALITI).onsuccess = function (e2) {
        var n = e2.target.result || { kalit: NAVBAT_KALITI, qatorlar: {}, ochirish: {} };
        n.qatorlar = n.qatorlar || {};
        (n.qatorlar[toplam] = n.qatorlar[toplam] || {})[kalit] = vaqt;
        s.put(n);
      };
    };
  }
  function haqiqiyOchirish(toplam, kalit) { return amal(toplam, 'readwrite', function (s) { s.delete(kalit); }); }

  // Birinchi ochilishda tayyor ma'lumotni bir marta yozadi.
  // Tekshirish va yozish BITTA tranzaksiyada: ilova ikki joyda bir vaqtda ochilsa ham, ikkinchisi
  // birinchisi tugashini kutadi va ma'lumot allaqachon borligini ko'radi (nusxa paydo bo'lmaydi).
  function boshlangichMalumot() {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(['hisoblar', 'kategoriyalar', 'sozlamalar'], 'readwrite');
      tx.oncomplete = resolve;
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error); };
      tx.objectStore('sozlamalar').get('asosiy').onsuccess = function (e) {
        if (e.target.result) return;
        var hozir = new Date().toISOString();
        var vaqt = Date.now();
        tx.objectStore('hisoblar').put({
          id: yangiId(), yaratilgan: hozir, nom: 'Naqd pul', tur: 'naqd', belgi: 'naqd', rang: Calc.HISOB_RANGLARI.naqd, oxirgi4: '',
          boshlangich_qoldiq: 0, arxivlangan: false, updated_at: hozir, deleted: false
        });
        tayyorKategoriyalar().forEach(function (k) {
          // yaratilgan har biriga 1 ms farq bilan yoziladi: ro'yxat tayyor tartibda chiqishi uchun
          tx.objectStore('kategoriyalar').put({
            id: yangiId(), yaratilgan: new Date(vaqt++).toISOString(),
            nom: k.nom, tur: k.tur, rang: k.rang, belgi: Calc.belgiTaxmin(k.nom, k.tur), arxivlangan: false, updated_at: hozir, deleted: false
          });
        });
        tx.objectStore('sozlamalar').put({
          kalit: 'asosiy', id: yangiId(), sxema_versiyasi: SXEMA_VERSIYASI, oxirgi_zaxira_sanasi: null, balans_yashirin: false, tema: 'qurilma', updated_at: hozir, deleted: false
        });
      };
    });
  }

  // Tayyor kategoriyalar ro'yxati: [{ nom, tur, rang }]
  function tayyorKategoriyalar() {
    var r = [];
    XARAJAT_KATEGORIYALARI.forEach(function (k) { r.push({ nom: k[0], tur: 'xarajat', rang: k[1] }); });
    DAROMAD_KATEGORIYALARI.forEach(function (k) { r.push({ nom: k[0], tur: 'daromad', rang: k[1] }); });
    return r;
  }

  // Ma'lumot tuzilishini yangi versiyaga o'tkazadi: 1 -> 2 (yozuvlarga `vaqt`), 2 -> 3 (qarzlarda tushib qolgan maydonlar), 3 -> 4 (`balans_yashirin`),
  // 4 -> 5 (kategoriyaga belgi; hisobga tur, belgi, rang, oxirgi4), 5 -> 6 (`tema`), 6 -> 7 (ID lar UUID, har qatorda `updated_at` va `deleted`).
  // Hisoblash sof funksiyada (Calc.malumotniYangilash), bu yerda faqat o'qish va yozish.
  // XAVFSIZLIK: hammasi (o'qish, ma'lumotning ESKI holatdagi nusxasi, yangi qatorlar, versiya belgisi) BITTA tranzaksiyada. Telefon o'chsa yoki
  // ilova yopilsa, tranzaksiya to'liq bekor bo'ladi: ma'lumot va versiya avvalgidek qoladi, keyingi ochilishda migratsiya qaytadan boshlanadi.
  // Versiya Sozlamalar ichida tekshiriladi: ikkinchi marta ishlasa yoki ilova ikki joyda bir vaqtda ochilsa ham ma'lumot buzilmaydi.
  // Migratsiyadan oldingi holat `migratsiya-zaxira` yozuviga (sozlamalar ichida) saqlanadi: Zaxira va eksport ekranidan tiklash mumkin.
  // opts.sinovToxtatish — FAQAT sinov uchun: shuncha yozishdan keyin tranzaksiyani bekor qiladi ("yarim yo'lda to'xtash" sinovi).
  function sxemaniYangilash(opts) {
    opts = opts || {};
    return new Promise(function (resolve, reject) {
      var nomlar = Object.keys(TOPLAMLAR);
      var tx = db.transaction(nomlar, 'readwrite');
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error || new Error('Migratsiya to\'xtatildi (ma\'lumot o\'zgarmadi)')); };
      tx.onabort = function () { reject(tx.error || new Error('Migratsiya to\'xtatildi (ma\'lumot o\'zgarmadi)')); };
      var sozlamaSorovi = tx.objectStore('sozlamalar').get('asosiy');
      sozlamaSorovi.onsuccess = function () {
        var sozlama = sozlamaSorovi.result;
        var eski = sozlama ? (sozlama.sxema_versiyasi || 1) : SXEMA_VERSIYASI;
        if (eski >= SXEMA_VERSIYASI) return;
        var xom = {}, kutilmoqda = nomlar.length;
        nomlar.forEach(function (t) {
          var so = tx.objectStore(t).getAll();
          so.onsuccess = function () { xom[t] = so.result; if (--kutilmoqda === 0) yoz(); };
        });
        function yoz() {
          var hozirISO = new Date().toISOString();
          var umumiy = xom.sozlamalar.filter(function (x) { return !Calc.yerelKalitmi(x); });
          var eskiHolat = { hisoblar: xom.hisoblar, kategoriyalar: xom.kategoriyalar, yozuvlar: xom.yozuvlar, byudjetlar: xom.byudjetlar, qarzlar: xom.qarzlar, sozlamalar: umumiy };
          var nusxa = Calc.zaxiraYasash(eskiHolat, eski, new Date());   // migratsiyadan OLDINGI holat (tiklash mumkin)
          var natija = Calc.malumotniYangilash(eskiHolat, eski, { yangiId: yangiId, hozir: hozirISO, sxema: SXEMA_VERSIYASI });
          var yozilgan = 0, toxtadi = false;
          function put(t, x) {
            if (toxtadi) return;
            tx.objectStore(t).put(x);
            yozilgan++;
            if (typeof opts.sinovToxtatish === 'number' && yozilgan >= opts.sinovToxtatish) { toxtadi = true; tx.abort(); }
          }
          put('sozlamalar', { kalit: ICHKI_NUSXA_KALITI, vaqt: hozirISO, eski_sxema: eski, yangi_sxema: SXEMA_VERSIYASI, fayl: nusxa });
          ['hisoblar', 'kategoriyalar', 'yozuvlar', 'byudjetlar', 'qarzlar'].forEach(function (t) {
            if (toxtadi) return;
            tx.objectStore(t).clear();   // kalitlar o'zgaradi (UUID): eski qatorlar yangilari bilan almashadi; bu tranzaksiya bekor bo'lsa, hammasi qaytadi
            natija.malumot[t].forEach(function (x) { put(t, x); });
          });
          natija.malumot.sozlamalar.forEach(function (x) { put('sozlamalar', x); });   // PIN yozuvi (yerel) tegilmaydi
        }
      };
    });
  }

  // Doimiy saqlashga ruxsat so'raydi (brauzer ma'lumotni o'zi tozalab yubormasligi uchun)
  function doimiySaqlash() {
    if (global.navigator && navigator.storage && navigator.storage.persist) {
      return navigator.storage.persist().catch(function () { return false; });
    }
    return Promise.resolve(false);
  }

  // nom, opts — faqat sinov uchun (alohida baza ochish; opts.sinovToxtatish: migratsiyani yarim yo'lda to'xtatish sinovi)
  function boshlash(nom, opts) {
    joriyNom = nom || DB_NOMI;
    return ochish(nom).then(function (d) {
      db = d;
      return boshlangichMalumot();
    }).then(function () { return sxemaniYangilash(opts); }).then(function () { return doimiySaqlash(); });
  }

  // Hamma to'plamni o'qiydi (zaxira uchun): { hisoblar, yozuvlar, kategoriyalar, byudjetlar, qarzlar, sozlamalar }.
  // Bitta tranzaksiyada o'qiladi, shuning uchun nusxa bir paytdagi yaxlit holat.
  function hammasiniOqish() {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(Object.keys(TOPLAMLAR), 'readonly'), natija = {};
      Object.keys(TOPLAMLAR).forEach(function (t) { tx.objectStore(t).getAll().onsuccess = function (e) { natija[t] = t === 'sozlamalar' ? e.target.result.filter(function (x) { return !Calc.yerelKalitmi(x); }) : e.target.result; }; });   // PIN va ichki nusxa zaxiraga kirmaydi; mantiqiy o'chirilgan qatorlar kiradi (tiklashda ham o'chirilgan bo'lib qoladi)
      tx.oncomplete = function () { resolve(natija); };
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error); };
    });
  }

  // Hamma to'plamni zaxiradagi ma'lumot bilan ALMASHTIRADI. Hammasi BITTA tranzaksiyada: biror joyda xato bo'lsa,
  // tranzaksiya bekor qilinadi va mavjud ma'lumot aynan avvalgidek qoladi (yarim holat bo'lmaydi).
  // opts (sinxron uchun): navbatsiz — navbatga tegilmaydi/tozalanadi; navbat — shu navbat yoziladi; yerel — shu mahalliy yozuvlar (kalit bo'yicha) yoziladi.
  // Hech bir opts berilmasa (oddiy tiklash): sinxron yoqilgan bo'lsa, tiklangan HAMMA qator serverga yuboriladigan o'zgarish sifatida navbatga qo'yiladi (TZ-sinxronlash.md 6.10).
  function almashtirish(malumot, opts) {
    opts = opts || {};
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(Object.keys(TOPLAMLAR), 'readwrite');
      tx.oncomplete = function () { resolve(); ozgarishXabari(); };
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error || new Error('Bekor qilindi')); };
      try {
        Object.keys(TOPLAMLAR).forEach(function (t) {
          var s = tx.objectStore(t);
          if (t === 'sozlamalar') {
            // PIN va ichki nusxa zaxirada yo'q: tiklash ularni o'chirmasin (xuddi shu tranzaksiyada o'qib, qayta yoziladi)
            var yerelSorovi = s.getAll();
            yerelSorovi.onsuccess = function () {
              var yerel = yerelSorovi.result.filter(function (x) { return Calc.yerelKalitmi(x); });
              var sinxronYozuvi = yerel.filter(function (x) { return x.kalit === SINXRON_KALITI; })[0];
              s.clear();
              (malumot[t] || []).forEach(function (x) { if (x && !Calc.yerelKalitmi(x)) s.put(x); });
              var yozilgan = {};
              (opts.yerel || []).forEach(function (x) { yozilgan[x.kalit] = true; s.put(x); });
              var navbat = null;
              if (opts.navbat) navbat = { kalit: NAVBAT_KALITI, qatorlar: opts.navbat, ochirish: {} };
              else if (!opts.navbatsiz && sinxronYozuvi && sinxronYozuvi.navbat === true) navbat = { kalit: NAVBAT_KALITI, qatorlar: butunNavbat(malumot), ochirish: {} };
              yerel.forEach(function (x) {
                if (yozilgan[x.kalit]) return;
                if (x.kalit === NAVBAT_KALITI && (navbat || opts.navbatsiz)) return;   // navbat almashtiriladi yoki tozalanadi
                s.put(x);
              });
              if (navbat) s.put(navbat);
            };
            return;
          }
          s.clear();
          (malumot[t] || []).forEach(function (x) { s.put(x); });
        });
      } catch (e) { try { tx.abort(); } catch (e2) { /* allaqachon bekor */ } reject(e); }
    });
  }

  // Ma'lumotdagi HAMMA qator navbat shaklida: { jadval: { kalit: updated_at } }
  function butunNavbat(m) {
    var n = {};
    ['hisoblar', 'kategoriyalar', 'yozuvlar', 'byudjetlar', 'qarzlar'].forEach(function (t) {
      n[t] = {}; (m[t] || []).forEach(function (x) { n[t][x[TOPLAMLAR[t]]] = x.updated_at; });
    });
    n.sozlamalar = {}; (m.sozlamalar || []).forEach(function (x) { if (x && x.kalit === 'asosiy') n.sozlamalar.asosiy = x.updated_at; });
    return n;
  }

  // ---- Sinxronlash uchun past darajali amallar (S5). Ularni faqat js/sinxron.js chaqiradi ----
  function navbatniOl() { return olish('sozlamalar', NAVBAT_KALITI).then(function (n) { return n || { kalit: NAVBAT_KALITI, qatorlar: {}, ochirish: {} }; }); }

  // Navbatdagi qatorlarning hozirgi holatini o'qiydi (bitta tranzaksiyada). kalitlar: { jadval: [kalit, ...] }. Natija: { jadval: [qator, ...] }
  function qatorlarniOqish(kalitlar) {
    return new Promise(function (resolve, reject) {
      var natija = {}, nomlar = Object.keys(kalitlar).filter(function (t) { return TOPLAMLAR[t]; });
      if (!nomlar.length) { resolve(natija); return; }
      var tx = db.transaction(nomlar, 'readonly');
      nomlar.forEach(function (t) {
        natija[t] = [];
        kalitlar[t].forEach(function (k) { tx.objectStore(t).get(k).onsuccess = function (e) { if (e.target.result) natija[t].push(e.target.result); }; });
      });
      tx.oncomplete = function () { resolve(natija); };
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error); };
    });
  }

  // Yuborilgan qatorlarni navbatdan oladi: faqat qiymat (updated_at) hali o'zgarmagan bo'lsa (yuborish paytida yana o'zgartirilgan qator navbatda qoladi).
  // yuborilgan: { jadval: { kalit: updated_at } }; ochirilgan: { jadval: [id, ...] } (serverda o'chirildi deb belgilangan id lar)
  function navbatdanOlish(yuborilgan, ochirilgan) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(['sozlamalar'], 'readwrite'), s = tx.objectStore('sozlamalar');
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error); };
      s.get(NAVBAT_KALITI).onsuccess = function (e) {
        var n = e.target.result;
        if (!n) return;
        Object.keys(yuborilgan || {}).forEach(function (t) {
          Object.keys(yuborilgan[t]).forEach(function (k) { if (n.qatorlar && n.qatorlar[t] && n.qatorlar[t][k] === yuborilgan[t][k]) delete n.qatorlar[t][k]; });
          if (n.qatorlar && n.qatorlar[t] && !Object.keys(n.qatorlar[t]).length) delete n.qatorlar[t];
        });
        Object.keys(ochirilgan || {}).forEach(function (t) {
          if (n.ochirish && n.ochirish[t]) n.ochirish[t] = n.ochirish[t].filter(function (id) { return ochirilgan[t].indexOf(id) < 0; });
          if (n.ochirish && n.ochirish[t] && !n.ochirish[t].length) delete n.ochirish[t];
        });
        s.put(n);
      };
    });
  }

  // Qatorlarni qayta navbatga qo'yadi (masalan, serverga bog'liqlik xatosi bilan o'tmagan qator ota qator yuborilgach qayta yuborilsin).
  // royxat: [{ jadval, kalit }] (qarz to'lovi uchun jadval 'qarzlar', kalit — qarz id). Qiymat — qatorning hozirgi updated_at i. Natija: nechtasi qo'shildi.
  function navbatgaQoshish(royxat) {
    return new Promise(function (resolve, reject) {
      var nomlar = {}; royxat.forEach(function (r) { if (TOPLAMLAR[r.jadval]) nomlar[r.jadval] = 1; });
      var tx = db.transaction(Object.keys(nomlar).concat(['sozlamalar']), 'readwrite'), s = tx.objectStore('sozlamalar'), qoshildi = 0;
      tx.oncomplete = function () { resolve(qoshildi); };
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error); };
      s.get(NAVBAT_KALITI).onsuccess = function (e) {
        var n = e.target.result || { kalit: NAVBAT_KALITI, qatorlar: {}, ochirish: {} }; n.qatorlar = n.qatorlar || {};
        var kut = royxat.length;
        if (!kut) return;
        royxat.forEach(function (r) {
          if (!TOPLAMLAR[r.jadval]) { if (--kut === 0) s.put(n); return; }
          tx.objectStore(r.jadval).get(r.kalit).onsuccess = function (e2) {
            var x = e2.target.result;
            if (x) { (n.qatorlar[r.jadval] = n.qatorlar[r.jadval] || {})[r.kalit] = x.updated_at || new Date().toISOString(); qoshildi++; }
            if (--kut === 0) s.put(n);
          };
        });
      };
    });
  }

  // Yuborib bo'lmaydigan (buzuq) qatorni navbatdan oladi (qiymat bo'yicha); qolganlar yuboriladi
  function navbatdanTashlash(jadval, kalit, qiymat) { var y = {}; y[jadval] = {}; y[jadval][kalit] = qiymat; return navbatdanOlish(y); }

  // Serverdan kelgan qatorlarni mahalliy bazaga qo'llaydi (BITTA tranzaksiya; navbat ro'yxati shu tranzaksiyada o'qiladi, shuning uchun
  // foydalanuvchi shu paytda qilgan o'zgarish tortilgan qator ustiga yozilib ketmaydi). Navbatga hech narsa QO'SHILMAYDI (bu o'zgarish serverdan keldi).
  // Natija: { yozildi, ziddiyat, tomb: [{ jadval, id }] }
  function tortilganlarniYozish(jadval, qatorlar, yaqinda) {
    return new Promise(function (resolve, reject) {
      var storeNomi = jadval === 'qarz_tolovlari' ? 'qarzlar' : jadval;
      var tx = db.transaction([storeNomi, 'sozlamalar'], 'readwrite'), st = tx.objectStore(storeNomi), sz = tx.objectStore('sozlamalar');
      var natija = { yozildi: 0, ziddiyat: 0, tomb: [] }, navbat = null, navbatOzgardi = false;
      tx.oncomplete = function () { resolve(natija); };   // ozgarishXabari chaqirilmaydi: bu mahalliy o'zgarish emas (qayta yuborishni boshlamasin)
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error || new Error('Tortib olish bekor qilindi')); };
      sz.get(NAVBAT_KALITI).onsuccess = function (e) {
        navbat = e.target.result || { kalit: NAVBAT_KALITI, qatorlar: {}, ochirish: {} };
        var kut = (navbat.qatorlar && navbat.qatorlar[storeNomi]) || {};
        function keyingi(i) {
          if (i >= qatorlar.length) {
            if (navbatOzgardi) sz.put(navbat);
            return;
          }
          var r = qatorlar[i], kalit = jadval === 'qarz_tolovlari' ? r.qarz_id : jadval === 'byudjetlar' ? (r.kategoriya_id === null || r.kategoriya_id === undefined ? 'umumiy' : r.kategoriya_id) : r.id;
          st.get(kalit).onsuccess = function (e2) {
            var h = SinxronSof.tortilganniQollash(jadval, e2.target.result, r, { kutilmoqda: kut, yaqinda: yaqinda || {} });
            if (h.ziddiyat) natija.ziddiyat++;
            if (h.yoz) { st.put(h.yoz); natija.yozildi++; }
            if (h.tomb.length) {
              navbat.ochirish = navbat.ochirish || {};
              navbat.ochirish[jadval] = (navbat.ochirish[jadval] || []).concat(h.tomb.filter(function (id) { return (navbat.ochirish[jadval] || []).indexOf(id) < 0; }));
              h.tomb.forEach(function (id) { natija.tomb.push({ jadval: jadval, id: id }); });
              if (h.yoz && jadval === 'byudjetlar' && navbat.qatorlar.byudjetlar) delete navbat.qatorlar.byudjetlar[kalit];   // almashtirilgan mahalliy qator endi yo'q: uni yuborish kerak emas
              navbatOzgardi = true;
            }
            keyingi(i + 1);
          };
        }
        keyingi(0);
      };
    });
  }

  // Birinchi sinxron "Faqat shu qurilmadagini yuborish": hamma qator navbatga qo'yiladi, sozlamalar qatorining id si serverdagiga tenglashtiriladi,
  // sinxron yozuvi yoziladi. Hammasi bitta tranzaksiyada.
  function hammasiniNavbatga(yozuv, asosiyId) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(Object.keys(TOPLAMLAR), 'readwrite');
      tx.oncomplete = function () { resolve(); ozgarishXabari(); };
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error || new Error('Bekor qilindi')); };
      var m = {}, kutilgan = Object.keys(TOPLAMLAR).length;
      Object.keys(TOPLAMLAR).forEach(function (t) {
        tx.objectStore(t).getAll().onsuccess = function (e) {
          m[t] = t === 'sozlamalar' ? e.target.result.filter(function (x) { return !Calc.yerelKalitmi(x); }) : e.target.result;
          if (--kutilgan) return;
          var sz = tx.objectStore('sozlamalar'), hozir = new Date().toISOString();
          var asosiy = m.sozlamalar.filter(function (x) { return x.kalit === 'asosiy'; })[0];
          if (asosiy && asosiyId && asosiy.id !== asosiyId) { asosiy = Object.assign({}, asosiy, { id: asosiyId, updated_at: hozir }); sz.put(asosiy); m.sozlamalar = [asosiy]; }
          sz.put(yozuv);
          sz.put({ kalit: NAVBAT_KALITI, qatorlar: butunNavbat(m), ochirish: {} });
        };
      });
    });
  }

  function yopish() { if (db) { db.close(); db = null; } }

  // Butun bazani o'chiradi ("PINni unutdim"): keyingi ochilishda ilova bo'sh holatda (tayyor "Naqd pul" va kategoriyalar bilan) boshlanadi
  function bazaniOchirish() {
    return new Promise(function (resolve, reject) {
      yopish();
      var so = indexedDB.deleteDatabase(joriyNom);
      so.onsuccess = function () { resolve(); };
      so.onerror = function () { reject(so.error); };
      so.onblocked = function () { reject(new Error('Boshqa oynada ochiq. Ilovaning boshqa oynalarini yoping va qayta urinib ko\'ring')); };
    });
  }

  // ---- Excel dan yuklash (18.2): hammasi BITTA tranzaksiyada (xato bo'lsa hech narsa o'zgarmaydi) ----
  // paket: ImportSof.tayyorla natijasi { hisoblar, kategoriyalar, yozuvlar, manbaIdlar }; fayl — fayl nomi.
  // Yozuvlar oddiy saqlash bilan bir xil maydonlar oladi (updated_at, deleted = false) va serverga yuborish navbatiga tushadi (navbat formati navbatgaYoz bilan bir xil).
  function importYozish(paket, fayl) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(['hisoblar', 'kategoriyalar', 'yozuvlar', 'qarzlar', 'sozlamalar'], 'readwrite'), hozir = new Date().toISOString();
      tx.oncomplete = function () { resolve(); ozgarishXabari(); };
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error || new Error('Yozish bekor qilindi')); };
      var so = tx.objectStore('sozlamalar');
      so.get(SINXRON_KALITI).onsuccess = function (e1) {
        var navbatBor = !!(e1.target.result && e1.target.result.navbat === true);
        so.get(NAVBAT_KALITI).onsuccess = function (e2) {
          so.get(IMPORT_KALITI).onsuccess = function (e3) {
            var navbat = e2.target.result || { kalit: NAVBAT_KALITI, qatorlar: {}, ochirish: {} };
            navbat.qatorlar = navbat.qatorlar || {};
            ['hisoblar', 'kategoriyalar', 'yozuvlar', 'qarzlar'].forEach(function (t) {
              (paket[t] || []).forEach(function (q) {
                var x = Object.assign({}, q, { deleted: false, updated_at: hozir });
                if (t === 'qarzlar') x.tolovlar = Calc.tolovlarniBirlashtir(null, q.tolovlar, hozir, yangiId);   // saqlash() dagi kabi: har to'lovda updated_at va deleted
                tx.objectStore(t).put(x);
                if (navbatBor) (navbat.qatorlar[t] = navbat.qatorlar[t] || {})[x.id] = hozir;
              });
            });
            var t = e3.target.result || { kalit: IMPORT_KALITI, idlar: {}, oxirgi: null };
            t.idlar = t.idlar || {};
            t.stek = Array.isArray(t.stek) ? t.stek.slice() : (t.oxirgi ? [t.oxirgi] : []);   // yuklashlar steki: har yuklash o'zining bekor qilish yozuvi bilan
            (paket.manbaIdlar || []).forEach(function (id) { t.idlar[id] = true; });
            var oxirgi = { vaqt: hozir, fayl: fayl || '', yozuvlar: paket.yozuvlar.map(function (y) { return y.id; }), kategoriyalar: paket.kategoriyalar.map(function (k) { return k.id; }),
              hisoblar: paket.hisoblar.map(function (h) { return h.id; }), qarzlar: (paket.qarzlar || []).map(function (z) { return z.id; }), manbaIdlar: (paket.manbaIdlar || []).slice(), hisobEski: {} };
            // Mavjud hisobning boshlang'ich qoldig'i (faqat foydalanuvchi tasdiqlagan bo'lsa): eski qiymat bekor qilish uchun saqlanadi
            var kut = 0;
            function tugat() {
              if (navbatBor) so.put(navbat);
              t.stek.push(oxirgi); t.oxirgi = oxirgi;
              so.put(t);
            }
            (paket.hisobYangilash || []).forEach(function (y) {
              kut++;
              tx.objectStore('hisoblar').get(y.id).onsuccess = function (e) {
                var h = e.target.result;
                if (h && h.deleted !== true) {
                  oxirgi.hisobEski[y.id] = h.boshlangich_qoldiq;
                  tx.objectStore('hisoblar').put(Object.assign({}, h, { boshlangich_qoldiq: y.boshlangich_qoldiq, updated_at: hozir }));
                  if (navbatBor) (navbat.qatorlar.hisoblar = navbat.qatorlar.hisoblar || {})[y.id] = hozir;
                }
                if (--kut === 0) tugat();
              };
            });
            if (kut === 0) tugat();
          };
        };
      };
    });
  }

  // Oxirgi yuklashni bekor qilish (stekdagi oxirgisi): yozuvlar va qarzlar mantiqiy o'chiriladi (deleted = true); shu yuklash yaratgan hisob va kategoriyalar — faqat hech narsa ishlatmasa;
  // o'zgartirilgan mavjud hisoblarning boshlang'ich qoldig'i avvalgi qiymatiga qaytadi
  function importBekor() {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(['hisoblar', 'kategoriyalar', 'yozuvlar', 'qarzlar', 'byudjetlar', 'sozlamalar'], 'readwrite'), hozir = new Date().toISOString(), natija = { yozuvlar: 0, qarzlar: 0, kategoriyalar: 0, hisoblar: 0, qoldiqlar: 0 };
      tx.oncomplete = function () { resolve(natija); ozgarishXabari(); };
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error || new Error('Bekor qilish to\'xtatildi')); };
      var so = tx.objectStore('sozlamalar');
      so.get(IMPORT_KALITI).onsuccess = function (e0) {
        var tarix = e0.target.result;
        var stek = tarix ? (Array.isArray(tarix.stek) ? tarix.stek.slice() : (tarix.oxirgi ? [tarix.oxirgi] : [])) : [];
        if (!stek.length) { tx.abort(); return; }
        var ox = stek[stek.length - 1];
        so.get(SINXRON_KALITI).onsuccess = function (e1) {
          var navbatBor = !!(e1.target.result && e1.target.result.navbat === true);
          so.get(NAVBAT_KALITI).onsuccess = function (e2) {
            var navbat = e2.target.result || { kalit: NAVBAT_KALITI, qatorlar: {}, ochirish: {} };
            navbat.qatorlar = navbat.qatorlar || {};
            var holat = {};
            ['yozuvlar', 'qarzlar'].forEach(function (t) { tx.objectStore(t).getAll().onsuccess = function (e) { holat[t] = e.target.result; }; });
            // so'rovlar yuborilgan tartibda bajariladi: byudjetlar tugagach yozuvlar va qarzlar ham tayyor
            tx.objectStore('byudjetlar').getAll().onsuccess = function (e) {
              holat.byudjetlar = e.target.result;
              var ochir = {}, ochirQarz = {}; ox.yozuvlar.forEach(function (id) { ochir[id] = true; }); (ox.qarzlar || []).forEach(function (id) { ochirQarz[id] = true; });
              function belgila(t, x, qo) { tx.objectStore(t).put(Object.assign({}, x, qo || { deleted: true }, { updated_at: hozir })); if (navbatBor) (navbat.qatorlar[t] = navbat.qatorlar[t] || {})[x[TOPLAMLAR[t]]] = hozir; }
              var ishlatil = {};
              holat.yozuvlar.forEach(function (y) {
                if (ochir[y.id]) { if (y.deleted !== true) { belgila('yozuvlar', y); natija.yozuvlar++; } return; }
                if (y.deleted === true) return;
                ishlatil[y.hisob_id] = 1; if (y.qabul_hisob_id) ishlatil[y.qabul_hisob_id] = 1; if (y.kategoriya_id) ishlatil[y.kategoriya_id] = 1;
              });
              holat.qarzlar.forEach(function (z) {
                if (ochirQarz[z.id]) { if (z.deleted !== true) { belgila('qarzlar', z); natija.qarzlar++; } return; }
                if (z.deleted === true) return; ishlatil[z.hisob_id] = 1; (z.tolovlar || []).forEach(function (t) { if (t.deleted !== true) ishlatil[t.hisob_id] = 1; });
              });
              holat.byudjetlar.forEach(function (b) { if (b.deleted !== true) ishlatil[b.kategoriya_id] = 1; });
              var kutilgan = 0;
              function bitta(t, id, fn) {
                kutilgan++;
                tx.objectStore(t).get(id).onsuccess = function (e) {
                  var x = e.target.result;
                  fn(x);
                  if (--kutilgan === 0) yakun();
                };
              }
              function yakun() {
                if (navbatBor) so.put(navbat);
                var yangi = Object.assign({}, tarix, { idlar: Object.assign({}, tarix.idlar) });
                (ox.manbaIdlar || []).forEach(function (id) { delete yangi.idlar[id]; });
                stek.pop(); yangi.stek = stek; yangi.oxirgi = stek.length ? stek[stek.length - 1] : null;
                so.put(yangi);
              }
              (ox.kategoriyalar || []).forEach(function (id) { bitta('kategoriyalar', id, function (x) { if (x && x.deleted !== true && !ishlatil[id]) { belgila('kategoriyalar', x); natija.kategoriyalar++; } }); });
              (ox.hisoblar || []).forEach(function (id) { bitta('hisoblar', id, function (x) { if (x && x.deleted !== true && !ishlatil[id]) { belgila('hisoblar', x); natija.hisoblar++; } }); });
              Object.keys(ox.hisobEski || {}).forEach(function (id) { bitta('hisoblar', id, function (x) { if (x && x.deleted !== true && x.boshlangich_qoldiq !== ox.hisobEski[id]) { belgila('hisoblar', x, { boshlangich_qoldiq: ox.hisobEski[id] }); natija.qoldiqlar++; } }); });
              if (kutilgan === 0) yakun();
            };
          };
        };
      };
    });
  }

  // Hisoblarni tozalash (soxta/bo'sh hisoblar): har amal alohida tasdiqlangan, hammasi BITTA tranzaksiyada.
  // amallar: [{ id, kochir: ixtiyoriy nishon hisob ID si }]: kochir bo'lsa, shu hisobning yozuvlari (hisob, o'tkazma qabul tomoni) va qarzlari (qarz hisobi, to'lov hisobi) nishonga ko'chiriladi; keyin hisob mantiqiy o'chadi.
  // Qarshi himoya: yozuvi bor hisob va nishon ko'rsatilmagan bo'lsa — xato (hech narsa o'zgarmaydi).
  function hisobTozalash(amallar) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(['hisoblar', 'yozuvlar', 'qarzlar', 'sozlamalar'], 'readwrite'), hozir = new Date().toISOString(), natija = { ochirildi: 0, kochirildi: 0 };
      tx.oncomplete = function () { resolve(natija); ozgarishXabari(); };
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error || new Error('Tozalash to\'xtatildi (hech narsa o\'zgarmadi)')); };
      var so = tx.objectStore('sozlamalar');
      so.get(SINXRON_KALITI).onsuccess = function (e1) {
        var navbatBor = !!(e1.target.result && e1.target.result.navbat === true);
        so.get(NAVBAT_KALITI).onsuccess = function (e2) {
          var navbat = e2.target.result || { kalit: NAVBAT_KALITI, qatorlar: {}, ochirish: {} };
          navbat.qatorlar = navbat.qatorlar || {};
          function yoz(t, x) { tx.objectStore(t).put(Object.assign({}, x, { updated_at: hozir })); if (navbatBor) (navbat.qatorlar[t] = navbat.qatorlar[t] || {})[x[TOPLAMLAR[t]]] = hozir; }
          var H = {}, Y, Q;
          tx.objectStore('hisoblar').getAll().onsuccess = function (e) { e.target.result.forEach(function (h) { H[h.id] = h; }); };
          tx.objectStore('yozuvlar').getAll().onsuccess = function (e) { Y = e.target.result; };
          tx.objectStore('qarzlar').getAll().onsuccess = function (e) {
            Q = e.target.result;
            var nishon = {}, dan = {}, xato = null;
            amallar.forEach(function (a) { dan[a.id] = true; });
            amallar.forEach(function (a) {
              if (xato) return;
              var h = H[a.id];
              if (!h || h.deleted === true) { xato = 'Hisob topilmadi'; return; }
              if (a.kochir) {
                var n = H[a.kochir];
                if (!n || n.deleted === true || n.arxivlangan || dan[a.kochir] || a.kochir === a.id) { xato = 'Ko\'chirish uchun hisob yaroqsiz'; return; }
                nishon[a.id] = a.kochir;
              }
            });
            if (xato) { tx.abort(); return; }
            var bor = {};   // ko'chirilmaydigan hisoblar uchun: yozuvi bormi
            Y.forEach(function (y) {
              if (y.deleted === true) return;
              var h = nishon[y.hisob_id] || y.hisob_id, q = y.qabul_hisob_id ? (nishon[y.qabul_hisob_id] || y.qabul_hisob_id) : y.qabul_hisob_id;
              if ((nishon[y.hisob_id] || nishon[y.qabul_hisob_id]) && y.tur === 'otkazma' && h === q) { xato = 'Ko\'chirishdan keyin o\'tkazmaning ikkala hisobi bir xil bo\'lib qoladi'; return; }
              if (dan[y.hisob_id] && !nishon[y.hisob_id]) bor[y.hisob_id] = 1;
              if (y.qabul_hisob_id && dan[y.qabul_hisob_id] && !nishon[y.qabul_hisob_id]) bor[y.qabul_hisob_id] = 1;
            });
            Q.forEach(function (z) {
              if (z.deleted === true) return;
              if (dan[z.hisob_id] && !nishon[z.hisob_id]) bor[z.hisob_id] = 1;
              (z.tolovlar || []).forEach(function (t) { if (t.deleted !== true && dan[t.hisob_id] && !nishon[t.hisob_id]) bor[t.hisob_id] = 1; });
            });
            Object.keys(bor).forEach(function (id) { xato = xato || 'Yozuvi bor hisobni (nishon hisobsiz) o\'chirib bo\'lmaydi'; });
            if (xato) { tx.abort(); return; }
            Y.forEach(function (y) {
              if (y.deleted === true) return;
              var o = false, yangi = Object.assign({}, y);
              if (nishon[y.hisob_id]) { yangi.hisob_id = nishon[y.hisob_id]; o = true; }
              if (y.qabul_hisob_id && nishon[y.qabul_hisob_id]) { yangi.qabul_hisob_id = nishon[y.qabul_hisob_id]; o = true; }
              if (o) yoz('yozuvlar', yangi);
            });
            Q.forEach(function (z) {
              if (z.deleted === true) return;
              var o = false, yangi = Object.assign({}, z);
              if (nishon[z.hisob_id]) { yangi.hisob_id = nishon[z.hisob_id]; o = true; }
              yangi.tolovlar = (z.tolovlar || []).map(function (t) { if (t.deleted !== true && nishon[t.hisob_id]) { o = true; return Object.assign({}, t, { hisob_id: nishon[t.hisob_id], updated_at: hozir }); } return t; });
              if (o) yoz('qarzlar', yangi);
            });
            amallar.forEach(function (a) { yoz('hisoblar', Object.assign({}, H[a.id], { deleted: true })); if (a.kochir) natija.kochirildi++; else natija.ochirildi++; });
            if (navbatBor) so.put(navbat);
          };
        };
      };
    });
  }

  global.Data = {
    SXEMA_VERSIYASI: SXEMA_VERSIYASI, sxemaniYangilash: sxemaniYangilash,
    yangiId: yangiId, boshlash: boshlash, yopish: yopish,
    hammasi: hammasi, olish: olish, saqlash: saqlash, ochirish: ochirish,
    ozgarishKuzat: ozgarishKuzat, navbatniOl: navbatniOl, navbatgaQoshish: navbatgaQoshish, qatorlarniOqish: qatorlarniOqish, navbatdanOlish: navbatdanOlish, navbatdanTashlash: navbatdanTashlash,
    tortilganlarniYozish: tortilganlarniYozish, hammasiniNavbatga: hammasiniNavbatga, tayyorKategoriyalar: tayyorKategoriyalar, SINXRON_KALITI: SINXRON_KALITI, NAVBAT_KALITI: NAVBAT_KALITI,
    hammasiniOqish: hammasiniOqish, almashtirish: almashtirish, bazaniOchirish: bazaniOchirish, haqiqiyOchirish: haqiqiyOchirish, PIN_KALITI: PIN_KALITI, ICHKI_NUSXA_KALITI: ICHKI_NUSXA_KALITI,
    importYozish: importYozish, importBekor: importBekor, hisobTozalash: hisobTozalash, IMPORT_KALITI: IMPORT_KALITI
  };
})(typeof window !== 'undefined' ? window : this);
