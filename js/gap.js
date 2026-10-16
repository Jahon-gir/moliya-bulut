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
    ovozMax: GapSof.OVOZ_MAX_MS          // yozish chegarasi (ms)
  };
  function sozla(o) { Object.keys(o || {}).forEach(function (k) { dep[k] = o[k]; }); }

  var ui = { malumot: null, xabar: null, saqla: null, tugadi: null, oxirgiOl: null, oxirgiYoz: null };
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
    }).catch(function (err) {
      if (!holat || holat.sessiya !== sessiya) return;
      m.bosqich = 'bosh'; mikYangila();
      var kod = (err && err.kod) || ('JS_' + String((err && err.name) || 'XATO').replace(/[^A-Za-z0-9]/g, '').toUpperCase());
      if (kod === 'AI_RUXSAT' && dep.yopiqmi()) { yop(); if (ui.xabar) ui.xabar(dep.yopiqXabari()); Yordamchi.yangila(); return; }
      mikXato(kod, err && err.debug);
    });
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
    ta.addEventListener('input', function () { holat.gap = ta.value; holat.xato = ''; xato.textContent = ''; ta.classList.remove('xatoli'); belgilar(); });
    if (holat.xato) ta.classList.add('xatoli');
    var qator = e('div', undefined, 'gp-matn-qator');
    var mik = tugma('yo-doira gp-mik', 'Ovoz bilan yozish', mikBosildi); mik.id = 'gap-mik';
    qator.appendChild(ta); qator.appendChild(mik);
    var mikHolatEl = e('div', undefined, 'gp-mik-holat'); mikHolatEl.id = 'gap-mik-holat'; mikHolatEl.setAttribute('role', 'status'); mikHolatEl.setAttribute('aria-live', 'polite');
    quti.appendChild(belgi); quti.appendChild(qator); quti.appendChild(mikHolatEl); quti.appendChild(hisob); quti.appendChild(xato);
    b.appendChild(quti);
    belgilar();
    mikYangila();

    var misollar = e('div', undefined, 'chiplar gp-misollar');
    GapSof.MISOLLAR.forEach(function (m) {
      var c = tugma('chip', 'Misol: ' + m, function () {
        if (holat.band) return;
        holat.gap = m; holat.xato = ''; ta.value = m; xato.textContent = ''; ta.classList.remove('xatoli'); belgilar(); ta.focus();
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
      var qosh = { soat: dep.hozir().vaqt, oxirgi: oxirgiOl() };
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
    qosh('izoh', matnMaydoni('gk-izoh', 'Izoh', k.izoh, function (v) { k.izoh = v; }, function (i) { i.maxLength = GapSof.IZOH_MAX; }));

    var umumiy = e('div', k.xatolar.umumiy || '', 'xato-matn'); umumiy.setAttribute('role', 'alert'); forma.appendChild(umumiy);
    var saqla = e('button', 'Saqlash', 'asosiy-tugma'); saqla.type = 'submit'; saqla.id = 'gap-saqlash';
    saqla.setAttribute('aria-disabled', k.saqlanmoqda ? 'true' : 'false');
    forma.appendChild(saqla);
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
    Promise.resolve().then(function () { return ui.saqla(r); }).then(function () {
      if (!holat || holat.sessiya !== sessiya) return;
      h.saqlangan++;
      try { if (ui.oxirgiYoz) ui.oxirgiYoz(GapSof.oxirgiYangila(oxirgiOl(), k)); } catch (x) { /* eslab qolish ixtiyoriy */ }
      keyingi();
    }, function (err) {
      if (!holat || holat.sessiya !== sessiya) return;
      k.saqlanmoqda = false; k.xatolar = { umumiy: 'Saqlab bo\'lmadi: ' + (err && err.message ? err.message : err) };
      chiz();
    });
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
  function tugmaBosildi(h) { if (h.key === 'Escape' && ekranEl) chiqish(); }
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
    holat = { bosqich: 'yozish', gap: '', xato: '', band: false, mik: { bosqich: 'bosh', soniya: 0 }, kartalar: [], indeks: 0, saqlangan: 0, sessiya: ++sessiyaSanagich };
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
    ui.malumot = o.malumot; ui.xabar = o.xabar; ui.saqla = o.saqla; ui.tugadi = o.tugadi; ui.oxirgiOl = o.oxirgiOl; ui.oxirgiYoz = o.oxirgiYoz;
    yangila();
  }

  return {
    boshlash: boshlash, yangila: yangila, sozla: sozla, ochish: ochish, yop: function () { yop(); },
    holat: function () { return holat; }, ochiqmi: function () { return !!ekranEl; }
  };
})();
