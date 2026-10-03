// Ma'lumotni saqlash va o'qish (IndexedDB). Bu faylda ekran bilan ishlaydigan kod yo'q.
(function (global) {
  'use strict';

  var DB_NOMI = 'moliya';
  var SXEMA_VERSIYASI = 1;
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
      var so = indexedDB.open(nom || DB_NOMI, SXEMA_VERSIYASI);
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

  // Birinchi ochilishda tayyor ma'lumotni bir marta yozadi
  function boshlangichMalumot() {
    return olish('sozlamalar', 'asosiy').then(function (s) {
      if (s) return;
      var hozir = new Date().toISOString();
      var vaqt = Date.now();
      var tx = db.transaction(['hisoblar', 'kategoriyalar', 'sozlamalar'], 'readwrite');
      tx.objectStore('hisoblar').put({
        id: yangiId(), yaratilgan: hozir, nom: 'Naqd pul', tur: 'naqd',
        boshlangich_qoldiq: 0, arxivlangan: false
      });
      function kategoriyalar(royxat, tur) {
        royxat.forEach(function (k) {
          // yaratilgan har biriga 1 ms farq bilan yoziladi: ro'yxat tayyor tartibda chiqishi uchun
          tx.objectStore('kategoriyalar').put({
            id: yangiId(), yaratilgan: new Date(vaqt++).toISOString(), nom: k[0], tur: tur, rang: k[1], arxivlangan: false
          });
        });
      }
      kategoriyalar(XARAJAT_KATEGORIYALARI, 'xarajat');
      kategoriyalar(DAROMAD_KATEGORIYALARI, 'daromad');
      tx.objectStore('sozlamalar').put({
        kalit: 'asosiy', sxema_versiyasi: SXEMA_VERSIYASI, oxirgi_zaxira_sanasi: null
      });
      return new Promise(function (resolve, reject) {
        tx.oncomplete = resolve;
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error); };
      });
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
    }).then(function () { return doimiySaqlash(); });
  }

  function yopish() { if (db) { db.close(); db = null; } }

  global.Data = {
    SXEMA_VERSIYASI: SXEMA_VERSIYASI,
    yangiId: yangiId, boshlash: boshlash, yopish: yopish,
    hammasi: hammasi, olish: olish, saqlash: saqlash, ochirish: ochirish
  };
})(typeof window !== 'undefined' ? window : this);
