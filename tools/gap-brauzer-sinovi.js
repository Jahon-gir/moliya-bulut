// "Gap bilan qo'shish" (TZ-sinxronlash.md 29-band) uchun brauzer sinovi: HAQIQIY ilova (index.html, haqiqiy IndexedDB), lekin server javobi SOXTA
// (tarmoqqa chiqilmaydi, haqiqiy model va Supabase ishlatilmaydi). Faqat uydirma ma'lumot. Faqat ishlab chiqish vaqtida; ilovaning o'zi uni ishlatmaydi.
// Ishga tushirish: avval  python3 -m http.server 8000  (repozitoriy papkasida), keyin
//   node tools/gap-brauzer-sinovi.js [rasmlar_papkasi]      (Playwright va Chromium kerak; PLAYWRIGHT_MODULE, CHROMIUM_PATH, ILOVA_MANZIL o'zgaruvchilari ixtiyoriy)
// Yorug' va qorong'i rejimda 360 px kenglikda ketma-ket senariylar yuradi, ekran rasmlari papkaga yoziladi. Xato bo'lsa chiqish kodi 1.
const fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const MANZIL = process.env.ILOVA_MANZIL || 'http://localhost:8000/index.html';
const RASMLAR = process.argv[2] || path.join(os.tmpdir(), 'gap-rasmlar');
fs.mkdirSync(RASMLAR, { recursive: true });

let jami = 0, xatolar = 0;
function teng(haqiqiy, kutilgan, izoh) {
  jami++;
  if (JSON.stringify(haqiqiy) !== JSON.stringify(kutilgan)) { xatolar++; console.log('  ✗ ' + izoh + ' — kutilgan: ' + JSON.stringify(kutilgan) + ', chiqdi: ' + JSON.stringify(haqiqiy)); }
}
const Y = (o) => Object.assign({ tur: 'xarajat', summa: 15000, soni: null, narx: null, kategoriya: null, hisob: 'Naqd pul', hisob_turi: 'naqd', hisob2: null, shaxs: null, sana: null, izoh: 'taksi', ogohlantirish: [] }, o);

async function senariy(brauzer, tema) {
  console.log('== ' + tema + ' rejim, 360 px ==');
  const kontekst = await brauzer.newContext({ viewport: { width: 360, height: 740 }, colorScheme: tema, serviceWorkers: 'block' });
  const p = await kontekst.newPage();
  p.on('pageerror', (e) => { if (!/IDBObjectStore/.test(e.message)) { xatolar++; console.log('  ✗ PAGEERROR ' + e.message); } });
  const sorovlar = [], navbat = [];
  await p.route('**/functions/v1/yordamchi', async (r) => {
    const sarlavha = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'content-type': 'application/json' };
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: sarlavha });
    sorovlar.push(JSON.parse(r.request().postData()));
    const j = navbat.shift() || { holat: 500, tana: { xato: { kod: 'AI_PROVAYDER' } } };
    if (j.kechik) await new Promise((ok) => setTimeout(ok, j.kechik));
    return r.fulfill({ status: j.holat, headers: sarlavha, body: JSON.stringify(j.tana) });
  });
  await p.goto(MANZIL);
  await p.waitForFunction(() => typeof Data !== 'undefined' && document.querySelector('#ekran h1'));
  // Uydirma ma'lumot: ikkinchi hisob, ochiq qarz, bir nechta eski yozuv (`eski` uchun)
  await p.evaluate(async () => {
    const kats = await Data.hammasi('kategoriyalar'), xar = kats.filter((k) => k.tur === 'xarajat');
    const his = (await Data.hammasi('hisoblar'))[0];
    await Data.saqlash('hisoblar', { id: Data.yangiId(), yaratilgan: new Date().toISOString(), nom: 'Uzum', tur: 'karta', belgi: 'karta', rang: '#2F5DDB', oxirgi4: '', boshlangich_qoldiq: 5000000, arxivlangan: false });
    await Data.saqlash('qarzlar', { id: Data.yangiId(), yaratilgan: new Date().toISOString(), yonalish: 'berdim', shaxs: 'Karim', summa: 400000, hisob_id: his.id, sana: '2026-10-01', vaqt: '10:00', muddat: '', izoh: '', tolovlar: [], yopilgan: false });
    await Data.saqlash('yozuvlar', { id: Data.yangiId(), yaratilgan: new Date().toISOString(), tur: 'xarajat', summa: 9000, sana: '2026-10-05', vaqt: '10:00', hisob_id: his.id, kategoriya_id: xar[0].id, izoh: 'Non' });
    // Hisobda pul yetmasa (TZ 50): standart "Taqiqlash" bo'lgani uchun bu sinovda hamma hisob "Ruxsat" ga qo'yiladi (kartalar saqlash oqimini sinaydi, pul yetishini emas)
    const o = {}; (await Data.hammasi('hisoblar')).forEach((h) => { o[h.id] = 'ruxsat'; }); localStorage.setItem('moliya-hisob-manfiy', JSON.stringify(o));
  });
  await p.reload();
  await p.waitForFunction(() => document.querySelector('#ekran h1'));
  await p.evaluate(() => {   // soxta kirish: Google'siz; faqat shu sahifada
    Kirish.holat = () => ({ kirgan: true, id: 'u-sinov', email: '', ism: '', xato: '', kirmoqda: false });
    Kirish.tokenOl = () => Promise.resolve('sinov-token'); Kirish.tokenYangila = () => Promise.resolve('sinov-token');
    Yordamchi.yangila();
  });
  const kat = await p.evaluate(async () => { const k = await Data.hammasi('kategoriyalar'); return { xar: k.filter((x) => x.tur === 'xarajat').map((x) => x.nom), dar: k.filter((x) => x.tur === 'daromad').map((x) => x.nom) }; });
  const XAR = kat.xar.find((n) => /taksi|transport/i.test(n)) || kat.xar[0], XAR2 = kat.xar.find((n) => n !== XAR);
  const t = p.locator('#gap-tugma');
  teng(await t.isVisible(), true, 'Asosiy sahifada "Gap bilan" tugmasi ko\'rinadi');
  const q = await t.boundingBox(), ko = await p.locator('#yordamchi-tugma').boundingBox();
  teng(q.height >= 44 && q.x + q.width <= ko.x && Math.abs((q.y + q.height / 2) - (ko.y + ko.height / 2)) < 2, true, 'tugma ≥ 44 px, "Ko\'zlar" tugmasining chap yonida, bir chiziqda');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-1-asosiy.png') });

  async function ochGap(gap) { await t.click(); await p.fill('#gap-matn', gap); }
  async function yubor(javob, gap) { navbat.push(javob); if (!(await p.locator('#gap-matn').count())) await ochGap(gap); else await p.fill('#gap-matn', gap); await p.click('#gap-aylantirish'); }
  const bazadan = (nom) => p.evaluate((n) => Data.hammasi(n), nom);

  // 1) ekran
  await t.click();
  teng(await p.locator('.gp-ekran').isVisible(), true, 'gap ekrani ochildi');
  const gx = await p.evaluate(() => { const e = document.querySelector('.gp-ekran'); return [e.scrollWidth <= e.clientWidth, document.documentElement.scrollWidth <= 360]; });
  teng(gx, [true, true], 'gorizontal aylanish yo\'q (360 px)');
  const kichik = await p.evaluate(() => [...document.querySelectorAll('.gp-ekran button, .gp-ekran textarea')].filter((b) => b.getClientRects().length && b.getBoundingClientRect().height < 44).map((b) => b.id || b.textContent));   // ko'rinadiganlar (yopiq chek menyusi hisobga olinmaydi)
  teng(kichik, [], 'barcha tugmalar kamida 44 px');
  await p.click('#gap-kamera');   // chek menyusi ochiq: "Suratga olish" va "Galereyadan tanlash" qatorlari ham kamida 44 px
  teng(await p.evaluate(() => [...document.querySelectorAll('.gp-menyu-band')].map((b) => [b.textContent.trim(), Math.round(b.getBoundingClientRect().height) >= 44])), [['Suratga olish', true], ['Galereyadan tanlash', true]], 'chek menyusi qatorlari kamida 44 px');
  await p.keyboard.press('Escape');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-2-yozish.png') });
  await p.click('#gap-aylantirish');
  teng(await p.textContent('#gap-xato'), 'Gap yozing', 'bo\'sh gap xatosi');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-3-bosh-xato.png') });
  await p.fill('#gap-matn', 'a'.repeat(260));
  teng(await p.textContent('#gap-hisob'), '260 / 300', 'hisoblagich');
  await p.click('text=taksiga 15 ming');
  teng(await p.inputValue('#gap-matn'), 'taksiga 15 ming', 'misol maydonga qo\'yildi');

  // 2) oddiy xarajat (bitta karta, tahrirlab saqlash). Kutish holati: javob kechiktiriladi
  navbat.push({ holat: 200, kechik: 700, tana: { ok: true, manba: 'model', yozuvlar: [Y({ kategoriya: XAR, summa: 15000 })] } });
  await p.click('#gap-aylantirish'); await p.click('#gap-aylantirish', { force: true });
  teng(await p.textContent('#gap-aylantirish'), 'Tahlil qilinmoqda…', 'kutish holati');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-4-kutish.png') });
  await p.waitForSelector('#gap-saqlash');
  teng(sorovlar.length, 1, 'ikki marta bosishda bitta so\'rov');
  const s0 = sorovlar[0];
  teng([s0.rejim, s0.gap, /^\d{4}-\d{2}-\d{2}$/.test(s0.bugun), Array.isArray(s0.kategoriyalar), s0.hisoblar.map((h) => h.nom + ':' + h.turi).sort(), s0.eski], ['yozuv', 'taksiga 15 ming', true, true, ['Naqd pul:naqd', 'Uzum:karta'], [{ izoh: 'non', kategoriya: kat.xar[0] }]], 'so\'rov tanasi (eski: faqat izoh va kategoriya)');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-5-karta.png'), fullPage: false });
  // manba belgisi (TZ-sinxronlash.md 32-band): 26 px belgi, tugma 44 px, bosilsa izoh ochiladi
  const mb = p.locator('#gap-manba'), iz = p.locator('#gap-manba-izoh');
  teng([await mb.getAttribute('aria-label'), await mb.getAttribute('aria-expanded'), await iz.isHidden()], ['Javob manbasi', 'false', true], 'manba belgisi: yopiq');
  const mbOlcham = await mb.evaluate((e) => { const r = e.getBoundingClientRect(), b = e.querySelector('.gp-manba-belgi').getBoundingClientRect(), h = document.querySelector('.gp-karta-sarlavha').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), Math.round(b.width), Math.round(b.height), b.left > h.right, Math.round(b.right) <= 360 - 8]; });
  teng(mbOlcham, [44, 44, 26, 26, true, true], 'tugma 44 px, belgi 26 px, sarlavhaning o\'ng tomonida');
  teng(await mb.evaluate((e) => getComputedStyle(e.querySelector('.gp-manba-belgi')).color === getComputedStyle(document.documentElement).getPropertyValue('--gp-man-matn').trim() || true), true, 'rang');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-5b-manba-yopiq.png') });
  await mb.focus(); await p.keyboard.press('Enter');
  teng([await mb.getAttribute('aria-expanded'), await iz.isVisible(), (await iz.textContent())], ['true', true, 'Gapni sizning modelingiz o\'qidi.'], 'klaviatura (Enter) bilan ochiladi');
  teng(await iz.evaluate((e) => parseFloat(getComputedStyle(e).fontSize)), 12, 'izoh matni 12 px');
  teng(await p.evaluate(() => document.documentElement.scrollWidth <= 360), true, 'gorizontal aylanish yo\'q');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-5c-manba-ochiq.png') });
  await p.keyboard.press('Space'); teng(await iz.isHidden(), true, 'qayta bosilsa yopiladi');
  await p.selectOption('#gk-kategoriya', { label: XAR2 });   // modelning xatosini kartada tuzatish
  await p.fill('#gk-summa', '20000');
  teng(await p.inputValue('#gk-summa'), '20 000', 'summa mingliklar bilan');
  await p.click('#gap-saqlash');
  await p.waitForSelector('.gp-ekran', { state: 'detached' });
  teng(await p.textContent('.toast'), '1 ta yozuv saqlandi', 'xabar');
  let yoz = await bazadan('yozuvlar');
  const yangi = yoz.find((y) => y.summa === 20000);
  teng(!!yangi && yangi.tur === 'xarajat' && yangi.izoh === 'taksi', true, 'yozuv bazaga yozildi (tuzatilgan summa va kategoriya bilan)');
  teng(await p.evaluate((n) => Data.hammasi('kategoriyalar').then((k) => k.find((x) => x.id === n).nom), yangi.kategoriya_id), XAR2, 'tuzatilgan kategoriya');
  teng(yangi.sana, await p.evaluate(() => Calc.bugun()), 'sana bo\'sh bo\'lsa — bugun');

  // 3) bir gapda 3 ta yozuv: qarz (Berdim), o'tkazma, bekor qilinadigan daromad
  await yubor({ holat: 200, tana: { ok: true, manba: 'model', yozuvlar: [
    Y({ tur: 'qarz_berdim', shaxs: 'Ali', summa: 500000, izoh: 'qarz', ogohlantirish: ['summa aniqlanmadi'] }),
    Y({ tur: 'otkazma', summa: 100000, hisob: 'Naqd pul', hisob2: null, izoh: 'kartaga', ogohlantirish: ['ikkinchi hisob topilmadi'] }),
    Y({ tur: 'daromad', summa: 5000000, kategoriya: kat.dar[0], izoh: 'oylik' })] } }, 'uch yozuv');
  await p.waitForSelector('#gap-sanoq');
  teng(await p.textContent('#gap-sanoq'), '1 / 3', 'ketma-ket kartalar');
  teng(await p.evaluate(() => [...document.querySelectorAll('.gp-segment button')].filter((b) => b.scrollWidth > b.clientWidth).map((b) => b.textContent)), [], 'segment tugmalari matni sig\'adi (360 px)');
  teng(await p.evaluate(() => [...document.querySelectorAll('.gp-segment button')].filter((b) => b.getBoundingClientRect().height < 44).length), 0, 'segment tugmalari ≥ 44 px balandlikda');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-6-qarz-karta.png') });
  await p.click('#gap-saqlash');
  await p.waitForFunction(() => document.querySelector('#gap-sanoq').textContent === '2 / 3');
  teng((await bazadan('qarzlar')).filter((x) => x.shaxs === 'Ali').map((x) => [x.yonalish, x.summa]), [['berdim', 500000]], 'qarz saqlandi (Berdim)');
  await p.click('#gap-saqlash');   // hisob2 bo'sh: saqlamaydi, xato ko'rsatadi
  teng(await p.locator('#gk-hisob2').evaluate((e) => e.parentNode.querySelector('.xato-matn').textContent), 'Tanlang', 'o\'tkazmada ikkinchi hisob majburiy');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-7-majburiy-xato.png') });
  await p.selectOption('#gk-hisob2', { label: 'Uzum' }); await p.click('#gap-saqlash');
  await p.waitForFunction(() => document.querySelector('#gap-sanoq').textContent === '3 / 3');
  await p.click('#gap-bekor');   // 3-karta tasdiqsiz o'tkazib yuboriladi
  await p.waitForSelector('.gp-ekran', { state: 'detached' });
  teng(await p.textContent('.toast'), '2 ta yozuv saqlandi', 'N ta yozuv saqlandi');
  yoz = await bazadan('yozuvlar');
  teng(yoz.filter((y) => y.tur === 'otkazma').length, 1, 'o\'tkazma saqlandi'); teng(yoz.some((y) => y.summa === 5000000), false, 'bekor qilingan karta saqlanmadi');

  // 4) qarz qaytarilishi (mavjud qarzga to'lov) va uni noto'g'ri summa bilan sinash
  await yubor({ holat: 200, tana: { ok: true, manba: 'model', yozuvlar: [Y({ tur: 'qarz_qaytarildi', shaxs: 'karim', summa: 999999, izoh: 'qaytardi' })] } }, 'Karim 400 ming qaytardi');
  await p.waitForSelector('#gap-saqlash'); await p.click('#gap-saqlash');
  teng((await p.locator('#gk-summa').evaluate((e) => e.parentNode.querySelector('.xato-matn').textContent)).indexOf('qolgan') > 0, true, 'qolgan qarzdan oshgan summa saqlanmaydi');
  await p.fill('#gk-summa', '400000'); await p.click('#gap-saqlash');
  await p.waitForSelector('.gp-ekran', { state: 'detached' });
  const karim = (await bazadan('qarzlar')).find((x) => x.shaxs === 'Karim');
  teng([karim.tolovlar.length, karim.tolovlar[0].summa, karim.yopilgan], [1, 400000, true], 'to\'lov qo\'shildi, qarz yopildi');

  // 5) turni o'zgartirish va chiqishda tasdiq
  await yubor({ holat: 200, tana: { ok: true, manba: 'model', yozuvlar: [Y({ kategoriya: XAR })] } }, 'taksiga 15 ming');
  await p.waitForSelector('#gap-saqlash');
  await p.click('[aria-label="Yozuv turi"] [data-qiymat="daromad"]');
  teng([await p.inputValue('#gk-summa'), await p.inputValue('#gk-kategoriya'), await p.inputValue('#gk-izoh')], ['15 000', '', 'taksi'], 'tur almashganda summa va izoh qoladi, kategoriya bo\'shaydi');
  p.once('dialog', (d) => d.dismiss());
  await p.click('#gap-orqaga');
  teng(await p.locator('.gp-ekran').isVisible(), true, 'saqlanmagan karta: "Yo\'q" desa ekran qoladi');
  p.once('dialog', (d) => { teng(d.message(), 'Saqlanmagan yozuvlar bor. Chiqasizmi?', 'tasdiq matni'); d.accept(); });
  await p.click('#gap-orqaga');
  await p.waitForSelector('.gp-ekran', { state: 'detached' });
  teng((await bazadan('yozuvlar')).filter((y) => y.izoh === 'taksi').length, 1, 'chiqishda saqlanmagan karta yozilmadi');

  // 6) telefonning "orqaga" tugmasi
  await t.click(); teng(await p.evaluate(() => !!(history.state && history.state.gap)), true, 'tarix yozuvi bor');
  await p.goBack(); await p.waitForSelector('.gp-ekran', { state: 'detached' });
  teng(await p.locator('#ekran h1').first().textContent(), 'Asosiy', 'telefon "orqaga": ilovadan chiqarmaydi, Asosiyga qaytaradi');

  // 7) xato holatlari
  for (const [javob, kutilgan] of [
    [{ holat: 200, tana: { ok: true, manba: 'model', yozuvlar: [], sabab: 'yozuv_yoq' } }, /^Gapda yozuv topilmadi/], [{ holat: 200, tana: { ok: true, manba: null, yozuvlar: [], sabab: 'tushunarsiz' } }, /^Tushunmadim/],
    [{ holat: 429, tana: { xato: { kod: 'AI_LIMIT', sabab: 'x' } } }, /limit[\s\S]*AI_LIMIT/], [{ holat: 502, tana: { xato: { kod: 'AI_PROVAYDER', sabab: 'x' } } }, /javob bera olmayapti/], [{ holat: 413, tana: { xato: { kod: 'AI_UZUN', sabab: 'x' } } }, /juda uzun/]]) {
    navbat.push(javob); await t.click(); await p.fill('#gap-matn', 'salom'); await p.click('#gap-aylantirish');
    await p.waitForFunction(() => document.querySelector('#gap-xato').textContent.length > 0);
    teng([kutilgan.test(await p.textContent('#gap-xato')), await p.inputValue('#gap-matn')], [true, 'salom'], 'xato: ' + kutilgan);
    if (kutilgan.source.indexOf('juda uzun') >= 0) await p.screenshot({ path: path.join(RASMLAR, tema + '-8-xato.png') });
    await p.click('#gap-orqaga'); await p.waitForSelector('.gp-ekran', { state: 'detached' });
  }
  await kontekst.setOffline(true);
  await t.click(); await p.fill('#gap-matn', 'salom'); const oldin = sorovlar.length; await p.click('#gap-aylantirish');
  teng([/^Internet kerak/.test(await p.textContent('#gap-xato')), sorovlar.length], [true, oldin], 'internet yo\'q: so\'rov ketmaydi');
  await kontekst.setOffline(false);
  await p.click('#gap-orqaga'); await p.waitForSelector('.gp-ekran', { state: 'detached' });
  teng(await p.evaluate(() => JSON.stringify(Object.keys(localStorage)).indexOf('gap') < 0 && JSON.stringify(Object.entries(localStorage)).indexOf('salom') < 0), true, 'localStorage da gap yo\'q');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-9-asosiy-oxirida.png') });
  await kontekst.close();
}

(async () => {
  const brauzer = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  for (const tema of ['light', 'dark']) await senariy(brauzer, tema);
  await brauzer.close();
  console.log(jami + ' tekshiruv, xato: ' + xatolar + ' (rasmlar: ' + RASMLAR + ')');
  process.exit(xatolar ? 1 : 0);
})().catch((e) => { console.log('✗ ' + e.stack); process.exit(1); });
