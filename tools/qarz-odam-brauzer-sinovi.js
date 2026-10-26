// Qarzlar ekrani: odam qatorlari, jami, filtr, qidiruv (TZ-sinxronlash.md 45-band) uchun brauzer sinovi: HAQIQIY ilova, faqat UYDIRMA ma'lumot.
// Faqat ishlab chiqish vaqtida; ilovaning o'zi uni ishlatmaydi.
// Ishga tushirish: avval  python3 -m http.server 8000  (repozitoriy papkasida), keyin  node tools/qarz-odam-brauzer-sinovi.js [rasmlar_papkasi]
// (PLAYWRIGHT_MODULE, CHROMIUM_PATH, ILOVA_MANZIL ixtiyoriy). 360 px, yorug' va qorong'i rejim. Xato bo'lsa chiqish kodi 1.
const fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const MANZIL = process.env.ILOVA_MANZIL || 'http://localhost:8000/index.html';
const RASMLAR = process.argv[2] || path.join(os.tmpdir(), 'qarz-odam-rasmlar');
fs.mkdirSync(RASMLAR, { recursive: true });
let jami = 0, xatolar = 0;
function teng(h, k, izoh) { jami++; if (JSON.stringify(h) !== JSON.stringify(k)) { xatolar++; console.log('  ✗ ' + izoh + ' — kutilgan: ' + JSON.stringify(k) + ', chiqdi: ' + JSON.stringify(h)); } }
const bo = (s) => String(s).replace(/\s+/g, ' ').trim();

async function senariy(brauzer, tema) {
  console.log('== ' + tema + ' rejim, 360 px ==');
  const kontekst = await brauzer.newContext({ viewport: { width: 360, height: 780 }, colorScheme: tema, serviceWorkers: 'block' });
  const p = await kontekst.newPage();
  p.on('pageerror', (e) => { if (!/IDBObjectStore/.test(e.message)) { xatolar++; console.log('  ✗ PAGEERROR ' + e.message); } });
  await p.addInitScript(() => { window.bo = (s) => String(s).replace(/\s+/g, ' ').trim(); });
  await p.goto(MANZIL);
  await p.waitForFunction(() => typeof Data !== 'undefined' && document.querySelector('#ekran h1'));
  if (await p.locator('#salom-davom').count()) { await p.click('#salom-davom'); await p.waitForSelector('#salom-ekran', { state: 'detached' }); }
  const rasm = (n) => p.screenshot({ path: path.join(RASMLAR, tema + '-' + n + '.png') });
  const olchov = async (i) => teng(await p.evaluate(() => document.documentElement.scrollWidth <= 360), true, i + ': gorizontal aylanish yo\'q');
  const ismlar = () => p.evaluate(() => [...document.querySelectorAll('#qarz-royxat .odam-qator')].map((b) => b.getAttribute('data-shaxs')));
  const qarzlarga = async () => { await p.click('[data-bolim="qarzlar"]'); await p.waitForSelector('.qarz-tanlov'); };
  const chipHolati = () => p.evaluate(() => [...document.querySelectorAll('.qarz-chip')].map((b) => b.getAttribute('data-filtr') + ':' + b.getAttribute('aria-pressed')));
  const sahifa = () => p.evaluate(() => document.querySelector('#ekran h1') ? document.querySelector('#ekran h1').textContent : '');

  // ---- uydirma ma'lumot (sanalar bugunga nisbatan) ----
  await p.evaluate(async () => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    await Data.saqlash('hisoblar', { yaratilgan: new Date().toISOString(), nom: 'Karta A', tur: 'karta', belgi: 'karta', rang: '#2F5DDB', oxirgi4: '', boshlangich_qoldiq: 1000000, arxivlangan: false });
    const h = (await Data.hammasi('hisoblar'))[0];
    const q = (yo, sh, sum, sana, muddat, tolov) => Data.saqlash('qarzlar', { yaratilgan: new Date().toISOString(), yonalish: yo, shaxs: sh, summa: sum, hisob_id: h.id, sana: iso(sana), vaqt: '10:00', muddat: muddat === null ? '' : iso(muddat), izoh: '', tolovlar: tolov ? [{ id: Data.yangiId(), sana: iso(sana), vaqt: '11:00', summa: tolov, hisob_id: h.id }] : [], yopilgan: false });
    await q('berdim', 'Ali', 1000000, -30, -2);          // muddati 2 kun o'tgan
    await q('berdim', 'Ali', 600000, -20, 3, 300000);    // shu hafta, qisman qaytarilgan
    await q('berdim', 'Vali', 300000, -10, 6);           // shu hafta (+6)
    await q('berdim', 'Bek', 10000, -5, 30);             // keyinroq
    await q('berdim', 'Zuhra', 20000, -3, null);         // muddatsiz
    await q('berdim', 'Sardor', 80000, -40, -35, 80000); // yopilgan
    await q('oldim', 'Olim', 70000, -4, null);
  });
  await p.reload(); await p.waitForFunction(() => document.querySelector('#ekran h1'));
  await qarzlarga();

  // ---- 1) Jami kartasi ----
  const jamiMatn = await p.evaluate(() => [...document.querySelectorAll('.qarz-jami .qj-ustun')].map((u) => bo(u.innerText)));
  teng(jamiMatn.map((x) => x.replace(/\s+/g, ' ')), ['Qaytarilishi kerak 1 630 000 so\'m', 'Muddati o\'tgan 1 000 000 so\'m'], 'jami kartasi (butun tur, filtrsiz)');
  teng(await p.evaluate(() => { const o = document.querySelector('.qj-summa.otgan'), f = parseFloat(getComputedStyle(o).fontSize); return [f <= 20 && f >= 14, getComputedStyle(o).color !== getComputedStyle(document.querySelector('.qj-summa')).color]; }), [true, true], 'jami summa (20 px, sig\'masa 14 px gacha kichrayadi), muddati o\'tgan rangli');
  teng(await p.evaluate(() => { const k = document.querySelector('.qarz-jami'), a = k.querySelectorAll('.qj-ustun'); return [getComputedStyle(a[1]).borderLeftWidth, a[0].getBoundingClientRect().width > 100 && a[1].getBoundingClientRect().width > 100]; }), ['1px', true], 'ikki ustun, o\'rtada chiziq');
  // ---- 2) Chiplar ----
  teng(await p.evaluate(() => [...document.querySelectorAll('.qarz-chip')].map((b) => bo(b.innerText))), ['Hammasi', 'Muddati o\'tgan 1', 'Shu hafta 2'], 'chiplar va sonlar (qarzlar soni: Ali 2-qarzi, Vali)');
  teng(await chipHolati(), ['hammasi:true', 'otgan:false', 'hafta:false'], 'boshlang\'ich chip');
  teng(await p.evaluate(() => [...document.querySelectorAll('.qarz-chip, .qarz-qidiruv-tugma')].map((b) => [Math.round(b.getBoundingClientRect().height) >= 44, Math.round(b.querySelector('.qarz-chip-ich').getBoundingClientRect().height)])), [[true, 36], [true, 36], [true, 36], [true, 36]], 'chip va qidiruv tugmasi: ≥ 44 px bosish maydoni, ko\'rinishi 36 px');
  teng(await p.evaluate(() => { const b = document.querySelector('.qarz-chip[aria-pressed="true"] .qarz-chip-ich'); return getComputedStyle(b).backgroundColor !== 'rgba(0, 0, 0, 0)'; }), true, '"Hammasi" to\'ldirilgan');
  teng(await p.evaluate(() => { const r = document.querySelector('.qarz-chip-qator').getBoundingClientRect(), t = document.querySelector('.qarz-qidiruv-tugma').getBoundingClientRect(); return t.right <= 360 && r.right <= 360 && !!document.querySelector('.qarz-qidiruv-tugma svg'); }), true, 'qidiruv tugmasi ekranda, ikon bor');
  teng(await p.evaluate(() => { const c = document.querySelector('.qarz-chip-qator').getBoundingClientRect(), t = document.querySelector('#qarz-tartib').getBoundingClientRect(), r = document.querySelector('#qarz-royxat').getBoundingClientRect(); return [c.bottom <= t.top, t.bottom <= r.top, t.right > 180]; }), [true, true, true], 'tartib: chiplar ostida o\'ngda, ro\'yxat ustida');
  await olchov('chiplar'); await rasm('1-royxat');

  // ---- 3) Odam qatorlari (muddat bo'yicha tartib) ----
  teng(await ismlar(), ['Ali', 'Vali', 'Bek', 'Zuhra'], 'bitta qator = bitta odam (Sardor yopilgan)');
  const ali = await p.evaluate(() => { const b = document.querySelector('.odam-qator[data-shaxs="Ali"]'), a = b.querySelector('.odam-avatar'); const r = a.getBoundingClientRect(); return { harf: a.textContent, olcham: [Math.round(r.width), Math.round(r.height)], radius: getComputedStyle(a).borderRadius, fon: getComputedStyle(a).backgroundColor, ism: [b.querySelector('.odam-ism').textContent, getComputedStyle(b.querySelector('.odam-ism')).fontSize], belgi: b.querySelector('.odam-pill').textContent, pill: b.querySelector('.odam-pill').className, soni: b.querySelector('.odam-soni').textContent, summa: b.querySelector('.odam-summa').textContent, chevron: !!b.querySelector('.odam-ong svg'), h: Math.round(b.getBoundingClientRect().height) }; });
  teng([ali.harf, ali.olcham, ali.radius, ali.ism, ali.belgi, ali.pill, ali.soni, ali.summa, ali.chevron, ali.h >= 44], ['A', [42, 42], '50%', ['Ali', '15px'], '1 ta muddati o\'tgan', 'odam-pill qizil', '· 2 ta qarz', '1 300 000 so\'m', true, true], 'Ali qatori');
  const belgilar = await p.evaluate(() => [...document.querySelectorAll('.odam-qator')].map((b) => bo(b.querySelector('.odam-belgilar').innerText)));
  teng(belgilar[0], '1 ta muddati o\'tgan · 2 ta qarz', 'ustuvorlik: muddati o\'tgan');
  teng(/^\d+-[a-zʻ'’]+ · (\d kun|bugun) · 1 ta qarz$/.test(belgilar[1]), true, 'shu hafta: "29-oktabr · 3 kun" — ' + belgilar[1]);
  teng(/^Muddat: \d+-\S+ · 1 ta qarz$/.test(belgilar[2]), true, 'muddatli: oddiy matn — ' + belgilar[2]);
  teng(belgilar[3], 'Muddatsiz · 1 ta qarz', 'muddatsiz');
  teng(await p.evaluate(() => document.querySelector('.odam-qator[data-shaxs="Vali"] .odam-pill').className), 'odam-pill sariq', 'shu hafta: sariq pill');
  teng(await p.evaluate(() => { const a = document.querySelector('.odam-qator[data-shaxs="Ali"] .odam-avatar'), b = document.querySelector('.odam-qator[data-shaxs="Vali"] .odam-avatar'); return [a.style.background === b.style.background, ['rgb(15, 143, 111)', 'rgb(47, 93, 219)', 'rgb(180, 0, 208)', 'rgb(224, 138, 0)', 'rgb(229, 72, 61)', 'rgb(0, 163, 163)'].indexOf(getComputedStyle(a).backgroundColor) >= 0]; }), [false, true], 'avatar rangi palitradan');
  teng(await p.evaluate(() => getComputedStyle(document.querySelector('.odam-qator .odam-avatar')).color), 'rgb(255, 255, 255)', 'oq harf');

  // ---- 4) Chip filtri ----
  await p.click('.qarz-chip[data-filtr="otgan"]');
  teng(await ismlar(), ['Ali'], 'o\'tgan filtri'); teng(await chipHolati(), ['hammasi:false', 'otgan:true', 'hafta:false'], 'o\'tgan chip tanlangan');
  teng(await p.evaluate(() => [document.querySelector('.odam-qator .odam-summa').textContent, document.querySelector('.odam-qator .odam-soni').textContent]), ['1 000 000 so\'m', '· 1 ta qarz'], 'qatordagi summa va soni faqat mos qarz');
  teng((await p.evaluate(() => bo(document.querySelector('.qarz-jami').innerText))).includes('1 630 000'), true, 'jami kartasi filtrga bog\'liq emas');
  await p.click('.qarz-chip[data-filtr="hafta"]');
  teng(await ismlar(), ['Ali', 'Vali'], 'shu hafta filtri'); teng(await p.evaluate(() => document.querySelector('.odam-qator .odam-summa').textContent), '300 000 so\'m', 'Ali: faqat haftadagi qarzi (600 000 − 300 000)');
  await rasm('2-filtr-hafta');

  // ---- 5) Qidiruv ----
  await p.click('.qarz-qidiruv-tugma');
  teng(await p.evaluate(() => [document.activeElement.id, document.activeElement.placeholder, !!document.querySelector('.qarz-qidiruv-yopish'), !document.querySelector('.qarz-chip')]), ['qarz-qidiruv', 'Ism bo\'yicha qidirish', true, true], 'qidiruv ochildi: avtofokus, placeholder, yopish tugmasi');
  teng(await p.evaluate(() => Math.round(document.querySelector('#qarz-qidiruv').getBoundingClientRect().height) >= 44 && Math.round(document.querySelector('.qarz-qidiruv-yopish').getBoundingClientRect().height) >= 44), true, 'qidiruv elementlari ≥ 44 px');
  await p.keyboard.type(' A L ');
  teng(await ismlar(), ['Ali', 'Vali'], 'qidiruv + chip birga ("ichida bor", bo\'shliqqa befarq)');
  teng(await p.evaluate(() => document.activeElement.id), 'qarz-qidiruv', 'yozganda fokus yo\'qolmaydi');
  await p.fill('#qarz-qidiruv', 'zzz');
  teng(await p.evaluate(() => [bo(document.querySelector('.odam-bosh-holat').innerText), !!document.querySelector('.odam-bosh-holat svg'), document.querySelectorAll('.odam-qator').length]), ['Hech narsa topilmadi Filtrni tozalash', true, 0], 'hech narsa topilmadi');
  await olchov('qidiruv'); await rasm('3-topilmadi');
  await p.click('.odam-bosh-holat .matn-tugma');
  teng([await ismlar(), await chipHolati()], [['Ali', 'Vali', 'Bek', 'Zuhra'], ['hammasi:true', 'otgan:false', 'hafta:false']], 'filtrni tozalash: chip va qidiruv tiklandi');
  await p.click('.qarz-qidiruv-tugma'); await p.keyboard.type('zuh');
  teng(await ismlar(), ['Zuhra'], 'qidiruv: Zuhra');
  await p.click('.qarz-qidiruv-yopish');
  teng([await ismlar(), await p.locator('.qarz-chip').count()], [['Ali', 'Vali', 'Bek', 'Zuhra'], 3], 'yopish: qidiruv tozalanadi, chiplar qaytadi');
  await p.click('.qarz-chip[data-filtr="otgan"]'); await p.click('.qarz-chip[data-filtr="hafta"]'); await p.click('.qarz-chip[data-filtr="otgan"]');
  // ---- 6) "Bu filtr bo'yicha qarz yo'q" ----
  await p.click('[data-tanlov="oldim"]');
  teng([await ismlar(), await chipHolati()], [['Olim'], ['hammasi:true', 'otgan:false', 'hafta:false']], 'tab almashdi: chip Hammasi, ro\'yxat Olingan');
  await p.click('.qarz-chip[data-filtr="hafta"]');
  teng(await p.evaluate(() => bo(document.querySelector('.odam-bosh-holat').innerText)), 'Bu filtr bo\'yicha qarz yo\'q', 'filtrga mos yo\'q');
  teng(await p.evaluate(() => bo(document.querySelector('.qarz-jami').innerText)), 'To\'lashingiz kerak 70 000 so\'m Muddati o\'tgan 0', 'Olingan: "To\'lashingiz kerak", muddati o\'tgan yo\'q — "0"');
  teng(await p.evaluate(() => getComputedStyle(document.querySelector('.qj-summa.nol')).color !== getComputedStyle(document.querySelector('.qj-summa')).color), true, '"0" kulrang');
  await rasm('4-olingan');
  await p.click('[data-tanlov="berdim"]');
  teng(await chipHolati(), ['hammasi:true', 'otgan:false', 'hafta:false'], 'qaytganda ham chip tiklanadi');

  // ---- 7) Bitta qarzli odam: to'g'ridan-to'g'ri tafsilot ----
  await p.click('.odam-qator[data-shaxs="Vali"]');
  await p.waitForSelector('.qarz-tafsilot');
  teng(await sahifa(), 'Vali', 'bitta qarz: qarz tafsiloti ochildi (odam ekrani emas)');
  teng(await p.locator('.odam-ekran-bosh').count(), 0, 'odam ekrani yo\'q');
  await p.click('.orqaga-tugma'); await p.waitForSelector('.qarz-tanlov');

  // ---- 8) Odam ekrani (Ali: 2 ta qarz); holat orqaga qaytganda saqlanadi ----
  await p.click('.qarz-chip[data-filtr="hafta"]');
  await p.click('.odam-qator[data-shaxs="Ali"]');
  await p.waitForSelector('.odam-ekran-bosh');
  teng(await p.evaluate(() => { const a = document.querySelector('.odam-ekran-bosh .odam-avatar'), n = document.querySelector('.odam-ekran-ism'); return [Math.round(a.getBoundingClientRect().width), n.textContent, getComputedStyle(n).fontSize, bo(document.querySelector('.odam-ekran-matn .xira').innerText), !!document.querySelector('.orqaga-tugma')]; }),
    [42, 'Ali', '17px', 'Berilgan qarzlar · 2 ta', true], 'odam ekrani tepasi');
  teng(await p.evaluate(() => [...document.querySelectorAll('.odam-jami .qj-ustun')].map((u) => bo(u.innerText))), ['Jami qolgan 1 300 000 so\'m', 'Muddati o\'tgan 1 000 000 so\'m'], 'odam jami kartasi');
  teng(await p.evaluate(() => [!!document.querySelector('.odam-jami .qarz-chiziq'), bo(document.querySelector('.odam-jami-matn').innerText)]), [true, 'Jami berilgan 1 600 000 · qaytarilgan 300 000 (19%)'], 'progress va matn');
  teng(await p.evaluate(() => { const b = document.querySelector('#odam-yangi-qarz'); return [b.textContent, Math.round(b.getBoundingClientRect().height) >= 44, Math.round(b.getBoundingClientRect().width) > 300]; }), ['Yangi qarz', true, true], '"Yangi qarz" tugmasi to\'liq kenglikda');
  teng(await p.evaluate(() => bo(document.querySelector('.odam-qarzlar h2').innerText)), 'Qarzlar (muddat bo\'yicha)', 'sarlavha tartib nomi bilan');
  const qatorlar = await p.evaluate(() => [...document.querySelectorAll('.odam-qarz')].map((b) => ({ sana: b.querySelector('.odam-qarz-sana').textContent, belgi: b.querySelector('.odam-pill, .odam-matn').className + '|' + bo(b.querySelector('.odam-pill, .odam-matn').innerText), progress: !!b.querySelector('.qarz-chiziq'), tolangan: b.querySelector('.odam-kichik') && b.querySelector('.odam-kichik').textContent, summa: b.querySelector('.odam-summa').textContent, qolgan: [...b.querySelectorAll('.odam-kichik')].pop().textContent, h: Math.round(b.getBoundingClientRect().height) })));
  teng(qatorlar.length, 2, 'ikkita ochiq qarz');
  teng([qatorlar[0].summa, qatorlar[0].progress, qatorlar[0].qolgan], ['1 000 000 so\'m', false, 'qolgan'], '1-qator: muddati o\'tgan, qaytarilmagan');
  teng(/^odam-pill qizil\|2 kun o'tgan · \d+-\S+$/.test(qatorlar[0].belgi), true, 'qizil pill "2 kun o\'tgan · …" — ' + qatorlar[0].belgi);
  teng([qatorlar[1].summa, qatorlar[1].progress, qatorlar[1].tolangan], ['300 000 so\'m', true, '300 000 so\'m qaytarilgan'], '2-qator: qisman qaytarilgan');
  teng(/^odam-pill sariq\|3 kun qoldi · \d+-\S+$/.test(qatorlar[1].belgi), true, 'sariq pill "3 kun qoldi · …" — ' + qatorlar[1].belgi);
  await olchov('odam ekrani'); await rasm('5-odam-ekrani');
  // yangi qarz: ism tayyor, yo'nalish bir xil; orqaga — odam ekrani
  await p.click('#odam-yangi-qarz'); await p.waitForSelector('#q-shaxs');
  teng(await p.evaluate(() => [document.querySelector('#q-shaxs').value, document.querySelector('[data-yonalish="berdim"]').getAttribute('aria-pressed')]), ['Ali', 'true'], 'Yangi qarz: ism tayyor, yo\'nalish Berilgan');
  await olchov('yangi qarz formasi');
  await p.click('.orqaga-tugma'); await p.waitForSelector('.odam-ekran-bosh');
  // qarz tafsiloti va orqaga
  await p.click('.odam-qarz >> nth=1'); await p.waitForSelector('.qarz-tafsilot');
  teng(await sahifa(), 'Ali', 'qarz tafsiloti ochildi');
  await p.click('.orqaga-tugma'); await p.waitForSelector('.odam-ekran-bosh');
  // odam ekranidan orqaga: ro'yxat holati saqlangan (chip: hafta)
  await p.click('.orqaga-tugma'); await p.waitForSelector('.qarz-tanlov');
  teng(await chipHolati(), ['hammasi:false', 'otgan:false', 'hafta:true'], 'odam ekranidan qaytganda chip holati saqlangan');
  await p.click('.qarz-chip[data-filtr="hammasi"]');

  // ---- 9) Oxirgi qarz o'chirilsa odam ekrani ro'yxatga qaytadi ----
  await p.click('.odam-qator[data-shaxs="Ali"]'); await p.waitForSelector('.odam-ekran-bosh');
  await p.click('.odam-qarz >> nth=0'); await p.waitForSelector('.qarz-tafsilot'); await p.click('.xavfli-tugma');
  await p.waitForSelector('.odam-ekran-bosh');
  teng(await p.evaluate(() => bo(document.querySelector('.odam-ekran-matn .xira').innerText)), 'Berilgan qarzlar · 1 ta', 'bitta qarz o\'chdi, odam ekrani qoldi');
  await p.click('.odam-qarz >> nth=0'); await p.waitForSelector('.qarz-tafsilot'); await p.click('.xavfli-tugma');
  await p.waitForSelector('.qarz-tanlov');
  teng([await p.locator('.odam-ekran-bosh').count(), await ismlar()], [0, ['Vali', 'Bek', 'Zuhra']], 'oxirgi qarz o\'chdi: avtomatik ro\'yxatga qaytdi');
  await rasm('6-oxirida');

  await kontekst.close();
}

(async () => {
  const brauzer = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const t of ['light', 'dark']) await senariy(brauzer, t);
  await brauzer.close();
  console.log(jami + ' tekshiruv, ' + xatolar + ' xato. Rasmlar: ' + RASMLAR);
  process.exit(xatolar ? 1 : 0);
})();
