// Service worker: ilovani internetsiz ishlatish uchun fayllarni keshlaydi.
// MUHIM: bu fayl ma'lumotlar bazasiga (IndexedDB) HECH QACHON tegmaydi — faqat Cache Storage bilan ishlaydi.
// Keshlash xatosi ma'lumotga ta'sir qilmaydi: har qanday kesh xatosida so'rov oddiy tarmoq orqali bajariladi.
// Versiya sw.js?v=X.Y.Z manzilidan olinadi (ilova versiyasi bilan bir xil): versiya o'zgarsa, yangi worker o'rnatiladi,
// eski kesh yangisi faollashgandan keyin o'chiriladi. Yangi worker foydalanuvchi "Yangilash"ni bosmaguncha (yoki sahifa
// allaqachon shu versiyada bo'lmaguncha) kutadi.
'use strict';

var VERSIYA = new URL(self.location.href).searchParams.get('v') || 'nomalum';
var KESH_BOSHI = 'chuntak-kesh-';
var KESH = KESH_BOSHI + VERSIYA;
var TARMOQ_KUTISH = 4000;   // ms: tarmoq shundan sekin bo'lsa, keshdagi nusxa ko'rsatiladi

// Oldindan keshlanadigan fayllar (index.html dagi havolalar bilan bir xil ?v= bilan)
function royxat() {
  var v = '?v=' + VERSIYA;
  return ['./', 'index.html', 'manifest.json', 'style.css' + v,
    'js/ilova.js' + v, 'js/tema.js' + v, 'js/pin-erta.js' + v, 'js/belgilar.js' + v, 'js/calc.js' + v, 'js/xlsx.js' + v, 'js/data.js' + v,
    'js/glidirak.js' + v, 'js/diagramma.js' + v, 'js/pin.js' + v, 'js/vendor/supabase-auth.min.js' + v, 'js/vendor/supabase-postgrest.min.js' + v, 'js/kirish.js' + v, 'js/yuklash.js' + v, 'js/sinxron-sof.js' + v, 'js/sinxron.js' + v, 'js/pwa.js' + v, 'js/ui.js' + v,
    'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-192.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'];
}

self.addEventListener('install', function (e) {
  // Biror fayl yuklanmasa, o'rnatish bekor bo'ladi va eski versiya ishlayveradi (yarim kesh bo'lmaydi)
  e.waitUntil(caches.open(KESH).then(function (kesh) {
    return Promise.all(royxat().map(function (url) {
      return fetch(new Request(url, { cache: 'reload' })).then(function (r) {
        if (!r.ok) throw new Error(url + ' yuklanmadi (' + r.status + ')');
        return kesh.put(url, r);
      });
    }));
  }).catch(function (x) {
    return caches.delete(KESH).then(function () { throw x; });
  }));
  // skipWaiting bu yerda chaqirilmaydi: yangilanish "Yangilash" bosilganda (xabar orqali) yoki sahifa allaqachon yangi bo'lsa
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (nomlar) {
    return Promise.all(nomlar.filter(function (n) { return n.indexOf(KESH_BOSHI) === 0 && n !== KESH; }).map(function (n) { return caches.delete(n); }));
  }).catch(function () { /* eski keshni o'chirib bo'lmasa ham ishlayveradi */ }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('message', function (e) {
  if (e.data && e.data.tur === 'yangilash') self.skipWaiting();
  if (e.data && e.data.tur === 'versiya' && e.source) e.source.postMessage({ tur: 'versiya', versiya: VERSIYA });
});

function keshdan(so, ixtiyor) {
  return caches.open(KESH).then(function (kesh) { return kesh.match(so, ixtiyor); }).catch(function () { return undefined; });
}
function keshgaYoz(so, javob) {
  try { caches.open(KESH).then(function (kesh) { return kesh.put(so, javob); }).catch(function () { /* ahamiyatsiz */ }); } catch (x) { /* ahamiyatsiz */ }
}

// Sahifa (index.html): avval tarmoq (yangi versiyani ko'rish uchun), sekin yoki internetsiz bo'lsa — keshdagi index.html
function sahifa(so) {
  var tarmoq = fetch(so, { cache: 'no-cache' }).then(function (r) {
    // Keshga faqat shu worker versiyasidagi index.html yoziladi: yangi versiyaniki eski keshni "zaharlamasin"
    // (aks holda internetsiz yangi sahifa eski faylsiz qolib ketardi)
    if (r && r.ok && r.type === 'basic') {
      var nusxa = r.clone();
      nusxa.text().then(function (t) {
        var m = t.match(/<meta name="versiya" content="([^"]+)"/);
        if (m && m[1] === VERSIYA) keshgaYoz('index.html', new Response(t, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
      }).catch(function () { /* ahamiyatsiz */ });
    }
    return r;
  });
  var kutish = new Promise(function (hal) {
    setTimeout(function () { keshdan('index.html', { ignoreSearch: true }).then(function (k) { if (k) hal(k); }); }, TARMOQ_KUTISH);
  });
  return Promise.race([tarmoq, kutish]).catch(function () {
    return keshdan('index.html', { ignoreSearch: true }).then(function (k) { return k || tarmoq; });
  });
}

// Qolgan fayllar: avval kesh, keyin tarmoq (muvaffaqiyatli javob keshga qo'shiladi)
function fayl(so) {
  return keshdan(so).then(function (k) {
    if (k) return k;
    return keshdan(so, { ignoreSearch: true }).then(function (k2) {
      if (k2 && !/\.(js|css)$/.test(new URL(so.url).pathname)) return k2;
      return fetch(so).then(function (r) {
        if (r && r.ok && r.type === 'basic') keshgaYoz(so, r.clone());
        return r;
      });
    });
  });
}

self.addEventListener('fetch', function (e) {
  var so = e.request;
  if (so.method !== 'GET') return;
  var url;
  try { url = new URL(so.url); } catch (x) { return; }
  if (url.origin !== self.location.origin) return;   // tashqi so'rovlarga tegilmaydi
  var indeksMi = /(^|\/)(index\.html)?$/.test(url.pathname);
  if (indeksMi) { e.respondWith(sahifa(so)); return; }   // ilova sahifasi (ochilganda ham, versiyani tekshirganda ham): avval tarmoq
  if (so.mode === 'navigate') return;                      // boshqa sahifalar (masalan tests.html) brauzerning o'ziga qoladi
  e.respondWith(fayl(so).catch(function () { return fetch(so); }));
});
