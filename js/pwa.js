// PWA: service worker ro'yxatdan o'tkazish, "Yangilash" tugmasi, bosh ekranga o'rnatish.
// Service worker ma'lumotlar bazasiga (IndexedDB) tegmaydi; bu fayl ham unga tegmaydi.
var Pwa = (function () {
  'use strict';
  var royxat = null;            // ServiceWorkerRegistration
  var ornatishHodisasi = null;  // beforeinstallprompt
  var qayta = false;            // controllerchange dan keyin bir marta qayta yuklash
  var kuzatuvchilar = [];

  function sahifaVersiyasi() { return (document.querySelector('meta[name="versiya"]') || {}).content || ''; }
  function ishlaydimi() {
    return 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1');
  }
  function workerVersiyasi(w) { try { return new URL(w.scriptURL).searchParams.get('v') || ''; } catch (e) { return ''; } }

  // ---- "Yangilash" paneli ----
  function yangilashPaneli(worker) {
    if (document.getElementById('yangilash-paneli')) return;
    var p = document.createElement('div');
    p.id = 'yangilash-paneli';
    p.className = 'yangilash-paneli';
    p.setAttribute('role', 'status');
    var m = document.createElement('span');
    m.textContent = 'Yangi versiya tayyor';
    var b = document.createElement('button');
    b.type = 'button';
    b.id = 'yangilash-tugma';
    b.textContent = 'Yangilash';
    b.addEventListener('click', function () {
      b.disabled = true;
      b.textContent = 'Yangilanmoqda…';
      // Sinxronlash (birinchi sinxron yoki tsikl) ketayotgan bo'lsa, u tugashini (ko'pi bilan 15 soniya) kutamiz: yarim yo'lda qayta yuklanmasin
      var t0 = Date.now();
      (function kut() {
        if (typeof Sinxron !== 'undefined' && Sinxron.band() && Date.now() - t0 < 15000) { setTimeout(kut, 300); return; }
        try { worker.postMessage({ tur: 'yangilash' }); } catch (e) { location.reload(); }
      })();
    });
    p.appendChild(m);
    p.appendChild(b);
    document.body.appendChild(p);
  }

  // Kutayotgan yangi worker: sahifa allaqachon shu versiyada bo'lsa — jimgina faollashtiriladi; boshqacha bo'lsa — "Yangilash" paneli
  function kutayotganniKorish(worker) {
    if (!worker || !navigator.serviceWorker.controller) return;   // birinchi o'rnatish: hech narsa ko'rsatilmaydi
    if (workerVersiyasi(worker) === sahifaVersiyasi()) { worker.postMessage({ tur: 'yangilash' }); return; }
    yangilashPaneli(worker);
  }

  function kuzat(reg) {
    if (reg.waiting) kutayotganniKorish(reg.waiting);
    reg.addEventListener('updatefound', function () {
      var w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', function () { if (w.state === 'installed') kutayotganniKorish(w); });
    });
  }

  // Server hozir qaysi versiyada ekanini bilish: index.html ni keshsiz o'qib, <meta name="versiya"> ni solishtiradi.
  // Boshqacha bo'lsa, yangi versiya uchun worker ro'yxatdan o'tkaziladi (u o'rnatilib, "Yangilash" paneli chiqadi).
  function yangilanishniTekshir() {
    if (!royxat || (typeof navigator.onLine === 'boolean' && !navigator.onLine)) return Promise.resolve(false);
    return fetch('index.html', { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (html) {
      var m = html.match(/<meta name="versiya" content="([^"]+)"/);
      if (!m || m[1] === sahifaVersiyasi()) return false;
      return navigator.serviceWorker.register('sw.js?v=' + encodeURIComponent(m[1])).then(function (reg) { royxat = reg; kuzat(reg); return true; });
    }).catch(function () { return false; });   // tarmoq xatosi ahamiyatsiz
  }

  function boshlash() {
    if (!ishlaydimi() || !sahifaVersiyasi()) return;   // faqat ilova sahifasida (tests.html da versiya belgisi yo'q)
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      // yangi worker boshqaruvni oldi: faqat "Yangilash" bosilgan bo'lsa qayta yuklanadi (bir marta)
      if (qayta || !document.getElementById('yangilash-paneli')) return;
      qayta = true;
      location.reload();
    });
    navigator.serviceWorker.register('sw.js?v=' + encodeURIComponent(sahifaVersiyasi())).then(function (reg) {
      royxat = reg;
      kuzat(reg);
      setTimeout(yangilanishniTekshir, 3000);
    }).catch(function () { /* ro'yxatdan o'tmasa ham ilova oddiy ishlayveradi */ });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') yangilanishniTekshir(); });
    window.addEventListener('online', yangilanishniTekshir);
    setInterval(yangilanishniTekshir, 30 * 60 * 1000);
  }

  // ---- Bosh ekranga o'rnatish ----
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    ornatishHodisasi = e;
    kuzatuvchilar.forEach(function (f) { f(); });
  });
  window.addEventListener('appinstalled', function () { ornatishHodisasi = null; kuzatuvchilar.forEach(function (f) { f(); }); });

  function ornatilgan() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  }
  function ornatishMumkin() { return !!ornatishHodisasi; }
  function ornatish() {
    if (!ornatishHodisasi) return Promise.resolve(false);
    var h = ornatishHodisasi;
    ornatishHodisasi = null;
    h.prompt();
    return h.userChoice.then(function (t) { return t && t.outcome === 'accepted'; }).catch(function () { return false; });
  }
  function ornatishKuzat(f) { kuzatuvchilar.push(f); }
  function ios() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }

  if (typeof window !== 'undefined' && document.readyState !== 'loading') boshlash(); else document.addEventListener('DOMContentLoaded', boshlash);

  return { ishlaydimi: ishlaydimi, yangilanishniTekshir: yangilanishniTekshir, ornatilgan: ornatilgan, ornatishMumkin: ornatishMumkin, ornatish: ornatish, ornatishKuzat: ornatishKuzat, ios: ios };
})();
