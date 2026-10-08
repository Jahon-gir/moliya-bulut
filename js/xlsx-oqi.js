// XlsxOqi — tashqi kutubxonasiz .xlsx o'quvchi (TZ-sinxronlash.md, 18.2). Faqat o'qiydi, DOM ga tegmaydi, fayl hech qayerga yuborilmaydi.
// XlsxOqi.oqi(ArrayBuffer | Uint8Array) -> Promise<{ qatorlar }>, qatorlar[i][j] = { t: 'n' | 's' | 'b' | 'e', v, sana: bool, rang: 'qizil' | 'yashil' | null } yoki undefined (bo'sh).
// ZIP ni o'zi o'qiydi; siqilgan qismlar brauzerning DecompressionStream('deflate-raw') bilan ochiladi (vendor kutubxona kerak emas).
// Xato: Error, e.kod = IMPORT_EMPTY | IMPORT_FORMAT | IMPORT_PARSE | IMPORT_BRAUZER | IMPORT_KATTA.
var XlsxOqi = (function () {
  'use strict';

  var MAKS_FAYL = 30 * 1024 * 1024;        // siqilgan fayl hajmi
  var MAKS_OCHILGAN = 150 * 1024 * 1024;   // ochilgan hajm (zip bomba himoyasi)
  var MAKS_QATOR = 50000;

  function xato(kod, matn) { var e = new Error(matn); e.kod = kod; return e; }

  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

  // ---- ZIP: markaziy katalogdan fayllar ro'yxati ----
  function zipRoyxat(b) {
    var i, eocd = -1;
    for (i = b.length - 22; i >= Math.max(0, b.length - 22 - 65535); i--) { if (u32(b, i) === 0x06054b50) { eocd = i; break; } }
    if (eocd < 0) throw xato('IMPORT_PARSE', 'Fayl buzilgan (ZIP tuzilishi topilmadi)');
    var n = u16(b, eocd + 10), o = u32(b, eocd + 16), r = {}, jami = 0, dek = new TextDecoder('utf-8');
    for (i = 0; i < n; i++) {
      if (o + 46 > b.length || u32(b, o) !== 0x02014b50) throw xato('IMPORT_PARSE', 'Fayl buzilgan (katalog)');
      var usul = u16(b, o + 10), siq = u32(b, o + 20), och = u32(b, o + 24), nl = u16(b, o + 28), el = u16(b, o + 30), cl = u16(b, o + 32), lh = u32(b, o + 42);
      var nom = dek.decode(b.subarray(o + 46, o + 46 + nl));
      jami += och;
      if (jami > MAKS_OCHILGAN) throw xato('IMPORT_KATTA', 'Fayl juda katta (ochilgach ' + Math.round(MAKS_OCHILGAN / 1048576) + ' MB dan oshadi)');
      r[nom] = { usul: usul, siq: siq, och: och, lh: lh };
      o += 46 + nl + el + cl;
    }
    return r;
  }

  function inflate(siqilgan) {
    if (typeof DecompressionStream === 'undefined') return Promise.reject(xato('IMPORT_BRAUZER', 'Bu brauzer siqilgan Excel faylini ocha olmaydi. Brauzerni yangilang'));
    var oqim = new Blob([siqilgan]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(oqim).arrayBuffer().then(function (a) { return new Uint8Array(a); });
  }

  function qismOl(b, royxat, nom) {
    var f = royxat[nom];
    if (!f) return Promise.resolve(null);
    var o = f.lh;
    if (o + 30 > b.length || u32(b, o) !== 0x04034b50) return Promise.reject(xato('IMPORT_PARSE', 'Fayl buzilgan (' + nom + ')'));
    var boshi = o + 30 + u16(b, o + 26) + u16(b, o + 28);
    if (boshi + f.siq > b.length) return Promise.reject(xato('IMPORT_PARSE', 'Fayl yarim (' + nom + ')'));
    var q = b.subarray(boshi, boshi + f.siq);
    if (f.usul === 0) return Promise.resolve(q);
    if (f.usul !== 8) return Promise.reject(xato('IMPORT_FORMAT', 'Qo\'llanmaydigan siqish usuli'));
    return inflate(q).catch(function (e) { throw e && e.kod ? e : xato('IMPORT_PARSE', 'Fayl buzilgan (siqilgan qism ochilmadi)'); });
  }

  function matnga(u8) { return new TextDecoder('utf-8').decode(u8); }
  function xmlOqi(matn, nom) {
    var d = new DOMParser().parseFromString(matn.charCodeAt(0) === 0xFEFF ? matn.slice(1) : matn, 'application/xml');
    if (d.getElementsByTagName('parsererror').length) throw xato('IMPORT_PARSE', 'Fayl buzilgan (' + nom + ' o\'qilmadi)');
    return d;
  }
  function bolalar(el, nom) { var r = []; for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && c.localName === nom) r.push(c); return r; }
  function birinchi(el, nom) { return bolalar(el, nom)[0] || null; }

  // Excel matnidagi "_x000D_" kabi belgilar
  function xmlBelgi(s) { return s.replace(/_x([0-9A-Fa-f]{4})_/g, function (m, h) { return String.fromCharCode(parseInt(h, 16)); }); }

  // <si> / <is> ichidagi matn: <t> va <r><t> larning yig'indisi (talaffuz <rPh> hisobga olinmaydi)
  function matnYig(el) {
    var s = '';
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType !== 1) continue;
      if (c.localName === 't') s += c.textContent;
      else if (c.localName === 'r') { var t = birinchi(c, 't'); if (t) s += t.textContent; }
    }
    return xmlBelgi(s.replace(/\r\n?/g, '\n'));
  }

  // ---- stillar: sana formatlari va shrift rangi ----
  var ICHKI_SANA_FORMATLARI = { 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 19: 1, 20: 1, 21: 1, 22: 1, 45: 1, 46: 1, 47: 1 };
  function sanaFormatimi(id, kod) {
    if (ICHKI_SANA_FORMATLARI[id]) return true;
    if (!kod) return false;
    var s = kod.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').replace(/\\./g, '');
    return /[dmyhs]/i.test(s) && !/^(general|0|#)/i.test(s);
  }
  // Rang -> 'qizil' | 'yashil' | null. rgb: AARRGGBB; indexed: asosiy qizil/yashil; theme — o'qilmaydi (null)
  var INDEKS_RANGLAR = { 10: 'qizil', 16: 'qizil', 17: 'yashil', 11: 'yashil', 57: 'yashil', 58: 'yashil' };
  function rangTuri(rgb, indeks) {
    if (indeks !== null && indeks !== undefined) return INDEKS_RANGLAR[indeks] || null;
    if (!rgb) return null;
    var h = rgb.length === 8 ? rgb.slice(2) : rgb;
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    var r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (mx < 0.2 || d / mx < 0.35) return null;   // qora, oq yoki kulrang
    var t;
    if (mx === r) t = ((g - b) / d + 6) % 6; else if (mx === g) t = (b - r) / d + 2; else t = (r - g) / d + 4;
    t *= 60;
    if (t < 25 || t >= 335) return 'qizil';
    if (t >= 75 && t <= 165) return 'yashil';
    return null;
  }
  function stillarOqi(doc) {
    var r = { xf: [] };
    if (!doc) return r;
    var root = doc.documentElement, fmt = {}, shriftlar = [], i;
    var nf = birinchi(root, 'numFmts');
    if (nf) bolalar(nf, 'numFmt').forEach(function (x) { fmt[x.getAttribute('numFmtId')] = x.getAttribute('formatCode'); });
    var fn = birinchi(root, 'fonts');
    if (fn) bolalar(fn, 'font').forEach(function (f) {
      var c = birinchi(f, 'color'), rang = null;
      if (c) rang = rangTuri(c.getAttribute('rgb'), c.hasAttribute('indexed') ? parseInt(c.getAttribute('indexed'), 10) : null);
      shriftlar.push(rang);
    });
    var xs = birinchi(root, 'cellXfs');
    if (xs) bolalar(xs, 'xf').forEach(function (x) {
      var id = parseInt(x.getAttribute('numFmtId') || '0', 10), fi = parseInt(x.getAttribute('fontId') || '0', 10);
      r.xf.push({ sana: sanaFormatimi(id, fmt[id]), rang: shriftlar[fi] || null });
    });
    return r;
  }

  function ustunIndeksi(ref) {
    var m = /^([A-Z]+)/.exec(ref || ''), n = 0;
    if (!m) return -1;
    for (var i = 0; i < m[1].length; i++) n = n * 26 + (m[1].charCodeAt(i) - 64);
    return n - 1;
  }

  function varaqOqi(doc, ss, stil) {
    var qatorlar = [], sd = birinchi(doc.documentElement, 'sheetData');
    if (!sd) return qatorlar;
    var qs = bolalar(sd, 'row'), sira = 0;
    if (qs.length > MAKS_QATOR + 1) throw xato('IMPORT_KATTA', 'Qatorlar juda ko\'p (' + MAKS_QATOR + ' tagacha)');
    qs.forEach(function (q) {
      var r = parseInt(q.getAttribute('r') || '0', 10);
      var idx = r > 0 ? r - 1 : sira;
      sira = idx + 1;
      var arr = qatorlar[idx] = [], ketma = 0;
      bolalar(q, 'c').forEach(function (c) {
        var ui = c.hasAttribute('r') ? ustunIndeksi(c.getAttribute('r')) : ketma;
        ketma = ui + 1;
        var t = c.getAttribute('t') || 'n', v = birinchi(c, 'v'), xf = stil.xf[parseInt(c.getAttribute('s') || '0', 10)] || { sana: false, rang: null };
        var qiymat;
        if (t === 'inlineStr') { var is = birinchi(c, 'is'); if (!is) return; qiymat = { t: 's', v: matnYig(is) }; }
        else if (!v) return;
        else if (t === 's') { var s = ss[parseInt(v.textContent, 10)]; if (s === undefined) return; qiymat = { t: 's', v: s }; }
        else if (t === 'str') qiymat = { t: 's', v: xmlBelgi(v.textContent.replace(/\r\n?/g, '\n')) };
        else if (t === 'b') qiymat = { t: 'b', v: v.textContent === '1' };
        else if (t === 'e') qiymat = { t: 'e', v: v.textContent };
        else { var n = parseFloat(v.textContent); if (!isFinite(n)) return; qiymat = { t: 'n', v: n }; }
        qiymat.sana = qiymat.t === 'n' && xf.sana;
        qiymat.rang = xf.rang;
        arr[ui] = qiymat;
      });
    });
    return qatorlar;
  }

  function oqi(kirish) {
    var b = kirish instanceof Uint8Array ? kirish : new Uint8Array(kirish);
    if (!b.length) return Promise.reject(xato('IMPORT_EMPTY', 'Fayl bo\'sh'));
    if (b.length > MAKS_FAYL) return Promise.reject(xato('IMPORT_KATTA', 'Fayl juda katta (' + Math.round(MAKS_FAYL / 1048576) + ' MB dan oshmasin)'));
    if (b.length >= 8 && u32(b, 0) === 0xE011CFD0) return Promise.reject(xato('IMPORT_FORMAT', 'Bu eski .xls fayli. Excelda "Boshqacha saqlash" → .xlsx (Excel Workbook) tanlab qayta saqlang'));
    if (!(b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b)) return Promise.reject(xato('IMPORT_FORMAT', 'Bu .xlsx fayli emas (faqat Excel .xlsx qabul qilinadi; CSV emas)'));
    var royxat;
    try { royxat = zipRoyxat(b); } catch (e) { return Promise.reject(e); }
    if (!royxat['xl/workbook.xml']) return Promise.reject(xato('IMPORT_FORMAT', 'Bu Excel kitobi emas (xl/workbook.xml yo\'q)'));
    var yol = 'xl/worksheets/sheet1.xml';
    return Promise.all([qismOl(b, royxat, 'xl/workbook.xml'), qismOl(b, royxat, 'xl/_rels/workbook.xml.rels')]).then(function (x) {
      try {
        var kitob = xmlOqi(matnga(x[0]), 'workbook.xml'), sh = birinchi(kitob.documentElement, 'sheets'), v1 = sh && bolalar(sh, 'sheet')[0];
        if (v1 && x[1]) {
          var rid = v1.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || v1.getAttribute('r:id');
          var rels = xmlOqi(matnga(x[1]), 'rels'), rl = rels.documentElement.getElementsByTagName('Relationship');
          for (var i = 0; i < rl.length; i++) if (rl[i].getAttribute('Id') === rid) {
            var t = rl[i].getAttribute('Target') || '';
            yol = t.charAt(0) === '/' ? t.slice(1) : 'xl/' + t.replace(/^\.\//, '');
          }
        }
      } catch (e) { if (e.kod) throw e; }
      if (!royxat[yol]) yol = 'xl/worksheets/sheet1.xml';
      if (!royxat[yol]) throw xato('IMPORT_FORMAT', 'Varaq topilmadi');
      return Promise.all([qismOl(b, royxat, yol), qismOl(b, royxat, 'xl/sharedStrings.xml'), qismOl(b, royxat, 'xl/styles.xml')]);
    }).then(function (p) {
      var ss = [];
      if (p[1]) bolalar(xmlOqi(matnga(p[1]), 'sharedStrings.xml').documentElement, 'si').forEach(function (si) { ss.push(matnYig(si)); });
      var stil = stillarOqi(p[2] ? xmlOqi(matnga(p[2]), 'styles.xml') : null);
      var qatorlar = varaqOqi(xmlOqi(matnga(p[0]), 'varaq'), ss, stil);
      var bor = qatorlar.some(function (q) { return q && q.some(function (c) { return c; }); });
      if (!bor) throw xato('IMPORT_EMPTY', 'Faylda ma\'lumot yo\'q');
      return { qatorlar: qatorlar };
    }).catch(function (e) { throw e && e.kod ? e : xato('IMPORT_PARSE', 'Faylni o\'qib bo\'lmadi: ' + (e && e.message ? e.message : e)); });
  }

  return { oqi: oqi, rangTuri: rangTuri, sanaFormatimi: sanaFormatimi, MAKS_QATOR: MAKS_QATOR };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = XlsxOqi;
