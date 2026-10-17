// O'tkazma komissiyasi (TZ-sinxronlash.md 40-band) uchun brauzer sinovi: HAQIQIY ilova (index.html, haqiqiy IndexedDB), faqat UYDIRMA ma'lumot.
// Faqat ishlab chiqish vaqtida; ilovaning o'zi uni ishlatmaydi.
// Ishga tushirish: avval  python3 -m http.server 8000  (repozitoriy papkasida), keyin
//   node tools/komissiya-brauzer-sinovi.js [rasmlar_papkasi]     (Playwright va Chromium kerak; PLAYWRIGHT_MODULE, CHROMIUM_PATH, ILOVA_MANZIL ixtiyoriy)
// 360 px kenglikda yorug' va qorong'i rejimda yuradi; ekran rasmlari papkaga yoziladi. Xato bo'lsa chiqish kodi 1.
const fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const MANZIL = process.env.ILOVA_MANZIL || 'http://localhost:8000/index.html';
const RASMLAR = process.argv[2] || path.join(os.tmpdir(), 'komissiya-rasmlar');
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
  // Uydirma hisob: "Karta A" (1 000 000 so'm), "Naqd pul" (tayyor, 0)
  await p.evaluate(async () => {
    await Data.saqlash('hisoblar', { yaratilgan: new Date().toISOString(), nom: 'Karta A', tur: 'karta', belgi: 'karta', rang: '#2F5DDB', oxirgi4: '', boshlangich_qoldiq: 1000000, arxivlangan: false });
    try { localStorage.removeItem('moliya-komissiya-oxirgi'); } catch (e) { /* ahamiyatsiz */ }
  });
  await p.reload();
  await p.waitForFunction(() => document.querySelector('#ekran h1'));
  const qoldiq = (nom) => p.evaluate(async (nom) => { const [h, y] = await Promise.all([Data.hammasi('hisoblar'), Data.hammasi('yozuvlar')]); return Calc.hisobQoldigi(h.filter((x) => x.nom === nom)[0], y, []); }, nom);
  const yozuvlar = () => p.evaluate(() => Data.hammasi('yozuvlar'));
  const olchov = async (izoh) => teng(await p.evaluate(() => document.documentElement.scrollWidth <= 360 && document.getElementById('ekran').scrollWidth <= 360), true, izoh + ': gorizontal aylanish yo\'q');
  const rasm = (nom) => p.screenshot({ path: path.join(RASMLAR, tema + '-' + nom + '.png') });

  // ---- 1) Yangi o'tkazma: Karta A -> Naqd pul, 100 000, komissiya 1% ----
  async function otkazmaWizardi(summa, hisobNomi, qabulNomi) {
    await p.click('.nav-qoshish');
    await p.click('#yy-tranzaksiya');   // "Tranzaksiya qo'shish" (pastdan chiqadigan tanlov oynasi)
    await p.waitForSelector('#w-summa');
    await p.click('.tanlov button:has-text("O\'tkazma")');
    await p.fill('#w-summa', summa);
    await p.click('button:has-text("Davom etish")');
    await p.click('button.hisob-qator:has-text("' + hisobNomi + '")');
    await p.click('button.hisob-qator:has-text("' + qabulNomi + '")');
    await p.click('#w-keyingi');
    await p.waitForSelector('.kom-qism');
  }
  await otkazmaWizardi('100000', 'Karta A', 'Naqd pul');
  teng(await p.textContent('h1'), 'Izoh va saqlash', 'oxirgi qadam');
  const chiplar = () => p.evaluate(() => [...document.querySelectorAll('.kom-chiplar .chip')].map((b) => b.textContent + ':' + b.getAttribute('aria-pressed')));
  teng(await chiplar(), ['Yo\'q:true', '0,5%:false', '1%:false', 'Foiz…:false', 'Summa…:false'], 'komissiya chiplari (Yo\'q tanlangan)');
  teng(bo(await p.textContent('.kom-eslatma')), 'Shu hisob uchun oxirgi tanlov eslab qolinadi', 'eslatma matni');
  teng(await p.evaluate(() => { const k = document.querySelector('.kom-qism'), qayerga = [...document.querySelectorAll('.xulosa .qator')].map((q) => q.textContent); return qayerga.some((t) => /Qayerga/.test(t)) && k.getBoundingClientRect().top > document.querySelector('.xulosa').getBoundingClientRect().bottom - 2; }), true, 'komissiya "Qayerdan → Qayerga" ostida');
  teng(await p.evaluate(() => !!document.querySelector('.kom-bosh .belgi-katak svg') && getComputedStyle(document.querySelector('.kom-bosh .belgi-katak')).backgroundColor), 'rgb(92, 107, 192)', 'ikon katagi #5C6BC0 rangida');
  teng(await p.locator('.kom-natija').innerText(), '', 'Yo\'q: hisob satrlari yo\'q');
  teng(await p.evaluate(() => [...document.querySelectorAll('.kom-chiplar .chip')].every((b) => b.getBoundingClientRect().height >= 44 && b.getBoundingClientRect().width >= 44)), true, 'chiplar kamida 44 px');
  await p.click('.kom-chiplar [data-kom="p1"]');
  teng(bo(await p.locator('.kom-natija').innerText()), 'Komissiya: 1 000 Hisobdan jami chiqadi: 101 000', '1%: komissiya va jami');
  teng(await p.evaluate(() => getComputedStyle(document.querySelector('.kom-jami')).color === getComputedStyle(document.querySelector('.minus') || document.querySelector('.kom-jami')).color && getComputedStyle(document.querySelector('.kom-jami')).fontWeight >= 600), true, 'jami qizil (xarajat rangi) va qalin');
  await olchov('komissiya qismi (1%)'); await rasm('1-forma-1foiz');
  await p.click('.kom-chiplar [data-kom="p05"]');
  teng(bo(await p.locator('.kom-natija').innerText()), 'Komissiya: 500 Hisobdan jami chiqadi: 100 500', '0,5%');
  await p.click('.kom-chiplar [data-kom="foiz"]');
  teng(await p.isVisible('#kom-foiz'), true, 'Foiz… maydoni ochildi'); teng(await p.isVisible('#kom-summa'), false);
  await p.fill('#kom-foiz', '1.5');
  teng(bo(await p.locator('.kom-natija').innerText()), 'Komissiya: 1 500 Hisobdan jami chiqadi: 101 500', 'foiz nuqta bilan');
  await p.fill('#kom-foiz', '2,25');
  teng(bo(await p.locator('.kom-natija').innerText()), 'Komissiya: 2 250 Hisobdan jami chiqadi: 102 250', 'foiz vergul bilan');
  await olchov('Foiz… maydoni'); await rasm('2-forma-foiz');
  await p.click('.kom-chiplar [data-kom="summa"]');
  teng(await p.isVisible('#kom-summa'), true, 'Summa… maydoni'); teng(await p.isVisible('#kom-foiz'), false);
  await p.fill('#kom-summa', '2500');
  teng(await p.inputValue('#kom-summa'), '2 500', 'summa mingliklar bilan');
  teng(bo(await p.locator('.kom-natija').innerText()), 'Komissiya: 2 500 Hisobdan jami chiqadi: 102 500', 'summa rejimi');
  await rasm('3-forma-summa');
  // noto'g'ri foiz: saqlashda xato, hech narsa saqlanmaydi
  await p.click('.kom-chiplar [data-kom="foiz"]');
  await p.fill('#kom-foiz', '25');
  await p.click('#w-saqlash');
  teng(bo(await p.textContent('.kom-xato') || '') + '|' + bo(await p.textContent('.xato-matn:not(.kom-xato):not(:empty)') || ''), '|Foiz 0,01 dan 20 gacha bo\'lsin', 'foiz 25 rad etildi (xato "Izoh" qadamida ko\'rinadi)');
  teng((await yozuvlar()).length, 0, 'xatoda hech narsa saqlanmadi');
  await p.click('.kom-chiplar [data-kom="p1"]');
  await p.click('#w-saqlash');
  await p.waitForSelector('.kun .kom-ichki');
  // ---- 2) Tarix ----
  teng(await p.textContent('h1').catch(() => ''), 'Tarix', 'saqlagach Tarixga o\'tdi');
  const yoz = await yozuvlar();
  teng(yoz.length, 2, '2 ta yozuv (o\'tkazma va komissiya)');
  const ot = yoz.filter((y) => y.tur === 'otkazma')[0], ko = yoz.filter((y) => y.tur === 'xarajat')[0];
  teng([ot.summa, ko.summa, ko.bog_id === ot.id, ko.izoh, ko.hisob_id === ot.hisob_id, ko.sana === ot.sana && ko.vaqt === ot.vaqt], [100000, 1000, true, 'O\'tkazma komissiyasi (1%)', true, true], 'bazadagi yozuvlar');
  teng(await qoldiq('Karta A'), 1000000 - 101000, 'Karta A dan aynan 101 000 chiqdi');
  teng(await qoldiq('Naqd pul'), 100000, 'Naqd pul 100 000 oldi');
  const kategoriyalar = await p.evaluate(async () => (await Data.hammasi('kategoriyalar')).filter((k) => /komissiya/i.test(k.nom)).map((k) => [k.nom, k.tur, k.belgi, k.rang, k.arxivlangan]));
  teng(kategoriyalar, [['Komissiya', 'xarajat', 'percentage', '#5C6BC0', false]], '"Komissiya" kategoriyasi avtomatik yaratildi (bitta)');
  teng(await p.locator('.kun .kom-ichki').count(), 1, 'bitta ichki komissiya qatori'); teng(await p.locator('.kun .yozuv-kv').count(), 2, 'kunda 2 qator (o\'tkazma + ichki)');
  teng(bo(await p.textContent('.kom-ichki .yozuv-nom')), 'Komissiya · 1%', 'ichki qator nomi');
  teng(bo(await p.textContent('.kom-ichki .yozuv-summa')), '−1 000 so\'m', 'ichki qator summasi');
  teng(await p.evaluate(() => { const probe = document.createElement('span'); probe.style.color = 'var(--xarajat)'; document.body.appendChild(probe); const qizil = getComputedStyle(probe).color; probe.remove(); return getComputedStyle(document.querySelector('.kom-ichki .yozuv-summa')).color === qizil; }), true, 'ichki summa qizil (xarajat rangi)');
  teng(await p.evaluate(() => { const q = [...document.querySelectorAll('.kun .yozuv-kv')]; const a = q[0].getBoundingClientRect(), b = q[1].getBoundingClientRect(), ik = q[1].querySelector('.belgi-katak').getBoundingClientRect(); return [q[1].classList.contains('kom-ichki'), b.left - a.left >= 20, Math.round(ik.width), Math.round(ik.height), b.top >= a.bottom - 1, b.height >= 44]; }), [true, true, 28, 28, true, true], 'ichki qator: chapdan surilgan, 28 px ikon katagi, o\'tkazma ostida, bosish maydoni ≥ 44 px');
  teng(await p.evaluate(() => !!document.querySelector('.kom-ichki .belgi-katak svg')), true, 'burchak belgisi chizilgan');
  teng(await p.evaluate(() => [...document.querySelectorAll('.kun-sarlavha .pill')].map((x) => x.textContent)), ['−1 000'], 'kun jami: faqat komissiya xarajat (o\'tkazma 100 000 kirmaydi)');
  teng(await p.evaluate(() => { const t = document.querySelector('.oy-balans, .tarix-oy-karta, #ekran'); return /100\s?000/.test([...document.querySelectorAll('.pill-xarajat')].map((x) => x.textContent).join()); }), false, 'xarajat belgilarida 100 000 yo\'q');
  teng(await p.evaluate(() => { const o = document.querySelector('.kom-ichki'); return o.getAttribute('role') + '|' + (o.tabIndex >= 0) + '|' + /Komissiya/.test(o.getAttribute('aria-label')); }), 'button|true|true', 'ichki qator aria-label va klaviatura');
  await olchov('Tarix'); await rasm('4-tarix');
  teng(await p.evaluate(() => JSON.parse(localStorage.getItem('moliya-komissiya-oxirgi') || '{}')[Object.keys(JSON.parse(localStorage.getItem('moliya-komissiya-oxirgi') || '{}'))[0]]), 1, '1% shu qurilmada eslab qolindi');
  teng(await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('moliya-komissiya-oxirgi') || '{}')).length), 1, 'bitta hisob uchun');

  // ---- 3) Keyingi o'tkazmada oxirgi tanlov oldindan tanlanadi; "Yo'q" tanlansa u eslab qolinadi ----
  await otkazmaWizardi('50000', 'Karta A', 'Naqd pul');
  teng(await chiplar(), ['Yo\'q:false', '0,5%:false', '1%:true', 'Foiz…:false', 'Summa…:false'], 'oxirgi tanlov (1%) oldindan tanlangan');
  teng(bo(await p.locator('.kom-natija').innerText()), 'Komissiya: 500 Hisobdan jami chiqadi: 50 500', 'oldindan tanlangan foiz hisoblandi');
  await p.click('.kom-chiplar [data-kom="yoq"]');
  await p.click('#w-saqlash');
  await p.waitForSelector('.kun');
  teng((await yozuvlar()).length, 3, 'Yo\'q: faqat o\'tkazma qo\'shildi');
  teng(await qoldiq('Karta A'), 1000000 - 101000 - 50000, 'Yo\'q: faqat 50 000 chiqdi');
  await otkazmaWizardi('20000', 'Karta A', 'Naqd pul');
  teng((await chiplar())[0], 'Yo\'q:true', '"Yo\'q" ham eslab qolindi');
  await p.click('.nav-tugma[data-bolim="tarix"]');
  await p.waitForSelector('.kom-ichki');

  // ---- 4) Tahrirlash: komissiya qatorini bosish o'tkazma tahririni ochadi, qism to'ldirilgan ----
  await p.click('.kom-ichki');
  await p.waitForSelector('form .kom-qism');
  teng(await p.textContent('h1'), 'Yozuvni tahrirlash', 'tahrir shakli');
  teng(await p.inputValue('#f-summa'), '100 000', 'o\'tkazma summasi (komissiya emas)');
  teng(await p.evaluate(() => document.querySelector('.tanlov button[aria-pressed="true"]').textContent), 'O\'tkazma', 'tur o\'tkazma');
  teng(await chiplar(), ['Yo\'q:false', '0,5%:false', '1%:true', 'Foiz…:false', 'Summa…:false'], 'komissiya qismi to\'ldirilgan (1%)');
  teng(bo(await p.locator('.kom-natija').innerText()), 'Komissiya: 1 000 Hisobdan jami chiqadi: 101 000', 'tahrirda jami');
  await olchov('tahrir shakli'); await rasm('5-tahrir');
  await p.fill('#f-summa', '200 000');
  teng(bo(await p.locator('.kom-natija').innerText()), 'Komissiya: 2 000 Hisobdan jami chiqadi: 202 000', 'summa o\'zgarsa komissiya darhol yangilanadi');
  await p.click('form button[type="submit"]');
  await p.waitForSelector('.kom-ichki');
  let yoz2 = await yozuvlar(); const ko2 = yoz2.filter((y) => y.bog_id === ot.id);
  teng([yoz2.length, ko2.length, ko2[0].id === ko.id, ko2[0].summa, yoz2.filter((y) => y.id === ot.id)[0].summa], [3, 1, true, 2000, 200000], 'tahrir: komissiya yozuvi (o\'sha id) yangilandi, yangi qator qo\'shilmadi');
  teng(await qoldiq('Karta A'), 1000000 - 202000 - 50000, 'tahrirdan keyin qoldiq: 202 000 chiqqan');
  // "Summa…" ga o'tkazish
  await p.click('.kom-ichki'); await p.waitForSelector('form .kom-qism');
  await p.click('.kom-chiplar [data-kom="summa"]'); await p.fill('#kom-summa', '3000');
  await p.click('form button[type="submit"]'); await p.waitForSelector('.kom-ichki');
  teng(bo(await p.textContent('.kom-ichki .yozuv-nom')), 'Komissiya', 'summa rejimida foizsiz yorliq');
  await p.click('.kom-ichki'); await p.waitForSelector('form .kom-qism');
  teng(await p.evaluate(() => [...document.querySelectorAll('.kom-chiplar .chip')].map((b) => b.getAttribute('aria-pressed')).join()), 'false,false,false,false,true', 'summa rejimi qayta ochilganda to\'ldirilgan'); teng(await p.inputValue('#kom-summa'), '3 000', 'summa qiymati');
  // "Yo'q" -> komissiya mantiqiy o'chadi
  await p.click('.kom-chiplar [data-kom="yoq"]');
  await p.click('form button[type="submit"]'); await p.waitForSelector('.kun');
  teng(await p.locator('.kom-ichki').count(), 0, '"Yo\'q": ichki qator yo\'q');
  const hammasi = await p.evaluate(() => Data.hammasiniOqish());
  teng(hammasi.yozuvlar.filter((y) => y.id === ko.id)[0].deleted, true, '"Yo\'q": komissiya mantiqiy o\'chirilgan (tombstone)');
  teng(await qoldiq('Karta A'), 1000000 - 200000 - 50000, '"Yo\'q": qoldiq faqat o\'tkazma');

  // ---- 5) O'tkazma o'chirilsa komissiya ham o'chadi; "Bekor qilish" ikkalasini qaytaradi ----
  const ot2 = yoz2.filter((y) => y.tur === 'otkazma' && y.summa === 200000)[0];
  await p.evaluate(async (id) => { const y = (await Data.hammasi('yozuvlar')).filter((x) => x.id === id)[0]; await Data.otkazmaniSaqlash(y, { summa: 2000, izoh: 'O\'tkazma komissiyasi (1%)' }); }, ot2.id);
  await p.reload(); await p.waitForFunction(() => document.querySelector('#ekran h1'));
  await p.click('.nav-tugma[data-bolim="tarix"]'); await p.waitForSelector('.kom-ichki');
  await p.click('.kom-ichki'); await p.waitForSelector('form .kom-qism');
  await p.click('.xavfli-tugma:has-text("O\'chirish")');
  await p.waitForSelector('.kun');
  teng(await p.locator('.kom-ichki').count(), 0, 'o\'tkazma o\'chdi: komissiya qatori ham yo\'q');
  const qolgan = await yozuvlar();
  teng(qolgan.some((y) => y.id === ot2.id || y.bog_id === ot2.id), false, 'ikkalasi ham o\'chirilgan');
  teng(await qoldiq('Karta A'), 1000000 - 50000, 'qoldiq o\'tkazma va komissiyasiz');
  await p.click('.xabar button:has-text("Bekor qilish"), button:has-text("Bekor qilish")');
  await p.waitForSelector('.kom-ichki');
  const qaytdi = await yozuvlar();
  teng(qaytdi.filter((y) => y.id === ot2.id || y.bog_id === ot2.id).length, 2, '"Bekor qilish": ikkalasi qaytdi');
  teng(await qoldiq('Karta A'), 1000000 - 202000 - 50000, 'qoldiq qaytdi');

  // ---- 6) Bog'langan o'tkazmasi topilmagan komissiya oddiy xarajat qatori ----
  await p.evaluate(async (id) => { await Data.ochirish('yozuvlar', id); }, ot2.id);
  await p.reload(); await p.waitForFunction(() => document.querySelector('#ekran h1'));
  await p.click('.nav-tugma[data-bolim="tarix"]'); await p.waitForSelector('.kun');
  teng(await p.locator('.kom-ichki').count(), 0, 'yetim komissiya ichki qator emas');
  teng(await p.evaluate(() => [...document.querySelectorAll('.kun .yozuv-nom')].map((x) => x.textContent.replace(/\s+/g, ' ').trim()).filter((t) => /Komissiya/.test(t))), ['Komissiya'], 'yetim komissiya oddiy xarajat qatori (kategoriya nomi bilan)');
  await olchov('Tarix (yetim)'); await rasm('6-tarix-yetim');
  await kontekst.close();
}

(async () => {
  const brauzer = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  for (const tema of ['light', 'dark']) await senariy(brauzer, tema);
  await brauzer.close();
  console.log('\n' + (jami - xatolar) + ' / ' + jami + ' tekshiruv o\'tdi' + (xatolar ? ', ' + xatolar + ' ta XATO' : ''));
  process.exit(xatolar ? 1 : 0);
})().catch((e) => { console.log('SINOV TO\'XTADI: ' + e.message); process.exit(1); });
