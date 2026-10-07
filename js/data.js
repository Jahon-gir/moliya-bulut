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
      return Calc.jonlilar(toplam, toplam === 'sozlamalar' ? r.filter(function (x) { return x.kalit !== ICHKI_NUSXA_KALITI && x.kalit !== 'yuklash'; }) : r);
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
      var tx = db.transaction(toplam, 'readwrite'), s = tx.objectStore(toplam);
      tx.oncomplete = function () { resolve(); };
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
      };
    });
  }

  // O'chirish MANTIQIY: qator bazadan o'chmaydi, deleted = true va updated_at yangilanadi (boshqa qurilma ham o'chirishni biladi).
  // Faqat PIN yozuvi (faqat shu qurilmada) butunlay o'chadi. Hisob va kategoriyani arxivlash (arxivlangan) — boshqa narsa.
  function ochirish(toplam, kalit) {
    if (toplam === 'sozlamalar' && Calc.yerelKalitmi({ kalit: kalit })) return haqiqiyOchirish(toplam, kalit);
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(toplam, 'readwrite'), s = tx.objectStore(toplam);
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error); };
      var so = s.get(kalit);
      so.onsuccess = function () {
        var x = so.result;
        if (!x) return;
        s.put(Object.assign({}, x, { deleted: true, updated_at: new Date().toISOString() }));
      };
    });
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
  function almashtirish(malumot) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(Object.keys(TOPLAMLAR), 'readwrite');
      tx.oncomplete = function () { resolve(); };
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
              s.clear();
              (malumot[t] || []).forEach(function (x) { if (x && !Calc.yerelKalitmi(x)) s.put(x); });
              yerel.forEach(function (x) { s.put(x); });
            };
            return;
          }
          s.clear();
          (malumot[t] || []).forEach(function (x) { s.put(x); });
        });
      } catch (e) { try { tx.abort(); } catch (e2) { /* allaqachon bekor */ } reject(e); }
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

  global.Data = {
    SXEMA_VERSIYASI: SXEMA_VERSIYASI, sxemaniYangilash: sxemaniYangilash,
    yangiId: yangiId, boshlash: boshlash, yopish: yopish,
    hammasi: hammasi, olish: olish, saqlash: saqlash, ochirish: ochirish,
    hammasiniOqish: hammasiniOqish, almashtirish: almashtirish, bazaniOchirish: bazaniOchirish, haqiqiyOchirish: haqiqiyOchirish, PIN_KALITI: PIN_KALITI, ICHKI_NUSXA_KALITI: ICHKI_NUSXA_KALITI
  };
})(typeof window !== 'undefined' ? window : this);
