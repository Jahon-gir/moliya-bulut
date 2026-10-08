// ImportSof — Excel (.xlsx) dan yuklashning sof qoidalari (TZ-sinxronlash.md, 18.2). DOM ham, ma'lumotlar bazasi ham yo'q:
// ustunlarni taxmin qilish, summa va sanani o'qish, tur aniqlash, takrorlarni topish, yozuvlarni tayyorlash. tests.html da to'liq sinaladi.
var ImportSof = (function () {
  'use strict';

  var MAYDONLAR = ['sana', 'id', 'tur', 'hisob', 'qayerga', 'kategoriya', 'summa', 'valyuta', 'izoh', 'qarzNomi', 'qarzTuri'];
  var MAYDON_NOMLARI = { sana: 'Sana va vaqt', id: 'ID', tur: 'Tur', hisob: 'Hisob', qayerga: 'Qayerga (o\'tkazma)', kategoriya: 'Kategoriya', summa: 'Summa', valyuta: 'Valyuta', izoh: 'Izoh', qarzNomi: 'Qarz nomi', qarzTuri: 'Qarz turi' };
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
    qarzTuri: ['loantype', 'qarzturi']
  };

  function sarlavhaKaliti(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9Ѐ-ӿ]/g, ''); }
  function hujayraMatni(c) {
    if (!c) return '';
    if (c.t === 's') return c.v;
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

  // ---- 1-bosqich: qatorlarni xom o'qish (xarita o'zgarsagina qayta ishlanadi) ----
  // Natija: [{ n (Excel qator raqami), xato/kod yoki: sana, vaqt, summa, belgi, valyuta, rang, tur (matndan), kategoriya, hisob, qayerga, izoh, id, qarz }]
  function qatorlarniOqi(qatorlar, sarlavhaQator, xarita) {
    var r = [];
    function mt(q, m) { var u = xarita[m]; return u >= 0 && q[u] ? hujayraMatni(q[u]) : ''; }
    for (var i = sarlavhaQator + 1; i < qatorlar.length; i++) {
      var q = qatorlar[i];
      if (bosh(q)) continue;
      var x = { n: i + 1 };
      var sa = sanaOqi(xarita.sana >= 0 ? q[xarita.sana] : null, true);
      var su = summaOqi(xarita.summa >= 0 ? q[xarita.summa] : null);
      x.turMatn = turMatni(mt(q, 'tur'));
      x.turNomi = mt(q, 'tur').trim();
      x.kategoriya = mt(q, 'kategoriya').trim();
      x.hisob = mt(q, 'hisob').trim();
      x.qayerga = mt(q, 'qayerga').trim();
      x.izoh = mt(q, 'izoh').replace(/\r\n?/g, '\n').trim();
      x.id = mt(q, 'id').trim();
      x.qarz = x.turMatn === 'qarz' || mt(q, 'qarzNomi').trim() !== '' || mt(q, 'qarzTuri').trim() !== '';
      var vk = valyutaKodi(mt(q, 'valyuta'));
      if (x.qarz) { x.xato = 'Qarz amali: qarzlar bu usulda yuklanmaydi'; x.kod = 'R_QARZ'; x.otkaz = true; r.push(x); continue; }
      if (sa.xato) { x.xato = sa.xato; x.kod = sa.kod; r.push(x); continue; }
      if (su.xato) { x.xato = su.xato; x.kod = su.kod; r.push(x); continue; }
      x.sana = sa.sana; x.vaqt = sa.vaqt;
      x.summa = su.son; x.belgi = su.belgi; x.yaxlit = su.yaxlit;
      x.rang = xarita.summa >= 0 && q[xarita.summa] ? q[xarita.summa].rang || null : null;
      var val = vk || su.valyuta;
      if (vk && su.valyuta && vk !== su.valyuta) val = vk === 'UZS' ? su.valyuta : vk;
      if (val && val !== 'UZS') { x.xato = 'Valyuta ' + val + ': faqat so\'m (UZS) yuklanadi'; x.kod = 'R_VALYUTA'; x.otkaz = true; r.push(x); continue; }
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

  // xom: qatorlarniOqi natijasi. tanlov: { turTanlovi: { kategoriyaKaliti: 'xarajat' | 'daromad' }, kategoriya: { 'tur|kalit': { id } | { yangi: true } }, hisob: { kalit: { id } | { yangi: true } }, takror: 'otkaz' | 'yuklash' }
  // mavjud: { hisoblar (faol), kategoriyalar (faol), yozuvKalitlari, tarixIdlar: { id: true } }, h: Calc.hozir()
  // Natija: { qatorlar: [{ n, holat: 'yuklanadi' | 'xato' | 'otkazildi' | 'takror', sabab, kod, tur, usul, yozuv }], jami, usullar, kategoriyalar, hisoblar, turGuruhlari }
  function reja(xom, tanlov, mavjud, h) {
    tanlov = tanlov || {};
    var turTanlovi = tanlov.turTanlovi || {}, katTanlov = tanlov.kategoriya || {}, hisobTanlov = tanlov.hisob || {};
    var kalitlar = {}, kopIdlar = {}, tarixId = mavjud.tarixIdlar || {};
    Object.keys(mavjud.yozuvKalitlari || {}).forEach(function (k) { kalitlar[k] = mavjud.yozuvKalitlari[k]; });
    var katGuruh = {}, hisobGuruh = {}, turGuruh = {}, katTartib = [], hisobTartib = [], turTartib = [];
    var jami = { yuklanadi: 0, xato: 0, otkazildi: 0, takror: 0, yaxlit: 0, jami: xom.length }, usullar = { tur: 0, belgi: 0, rang: 0, tanlov: 0, otkazma: 0 };
    var natija = [];
    var faolHisob = mavjud.hisoblar || [], faolKat = mavjud.kategoriyalar || [];

    function hisobGuruhi(nom) {
      var k = kalit(nom), g = hisobGuruh[k];
      if (!g) {
        var mv = faolHisob.filter(function (x) { return kalit(x.nom) === k; })[0], t = hisobTanlov[k], id = null, yangi = false;
        if (t && t.id && faolHisob.some(function (x) { return x.id === t.id; })) id = t.id;
        else if (t && t.yangi && nom) yangi = true;
        else if (mv) id = mv.id;
        else if (!nom) id = faolHisob.length ? faolHisob[0].id : null;
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

    xom.forEach(function (x) {
      var s = { n: x.n };
      if (x.xato) { s.holat = x.otkaz ? 'otkazildi' : 'xato'; s.sabab = x.xato; s.kod = x.kod; jami[s.holat]++; natija.push(s); return; }
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
      if (hg.id === null && !hg.yangi) { s.holat = 'xato'; s.sabab = 'Hisob yo\'q (avval hisob qo\'shing)'; s.kod = 'R_HISOB'; jami.xato++; natija.push(s); return; }
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
      if (sabab) { s.takror = true; s.sabab = sabab; }
      if (sabab && tanlov.takror !== 'yuklash') { s.holat = 'takror'; s.kod = 'R_TAKROR'; jami.takror++; }
      else { s.holat = 'yuklanadi'; jami.yuklanadi++; }
      natija.push(s);
    });
    return { qatorlar: natija, jami: jami, usullar: usullar, kategoriyalar: katTartib, hisoblar: hisobTartib, turGuruhlari: turTartib };
  }

  // Tasdiqlangan rejadan yozilishi kerak bo'lgan qatorlar. ops: { yangiId(), vaqt (Date.now() qiymati), hisobTuri(nom), hisobRang(tur), hisobBelgi(tur), katRang(nom, tur, tartib), katBelgi(nom, tur) }.
  // Natija: { hisoblar: [], kategoriyalar: [], yozuvlar: [], manbaIdlar: [] } (yozuvlar yaratilish tartibi: fayldagi oxirgi qator eng birinchi yaratiladi)
  function tayyorla(r, ops) {
    var yangiId = ops.yangiId, vaqt = ops.vaqt;
    var hisoblar = [], kategoriyalar = [], yozuvlar = [], manba = [], hid = {}, kid = {}, t = vaqt, i, ishlatilgan = {};
    function iso(k) { return new Date(t + k).toISOString(); }
    r.qatorlar.forEach(function (q) { if (q.holat === 'yuklanadi') { ishlatilgan[q.yozuv.hisobG] = 1; if (q.yozuv.qabulG) ishlatilgan[q.yozuv.qabulG] = 1; if (q.yozuv.katG) ishlatilgan[q.yozuv.katG] = 1; } });
    r.hisoblar.forEach(function (g) {
      if (!ishlatilgan[g.kalit]) return;
      if (g.id) hid[g.kalit] = g.id;
      else {
        var id = yangiId(), tur = ops.hisobTuri(g.nom);
        hisoblar.push({ id: id, yaratilgan: iso(hisoblar.length), nom: g.nom, tur: tur, belgi: ops.hisobBelgi(tur), rang: ops.hisobRang(tur), oxirgi4: '', boshlangich_qoldiq: 0, arxivlangan: false });
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
    var yuklanadigan = r.qatorlar.filter(function (q) { return q.holat === 'yuklanadi'; }), N = yuklanadigan.length;
    // fayldagi birinchi qator eng kech yaratiladi: eksportda (teng vaqtda) u yana tepada chiqadi
    for (i = N - 1; i >= 0; i--) {
      var q = yuklanadigan[i], y = q.yozuv;
      var z = { id: yangiId(), yaratilgan: iso(100 + (N - 1 - i)), tur: y.tur, summa: y.summa, sana: y.sana, vaqt: y.vaqt, hisob_id: hid[y.hisobG], kategoriya_id: y.tur === 'otkazma' ? null : kid[y.katG], izoh: y.izoh };
      if (y.tur === 'otkazma') z.qabul_hisob_id = hid[y.qabulG];
      yozuvlar.push(z);
      if (q.id && !ESKI_ID.test(q.id)) manba.push(q.id);
    }
    return { hisoblar: hisoblar, kategoriyalar: kategoriyalar, yozuvlar: yozuvlar, manbaIdlar: manba };
  }

  return {
    MAYDONLAR: MAYDONLAR, MAYDON_NOMLARI: MAYDON_NOMLARI, ustunlarniTaxmin: ustunlarniTaxmin, summaOqi: summaOqi, sanaOqi: sanaOqi, turMatni: turMatni, valyutaKodi: valyutaKodi,
    qatorlarniOqi: qatorlarniOqi, reja: reja, tayyorla: tayyorla, mavjudKalitlar: mavjudKalitlar, hujayraMatni: hujayraMatni, ESKI_ID: ESKI_ID, seriyadanSana: seriyadanSana
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = ImportSof;
