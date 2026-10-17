// Kategoriyalarni birlashtirish (TZ-sinxronlash.md 41-band) uchun brauzer sinovi: HAQIQIY ilova (index.html, haqiqiy IndexedDB), faqat UYDIRMA ma'lumot.
// Faqat ishlab chiqish vaqtida; ilovaning o'zi uni ishlatmaydi.
// Ishga tushirish: avval  python3 -m http.server 8000  (repozitoriy papkasida), keyin  node tools/kategoriya-birlashtirish-brauzer-sinovi.js [rasmlar_papkasi]
// (PLAYWRIGHT_MODULE, CHROMIUM_PATH, ILOVA_MANZIL ixtiyoriy). 360 px, yorug' va qorong'i rejim. Xato bo'lsa chiqish kodi 1.
const fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const MANZIL = process.env.ILOVA_MANZIL || 'http://localhost:8000/index.html';
const RASMLAR = process.argv[2] || path.join(os.tmpdir(), 'birlashtirish-rasmlar');
fs.mkdirSync(RASMLAR, { recursive: true });
let jami = 0, xatolar = 0;
function teng(h, k, izoh) { jami++; if (JSON.stringify(h) !== JSON.stringify(k)) { xatolar++; console.log('  ✗ ' + izoh + ' — kutilgan: ' + JSON.stringify(k) + ', chiqdi: ' + JSON.stringify(h)); } }
const bo = (s) => String(s).replace(/\s+/g, ' ').trim();

async function senariy(brauzer, tema) {
  console.log('== ' + tema + ' rejim, 360 px ==');
  const kontekst = await brauzer.newContext({ viewport: { width: 360, height: 780 }, colorScheme: tema, serviceWorkers: 'block' });
  const p = await kontekst.newPage();
  p.on('pageerror', (e) => { if (!/IDBObjectStore/.test(e.message)) { xatolar++; console.log('  ✗ PAGEERROR ' + e.message); } });
  await p.goto(MANZIL);
  await p.waitForFunction(() => typeof Data !== 'undefined' && document.querySelector('#ekran h1'));
  if (await p.locator('#salom-davom').count()) { await p.click('#salom-davom'); await p.waitForSelector('#salom-ekran', { state: 'detached' }); }
  const id = await p.evaluate(async () => {
    const kat = async (nom, tur, arx) => { await Data.saqlash('kategoriyalar', { yaratilgan: new Date().toISOString(), nom, tur, rang: nom === 'Taksi' ? '#F5A300' : '#2F5DDB', belgi: 'tag', arxivlangan: !!arx }); return (await Data.hammasi('kategoriyalar')).filter((k) => k.nom === nom)[0]; };
    const A = await kat('Taksi', 'xarajat'), B = await kat('Yo\'l', 'xarajat'); await kat('Arxiv', 'xarajat', true); await kat('Maosh2', 'daromad');
    const h = (await Data.hammasi('hisoblar'))[0];
    const yoz = (k, s, izoh) => Data.saqlash('yozuvlar', { yaratilgan: new Date().toISOString(), tur: 'xarajat', summa: s, sana: new Date().toISOString().slice(0, 10), vaqt: '00:01', hisob_id: h.id, kategoriya_id: k.id, izoh });
    await yoz(A, 10000, 'a1'); await yoz(A, 20000, 'a2'); await yoz(B, 5000, 'b1');
    await Data.saqlash('byudjetlar', { kategoriya_id: A.id, oylik_limit: 100000 });
    return { A: A.id, B: B.id };
  });
  await p.reload(); await p.waitForFunction(() => document.querySelector('#ekran h1'));
  const jamlar = () => p.evaluate(async () => { const [h, y] = await Promise.all([Data.hammasi('hisoblar'), Data.hammasi('yozuvlar')]); return [Calc.hisobQoldigi(h[0], y, []), y.length]; });
  const oldin = await jamlar();
  const olchov = async (i) => teng(await p.evaluate(() => document.documentElement.scrollWidth <= 360), true, i + ': gorizontal aylanish yo\'q');
  await p.click('[data-bolim="koproq"]'); await p.click('#kp-kategoriyalar');
  await p.click('[data-kategoriya="' + id.A + '"]');
  teng(await p.textContent('h1'), 'Kategoriyani tahrirlash', 'tahrir oynasi');
  teng(await p.evaluate(() => { const b = document.querySelector('#kategoriya-birlashtirish'); return !!b && b.querySelector('svg') !== null && /Boshqa kategoriyaga birlashtirish/.test(b.textContent) && b.getBoundingClientRect().height >= 44 && b.getBoundingClientRect().width <= 360; }), true, 'tugma: belgi, matn, kamida 44 px');
  await olchov('tahrir'); await p.screenshot({ path: path.join(RASMLAR, tema + '-1-tahrir.png') });
  await p.click('#kategoriya-birlashtirish');
  await p.waitForSelector('.birl-qator');
  const nomlar = await p.evaluate(() => [...document.querySelectorAll('.birl-qator')].map((b) => b.querySelector('.birl-nom').textContent));
  teng([nomlar.includes('Yo\'l'), nomlar.includes('Oziq-ovqat'), nomlar.includes('Taksi'), nomlar.includes('Arxiv'), nomlar.includes('Maosh2'), nomlar.includes('Oylik maosh')], [true, true, false, false, false, false], 'ro\'yxat: faqat xarajat, arxivlanmagan, o\'zidan boshqa');
  teng(await p.evaluate(() => [...document.querySelectorAll('.birl-qator')].every((b) => b.querySelector('.belgi-katak') !== null && b.getBoundingClientRect().height >= 44)), true, 'har qatorda ikon katagi, kamida 44 px');
  await olchov('ro\'yxat'); await p.screenshot({ path: path.join(RASMLAR, tema + '-2-royxat.png') });
  await p.click('.birl-qator:has(.birl-nom:text-is("Yo\'l"))');
  await p.waitForSelector('#birl-nom');
  teng(bo(await p.textContent('.birl-matn')), '2 ta yozuv "Yo\'l" ga o\'tadi, "Taksi" kategoriyasi o\'chiriladi.', 'tasdiq matni');
  teng(bo(await p.textContent('.birl-ogoh')), 'Bu amalni qaytarib bo\'lmaydi.', 'ogohlantirish');
  teng(await p.inputValue('#birl-nom'), 'Yo\'l', 'nom nishon nomi bilan to\'ldirilgan');
  teng(await p.evaluate(() => getComputedStyle(document.querySelector('.birl-ogoh')).color === (() => { const q = document.createElement('i'); q.style.color = 'var(--xarajat)'; document.body.appendChild(q); const c = getComputedStyle(q).color; q.remove(); return c; })()), true, 'ogohlantirish qizil');
  await olchov('tasdiq'); await p.screenshot({ path: path.join(RASMLAR, tema + '-3-tasdiq.png') });
  // takror nom rad etiladi, bo'sh nom rad etiladi
  await p.fill('#birl-nom', ' ');
  await p.click('#birl-tasdiq');
  teng(bo(await p.textContent('.sheet .xato-matn')), 'Kategoriya nomini kiriting', 'bo\'sh nom');
  await p.fill('#birl-nom', 'oziq-ovqat');
  await p.click('#birl-tasdiq');
  teng(bo(await p.textContent('.sheet .xato-matn')), 'Bu nom bilan kategoriya allaqachon bor', 'takror nom (tayyor "Oziq-ovqat")');
  teng((await jamlar())[1], oldin[1], 'xatoda hech narsa o\'zgarmadi');
  await p.fill('#birl-nom', 'Yo\'l va taksi');
  await p.click('#birl-tasdiq');
  await p.waitForSelector('.sheet-parda', { state: 'detached' });
  teng(await p.textContent('h1'), 'Kategoriyalar', 'ro\'yxatga qaytdi');
  const r = await p.evaluate(async (id) => { const k = await Data.hammasi('kategoriyalar'), y = await Data.hammasi('yozuvlar'), b = await Data.hammasi('byudjetlar'), x = await Data.hammasiniOqish(); return { eski: k.some((q) => q.id === id.A), nom: k.filter((q) => q.id === id.B)[0].nom, yoz: y.map((q) => q.kategoriya_id === id.B).every(Boolean), eskiYoz: x.yozuvlar.filter((q) => q.kategoriya_id === id.A).length, byu: b.map((q) => q.kategoriya_id === id.B ? q.oylik_limit : 'x'), tomb: x.kategoriyalar.filter((q) => q.id === id.A)[0].deleted }; }, id);
  teng(r, { eski: false, nom: 'Yo\'l va taksi', yoz: true, eskiYoz: 0, byu: [100000], tomb: true }, 'natija: yozuvlar ko\'chdi, byudjet ko\'chdi, eski o\'chdi (tombstone), nom yangilandi');
  teng(await jamlar(), oldin, 'hisob qoldig\'i va yozuvlar soni o\'zgarmadi');
  teng(await p.evaluate((id) => !document.querySelector('[data-kategoriya="' + id.A + '"]') && !!document.querySelector('[data-kategoriya="' + id.B + '"]'), id), true, 'ro\'yxatdan eskisi yo\'qoldi');
  teng(await p.locator('.xabar button:has-text("Bekor")').count(), 0, 'bekor qilish (undo) tugmasi yo\'q');
  await olchov('natija'); await p.screenshot({ path: path.join(RASMLAR, tema + '-4-natija.png') });
  // yagona kategoriyali tur: daromad turida boshqa kategoriya bo'lmasa xabar
  await p.evaluate(async () => { for (const k of (await Data.hammasi('kategoriyalar')).filter((q) => q.tur === 'daromad' && q.nom !== 'Maosh2')) await Data.ochirish('kategoriyalar', k.id); });
  await p.reload(); await p.waitForFunction(() => document.querySelector('#ekran h1'));
  await p.click('[data-bolim="koproq"]'); await p.click('#kp-kategoriyalar');
  await p.click('.yozuv:has-text("Maosh2")'); await p.click('#kategoriya-birlashtirish');
  teng(await p.locator('.birl-qator').count(), 0, 'boshqa kategoriya yo\'q: ro\'yxat ochilmaydi');
  await kontekst.close();
}
(async () => {
  const brauzer = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  for (const tema of ['light', 'dark']) await senariy(brauzer, tema);
  await brauzer.close();
  console.log('\n' + (jami - xatolar) + ' / ' + jami + ' tekshiruv o\'tdi' + (xatolar ? ', ' + xatolar + ' ta XATO' : ''));
  process.exit(xatolar ? 1 : 0);
})().catch((e) => { console.log('SINOV TO\'XTADI: ' + e.message); process.exit(1); });
