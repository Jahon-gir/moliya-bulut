// Eslatmalar (bildirishnoma asosi, TZ-sinxronlash.md 46-band): sof funksiyalar. DOM, tarmoq va brauzer API'lari YO'Q (tests.html da to'liq sinaladi).
// Sozlamani tekshirish va normallashtirish, vaqt "HH:MM", qarz kunlari, iPhone/o'rnatilgan holatini aniqlash, ekran holati qarori,
// serverga yoziladigan qator, xato matnlari.
var EslatmaSof = (function () {
  'use strict';

  var SAQLASH_KALITI = 'moliya-eslatma';            // "moliya-" bilan boshlanadi: "PINni unutdim" to'liq tozalashi uni ham o'chiradi
  var QOLGAN_KALIT = 'moliya-eslatma-qolgan';       // serverdan o'chirib bo'lmagan obuna manzillari (keyingi kirishda tozalanadi)
  var QARZ_KUNLAR = [0, 1, 3];                      // muddat kuni, 1 kun oldin, 3 kun oldin
  var TZ_BOSHLANGICH = 'Asia/Tashkent';
  var BOSHLANGICH = {
    kunlikYoqiq: false, kunlikVaqt: '21:00',
    qarzYoqiq: false, qarzKunlar: [0, 1], qarzVaqt: '09:00',
    korsatish: true,
    egasi: '',          // sozlamani yozgan akkaunt (id): boshqa akkaunt bilan kirilsa, sozlama u akkauntga o'tkazilmaydi
    serverda: true      // oxirgi o'zgarish serverga yozilganmi (yozilmagan bo'lsa ekran ochilganda qayta uriniladi)
  };

  // ---- Vaqt "HH:MM" ----
  function vaqtTogrimi(s) { return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s); }
  // "HH:MM" yoki "HH:MM:SS" (soniya tashlanadi); noto'g'ri bo'lsa boshlang'ich
  function vaqtTozala(s, boshlangich) {
    var m = typeof s === 'string' ? /^(\d{2}:\d{2})(:\d{2}(\.\d+)?)?$/.exec(s.trim()) : null;
    return m && vaqtTogrimi(m[1]) ? m[1] : boshlangich;
  }

  // ---- Qarz kunlari: faqat 0, 1, 3; takrorsiz, o'sish tartibida. Massiv bo'lmasa — boshlang'ich [0, 1]. Bo'sh massiv bo'sh qoladi ----
  function qarzKunlariniTozala(x) {
    if (!Array.isArray(x)) return BOSHLANGICH.qarzKunlar.slice();
    var u = [];
    x.forEach(function (k) {
      var n = typeof k === 'string' && /^\d$/.test(k) ? parseInt(k, 10) : k;
      if (QARZ_KUNLAR.indexOf(n) >= 0 && u.indexOf(n) < 0) u.push(n);
    });
    return u.sort(function (a, b) { return a - b; });
  }
  // Chip bosilganda: kun bor bo'lsa olinadi, yo'q bo'lsa qo'shiladi (natija yangi massiv, tartiblangan)
  function qarzKuniniAlmashtir(kunlar, kun) {
    var a = qarzKunlariniTozala(kunlar);
    if (QARZ_KUNLAR.indexOf(kun) < 0) return a;
    return qarzKunlariniTozala(a.indexOf(kun) >= 0 ? a.filter(function (k) { return k !== kun; }) : a.concat([kun]));
  }

  // ---- Sozlama ----
  function sozlamaTozala(x) {
    var o = x && typeof x === 'object' && !Array.isArray(x) ? x : {};
    return {
      kunlikYoqiq: o.kunlikYoqiq === true,
      kunlikVaqt: vaqtTozala(o.kunlikVaqt, BOSHLANGICH.kunlikVaqt),
      qarzYoqiq: o.qarzYoqiq === true,
      qarzKunlar: qarzKunlariniTozala(o.qarzKunlar),
      qarzVaqt: vaqtTozala(o.qarzVaqt, BOSHLANGICH.qarzVaqt),
      korsatish: o.korsatish !== false,
      egasi: typeof o.egasi === 'string' ? o.egasi.slice(0, 64) : '',
      serverda: o.serverda !== false
    };
  }
  function sozlamaOqi(matn) {
    var j = null;
    try { j = matn ? JSON.parse(matn) : null; } catch (e) { j = null; }
    return sozlamaTozala(j);
  }
  function sozlamaYoz(s) { return JSON.stringify(sozlamaTozala(s)); }
  // Obuna kerakmi: kunlik yoki qarz eslatmasidan kamida bittasi yoqiq. Ikkalasi o'chsa — obuna ham o'chiriladi
  function obunaKerakmi(s) { var t = sozlamaTozala(s); return t.kunlikYoqiq || t.qarzYoqiq; }

  // ---- Obuna (PushSubscription.toJSON()) va serverga yoziladigan qator ----
  function obunaMalumoti(j) {
    if (!j || typeof j !== 'object') return null;
    var k = j.keys || {};
    if (typeof j.endpoint !== 'string' || !/^https:\/\//.test(j.endpoint) || j.endpoint.length > 2048) return null;
    if (typeof k.p256dh !== 'string' || !k.p256dh || k.p256dh.length > 200 || typeof k.auth !== 'string' || !k.auth || k.auth.length > 100) return null;
    return { endpoint: j.endpoint, p256dh: k.p256dh, auth_kaliti: k.auth };
  }
  function tzTozala(tz) { return typeof tz === 'string' && /^[A-Za-z_]+(\/[A-Za-z0-9_+\-]+){0,2}$/.test(tz) && tz.length <= 64 ? tz : TZ_BOSHLANGICH; }
  // PostgREST upsert qatori. user_id YUBORILMAYDI: serverdagi trigger uni auth.uid() ga tenglashtiradi (sinxron qatorlari kabi)
  function serverQatori(sozlama, obunaJson, tz) {
    var o = obunaMalumoti(obunaJson);
    if (!o) return null;
    var s = sozlamaTozala(sozlama);
    return {
      endpoint: o.endpoint, p256dh: o.p256dh, auth_kaliti: o.auth_kaliti, tz: tzTozala(tz),
      kunlik_yoqiq: s.kunlikYoqiq, kunlik_vaqt: s.kunlikVaqt,
      qarz_yoqiq: s.qarzYoqiq, qarz_kunlar: s.qarzKunlar, qarz_vaqt: s.qarzVaqt,
      korsatish: s.korsatish
    };
  }

  // base64url -> bayt (pushManager.subscribe applicationServerKey uchun). Noto'g'ri bo'lsa null
  function base64urlBayt(s) {
    if (typeof s !== 'string' || !/^[A-Za-z0-9_-]+={0,2}$/.test(s)) return null;
    var t = s.replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/');
    try {
      var bin = atob(t + '==='.slice((t.length + 3) % 4));
      var b = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
      return b;
    } catch (e) { return null; }
  }
  function baytlarTengmi(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  // ---- Qurilma holati ----
  // iPhone/iPad (iPadOS 13+ o'zini Mac deb ataydi: platform "MacIntel" va sensorli ekran)
  function iosmi(ua, platform, maxTouch) {
    return /iPad|iPhone|iPod/.test(String(ua || '')) || (platform === 'MacIntel' && (maxTouch || 0) > 1);
  }
  // Bosh ekranga o'rnatilgan (standalone): matchMedia('(display-mode: standalone)') yoki iOS'ning navigator.standalone
  function ornatilganmi(displayStandalone, navigatorStandalone) { return displayStandalone === true || navigatorStandalone === true; }

  var MATN = {
    kirmagan: 'Eslatmalar uchun Google bilan kiring',
    qollanmaydi: 'Bu qurilmada bildirishnoma qo\'llab-quvvatlanmaydi',
    ios: 'Bildirishnoma uchun ilovani bosh ekranga o\'rnating (Safari → Ulashish → Bosh ekranga). iOS 16.4 yoki yangisi kerak',
    bloklangan: 'Bildirishnomalar bloklangan. Brauzer sozlamalaridan saytga ruxsat bering'
  };

  // Ekran holatini hal qiladi. env: { kirgan, notification, pushManager, serviceWorker (hammasi bool: API bormi), ios, ornatilgan, ruxsat ('default' | 'granted' | 'denied') }
  // Natija: { tur: 'kirmagan' | 'ios' | 'qollanmaydi' | 'bloklangan' | 'tayyor', matn, boshqaruv (boshqaruvlar yoqilganmi), profilTugma }
  // Tartib muhim: iPhone'da ilova o'rnatilmaguncha Notification/PushManager umuman yo'q, shuning uchun "ios" holati "qollanmaydi" dan OLDIN tekshiriladi.
  function ekranHolati(env) {
    var e = env || {};
    if (!e.kirgan) return { tur: 'kirmagan', matn: MATN.kirmagan, boshqaruv: false, profilTugma: true };
    if (e.ios && !e.ornatilgan) return { tur: 'ios', matn: MATN.ios, boshqaruv: false, profilTugma: false };
    if (!e.notification || !e.pushManager || !e.serviceWorker) return { tur: 'qollanmaydi', matn: MATN.qollanmaydi, boshqaruv: false, profilTugma: false };
    if (e.ruxsat === 'denied') return { tur: 'bloklangan', matn: MATN.bloklangan, boshqaruv: false, profilTugma: false };
    return { tur: 'tayyor', matn: '', boshqaruv: true, profilTugma: false };
  }

  // ---- Xatolar: ekranda "matn (kod: ...)" ----
  var XATO_MATNI = {
    PUSH_RUXSAT: 'Bildirishnoma ruxsati berilmadi.',
    PUSH_OBUNA: 'Qurilmani bildirishnomaga ulab bo\'lmadi.',
    PUSH_SERVER: 'Sozlamani serverga yozib bo\'lmadi.',
    NETWORK: 'Serverga ulanib bo\'lmadi. Internetni tekshirib, qayta urinib ko\'ring.',
    NOT_SIGNED_IN: 'Avval Google bilan kiring.',
    PUSH_TEZ: 'Sinov juda tez-tez. Bir oz kutib, qayta urinib ko\'ring.',
    PUSH_ESKIRGAN: 'Obuna eskirgan, qayta yoqing.',
    PUSH_YOQ: 'Bu qurilma serverda yozilmagan. Eslatmani o\'chirib, qayta yoqing.',
    PUSH_XIZMAT: 'Bildirishnoma xizmati javob bermadi. Keyinroq urinib ko\'ring.',
    SOZLANMAGAN: 'Server bildirishnoma uchun hali sozlanmagan.'
  };
  function xatoMatni(kod) { return XATO_MATNI[kod] || 'Kutilmagan xato. Qayta urinib ko\'ring.'; }
  // Kutubxona/brauzer xatosini kodga aylantiradi (xato.kod bo'lsa — o'sha)
  function xatoKodi(e, boshlangich) {
    if (e && typeof e.kod === 'string' && XATO_MATNI[e.kod]) return e.kod;
    var m = String((e && (e.message || e)) || '').toLowerCase();
    if (/fetch|network|abort|timeout|load failed|internet/.test(m)) return 'NETWORK';
    if (/jwt|kirish muddati|not signed|401/.test(m) || (e && (e.status === 401 || e.code === 'PGRST301'))) return 'NOT_SIGNED_IN';
    return boshlangich || 'PUSH_SERVER';
  }

  // ---- Bildirishnomani bosganda ilova manzilidagi yo'nalish (TZ 47): ?yangi=1 -> yozuv qo'shish oynasi, ?qarzlar=1 -> Qarzlar bo'limi ----
  function manzilYonalishi(search) {
    var p = String(search || '').replace(/^\?/, '').split('&');
    var yon = '';
    p.forEach(function (j) { if (!yon && j === 'yangi=1') yon = 'yangi'; else if (!yon && j === 'qarzlar=1') yon = 'qarzlar'; });
    return yon;
  }
  // Shu ikki parametr olib tashlangan manzil (yo'l + qolgan so'rov + #qism): history.replaceState uchun. Boshqa parametrlarga (masalan Google kirish kodi) tegilmaydi
  function yonalishsizManzil(pathname, search, hash) {
    var qolgan = String(search || '').replace(/^\?/, '').split('&').filter(function (j) { return j && j !== 'yangi=1' && j !== 'qarzlar=1'; });
    return String(pathname || '/') + (qolgan.length ? '?' + qolgan.join('&') : '') + String(hash || '');
  }

  return {
    manzilYonalishi: manzilYonalishi, yonalishsizManzil: yonalishsizManzil,
    SAQLASH_KALITI: SAQLASH_KALITI, QOLGAN_KALIT: QOLGAN_KALIT, QARZ_KUNLAR: QARZ_KUNLAR, TZ_BOSHLANGICH: TZ_BOSHLANGICH, BOSHLANGICH: BOSHLANGICH, MATN: MATN,
    vaqtTogrimi: vaqtTogrimi, vaqtTozala: vaqtTozala, qarzKunlariniTozala: qarzKunlariniTozala, qarzKuniniAlmashtir: qarzKuniniAlmashtir,
    sozlamaTozala: sozlamaTozala, sozlamaOqi: sozlamaOqi, sozlamaYoz: sozlamaYoz, obunaKerakmi: obunaKerakmi,
    obunaMalumoti: obunaMalumoti, tzTozala: tzTozala, serverQatori: serverQatori, base64urlBayt: base64urlBayt, baytlarTengmi: baytlarTengmi,
    iosmi: iosmi, ornatilganmi: ornatilganmi, ekranHolati: ekranHolati, xatoMatni: xatoMatni, xatoKodi: xatoKodi
  };
})();
