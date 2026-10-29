// "Gap bilan qo'shish" (TZ-sinxronlash.md 29-band): Asosiy sahifadagi "Gap bilan" tugmasi, gap yozish ekrani va tahrirlanadigan tasdiqlash kartasi.
// Oqim: gap -> serverning `yozuv` rejimi (28-band, Yordamchi.chaqir) -> kartalar -> foydalanuvchi "Saqlash" bosganda mavjud yozuv/qarz/to'lov mantig'i bilan saqlanadi.
// AI hech narsani o'zi saqlamaydi. Gap matni va `eski` hech qayerda saqlanmaydi (log, konsol, localStorage, baza): faqat xotirada turadi va ekran yopilsa o'chadi.
// Sof mantiq js/gap-sof.js da. Saqlashning o'zi ui.js dagi mavjud funksiyalar orqali (dep `saqla`): bu yerda yangi yozish yo'li yo'q.
var Gap = (function () {
  'use strict';

  // Tashqi bog'liqliklar (tests.html da almashtiriladi)
  var dep = {
    chaqir: function (tana, ms) { return Yordamchi.chaqir(tana, ms); },
    korinishi: function () { return Yordamchi.korinishi(); },
    yopiqmi: function () { return Yordamchi.yopiqmi(); },
    yopiqXabari: function () { return Yordamchi.YOPIQ_XABARI; },
    onlayn: function () { return navigator.onLine !== false; },
    bugun: function () { return Calc.bugun(); },
    hozir: function () { return Calc.hozir(); },
    tasdiq: function (m) { return window.confirm(m); },
    vaqt: GapSof.KUTISH_MS,
    yozgich: null,                       // mikrofon (31-band); null bo'lsa haqiqiy MediaRecorder (pastda), tests.html da almashtiriladi
    rasmTayyorla: null,                  // chek rasmi (36-band): fayl -> Promise<{ rasm: base64, mime }>; null bo'lsa haqiqiy canvas (pastda), tests.html da almashtiriladi
    ovozMax: GapSof.OVOZ_MAX_MS          // yozish chegarasi (ms)
  };
  function sozla(o) { Object.keys(o || {}).forEach(function (k) { dep[k] = o[k]; }); }

  var ui = { malumot: null, xabar: null, saqla: null, tugadi: null, oxirgiOl: null, oxirgiYoz: null, tahrirla: null };
  var tugmaEl = null, ekranEl = null, tanaEl = null;
  // holat: { bosqich: 'yozish' | 'karta', gap, xato, band, kartalar, indeks, saqlangan, sessiya } (faqat xotirada)
  var holat = null;
  var sessiyaSanagich = 0;

  function e(teg, matn, klass) { var x = document.createElement(teg); if (matn !== undefined) x.textContent = matn; if (klass) x.className = klass; return x; }
  function tugma(klass, ariya, bosilganda) { var b = e('button', undefined, klass); b.type = 'button'; if (ariya) b.setAttribute('aria-label', ariya); b.addEventListener('click', bosilganda); return b; }
  var NS = 'http://www.w3.org/2000/svg';
  var ORQAGA_YOL = 'M15 5l-7 7l7 7';
  function orqagaSvg() {
    var s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
    var p = document.createElementNS(NS, 'path'); p.setAttribute('d', ORQAGA_YOL); p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '2'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round'); s.appendChild(p);
    return s;
  }

  // ---- "Gap bilan" tugmasi: Asosiy sahifada, mavjud AI yordamchi tugmasi bilan bir xil qoida (kirgan, yopilmagan, PIN qulfi yo'q) ----
  function tugmaYasash() {
    var b = tugma('gap-tugma', 'Gap bilan qo\'shish', ochish);
    b.id = 'gap-tugma';
    b.appendChild(Ikonlar.chiz('message-plus', 22));
    b.appendChild(e('span', 'Gap bilan'));
    document.body.appendChild(b);
    return b;
  }
  function yangila() {
    if (!ui.malumot) return;
    if (!tugmaEl) tugmaEl = tugmaYasash();
    tugmaEl.hidden = !(dep.korinishi() && !ekranEl);
  }

  // ---- Saqlanmagan kartalar ----
  function saqlanmaganBor() { return !!holat && holat.bosqich === 'karta' && holat.indeks < holat.kartalar.length; }
  function chiqsaBoladimi() { return !saqlanmaganBor() || dep.tasdiq('Saqlanmagan yozuvlar bor. Chiqasizmi?'); }

  // ---- Mikrofon (31-band): MediaRecorder; audio faqat xotirada, serverga base64 bo'lib ketadi va hech qayerda saqlanmaydi ----
  var MIK_YOL = ['M9 2m0 3a3 3 0 0 1 3 -3h0a3 3 0 0 1 3 3v5a3 3 0 0 1 -3 3h0a3 3 0 0 1 -3 -3z', 'M5 10a7 7 0 0 0 14 0', 'M12 17v4', 'M8 21h8'];
  var STOP_YOL = 'M7 7h10v10h-10z';
  var MANBA_YOL = ['M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z'];   // kichik yulduzcha (AI belgisi)
  function mikSvg(yol) {
    var s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
    (Array.isArray(yol) ? yol : [yol]).forEach(function (d) {
      var p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('fill', Array.isArray(yol) ? 'none' : 'currentColor'); p.setAttribute('stroke', 'currentColor');
      p.setAttribute('stroke-width', '2'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round'); s.appendChild(p);
    });
    return s;
  }
  function blobBase64(blob) {
    return new Promise(function (ok, no) {
      var r = new FileReader();
      r.onload = function () { var m = String(r.result).match(/^data:[^,]*,(.*)$/); m ? ok(m[1]) : no(new Error('BASE64')); };
      r.onerror = function () { no(new Error('BASE64')); };
      r.readAsDataURL(blob);
    });
  }
  // Yozilgan audio (webm/mp4) -> 16 kHz mono WAV (Gemini qabul qiladigan format). Brauzer ichida, tarmoqsiz. Bo'lmasa null (asl format yuboriladi).
  function wavgaAylantir(blob) {
    var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC || !blob.arrayBuffer) return Promise.resolve(null);
    return blob.arrayBuffer().then(function (buf) {
      var ctx = new OAC(1, 1, GapSof.OVOZ_WAV_HZ);   // decodeAudioData audioni shu chastotaga keltiradi
      return new Promise(function (ok, no) { var p = ctx.decodeAudioData(buf, ok, no); if (p && p.then) p.then(ok, no); });
    }).then(function (ab) {
      var kanallar = [];
      for (var i = 0; i < ab.numberOfChannels; i++) kanallar.push(ab.getChannelData(i));
      return new Blob([GapSof.wavYasa(GapSof.monoQil(kanallar), ab.sampleRate)], { type: 'audio/wav' });
    }).then(null, function () { return null; });
  }
  function kodXato(kod) { var x = new Error(kod); x.kod = kod; return x; }
  // Haqiqiy yozgich: { bor(), boshla() -> Promise<{ toxtat() -> Promise<{audio, mime}|null>, bekor() }> }
  var haqiqiyYozgich = {
    bor: function () { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && typeof window.MediaRecorder !== 'undefined'); },
    boshla: function () {
      return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (oqim) {
        var bolaklar = [], rec, mime;
        function qoyib() { try { oqim.getTracks().forEach(function (t) { t.stop(); }); } catch (x) { /* ahamiyatsiz */ } }   // mikrofon indikatori o'chadi
        try {
          mime = GapSof.ovozFormatiTanla(function (m) { return MediaRecorder.isTypeSupported(m); });
          rec = mime ? new MediaRecorder(oqim, { mimeType: mime }) : new MediaRecorder(oqim);
        } catch (x) { qoyib(); throw kodXato('MIK_QOLLANMAYDI'); }
        rec.addEventListener('dataavailable', function (h) { if (h.data && h.data.size) bolaklar.push(h.data); });
        rec.start();
        return {
          toxtat: function () {
            return new Promise(function (ok, no) {
              rec.addEventListener('stop', function () {
                qoyib();
                var tur = (rec.mimeType || mime || 'audio/webm'), blob = new Blob(bolaklar, { type: tur });
                bolaklar = [];
                if (blob.size < GapSof.OVOZ_MIN_BAYT) return ok(null);
                wavgaAylantir(blob).then(function (wav) {
                  var son = wav || blob, mime = wav ? 'audio/wav' : tur.split(';')[0];
                  if (son.size > GapSof.OVOZ_MAX_BAYT) throw kodXato('AI_HAJM');
                  return blobBase64(son).then(function (a) { ok({ audio: a, mime: mime }); });
                }).then(null, no);
              });
              try { rec.state !== 'inactive' ? rec.stop() : rec.dispatchEvent(new Event('stop')); } catch (x) { qoyib(); no(kodXato('MIK_BAND')); }
            });
          },
          bekor: function () { bolaklar = []; try { if (rec.state !== 'inactive') { rec.stop(); } } catch (x) { /* ahamiyatsiz */ } qoyib(); }
        };
      }, function (err) { throw kodXato(GapSof.mikXatoKodi(err)); });
    }
  };
  function yozgich() { return dep.yozgich || haqiqiyYozgich; }

  // holat.mik: { bosqich: 'bosh' | 'ulanmoqda' | 'yozilmoqda' | 'tinglanmoqda', soniya }. Tutqich va taymer faqat xotirada.
  var mikTutqich = null, mikTaymer = null;
  function mikHolat() { return holat && holat.mik ? holat.mik : null; }
  function mikTaymerToxtat() { if (mikTaymer) { clearInterval(mikTaymer); mikTaymer = null; } }
  // Ekran yopilsa yoki karta bosqichiga o'tilsa yozuv bekor qilinadi, mikrofon qo'yib yuboriladi
  function mikBekor() {
    mikTaymerToxtat();
    var t = mikTutqich; mikTutqich = null;
    if (t) { try { t.bekor(); } catch (x) { /* ahamiyatsiz */ } }
    if (holat && holat.mik) { holat.mik.bosqich = 'bosh'; holat.mik.soniya = 0; }
  }
  function mikYangila() {
    var m = mikHolat(), b = document.getElementById('gap-mik'), h = document.getElementById('gap-mik-holat');
    if (!m || !b) return;
    var yoz = m.bosqich === 'yozilmoqda';
    b.classList.toggle('yozilmoqda', yoz);
    b.classList.toggle('band', m.bosqich === 'tinglanmoqda' || m.bosqich === 'ulanmoqda');
    b.textContent = '';
    b.appendChild(yoz ? mikSvg(STOP_YOL) : mikSvg(MIK_YOL));
    b.setAttribute('aria-label', yoz ? 'Yozishni to\'xtatish' : 'Ovoz bilan yozish');
    b.setAttribute('aria-pressed', String(yoz));
    b.setAttribute('aria-busy', m.bosqich === 'tinglanmoqda' ? 'true' : 'false');
    h.textContent = '';
    h.classList.toggle('yozilmoqda', yoz);
    if (yoz) { h.appendChild(e('span', undefined, 'gp-nuqta')); h.appendChild(e('span', GapSof.sekundMatni(m.soniya) + ' / ' + GapSof.sekundMatni(dep.ovozMax / 1000))); }
    else if (m.bosqich === 'tinglanmoqda') { var a = e('span', undefined, 'gp-aylana'); a.setAttribute('aria-hidden', 'true'); h.appendChild(a); h.appendChild(e('span', 'Tinglanyapti…')); }
    else if (m.bosqich === 'ulanmoqda') h.appendChild(e('span', 'Mikrofon ochilmoqda…'));
  }
  function mikXato(kod, debug) { xatoKorsat(GapSof.ovozXatoMatni(kod, debug)); }
  function mikBosildi() {
    var m = mikHolat();
    if (!m || holat.band) return;
    if (m.bosqich === 'yozilmoqda') { mikToxtat(); return; }
    if (m.bosqich !== 'bosh') return;      // ulanmoqda yoki tinglanmoqda: ikki marta bosishdan himoya
    if (chekBandmi()) { xatoKorsat('Chek o\'qilmoqda, biroz kuting.'); return; }
    menyuYop();
    if (!dep.onlayn()) { mikXato('NETWORK_OFFLINE'); return; }
    if (!yozgich().bor()) { mikXato('MIK_QOLLANMAYDI'); return; }
    var sessiya = holat.sessiya, h = holat;
    holat.xato = ''; var x = document.getElementById('gap-xato'), mt = document.getElementById('gap-matn'); if (x) x.textContent = ''; if (mt) mt.classList.remove('xatoli');
    m.bosqich = 'ulanmoqda'; m.soniya = 0; mikYangila();
    yozgich().boshla().then(function (tutqich) {
      if (!holat || holat.sessiya !== sessiya) { try { tutqich.bekor(); } catch (z) { /* ahamiyatsiz */ } return; }
      mikTutqich = tutqich; m.bosqich = 'yozilmoqda'; m.soniya = 0;
      var boshi = Date.now();
      mikTaymer = setInterval(function () {
        if (!holat || holat.sessiya !== sessiya || m.bosqich !== 'yozilmoqda') { mikTaymerToxtat(); return; }
        var o = Date.now() - boshi; m.soniya = Math.min(o, dep.ovozMax) / 1000; mikYangila();
        if (o >= dep.ovozMax) mikToxtat();   // 30 soniyadan keyin o'zi to'xtaydi
      }, 200);
      mikYangila();
    }, function (err) {
      if (!holat || holat.sessiya !== sessiya) return;
      m.bosqich = 'bosh'; mikYangila();
      mikXato((err && err.kod) || 'MIK_BAND');
    });
  }
  function mikToxtat() {
    var m = mikHolat(), t = mikTutqich;
    if (!m || m.bosqich !== 'yozilmoqda' || !t) return;
    var sessiya = holat.sessiya, h = holat;
    mikTaymerToxtat(); mikTutqich = null;
    m.bosqich = 'tinglanmoqda'; mikYangila();
    t.toxtat().then(function (ovoz) {
      if (!holat || holat.sessiya !== sessiya) return;
      if (!ovoz) return Promise.reject(kodXato('OVOZ_YOQ'));
      if (!dep.onlayn()) return Promise.reject(kodXato('NETWORK_OFFLINE'));
      return dep.chaqir({ rejim: 'ovoz', audio: ovoz.audio, mime: ovoz.mime }, dep.vaqt);   // audio shu yerda ketadi va yo'qoladi
    }).then(function (j) {
      if (!j || !holat || holat.sessiya !== sessiya) return;
      m.bosqich = 'bosh'; mikYangila();
      h.gap = GapSof.matnQosh(h.gap, j.matn);
      var ta = document.getElementById('gap-matn');
      if (ta) { ta.value = h.gap; ta.dispatchEvent(new Event('input')); ta.focus(); }   // matn tahrirlash uchun maydonga tushadi; yozuvga AYLANTIRILMAYDI
      h.ovozdan = true;   // kartadagi manba izohida "Ovozdan matnni Gemini yozgan" (32-band)
    }).catch(function (err) {
      if (!holat || holat.sessiya !== sessiya) return;
      m.bosqich = 'bosh'; mikYangila();
      var kod = (err && err.kod) || ('JS_' + String((err && err.name) || 'XATO').replace(/[^A-Za-z0-9]/g, '').toUpperCase());
      if (kod === 'AI_RUXSAT' && dep.yopiqmi()) { yop(); if (ui.xabar) ui.xabar(dep.yopiqXabari()); Yordamchi.yangila(); return; }
      mikXato(kod, err && err.debug);
    });
  }


  // ---- Chek skaneri (36-band): kamera/galereya -> rasm xotirada kichraytiriladi -> serverning `rasm` rejimi -> ovozdagi kabi karta ----
  // Rasm hech qayerga SAQLANMAYDI (IndexedDB, localStorage, kesh, fayl, URL.createObjectURL yo'q): faqat so'rovda ketadi va xotiradan tashlanadi.
  // Rasmni ochadi. Juda katta rasm (12–50 MP) bosqichma-bosqich kichraytiriladi (createImageBitmap(resize)), shunda canvas xotirasi to'lmaydi.
  // Xotira yetmasa (to'liq ochib bo'lmasa) kichraytirib ochishga urinadi; baribir bo'lmasa RASM_FORMAT.
  function rasmniOch(fayl) {   // -> Promise<{ manba, en, boy, yop() }>; EXIF yo'nalishi hisobga olinadi (en/boy aylantirilgan holda)
    if (!fayl || !GapSof.rasmFaylimi(fayl.name, fayl.type)) return Promise.reject(kodXato('RASM_FORMAT'));   // rasm emas: serverga hech narsa ketmaydi
    function bitmapdan(b) {
      return { manba: b, en: b.width, boy: b.height, yop: function () { try { b.close(); } catch (x) { /* ahamiyatsiz */ } } };
    }
    function imgYol() {
      return new Promise(function (ok, no) {
        var r = new FileReader();
        r.onerror = function () { no(kodXato('RASM_FORMAT')); };
        r.onload = function () {
          var im = new Image();
          im.onload = function () { ok({ manba: im, en: im.naturalWidth, boy: im.naturalHeight, yop: function () { im.src = ''; } }); };   // zamonaviy brauzer EXIF yo'nalishini o'zi qo'llaydi
          im.onerror = function () { no(kodXato('RASM_FORMAT')); };
          im.src = String(r.result);
        };
        r.readAsDataURL(fayl);
      });
    }
    if (typeof window.createImageBitmap !== 'function') return imgYol();
    function kichraytirib(r) {   // katta bitmap -> bosqichma-bosqich yarmiga (har bosqichda eskisi yopiladi)
      var q = GapSof.rasmBosqichlari(r.en, r.boy);
      var z = Promise.resolve(r);
      q.forEach(function (v) {
        z = z.then(function (x) {
          return window.createImageBitmap(x.manba, { resizeWidth: v[0], resizeHeight: v[1], resizeQuality: 'medium' }).then(function (b) { x.yop(); return bitmapdan(b); }, function () { return x; });   // bo'lmasa shu holicha qoladi
        });
      });
      return z;
    }
    return window.createImageBitmap(fayl, { imageOrientation: 'from-image' }).then(function (b) {
      return kichraytirib(bitmapdan(b));
    }, function () {
      // to'liq ochilmadi (xotira yoki qo'llanmaydigan variant): <img> yo'li, u ham bo'lmasa kichraytirib ochish (resizeWidth, nisbat saqlanadi)
      return imgYol().then(kichraytirib, function () {
        return window.createImageBitmap(fayl, { imageOrientation: 'from-image', resizeWidth: GapSof.RASM_UZUN_MAX * 2, resizeQuality: 'medium' }).then(function (b) { return bitmapdan(b); }, function () { throw kodXato('RASM_FORMAT'); });
      });
    });
  }
  function rasmKodla(manba) {
    return function (en, boy, sifat) {
      return new Promise(function (ok, no) {
        var cv = document.createElement('canvas'); cv.width = en; cv.height = boy;
        var cx = cv.getContext('2d');
        if (!cx) { no(kodXato('RASM_FORMAT')); return; }
        try {
          cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, en, boy);   // shaffof PNG JPEG da qora bo'lib qolmasin
          cx.drawImage(manba, 0, 0, en, boy);
        } catch (x) { cv.width = cv.height = 0; no(kodXato('RASM_KATTA')); return; }   // xotira yetmadi: rasmSiq o'lchamni kichraytirib qayta uradi
        cv.toBlob(function (blob) {
          cv.width = cv.height = 0;   // canvas xotirasi bo'shatiladi
          blob ? ok({ hajm: blob.size, qiymat: blob }) : no(kodXato('RASM_KATTA'));
        }, 'image/jpeg', sifat);
      });
    };
  }
  var haqiqiyRasm = function (fayl) {
    var o = null;
    return rasmniOch(fayl).then(function (r) {
      o = r;
      return GapSof.rasmSiq(r.en, r.boy, rasmKodla(r.manba));
    }).then(function (s) {
      return blobBase64(s.qiymat).then(function (a) {
        if (a.length * 0.75 > GapSof.RASM_BAYT_MAX + 3) throw kodXato('RASM_KATTA');   // sig'magan rasm serverga yuborilmaydi
        return { rasm: a, mime: 'image/jpeg' };
      });
    }).then(function (x) { if (o) o.yop(); return x; }, function (err) { if (o) o.yop(); throw err; });
  };
  function rasmTayyorla(fayl) { return (dep.rasmTayyorla || haqiqiyRasm)(fayl); }

  function chekHolat() { return holat && holat.chek ? holat.chek : null; }
  function chekBandmi() { var c = chekHolat(); return !!c && c.bosqich !== 'bosh'; }
  // So'rovni to'xtatadi, rasm tashlanadi. Eskirgan javob e'tiborga olinmaydi (n o'zgargan).
  function chekBekor() {
    var c = chekHolat();
    if (!c) return;
    c.n++;
    var ac = c.ac; c.ac = null; c.bosqich = 'bosh';
    if (ac) { try { ac.abort(); } catch (x) { /* ahamiyatsiz */ } }
  }
  function chekYangila() {
    var c = chekHolat(), q = document.getElementById('gap-chek-holat'), kamera = document.getElementById('gap-kamera');
    if (!c || !q) return;
    q.textContent = '';
    var band = c.bosqich !== 'bosh';
    if (kamera) { kamera.classList.toggle('band', band); kamera.setAttribute('aria-disabled', String(band)); }
    if (!band) { q.hidden = true; return; }
    q.hidden = false;
    var ik = e('span', undefined, 'gp-chek-ikon'); ik.setAttribute('aria-hidden', 'true'); ik.appendChild(Ikonlar.chiz('receipt', 22));
    var matn = e('div', undefined, 'gp-chek-matn'); matn.appendChild(e('strong', 'Chek o\'qilmoqda…')); matn.appendChild(e('span', 'Rasm saqlanmaydi'));
    var bekor = tugma('gp-chek-bekor', 'Chek o\'qishni bekor qilish', function () { chekBekor(); chekYangila(); });
    bekor.id = 'gap-chek-bekor'; bekor.textContent = 'Bekor';
    var chiziq = e('div', undefined, 'gp-chek-chiziq'); chiziq.setAttribute('aria-hidden', 'true'); chiziq.appendChild(e('span'));
    q.appendChild(ik); q.appendChild(matn); q.appendChild(bekor); q.appendChild(chiziq);
  }
  function chekXato(kod, debug) { xatoKorsat(GapSof.chekXatoMatni(kod, debug)); }

  function chekBoshla(fayl) {
    var c = chekHolat();
    if (!c || c.bosqich !== 'bosh' || holat.band || !fayl) return;
    if (holat.mik && holat.mik.bosqich !== 'bosh') { xatoKorsat(holat.mik.bosqich === 'yozilmoqda' ? 'Avval yozishni to\'xtating.' : 'Ovoz matnga aylanmoqda, biroz kuting.'); return; }
    if (!dep.onlayn()) { chekXato('NETWORK_OFFLINE'); return; }
    var sessiya = holat.sessiya, h = holat, n = ++c.n, ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
    h.xato = ''; var x = document.getElementById('gap-xato'), mt = document.getElementById('gap-matn'); if (x) x.textContent = ''; if (mt) mt.classList.remove('xatoli');
    c.bosqich = 'tayyorlanmoqda'; c.ac = ac; chekYangila();
    var eskirgan = function () { return !holat || holat.sessiya !== sessiya || c.n !== n; };
    Promise.resolve().then(function () { return rasmTayyorla(fayl); }).then(function (r) {
      fayl = null;   // fayl havolasi qo'yib yuboriladi
      if (eskirgan()) return null;
      c.bosqich = 'oqilmoqda';
      var tana = GapSof.rasmTanasi(r.rasm, r.mime, ui.malumot(), dep.bugun()); r = null;
      return dep.chaqir(tana, GapSof.CHEK_KUTISH_MS, ac);   // rasm shu yerda ketadi va yo'qoladi
    }).then(function (j) {
      if (!j || eskirgan()) return;
      c.bosqich = 'bosh'; c.ac = null; chekYangila();
      var royxat = GapSof.yozuvlarniOl(j).slice(0, 1);
      if (!royxat.length) { chekXato('RASM_OQILMADI'); return; }
      var m = ui.malumot(), bugun = dep.bugun();
      var qosh = { soat: dep.hozir().vaqt, oxirgi: oxirgiOl(), manba: j && j.manba, chek: true };
      h.kartalar = royxat.map(function (y) { return GapSof.kartaYasash(y, m, bugun, qosh); });
      h.indeks = 0; h.bosqich = 'karta'; mikBekor();
      chiz();
    }).catch(function (err) {
      fayl = null;
      if (eskirgan()) return;
      c.bosqich = 'bosh'; c.ac = null; chekYangila();
      var kod = (err && err.kod) || ('JS_' + String((err && err.name) || 'XATO').replace(/[^A-Za-z0-9]/g, '').toUpperCase());
      if (kod === 'AI_RUXSAT' && dep.yopiqmi()) { yop(); if (ui.xabar) ui.xabar(dep.yopiqXabari()); Yordamchi.yangila(); return; }
      chekXato(kod, err && err.debug);
    });
  }

  // Kamera tugmasi va kichik menyu ("Suratga olish" / "Galereyadan tanlash"). Tashqariga bosilsa yoki Escape bosilsa yopiladi.
  var menyuTashqari = null;
  function menyuYop() {
    var mn = document.getElementById('gap-kamera-menyu'), kb = document.getElementById('gap-kamera');
    if (mn) mn.hidden = true;
    if (kb) kb.setAttribute('aria-expanded', 'false');
    if (menyuTashqari) { document.removeEventListener('click', menyuTashqari); menyuTashqari = null; }
  }
  function menyuOchiqmi() { var mn = document.getElementById('gap-kamera-menyu'); return !!mn && !mn.hidden; }
  function kameraBosildi() {
    if (!holat || holat.band) return;
    if (menyuOchiqmi()) { menyuYop(); return; }
    if (chekBandmi()) return;
    if (holat.mik && holat.mik.bosqich !== 'bosh') { xatoKorsat(holat.mik.bosqich === 'yozilmoqda' ? 'Avval yozishni to\'xtating.' : 'Ovoz matnga aylanmoqda, biroz kuting.'); return; }
    if (!dep.onlayn()) { chekXato('NETWORK_OFFLINE'); return; }
    var mn = document.getElementById('gap-kamera-menyu'), kb = document.getElementById('gap-kamera'), quti = document.getElementById('gap-kamera-quti');
    mn.hidden = false; kb.setAttribute('aria-expanded', 'true');
    menyuTashqari = function (h) { if (quti && !quti.contains(h.target)) menyuYop(); };
    document.addEventListener('click', menyuTashqari);
    var birinchi = mn.querySelector('button'); if (birinchi) birinchi.focus();
  }
  // Ikki ALOHIDA input (37-band): kamera — capture bilan, galereya — capture'siz va accept'siz. Ikkalasi DOM'da, display:none emas
  // (ko'rinmas, lekin joyida: MIUI/Chrome da yashirin inputda tanlagich bo'sh chiqishi mumkin). click() faqat foydalanuvchi bosishi ichida chaqiriladi.
  function faylInput(id, kamera) {
    var i = document.createElement('input');
    i.type = 'file'; i.id = id; i.className = 'gp-fayl-yashirin'; i.tabIndex = -1; i.setAttribute('aria-hidden', 'true');
    if (kamera) { i.accept = 'image/*'; i.setAttribute('capture', 'environment'); }
    // galereya: accept YO'Q va capture YO'Q -> Android tizim tanlagichi (Galereya/Fayllar); fayl turi rasmniOch da tekshiriladi (38-band)
    i.addEventListener('change', function () {
      var f = i.files && i.files[0];
      menyuYop();
      if (f) chekBoshla(f);   // qiymat keyingi ochilishda tozalanadi (tanlangan fayl havolasi o'qilguncha buzilmasin)
    });
    return i;
  }
  function kameraYasash() {
    var quti = e('div', undefined, 'gp-kamera-quti'); quti.id = 'gap-kamera-quti';
    var kb = tugma('yo-doira gp-asbob gp-kamera', 'Chek skaneri', kameraBosildi); kb.id = 'gap-kamera';
    kb.setAttribute('aria-haspopup', 'menu'); kb.setAttribute('aria-expanded', 'false'); kb.setAttribute('aria-controls', 'gap-kamera-menyu');
    kb.appendChild(Ikonlar.chiz('camera', 22));
    var mn = e('div', undefined, 'gp-menyu'); mn.id = 'gap-kamera-menyu'; mn.setAttribute('role', 'menu'); mn.setAttribute('aria-label', 'Chek rasmi'); mn.hidden = true;
    var kamIn = faylInput('gap-rasm-kamera', true), galIn = faylInput('gap-rasm-galereya', false);
    [['camera', 'Suratga olish', kamIn], ['photo', 'Galereyadan tanlash', galIn]].forEach(function (v) {
      var b = tugma('gp-menyu-band', undefined, function () { try { v[2].value = ''; } catch (x) { /* ahamiyatsiz */ } v[2].click(); });   // bir xil rasmni qayta tanlash ham ishlaydi
      b.setAttribute('role', 'menuitem'); b.appendChild(Ikonlar.chiz(v[0], 20)); b.appendChild(e('span', v[1]));
      mn.appendChild(b);
    });
    quti.appendChild(kb); quti.appendChild(mn); quti.appendChild(kamIn); quti.appendChild(galIn);
    return quti;
  }

  // ---- Gap yozish bosqichi ----
  function yozishChiz() {
    var b = tanaEl;
    b.appendChild(e('p', 'Nima qilganingizni oddiy gap bilan yozing.', 'gp-izoh'));
    var quti = e('div', undefined, 'maydon');
    var belgi = e('label', 'Gap'); belgi.setAttribute('for', 'gap-matn');
    var ta = document.createElement('textarea');
    ta.id = 'gap-matn'; ta.className = 'gp-matn'; ta.rows = 4; ta.maxLength = GapSof.GAP_MAX; ta.value = holat.gap; ta.autocomplete = 'off';
    ta.placeholder = 'Masalan: bugun bozorda non va sut oldim 18 ming';
    ta.setAttribute('aria-label', 'Gap');
    var hisob = e('div', undefined, 'gp-hisob'); hisob.id = 'gap-hisob'; hisob.setAttribute('aria-live', 'polite');
    var xato = e('div', holat.xato, 'xato-matn gp-xato'); xato.id = 'gap-xato'; xato.setAttribute('role', 'alert');
    function belgilar() {
      var n = ta.value.length;
      hisob.hidden = n <= GapSof.HISOBLAGICH_BOSHI;
      hisob.textContent = n + ' / ' + GapSof.GAP_MAX;
    }
    ta.addEventListener('input', function () { holat.gap = ta.value; if (!ta.value.trim()) holat.ovozdan = false; holat.xato = ''; xato.textContent = ''; ta.classList.remove('xatoli'); belgilar(); });
    if (holat.xato) ta.classList.add('xatoli');
    var qator = e('div', undefined, 'gp-matn-qator');
    var mik = tugma('yo-doira gp-asbob gp-mik', 'Ovoz bilan yozish', mikBosildi); mik.id = 'gap-mik';
    qator.appendChild(ta); qator.appendChild(kameraYasash()); qator.appendChild(mik);   // kamera mikrofonning CHAP tomonida
    var mikHolatEl = e('div', undefined, 'gp-mik-holat'); mikHolatEl.id = 'gap-mik-holat'; mikHolatEl.setAttribute('role', 'status'); mikHolatEl.setAttribute('aria-live', 'polite');
    var chekHolatEl = e('div', undefined, 'gp-chek-karta'); chekHolatEl.id = 'gap-chek-holat'; chekHolatEl.setAttribute('role', 'status'); chekHolatEl.setAttribute('aria-live', 'polite'); chekHolatEl.hidden = true;
    quti.appendChild(belgi); quti.appendChild(qator); quti.appendChild(mikHolatEl); quti.appendChild(chekHolatEl); quti.appendChild(hisob); quti.appendChild(xato);
    b.appendChild(quti);
    belgilar();
    mikYangila();
    chekYangila();

    var misollar = e('div', undefined, 'chiplar gp-misollar');
    GapSof.MISOLLAR.forEach(function (m) {
      var c = tugma('chip', 'Misol: ' + m, function () {
        if (holat.band) return;
        holat.gap = m; holat.ovozdan = false; holat.xato = ''; ta.value = m; xato.textContent = ''; ta.classList.remove('xatoli'); belgilar(); ta.focus();
      });
      c.textContent = m;
      misollar.appendChild(c);
    });
    b.appendChild(misollar);

    var yuborTugma = tugma('asosiy-tugma gp-yubor', undefined, yuborish);
    yuborTugma.id = 'gap-aylantirish';
    b.appendChild(yuborTugma);
    yuborTugmaYangila(yuborTugma);
    return ta;
  }
  function yuborTugmaYangila(t) {
    t = t || document.getElementById('gap-aylantirish');
    if (!t) return;
    t.textContent = '';
    t.classList.toggle('band', !!holat.band);
    t.setAttribute('aria-disabled', holat.band ? 'true' : 'false');
    t.setAttribute('aria-busy', holat.band ? 'true' : 'false');
    if (holat.band) { var a = e('span', undefined, 'gp-aylana'); a.setAttribute('aria-hidden', 'true'); t.appendChild(a); t.appendChild(e('span', 'Tahlil qilinmoqda…')); t.setAttribute('aria-label', 'Tahlil qilinmoqda'); }
    else { t.textContent = 'Yozuvga aylantirish'; t.removeAttribute('aria-label'); }
  }
  function xatoKorsat(matn) {
    holat.xato = matn;
    var x = document.getElementById('gap-xato'), ta = document.getElementById('gap-matn');
    if (x) x.textContent = matn;
    if (ta) { ta.classList.add('xatoli'); ta.focus(); }
  }

  function yuborish() {
    if (!holat || holat.band) return;   // ikki marta yuborishdan himoya
    if (holat.mik && holat.mik.bosqich !== 'bosh') { xatoKorsat(holat.mik.bosqich === 'yozilmoqda' ? 'Avval yozishni to\'xtating.' : 'Ovoz matnga aylanmoqda, biroz kuting.'); return; }
    if (chekBandmi()) { xatoKorsat('Chek o\'qilmoqda, biroz kuting.'); return; }
    var gap = String(holat.gap || '').replace(/\s+/g, ' ').trim();
    if (!gap) { xatoKorsat('Gap yozing'); return; }
    if (!dep.onlayn()) { xatoKorsat(GapSof.xatoMatni('NETWORK_OFFLINE')); return; }
    var sessiya = holat.sessiya, h = holat;
    h.band = true; h.xato = '';
    var ta = document.getElementById('gap-matn'), x = document.getElementById('gap-xato');
    if (x) x.textContent = ''; if (ta) ta.classList.remove('xatoli');
    yuborTugmaYangila();
    var tana;
    try { tana = GapSof.sorovTanasi(gap, ui.malumot(), dep.bugun()); } catch (err) { tana = null; }
    var p = tana ? dep.chaqir(tana, dep.vaqt) : Promise.reject(new Error('JS_TANA'));
    p.then(function (j) {
      if (!holat || holat.sessiya !== sessiya) return;   // ekran yopilgan: eski javob ko'rsatilmaydi
      var royxat = GapSof.yozuvlarniOl(j);
      h.band = false;
      if (!royxat.length) { yuborTugmaYangila(); xatoKorsat(GapSof.sababMatni(j && j.sabab)); return; }
      var m = ui.malumot(), bugun = dep.bugun();
      var qosh = { soat: dep.hozir().vaqt, oxirgi: oxirgiOl(), manba: j && j.manba, ovozdan: !!h.ovozdan };
      h.kartalar = royxat.map(function (y) { return GapSof.kartaYasash(y, m, bugun, qosh); });
      h.indeks = 0; h.bosqich = 'karta'; mikBekor();
      chiz();
    }, function (err) {
      if (!holat || holat.sessiya !== sessiya) return;
      h.band = false;
      var kod = (err && err.kod) || ('JS_' + String((err && err.name) || 'XATO').replace(/[^A-Za-z0-9]/g, '').toUpperCase());
      if (kod === 'AI_RUXSAT' && dep.yopiqmi()) {   // 403: yordamchi bu foydalanuvchiga yopiq
        yop(); if (ui.xabar) ui.xabar(dep.yopiqXabari()); Yordamchi.yangila(); return;
      }
      yuborTugmaYangila();
      xatoKorsat(GapSof.xatoMatni(kod));
    });
  }

  // ---- Tasdiqlash kartasi ----
  function matnMaydoni(id, belgiMatn, qiymat, ozgarganda, sozlash) {
    var quti = e('div', undefined, 'maydon');
    var belgi = e('label', belgiMatn); belgi.setAttribute('for', id);
    var i = document.createElement('input');
    i.id = id; i.type = 'text'; i.autocomplete = 'off'; i.value = qiymat;
    if (sozlash) sozlash(i);
    i.addEventListener('input', function () { ozgarganda(i.value); });
    var xato = e('div', undefined, 'xato-matn'); xato.setAttribute('role', 'alert');
    quti.appendChild(belgi); quti.appendChild(i); quti.appendChild(xato);
    return { quti: quti, input: i, xato: xato };
  }
  // Izoh maydoni ko'p qatorli (TZ 48): matnMaydoni bilan bir xil tuzilma, lekin <textarea> va hisoblagich bilan
  function izohMaydoni(id, belgiMatn, qiymat, ozgarganda) {
    var quti = e('div', undefined, 'maydon');
    var belgi = e('label', belgiMatn); belgi.setAttribute('for', id);
    var m = Sigdir.izohMaydoni(id, qiymat, ozgarganda);
    var xato = e('div', undefined, 'xato-matn'); xato.setAttribute('role', 'alert');
    quti.appendChild(belgi); quti.appendChild(m.quti); quti.appendChild(xato);
    return { quti: quti, input: m.input, xato: xato };
  }
  function summaMaydoni(k) {
    var m = matnMaydoni('gk-summa', 'Summa (so\'m)', k.summa, function (v) { k.summa = v; }, function (i) { i.inputMode = 'numeric'; i.placeholder = '0'; i.className = 'summa-kiritish summa-katta'; });
    var i = m.input;
    i.addEventListener('input', function () {   // mingliklar ajratiladi (summa maydoni qoidasi); kursor yozilgan raqamdan keyin qoladi
      var poz = i.selectionStart, raqamgacha = i.value.slice(0, poz).replace(/\D/g, '').length;
      var f = Calc.raqamFormat(i.value), yangi = 0, sanoq = 0;
      i.value = f; k.summa = f;
      if (raqamgacha > 0) for (yangi = 0; yangi < f.length; yangi++) { if (/\d/.test(f.charAt(yangi))) sanoq++; if (sanoq === raqamgacha) { yangi++; break; } }
      i.setSelectionRange(yangi, yangi);
    });
    return m;
  }
  function tanlovMaydoni(id, belgiMatn, royxat, qiymat, ozgarganda) {
    var quti = e('div', undefined, 'maydon');
    var belgi = e('label', belgiMatn); belgi.setAttribute('for', id);
    var s = document.createElement('select'); s.id = id;
    var bosh = e('option', 'Tanlang'); bosh.value = ''; s.appendChild(bosh);
    royxat.forEach(function (v) { var o = e('option', v[1]); o.value = v[0]; s.appendChild(o); });
    s.value = qiymat || '';
    s.addEventListener('change', function () { ozgarganda(s.value); });
    var xato = e('div', undefined, 'xato-matn'); xato.setAttribute('role', 'alert');
    quti.appendChild(belgi); quti.appendChild(s); quti.appendChild(xato);
    return { quti: quti, input: s, xato: xato };
  }
  function segment(royxat, tanlangan, ariya, bosilganda) {
    var q = e('div', undefined, 'tanlov gp-segment'); q.setAttribute('role', 'group'); q.setAttribute('aria-label', ariya);
    royxat.forEach(function (v) {
      var b = tugma(undefined, undefined, function () { bosilganda(v[0]); });
      b.textContent = v[1]; b.setAttribute('aria-pressed', String(v[0] === tanlangan)); b.setAttribute('data-qiymat', v[0]);
      q.appendChild(b);
    });
    return q;
  }

  function kartaChiz() {
    var b = tanaEl, k = holat.kartalar[holat.indeks], m = ui.malumot();
    var maydonlar = {};   // maydon nomi -> { input, xato } (xatolarni ko'rsatish uchun)
    function ozgardi(nom) { return function (v) { k[nom] = v; if (k.xatolar[nom]) { delete k.xatolar[nom]; if (maydonlar[nom]) { maydonlar[nom].xato.textContent = ''; maydonlar[nom].input.classList.remove('xatoli'); } } }; }

    if (k.chek) {   // chekdan o'qilgan karta (36-band): tepada kichik ko'k belgi
      var cb = e('div', undefined, 'gp-chek-belgi'); cb.id = 'gap-chek-belgi';
      var cik = e('span', undefined, 'gp-chek-belgi-ikon'); cik.setAttribute('aria-hidden', 'true'); cik.appendChild(Ikonlar.chiz('receipt', 16));
      cb.appendChild(cik); cb.appendChild(e('span', GapSof.CHEK_BELGI));
      b.appendChild(cb);
    }
    if (holat.kartalar.length > 1) {
      var son = e('div', (holat.indeks + 1) + ' / ' + holat.kartalar.length, 'gp-sanoq'); son.id = 'gap-sanoq';
      son.setAttribute('aria-label', (holat.indeks + 1) + '-yozuv, jami ' + holat.kartalar.length);
      b.appendChild(son);
    }
    var ogoh = e('div', undefined, 'gp-ogoh'); ogoh.id = 'gap-ogoh'; ogoh.setAttribute('role', 'note');
    GapSof.ogohlantirishlar(k).forEach(function (t, i) { ogoh.appendChild(e('p', t, i === 0 ? 'gp-ogoh-bosh' : '')); });
    b.appendChild(ogoh);

    var forma = e('form', undefined, 'karta gp-karta'); forma.noValidate = true;
    forma.addEventListener('submit', function (h) { h.preventDefault(); saqlash(); });

    // Sarlavha va manba belgisi (32-band): belgi faqat manba ma'lum bo'lsa; bosilsa karta ichida izoh qutisi ochiladi/yopiladi
    var bosh = e('div', undefined, 'gp-karta-bosh');
    bosh.appendChild(e('h2', GapSof.MANBA_SARLAVHA, 'gp-karta-sarlavha'));
    var izohQatorlari = GapSof.manbaIzohi(k.manba, k.ovozdan, k.chek), izohQuti = null;
    if (izohQatorlari.length) {
      izohQuti = e('div', undefined, 'gp-manba-izoh'); izohQuti.id = 'gap-manba-izoh'; izohQuti.setAttribute('role', 'note'); izohQuti.hidden = !k.manbaOchiq;
      izohQatorlari.forEach(function (t) { izohQuti.appendChild(e('p', t)); });
      var mb = tugma('gp-manba-tugma', 'Javob manbasi', function () {
        k.manbaOchiq = !k.manbaOchiq; izohQuti.hidden = !k.manbaOchiq; mb.setAttribute('aria-expanded', String(k.manbaOchiq));
      });
      mb.id = 'gap-manba'; mb.setAttribute('aria-expanded', String(!!k.manbaOchiq)); mb.setAttribute('aria-controls', 'gap-manba-izoh');
      var belgi = e('span', undefined, 'gp-manba-belgi gp-manba-' + k.manba); belgi.setAttribute('aria-hidden', 'true'); belgi.appendChild(mikSvg(MANBA_YOL));
      mb.appendChild(belgi); bosh.appendChild(mb);
    }
    forma.appendChild(bosh);
    if (izohQuti) forma.appendChild(izohQuti);

    var turQuti = e('div', undefined, 'maydon'); turQuti.appendChild(e('span', 'Turi', 'belgi'));
    turQuti.appendChild(segment(GapSof.TURLAR, k.tur, 'Yozuv turi', function (t) { if (t === k.tur) return; holat.kartalar[holat.indeks] = GapSof.turAlmashtir(k, t, ui.malumot(), oxirgiOl()); chiz(); }));
    forma.appendChild(turQuti);
    if (k.tur === 'qarz') {
      var qq = e('div', undefined, 'maydon'); qq.appendChild(e('span', 'Qarz amali', 'belgi'));
      qq.appendChild(segment(GapSof.QARZ_AMALLAR, k.qarzAmal, 'Qarz amali', function (a) { if (a === k.qarzAmal) return; holat.kartalar[holat.indeks] = GapSof.qarzAmalAlmashtir(k, a); chiz(); }));
      forma.appendChild(qq);
    }

    function qosh(nom, mm) { maydonlar[nom] = mm; if (k.xatolar[nom]) { mm.xato.textContent = k.xatolar[nom]; mm.input.classList.add('xatoli'); mm.input.setAttribute('aria-invalid', 'true'); } if (nom !== 'sana' && nom !== 'vaqt') forma.appendChild(mm.quti); }
    qosh('summa', summaMaydoni(k)); maydonlar.summa.input.addEventListener('input', function () { ozgardi('summa')(k.summa); });

    var hisoblar = m.hisoblar.filter(function (h) { return !h.arxivlangan && h.deleted !== true; }).map(function (h) { return [h.id, h.nom]; });
    if (k.tur === 'xarajat' || k.tur === 'daromad') {
      qosh('kategoriya', tanlovMaydoni('gk-kategoriya', 'Kategoriya', GapSof.kategoriyaRoyxati(m, k.tur).map(function (c) { return [c.id, c.nom]; }), k.kategoriya, ozgardi('kategoriya')));
    }
    if (k.tur === 'qarz') {
      var shaxs = matnMaydoni('gk-shaxs', GapSof.shaxsBelgisi(k), k.shaxs, ozgardi('shaxs'), function (i) { i.maxLength = 60; });
      var dl = document.createElement('datalist'); dl.id = 'gk-shaxslar';
      GapSof.shaxslar(m, k.qarzAmal).forEach(function (n) { var o = document.createElement('option'); o.value = n; dl.appendChild(o); });
      shaxs.input.setAttribute('list', 'gk-shaxslar'); shaxs.quti.appendChild(dl);
      qosh('shaxs', shaxs);
    }
    qosh('hisob', tanlovMaydoni('gk-hisob', GapSof.hisobBelgisi(k, 1), hisoblar, k.hisob, ozgardi('hisob')));
    if (k.tur === 'otkazma') qosh('hisob2', tanlovMaydoni('gk-hisob2', GapSof.hisobBelgisi(k, 2), hisoblar, k.hisob2, ozgardi('hisob2')));

    var sana = matnMaydoni('gk-sana', 'Sana', k.sana, ozgardi('sana'), function (i) { i.type = 'date'; i.max = dep.bugun(); });
    sana.input.addEventListener('change', function () { k.sana = sana.input.value; ozgardi('sana')(k.sana); });
    // Soat sana yonida (bo'sh qoldirilsa eskicha: sana bugun bo'lsa hozirgi soat, aks holda 00:00)
    var soat = matnMaydoni('gk-soat', 'Soat', k.vaqt || '', ozgardi('vaqt'), function (i) { i.type = 'time'; });
    soat.input.addEventListener('change', function () { k.vaqt = soat.input.value; ozgardi('vaqt')(k.vaqt); });
    var qator = e('div', undefined, 'gp-qator');
    qosh('sana', sana); qosh('vaqt', soat);
    qator.appendChild(sana.quti); qator.appendChild(soat.quti); forma.appendChild(qator);
    qosh('izoh', izohMaydoni('gk-izoh', 'Izoh', k.izoh, function (v) { k.izoh = v; }));

    var umumiy = e('div', k.xatolar.umumiy || '', 'xato-matn'); umumiy.setAttribute('role', 'alert'); forma.appendChild(umumiy);
    var saqla = e('button', 'Saqlash', 'asosiy-tugma'); saqla.type = 'submit'; saqla.id = 'gap-saqlash';
    saqla.setAttribute('aria-disabled', k.saqlanmoqda ? 'true' : 'false');
    forma.appendChild(saqla);
    if (k.chek && k.tur !== 'qarz' && ui.tahrirla) {   // oddiy yozuv formasi shu qiymatlar bilan ochiladi; "Saqlash" bosilmaguncha hech narsa yozilmaydi
      var tahrir = tugma('ikkinchi-tugma', 'Tahrirlash: oddiy yozuv formasida ochish', function () { tahrirlash(k); });
      tahrir.textContent = 'Tahrirlash'; tahrir.id = 'gap-tahrirlash';
      forma.appendChild(tahrir);
    }
    var bekor = tugma('ikkinchi-tugma', 'Bekor qilish: bu yozuv saqlanmaydi', function () { if (k.saqlanmoqda) return; keyingi(); });
    bekor.textContent = 'Bekor qilish'; bekor.id = 'gap-bekor';
    forma.appendChild(bekor);
    b.appendChild(forma);
    return maydonlar;
  }

  // Oxirgi ishlatilgan hisoblar (faqat shu qurilmada, ui.js saqlaydi): { tur: { hisob, hisob2 } }
  function oxirgiOl() { try { return ui.oxirgiOl ? ui.oxirgiOl() || {} : {}; } catch (x) { return {}; } }
  var KETMA_KETLIK = ['summa', 'kategoriya', 'shaxs', 'hisob', 'hisob2', 'sana', 'vaqt'];
  function saqlash() {
    var k = holat && holat.kartalar[holat.indeks];
    if (!k || k.saqlanmoqda) return;   // ikki marta bosishdan himoya
    var r = GapSof.saqlashNatijasi(k, ui.malumot(), dep.hozir());
    if (r.xatolar) {
      k.xatolar = r.xatolar; chiz();
      var birinchi = KETMA_KETLIK.filter(function (n) { return k.xatolar[n]; })[0];
      var el = birinchi && document.querySelector('.gp-karta .xatoli');
      if (el) el.focus();
      return;
    }
    k.saqlanmoqda = true; k.xatolar = {};
    var tugma_ = document.getElementById('gap-saqlash'); if (tugma_) tugma_.setAttribute('aria-disabled', 'true');
    var sessiya = holat.sessiya, h = holat;
    Promise.resolve().then(function () { return ui.saqla(r); }).then(function (natija) {
      if (!holat || holat.sessiya !== sessiya) return;
      if (natija && natija.saqlanmadi) {   // hisobda pul yetmaydi (TZ 50): hech narsa yozilmadi, karta ochiq qoladi
        k.saqlanmoqda = false; chiz();
        var h2 = natija.hisob && document.getElementById('gk-hisob');
        if (h2) h2.focus();
        return;
      }
      h.saqlangan++;
      try { if (ui.oxirgiYoz) ui.oxirgiYoz(GapSof.oxirgiYangila(oxirgiOl(), k)); } catch (x) { /* eslab qolish ixtiyoriy */ }
      keyingi();
    }, function (err) {
      if (!holat || holat.sessiya !== sessiya) return;
      k.saqlanmoqda = false; k.xatolar = { umumiy: 'Saqlab bo\'lmadi: ' + (err && err.message ? err.message : err) };
      chiz();
    });
  }
  // Chek kartasi -> oddiy yozuv formasi (ui.js wizard): maydonlar to'ldirilgan holda ochiladi, gap ekrani yopiladi. Bazaga hech narsa yozilmaydi.
  function tahrirlash(k) {
    if (!holat || k.saqlanmoqda || !ui.tahrirla) return;
    var d = { tur: k.tur, summa: k.summa, kategoriya: k.kategoriya, hisob: k.hisob, hisob2: k.hisob2, sana: k.sana, vaqt: k.vaqt, izoh: k.izoh }, f = ui.tahrirla;
    yop();
    f(d);
  }
  function keyingi() {
    holat.indeks++;
    if (holat.indeks >= holat.kartalar.length) { tugat(); return; }
    chiz();
    if (tanaEl) tanaEl.scrollTop = 0;
  }
  function tugat() { yop(); }

  // ---- Ekran ----
  function chiz() {
    if (!tanaEl || !holat) return;
    var ichki = tanaEl.scrollTop;
    tanaEl.textContent = '';
    if (holat.bosqich === 'yozish') yozishChiz(); else kartaChiz();
    tanaEl.scrollTop = ichki;
  }
  function ekranYasash() {
    var ek = e('div', undefined, 'gp-ekran');
    ek.setAttribute('role', 'dialog'); ek.setAttribute('aria-modal', 'true'); ek.setAttribute('aria-label', 'Gap bilan qo\'shish');
    var bosh = e('div', undefined, 'gp-bosh');
    var orqa = tugma('yo-doira', 'Orqaga', chiqish); orqa.id = 'gap-orqaga'; orqa.appendChild(orqagaSvg());
    bosh.appendChild(orqa);
    bosh.appendChild(e('h1', 'Gap bilan qo\'shish'));
    ek.appendChild(bosh);
    tanaEl = e('div', undefined, 'gp-tana'); tanaEl.id = 'gap-tana';
    ek.appendChild(tanaEl);
    return ek;
  }
  function oynaniMoslash() {
    var v = window.visualViewport;
    if (!ekranEl || !v) return;
    ekranEl.style.height = v.height + 'px';
    ekranEl.style.top = v.offsetTop + 'px';
  }
  function chiqish() { if (ekranEl && chiqsaBoladimi()) yop(); }
  function tugmaBosildi(h) {
    if (h.key !== 'Escape' || !ekranEl) return;
    if (menyuOchiqmi()) { menyuYop(); var kb = document.getElementById('gap-kamera'); if (kb) kb.focus(); return; }   // avval kamera menyusi yopiladi
    chiqish();
  }
  // Telefonning "orqaga" tugmasi ekranni yopadi (ilovadan chiqarmaydi); saqlanmagan karta bo'lsa so'raydi, "yo'q" desa tarix yozuvi qaytariladi
  var tarixBor = false;
  function orqagaBosildi() {
    if (!ekranEl) return;
    tarixBor = false;
    if (!chiqsaBoladimi()) { try { history.pushState({ gap: true }, ''); tarixBor = true; } catch (x) { tarixBor = false; } return; }
    yop(true);
  }

  function ochish() {
    if (ekranEl || !ui.malumot) return;
    holat = { bosqich: 'yozish', gap: '', ovozdan: false, xato: '', band: false, mik: { bosqich: 'bosh', soniya: 0 }, chek: { bosqich: 'bosh', ac: null, n: 0 }, kartalar: [], indeks: 0, saqlangan: 0, sessiya: ++sessiyaSanagich };
    ekranEl = ekranYasash();
    document.body.appendChild(ekranEl);
    document.body.style.overflow = 'hidden';
    if (window.visualViewport) { window.visualViewport.addEventListener('resize', oynaniMoslash); window.visualViewport.addEventListener('scroll', oynaniMoslash); }
    document.addEventListener('keydown', tugmaBosildi);
    try { history.pushState({ gap: true }, ''); tarixBor = true; window.addEventListener('popstate', orqagaBosildi); } catch (x) { tarixBor = false; }
    chiz();
    yangila();
    var ta = document.getElementById('gap-matn'); if (ta) ta.focus();
  }
  // Saqlangan yozuv bo'lsa ui.tugadi(n) chaqiriladi (Asosiy yangilanadi, xabar chiqadi). tarixdan: telefon "orqaga"si tarix yozuvini allaqachon olgan
  function yop(tarixdan) {
    if (!ekranEl) return;
    var n = holat ? holat.saqlangan : 0;
    mikBekor();   // yozilayotgan ovoz bekor qilinadi, mikrofon qo'yib yuboriladi
    chekBekor(); menyuYop();   // ketayotgan chek so'rovi to'xtatiladi, rasm tashlanadi
    window.removeEventListener('popstate', orqagaBosildi);
    if (tarixBor) { tarixBor = false; if (!tarixdan && history.state && history.state.gap) { try { history.back(); } catch (x) { /* ahamiyatsiz */ } } }
    if (window.visualViewport) { window.visualViewport.removeEventListener('resize', oynaniMoslash); window.visualViewport.removeEventListener('scroll', oynaniMoslash); }
    document.removeEventListener('keydown', tugmaBosildi);
    if (ekranEl.parentNode) ekranEl.parentNode.removeChild(ekranEl);
    ekranEl = tanaEl = null; holat = null;   // gap matni va kartalar o'chadi
    document.body.style.overflow = '';
    if (n > 0 && ui.tugadi) ui.tugadi(n);
    yangila();
    if (tugmaEl && !tugmaEl.hidden) tugmaEl.focus();
  }

  // ui.js chaqiradi: malumot() — ilovaning joriy ma'lumoti, xabar(matn) — qisqa xabar, saqla(natija) — Promise (mavjud saqlash funksiyalari),
  // tugadi(n) — n ta yozuv saqlangan holda yopilganda (Asosiy yangilanadi va xabar chiqadi)
  function boshlash(o) {
    ui.malumot = o.malumot; ui.xabar = o.xabar; ui.saqla = o.saqla; ui.tugadi = o.tugadi; ui.oxirgiOl = o.oxirgiOl; ui.oxirgiYoz = o.oxirgiYoz; ui.tahrirla = o.tahrirla;
    yangila();
  }

  return {
    boshlash: boshlash, yangila: yangila, sozla: sozla, ochish: ochish, yop: function () { yop(); },
    holat: function () { return holat; }, ochiqmi: function () { return !!ekranEl; }
  };
})();
