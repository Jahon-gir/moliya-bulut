// Google orqali kirish (TZ-sinxronlash.md, S2). Kirish IXTIYORIY: kirmagan foydalanuvchi ilovadan avvalgidek foydalanadi.
// Bu bosqichda ma'lumot serverga YUBORILMAYDI va jadvallar o'qilmaydi/yozilmaydi: faqat kirish, chiqish va sessiya.
// Kutubxona: @supabase/auth-js (supabase-js ning kirish qismi), js/vendor/supabase-auth.min.js — ichki nusxa, service worker keshida.
// Ochiq (publishable) kalit ochiq bo'lishi mumkin; maxfiy kalit (service_role), Google Client Secret va parollar bu yerga HECH QACHON yozilmaydi.
var Kirish = (function () {
  'use strict';

  var SUPABASE_MANZIL = 'https://cqajcalwisdnsvadekxy.supabase.co';
  var OCHIQ_KALIT = 'sb_publishable_f51Qo_Gg5RfAWOMIwz3LHQ_Lpdh5Y5R';
  // Sessiya kaliti "moliya-" bilan boshlanadi: "PINni unutdim" to'liq tozalashi qurilmadagi sessiyani ham o'chiradi
  var SAQLASH_KALITI = 'moliya-supabase-auth';
  var ULANISH_KUTISH_MS = 5000;

  // ---------------- Sof yordamchilar (DOM'siz; tests.html da sinaladi) ----------------
  // Google'dan qaytish manzili: ilovaning o'z manzili (index.html siz). Supabase → Authentication → URL Configuration → Redirect URLs da bo'lishi kerak
  function qaytishManzili(origin, pathname) { return origin + String(pathname || '/').replace(/index\.html$/, ''); }

  // Manzildagi (so'rov va # qismi) kirish qaytishi belgilari: kod, yoki xato
  function manzilTahlili(search, hash) {
    var p = {};
    [search, hash].forEach(function (q) {
      String(q || '').replace(/^[?#]/, '').split('&').forEach(function (juft) {
        if (!juft) return;
        var i = juft.indexOf('='), k = i < 0 ? juft : juft.slice(0, i), v = i < 0 ? '' : juft.slice(i + 1);
        try { p[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) { p[k] = v; }
      });
    });
    var xato = p.error_description || p.error || '';
    return { kod: !!p.code, xato: xato, qaytdi: !!(p.code || xato || p.access_token) };
  }

  function foydalanuvchiMalumoti(u) {
    if (!u) return null;
    var m = u.user_metadata || {};
    var email = u.email || m.email || '';
    var ism = m.full_name || m.name || m.preferred_username || '';
    return { ism: ism || (email ? email.split('@')[0] : ''), email: email };
  }

  // Foydalanuvchiga tushunarli xabar (inglizcha texnik xabar o'rniga)
  function xatoMatni(x) {
    var m = String((x && (x.message || x.error_description)) || x || '').toLowerCase();
    if (!m) return 'Noma\'lum xato. Qayta urinib ko\'ring.';
    if (m.indexOf('access_denied') >= 0 || m.indexOf('denied') >= 0 || m.indexOf('cancel') >= 0) return 'Kirish bekor qilindi.';
    if (m.indexOf('verifier') >= 0 || m.indexOf('pkce') >= 0) return 'Kirish tugamadi: ilova va brauzer sessiyasi mos kelmadi. Ilovani yoping va qayta urinib ko\'ring.';
    if (m.indexOf('redirect') >= 0) return 'Qaytish manzili Supabase sozlamasida ruxsat etilmagan. Ilova egasiga ayting.';
    if (m.indexOf('fetch') >= 0 || m.indexOf('network') >= 0 || m.indexOf('failed to') >= 0) return 'Serverga ulanib bo\'lmadi. Internetni tekshirib, qayta urinib ko\'ring.';
    return 'Kirishda xato chiqdi. Qayta urinib ko\'ring.';
  }

  // ---------------- Holat ----------------
  var holat = { mavjud: false, tayyor: false, kirgan: false, ism: '', email: '', kirmoqda: false, xato: '', qaytdi: false };
  var mijoz = null, boshlandi = false, tayyorSavdo = null, kuzatuvchilar = [];

  function xabarla() { kuzatuvchilar.slice().forEach(function (f) { try { f(holat); } catch (e) { /* ahamiyatsiz */ } }); }
  function kuzat(f) { kuzatuvchilar.push(f); return function () { kuzatuvchilar = kuzatuvchilar.filter(function (x) { return x !== f; }); }; }

  // Qurilmada saqlangan sessiyadagi foydalanuvchi (internetsiz ham ism va email ko'rinishi uchun)
  function saqlanganFoydalanuvchi() {
    try { var s = JSON.parse(localStorage.getItem(SAQLASH_KALITI) || 'null'); return s && s.user ? s.user : null; } catch (e) { return null; }
  }
  function foydalanuvchiniQo(u) {
    var m = foydalanuvchiMalumoti(u);
    holat.kirgan = !!m;
    holat.ism = m ? m.ism : '';
    holat.email = m ? m.email : '';
  }

  // Manzildagi kirish belgilarini (code, error...) tozalaydi (kutubxona xatoda ularni qoldiradi)
  function manzilniTozala() {
    try {
      var u = new URL(location.href);
      ['code', 'error', 'error_code', 'error_description', 'sb'].forEach(function (k) { u.searchParams.delete(k); });
      var h = u.hash;
      if (/(^|[#&])(error|access_token|error_description)=/.test(h)) h = '';
      history.replaceState(history.state, '', u.pathname + u.search + h);
    } catch (e) { /* ahamiyatsiz */ }
  }

  // ---------------- Boshlash ----------------
  // Ilova yuklanishi bilan chaqiriladi (PIN va ma'lumot bazasini KUTMAYDI). Hech qachon xato tashlamaydi.
  function boshlash() {
    if (boshlandi) return tayyorSavdo;
    boshlandi = true;
    var t = manzilTahlili(location.search, location.hash);
    holat.qaytdi = t.qaytdi;
    foydalanuvchiniQo(saqlanganFoydalanuvchi());
    if (typeof SupabaseAuth === 'undefined' || !SupabaseAuth.GoTrueClient) {
      holat.mavjud = false; holat.tayyor = true;
      tayyorSavdo = Promise.resolve(holat);
      return tayyorSavdo;
    }
    try {
      mijoz = new SupabaseAuth.GoTrueClient({
        url: SUPABASE_MANZIL + '/auth/v1',
        headers: { apikey: OCHIQ_KALIT, Authorization: 'Bearer ' + OCHIQ_KALIT },
        storageKey: SAQLASH_KALITI,
        flowType: 'pkce',            // Google'dan faqat bir martalik kod qaytadi (token manzilda ko'rinmaydi)
        persistSession: true,        // sessiya qurilmada saqlanadi: ilova yopilib ochilganda qayta kirish so'ralmaydi
        autoRefreshToken: true,      // token muddati tugamasdan o'zi yangilanadi
        detectSessionInUrl: true
      });
      holat.mavjud = true;
      mijoz.onAuthStateChange(function (hodisa, sessiya) {
        // Ichkarida boshqa so'rov yuborilmaydi (kutubxona talabi): faqat holat yangilanadi
        if (hodisa === 'SIGNED_OUT') foydalanuvchiniQo(null);
        else if (sessiya && sessiya.user) foydalanuvchiniQo(sessiya.user);
        else foydalanuvchiniQo(saqlanganFoydalanuvchi());   // masalan internetsiz va token eskirgan: sessiya qurilmada qoladi
        if (sessiya) { holat.kirmoqda = false; holat.xato = ''; }
        xabarla();
      });
    } catch (e) {
      holat.mavjud = false; holat.tayyor = true; holat.xato = xatoMatni(e);
      tayyorSavdo = Promise.resolve(holat);
      return tayyorSavdo;
    }
    tayyorSavdo = mijoz.initialize().then(function (r) {
      if (r && r.error) { holat.xato = xatoMatni(r.error); manzilniTozala(); }
      return mijoz.getSession();
    }).then(function (r) {
      var s = r && r.data && r.data.session;
      if (s && s.user) foydalanuvchiniQo(s.user); else foydalanuvchiniQo(saqlanganFoydalanuvchi());
      // Kod bor edi, lekin sessiya ochilmadi (masalan, kirish boshqa brauzer/oynada boshlangan): sababi ko'rsatiladi
      if (t.qaytdi && !holat.kirgan && !holat.xato) holat.xato = t.xato ? xatoMatni(t.xato) : xatoMatni('pkce verifier');
      if (t.qaytdi && !holat.kirgan) manzilniTozala();
    }).catch(function (e) {
      holat.xato = xatoMatni(e);
    }).then(function () {
      holat.tayyor = true;
      xabarla();
      return holat;
    });
    window.addEventListener('pageshow', function (e) { if (e.persisted && holat.kirmoqda) { holat.kirmoqda = false; xabarla(); } });   // Google'dan "orqaga" bilan qaytilganda
    return tayyorSavdo;
  }

  // ---------------- Amallar ----------------
  // Server javob beradimi (internet bor-yo'qligini haqiqatan tekshiradi). Faqat tarmoq xatosi — "yo'q".
  function serverBormi() {
    if (typeof navigator.onLine === 'boolean' && !navigator.onLine) return Promise.resolve(false);
    var boshqaruv = typeof AbortController === 'function' ? new AbortController() : null;
    var soat = boshqaruv ? setTimeout(function () { boshqaruv.abort(); }, ULANISH_KUTISH_MS) : null;
    return fetch(SUPABASE_MANZIL + '/auth/v1/health', { headers: { apikey: OCHIQ_KALIT }, cache: 'no-store', signal: boshqaruv ? boshqaruv.signal : undefined })
      .then(function () { return true; }, function () { return false; })
      .then(function (ok) { if (soat) clearTimeout(soat); return ok; });
  }

  // Natija: { ok: true } (brauzer Google ga o'tadi) yoki { ok: false, internetYoq: true } yoki { ok: false, xato }
  function googleBilanKirish() {
    if (!mijoz) return Promise.resolve({ ok: false, xato: 'Kirish hozir mavjud emas.' });
    holat.xato = '';
    return serverBormi().then(function (bor) {
      if (!bor) return { ok: false, internetYoq: true };
      holat.kirmoqda = true; xabarla();
      return mijoz.signInWithOAuth({ provider: 'google', options: { redirectTo: qaytishManzili(location.origin, location.pathname) } }).then(function (r) {
        if (r && r.error) { holat.kirmoqda = false; holat.xato = xatoMatni(r.error); xabarla(); return { ok: false, xato: holat.xato }; }
        return { ok: true };   // sahifa Google ga o'tmoqda
      });
    }).catch(function (e) { holat.kirmoqda = false; holat.xato = xatoMatni(e); xabarla(); return { ok: false, xato: holat.xato }; });
  }

  // Chiqish: faqat shu qurilmadagi sessiya (boshqa qurilmalar kirgan holda qoladi). Internet bo'lmasa ham qurilmada chiqiladi.
  function chiqish() {
    if (!mijoz) { try { localStorage.removeItem(SAQLASH_KALITI); } catch (e) { /* ahamiyatsiz */ } foydalanuvchiniQo(null); xabarla(); return Promise.resolve({ ok: true }); }
    return mijoz.signOut({ scope: 'local' }).then(function (r) {
      var serverXato = r && r.error;
      if (serverXato) { try { localStorage.removeItem(SAQLASH_KALITI); } catch (e) { /* ahamiyatsiz */ } }   // tarmoq xatosida kutubxona sessiyani o'chirmaydi: qo'lda
      foydalanuvchiniQo(null);
      holat.xato = '';
      xabarla();
      return { ok: true, serverdaQolgan: !!serverXato };
    }).catch(function () {
      try { localStorage.removeItem(SAQLASH_KALITI); } catch (e) { /* ahamiyatsiz */ }
      foydalanuvchiniQo(null); xabarla();
      return { ok: true, serverdaQolgan: true };
    });
  }

  function qaytishniOl() { var q = holat.qaytdi; holat.qaytdi = false; return q; }

  return {
    SUPABASE_MANZIL: SUPABASE_MANZIL, OCHIQ_KALIT: OCHIQ_KALIT, SAQLASH_KALITI: SAQLASH_KALITI,
    qaytishManzili: qaytishManzili, manzilTahlili: manzilTahlili, foydalanuvchiMalumoti: foydalanuvchiMalumoti, xatoMatni: xatoMatni,
    boshlash: boshlash, holat: function () { return holat; }, tayyor: function () { return tayyorSavdo || boshlash(); },
    kuzat: kuzat, googleBilanKirish: googleBilanKirish, chiqish: chiqish, qaytishniOl: qaytishniOl
  };
})();
