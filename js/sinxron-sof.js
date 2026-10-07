// Sinxronlashning SOF (DOM'siz, bazasiz) qismi (TZ-sinxronlash.md, S5): mahalliy qator <-> serverdagi qator o'zgartirishlari,
// tortilgan qatorni mahalliy bazaga qo'llash qoidasi va birinchi sinxrondagi "Birlashtirish". Hamma funksiya kiritilgan obyektlarga TEGMAYDI
// (yangi obyekt qaytaradi), shuning uchun tests.html da to'liq sinaladi. Bu yerda tarmoq va IndexedDB yo'q.
var SinxronSof = (function () {
  'use strict';

  var JADVALLAR = ['hisoblar', 'kategoriyalar', 'yozuvlar', 'byudjetlar', 'qarzlar', 'qarz_tolovlari', 'sozlamalar'];   // yuborish tartibi (bog'liqlik uchun)

  function ayrim(x) { return x === undefined || x === null || x === '' ? null : x; }
  function iso(x) { var d = new Date(x); return typeof x === 'string' && !isNaN(d.getTime()) ? d.toISOString() : x; }   // serverdan "+00:00" bilan keladi: mahalliy ko'rinish (Z, ms) ga keltiriladi
  function hhmm(x) { return typeof x === 'string' ? x.slice(0, 5) : x; }                                                 // serverdan "10:30:00" keladi

  // ---- Mahalliy qator -> serverga yuboriladigan qator (user_id, created_at, updated_at, eski_id, balans YUBORILMAYDI) ----
  function serverQatori(jadval, x) {
    if (jadval === 'hisoblar') return { id: x.id, deleted: x.deleted === true, yaratilgan: x.yaratilgan, nom: x.nom, tur: x.tur, belgi: x.belgi, rang: x.rang, oxirgi4: x.oxirgi4 || '', boshlangich_qoldiq: x.boshlangich_qoldiq === undefined ? 0 : x.boshlangich_qoldiq, arxivlangan: x.arxivlangan === true };
    if (jadval === 'kategoriyalar') return { id: x.id, deleted: x.deleted === true, yaratilgan: x.yaratilgan, nom: x.nom, tur: x.tur, rang: x.rang, belgi: x.belgi, arxivlangan: x.arxivlangan === true };
    if (jadval === 'yozuvlar') return { id: x.id, deleted: x.deleted === true, yaratilgan: x.yaratilgan, tur: x.tur, summa: x.summa, sana: x.sana, vaqt: x.vaqt || '00:00', hisob_id: x.hisob_id, qabul_hisob_id: ayrim(x.qabul_hisob_id), kategoriya_id: ayrim(x.kategoriya_id), izoh: x.izoh || '' };
    if (jadval === 'byudjetlar') return { id: x.id, deleted: x.deleted === true, kategoriya_id: x.kategoriya_id === 'umumiy' ? null : ayrim(x.kategoriya_id), oylik_limit: x.oylik_limit };   // "umumiy" = serverda NULL
    if (jadval === 'qarzlar') return { id: x.id, deleted: x.deleted === true, yaratilgan: x.yaratilgan, yonalish: x.yonalish, shaxs: x.shaxs, summa: x.summa, hisob_id: x.hisob_id, sana: x.sana, vaqt: x.vaqt || '00:00', muddat: ayrim(x.muddat), izoh: x.izoh || '', yopilgan: x.yopilgan === true };
    if (jadval === 'sozlamalar') return { id: x.id, deleted: x.deleted === true, sxema_versiyasi: x.sxema_versiyasi, oxirgi_zaxira_sanasi: ayrim(x.oxirgi_zaxira_sanasi), balans_yashirin: x.balans_yashirin === true, tema: x.tema || 'qurilma' };
    return null;
  }
  function tolovQatori(qarzId, t) { return { id: t.id, deleted: t.deleted === true, qarz_id: qarzId, sana: t.sana, vaqt: t.vaqt || '00:00', summa: t.summa, hisob_id: t.hisob_id }; }

  // ---- Serverdagi qator -> mahalliy qator (faqat sinxron maydonlari; updated_at serverniki) ----
  function mahalliyQator(jadval, r) {
    var u = iso(r.updated_at);
    if (jadval === 'hisoblar') return { id: r.id, deleted: r.deleted === true, yaratilgan: iso(r.yaratilgan), nom: r.nom, tur: r.tur, belgi: r.belgi, rang: r.rang, oxirgi4: r.oxirgi4 || '', boshlangich_qoldiq: Number(r.boshlangich_qoldiq) || 0, arxivlangan: r.arxivlangan === true, updated_at: u };
    if (jadval === 'kategoriyalar') return { id: r.id, deleted: r.deleted === true, yaratilgan: iso(r.yaratilgan), nom: r.nom, tur: r.tur, rang: r.rang, belgi: r.belgi, arxivlangan: r.arxivlangan === true, updated_at: u };
    if (jadval === 'yozuvlar') {
      var y = { id: r.id, deleted: r.deleted === true, yaratilgan: iso(r.yaratilgan), tur: r.tur, summa: Number(r.summa), sana: r.sana, vaqt: hhmm(r.vaqt) || '00:00', hisob_id: r.hisob_id, izoh: r.izoh || '', updated_at: u };
      if (r.tur === 'otkazma') { y.qabul_hisob_id = r.qabul_hisob_id; y.kategoriya_id = null; } else y.kategoriya_id = r.kategoriya_id;
      return y;
    }
    if (jadval === 'byudjetlar') return { id: r.id, deleted: r.deleted === true, kategoriya_id: r.kategoriya_id === null || r.kategoriya_id === undefined ? 'umumiy' : r.kategoriya_id, oylik_limit: Number(r.oylik_limit), updated_at: u };
    if (jadval === 'qarzlar') return { id: r.id, deleted: r.deleted === true, yaratilgan: iso(r.yaratilgan), yonalish: r.yonalish, shaxs: r.shaxs, summa: Number(r.summa), hisob_id: r.hisob_id, sana: r.sana, vaqt: hhmm(r.vaqt) || '00:00', muddat: r.muddat || '', izoh: r.izoh || '', yopilgan: r.yopilgan === true, updated_at: u };
    if (jadval === 'qarz_tolovlari') return { id: r.id, deleted: r.deleted === true, sana: r.sana, vaqt: hhmm(r.vaqt) || '00:00', summa: Number(r.summa), hisob_id: r.hisob_id, updated_at: u };
    if (jadval === 'sozlamalar') return { kalit: 'asosiy', id: r.id, deleted: r.deleted === true, sxema_versiyasi: r.sxema_versiyasi, oxirgi_zaxira_sanasi: r.oxirgi_zaxira_sanasi || null, balans_yashirin: r.balans_yashirin === true, tema: r.tema || 'qurilma', updated_at: u };
    return null;
  }

  function kalitTartib(o) {
    if (Array.isArray(o)) return o.map(kalitTartib);
    if (o && typeof o === 'object') { var r = {}; Object.keys(o).sort().forEach(function (k) { r[k] = kalitTartib(o[k]); }); return r; }
    return o;
  }
  // Ikki qator mazmuni (updated_at siz, formatdan qat'i nazar) bir xilmi. a — mahalliy qator, b — mahalliy shakldagi (mahalliyQator) qator
  function bir(jadval, a, b) {
    if (jadval === 'qarz_tolovlari') return JSON.stringify(kalitTartib(tolovQatori('-', a))) === JSON.stringify(kalitTartib(tolovQatori('-', b)));
    return JSON.stringify(kalitTartib(serverQatori(jadval, a))) === JSON.stringify(kalitTartib(serverQatori(jadval, b)));
  }

  // ---- Tortilgan (serverdan kelgan) qatorni mahalliy bazaga qo'llash qoidasi ----
  // jadval — server jadvali; local — bazadagi mos qator (yoki undefined; byudjetda kategoriya bo'yicha, to'lovda — qarz qatori);
  // srv — serverdan kelgan xom qator; ctx: { kutilmoqda: { kalit: vaqt } — yuborilmagan mahalliy o'zgarishlar (SHU jadval, qarzda: qarz id si),
  //   yaqinda: { id: true } — oxirgi yuborishda o'zimiz yuborgan qatorlar (ularning "aks-sadosi" to'qnashuv emas) }.
  // Natija: { yoz: yozish kerak bo'lgan qator | null, ziddiyat: bool, tomb: [serverda o'chirilishi kerak id lar] }
  // QOIDA: mahalliy o'zgarish yuborilmagan bo'lsa (kutilmoqda), tortilgan qator uning ustiga YOZILMAYDI: mahalliy o'zgarish keyin yuboriladi.
  function tortilganniQollash(jadval, local, srv, ctx) {
    ctx = ctx || {};
    var kut = ctx.kutilmoqda || {}, yaqinda = ctx.yaqinda || {};
    var natija = { yoz: null, ziddiyat: false, tomb: [] };
    var yangi = mahalliyQator(jadval, srv);
    if (jadval === 'qarz_tolovlari') {
      if (!local) return natija;                        // qarz hali yo'q (bo'lmasligi kerak: qarzlar oldin tortiladi)
      var tl = (local.tolovlar || []).slice(), i = -1;
      tl.forEach(function (t, j) { if (t.id === srv.id) i = j; });
      var kutQarz = !!kut[local.id];
      if (i >= 0) {
        var farq = !bir('qarz_tolovlari', tl[i], yangi);
        if (kutQarz) { natija.ziddiyat = farq && !yaqinda[srv.id]; return natija; }
        if (!farq) return natija;
        tl[i] = Object.assign({}, tl[i], yangi);
      } else tl.push(yangi);
      var q = Object.assign({}, local, { tolovlar: tl });
      q.yopilgan = tl.reduce(function (a, t) { return t.deleted === true ? a : a + t.summa; }, 0) >= q.summa;   // yopilgan belgisi to'lovlardan hisoblanadi
      natija.yoz = q;
      return natija;
    }
    if (jadval === 'byudjetlar' && local && local.id !== srv.id) {
      // Bitta kategoriyaga ikkita qator (har qurilma o'zinikini yaratgan). Ikkala qurilma BIR XIL g'olibni tanlaydi: katta id. Yutqazgani serverda o'chiriladi.
      if (srv.deleted === true) return natija;
      if (local.deleted === true) { natija.yoz = yangi; return natija; }
      natija.ziddiyat = true;
      if (srv.id > local.id) { natija.yoz = yangi; natija.tomb.push(local.id); } else natija.tomb.push(srv.id);
      return natija;
    }
    if (local) {
      var key = jadval === 'byudjetlar' ? local.kategoriya_id : local.id;
      var farqli = !bir(jadval, local, yangi);
      if (kut[key]) { natija.ziddiyat = farqli && !yaqinda[srv.id]; return natija; }
      if (!farqli) return natija;                       // mazmun bir xil (aks-sado): bazaga tegilmaydi
    }
    natija.yoz = Object.assign({}, local || {}, yangi);
    if (jadval === 'qarzlar') natija.yoz.tolovlar = (local && local.tolovlar) || [];
    return natija;
  }

  // ---- Serverdagi hamma qatordan mahalliy ma'lumot (hammasiniOqish shaklida) yasash ----
  // S: { hisoblar: [xom qatorlar], ..., qarz_tolovlari, sozlamalar }. mahalliyAsosiy — shu qurilmaning sozlama yozuvi (sxema versiyasi saqlanadi).
  function serverdanMalumot(S, mahalliyAsosiy) {
    var m = { hisoblar: [], kategoriyalar: [], yozuvlar: [], byudjetlar: [], qarzlar: [], sozlamalar: [] };
    ['hisoblar', 'kategoriyalar', 'yozuvlar', 'byudjetlar', 'qarzlar'].forEach(function (j) { m[j] = (S[j] || []).map(function (r) { return mahalliyQator(j, r); }); });
    var qid = {}; m.qarzlar.forEach(function (q) { q.tolovlar = []; qid[q.id] = q; });
    (S.qarz_tolovlari || []).forEach(function (t) { if (qid[t.qarz_id]) qid[t.qarz_id].tolovlar.push(mahalliyQator('qarz_tolovlari', t)); });
    m.qarzlar.forEach(function (q) { q.tolovlar.sort(function (a, b) { return a.sana + ' ' + a.vaqt + a.id < b.sana + ' ' + b.vaqt + b.id ? -1 : 1; }); });
    var a = (S.sozlamalar || [])[0];
    if (a) {
      var s = mahalliyQator('sozlamalar', a);
      if (mahalliyAsosiy) { s.sxema_versiyasi = mahalliyAsosiy.sxema_versiyasi; s.oxirgi_zaxira_sanasi = mahalliyAsosiy.oxirgi_zaxira_sanasi || null; }   // tuzilma versiyasi va zaxira sanasi qurilmaniki
      m.sozlamalar = [s];
    } else if (mahalliyAsosiy) m.sozlamalar = [mahalliyAsosiy];
    return m;
  }

  // ---- "Mahalliy ma'lumot bo'shmi": foydalanuvchi hech narsa kiritmagan (faqat tayyor "Naqd pul" va kategoriyalar) ----
  function mahalliyBoshmi(m) {
    var jonli = function (r) { return (r || []).filter(function (x) { return x.deleted !== true; }); };
    if (jonli(m.yozuvlar).length || jonli(m.qarzlar).length || jonli(m.byudjetlar).length) return false;
    var h = jonli(m.hisoblar);
    if (h.length > 1 || h.some(function (x) { return x.nom !== 'Naqd pul' || x.boshlangich_qoldiq !== 0 || x.arxivlangan === true; })) return false;
    var tayyor = {};
    Data.tayyorKategoriyalar().forEach(function (k) { tayyor[k.tur + '|' + Calc.nomKaliti(k.nom)] = true; });
    return jonli(m.kategoriyalar).every(function (k) { return tayyor[k.tur + '|' + Calc.nomKaliti(k.nom)] === true && k.arxivlangan !== true; });
  }

  // ---- BIRLASHTIRISH (birinchi sinxron: ikkala tomonda ham ma'lumot bor) ----
  // L — mahalliy to'liq ma'lumot (o'chirilganlar bilan), S — serverdan (serverdanMalumot). Natija: { malumot, navbat, hisobot }.
  // - Hamma qator saqlanadi (hech narsa o'chmaydi). Bir xil ID: serverdagisi.
  // - Hisob/kategoriya: ikkala tomonda bir xil NOM (harf kattaligi, bo'shliq va apostrofga e'tiborsiz) bo'lsa va mazmun bir xil bo'lsa (tur, boshlang'ich
  //   qoldiq) — bitta bo'ladi (serverdagisi), mahalliy yozuvlar unga ulanadi. Mahalliy hisobning boshlang'ich qoldig'i 0 bo'lsa (tayyor "Naqd pul" kabi)
  //   u har doim serverdagi bir xil nomli hisobga qo'shiladi (jami balans o'zgarmaydi). Nomi bir xil, lekin ikkala tomonda boshqa noldan farqli qoldiq bo'lsa —
  //   ikkalasi qoladi, mahalliysi nomiga " (shu qurilma)" qo'shiladi (balans o'zgarmasligi uchun).
  // - Byudjet: bir kategoriyaga ikkala tomonda chegara bo'lsa — serverdagisi qoladi (soni hisobotda).
  // - Sozlamalar: qurilmaning o'z qiymatlari saqlanadi, serverdagi qatorning id si olinadi.
  // navbat: serverga yuborilishi kerak qatorlar { jadval: { kalit: updated_at } }.
  function birlashtirish(L, S, hozirISO) {
    hozirISO = hozirISO || new Date().toISOString();
    var hisobot = { qoshilgan: { hisoblar: 0, kategoriyalar: 0 }, qayta_nomlangan: 0, byudjet_tashlangan: 0, faqat_mahalliy: {}, faqat_server: {} };
    var navbat = { hisoblar: {}, kategoriyalar: {}, yozuvlar: {}, byudjetlar: {}, qarzlar: {}, sozlamalar: {} };
    var M = { hisoblar: [], kategoriyalar: [], yozuvlar: [], byudjetlar: [], qarzlar: [], sozlamalar: [] };
    var xarita = { hisoblar: {}, kategoriyalar: {} };

    function sIdlar(j) { var o = {}; (S[j] || []).forEach(function (x) { o[x.id] = x; }); return o; }
    function dedup(j, nomKalitFn, tenglikFn) {
      var sid = sIdlar(j), sNom = {}, ishlatilgan = {};
      (S[j] || []).forEach(function (x) { M[j].push(x); if (x.deleted !== true) { ishlatilgan[nomKalitFn(x)] = true; sNom[nomKalitFn(x)] = x; } });
      (L[j] || []).forEach(function (l) {
        if (sid[l.id]) return;                         // bir xil ID: serverdagisi qoldi
        var kalit = nomKalitFn(l), s = l.deleted === true ? null : sNom[kalit];
        if (s && tenglikFn(l, s)) { xarita[j][l.id] = s.id; hisobot.qoshilgan[j]++; return; }   // bir xil hisob/kategoriya: bitta bo'ladi
        var y = l;
        if (s && l.deleted !== true) {                 // nomi bir xil, mazmuni boshqa: ikkalasi qoladi
          var nom = l.nom + ' (shu qurilma)', n = 2;
          while (ishlatilgan[nomKalitFn({ nom: nom, tur: l.tur })]) nom = l.nom + ' (shu qurilma ' + (n++) + ')';
          y = Object.assign({}, l, { nom: nom, updated_at: hozirISO }); hisobot.qayta_nomlangan++;
        }
        ishlatilgan[nomKalitFn(y)] = true;
        M[j].push(y); navbat[j][y.id] = y.updated_at;
        hisobot.faqat_mahalliy[j] = (hisobot.faqat_mahalliy[j] || 0) + 1;
      });
    }
    dedup('hisoblar', function (x) { return Calc.nomKaliti(x.nom); }, function (l, s) { return l.tur === s.tur && (l.boshlangich_qoldiq === s.boshlangich_qoldiq || l.boshlangich_qoldiq === 0) && (l.arxivlangan === true) === (s.arxivlangan === true); });
    dedup('kategoriyalar', function (x) { return x.tur + '|' + Calc.nomKaliti(x.nom); }, function (l, s) { return (l.arxivlangan === true) === (s.arxivlangan === true); });

    function havola(j, v) { return v && xarita[j][v] ? xarita[j][v] : v; }
    // Yozuvlar: serverdagilar o'zgarishsiz; mahalliylar (havolalari yangilangan holda) qo'shiladi
    var yid = sIdlar('yozuvlar');
    (S.yozuvlar || []).forEach(function (x) { M.yozuvlar.push(x); });
    (L.yozuvlar || []).forEach(function (l) {
      if (yid[l.id]) return;
      var y = Object.assign({}, l), ozgardi = false;
      ['hisob_id', 'qabul_hisob_id'].forEach(function (k) { if (y[k] && xarita.hisoblar[y[k]]) { y[k] = xarita.hisoblar[y[k]]; ozgardi = true; } });
      if (y.kategoriya_id && xarita.kategoriyalar[y.kategoriya_id]) { y.kategoriya_id = xarita.kategoriyalar[y.kategoriya_id]; ozgardi = true; }
      if (ozgardi) y.updated_at = hozirISO;
      M.yozuvlar.push(y); navbat.yozuvlar[y.id] = y.updated_at;
      hisobot.faqat_mahalliy.yozuvlar = (hisobot.faqat_mahalliy.yozuvlar || 0) + 1;
    });
    // Qarzlar (to'lovlari ichida)
    var qid = sIdlar('qarzlar');
    (S.qarzlar || []).forEach(function (x) { M.qarzlar.push(x); });
    (L.qarzlar || []).forEach(function (l) {
      var s = qid[l.id];
      if (s) {                                          // bir xil ID (kam uchraydi): to'lovlar birlashadi, qarz serverdagisi
        var tid = {}; (s.tolovlar || []).forEach(function (t) { tid[t.id] = true; });
        var ort = (l.tolovlar || []).filter(function (t) { return !tid[t.id]; });
        if (ort.length) { var idx = M.qarzlar.indexOf(s); M.qarzlar[idx] = Object.assign({}, s, { tolovlar: (s.tolovlar || []).concat(ort.map(function (t) { return Object.assign({}, t, { hisob_id: havola('hisoblar', t.hisob_id) }); })), updated_at: hozirISO }); navbat.qarzlar[s.id] = hozirISO; }
        return;
      }
      var q = Object.assign({}, l, { hisob_id: havola('hisoblar', l.hisob_id), updated_at: l.updated_at });
      q.tolovlar = (l.tolovlar || []).map(function (t) { return Object.assign({}, t, { hisob_id: havola('hisoblar', t.hisob_id) }); });
      if (q.hisob_id !== l.hisob_id || q.tolovlar.some(function (t, i) { return t.hisob_id !== l.tolovlar[i].hisob_id; })) q.updated_at = hozirISO;
      M.qarzlar.push(q); navbat.qarzlar[q.id] = q.updated_at;
      hisobot.faqat_mahalliy.qarzlar = (hisobot.faqat_mahalliy.qarzlar || 0) + 1;
    });
    // Byudjetlar: kalit — kategoriya (yoki "umumiy"); serverdagisi ustun
    var sKat = {};
    (S.byudjetlar || []).forEach(function (b) { M.byudjetlar.push(b); sKat[b.kategoriya_id] = true; });
    (L.byudjetlar || []).forEach(function (l) {
      var kat = havola('kategoriyalar', l.kategoriya_id);
      if (sKat[kat]) { if (l.deleted !== true) hisobot.byudjet_tashlangan++; return; }
      var b = Object.assign({}, l);
      if (kat !== l.kategoriya_id) { b.kategoriya_id = kat; b.updated_at = hozirISO; }
      M.byudjetlar.push(b); navbat.byudjetlar[b.kategoriya_id] = b.updated_at;
      hisobot.faqat_mahalliy.byudjetlar = (hisobot.faqat_mahalliy.byudjetlar || 0) + 1;
    });
    // Sozlamalar
    var la = (L.sozlamalar || []).filter(function (x) { return x && x.kalit === 'asosiy'; })[0], sa = (S.sozlamalar || [])[0];
    if (la) {
      var a = Object.assign({}, la);
      if (sa && sa.id !== la.id) { a.id = sa.id; a.updated_at = hozirISO; }
      M.sozlamalar = [a]; navbat.sozlamalar.asosiy = a.updated_at;
    } else if (sa) M.sozlamalar = [sa];
    ['hisoblar', 'kategoriyalar', 'yozuvlar', 'qarzlar', 'byudjetlar'].forEach(function (j) { var n = (S[j] || []).length; if (n) hisobot.faqat_server[j] = n; });
    return { malumot: M, navbat: navbat, hisobot: hisobot };
  }

  function navbatSoni(n) {
    var s = 0;
    if (n) {
      Object.keys(n.qatorlar || {}).forEach(function (j) { s += Object.keys(n.qatorlar[j]).length; });
      Object.keys(n.ochirish || {}).forEach(function (j) { s += (n.ochirish[j] || []).length; });
    }
    return s;
  }

  // Holat matni (Profil va Asosiy ekran). h: { tur, soni, oxirgi (ISO), xato }; hozir — Date
  function oldin(vaqtISO, hozir) {
    var s = Math.max(0, Math.floor(((hozir || new Date()).getTime() - new Date(vaqtISO).getTime()) / 1000));
    if (s < 45) return 'hozirgina';
    var d = Math.round(s / 60);
    if (d < 60) return d + ' daqiqa oldin';
    var soat = Math.floor(d / 60);
    if (soat < 24) return soat + ' soat oldin';
    return Math.floor(soat / 24) + ' kun oldin';
  }
  function holatMatni(h, hozir) {
    if (!h) return '';
    switch (h.tur) {
      case 'ishlayapti': return 'Sinxronlanmoqda…';
      case 'tayyor': return 'Sinxronlangan' + (h.oxirgi ? ' (' + oldin(h.oxirgi, hozir) + ')' : '');
      case 'kutilmoqda': return 'Kutilmoqda (' + h.soni + ' ta o\'zgarish)';
      case 'internet-yoq': return 'Internet yo\'q' + (h.soni ? ' (' + h.soni + ' ta o\'zgarish kutmoqda)' : '');
      case 'xato': return 'Xato' + (h.soni ? ' (' + h.soni + ' ta o\'zgarish kutmoqda)' : '');
      case 'boshlanmagan': return 'Sinxronlash yoqilmagan';
      case 'boshlanmoqda': return 'Sinxronlash boshlanmoqda…';
      case 'tanlov': return 'Birinchi sinxronlash: tanlash kerak';
      case 'boshqa-akkaunt': return 'Boshqa akkaunt: sinxronlash to\'xtatilgan';
      default: return '';
    }
  }

  return {
    JADVALLAR: JADVALLAR, serverQatori: serverQatori, tolovQatori: tolovQatori, mahalliyQator: mahalliyQator, bir: bir,
    tortilganniQollash: tortilganniQollash, serverdanMalumot: serverdanMalumot, mahalliyBoshmi: mahalliyBoshmi, birlashtirish: birlashtirish,
    navbatSoni: navbatSoni, holatMatni: holatMatni, oldin: oldin, iso: iso
  };
})();
