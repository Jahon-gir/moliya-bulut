// Xlsx — tashqi kutubxonasiz minimal .xlsx yozuvchi (OOXML, siqmasdan ZIP). Brauzer va Node'da ishlaydi, DOM'ga tegmaydi.
// Xlsx.fayl(eksport) -> Uint8Array. eksport = Calc.eksport(...) natijasi: { sarlavha, qatorlar, ... }
var Xlsx = (function () {
  'use strict';

  var VARAQ_NOMI = 'Eksport';
  // Ustun kengliklari (belgilarda): eng kichigi va eng kattasi; haqiqiy kenglik ustundagi eng uzun matnga qarab tanlanadi (kengliklar()).
  // Sana va vaqt, ID, Tur, Hisob, Qayerga, Kategoriya, Summa, Valyuta, Qarz nomi, Qarz turi, Izoh, Qaytarish muddati
  var KENG_CHEGARA = [[18, 18], [10, 12], [10, 14], [10, 28], [10, 28], [12, 28], [12, 22], [8, 9], [10, 28], [10, 12], [20, 50], [20, 20]];
  var USTUN_HARFLARI = 'ABCDEFGHIJKL';

  // Stil indekslari (styles.xml dagi cellXfs tartibi)
  var S_SARLAVHA = 1, S_SANA = 2, S_SUMMA = 3, S_MATN_HIMOYALI = 4, S_SUMMA_XARAJAT = 5, S_SUMMA_DAROMAD = 6, S_IZOH = 7, S_KUN = 8;   // 5: qizil (xarajat), 6: yashil (daromad), 7: izoh (o'ralgan matn)

  function xmlMatn(s) {
    return String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Sana (YYYY-MM-DD) va vaqt (HH:MM) -> Excel seriya raqami (1899-12-30 dan kunlar + kunning ulushi)
  function seriya(sana, vaqt) {
    var p = sana.split('-'), v = (vaqt || '00:00').split(':');
    var kunlar = Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000) + 25569;
    return kunlar + ((+v[0]) * 60 + (+v[1])) / 1440;
  }

  function uzunlik(m) { var u = 0; String(m == null ? '' : m).split('\n').forEach(function (q) { u = Math.max(u, q.length); }); return u; }
  // Ustun kengliklari: sarlavha va hujayralardagi eng uzun matn (summa uchun mingliklar bo'shlig'i bilan), chegara ichida
  function kengliklar(eksport) {
    var k = eksport.sarlavha.map(function (m) { return uzunlik(m) + 3; });
    eksport.qatorlar.forEach(function (q) {
      var m = [seriyaUzunligi, q.id, q.tur, q.hisob, q.qayerga, q.kategoriya, String(q.summa).replace(/\B(?=(\d{3})+(?!\d))/g, ' '), q.valyuta, q.qarzNomi, q.qarzTuri, q.izoh];
      for (var i = 1; i < m.length; i++) { var u = uzunlik(m[i]) + 2; if (u > k[i]) k[i] = u; }
    });
    return k.map(function (u, i) { return i === 0 ? 18 : Math.max(KENG_CHEGARA[i][0], Math.min(KENG_CHEGARA[i][1], u)); });
  }
  var seriyaUzunligi = '';
  function summaStili(q) { return q.tur === 'Xarajat' ? S_SUMMA_XARAJAT : q.tur === 'Daromad' ? S_SUMMA_DAROMAD : S_SUMMA; }
  // Izoh ko'p qatorli yoki uzun bo'lsa, qator balandligi (har qator 15 nuqta) — Excel ham, boshqa dasturlar ham o'ralgan matnni to'liq ko'rsatsin
  function qatorBalandligi(izoh, kenglik) {
    if (!izoh) return 0;
    var n = 0; String(izoh).split('\n').forEach(function (q) { n += Math.max(1, Math.ceil(q.length / Math.max(1, kenglik - 2))); });
    return n > 1 ? 15 * n : 0;
  }

  function hujayraHavolasi(ust, qator) { return USTUN_HARFLARI.charAt(ust) + qator; }

  function varaqXml(eksport, ulashgan) {
    var n = eksport.qatorlar.length, oxirgi = n + 1, x = [];
    x.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">');
    x.push('<dimension ref="A1:L' + oxirgi + '"/>');
    x.push('<sheetViews><sheetView workbookViewId="0" tabSelected="1"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>');
    x.push('<sheetFormatPr defaultRowHeight="15"/>');
    var kenglik = kengliklar(eksport);
    x.push('<cols>' + kenglik.map(function (k, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + k + '" customWidth="1"' + (i === 6 ? ' style="' + S_SUMMA + '"' : '') + '/>'; }).join('') + '</cols>');
    x.push('<sheetData>');
    x.push('<row r="1" ht="22" customHeight="1">' + eksport.sarlavha.map(function (s, i) { return '<c r="' + hujayraHavolasi(i, 1) + '" s="' + S_SARLAVHA + '" t="s"><v>' + ulashgan(s, false) + '</v></c>'; }).join('') + '</row>');
    for (var i = 0; i < n; i++) {
      var q = eksport.qatorlar[i], r = i + 2, c = [];
      c.push('<c r="A' + r + '" s="' + S_SANA + '"><v>' + seriya(q.sana, q.vaqt) + '</v></c>');
      var matnlar = [q.id, q.tur, q.hisob, q.qayerga, q.kategoriya];
      for (var j = 0; j < matnlar.length; j++) c.push(matnHujayra(j + 1, r, matnlar[j], ulashgan));
      c.push('<c r="G' + r + '" s="' + summaStili(q) + '"><v>' + q.summa + '</v></c>');
      var qolgan = [q.valyuta, q.qarzNomi, q.qarzTuri];
      for (j = 0; j < qolgan.length; j++) c.push(matnHujayra(j + 7, r, qolgan[j], ulashgan));
      c.push(matnHujayra(10, r, q.izoh, ulashgan, S_IZOH));
      if (q.muddat) c.push('<c r="L' + r + '" s="' + S_KUN + '"><v>' + seriya(q.muddat, '00:00') + '</v></c>');
      var bal = qatorBalandligi(q.izoh, kenglik[10]);
      x.push('<row r="' + r + '"' + (bal ? ' ht="' + bal + '" customHeight="1"' : '') + '>' + c.join('') + '</row>');
    }
    x.push('</sheetData>');
    x.push('<autoFilter ref="A1:L' + oxirgi + '"/>');
    x.push('<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>');
    x.push('</worksheet>');
    return x.join('');
  }

  // Matn hujayrasi: doim matn turida (t="s"); bo'sh bo'lsa yozilmaydi. "=", "+", "-", "@" bilan boshlansa — himoyali stil (quotePrefix)
  function matnHujayra(ust, qator, qiymat, ulashgan, stil) {
    if (qiymat === undefined || qiymat === null || qiymat === '') return '';
    var s = String(qiymat), himoya = /^[=+\-@\t\r]/.test(s), st = himoya ? S_MATN_HIMOYALI : stil;   // himoyali stil formula bo'lib ketishdan saqlaydi
    return '<c r="' + hujayraHavolasi(ust, qator) + '"' + (st ? ' s="' + st + '"' : '') + ' t="s"><v>' + ulashgan(s, himoya) + '</v></c>';
  }

  var STILLAR = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="2"><numFmt numFmtId="164" formatCode="dd\\.mm\\.yyyy\\ hh:mm"/><numFmt numFmtId="165" formatCode="dd\\.mm\\.yyyy"/></numFmts>' +
    '<fonts count="4"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>' +
    '<font><sz val="11"/><color rgb="FFC62828"/><name val="Calibri"/><family val="2"/></font><font><sz val="11"/><color rgb="FF2E7D32"/><name val="Calibri"/><family val="2"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF263238"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="9">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top"/></xf>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left" vertical="top"/></xf>' +
    '<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf>' +
    '<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1" quotePrefix="1"><alignment vertical="top"/></xf>' +
    '<xf numFmtId="3" fontId="2" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf>' +
    '<xf numFmtId="3" fontId="3" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left" vertical="top"/></xf>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  function ommaviy(eksport) {
    var indeks = {}, royxat = [], jami = 0;
    function ulashgan(s) {
      jami++;
      if (indeks[s] === undefined) { indeks[s] = royxat.length; royxat.push(s); }
      return indeks[s];
    }
    var varaq = varaqXml(eksport, ulashgan);
    var ss = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="' + jami + '" uniqueCount="' + royxat.length + '">' +
      royxat.map(function (s) { return '<si><t xml:space="preserve">' + xmlMatn(s) + '</t></si>'; }).join('') + '</sst>';
    var oxirgi = eksport.qatorlar.length + 1;
    var kitob = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000"/></bookViews>' +
      '<sheets><sheet name="' + VARAQ_NOMI + '" sheetId="1" r:id="rId1"/></sheets>' +
      '<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">' + VARAQ_NOMI + '!$A$1:$L$' + oxirgi + '</definedName></definedNames></workbook>';
    return [
      ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>'],
      ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ['xl/workbook.xml', kitob],
      ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>'],
      ['xl/worksheets/sheet1.xml', varaq],
      ['xl/styles.xml', STILLAR],
      ['xl/sharedStrings.xml', ss]
    ];
  }

  // ---- ZIP (siqmasdan: "store") ----
  var CRC_JADVAL = (function () {
    var t = [], c, n, k;
    for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(b) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < b.length; i++) c = CRC_JADVAL[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function u16(a, v) { a.push(v & 255, (v >>> 8) & 255); }
  function u32(a, v) { a.push(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255); }

  // fayllar: [[nom, matn], ...] -> Uint8Array (UTF-8 nomlar; sana belgisi: 2026-01-01 00:00)
  function zip(fayllar) {
    var kodlagich = new TextEncoder(), qismlar = [], markaz = [], siljish = 0, DOS_SANA = ((2026 - 1980) << 9) | (1 << 5) | 1;
    fayllar.forEach(function (f) {
      var nom = kodlagich.encode(f[0]), tana = kodlagich.encode(f[1]), crc = crc32(tana), h = [];
      u32(h, 0x04034b50); u16(h, 20); u16(h, 0x0800); u16(h, 0); u16(h, 0); u16(h, DOS_SANA); u32(h, crc); u32(h, tana.length); u32(h, tana.length); u16(h, nom.length); u16(h, 0);
      qismlar.push(new Uint8Array(h), nom, tana);
      var m = [];
      u32(m, 0x02014b50); u16(m, 20); u16(m, 20); u16(m, 0x0800); u16(m, 0); u16(m, 0); u16(m, DOS_SANA); u32(m, crc); u32(m, tana.length); u32(m, tana.length); u16(m, nom.length); u16(m, 0); u16(m, 0); u16(m, 0); u16(m, 0); u32(m, 0); u32(m, siljish);
      markaz.push(new Uint8Array(m), nom);
      siljish += h.length + nom.length + tana.length;
    });
    var markazHajmi = markaz.reduce(function (s, b) { return s + b.length; }, 0), oxir = [];
    u32(oxir, 0x06054b50); u16(oxir, 0); u16(oxir, 0); u16(oxir, fayllar.length); u16(oxir, fayllar.length); u32(oxir, markazHajmi); u32(oxir, siljish); u16(oxir, 0);
    var hammasi = qismlar.concat(markaz, [new Uint8Array(oxir)]), jami = hammasi.reduce(function (s, b) { return s + b.length; }, 0), natija = new Uint8Array(jami), o = 0;
    hammasi.forEach(function (b) { natija.set(b, o); o += b.length; });
    return natija;
  }

  function fayl(eksport) { return zip(ommaviy(eksport)); }

  return { fayl: fayl, zip: zip, crc32: crc32, seriya: seriya, VARAQ_NOMI: VARAQ_NOMI };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Xlsx;
