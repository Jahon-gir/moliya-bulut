// ImportSof — Excel (.xlsx) dan yuklashning sof qoidalari (TZ-sinxronlash.md, 18.2). DOM ham, ma'lumotlar bazasi ham yo'q:
// ustunlarni taxmin qilish, summa va sanani o'qish, tur aniqlash, takrorlarni topish, yozuvlarni tayyorlash. tests.html da to'liq sinaladi.
var ImportSof = (function () {
  'use strict';

  var MAYDONLAR = ['sana', 'id', 'tur', 'hisob', 'qayerga', 'kategoriya', 'summa', 'valyuta', 'izoh', 'qarzNomi', 'qarzTuri', 'qarzSumma', 'muddat'];
  var MAYDON_NOMLARI = { sana: 'Sana va vaqt', id: 'ID', tur: 'Tur', hisob: 'Hisob', qayerga: 'Qayerga (o\'tkazma)', kategoriya: 'Kategoriya', summa: 'Summa', valyuta: 'Valyuta', izoh: 'Izoh', qarzNomi: 'Qarz nomi', qarzTuri: 'Qarz turi', qarzSumma: 'Qarz summasi (zaxira)', muddat: 'Qaytarish muddati' };
  // Sarlavha nomlari (kichik harf, faqat harf va raqam; ustuvorlik tartibida). Birinchisi eng ishonchli.
  var SARLAVHALAR = {
    sana: ['sanavavaqt', 'datetime', 'date', 'sana', 'sanasi', 'data', 'vaqt', 'time'],
    id: ['transactionid', 'id', 'operationid', 'operatsiyaid'],
    tur: ['transactiontype', 'tur', 'turi', 'type', 'operatsiyaturi'],
    hisob: ['accountfrom', 'hisob', 'account', 'hisobdan', 'qayerdan'],
    qayerga: ['transferedto', 'transferredto', 'transferto', 'qayerga', 'hisobga'],
    kategoriya: ['category', 'kategoriya', 'toifa'],
    summa: ['enteredamount', 'summa', 'amount', 'miqdor', 'accountchargedamount'],
    valyuta: ['transactioncurrency', 'valyuta', 'currency', 'pulbirligi'],
    izoh: ['comment', 'izoh', 'comments', 'note', 'notes', 'tavsif', 'description'],
    qarzNomi: ['loanname', 'qarznomi'],
    qarzTuri: ['loantype', 'qarzturi'],
    qarzSumma: ['loanchargedamount', 'qarzsummasi'],
    muddat: ['qaytarishmuddati', 'muddat', 'duedate', 'repaymentdate']
  };

  var RANG_USTUNLARI = ['enteredamount', 'amount', 'accountchargedamount', 'summa', 'miqdor', 'sumasi'];
  function sarlavhaKaliti(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9Ѐ-ӿ]/g, ''); }
  // Fayldan o'qilgan matndan boshqaruv belgilari (NUL va boshqalar; "\n" va "\t" qoladi) va yarim surrogatlar olib tashlanadi: server matn maydoni ularni rad etadi
  function toza(m) {
    return String(m).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/[\ud800-\udbff](?![\udc00-\udfff])|(^|[^\ud800-\udbff])[\udc00-\udfff]/g, '$1');
  }
  function hujayraMatni(c) {
    if (!c) return '';
    if (c.t === 's') return toza(c.v);
    if (c.t === 'n') return String(c.v);
    return c.v === undefined || c.v === null ? '' : String(c.v);
  }
  function bosh(q) { return !q || !q.some(function (c) { return c && hujayraMatni(c).trim() !== ''; }); }

  // Sarlavha qatorini topadi (dastlabki 15 qator ichida eng ko'p taniladigan nomli qator) va ustunlarni taxmin qiladi.
  // Natija: { sarlavhaQator, nomlar: [matn], xarita: { maydon: ustun indeksi yoki -1 }, taniladi: nechta ustun taniladi }
  function ustunlarniTaxmin(qatorlar) {
    var eng = -1, engBall = 0, i, j;
    for (i = 0; i < Math.min(qatorlar.length, 15); i++) {
      var q = qatorlar[i];
      if (bosh(q)) continue;
      var ball = 0;
      for (j = 0; j < q.length; j++) {
        var k = sarlavhaKaliti(hujayraMatni(q[j]));
        if (k && MAYDONLAR.some(function (m) { return SARLAVHALAR[m].indexOf(k) !== -1; })) ball++;
      }
      if (ball > engBall) { engBall = ball; eng = i; }
    }
    if (eng < 0) { for (i = 0; i < qatorlar.length; i++) if (!bosh(qatorlar[i])) { eng = i; break; } }
    var nomlar = [], xarita = {}, band = {};
    MAYDONLAR.forEach(function (m) { xarita[m] = -1; });
    if (eng < 0) return { sarlavhaQator: -1, nomlar: nomlar, xarita: xarita, taniladi: 0 };
    var q0 = qatorlar[eng] || [], n = q0.length;
    for (j = 0; j < n; j++) nomlar.push(hujayraMatni(q0[j]).trim());
    MAYDONLAR.forEach(function (m) {
      for (var u = 0; u < SARLAVHALAR[m].length; u++) {
        for (j = 0; j < n; j++) {
          if (!band[j] && sarlavhaKaliti(nomlar[j]) === SARLAVHALAR[m][u]) { xarita[m] = j; band[j] = true; return; }
        }
      }
    });
    // Summa shrifti rangi boshqa "summa"-ustunda bo'lishi mumkin (masalan, EnteredAmount rangsiz, Amount rangli): hamma summa ustunlari eslab qolinadi
    var rangUstunlari = [];
    for (j = 0; j < n; j++) if (RANG_USTUNLARI.indexOf(sarlavhaKaliti(nomlar[j])) !== -1) rangUstunlari.push(j);
    xarita.rangUstunlari = rangUstunlari;
    var t = 0; MAYDONLAR.forEach(function (m) { if (xarita[m] >= 0) t++; });
    return { sarlavhaQator: eng, nomlar: nomlar, xarita: xarita, taniladi: t };
  }

  // ---- Summa ----
  var UZS_NOMLARI = { uzs: 1, sum: 1, som: 1, som_: 1, uz: 1, 'сум': 1, 'сўм': 1, soum: 1, soom: 1 };
  function valyutaKodi(s) {
    var k = String(s == null ? '' : s).trim().toLowerCase().replace(/[ʻʼ‘’`´'.\s]/g, '');
    if (!k) return null;
    return UZS_NOMLARI[k] ? 'UZS' : k.toUpperCase();
  }

  // Natija: { son (musbat butun), belgi: -1 | 1, valyuta: kod yoki null } yoki { xato, kod }
  function summaOqi(c) {
    if (!c || (c.t === 's' && c.v.trim() === '')) return { xato: 'Summa yo\'q', kod: 'R_SUMMA' };
    var belgi = 1, qiymat, valyuta = null, yaxlit = false;
    if (c.t === 'n') {
      qiymat = c.v;
      if (qiymat < 0) { belgi = -1; qiymat = -qiymat; }
      if (Math.abs(qiymat - Math.round(qiymat)) > 1e-9) yaxlit = true;
      qiymat = Math.round(qiymat);
    } else if (c.t === 's') {
      var s = c.v.replace(/[−‒–—]/g, '-').trim();
      if (/^\(.*\)$/.test(s)) { belgi = -1; s = s.slice(1, -1); }
      var tok = s.match(/[A-Za-zЀ-ӿʻʼ'’`$€£₽]+/g);
      if (tok) { valyuta = valyutaKodi(tok.join('')) || null; if (tok.join('').trim() === '$') valyuta = 'USD'; s = s.replace(/[A-Za-zЀ-ӿʻʼ'’`$€£₽]+\.?/g, ''); }
      s = s.replace(/\s/g, '');
      if (s.charAt(0) === '-') { belgi = -belgi; s = s.slice(1); } else if (s.charAt(0) === '+') s = s.slice(1);
      if (s.charAt(s.length - 1) === '-') { belgi = -belgi; s = s.slice(0, -1); }
      if (s === '' || !/^[0-9.,]+$/.test(s)) return { xato: 'Summa o\'qilmadi: "' + c.v + '"', kod: 'R_SUMMA' };
      var nuqta = (s.match(/\./g) || []).length, vergul = (s.match(/,/g) || []).length, ond = '';
      if (nuqta && vergul) {
        var dec = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',', th = dec === '.' ? ',' : '.';
        var qismlar = s.split(dec);
        if (qismlar.length !== 2 || qismlar[1].indexOf(th) !== -1) return { xato: 'Summa o\'qilmadi: "' + c.v + '"', kod: 'R_SUMMA' };
        s = qismlar[0].split(th).join(''); ond = qismlar[1];
      } else if (nuqta || vergul) {
        var ch = nuqta ? '.' : ',', p = s.split(ch);
        if (p.length > 2) {   // bir necha marta: mingliklar
          if (!p.slice(1).every(function (x) { return x.length === 3; }) || p[0].length < 1 || p[0].length > 3) return { xato: 'Summa o\'qilmadi: "' + c.v + '"', kod: 'R_SUMMA' };
          s = p.join('');
        } else if (p[1].length === 3 && p[0].length >= 1 && p[0].length <= 3 && p[0].charAt(0) !== '0') s = p.join('');   // "12,500": minglik
        else { s = p[0]; ond = p[1]; }
      }
      if (s === '') s = '0';
      if (s.replace(/^0+/, '').length > 15) return { xato: 'Summa juda katta', kod: 'R_SUMMA' };
      qiymat = parseInt(s, 10);
      if (/[1-9]/.test(ond)) { yaxlit = true; if (ond.charAt(0) >= '5') qiymat++; }   // kasr (tiyin): eng yaqin butun so'mga yaxlitlanadi, qatorda ogohlantirish chiqadi
    } else return { xato: 'Summa o\'qilmadi', kod: 'R_SUMMA' };
    if (!(qiymat > 0)) return { xato: 'Summa noldan katta bo\'lsin', kod: 'R_SUMMA' };
    return { son: qiymat, belgi: belgi, valyuta: valyuta, yaxlit: yaxlit };
  }

  // ---- Sana va vaqt ----
  function ikki(n) { return (n < 10 ? '0' : '') + n; }
  function haqiqiySana(y, m, d) {
    if (y < 1990 || y > 2200 || m < 1 || m > 12 || d < 1) return false;
    return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
  }
  function vaqtQismi(h, m) { h = +h; m = +m; return h >= 0 && h < 24 && m >= 0 && m < 60 ? ikki(h) + ':' + ikki(m) : null; }

  // Excel seriya raqami -> { sana, vaqt }. Soniya daqiqaga yaxlitlanadi.
  function seriyadanSana(n) {
    if (!(n >= 20000 && n < 80000)) return null;
    var daq = Math.round(n * 1440), kun = Math.floor(daq / 1440), q = daq - kun * 1440;
    var d = new Date((kun - 25569) * 86400000);
    return { sana: d.getUTCFullYear() + '-' + ikki(d.getUTCMonth() + 1) + '-' + ikki(d.getUTCDate()), vaqt: ikki(Math.floor(q / 60)) + ':' + ikki(q % 60) };
  }

  // Natija: { sana, vaqt (bo'lmasa '00:00'), vaqtBor } yoki { xato, kod }
  function sanaOqi(c, sanaUstuni) {
    var xato = { xato: 'Sana o\'qilmadi' + (c && c.t === 's' ? ': "' + c.v + '"' : ''), kod: 'R_SANA' };
    if (!c) return { xato: 'Sana yo\'q', kod: 'R_SANA' };
    if (c.t === 'n') { var r = seriyadanSana(c.v); return r ? { sana: r.sana, vaqt: r.vaqt, vaqtBor: c.v % 1 !== 0 } : xato; }
    if (c.t !== 's') return xato;
    var s = c.v.trim(), m, y, mo, d, v = null;
    if (!s) return { xato: 'Sana yo\'q', kod: 'R_SANA' };
    if ((m = /^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2})(?::\d{2}(?:[.,]\d+)?)?)?\s*(?:Z|[+-]\d{2}:?\d{2})?$/.exec(s))) { y = +m[1]; mo = +m[2]; d = +m[3]; if (m[4] !== undefined) v = vaqtQismi(m[4], m[5]), v = v || 'x'; }
    else if ((m = /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})(?:[T\s,]+(\d{1,2}):(\d{2})(?::\d{2})?)?$/.exec(s))) { d = +m[1]; mo = +m[2]; y = +m[3]; if (m[4] !== undefined) v = vaqtQismi(m[4], m[5]), v = v || 'x'; }   // kun.oy.yil (DD/MM/YYYY): kun birinchi
    else if (/^\d+([.,]\d+)?$/.test(s) && sanaUstuni) { var rr = seriyadanSana(parseFloat(s.replace(',', '.'))); return rr ? { sana: rr.sana, vaqt: rr.vaqt, vaqtBor: true } : xato; }
    else return xato;
    if (v === 'x' || !haqiqiySana(y, mo, d)) return xato;
    return { sana: y + '-' + ikki(mo) + '-' + ikki(d), vaqt: v || '00:00', vaqtBor: v !== null };
  }

  // ---- Tur matni ----
  function turMatni(s) {
    var k = String(s == null ? '' : s).toLowerCase().replace(/[^a-zЀ-ӿ]/g, '');
    if (!k) return null;
    if (k === 'daromad' || k === 'kirim' || k === 'income' || k === 'incoming' || k === 'revenue') return 'daromad';
    if (k === 'xarajat' || k === 'chiqim' || k === 'expense' || k === 'expenses' || k === 'spending' || k === 'outcome') return 'xarajat';
    if (k === 'otkazma' || k === 'transfer' || k === 'otkazmalar') return 'otkazma';
    if (k === 'qarz' || k === 'qarztolovi' || k === 'loan' || k === 'loanpayment' || k === 'debt') return 'qarz';
    return null;   // masalan "Manual": turni aniqlamaydi
  }

  var ESKI_ID = /^[YQT]-\d{6}$/;   // bizning eksportdagi tartib raqami: boshqa bazada boshqa yozuvga to'g'ri kelishi mumkin, shuning uchun takrorni aniqlashda ishlatilmaydi

  // Nomning oxiridagi "<summa> <valyuta>" qismini ajratadi: "TBS salom 400 000,00 UZS" -> { nom: 'TBS salom', summa: 400000, valyuta: 'UZS' }.
  // Faqat summadan keyin valyuta kodi (3 harf yoki so'm) turgan bo'lsa (kartaning oxirgi 4 raqami "Visa 1234" tegilmaydi) va nom bo'sh qolmasa.
  var NOM_SUMMA = /^(.*?\S)[\s\u00a0]+([-+]?\d(?:[\d\s\u00a0.,']*\d)?)[\s\u00a0]*([A-Za-z]{3}|so['\u02bb\u02bc\u2018\u2019`]?m|\u0441\u0443\u043c)$/i;
  function tozaNom(m) {
    var t = String(m == null ? '' : m).replace(/\s+/g, ' ').trim();
    if (/^[-\u2013\u2014]+$/.test(t)) t = '';
    var x = NOM_SUMMA.exec(t);
    if (!x) return { nom: t, summa: null, valyuta: null, tozalandi: false };
    var su = summaOqi({ t: 's', v: x[2] + ' ' + x[3] });
    if (su.xato) return { nom: t, summa: null, valyuta: null, tozalandi: false };
    return { nom: x[1].trim(), summa: su.son, valyuta: valyutaKodi(x[3]) || String(x[3]).toUpperCase(), tozalandi: true };
  }

  // Qarz qatori yordamchilari. "-" (va "—") bo'sh katak hisoblanadi.
  function tozaMatn(m) { var t = String(m == null ? '' : m).trim(); return /^[-–—]+$/.test(t) ? '' : t; }
  function qarzTuriOqi(s) {   // LoanType / Qarz turi -> 'olingan' | 'berilgan' | null
    var k = String(s == null ? '' : s).toLowerCase().replace(/[^a-zЀ-ӿ]/g, '');
    if (k === 'borrowing' || k === 'borrow' || k === 'borrowed' || k === 'olingan' || k === 'oldim' || k === 'received') return 'olingan';
    if (k === 'lending' || k === 'lend' || k === 'lent' || k === 'berilgan' || k === 'berdim' || k === 'given') return 'berilgan';
    return null;
  }
  function qarzRoli(s) {   // "Qarz" — asosiy amal, "Qarz to'lovi" — qaytarish (o'zimizning eksport); "Loan" — rol noma'lum (begona jadval)
    var k = String(s == null ? '' : s).toLowerCase().replace(/[^a-zЀ-ӿ]/g, '');
    return k === 'qarz' ? 'asosiy' : (k === 'qarztolovi' || k === 'loanpayment') ? 'tolov' : null;
  }
  // ---- 1-bosqich: qatorlarni xom o'qish (xarita o'zgarsagina qayta ishlanadi) ----
  // Natija: [{ n (Excel qator raqami), xato/kod yoki: sana, vaqt, summa, belgi, valyuta, rang, tur (matndan), kategoriya, hisob, qayerga, izoh, id, qarz: null | { rol, turi, nom, muddat } }]
  function qatorlarniOqi(qatorlar, sarlavhaQator, xarita) {
    var r = [];
    function mt(q, m) { var u = xarita[m]; return u >= 0 && q[u] ? tozaMatn(hujayraMatni(q[u])) : ''; }
    for (var i = sarlavhaQator + 1; i < qatorlar.length; i++) {
      var q = qatorlar[i];
      if (bosh(q)) continue;
      var x = { n: i + 1 };
      var sa = sanaOqi(xarita.sana >= 0 ? q[xarita.sana] : null, true);
      var su = summaOqi(xarita.summa >= 0 ? q[xarita.summa] : null);
      x.turMatn = turMatni(mt(q, 'tur'));
      x.turNomi = mt(q, 'tur');
      var tk = tozaNom(mt(q, 'kategoriya')), th = tozaNom(mt(q, 'hisob')), tq = tozaNom(mt(q, 'qayerga')), ogohlar = [];
      x.kategoriya = tk.nom; x.hisob = th.nom; x.qayerga = tq.nom;
      x.tozalangan = th.tozalandi || tq.tozalandi || tk.tozalandi;
      x.hisobSumma = th.summa; x.qayergaSumma = tq.summa;
      x.izoh = hujayraMatni(q[xarita.izoh]).replace(/\r\n?/g, '\n').trim();
      if (/^[-–—]+$/.test(x.izoh)) x.izoh = '';
      x.id = mt(q, 'id');
      var tn = tozaNom(mt(q, 'qarzNomi')), qNom = tn.nom, qTuri = mt(q, 'qarzTuri');
      if (tn.tozalandi) x.tozalangan = true;
      // Qarz qatori: TransactionType = Loan / Qarz / Qarz to'lovi, yoki qarz nomi va turi ikkalasi to'ldirilgan
      if (x.turMatn === 'qarz' || (qNom && qTuri)) {
        x.qarz = { rol: qarzRoli(x.turNomi), turi: qarzTuriOqi(qTuri), nom: qNom, muddat: null };
        if (!x.qarz.turi) { x.xato = 'Qarz turi noma\'lum' + (qTuri ? ' ("' + qTuri + '")' : '') + ': Borrowing / Lending (yoki Olingan / Berilgan) bo\'lishi kerak'; x.kod = 'R_QARZ_TURI'; r.push(x); continue; }
        if (xarita.muddat >= 0 && q[xarita.muddat] && tozaMatn(hujayraMatni(q[xarita.muddat]))) { var md = sanaOqi(q[xarita.muddat], true); if (!md.xato) x.qarz.muddat = md.sana; }
        if (su.xato && xarita.qarzSumma >= 0) su = summaOqi(q[xarita.qarzSumma]);   // asosiy summa katagi bo'sh bo'lsa, qarz summasi ustuni
      }
      var vk = valyutaKodi(mt(q, 'valyuta'));
      if (sa.xato) { x.xato = sa.xato; x.kod = sa.kod; r.push(x); continue; }
      if (su.xato) { x.xato = su.xato; x.kod = su.kod; r.push(x); continue; }
      x.sana = sa.sana; x.vaqt = sa.vaqt;
      x.summa = su.son; x.belgi = su.belgi; x.yaxlit = su.yaxlit;
      // shrift rangi: avval tanlangan summa katagi, rangsiz bo'lsa — shu qatordagi boshqa summa ustunlari (Amount, AccountChargedAmount...)
      x.rang = xarita.summa >= 0 && q[xarita.summa] ? q[xarita.summa].rang || null : null;
      if (!x.rang) (xarita.rangUstunlari || []).some(function (u) { if (q[u] && q[u].rang) { x.rang = q[u].rang; return true; } return false; });
      var val = vk || su.valyuta;
      if (vk && su.valyuta && vk !== su.valyuta) val = vk === 'UZS' ? su.valyuta : vk;
      if (val && val !== 'UZS') { x.xato = 'Valyuta ' + val + ': faqat so\'m (UZS) yuklanadi'; x.kod = 'R_VALYUTA'; x.otkaz = true; r.push(x); continue; }
      // nom ichidan ajratilgan summa qator summasiga mos kelishi kerak (o'tkazmada: "TransferedTo" ichidagi summa)
      if (x.turMatn === 'otkazma') {
        if (x.qayergaSumma !== null && x.qayergaSumma !== x.summa) ogohlar.push('Qabul hisobi nomidagi summa (' + x.qayergaSumma + ') o\'tkazma summasiga (' + x.summa + ') mos kelmadi');
        if (x.hisobSumma !== null && x.hisobSumma !== x.summa) ogohlar.push('Hisob nomidagi summa (' + x.hisobSumma + ') o\'tkazma summasiga (' + x.summa + ') mos kelmadi');
      }
      if (ogohlar.length) x.ogoh = ogohlar.join('; ');
      r.push(x);
    }
    return r;
  }

  // ---- 2-bosqich: tur, kategoriya va hisoblarni moslash, takrorlar ----
  var KAT_BOSH = '', HISOB_BOSH = '';
  function kalit(nom) { return Calc.nomKaliti(nom); }
  function katKaliti(tur, nom) { return tur + '|' + kalit(nom); }

  // Mavjud yozuvlardan takror aniqlash kalitlari: { kalit: soni }
  function yozuvKaliti(tur, sana, summa, katNomi, hisobNomi, qabulNomi, izoh) {
    return [tur, sana, summa, tur === 'otkazma' ? kalit(hisobNomi) + '>' + kalit(qabulNomi) : kalit(katNomi), String(izoh || '').trim()].join('|');
  }
  function mavjudKalitlar(yozuvlar, hisoblar, kategoriyalar) {
    var hn = {}, kn = {}, r = {};
    (hisoblar || []).forEach(function (h) { hn[h.id] = h.nom; });
    (kategoriyalar || []).forEach(function (k) { kn[k.id] = k.nom; });
    (yozuvlar || []).forEach(function (y) {
      var k = yozuvKaliti(y.tur, y.sana, y.summa, kn[y.kategoriya_id] || '', hn[y.hisob_id] || '', hn[y.qabul_hisob_id] || '', y.izoh);
      r[k] = (r[k] || 0) + 1;
    });
    return r;
  }

  // Mavjud qarzlardan takror aniqlash kalitlari: har amal "pul hisobga kirdi (in) / chiqdi (out)" ko'rinishida.
  // Asosiy summa: olingan — in, berilgan — out; qaytarish teskari: olingan qarz qaytarilsa — out, berilgan qarz qaytarilsa — in.
  function qarzKaliti(eff, nom, sana, summa, hisobNomi) { return [eff, String(nom || '').replace(/\s+/g, ' ').trim(), sana, summa, kalit(hisobNomi)].join('|'); }
  function qarzKalitlari(qarzlar, hisoblar) {
    var hn = {}, r = {};
    (hisoblar || []).forEach(function (h) { hn[h.id] = h.nom; });
    function qosh(k) { r[k] = (r[k] || 0) + 1; }
    (qarzlar || []).forEach(function (z) {
      var berdim = z.yonalish === 'berdim';
      qosh(qarzKaliti(berdim ? 'out' : 'in', z.shaxs, z.sana, z.summa, hn[z.hisob_id] || ''));
      (z.tolovlar || []).forEach(function (t) { if (t.deleted !== true) qosh(qarzKaliti(berdim ? 'in' : 'out', z.shaxs, t.sana, t.summa, hn[t.hisob_id] || '')); });
    });
    return r;
  }

  // xom: qatorlarniOqi natijasi. tanlov: { turTanlovi: { kategoriyaKaliti: 'xarajat' | 'daromad' }, kategoriya: { 'tur|kalit': { id } | { yangi: true } }, hisob: { kalit: { id } | { yangi: true } }, takror: 'otkaz' | 'yuklash', qarzTeskari: bool (Borrowing = qarz BERILDI) }
  // mavjud: { hisoblar (faol), kategoriyalar (faol), yozuvKalitlari, qarzKalitlari, tarixIdlar: { id: true } }, h: Calc.hozir()
  // Natija: { qatorlar: [{ n, holat: 'yuklanadi' | 'xato' | 'otkazildi' | 'takror', sabab, kod, tur, usul, yozuv }], jami, usullar, kategoriyalar, hisoblar, turGuruhlari }
  function reja(xom, tanlov, mavjud, h) {
    tanlov = tanlov || {};
    var turTanlovi = tanlov.turTanlovi || {}, katTanlov = tanlov.kategoriya || {}, hisobTanlov = tanlov.hisob || {};
    var kalitlar = {}, kopIdlar = {}, tarixId = mavjud.tarixIdlar || {}, qKalitlar = {}, qarzOps = [];
    Object.keys(mavjud.yozuvKalitlari || {}).forEach(function (k) { kalitlar[k] = mavjud.yozuvKalitlari[k]; });
    Object.keys(mavjud.qarzKalitlari || {}).forEach(function (k) { qKalitlar[k] = mavjud.qarzKalitlari[k]; });
    var katGuruh = {}, hisobGuruh = {}, turGuruh = {}, katTartib = [], hisobTartib = [], turTartib = [];
    var jami = { yuklanadi: 0, xato: 0, otkazildi: 0, takror: 0, yaxlit: 0, ogoh: 0, tozalangan: 0, qarz: 0, qarzAmal: 0, jami: xom.length }, usullar = { tur: 0, belgi: 0, rang: 0, tanlov: 0, otkazma: 0 };
    var natija = [];
    var faolHisob = mavjud.hisoblar || [], faolKat = mavjud.kategoriyalar || [];

    function hisobGuruhi(nom) {
      var k = kalit(nom), g = hisobGuruh[k];
      if (!g) {
        var mv = faolHisob.filter(function (x) { return kalit(x.nom) === k; })[0], t = hisobTanlov[k], id = null, yangi = false;
        if (t && t.id && faolHisob.some(function (x) { return x.id === t.id; })) id = t.id;
        else if (t && t.yangi && nom) yangi = true;
        else if (mv) id = mv.id;
        else if (!nom) id = null;   // hisobsiz qator: hech qachon yangi hisob yaratilmaydi va o'zboshimchalik bilan hisobga qo'yilmaydi; foydalanuvchi tanlamasa yuklanmaydi
        else yangi = true;
        g = hisobGuruh[k] = { kalit: k, nom: nom, soni: 0, id: id, yangi: yangi, avto: !!mv };
        hisobTartib.push(g);
      }
      g.soni++;
      return g;
    }
    function katGuruhi(tur, nom) {
      var k = katKaliti(tur, nom), g = katGuruh[k];
      if (!g) {
        var bosh = !nom, mv = faolKat.filter(function (x) { return x.tur === tur && kalit(x.nom) === kalit(bosh ? 'Boshqa' : nom); })[0], t = katTanlov[k], id = null, yangi = false;
        if (t && t.id && faolKat.some(function (x) { return x.id === t.id && x.tur === tur; })) id = t.id;
        else if (t && t.yangi) yangi = true;
        else if (mv) id = mv.id;
        else yangi = true;
        g = katGuruh[k] = { kalit: k, tur: tur, nom: nom, korsatma: bosh ? '(kategoriyasiz)' : nom, yangiNom: bosh ? 'Boshqa' : nom, soni: 0, id: id, yangi: yangi, avto: !!mv };
        katTartib.push(g);
      }
      g.soni++;
      return g;
    }
    function nomi(g) { return g.id ? ((g.tur ? faolKat : faolHisob).filter(function (x) { return x.id === g.id; })[0] || {}).nom || '' : (g.yangiNom !== undefined ? g.yangiNom : g.nom); }


    // ---- Qarz qatori: amal sifatida yig'iladi, tsikldan keyin nom bo'yicha qarzlarga birlashtiriladi ----
    function qarzQatori(x, s) {
      var q = x.qarz, rol = q.rol, eff, yon = null;
      if (rol === 'asosiy') { eff = q.turi === 'berilgan' ? 'out' : 'in'; yon = q.turi === 'berilgan' ? 'berdim' : 'oldim'; }
      else if (rol === 'tolov') { eff = q.turi === 'berilgan' ? 'in' : 'out'; yon = q.turi === 'berilgan' ? 'berdim' : 'oldim'; }
      else { eff = q.turi === 'olingan' ? 'in' : 'out'; if (tanlov.qarzTeskari) eff = eff === 'in' ? 'out' : 'in'; }   // Borrowing — pul kirdi, Lending — pul chiqdi (almashtirgich teskari qiladi)
      var hg = hisobGuruhi(x.hisob), op = { n: x.n, s: s, id: x.id, nom: String(q.nom || '').replace(/\s+/g, ' ').trim() || 'Nomsiz qarz', sana: x.sana, vaqt: x.vaqt, summa: x.summa, izoh: x.izoh, muddat: q.muddat, rol: rol, yon: yon, eff: eff, hisobG: hg.kalit };
      s.qarz = true; s.eff = eff; s.id = x.id; s.qarzInfo = { nom: op.nom, sana: x.sana, vaqt: x.vaqt, summa: x.summa, eff: eff, hisobG: hg.kalit, turi: q.turi };
      function rad(sabab, kod) { s.holat = 'xato'; s.sabab = sabab; s.kod = kod; jami.xato++; natija.push(s); }
      if (hg.id === null && !hg.yangi) { rad(x.hisob ? 'Hisob yo\'q (avval hisob qo\'shing)' : 'Hisob ko\'rsatilmagan ("-" yoki bo\'sh): ko\'rinishda hisobni tanlang', 'R_HISOB'); return; }
      if (Calc.kelajakmi(x.sana, x.vaqt, h)) { rad('Vaqti hozirdan keyin (' + x.sana.split('-').reverse().join('.') + ' ' + x.vaqt + '): kelajakka qarz amali bo\'lmaydi', 'R_KELAJAK'); return; }
      var sabab = null;
      if (x.id && !ESKI_ID.test(x.id)) {
        if (tarixId[x.id] || kopIdlar[x.id]) sabab = 'ID bo\'yicha takror (' + x.id + ')';
        kopIdlar[x.id] = true;
      }
      var fk = qarzKaliti(eff, op.nom, x.sana, x.summa, nomi(hg));
      if (!sabab && qKalitlar[fk] > 0) { sabab = 'Yo\'nalish, sana, summa, hisob va nom bo\'yicha takror (mavjud qarz amali)'; qKalitlar[fk]--; }
      if (x.yaxlit) { s.ogoh = 'Summa kasrli edi, so\'mga yaxlitlandi'; jami.yaxlit++; }
      if (x.ogoh) { s.ogoh = (s.ogoh ? s.ogoh + '; ' : '') + x.ogoh; jami.ogoh++; }
      if (sabab) { s.takror = true; s.sabab = sabab; }
      if (sabab && tanlov.takror !== 'yuklash') { s.holat = 'takror'; s.kod = 'R_TAKROR'; jami.takror++; natija.push(s); return; }
      s.holat = 'yuklanadi';
      natija.push(s);
      qarzOps.push(op);
    }
    var qarzNatija = { qarzlar: [], nomlar: [], tasir: {} };
    // Qarzlar FAQAT LoanName ning aynan o'zi bo'yicha bog'lanadi (o'xshash nomlar birlashtirilmaydi, harf kattaligi ham farq qiladi; faqat ortiqcha bo'shliqlar bir bo'shliqqa keltiriladi).
    // Har amal o'z sanasi, summasi, hisobi va izohi bilan ko'chadi:
    //  - begona jadval (Borrowing / Lending): amallar sana bo'yicha ketma-ket ko'riladi. Ochiq qarz bor va amal teskari yo'nalishda bo'lsa — u qarzning qaytarishi (to'lov);
    //    aks holda amal o'zi alohida qarz yozuvi (asosiy summa) bo'ladi. Yo'nalishlarni o'zimiz juftlamaymiz: faqat shu nomning o'z amallari bir-biriga bog'lanadi;
    //  - o'zimizning eksport ("Qarz" / "Qarz to'lovi"): "Qarz" qatori — qarz, "Qarz to'lovi" — shu nom va yo'nalishdagi qarzning qaytarishi.
    function qarzlarniRejala() {
      var nomlar = {}, nomTartib = [];
      qarzOps.forEach(function (op) {
        var g = nomlar[op.nom];
        if (!g) { g = nomlar[op.nom] = { nom: op.nom, soni: 0, ops: [], kirdi: 0, chiqdi: 0, qarz: 0 }; nomTartib.push(g); }
        g.soni++; g.ops.push(op);
        if (op.eff === 'in') g.kirdi += op.summa; else g.chiqdi += op.summa;
      });
      function sort(a, b) { var x = a.sana + ' ' + a.vaqt, y = b.sana + ' ' + b.vaqt; return x < y ? -1 : x > y ? 1 : a.n - b.n; }
      function opXato(op, sabab, kod) { if (op.xato) return; op.xato = true; op.s.holat = 'xato'; op.s.sabab = sabab; op.s.kod = kod; }
      function qolgani(q) { return q.summa - q.tolangan; }
      function yangiQarz(yon, o, nom) { return { nom: nom, yon: yon, hisobG: o.hisobG, summa: o.summa, sana: o.sana, vaqt: o.vaqt, izoh: o.izoh || '', muddat: o.muddat || '', ops: [o], bo: [], tolangan: 0 }; }
      // Qaytarishni qarzlarga qo'yish: avval to'liq sig'adigan birinchi qarzga, bo'lmasa eng eskisidan boshlab bo'laklab
      function qaytar(pool, op, ogohni) {
        var rem = op.summa, mos = pool.filter(function (q) { return qolgani(q) > 0; });
        var bitta = mos.filter(function (q) { return qolgani(q) >= rem; })[0];
        if (bitta) { bitta.bo.push({ op: op, summa: rem }); bitta.tolangan += rem; return 0; }
        mos.forEach(function (q) {
          if (rem <= 0) return;
          var b = Math.min(qolgani(q), rem); q.bo.push({ op: op, summa: b }); q.tolangan += b; rem -= b;
        });
        if (rem < op.summa && ogohni) op.s.ogoh = (op.s.ogoh ? op.s.ogoh + '; ' : '') + 'Qaytarish bir necha qarzga bo\'lindi';
        return rem;
      }
      nomTartib.forEach(function (G) {
        var ops = G.ops.slice().sort(sort), qarzlar = [];
        var aniq = ops.filter(function (o) { return o.rol === 'asosiy'; }), aniqTolov = ops.filter(function (o) { return o.rol === 'tolov'; }), noma = ops.filter(function (o) { return !o.rol; });
        // (a) o'zimizning eksport
        aniq.forEach(function (o) { qarzlar.push(yangiQarz(o.yon, o, G.nom)); });
        aniqTolov.forEach(function (o) {
          var rem = qaytar(qarzlar.filter(function (q) { return q.yon === o.yon && !q.nomalum; }), o, true);
          if (rem === o.summa && !qarzlar.some(function (q) { return q.yon === o.yon && !q.nomalum; })) opXato(o, 'Qaytarish: shu nomdagi (' + G.nom + ') asosiy qarz amali topilmadi', 'R_QARZ_ASOSIY');
          else if (rem > 0) { o.s.ogoh = 'Qaytarish qarz summasidan ' + rem + ' so\'m ortiq: ortiqcha qismi yuklanmaydi'; o.s.ogohKod = 'R_QARZ_ORTIQCHA'; }
        });
        // (b) begona jadval: sana bo'yicha ketma-ket
        noma.forEach(function (o) {
          var yon = o.eff === 'in' ? 'oldim' : 'berdim';
          var qarama = qarzlar.filter(function (q) { return q.nomalum && q.yon !== yon && q.sana + ' ' + q.vaqt <= o.sana + ' ' + o.vaqt; });
          var rem = o.summa;
          if (qarama.length) rem = qaytar(qarama, o, true);
          if (rem > 0) {
            var q = yangiQarz(yon, o, G.nom); q.nomalum = true; q.summa = rem;
            if (rem < o.summa) { o.s.ogoh = (o.s.ogoh ? o.s.ogoh + '; ' : '') + 'Qaytarish qarzdan ' + rem + ' so\'m ortiq: ortiqcha qismi teskari yo\'nalishdagi yangi qarz bo\'ldi'; o.s.ogohKod = 'R_QARZ_ORTIQCHA'; }
            qarzlar.push(q);
          }
        });
        qarzlar.forEach(function (q) {
          var ogoh = [], hammasi = q.ops.concat(q.bo.map(function (b) { return b.op; }));
          q.bo.forEach(function (b) { if (b.op.sana + ' ' + b.op.vaqt < q.sana + ' ' + q.vaqt) { q.sana = b.op.sana; q.vaqt = b.op.vaqt; if (ogoh.indexOf('Qarz sanasi birinchi amal sanasiga moslandi') === -1) ogoh.push('Qarz sanasi birinchi amal sanasiga moslandi'); } });
          var shakl = { yonalish: q.yon, shaxs: G.nom, summa: String(q.summa), hisob: q.hisobG, sana: q.sana, vaqt: q.vaqt, muddat: q.muddat, izoh: q.izoh };
          var t = Calc.qarzniTekshir(shakl, h, null);
          if (t.xato && t.maydon === 'muddat') { shakl.muddat = ''; ogoh.push('Qaytarish muddati noto\'g\'ri edi: tashlab yuborildi'); t = Calc.qarzniTekshir(shakl, h, null); }
          if (t.xato) { hammasi.forEach(function (o) { opXato(o, 'Qarz tekshiruvdan o\'tmadi: ' + t.xato, 'R_QARZ_TEKSHIRUV'); }); return; }
          var rec = Object.assign({}, t.qarz, { tolovlar: [] }), nTolov = 0;
          q.bo.forEach(function (b, i) {
            var tt = Calc.tolovniTekshir(rec, { summa: String(b.summa), hisob: b.op.hisobG, sana: b.op.sana, vaqt: b.op.vaqt }, h, undefined);
            if (tt.xato) { opXato(b.op, 'Qaytarish tekshiruvdan o\'tmadi: ' + tt.xato, 'R_QARZ_TEKSHIRUV'); return; }
            rec.tolovlar.push(Object.assign({ id: 'p' + i }, tt.tolov)); nTolov += b.summa;
          });
          var oplar = []; hammasi.forEach(function (o) { if (!o.xato && oplar.indexOf(o) === -1) oplar.push(o); });
          G.qarz++;
          qarzNatija.qarzlar.push({ nom: G.nom, yon: rec.yonalish, hisobG: rec.hisob_id, summa: rec.summa, tolangan: nTolov, qolgan: rec.summa - nTolov, amal: oplar.length, muddat: rec.muddat, ogoh: ogoh, rec: rec, ops: oplar });
          var ta = qarzNatija.tasir, berdim = rec.yonalish === 'berdim';
          ta[rec.hisob_id] = (ta[rec.hisob_id] || 0) + (berdim ? -rec.summa : rec.summa);
          rec.tolovlar.forEach(function (x) { ta[x.hisob_id] = (ta[x.hisob_id] || 0) + (berdim ? x.summa : -x.summa); });
        });
      });
      qarzOps.forEach(function (op) { if (op.xato) jami.xato++; else jami.qarzAmal++; });
      qarzNatija.nomlar = nomTartib.map(function (g) { return { nom: g.nom, soni: g.soni, kirdi: g.kirdi, chiqdi: g.chiqdi, qarz: g.qarz }; });
      jami.qarz = qarzNatija.qarzlar.length;
    }

    xom.forEach(function (x) {
      var s = { n: x.n };
      if (x.tozalangan) jami.tozalangan++;
      if (x.xato) { s.holat = x.otkaz ? 'otkazildi' : 'xato'; s.sabab = x.xato; s.kod = x.kod; jami[s.holat]++; natija.push(s); return; }
      if (x.qarz) { qarzQatori(x, s); return; }
      var tur = null, usul = null, kk = kalit(x.kategoriya);
      // 1) aniq "Tur" ustuni (Daromad / Xarajat / O'tkazma); 2) foydalanuvchi tanlovi; 3) summa manfiy; 4) summa katagi shrifti rangi; 5) kategoriya bo'yicha tanlov (standart: xarajat)
      if (x.turMatn === 'daromad' || x.turMatn === 'xarajat' || x.turMatn === 'otkazma') { tur = x.turMatn; usul = tur === 'otkazma' ? 'otkazma' : 'tur'; }
      else if (turTanlovi[kk]) { tur = turTanlovi[kk]; usul = 'tanlov'; }
      else if (x.belgi < 0) { tur = 'xarajat'; usul = 'belgi'; }
      else if (x.rang === 'qizil') { tur = 'xarajat'; usul = 'rang'; }
      else if (x.rang === 'yashil') { tur = 'daromad'; usul = 'rang'; }
      else { tur = 'xarajat'; usul = 'tanlov'; }
      s.tur = tur; s.usul = usul; usullar[usul]++;
      if (usul === 'tanlov' || usul === 'belgi' || usul === 'rang') {
        var tg = turGuruh[kk];
        if (!tg) { tg = turGuruh[kk] = { kalit: kk, nom: x.kategoriya, korsatma: x.kategoriya || '(kategoriyasiz)', soni: 0, belgi: 0, rang: 0, tanlov: 0, tur: 0 }; turTartib.push(tg); }
        tg.soni++; tg[usul]++;
      }
      var hg = hisobGuruhi(x.hisob), y = { tur: tur, sana: x.sana, vaqt: x.vaqt, summa: x.summa, izoh: x.izoh, hisobG: hg.kalit };
      var katNomi = '';
      if (tur === 'otkazma') {
        if (!x.hisob || !x.qayerga) { hg.soni--; s.holat = 'otkazildi'; s.sabab = 'O\'tkazma: ' + (!x.hisob ? 'qayerdan' : 'qayerga') + ' hisobi yozilmagan'; s.kod = 'R_OTKAZMA'; jami.otkazildi++; natija.push(s); return; }
        if (kalit(x.hisob) === kalit(x.qayerga)) { hg.soni--; s.holat = 'otkazildi'; s.sabab = 'O\'tkazma: ikkala hisob bir xil'; s.kod = 'R_OTKAZMA'; jami.otkazildi++; natija.push(s); return; }
        y.qabulG = hisobGuruhi(x.qayerga).kalit;
      } else {
        var kg = katGuruhi(tur, x.kategoriya);
        y.katG = kg.kalit; katNomi = nomi(kg);
      }
      if (hg.id === null && !hg.yangi) { s.holat = 'xato'; s.sabab = x.hisob ? 'Hisob yo\'q (avval hisob qo\'shing)' : 'Hisob ko\'rsatilmagan ("-" yoki bo\'sh): ko\'rinishda hisobni tanlang'; s.kod = 'R_HISOB'; jami.xato++; natija.push(s); return; }
      if (Calc.kelajakmi(x.sana, x.vaqt, h)) { s.holat = 'xato'; s.sabab = 'Vaqti hozirdan keyin (' + x.sana.split('-').reverse().join('.') + ' ' + x.vaqt + '): kelajakka yozuv bo\'lmaydi'; s.kod = 'R_KELAJAK'; jami.xato++; natija.push(s); return; }
      // takror: avval ID bo'yicha, keyin sana + summa + kategoriya + izoh bo'yicha (mavjud yozuvlar bilan: har biri bir marta hisoblanadi)
      var sabab = null;
      if (x.id && !ESKI_ID.test(x.id)) {
        if (tarixId[x.id] || kopIdlar[x.id]) sabab = 'ID bo\'yicha takror (' + x.id + ')';
        kopIdlar[x.id] = true;
      }
      var fk = yozuvKaliti(tur, x.sana, x.summa, katNomi, nomi(hg), y.qabulG ? nomi(hisobGuruh[y.qabulG]) : '', x.izoh);
      if (!sabab && kalitlar[fk] > 0) { sabab = 'Sana, summa, kategoriya va izoh bo\'yicha takror'; kalitlar[fk]--; }
      s.yozuv = y; s.id = x.id;
      if (x.yaxlit) { s.ogoh = 'Summa kasrli edi, so\'mga yaxlitlandi'; jami.yaxlit++; }
      if (x.ogoh) { s.ogoh = (s.ogoh ? s.ogoh + '; ' : '') + x.ogoh; jami.ogoh++; }
      if (sabab) { s.takror = true; s.sabab = sabab; }
      if (sabab && tanlov.takror !== 'yuklash') { s.holat = 'takror'; s.kod = 'R_TAKROR'; jami.takror++; }
      else { s.holat = 'yuklanadi'; jami.yuklanadi++; }
      natija.push(s);
    });
    qarzlarniRejala();
    // ---- Hisoblar: ishlatilishi, ta'sir va ixtiyoriy qoldiqni moslash ----
    var qoldiqTanlov = tanlov.qoldiq || {}, qoldiqMavjud = mavjud.qoldiqlar || {}, ta = {}, ishla = {}, noyobNomlar = {};
    function T(k) { return ta[k] || (ta[k] = { oddiy: 0, qarz: 0 }); }
    natija.forEach(function (q) {
      if (q.holat !== 'yuklanadi' || !q.yozuv) return;
      var y = q.yozuv; ishla[y.hisobG] = 1;
      if (y.tur === 'daromad') T(y.hisobG).oddiy += y.summa; else if (y.tur === 'xarajat') T(y.hisobG).oddiy -= y.summa;
      else { ishla[y.qabulG] = 1; T(y.hisobG).oddiy -= y.summa; T(y.qabulG).oddiy += y.summa; }
    });
    qarzNatija.qarzlar.forEach(function (e) { ishla[e.rec.hisob_id] = 1; e.rec.tolovlar.forEach(function (t) { ishla[t.hisob_id] = 1; }); });
    Object.keys(qarzNatija.tasir).forEach(function (k) { T(k).qarz += qarzNatija.tasir[k]; });
    xom.forEach(function (x) { if (x.hisob) noyobNomlar[kalit(x.hisob)] = 1; if (x.qayerga) noyobNomlar[kalit(x.qayerga)] = 1; });
    var yangiHisob = 0;
    hisobTartib.forEach(function (g) {
      g.ishlatiladi = !!ishla[g.kalit];
      if (!g.ishlatiladi) return;
      var t = ta[g.kalit] || { oddiy: 0, qarz: 0 }, m = g.id ? qoldiqMavjud[g.id] : null;
      g.oddiy = t.oddiy; g.qarz = t.qarz; g.delta = t.oddiy + t.qarz;
      g.joriy = m ? m.joriy : 0; g.keyin = g.joriy + g.delta; g.boshlangich = null; g.boshlangichYangi = null; g.qoldiqOgoh = '';
      if (!g.id) yangiHisob++;
      var kir = qoldiqTanlov[g.kalit];
      g.kiritilgan = (typeof kir === 'number' && isFinite(kir) && Math.floor(kir) === kir) ? kir : null;
      if (g.kiritilgan === null) return;
      if (!g.id) { g.boshlangich = g.kiritilgan - g.delta; g.keyin = g.kiritilgan; }   // yangi hisob: boshlang'ich = kiritilgan − importdan kelgan jami o'zgarish
      else if (tanlov.mavjudQoldiq && m) { g.boshlangichYangi = m.boshlangich + g.kiritilgan - g.keyin; g.keyin = g.kiritilgan; }
      else g.qoldiqOgoh = 'Mavjud hisobning boshlang\'ich qoldig\'i o\'zgarmaydi (tasdiqlanmagan): "keyin" qiymati kiritilganga teng bo\'lmasligi mumkin';
      if ((g.boshlangich !== null && Math.abs(g.boshlangich) > 999999999999999) || (g.boshlangichYangi !== null && Math.abs(g.boshlangichYangi) > 999999999999999)) { g.boshlangich = null; g.boshlangichYangi = null; g.keyin = g.joriy + g.delta; g.qoldiqOgoh = 'Qoldiq juda katta: e\'tiborga olinmadi'; }
    });
    var turSoni = { xarajat: 0, daromad: 0, otkazma: 0, qarz: qarzNatija.qarzlar.length, qarzAmal: jami.qarzAmal };
    natija.forEach(function (q) { if (q.holat === 'yuklanadi' && q.yozuv) turSoni[q.yozuv.tur]++; });
    // Himoya: 100+ oddiy qator bo'lib, na rang, na manfiy belgi bilan hech biri aniqlanmasa — rang o'qilmagan bo'lishi mumkin (hamma qator xarajat bo'lib ketadi)
    var rangOgoh = { qatorlar: usullar.tanlov + usullar.rang + usullar.belgi, rang: usullar.rang, belgi: usullar.belgi };
    rangOgoh.katta = usullar.tanlov >= 100 && usullar.rang === 0 && usullar.belgi === 0 && !Object.keys(turTanlovi).length;   // foydalanuvchi kategoriya bo'yicha o'zi belgilagan bo'lsa — ogohlantirish kerak emas
    var noyobSoni = Object.keys(noyobNomlar).length;
    var hisobOgoh = { yangi: yangiHisob, noyob: noyobSoni, katta: yangiHisob > 15 || yangiHisob > noyobSoni };
    return { qatorlar: natija, jami: jami, usullar: usullar, kategoriyalar: katTartib, hisoblar: hisobTartib, turGuruhlari: turTartib, turSoni: turSoni, rangOgoh: rangOgoh, qarzlar: qarzNatija.qarzlar, qarzNomlar: qarzNatija.nomlar, qarzTasiri: qarzNatija.tasir, hisobOgoh: hisobOgoh };
  }

  // Tasdiqlangan rejadan yozilishi kerak bo'lgan qatorlar. ops: { yangiId(), vaqt (Date.now() qiymati), hisobTuri(nom), hisobRang(tur), hisobBelgi(tur), katRang(nom, tur, tartib), katBelgi(nom, tur) }.
  // Natija: { hisoblar: [], kategoriyalar: [], yozuvlar: [], manbaIdlar: [] } (yozuvlar yaratilish tartibi: fayldagi oxirgi qator eng birinchi yaratiladi)
  function tayyorla(r, ops) {
    var yangiId = ops.yangiId, vaqt = ops.vaqt;
    var hisoblar = [], kategoriyalar = [], yozuvlar = [], manba = [], hid = {}, kid = {}, t = vaqt, i, ishlatilgan = {};
    function iso(k) { return new Date(t + k).toISOString(); }
    r.qatorlar.forEach(function (q) { if (q.holat === 'yuklanadi' && q.yozuv) { ishlatilgan[q.yozuv.hisobG] = 1; if (q.yozuv.qabulG) ishlatilgan[q.yozuv.qabulG] = 1; if (q.yozuv.katG) ishlatilgan[q.yozuv.katG] = 1; } });
    (r.qarzlar || []).forEach(function (e) { ishlatilgan[e.rec.hisob_id] = 1; e.rec.tolovlar.forEach(function (t) { ishlatilgan[t.hisob_id] = 1; }); });
    r.hisoblar.forEach(function (g) {
      if (!ishlatilgan[g.kalit]) return;
      if (g.id) hid[g.kalit] = g.id;
      else {
        var id = yangiId(), tur = ops.hisobTuri(g.nom);
        hisoblar.push({ id: id, yaratilgan: iso(hisoblar.length), nom: g.nom, tur: tur, belgi: ops.hisobBelgi(tur), rang: ops.hisobRang(tur), oxirgi4: '', boshlangich_qoldiq: g.boshlangich !== null && g.boshlangich !== undefined ? g.boshlangich : 0, arxivlangan: false });
        hid[g.kalit] = id;
      }
    });
    r.kategoriyalar.forEach(function (g) {
      if (!ishlatilgan[g.kalit]) return;
      if (g.id) kid[g.kalit] = g.id;
      else {
        var id = yangiId();
        kategoriyalar.push({ id: id, yaratilgan: iso(hisoblar.length + kategoriyalar.length), nom: g.yangiNom, tur: g.tur, rang: ops.katRang(g.yangiNom, g.tur, kategoriyalar.length), belgi: ops.katBelgi(g.yangiNom, g.tur), arxivlangan: false });
        kid[g.kalit] = id;
      }
    });
    var yuklanadigan = r.qatorlar.filter(function (q) { return q.holat === 'yuklanadi' && q.yozuv; }), N = yuklanadigan.length, qarzlar = [];
    // fayldagi birinchi qator eng kech yaratiladi: eksportda (teng vaqtda) u yana tepada chiqadi
    for (i = N - 1; i >= 0; i--) {
      var q = yuklanadigan[i], y = q.yozuv;
      var z = { id: yangiId(), yaratilgan: iso(100 + (N - 1 - i)), tur: y.tur, summa: y.summa, sana: y.sana, vaqt: y.vaqt, hisob_id: hid[y.hisobG], kategoriya_id: y.tur === 'otkazma' ? null : kid[y.katG], izoh: y.izoh };
      if (y.tur === 'otkazma') z.qabul_hisob_id = hid[y.qabulG];
      yozuvlar.push(z);
    }
    // Mavjud hisobning boshlang'ich qoldig'i (faqat foydalanuvchi tasdiqlagan bo'lsa): eski qiymat bekor qilish uchun saqlanadi
    var hisobYangilash = [];
    r.hisoblar.forEach(function (g) { if (g.ishlatiladi && g.id && g.boshlangichYangi !== null && g.boshlangichYangi !== undefined) hisobYangilash.push({ id: g.id, boshlangich_qoldiq: g.boshlangichYangi }); });
    // Qarzlar: ilovaning o'z qarz shaklida (Calc.qarzniYangilash "yopilgan" belgisini qo'yadi), to'lovlar o'z ID si bilan
    (r.qarzlar || []).forEach(function (e, qi) {
      var rec = e.rec, z = Object.assign({}, rec, { id: yangiId(), yaratilgan: iso(10 + qi), hisob_id: hid[rec.hisob_id],
        tolovlar: rec.tolovlar.map(function (x, i) { return { id: yangiId(), yaratilgan: iso(10 + qi + (i + 1) / 1000), summa: x.summa, hisob_id: hid[x.hisob_id], sana: x.sana, vaqt: x.vaqt }; }) });
      qarzlar.push(Calc.qarzniYangilash(z));
    });
    r.qatorlar.forEach(function (q) { if (q.holat === 'yuklanadi' && q.id && !ESKI_ID.test(q.id)) manba.push(q.id); });
    return { hisoblar: hisoblar, kategoriyalar: kategoriyalar, yozuvlar: yozuvlar, qarzlar: qarzlar, hisobYangilash: hisobYangilash, manbaIdlar: manba };
  }

  // "Soxta" hisoblar: nomi "… <summa> <valyuta>" bilan tugaydigan (eski xato import yaratgan) va boshqa yozuvi yo'q yoki faqat import yozuvlari bor hisoblar.
  // importIdlar: { yozuv/qarz ID: true } (yuklashlar stekidan). Nishon — tozalangan nomdagi haqiqiy hisob (bo'lsa).
  function soxtaHisoblar(hisoblar, yozuvlar, qarzlar, importIdlar) {
    importIdlar = importIdlar || {};
    var faol = (hisoblar || []).filter(function (h) { return !h.arxivlangan; }), r = [];
    faol.forEach(function (h) {
      var t = tozaNom(h.nom);
      if (!t.tozalandi || !t.nom) return;
      var yo = 0, qo = 0, faqatImport = true;
      (yozuvlar || []).forEach(function (y) { if (y.hisob_id === h.id || y.qabul_hisob_id === h.id) { yo++; if (!importIdlar[y.id]) faqatImport = false; } });
      (qarzlar || []).forEach(function (z) {
        var bor = z.hisob_id === h.id || (z.tolovlar || []).some(function (x) { return x.hisob_id === h.id; });
        if (bor) { qo++; if (!importIdlar[z.id]) faqatImport = false; }
      });
      var nishon = faol.filter(function (x) { return x.id !== h.id && kalit(x.nom) === kalit(t.nom) && !tozaNom(x.nom).tozalandi; })[0] || null;
      r.push({ hisob: h, tozaNom: t.nom, summa: t.summa, yozuv: yo, qarz: qo, faqatImport: faqatImport, nishon: nishon });
    });
    // faqat yozuvi yo'q yoki faqat import yozuvlari bor hisoblar ko'rsatiladi (boshqa yozuvi borlarga tegilmaydi)
    return r.filter(function (x) { return x.yozuv + x.qarz === 0 || x.faqatImport; });
  }

  return {
    soxtaHisoblar: soxtaHisoblar, tozaNom: tozaNom, toza: toza,
    MAYDONLAR: MAYDONLAR, MAYDON_NOMLARI: MAYDON_NOMLARI, ustunlarniTaxmin: ustunlarniTaxmin, summaOqi: summaOqi, sanaOqi: sanaOqi, turMatni: turMatni, valyutaKodi: valyutaKodi,
    qatorlarniOqi: qatorlarniOqi, reja: reja, tayyorla: tayyorla, mavjudKalitlar: mavjudKalitlar, qarzKalitlari: qarzKalitlari, qarzTuriOqi: qarzTuriOqi, hujayraMatni: hujayraMatni, ESKI_ID: ESKI_ID, seriyadanSana: seriyadanSana
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = ImportSof;
