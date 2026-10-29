// O'chirilganlar ekrani (TZ-sinxronlash.md 52-band) uchun brauzer sinovi: HAQIQIY ilova (index.html, haqiqiy IndexedDB), faqat UYDIRMA ma'lumot.
// Faqat ishlab chiqish vaqtida; ilovaning o'zi uni ishlatmaydi.
// Ishga tushirish: avval  python3 -m http.server 8000  (repozitoriy papkasida), keyin
//   node tools/ochirilgan-brauzer-sinovi.js [rasmlar_papkasi]     (Playwright va Chromium kerak; PLAYWRIGHT_MODULE, ILOVA_MANZIL ixtiyoriy)
// 360 px kenglikda yorug' va qorong'i rejimda yuradi. Xato bo'lsa chiqish kodi 1.
const fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const MANZIL = process.env.ILOVA_MANZIL || 'http://localhost:8000/index.html';
const RASMLAR = process.argv[2] || path.join(os.tmpdir(), 'ochirilgan-rasmlar');
fs.mkdirSync(RASMLAR, { recursive: true });

let jami = 0, xatolar = 0;
function teng(haqiqiy, kutilgan, izoh) {
  jami++;
  if (JSON.stringify(haqiqiy) !== JSON.stringify(kutilgan)) { xatolar++; console.log('  ✗ ' + izoh + ' — kutilgan: ' + JSON.stringify(kutilgan) + ', chiqdi: ' + JSON.stringify(haqiqiy)); }
}
const bo = (s) => String(s).replace(/\s+/g, ' ').trim();

async function senariy(brauzer, tema) {
  console.log('== ' + tema + ' rejim, 360 px ==');
  const kontekst = await brauzer.newContext({ viewport: { width: 360, height: 780 }, colorScheme: tema, serviceWorkers: 'block' });
  const p = await kontekst.newPage();
  p.on('pageerror', (e) => { if (!/IDBObjectStore/.test(e.message)) { xatolar++; console.log('  ✗ PAGEERROR ' + e.message); } });
  await p.goto(MANZIL);
  await p.waitForFunction(() => typeof Data !== 'undefined' && document.querySelector('#ekran h1'));
  if (await p.locator('#salom-davom').count()) { await p.click('#salom-davom'); await p.waitForSelector('#salom-ekran', { state: 'detached' }); }
  // Uydirma ma'lumot. Hisoblar: Karta A (1 000 000), Karta B, Karta C (0), "Yopiq" (keyin o'chiriladi). Kategoriya "Vaqtinchalik" (keyin o'chiriladi).
  // O'chirilganlar (kun oldin): Anvar qarzi (1), Taksi xarajati (2), daromad (3), o'tkazma+komissiya (4), Yopiq hisobli (5), o'chirilgan kategoriyali (6),
  // Karta C ga 5 000 lik xarajat (7), 100 kun oldin o'chirilgani (ko'rinmaydi).
  await p.evaluate(async () => {
    const yaratilgan = new Date().toISOString();
    const yoz = (nom, q) => Data.saqlash('hisoblar', { yaratilgan, nom, tur: 'karta', belgi: 'karta', rang: '#2F5DDB', oxirgi4: '', boshlangich_qoldiq: q, arxivlangan: false });
    for (const [n, q] of [['Karta A', 1000000], ['Karta B', 0], ['Karta C', 0], ['Yopiq', 0]]) await yoz(n, q);
    await Data.saqlash('kategoriyalar', { yaratilgan, nom: 'Vaqtinchalik', tur: 'xarajat', rang: '#E65100', belgi: 'oziq', arxivlangan: false });
    const h = await Data.hammasi('hisoblar'), id = (n) => h.filter((x) => x.nom === n)[0].id;
    const kats = await Data.hammasi('kategoriyalar'), xar = kats.filter((k) => k.tur === 'xarajat' && k.nom !== 'Vaqtinchalik')[0], dar = kats.filter((k) => k.tur === 'daromad')[0], vaq = kats.filter((k) => k.nom === 'Vaqtinchalik')[0];
    const Y = (tur, summa, hisob, kat, izoh) => { const y = { id: Data.yangiId(), yaratilgan, tur, summa, sana: Calc.bugun(), vaqt: '00:01', hisob_id: id(hisob), kategoriya_id: kat, izoh: izoh || '' }; return Data.saqlash('yozuvlar', y).then(() => y); };
    const taksi = await Y('xarajat', 43000, 'Karta A', xar.id, 'Ish yo\'li\nikkinchi qator');
    const daromad = await Y('daromad', 500000, 'Karta A', dar.id, '');
    const otk = Object.assign(await Y('otkazma', 100000, 'Karta A', null, ''), {}); 
    const yopiq = await Y('xarajat', 7000, 'Yopiq', xar.id, 'yopiq hisob');
    const vaqKat = await Y('xarajat', 8000, 'Karta A', vaq.id, 'kategoriya');
    const cXar = await Y('xarajat', 5000, 'Karta C', xar.id, '');
    const eski = await Y('xarajat', 999, 'Karta A', xar.id, 'juda eski');
    await Data.otkazmaniSaqlash(Object.assign({}, otk, { qabul_hisob_id: id('Karta B'), kategoriya_id: null }), { summa: 1000, izoh: 'O\'tkazma komissiyasi (1%)' });
    const q = { id: Data.yangiId(), yaratilgan, yonalish: 'oldim', shaxs: 'Anvar', summa: 100000, hisob_id: id('Karta A'), sana: Calc.bugun(), vaqt: '00:02', muddat: '', izoh: '', tolovlar: [{ id: Data.yangiId(), summa: 30000, hisob_id: id('Karta A'), sana: Calc.bugun(), vaqt: '00:03' }, { id: Data.yangiId(), summa: 20000, hisob_id: id('Karta A'), sana: Calc.bugun(), vaqt: '00:04' }] };
    await Data.saqlash('qarzlar', q);
    await Data.saqlash('qarzlar', Object.assign({}, q, { tolovlar: q.tolovlar.slice(0, 1) }));   // ikkinchi to'lov bekor qilingan (51-band)
    // o'chirish
    for (const y of [taksi, daromad, yopiq, vaqKat, cXar, eski]) await Data.ochirish('yozuvlar', y.id);
    await Data.yozuvniKomissiyasiBilanOchirish(otk.id);
    await Data.qarzniKomissiyasiBilanOchirish(q.id);
    await Data.ochirish('hisoblar', id('Yopiq')); await Data.ochirish('kategoriyalar', vaq.id);
    // o'chirilgan paytni kunlar bo'yicha qo'yish (xom yozuv)
    const kun = (n) => new Date(Date.now() - n * 86400000).toISOString();
    const belgila = { qarzlar: [[q.id, 1]], yozuvlar: [[taksi.id, 2], [daromad.id, 3], [otk.id, 4], [yopiq.id, 5], [vaqKat.id, 6], [cXar.id, 7], [eski.id, 100]] };
    const db = await new Promise((ok, no) => { const so = indexedDB.open('moliya'); so.onsuccess = () => ok(so.result); so.onerror = () => no(so.error); });
    for (const t of Object.keys(belgila)) for (const [x, n] of belgila[t]) await new Promise((ok) => { const tx = db.transaction(t, 'readwrite'), s = tx.objectStore(t); s.get(x).onsuccess = (e) => { s.put(Object.assign({}, e.target.result, { updated_at: kun(n) })); }; tx.oncomplete = ok; });
    db.close();
  });
  await p.reload();
  await p.waitForFunction(() => document.querySelector('#ekran h1'));
  const rasm = (nom) => p.screenshot({ path: path.join(RASMLAR, tema + '-' + nom + '.png') });
  const olchov = async (izoh) => teng(await p.evaluate(() => document.documentElement.scrollWidth <= 360), true, izoh + ': gorizontal aylanish yo\'q');
  const qoldiq = (nom) => p.evaluate(async (nom) => { const [h, y, q] = await Promise.all([Data.hammasi('hisoblar'), Data.hammasi('yozuvlar'), Data.hammasi('qarzlar')]); return Calc.hisobQoldigi(h.filter((x) => x.nom === nom)[0], y, q); }, nom);
  const qatorlar = () => p.evaluate(() => { const b = (x) => String(x).replace(/\s+/g, ' ').trim(); return [...document.querySelectorAll('.och-qator')].map((r) => b(r.querySelector('.och-nom').textContent) + '|' + b(r.querySelector('.och-meta').textContent).replace(/o'chirilgan: \d+-\S+( \d{4})?$/i, "o'chirilgan: #") + '|' + b(r.querySelector('.och-summa').textContent) + '|' + (r.querySelector('.och-tosiq') ? r.querySelector('.och-tosiq').textContent : '') + '|' + r.querySelector('.och-qaytar').disabled); });
  const ochish = async () => { await p.click('[data-bolim="koproq"]'); await p.waitForSelector('#kp-ochirilganlar'); await p.waitForTimeout(150); };

  // ======== 1) Ko'proq: qator va soni belgisi ========
  await ochish();
  teng(bo(await p.textContent('#kp-ochirilganlar .och-kirish-nom')), 'O\'chirilganlar', 'qator nomi'); teng(await p.evaluate(() => !!document.querySelector('#kp-ochirilganlar svg')), true, 'ikon');
  teng(await p.evaluate(() => { const b = document.querySelector('.och-soni'); return [b.hidden, b.textContent]; }), [false, '7'], 'soni belgisi: 7 (100 kun oldingisi va ota bilan birga komissiya sanalmaydi)');
  await rasm('1-koproq');
  await p.click('#kp-ochirilganlar'); await p.waitForSelector('.och-qator');

  // ======== 2) Ekran ========
  teng(bo(await p.textContent('h1')), 'O\'chirilganlar', 'sarlavha');
  teng(await p.evaluate(() => [...document.querySelectorAll('.och-chiplar .qarz-chip')].map((c) => [c.textContent, c.getAttribute('aria-pressed'), Math.round(c.getBoundingClientRect().height) >= 44])), [['Hammasi', 'true', true], ['Yozuvlar', 'false', true], ['Qarzlar', 'false', true]], 'chiplar (Hammasi tanlangan, ≥ 44 px)');
  teng(await p.evaluate(() => { const c = document.querySelector('.och-chiplar [aria-pressed="true"] .qarz-chip-ich'); return getComputedStyle(c).backgroundColor !== getComputedStyle(document.querySelector('.och-chiplar [aria-pressed="false"] .qarz-chip-ich')).backgroundColor; }), true, 'tanlangan chip to\'ldirilgan');
  const q = await qatorlar();
  teng(q.length, 7, '7 qator'); teng(q[0], 'Anvar · Olingan qarz|o\'chirilgan: #|100 000||false', 'birinchi qator: qarz (eng yangisi)');
  teng(q[1].replace(/^[^|]*\|/, ''), 'Ish yo\'li · o\'chirilgan: #|−43 000||false', 'Taksi: izohning birinchi qatori, qizil summa');
  teng(q[2].split('|').slice(2).join('|'), '+500 000||false', 'daromad'); teng(q[3].split('|')[0].startsWith('O\'tkazma') && q[3].split('|')[2] === '100 000', true, 'o\'tkazma oddiy rang, komissiya alohida emas');
  teng(q[4].split('|').slice(3).join('|'), 'Hisobi o\'chirilgan|true', 'hisobi o\'chirilgan: Qaytarish o\'chirilgan'); teng(q[5].split('|').slice(3).join('|'), 'Kategoriyasi o\'chirilgan|true', 'kategoriyasi o\'chirilgan');
  teng(await p.evaluate(() => [...document.querySelectorAll('.och-qator')].map((r) => { const b = r.querySelector('.och-qaytar').getBoundingClientRect(), a = r.querySelector('svg, .belgi-katak, .och-odam').getBoundingClientRect(); return [b.height >= 44, Math.round(a.width)]; })), [[true, 40], [true, 40], [true, 40], [true, 40], [true, 40], [true, 40], [true, 40]], 'Qaytarish ≥ 44 px, ikon katagi 40 px');
  teng(await p.evaluate(() => { const c = (s) => getComputedStyle(document.querySelector(s)); return [c('.och-qator[data-yozuv] .minus').color !== c('.och-qator[data-yozuv] .och-meta').color, document.querySelector('.och-qator[data-qarz] .och-odam svg') !== null, c('.och-nom').fontSize, c('.och-meta').fontSize, document.querySelector('.och-izoh').textContent]; }),
    [true, true, '14px', '12px', 'O\'chirilgandan keyin 90 kun ichida qaytarish mumkin, keyin avtomatik tozalanadi.'], 'uslub va pastki izoh');
  await olchov('O\'chirilganlar ekrani'); await rasm('2-ekran');
  teng(await p.evaluate(() => { const r = document.querySelectorAll('.och-qator'); return [...r].every((x) => x.scrollWidth <= x.clientWidth + 1); }), true, 'qatorlar sig\'adi (ellipsis)');
  // chiplar
  await p.click('.och-chiplar [data-filtr="qarz"]'); teng((await qatorlar()).length, 1, 'Qarzlar: bitta');
  await p.click('.och-chiplar [data-filtr="yozuv"]'); teng((await qatorlar()).length, 6, 'Yozuvlar: 6');
  await p.click('.och-chiplar [data-filtr="hammasi"]');

  // ======== 3) Qaytarish ========
  const oldinA = await qoldiq('Karta A');
  await p.click('.och-qator[data-qarz] .och-qaytar'); await p.waitForTimeout(500);
  teng((await qatorlar()).length, 6, 'qarz qaytdi: ro\'yxatdan chiqdi'); teng(bo(await p.textContent('.toast')), 'Qaytarildi', 'xabar');
  teng(((await qoldiq('Karta A')) - oldinA), 100000 - 30000, 'olingan qarz qaytdi: +100 000 − to\'langan 30 000 (bekor qilingan 20 000 qaytmadi)');
  teng(await p.evaluate(async () => { const z = (await Data.hammasiniOqish()).qarzlar[0]; return [z.deleted, z.tolovlar.filter((t) => t.deleted).length]; }), [false, 1], 'bazada qarz tirik, bekor qilingan to\'lov deleted bo\'lib qoldi');
  await p.click('.och-qator[data-yozuv] .och-qaytar'); await p.waitForTimeout(400);
  teng((await qatorlar()).length, 5, 'Taksi qaytdi'); teng((await qoldiq('Karta A')) - oldinA, 100000 - 30000 - 43000, 'qoldiq darhol yangilandi');
  // §50: Karta C 0 — qaytarish manfiyga tushiradi, bloklanmaydi
  const cId = await p.evaluate(async () => (await Data.hammasiniOqish()).yozuvlar.filter((y) => y.summa === 5000)[0].id);
  await p.click('.och-qator[data-yozuv="' + cId + '"] .och-qaytar'); await p.waitForTimeout(400);
  teng([await p.locator('.manfiy-oyna').count(), await qoldiq('Karta C'), (await qatorlar()).length], [0, -5000, 4], '§50 qaytarishda qo\'llanmaydi: Karta C −5 000');
  // daromad, so'ng o'tkazma (komissiyasi bilan) qaytadi
  const aOld = await qoldiq('Karta A'), bOld = await qoldiq('Karta B');
  await p.click('.och-qaytar:not([disabled]) >> nth=0'); await p.waitForTimeout(400);
  teng((await qatorlar()).length, 3, 'daromad qaytdi');
  await p.click('.och-qaytar:not([disabled]) >> nth=0'); await p.waitForTimeout(400);
  teng((await qatorlar()).length, 2, 'o\'tkazma qaytdi (komissiya alohida qator emas edi)');
  teng([(await qoldiq('Karta A')) - aOld, (await qoldiq('Karta B')) - bOld], [500000 - 101000, 100000], 'qoldiqlar: daromad +500 000, o\'tkazma −100 000 va komissiya −1 000; Karta B +100 000');
  teng(await p.evaluate(async () => (await Data.hammasiniOqish()).yozuvlar.filter((y) => y.summa === 1000 && y.bog_id && y.deleted !== true).length), 1, 'komissiya yozuvi ham qaytdi');
  teng(await qatorlar().then((r) => r.map((x) => x.split('|').slice(3).join('|'))), ['Hisobi o\'chirilgan|true', 'Kategoriyasi o\'chirilgan|true'], 'faqat qaytarib bo\'lmaydiganlar qoldi');
  await p.click('.nav-tugma[data-bolim="tarix"]'); await p.waitForSelector('.yozuv-kv');
  teng(await p.locator('.yozuv-kv').count() >= 4, true, 'Tarixda qaytganlar ko\'rinadi'); await olchov('Tarix');
  await ochish();
  teng(await p.evaluate(() => document.querySelector('.och-soni').textContent), '2', 'belgi yangilandi');

  // ======== 4) Yana ko'rsatish, bo'sh holat ========
  await p.evaluate(async () => {
    const h = (await Data.hammasi('hisoblar')).filter((x) => x.nom === 'Karta A')[0], k = (await Data.hammasi('kategoriyalar')).filter((x) => x.tur === 'xarajat')[0];
    for (let i = 0; i < 55; i++) { const y = { id: Data.yangiId(), yaratilgan: new Date().toISOString(), tur: 'xarajat', summa: 100 + i, sana: Calc.bugun(), vaqt: '00:01', hisob_id: h.id, kategoriya_id: k.id, izoh: 'ko\'p' }; await Data.saqlash('yozuvlar', y); await Data.ochirish('yozuvlar', y.id); }
  });
  await p.reload(); await p.waitForFunction(() => document.querySelector('#ekran h1')); await ochish();
  await p.click('#kp-ochirilganlar'); await p.waitForSelector('.och-qator');
  const jamiSon = await p.evaluate(() => document.querySelector('.och-qator') ? 1 : 0); teng(jamiSon, 1);
  teng([await p.locator('.och-qator').count(), await p.locator('#och-yana').count()], [50, 1], 'dastlab 50 ta va "Yana ko\'rsatish"');
  await p.click('#och-yana'); await p.waitForTimeout(100);
  const k2 = await p.locator('.och-qator').count(); teng(k2 > 50 && k2 <= 100, true, '50 tadan qo\'shildi'); teng(await p.locator('#och-yana').count(), 0, 'hammasi ko\'rsatildi');
  await rasm('3-uzun-royxat');
  // hammasini o'chirilganlardan chiqarish uchun bo'sh holat: yangi kontekstsiz — filtr bo'sh natija
  await p.evaluate(async () => { const m = await Data.hammasiniOqish(); const db = await new Promise((ok) => { const so = indexedDB.open('moliya'); so.onsuccess = () => ok(so.result); }); for (const t of ['yozuvlar', 'qarzlar']) await new Promise((ok) => { const tx = db.transaction(t, 'readwrite'), s = tx.objectStore(t); m[t].filter((x) => x.deleted).forEach((x) => s.delete(x.id)); tx.oncomplete = ok; }); db.close(); });
  await p.reload(); await p.waitForFunction(() => document.querySelector('#ekran h1')); await ochish();
  teng(await p.evaluate(() => document.querySelector('.och-soni').hidden), true, 'soni 0 bo\'lsa belgi yo\'q');
  await p.click('#kp-ochirilganlar'); await p.waitForSelector('.och-bosh');
  teng(bo(await p.textContent('.och-bosh')), 'O\'chirilgan narsa yo\'q', 'bo\'sh holat'); teng(await p.evaluate(() => !!document.querySelector('.och-bosh svg')), true, 'ikon');
  await olchov('bo\'sh holat'); await rasm('4-bosh');
  await kontekst.close();
}

(async () => {
  const brauzer = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const tema of ['light', 'dark']) {
    try { await senariy(brauzer, tema); } catch (e) { xatolar++; console.log('  ✗ ' + (e && e.message ? e.message.split('\n').slice(0, 3).join(' | ') : e) + (e && e.stack ? ' @ ' + (e.stack.match(/ochirilgan-brauzer-sinovi\.js:\d+/) || [''])[0] : '')); }
  }
  await brauzer.close();
  console.log(jami + ' tekshiruv, xato: ' + xatolar + ' (rasmlar: ' + RASMLAR + ')');
  process.exit(xatolar ? 1 : 0);
})();
