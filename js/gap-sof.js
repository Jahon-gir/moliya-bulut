// "Gap bilan qo'shish" (TZ-sinxronlash.md 29-band): sof mantiq. Bu faylda DOM, tarmoq va xotira yo'q, tests.html da sinaladi.
// So'rov tanasini yig'ish (limitlar, `eski` tanlash), serverning Yozuv'ini ilova yozuviga moslash, majburiy maydonlarni tekshirish.
// Yozuvni tekshirish va saqlash uchun yangi yo'l yaratilmaydi: tekshiruv mavjud Calc funksiyalari (yozuvniTayyorlash, qarzniTekshir, tolovniTekshir) bilan.
// Gap matni va `eski` hech qayerda saqlanmaydi (na log, na localStorage, na baza): faqat so'rov tanasida serverga ketadi.
var GapSof = (function () {
  'use strict';

  var GAP_MAX = 300;          // serverdagi chegara (28.2)
  var HISOBLAGICH_BOSHI = 250; // shundan keyin belgilar hisoblagichi ko'rinadi
  var NOM_MAX = 60;
  var RO_YXAT_MAX = 100;
  var ESKI_MAX = 20;
  var ESKI_IZOH_MAX = 40;
  var IZOH_MAX = 200;
  var KARTA_MAX = 6;
  var OGOH_MAX = 160;         // bitta ogohlantirish matni (belgi)
  var KUTISH_MS = 60000;      // mijoz kutish chegarasi
  var UMUMIY_OGOHLANTIRISH = 'AI adashishi mumkin: summani tekshiring.';
  var MISOLLAR = ['taksiga 15 ming', 'oylik tushdi 5 mln', 'Aliga 500 ming qarz berdim'];

  var TURLAR = [['xarajat', 'Xarajat'], ['daromad', 'Daromad'], ['qarz', 'Qarz'], ['otkazma', 'O\'tkazma']];
  var QARZ_AMALLAR = [['berdim', 'Berdim'], ['oldim', 'Oldim'], ['qaytardim', 'Qaytardim'], ['qaytarildi', 'Qaytarildi']];
  // Serverning `tur` qiymati -> kartadagi [tur, qarzAmal]
  var SERVER_TUR = {
    xarajat: ['xarajat', null], daromad: ['daromad', null], otkazma: ['otkazma', null],
    qarz_berdim: ['qarz', 'berdim'], qarz_oldim: ['qarz', 'oldim'], qarz_qaytardim: ['qarz', 'qaytardim'], qarz_qaytarildi: ['qarz', 'qaytarildi']
  };

  // ---- Xato matnlari (mavjud xato xabarlari uslubida: oddiy gap + "(kod: ...)") ----
  var YOZUV_YOQ_MATNI = 'Gapda yozuv topilmadi. Masalan: «taksiga 15 ming».';
  var TUSHUNARSIZ_MATNI = 'Tushunmadim. Boshqacha yozib ko\'ring.';
  var XATOLAR = {
    NETWORK_OFFLINE: 'Internet kerak. Ulanib, qayta urinib ko\'ring.',
    NETWORK: 'Serverga ulanib bo\'lmadi. Internetni tekshirib, qayta urinib ko\'ring.',
    VAQT: 'Javob juda kech keldi. Qayta urinib ko\'ring.',
    AUTH_EXPIRED: 'Kirish muddati tugagan. Menyu → Profil dan chiqib, qayta kiring.',
    AI_RUXSAT: 'Kirish muddati tugagan. Menyu → Profil dan chiqib, qayta kiring.',
    AI_LIMIT: 'Bugungi limit tugadi. Ertaga qayta urinib ko\'ring.',
    AI_UZUN: 'Gap juda uzun (300 belgigacha yozing).',
    AI_PROVAYDER: 'Yordamchi hozir javob bera olmayapti. Birozdan keyin qayta urinib ko\'ring.',
    AI_KIRISH: 'So\'rov noto\'g\'ri tuzilgan. Gapni boshqacha yozib ko\'ring.'
  };
  function xatoMatni(kod, debug) {
    var k = String(kod || '').length ? String(kod) : 'JS_UNKNOWN';
    var sabab = typeof debug === 'string' && /^[a-z0-9_]{1,40}$/.test(debug) ? ', sabab: ' + debug : '';
    var matn = XATOLAR[k] || (/^HTTP_/.test(k) ? 'Yordamchi serveri kutilgan javob bermadi.' : 'Kutilmagan xato. Qayta urinib ko\'ring.');
    return matn + '\n(kod: ' + k + sabab + ')';
  }
  // Server `ok:true` qaytarib, yozuv bermagan bo'lsa: sababiga qarab xabar (kodsiz)
  function sababMatni(sabab) { return sabab === 'yozuv_yoq' ? YOZUV_YOQ_MATNI : TUSHUNARSIZ_MATNI; }

  // ---- Manba belgisi (32-band): javob qaysi modeldan kelgani. Server `manba`: "model" (o'z model) | "openai" (zaxira) | null ----
  var MANBA_MATNLARI = {
    model: 'Gapni sizning modelingiz o\'qidi.',
    openai: 'Sizning modelingiz javob bermadi, gapni OpenAI o\'qidi (zaxira).'
  };
  var OVOZ_IZOHI = 'Ovozdan matnni Gemini yozgan.';
  var CHEK_IZOHI = 'Chek rasmidagi matnni Gemini o\'qigan.';
  var MANBA_SARLAVHA = 'Tekshiring va saqlang';
  // Noma'lum yoki yaroqsiz qiymat -> '' (belgi ko'rinmaydi). Qiymat ham rang (model: yashil, openai: sariq) ham matnni tanlaydi.
  function manbaNomi(m) { return m === 'model' || m === 'openai' ? m : ''; }
  // Izoh qutisidagi qatorlar: manba qatori, ovozdan kelgan bo'lsa ikkinchi qator. Manba noma'lum bo'lsa belgi yo'q, shuning uchun qator ham yo'q.
  function manbaIzohi(manba, ovozdan, chek) {
    var n = manbaNomi(manba);
    if (!n) return [];
    var q = [MANBA_MATNLARI[n]];
    if (ovozdan) q.push(OVOZ_IZOHI);
    if (chek) q.push(CHEK_IZOHI);
    return q;
  }

  // ---- Mikrofon (31-band): ovozdan matn. Audio faqat xotirada turadi, hech qayerda saqlanmaydi ----
  var OVOZ_MAX_MS = 30000;      // yozish shuncha vaqtdan keyin o'zi to'xtaydi
  var OVOZ_WAV_HZ = 16000;      // WAV namuna chastotasi (nutq uchun yetarli; 30 s ~ 960 KB)
  var OVOZ_MIN_BAYT = 1000;     // bundan kichik yozuv "ovoz eshitilmadi" deb olinadi (serverga yuborilmaydi)
  var OVOZ_MAX_BAYT = 1900000;  // serverdagi chegara ~2 MB (asl hajm); undan oshsa yuborilmaydi
  // Qurilmaga qarab format: Chrome/Android — webm, iPhone (Safari) — mp4. isTaqiq(mime) — MediaRecorder.isTypeSupported; hech biri bo'lmasa '' (qurilma o'zi tanlaydi)
  var OVOZ_FORMATLAR = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  function ovozFormatiTanla(qollaydimi) {
    for (var i = 0; i < OVOZ_FORMATLAR.length; i++) { try { if (qollaydimi(OVOZ_FORMATLAR[i])) return OVOZ_FORMATLAR[i]; } catch (x) { /* keyingisi */ } }
    return '';
  }
  // Sekundomer: 7 -> "0:07"
  function sekundMatni(soniya) { var s = Math.max(0, Math.floor(soniya)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  var OVOZ_XATOLAR = {
    MIK_RUXSAT: 'Mikrofon ruxsati rad etildi. Brauzer sozlamasidan ruxsat bering.',
    MIK_YOQ: 'Mikrofon topilmadi.',
    MIK_QOLLANMAYDI: 'Bu qurilmada ovoz yozib bo\'lmaydi. Gapni yozib kiriting.',
    MIK_BAND: 'Mikrofonni boshqa ilova ishlatyapti yoki ochib bo\'lmadi. Qayta urinib ko\'ring.',
    OVOZ_YOQ: 'Ovoz eshitilmadi. Yana urinib ko\'ring.',
    AI_HAJM: 'Ovoz juda uzun. Qisqaroq ayting.'
  };
  // Mikrofon xatosi (getUserMedia: NotAllowedError va h.k.) -> ichki kod
  function mikXatoKodi(err) {
    var n = err && err.name;
    if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') return 'MIK_RUXSAT';
    if (n === 'NotFoundError' || n === 'DevicesNotFoundError' || n === 'OverconstrainedError') return 'MIK_YOQ';
    return 'MIK_BAND';
  }
  function ovozXatoMatni(kod, debug) {
    var k = String(kod || '');
    if (OVOZ_XATOLAR[k]) return OVOZ_XATOLAR[k];
    return xatoMatni(k, debug);   // "(kod: AI_PROVAYDER, sabab: gemini_400_mime)"
  }
  // WAV (16 bit PCM, mono): Gemini webm/mp4 ni qabul qilmasligi mumkin, WAV hujjatlashtirilgan format. samples — Float32Array [-1..1].
  function wavYasa(samples, tezlik) {
    var n = samples.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    function yoz(o, t) { for (var i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); }
    yoz(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); yoz(8, 'WAVE'); yoz(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, tezlik, true); v.setUint32(28, tezlik * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); yoz(36, 'data'); v.setUint32(40, n * 2, true);
    for (var j = 0; j < n; j++) { var x = Math.max(-1, Math.min(1, samples[j])); v.setInt16(44 + j * 2, x < 0 ? Math.round(x * 32768) : Math.round(x * 32767), true); }
    return buf;
  }
  // Ko'p kanalli decode natijasi (kanal massivlari) -> mono (o'rtacha)
  function monoQil(kanallar) {
    if (kanallar.length === 1) return kanallar[0];
    var n = kanallar[0].length, m = new Float32Array(n);
    for (var i = 0; i < n; i++) { var t = 0; for (var k = 0; k < kanallar.length; k++) t += kanallar[k][i]; m[i] = t / kanallar.length; }
    return m;
  }
  // Yangi matn gap maydonidagi matnga qo'shiladi (ustiga yozilmaydi), 300 belgigacha
  function matnQosh(mavjud, yangi) {
    var a = String(mavjud == null ? '' : mavjud).replace(/\s+$/, ''), b = birQator(yangi);
    if (!b) return a;
    return (a ? a + ' ' + b : b).slice(0, GAP_MAX);
  }


  // ---- Chek skaneri (TZ-sinxronlash.md 36-band): rasm -> serverning `rasm` rejimi -> ovozdagi kabi karta. Rasm hech qayerda saqlanmaydi ----
  var RASM_UZUN_MAX = 1600;                 // uzun tomon (piksel)
  var RASM_SIFAT = 0.8;                     // JPEG sifati
  var RASM_BAYT_MAX = 1572864;              // 1,5 MB: siqilgan rasm shundan oshmaydi
  var RASM_SIFAT_POGONA = [0.8, 0.7, 0.6, 0.5];
  var RASM_KICHRAYTIRISH = 0.8;             // sig'masa o'lcham shuncha marta kichraytiriladi
  var RASM_KICHRAYTIRISH_MAX = 4;
  var CHEK_KUTISH_MS = 100000;              // ikki bosqich (rasm o'qish + yozuv, Gemini 1 marta qayta urinishi bilan): 60 s yetmaydi; Edge Function chegarasidan (150 s) kam
  // 38-band: galereya inputida accept atributi YO'Q (Chrome faqat rasm MIME turlari bo'lsa o'z tanlagichini ochadi); fayl turi kodda tekshiriladi
  var RASM_KENGAYTMALAR = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
  function rasmFaylimi(nom, tur) {   // tur bor: image/* bo'lsa; tur bo'sh (ba'zi Android fayl tanlagichlari): kengaytma bo'yicha. Ochilishi keyin tekshiriladi.
    tur = String(tur || '').toLowerCase();
    if (tur) return tur.indexOf('image/') === 0;
    var m = /\.([A-Za-z0-9]+)$/.exec(String(nom || ''));
    return !!m && RASM_KENGAYTMALAR.indexOf(m[1].toLowerCase()) >= 0;
  }
  var CHEK_BELGI = 'Chekdan o\'qildi · tekshiring';
  var CHEK_XATOLAR = {
    RASM_KATTA: 'Rasm juda katta. Yaqinroqdan yoki kichikroq rasm oling.',
    RASM_FORMAT: 'Bu rasm turi qabul qilinmaydi. JPEG, PNG yoki WebP rasm tanlang.',
    CHEK_EMAS: 'Rasmda chek topilmadi.',
    RASM_OQILMADI: 'Rasmdagi matnni o\'qib bo\'lmadi. Chekni aniqroq suratga oling.',
    AI_HAJM: 'Rasm juda katta. Yaqinroqdan yoki kichikroq rasm oling.'
  };
  // Uzun tomoni max dan oshmasin, nisbat saqlanadi (kichik rasm kattalashtirilmaydi)
  function rasmOlchami(en, boy, max) {
    en = Math.max(1, Math.round(en)); boy = Math.max(1, Math.round(boy)); max = max || RASM_UZUN_MAX;
    var k = Math.min(1, max / Math.max(en, boy));
    return { en: Math.max(1, Math.round(en * k)), boy: Math.max(1, Math.round(boy * k)) };
  }
  // Siqish: kodla(en, boy, sifat) -> Promise<{ hajm, qiymat }>. Avval sifat tushiriladi (0,8 -> 0,5), sig'masa o'lcham 0,8 baravar kichraytiriladi.
  // kodla xato bersa (katta rasmda canvas xotirasi yetmasa) ham o'lcham kichraytirib qayta uriniladi. Natija: { en, boy, sifat, hajm, qiymat } yoki RASM_KATTA xatosi:
  // sig'magan rasm serverga YUBORILMAYDI. Rasm piksellari bu yerda ushlab turilmaydi.
  function rasmSiq(en, boy, kodla, bayt) {
    bayt = bayt || RASM_BAYT_MAX;
    var o = rasmOlchami(en, boy), urinish = 0;
    function katta() { var x = new Error('RASM_KATTA'); x.kod = 'RASM_KATTA'; return x; }
    function kichraytir() {
      if (++urinish > RASM_KICHRAYTIRISH_MAX) throw katta();
      o = { en: Math.max(1, Math.round(o.en * RASM_KICHRAYTIRISH)), boy: Math.max(1, Math.round(o.boy * RASM_KICHRAYTIRISH)) };
      return sifatdan(0);
    }
    function sifatdan(i) {
      return kodla(o.en, o.boy, RASM_SIFAT_POGONA[i]).then(function (r) {
        if (r && r.hajm > 0 && r.hajm <= bayt) return { en: o.en, boy: o.boy, sifat: RASM_SIFAT_POGONA[i], hajm: r.hajm, qiymat: r.qiymat };
        return i + 1 < RASM_SIFAT_POGONA.length ? sifatdan(i + 1) : kichraytir();
      }, function () { return kichraytir(); });   // canvas xatosi (xotira): o'lchamni kichraytirib qayta
    }
    return sifatdan(0);
  }
  // Juda katta rasm (12–50 MP) bir yo'la canvasga sig'maydi: uzun tomon max*2 dan oshmaguncha bosqichma-bosqich yarmiga kichraytiriladi. [en, boy] ro'yxati (oxirgisi nishon).
  function rasmBosqichlari(en, boy, max) {
    max = max || RASM_UZUN_MAX;
    var q = [], u = Math.max(en, boy);
    while (u > max * 2) { u = Math.ceil(u / 2); q.push(Math.max(1, Math.round(en * u / Math.max(en, boy)))); }
    return q.map(function (x) { return [x, Math.max(1, Math.round(x * boy / en))]; });
  }
  // Serverga ketadigan tana: yozuv rejimidagi kategoriya/hisob/eski ro'yxatlari bilan bir xil (28.2), gap o'rniga rasm
  function rasmTanasi(rasm, mime, m, bugun) {
    var kategoriyalar = kategoriyaNomlari(m);
    return { rejim: 'rasm', rasm: rasm, mime: mime, bugun: bugun, kategoriyalar: kategoriyalar, hisoblar: hisobRoyxati(m), eski: eskiTanla(m.yozuvlar, m, kategoriyalar) };
  }
  var BAND_MATNI = 'Rasm o\'qish xizmati band. Bir daqiqadan keyin qayta urinib ko\'ring.';
  function chekXatoMatni(kod, debug) {
    var k = String(kod || '');
    if (k === 'AI_PROVAYDER' && /^gemini_(429|500|502|503|504)$/.test(String(debug || ''))) return BAND_MATNI + '\n(kod: ' + k + ', sabab: ' + debug + ')';
    if (CHEK_XATOLAR[k]) return CHEK_XATOLAR[k] + '\n(kod: ' + k + ')';
    return ovozXatoMatni(k, debug);
  }

  // ---- Yordamchilar ----
  function tozaMatn(s) { return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ''); }
  function birQator(s) { return tozaMatn(s).replace(/\s+/g, ' ').trim(); }
  function kalitNom(s) { return Calc.nomKaliti(s); }
  function jonli(x) { return x && x.deleted !== true; }
  function faolKategoriyalar(m) { return (m.kategoriyalar || []).filter(function (k) { return jonli(k) && !k.arxivlangan; }); }
  function faolHisoblar(m) { return (m.hisoblar || []).filter(function (h) { return jonli(h) && !h.arxivlangan; }); }
  function hisobTuri(h) { return h.tur === 'naqd' ? 'naqd' : 'karta'; }   // ilovadagi karta/bank/naqd/boshqa -> serverdagi karta|naqd
  function summaFormat(n) { return Calc.raqamFormat(String(n)); }
  function nusxa(k, ozgarish) { var r = {}; Object.keys(k).forEach(function (x) { r[x] = k[x]; }); Object.keys(ozgarish || {}).forEach(function (x) { r[x] = ozgarish[x]; }); return r; }

  // ---- So'rov tanasi ----
  // Kategoriya nomlari: faol, takrorlanmaydigan (harf, bo'shliq, apostrofga e'tiborsiz), nom ≤ 60, ko'pi bilan 100 ta
  function kategoriyaNomlari(m) {
    var korilgan = {}, chiq = [];
    faolKategoriyalar(m).forEach(function (k) {
      var t = birQator(k.nom), kalit = kalitNom(t);
      if (!t || t.length > NOM_MAX || korilgan[kalit] || chiq.length >= RO_YXAT_MAX) return;
      korilgan[kalit] = true; chiq.push(t);
    });
    return chiq;
  }
  function hisobRoyxati(m) {
    var korilgan = {}, chiq = [];
    faolHisoblar(m).forEach(function (h) {
      var t = birQator(h.nom), kalit = kalitNom(t);
      if (!t || t.length > NOM_MAX || korilgan[kalit] || chiq.length >= RO_YXAT_MAX) return;
      korilgan[kalit] = true; chiq.push({ nom: t, turi: hisobTuri(h) });
    });
    return chiq;
  }
  // `eski`: so'nggi oddiy yozuvlardan (xarajat/daromad, kategoriyasi bor) takrorlanmaydigan (izoh, kategoriya) juftlar, eng yangisidan boshlab,
  // ko'pi bilan 20 ta, izoh ≤ 40 belgi va kichik harfda, bo'shlari tashlanadi. kategoriyalar — serverga yuboriladigan nomlar (ro'yxatda yo'q kategoriya tashlanadi).
  function eskiTanla(yozuvlar, m, kategoriyalar) {
    var yuborilgan = {}, nomlar = {}, korilgan = {}, chiq = [];
    (kategoriyalar || []).forEach(function (n) { yuborilgan[kalitNom(n)] = n; });
    faolKategoriyalar(m).forEach(function (k) { var n = yuborilgan[kalitNom(birQator(k.nom))]; if (n) nomlar[k.id] = n; });
    var kalit = function (y) { return String(y.sana || '') + ' ' + String(y.vaqt || '00:00') + ' ' + String(y.yaratilgan || ''); };
    var tartib = (yozuvlar || []).filter(function (y) { return y && jonli(y) && (y.tur === 'xarajat' || y.tur === 'daromad') && y.kategoriya_id && nomlar[y.kategoriya_id]; })
      .sort(function (a, b) { var x = kalit(a), z = kalit(b); return x < z ? 1 : x > z ? -1 : 0; });
    for (var i = 0; i < tartib.length && chiq.length < ESKI_MAX; i++) {
      var izoh = birQator(tartib[i].izoh).toLowerCase().slice(0, ESKI_IZOH_MAX).trim();
      if (!izoh) continue;
      var nom = nomlar[tartib[i].kategoriya_id], j = izoh + '|' + kalitNom(nom);
      if (korilgan[j]) continue;
      korilgan[j] = true; chiq.push({ izoh: izoh, kategoriya: nom });
    }
    return chiq;
  }
  // Serverga ketadigan to'liq tana (28.2). `bugun` — qurilmaning mahalliy sanasi.
  function sorovTanasi(gap, m, bugun) {
    var kategoriyalar = kategoriyaNomlari(m);
    return {
      rejim: 'yozuv', gap: birQator(gap).slice(0, GAP_MAX), bugun: bugun,
      kategoriyalar: kategoriyalar, hisoblar: hisobRoyxati(m), eski: eskiTanla(m.yozuvlar, m, kategoriyalar)
    };
  }

  // ---- Server javobi -> kartalar ----
  // Javobdagi yaroqli yozuvlar (≤ 6): tur ma'lum bo'lgan obyektlar. Natija bo'sh bo'lsa chaqiruvchi sababMatni() ni ishlatadi.
  function yozuvlarniOl(javob) {
    var r = javob && Array.isArray(javob.yozuvlar) ? javob.yozuvlar : [];
    return r.filter(function (y) { return y && typeof y === 'object' && SERVER_TUR[y.tur]; }).slice(0, KARTA_MAX);
  }
  function nomBilanTop(royxat, nom) {
    if (typeof nom !== 'string' || !nom.trim()) return null;
    var k = kalitNom(nom);
    return royxat.filter(function (x) { return kalitNom(x.nom) === k; })[0] || null;
  }
  // ---- Soat va oxirgi ishlatilgan hisob (30-band) ----
  function soatYaroqli(s) { return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s); }
  // Oxirgi hisob qurilmada turga qarab eslab qolinadi: oxirgi = { xarajat: { hisob, hisob2 }, ... } (qarz amallari "qarz" ostida). Hisob endi faol bo'lmasa — '' (Tanlang)
  function oxirgiHisob(oxirgi, tur, m, qaysi) {
    var yozuv = oxirgi && oxirgi[tur], id = yozuv && typeof yozuv[qaysi] === 'string' ? yozuv[qaysi] : '';
    return id && faolHisoblar(m).some(function (h) { return h.id === id; }) ? id : '';
  }
  // Hisob bo'sh bo'lsa oxirgi ishlatilgani qo'yiladi (model topgan hisob ustun). O'tkazmada ikkinchi hisob birinchisiga teng bo'lmasin.
  function oxirgiHisobQoy(k, m, oxirgi) {
    var o = {};
    if (!k.hisob) { var h = oxirgiHisob(oxirgi, k.tur, m, 'hisob'); if (h) o.hisob = h; }
    if (k.tur === 'otkazma' && !k.hisob2) {
      var h2 = oxirgiHisob(oxirgi, k.tur, m, 'hisob2');
      if (h2 && h2 !== (o.hisob || k.hisob)) o.hisob2 = h2;
    }
    return Object.keys(o).length ? nusxa(k, o) : k;
  }
  // Saqlangan karta uchun yangilangan `oxirgi` (xotiradagi obyektga tegmaydi). Faqat to'ldirilgan hisoblar yoziladi.
  function oxirgiYangila(oxirgi, k) {
    var r = nusxa(oxirgi || {}), y = nusxa(r[k.tur] || {});
    if (k.hisob) y.hisob = k.hisob;
    if (k.tur === 'otkazma' && k.hisob2) y.hisob2 = k.hisob2;
    r[k.tur] = y;
    return r;
  }
  function sanaYaroqli(s, bugun) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && s <= bugun; }
  // Serverning Yozuv'i -> tahrirlanadigan karta (ilova yozuvi shaklida: id lar, summa matn ko'rinishida)
  // qosh (ixtiyoriy): { soat: 'HH:MM' (soat maydonining standart qiymati), oxirgi: oxirgi ishlatilgan hisoblar, manba: server javobidagi manba, ovozdan: gap mikrofondan tushganmi }
  function kartaYasash(y, m, bugun, qosh) {
    qosh = qosh || {};
    var t = SERVER_TUR[y.tur] || SERVER_TUR.xarajat;
    var katTop = t[0] === 'xarajat' || t[0] === 'daromad' ? nomBilanTop(faolKategoriyalar(m).filter(function (k) { return k.tur === t[0]; }), y.kategoriya) : null;
    var his = faolHisoblar(m);
    var h = nomBilanTop(his, y.hisob), h2 = t[0] === 'otkazma' ? nomBilanTop(his, y.hisob2) : null;
    var summa = typeof y.summa === 'number' && isFinite(y.summa) && y.summa > 0 && y.summa === Math.floor(y.summa) ? summaFormat(y.summa) : '';
    var ogoh = (Array.isArray(y.ogohlantirish) ? y.ogohlantirish : []).filter(function (x) { return typeof x === 'string' && birQator(x); })
      .map(function (x) { return birQator(x).slice(0, OGOH_MAX); }).slice(0, 5);
    var karta = {
      manba: manbaNomi(qosh.manba), ovozdan: !!qosh.ovozdan, chek: !!qosh.chek, manbaOchiq: false,
      tur: t[0], qarzAmal: t[1], summa: summa, kategoriya: katTop ? katTop.id : '', hisob: h ? h.id : '', hisob2: h2 && (!h || h2.id !== h.id) ? h2.id : '',
      shaxs: typeof y.shaxs === 'string' ? birQator(y.shaxs).slice(0, NOM_MAX) : '', sana: sanaYaroqli(y.sana, bugun) ? y.sana : bugun,
      izoh: birQator(y.izoh).slice(0, IZOH_MAX), vaqt: soatYaroqli(qosh.soat) ? qosh.soat : '', ogohlantirish: ogoh, xatolar: {}, saqlanmoqda: false
    };
    // Chek: soat chekdan (sana ham chekdan o'qilgan bo'lsa). Bugungi sanada hozirdan keyingi soat qo'yilmaydi.
    if (qosh.chek && sanaYaroqli(y.sana, bugun) && soatYaroqli(y.vaqt) && !(y.sana === bugun && soatYaroqli(qosh.soat) && y.vaqt > qosh.soat)) karta.vaqt = y.vaqt;
    return oxirgiHisobQoy(karta, m, qosh.oxirgi);
  }
  // Tepada doim bitta qator, undan keyin serverning ogohlantirishlari
  function ogohlantirishlar(k) { return [UMUMIY_OGOHLANTIRISH].concat(k.ogohlantirish || []); }

  // ---- Tur almashtirish: summa, izoh, sana, hisob saqlanadi; kategoriya faqat yangi tur uchun mos bo'lsa ----
  function turAlmashtir(k, yangiTur, m, oxirgi) {
    var o = { tur: yangiTur, xatolar: {} };
    if (yangiTur === 'qarz') o.qarzAmal = k.qarzAmal || 'berdim';
    if (yangiTur === 'xarajat' || yangiTur === 'daromad') {
      var kat = faolKategoriyalar(m).filter(function (x) { return x.id === k.kategoriya; })[0];
      o.kategoriya = kat && kat.tur === yangiTur ? kat.id : '';
    } else o.kategoriya = '';
    return oxirgiHisobQoy(nusxa(k, o), m, oxirgi);
  }
  function qarzAmalAlmashtir(k, amal) { return nusxa(k, { qarzAmal: amal, xatolar: {} }); }

  // ---- Kartadagi yozuvlar ----
  function kategoriyaRoyxati(m, tur) { return faolKategoriyalar(m).filter(function (k) { return k.tur === tur; }); }
  // Qarzdagi "Kim" tavsiyalari: qaytarishda faqat shu yo'nalishdagi ochiq qarz egalari, aks holda barcha shaxslar
  function shaxslar(m, amal) {
    var yon = amal === 'qaytardim' ? 'oldim' : amal === 'qaytarildi' ? 'berdim' : null, korilgan = {}, chiq = [];
    (m.qarzlar || []).forEach(function (q) {
      if (!jonli(q) || (yon && (q.yonalish !== yon || Calc.qarzYopilganmi(q)))) return;
      var kalit = kalitNom(q.shaxs);
      if (!kalit || korilgan[kalit]) return;
      korilgan[kalit] = true; chiq.push(q.shaxs);
    });
    return chiq;
  }
  function hisobBelgisi(k, qaysi) {
    if (k.tur === 'otkazma') return qaysi === 2 ? 'Qaysi hisobga' : 'Qaysi hisobdan';
    if (k.tur === 'qarz') return k.qarzAmal === 'berdim' || k.qarzAmal === 'qaytardim' ? 'Pul qaysi hisobdan chiqdi' : 'Pul qaysi hisobga tushdi';
    return 'Hisob';
  }
  function shaxsBelgisi(k) { return k.qarzAmal === 'berdim' || k.qarzAmal === 'qaytardim' ? 'Kimga' : 'Kimdan'; }

  // ---- Majburiy maydonlar va saqlashga tayyorlash ----
  // Qaytarish (qaytardim/qaytarildi) mavjud ochiq qarzga to'lov bo'ladi: shaxs bo'yicha eng eski ochiq qarz tanlanadi
  function ochiqQarzTop(m, amal, shaxs) {
    var yon = amal === 'qaytardim' ? 'oldim' : 'berdim', kalit = kalitNom(shaxs);
    var royxat = (m.qarzlar || []).filter(function (q) { return jonli(q) && q.yonalish === yon && !Calc.qarzYopilganmi(q) && kalitNom(q.shaxs) === kalit; });
    royxat.sort(function (a, b) { var x = a.sana + ' ' + (a.vaqt || '00:00'), z = b.sana + ' ' + (b.vaqt || '00:00'); return x < z ? -1 : x > z ? 1 : 0; });
    return royxat[0] || null;
  }
  // To'ldirilmagan majburiy maydonlar: { maydon: 'Tanlang' | 'Kiriting' }. Maydonlar: summa, kategoriya, hisob, hisob2, shaxs, sana
  function majburiyXatolar(k, m) {
    var x = {};
    if (!String(k.summa || '').replace(/\s/g, '')) x.summa = 'Kiriting';
    var his = faolHisoblar(m);
    var hisobBor = function (id) { return his.some(function (h) { return h.id === id; }); };
    if (k.tur === 'xarajat' || k.tur === 'daromad') {
      if (!kategoriyaRoyxati(m, k.tur).some(function (c) { return c.id === k.kategoriya; })) x.kategoriya = 'Tanlang';
    }
    if (!hisobBor(k.hisob)) x.hisob = 'Tanlang';
    if (k.tur === 'otkazma' && !hisobBor(k.hisob2)) x.hisob2 = 'Tanlang';
    if (k.tur === 'qarz' && !birQator(k.shaxs)) x.shaxs = 'Kiriting';
    if (!k.sana) x.sana = 'Kiriting';
    if (k.vaqt && !soatYaroqli(k.vaqt)) x.vaqt = 'Soatni to\'g\'ri kiriting';
    return x;
  }
  var QADAM_MAYDON = { summa: 'summa', kategoriya: 'kategoriya', hisob: 'hisob', qayerdan: 'hisob', qayerga: 'hisob2', vaqt: 'sana' };
  var QARZ_MAYDON = { shaxs: 'shaxs', summa: 'summa', hisob: 'hisob', vaqt: 'sana', muddat: 'sana', yonalish: 'shaxs' };
  // Natija: { xatolar: { maydon: matn } } yoki { amal: 'yozuv', yozuv } | { amal: 'qarz', qarz } | { amal: 'tolov', qarzId, tolov }.
  // hozir — Calc.hozir() (saqlash paytida qayta olinadi). Sana bugun bo'lsa soat hozirgi, aks holda 00:00.
  function saqlashNatijasi(k, m, hozir) {
    var xatolar = majburiyXatolar(k, m);
    if (Object.keys(xatolar).length) return { xatolar: xatolar };
    // Soat kiritilgan bo'lsa shu, bo'sh bo'lsa eskicha: sana bugun bo'lsa hozirgi soat, aks holda 00:00
    var vaqt = soatYaroqli(k.vaqt) ? k.vaqt : k.sana === hozir.sana ? hozir.vaqt : '00:00';
    var izoh = Calc.izohTozala(k.izoh);   // foydalanuvchi yozgan izoh: ko'p qatorli, 500 belgigacha (TZ 48); AI/chek izohi (IZOH_MAX) alohida
    var xato = function (maydon, matn) { var e = {}; e[maydon] = matn; return { xatolar: e }; };
    if (k.tur === 'qarz' && (k.qarzAmal === 'qaytardim' || k.qarzAmal === 'qaytarildi')) {
      var q = ochiqQarzTop(m, k.qarzAmal, k.shaxs);
      if (!q) return xato('shaxs', 'Bu shaxsda ochiq qarz topilmadi');
      var t = Calc.tolovniTekshir(q, { summa: k.summa, hisob: k.hisob, sana: k.sana, vaqt: vaqt }, hozir);
      if (t.xato) return xato(QARZ_MAYDON[t.maydon] || 'summa', t.xato);
      return { amal: 'tolov', qarzId: q.id, tolov: t.tolov };
    }
    if (k.tur === 'qarz') {
      var r = Calc.qarzniTekshir({ yonalish: k.qarzAmal, shaxs: k.shaxs, summa: k.summa, hisob: k.hisob, sana: k.sana, vaqt: vaqt, muddat: '', izoh: izoh }, hozir);
      if (r.xato) return xato(QARZ_MAYDON[r.maydon] || 'summa', r.xato);
      return { amal: 'qarz', qarz: r.qarz };
    }
    var otk = k.tur === 'otkazma';
    var n = Calc.yozuvniTayyorlash({ tur: k.tur, summa: k.summa, kategoriya: otk ? null : k.kategoriya, hisob: k.hisob, qabul: otk ? k.hisob2 : '', vaqt: { sana: k.sana, vaqt: vaqt }, izoh: izoh }, hozir);
    if (n.xato) return xato(QADAM_MAYDON[n.qadam] || 'summa', n.xato);
    return { amal: 'yozuv', yozuv: n.yozuv };
  }

  return {
    GAP_MAX: GAP_MAX, HISOBLAGICH_BOSHI: HISOBLAGICH_BOSHI, ESKI_MAX: ESKI_MAX, ESKI_IZOH_MAX: ESKI_IZOH_MAX, IZOH_MAX: IZOH_MAX, KARTA_MAX: KARTA_MAX, KUTISH_MS: KUTISH_MS,
    MISOLLAR: MISOLLAR, TURLAR: TURLAR, QARZ_AMALLAR: QARZ_AMALLAR, UMUMIY_OGOHLANTIRISH: UMUMIY_OGOHLANTIRISH, YOZUV_YOQ_MATNI: YOZUV_YOQ_MATNI, TUSHUNARSIZ_MATNI: TUSHUNARSIZ_MATNI,
    MANBA_SARLAVHA: MANBA_SARLAVHA, MANBA_MATNLARI: MANBA_MATNLARI, OVOZ_IZOHI: OVOZ_IZOHI, manbaNomi: manbaNomi, manbaIzohi: manbaIzohi, soatYaroqli: soatYaroqli, oxirgiHisobQoy: oxirgiHisobQoy, oxirgiYangila: oxirgiYangila, OVOZ_MAX_MS: OVOZ_MAX_MS, OVOZ_MIN_BAYT: OVOZ_MIN_BAYT, OVOZ_MAX_BAYT: OVOZ_MAX_BAYT, ovozFormatiTanla: ovozFormatiTanla, sekundMatni: sekundMatni,
    CHEK_BELGI: CHEK_BELGI, CHEK_IZOHI: CHEK_IZOHI, CHEK_KUTISH_MS: CHEK_KUTISH_MS, RASM_UZUN_MAX: RASM_UZUN_MAX, RASM_SIFAT: RASM_SIFAT, RASM_BAYT_MAX: RASM_BAYT_MAX, CHEK_XATOLAR: CHEK_XATOLAR,
    rasmOlchami: rasmOlchami, rasmSiq: rasmSiq, rasmBosqichlari: rasmBosqichlari, rasmFaylimi: rasmFaylimi, BAND_MATNI: BAND_MATNI, rasmTanasi: rasmTanasi, chekXatoMatni: chekXatoMatni,
    wavYasa: wavYasa, monoQil: monoQil, OVOZ_WAV_HZ: OVOZ_WAV_HZ, mikXatoKodi: mikXatoKodi, ovozXatoMatni: ovozXatoMatni, matnQosh: matnQosh,
    xatoMatni: xatoMatni, sababMatni: sababMatni, hisobTuri: hisobTuri, summaFormat: summaFormat,
    kategoriyaNomlari: kategoriyaNomlari, hisobRoyxati: hisobRoyxati, eskiTanla: eskiTanla, sorovTanasi: sorovTanasi,
    yozuvlarniOl: yozuvlarniOl, kartaYasash: kartaYasash, ogohlantirishlar: ogohlantirishlar,
    turAlmashtir: turAlmashtir, qarzAmalAlmashtir: qarzAmalAlmashtir, kategoriyaRoyxati: kategoriyaRoyxati, shaxslar: shaxslar,
    hisobBelgisi: hisobBelgisi, shaxsBelgisi: shaxsBelgisi, ochiqQarzTop: ochiqQarzTop, majburiyXatolar: majburiyXatolar, saqlashNatijasi: saqlashNatijasi
  };
})();
