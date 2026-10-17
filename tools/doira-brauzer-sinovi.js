// Doira diagramma (TZ-sinxronlash.md 43-band) uchun brauzer sinovi: HAQIQIY ilova (index.html, haqiqiy IndexedDB), faqat UYDIRMA ma'lumot (18 ta kategoriya).
// Faqat ishlab chiqish vaqtida; ilovaning o'zi uni ishlatmaydi.
// Ishga tushirish: avval  python3 -m http.server 8000  (repozitoriy papkasida), keyin  node tools/doira-brauzer-sinovi.js [rasmlar_papkasi]
// (PLAYWRIGHT_MODULE, CHROMIUM_PATH, ILOVA_MANZIL ixtiyoriy). 360 px, yorug' va qorong'i rejim. Xato bo'lsa chiqish kodi 1.
const fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const MANZIL = process.env.ILOVA_MANZIL || 'http://localhost:8000/index.html';
const RASMLAR = process.argv[2] || path.join(os.tmpdir(), 'doira-rasmlar');
fs.mkdirSync(RASMLAR, { recursive: true });
let jami = 0, xatolar = 0;
function teng(h, k, izoh) { jami++; if (JSON.stringify(h) !== JSON.stringify(k)) { xatolar++; console.log('  ✗ ' + izoh + ' — kutilgan: ' + JSON.stringify(k) + ', chiqdi: ' + JSON.stringify(h)); } }

async function senariy(brauzer, tema) {
  console.log('== ' + tema + ' rejim, 360 px ==');
  const kontekst = await brauzer.newContext({ viewport: { width: 360, height: 780 }, colorScheme: tema, serviceWorkers: 'block' });
  const p = await kontekst.newPage();
  p.on('pageerror', (e) => { if (!/IDBObjectStore/.test(e.message)) { xatolar++; console.log('  ✗ PAGEERROR ' + e.message); } });
  await p.goto(MANZIL);
  await p.waitForFunction(() => typeof Data !== 'undefined' && document.querySelector('#ekran h1'));
  if (await p.locator('#salom-davom').count()) { await p.click('#salom-davom'); await p.waitForSelector('#salom-ekran', { state: 'detached' }); }
  await p.evaluate(async () => {
    const h = (await Data.hammasi('hisoblar'))[0], bugun = new Date().toISOString().slice(0, 10);
    const ranglar = ['#7C5CFF', '#1E8FFF', '#00B4D8', '#14B870', '#2EA84F', '#6FBF2E', '#E6B800', '#F5A300', '#FF7A2F', '#E5483D', '#F0407A', '#C2409B', '#9B4DDB', '#2F5DDB', '#26A69A', '#7B8498', '#6A4CE0', '#E0356B'];
    const summalar = [8550000, 5000000, 3000000, 1500000, 800000, 400000, 200000, 100000, 50000, 30000, 20000, 15000, 10000, 8000, 5000, 3000, 2000, 1000];
    for (let i = 0; i < 18; i++) {
      await Data.saqlash('kategoriyalar', { yaratilgan: new Date().toISOString(), nom: 'Sinov kategoriya ' + (i + 1), tur: 'xarajat', rang: ranglar[i], belgi: 'tag', arxivlangan: false });
      const k = (await Data.hammasi('kategoriyalar')).filter((x) => x.nom === 'Sinov kategoriya ' + (i + 1))[0];
      await Data.saqlash('yozuvlar', { yaratilgan: new Date().toISOString(), tur: 'xarajat', summa: summalar[i], sana: bugun, vaqt: '00:01', hisob_id: h.id, kategoriya_id: k.id, izoh: 'sinov' });
    }
  });
  await p.reload(); await p.waitForFunction(() => document.querySelector('.kategoriyalar-karta .dona-svg'));
  const karta = p.locator('.kategoriyalar-karta');
  teng(await karta.locator('circle.dona-tilim').count(), 18, 'bo\'laklar soni 18');
  teng(await karta.locator('.dona-qator').count(), 18, 'ro\'yxat qatorlari 18');
  teng(await karta.locator('#kategoriya-soni').textContent(), '18', 'sarlavhadagi son belgisi');
  teng(/Boshqalar|bosib oching/.test(await karta.textContent()), false, '"Boshqalar" yo\'q');
  teng(await p.evaluate(() => document.documentElement.scrollWidth <= 360), true, 'gorizontal aylanish yo\'q');
  const g = await p.evaluate(() => {
    const t = [...document.querySelectorAll('.kategoriyalar-karta circle.dona-tilim')], c = t[0], s = document.querySelector('.kategoriyalar-karta .dona-svg').getBoundingClientRect();
    const yon = [...document.querySelectorAll('.kategoriyalar-karta .yon-tugma')].map((b) => { const r = b.getBoundingClientRect(); return { w: r.width, h: r.height, vis: getComputedStyle(b).visibility, dis: b.disabled, svg: !!b.querySelector('svg') }; });
    const sw = t.map((e) => +e.getAttribute('stroke-width'));
    const x = t.map((e) => { const [d] = e.getAttribute('stroke-dasharray').split(' '); return { d: +d, o: -e.getAttribute('stroke-dashoffset') }; });
    return { w: s.width, linecap: c.getAttribute('stroke-linecap'), sw, pl: c.getAttribute('pathLength'), x, yon, rang: t.map((e) => getComputedStyle(e).stroke), m1: document.querySelector('.dona-markaz-1').textContent, m2: document.querySelector('.dona-markaz-2').textContent, foiz: document.querySelector('.dona-foiz').textContent, qiymat: document.querySelector('.dona-qiymat').textContent };
  });
  teng(g.w <= 240.5 && g.w >= 150, true, 'diagramma eni 240 px dan oshmaydi: ' + g.w);
  teng(g.linecap, 'round', 'yumaloq uch'); teng(g.pl, '100', 'pathLength'); teng(g.sw.every((v) => v === 20), true, 'qalinlik 20');
  // kichik bo'laklar bir-biriga tegib turadi: ketma-ket ikki kichik bo'lak orasidagi masofa (keyingi boshi − oldingi oxiri) = cap
  const cap = 20 / (2 * Math.PI * 128) * 100, oxir = g.x.slice(-6).map((e, i, a) => (i ? +(e.o - e.d - a[i - 1].o + 0).toFixed(3) : null)).slice(1);
  const tegish = g.x.slice(-6).map((e, i, a) => (i ? +(e.o - (a[i - 1].o + a[i - 1].d)).toFixed(3) : null)).slice(1);
  teng(tegish.every((v) => Math.abs(v - cap) < 0.01), true, 'kichik bo\'laklar tegib turadi (yumaloq uchlar bir-biriga o\'tadi): ' + tegish.join());
  const kattaOra = +(g.x[1].o - (g.x[0].o + g.x[0].d)).toFixed(3);
  teng(kattaOra > cap + 0.5, true, 'katta bo\'laklar orasida ochiq joy bor: ' + kattaOra);
  teng(/^\d+(,\d+)? mln so'm$/.test(g.m2), true, 'markaz jami: ' + g.m2);
  teng(/^\d+,\d%$/.test(g.foiz), true, 'foiz bir o\'nli kasr: ' + g.foiz); teng(/so'm$/.test(g.qiymat), true, 'summa "so\'m" bilan: ' + g.qiymat);
  teng(g.yon[0].w >= 44 && g.yon[0].h >= 44 && g.yon[0].svg && g.yon[0].vis === 'visible', true, 'oldingi oy tugmasi (chevron, 44 px)');
  teng(g.yon[1].vis, 'hidden', 'joriy oyda "keyingi oy" ko\'rinmaydi');
  // matn halqa ichiga sig'adi
  const sigadi = await p.evaluate(() => [...document.querySelectorAll('.dona-markaz-1,.dona-markaz-2')].every((t) => { const b = t.getBBox(); return b.width <= 232; }));
  teng(sigadi, true, 'markaz matni halqa ichiga sig\'adi');
  // ro'yxat tartibi: kattadan kichikka
  const summalar = await p.$$eval('.kategoriyalar-karta .dona-qator', (q) => q.map((b) => +b.getAttribute('data-summa')));
  teng(summalar.every((v, i) => !i || summalar[i - 1] >= v), true, 'ro\'yxat kattadan kichikka');
  await p.mouse.move(0, 0); await karta.locator('.bolim-bosh').evaluate((e) => e.scrollIntoView()); await p.screenshot({ path: path.join(RASMLAR, tema + '-1-asosiy.png') });
  // oldingi oy tugmasi: oy almashadi (ma'lumot yo'q — bo'sh halqa)
  await p.click('.kategoriyalar-karta .yon-chap');
  teng(await karta.locator('circle.dona-bosh-halqa').count(), 1, 'oldingi oyda bo\'sh halqa'); teng(await karta.locator('.dona-markaz-2').textContent(), 'Ma\'lumot yo\'q', 'Ma\'lumot yo\'q');
  teng(await karta.locator('#kategoriya-soni').textContent(), '0', 'son belgisi 0');
  await karta.locator('.bolim-bosh').evaluate((e) => e.scrollIntoView()); await p.screenshot({ path: path.join(RASMLAR, tema + '-2-bosh.png') });
  await p.click('.kategoriyalar-karta .yon-ong');
  // bo'lak bosilganda yozuvlar ochiladi
  await karta.locator('circle.dona-tilim').nth(17).dispatchEvent('click');
  await p.waitForFunction(() => !document.querySelector('.kategoriyalar-karta .dona-svg'));
  teng(/Sinov kategoriya 18/.test(await p.textContent('#ekran')), true, 'bo\'lak bosilsa shu kategoriya yozuvlari ochiladi');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-3-yozuvlar.png') });
  await kontekst.close();
}

(async () => {
  const brauzer = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const t of ['light', 'dark']) await senariy(brauzer, t);
  await brauzer.close();
  console.log(xatolar ? '✗ ' + xatolar + ' ta xato / ' + jami : '✓ hammasi o\'tdi: ' + jami + ' / ' + jami);
  process.exit(xatolar ? 1 : 0);
})();
