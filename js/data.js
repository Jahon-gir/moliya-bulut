// Ma'lumotni saqlash va o'qish (IndexedDB). Bu faylda ekran bilan ishlaydigan kod yo'q.
(function (global) {
  'use strict';

  var DB_NOMI = 'moliya';
  var DB_VERSIYASI = 1;      // IndexedDB tuzilishi (to'plamlar ro'yxati)
  var SXEMA_VERSIYASI = 5;   // ma'lumot tuzilishi: 2 — yozuvga `vaqt` (HH:MM); 3 — qarzlar (to'lovlar ichida, `vaqt`, `yopilgan`); 4 — sozlamalarda `balans_yashirin`; 5 — kategoriyada `belgi`, hisobda `tur`, `belgi`, `rang`, `oxirgi4`
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

  // Noyob id yaratish
  function yangiId() {
    if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

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

  function hammasi(toplam) { return amal(toplam, 'readonly', function (s) { return s.getAll(); }); }
  function olish(toplam, kalit) { return amal(toplam, 'readonly', function (s) { return s.get(kalit); }); }
  function saqlash(toplam, qiymat) { return amal(toplam, 'readwrite', function (s) { s.put(qiymat); }); }
  function ochirish(toplam, kalit) { return amal(toplam, 'readwrite', function (s) { s.delete(kalit); }); }

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
          boshlangich_qoldiq: 0, arxivlangan: false
        });
        tayyorKategoriyalar().forEach(function (k) {
          // yaratilgan har biriga 1 ms farq bilan yoziladi: ro'yxat tayyor tartibda chiqishi uchun
          tx.objectStore('kategoriyalar').put({
            id: yangiId(), yaratilgan: new Date(vaqt++).toISOString(),
            nom: k.nom, tur: k.tur, rang: k.rang, belgi: Calc.belgiTaxmin(k.nom, k.tur), arxivlangan: false
          });
        });
        tx.objectStore('sozlamalar').put({
          kalit: 'asosiy', sxema_versiyasi: SXEMA_VERSIYASI, oxirgi_zaxira_sanasi: null, balans_yashirin: false
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

  // Ma'lumot tuzilishini yangi versiyaga o'tkazadi: 1 -> 2 (yozuvlarga `vaqt` qo'shiladi), 2 -> 3 (qarzlarda tushib qolgan
  // maydonlar to'ldiriladi), 3 -> 4 (sozlamalarga `balans_yashirin: false`), 4 -> 5 (kategoriyaga belgi; hisobga tur, belgi, rang, oxirgi4).
  // Hammasi BITTA tranzaksiyada: xato bo'lsa, hech narsa o'zgarmaydi. Hech narsa o'chirilmaydi.
  // Versiya Sozlamalar ichida tekshiriladi, shuning uchun ikkinchi marta ishlasa yoki ilova ikki joyda
  // bir vaqtda ochilsa ham ma'lumot buzilmaydi.
  function sxemaniYangilash() {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(['yozuvlar', 'qarzlar', 'hisoblar', 'kategoriyalar', 'sozlamalar'], 'readwrite');
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error); };
      var sozlamaSorovi = tx.objectStore('sozlamalar').get('asosiy');
      sozlamaSorovi.onsuccess = function () {
        var sozlama = sozlamaSorovi.result;
        var eski = sozlama ? (sozlama.sxema_versiyasi || 1) : SXEMA_VERSIYASI;
        if (eski >= SXEMA_VERSIYASI) return;
        var kutilmoqda = 4;
        function tugadi() {
          if (--kutilmoqda) return;
          if (typeof sozlama.balans_yashirin !== 'boolean') sozlama.balans_yashirin = false;   // 3 -> 4: ko'z belgisi holati (summalarni yashirish)
          sozlama.sxema_versiyasi = SXEMA_VERSIYASI;
          tx.objectStore('sozlamalar').put(sozlama);
        }
        // har to'plam: hammasini o'qib, yangilangan (o'zgargan) obyektlarni qayta yozadi. Hech narsa o'chirilmaydi.
        function yangila(toplam, fn) {
          var so = tx.objectStore(toplam).getAll();
          so.onsuccess = function () {
            so.result.forEach(function (x) {
              var yangi = fn(x);
              if (yangi !== x) tx.objectStore(toplam).put(yangi);
            });
            tugadi();
          };
        }
        if (eski < 2) yangila('yozuvlar', Calc.yozuvniYangilash); else tugadi();
        yangila('qarzlar', Calc.qarzniYangilash);
        yangila('hisoblar', Calc.hisobniYangilash);          // 4 -> 5: tur, belgi, rang, oxirgi4
        yangila('kategoriyalar', Calc.kategoriyaniYangilash); // 4 -> 5: belgi
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

  // nom — faqat sinov uchun (alohida baza ochish)
  function boshlash(nom) {
    return ochish(nom).then(function (d) {
      db = d;
      return boshlangichMalumot();
    }).then(sxemaniYangilash).then(function () { return doimiySaqlash(); });
  }

  // Hamma to'plamni o'qiydi (zaxira uchun): { hisoblar, yozuvlar, kategoriyalar, byudjetlar, qarzlar, sozlamalar }.
  // Bitta tranzaksiyada o'qiladi, shuning uchun nusxa bir paytdagi yaxlit holat.
  function hammasiniOqish() {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(Object.keys(TOPLAMLAR), 'readonly'), natija = {};
      Object.keys(TOPLAMLAR).forEach(function (t) { tx.objectStore(t).getAll().onsuccess = function (e) { natija[t] = e.target.result; }; });
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
          s.clear();
          (malumot[t] || []).forEach(function (x) { s.put(x); });
        });
      } catch (e) { try { tx.abort(); } catch (e2) { /* allaqachon bekor */ } reject(e); }
    });
  }

  function yopish() { if (db) { db.close(); db = null; } }

  global.Data = {
    SXEMA_VERSIYASI: SXEMA_VERSIYASI, sxemaniYangilash: sxemaniYangilash,
    yangiId: yangiId, boshlash: boshlash, yopish: yopish,
    hammasi: hammasi, olish: olish, saqlash: saqlash, ochirish: ochirish,
    hammasiniOqish: hammasiniOqish, almashtirish: almashtirish
  };
})(typeof window !== 'undefined' ? window : this);
