// Service worker: bildirishnoma (Web Push) hodisalari (TZ-sinxronlash.md 46-band). sw.js uni importScripts bilan yuklaydi.
// MUHIM: bu fayl ham ma'lumotlar bazasiga (IndexedDB) HECH QACHON tegmaydi; xabar matni faqat ko'rsatiladi, hech qayerga saqlanmaydi.
'use strict';

(function () {
  var BOSHLANGICH_SARLAVHA = 'Chuntak AI';
  var IKON = 'icons/icon-192.png';
  var TAG = 'chuntak-eslatma';   // data.tag berilmasa: bir xil turdagi eslatmalar bir-birini almashtiradi (to'planib qolmaydi)

  // Xabar tanasi: { title, body, tag, data: { url } }. Buzuq yoki bo'sh bo'lsa ham bildirishnoma ko'rsatiladi
  // (brauzer "ko'rinadigan bildirishnoma" majburiyatini talab qiladi; ko'rsatmasak, push obunasi bekor qilinishi mumkin).
  function oqi(hodisa) {
    try { var j = hodisa.data && hodisa.data.json(); return j && typeof j === 'object' ? j : {}; } catch (e) { return {}; }
  }
  function matn(x, maks) { return typeof x === 'string' ? x.slice(0, maks) : ''; }

  self.addEventListener('push', function (hodisa) {
    var x = oqi(hodisa);
    var url = x.data && typeof x.data.url === 'string' ? x.data.url : '';
    var ikon = new URL(IKON, self.registration.scope).href;
    hodisa.waitUntil(self.registration.showNotification(matn(x.title, 100) || BOSHLANGICH_SARLAVHA, {
      body: matn(x.body, 300),
      icon: ikon,
      badge: ikon,
      tag: matn(x.tag, 60) || TAG,
      data: { url: url }
    }));
  });

  // Faqat ilovaning o'z manzili ochiladi (boshqa saytga yo'naltirib bo'lmaydi)
  function ochiladiganManzil(url) {
    try {
      var u = new URL(url, self.registration.scope);
      if (u.origin === self.location.origin) return u.href;
    } catch (e) { /* pastga */ }
    return self.registration.scope;
  }

  self.addEventListener('notificationclick', function (hodisa) {
    hodisa.notification.close();
    var manzil = ochiladiganManzil(hodisa.notification.data && hodisa.notification.data.url);
    hodisa.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (oynalar) {
      for (var i = 0; i < oynalar.length; i++) {
        if (oynalar[i].url.indexOf(self.registration.scope) === 0 && 'focus' in oynalar[i]) return oynalar[i].focus();   // ochiq oyna bor: shunga o'tiladi
      }
      return self.clients.openWindow(manzil);
    }));
  });
})();
