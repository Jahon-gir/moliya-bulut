// AI yordamchi chati (TZ-sinxronlash.md 33-band) uchun brauzer sinovi: HAQIQIY ilova (index.html, haqiqiy IndexedDB), lekin server javobi SOXTA
// (tarmoqqa chiqilmaydi). Faqat uydirma ma'lumot va uydirma ism. Faqat ishlab chiqish vaqtida; ilovaning o'zi uni ishlatmaydi.
// Ishga tushirish: avval  python3 -m http.server 8000  (repozitoriy papkasida), keyin
//   node tools/chat-brauzer-sinovi.js [rasmlar_papkasi]      (Playwright va Chromium kerak; PLAYWRIGHT_MODULE, CHROMIUM_PATH, ILOVA_MANZIL o'zgaruvchilari ixtiyoriy)
// Yorug' va qorong'i rejimda 360 px kenglikda yuradi, ekran rasmlari papkaga yoziladi. Xato bo'lsa chiqish kodi 1.
const fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const MANZIL = process.env.ILOVA_MANZIL || 'http://localhost:8000/index.html';
const RASMLAR = process.argv[2] || path.join(os.tmpdir(), 'chat-rasmlar');
fs.mkdirSync(RASMLAR, { recursive: true });

let jami = 0, xatolar = 0;
function teng(haqiqiy, kutilgan, izoh) {
  jami++;
  if (JSON.stringify(haqiqiy) !== JSON.stringify(kutilgan)) { xatolar++; console.log('  ✗ ' + izoh + ' — kutilgan: ' + JSON.stringify(kutilgan) + ', chiqdi: ' + JSON.stringify(haqiqiy)); }
}

async function senariy(brauzer, tema) {
  console.log('== ' + tema + ' rejim, 360 px ==');
  const kontekst = await brauzer.newContext({ viewport: { width: 360, height: 740 }, colorScheme: tema, serviceWorkers: 'block' });
  const p = await kontekst.newPage();
  p.on('pageerror', (e) => { if (!/IDBObjectStore/.test(e.message)) { xatolar++; console.log('  ✗ PAGEERROR ' + e.message); } });
  const sorovlar = [];
  await p.route('**/functions/v1/yordamchi', async (r) => {
    const sarlavha = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'content-type': 'application/json' };
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: sarlavha });
    const tana = JSON.parse(r.request().postData()); sorovlar.push(tana);
    const j = tana.rejim === 'reja'
      ? { ok: true, reja: { tur: 'sorovlar', sorovlar: [{ amal: 'hisoblar', davr: { dan: '2026-01-01', gacha: '2026-12-31' }, davr2: null, tur: null, kategoriya: null, hisob: null, matn: null }] } }
      : { ok: true, matn: 'Hisoblaringiz bo\'yicha jami balans ko\'rsatildi.', davom: ['Qarzlarim qancha?'] };
    return r.fulfill({ status: 200, headers: sarlavha, body: JSON.stringify(j) });
  });
  await p.goto(MANZIL);
  await p.waitForFunction(() => typeof Data !== 'undefined' && document.querySelector('#ekran h1'));
  await p.evaluate(async () => {   // uydirma ma'lumot
    const his = (await Data.hammasi('hisoblar'))[0];
    await Data.saqlash('hisoblar', { id: Data.yangiId(), yaratilgan: new Date().toISOString(), nom: 'Uzum', tur: 'karta', belgi: 'karta', rang: '#2F5DDB', oxirgi4: '', boshlangich_qoldiq: 5000000, arxivlangan: false });
    void his;
  });
  await p.reload();
  await p.waitForFunction(() => document.querySelector('#ekran h1'));
  await p.evaluate(() => {   // soxta kirish: Google'siz; faqat shu sahifada. Ism uydirma
    Kirish.holat = () => ({ kirgan: true, id: 'u-sinov', email: '', ism: '', meta: { full_name: 'Sinov Foydalanuvchi', name: '' }, xato: '', kirmoqda: false });
    Kirish.tokenOl = () => Promise.resolve('sinov-token'); Kirish.tokenYangila = () => Promise.resolve('sinov-token');
    Yordamchi.hammasiniTozala(); Yordamchi.yangila();
    // eski suhbatlarni uydirma sana bilan qo'yamiz (kecha, 4 kun oldin, 30 kun oldin)
    const d = (k, s, m) => { const x = new Date(); x.setDate(x.getDate() - k); x.setHours(s, m, 0, 0); return x.getTime(); };
    const s = (id, nom, t) => ({ id: id, nom: nom, yaratilgan: t, yangilangan: t, xabarlar: [{ rol: 'savol', matn: nom, t: t }, { rol: 'javob', matn: 'Eski javob.', kartalar: [], davom: [], reja: { tur: 'suhbat', matn: 'Eski javob.' }, zaxira: false, t: t }] });
    localStorage.setItem('moliya-chat-suhbatlar', JSON.stringify(ChatSof.yozuvYasash('u-sinov', [s('a1', 'Kechagi xarajatlarim qancha bo\'lgan edi shu haqida batafsil ayting', d(1, 21, 15)), s('a2', 'Qarzlarim', d(4, 9, 30)), s('a3', 'Sentabr hisoboti', d(30, 18, 5))])));
  });
  const yoKorinadi = (sel) => p.locator(sel).isVisible();
  const tugma = p.locator('#yordamchi-tugma');
  teng(await tugma.isVisible(), true, '"Ko\'zlar" tugmasi ko\'rinadi');
  await tugma.click();
  teng(await yoKorinadi('.yo-ekran'), true, 'chat ochildi');

  // 1) bo'sh chat: salom
  teng(await p.textContent('.yo-salom'), 'Salom, Sinov!', 'salom va ism (birinchi so\'z)');
  teng(await p.textContent('.yo-bosh-holat .yo-izoh'), 'Nima haqida bilmoqchisiz?', 'savol matni');
  teng(await p.locator('.yo-tayyor').count(), 5, '5 ta tayyor savol');
  teng(await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.yo-salom')).fontSize)), 18, 'salom 18 px');
  teng(await p.textContent('.yo-sarlavha'), 'Yangi chat', 'bo\'sh chat nomi');
  teng(await p.evaluate(() => { const r = document.querySelector('.yo-salom').getBoundingClientRect(); return Math.abs((r.left + r.right) / 2 - 180) < 2; }), true, 'salom o\'rtada');
  const kichik = async () => p.evaluate(() => [...document.querySelectorAll('.yo-ekran button, .yo-ekran input')].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && getComputedStyle(b).visibility !== 'hidden' && r.height < 44 - 0.5; }).map((b) => b.id || b.className));
  teng(await kichik(), [], 'barcha tugma va maydonlar kamida 44 px (bo\'sh chat)');
  teng(await p.evaluate(() => document.documentElement.scrollWidth <= 360 && document.querySelector('.yo-ekran').scrollWidth <= 360), true, 'gorizontal aylanish yo\'q');
  const bosh = await p.evaluate(() => { const m = document.getElementById('yordamchi-menyu').getBoundingClientRect(), y = document.getElementById('yordamchi-yangi').getBoundingClientRect(); return [Math.round(m.width), Math.round(m.left), Math.round(y.width), Math.round(360 - y.right)]; });
  teng(bosh[0] >= 44 && bosh[2] >= 44 && bosh[1] <= 16 && bosh[3] <= 16, true, 'menyu chapda, "Yangi chat" o\'ngda (44 px)');
  teng(await p.evaluate(() => { const i = document.getElementById('yordamchi-kiritish'); return [i.maxLength, getComputedStyle(i).borderRadius]; }), [300, '24px'], '300 belgi limiti, yumaloq maydon');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-1-bosh-chat.png') });

  // 2) birinchi savol: o'ng pufak, vaqt, karta, davom savoli
  await p.click('.yo-tayyor >> nth=0');
  await p.waitForSelector('.yk-karta');
  teng(await p.evaluate(() => { const s = document.querySelector('.yo-savol').getBoundingClientRect(); return Math.round(360 - s.right) <= 20; }), true, 'savol o\'ngda');
  teng(await p.evaluate(() => [...document.querySelectorAll('.yo-vaqt')].map((v) => [/^\d\d:\d\d$/.test(v.textContent), parseFloat(getComputedStyle(v).fontSize)])), [[true, 11], [true, 11]], 'savol va javob tagida SS:DD vaqt, 11 px');
  teng(await p.evaluate(() => { const v = document.querySelector('.yo-vaqt-savol'), s = document.querySelector('.yo-savol'); return v.getBoundingClientRect().top >= s.getBoundingClientRect().bottom - 1 && getComputedStyle(v).color !== getComputedStyle(s).color; }), true, 'vaqt pufak tagida, kulrang');
  const nom1 = await p.textContent('.yo-sarlavha .yo-nom-matn');
  teng(nom1.length > 0 && nom1.length <= 40, true, 'chat nomi birinchi savoldan (≤ 40)');
  teng(sorovlar.length, 2, 'server: reja + javob');
  teng(JSON.stringify(sorovlar).indexOf('Sinov'), -1, 'ism serverga ketmadi');
  teng(await p.evaluate(() => (localStorage.getItem('moliya-chat-suhbatlar') || '').indexOf('Sinov')), -1, 'ism saqlanmadi');
  teng(await p.evaluate(() => JSON.parse(localStorage.getItem('moliya-chat-suhbatlar')).suhbatlar.length), 4, 'suhbat saqlandi (3 eski + 1 yangi)');
  teng(await kichik(), [], 'barcha tugmalar kamida 44 px (suhbat)');
  teng(await p.evaluate(() => document.querySelector('.yo-ekran').scrollWidth <= 360), true, 'gorizontal aylanish yo\'q (karta)');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-2-suhbat.png') });

  // 3) yon panel
  await p.click('#yordamchi-menyu');
  await p.waitForTimeout(350);
  const pn = await p.evaluate(() => { const r = document.querySelector('.yo-panel').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.width)]; });
  teng(pn[0], 0, 'panel chapdan ochildi'); teng(pn[1] >= 276 && pn[1] <= 284, true, 'panel eni ~78% (' + pn[1] + ' px)');
  teng(await p.evaluate(() => [...document.querySelectorAll('.yo-guruh-nom')].map((x) => x.textContent)), ['Bugun', 'Kecha', 'Oxirgi 7 kun', 'Oldinroq'], 'sana guruhlari');
  const vaqtlar = await p.evaluate(() => [...document.querySelectorAll('.yo-qator-vaqt')].map((x) => x.textContent));
  teng(/^\d\d:\d\d$/.test(vaqtlar[0]) && vaqtlar[1] === '21:15' && vaqtlar[2] === '09:30' || /^\d{1,2}-[a-z]{3}$/.test(vaqtlar[2]), true, 'vaqt: bugun/kecha — soat:daqiqa, boshqalari — "12-okt" (' + vaqtlar.join(', ') + ')');
  teng(/^\d{1,2}-[a-z]{3}$/.test(vaqtlar[3]), true, 'oldinroq: kun-oy (' + vaqtlar[3] + ')');
  teng(await kichik(), [], 'panelda barcha tugmalar kamida 44 px');
  teng(await p.evaluate(() => { const f = document.querySelector('.yo-panel-fon'); return getComputedStyle(f).opacity === '1' && parseFloat(getComputedStyle(f).backgroundColor.split(',')[3]) > 0; }), true, 'o\'ng tomoni xira fon');
  teng(await p.evaluate(() => document.querySelector('.yo-panel').scrollWidth <= document.querySelector('.yo-panel').clientWidth), true, 'panelda gorizontal aylanish yo\'q (uzun nom qirqildi)');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-3-panel.png') });
  // qidiruv
  await p.fill('.yo-qidiruv', 'qarz');
  teng(await p.locator('.yo-qator').count(), 1, 'qidiruv nom bo\'yicha');
  await p.fill('.yo-qidiruv', '');
  // uch nuqta menyusi
  await p.locator('.yo-uch').nth(1).click();
  teng(await p.evaluate(() => [...document.querySelectorAll('.yo-menu-band')].map((b) => b.textContent)), ['Nomini o\'zgartirish', 'O\'chirish'], 'uch nuqta menyusi');
  teng(await p.evaluate(() => [...document.querySelectorAll('.yo-menu-band')].every((b) => b.getBoundingClientRect().height >= 44)), true, 'menyu bandlari 44 px');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-4-uch-nuqta.png') });
  // nomini o'zgartirish (panelda)
  await p.click('.yo-menu-band >> nth=0');
  await p.fill('.yo-tahrir-kiritish', 'Bo\'sh qarzlar');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-5-panel-tahrir.png') });
  await p.press('.yo-tahrir-kiritish', 'Enter');
  teng(await p.locator('.yo-qator-matn', { hasText: 'Bo\'sh qarzlar' }).count(), 1, 'panelda nom Enter bilan saqlandi');
  // o'chirish + tasdiq
  await p.locator('.yo-uch').nth(1).click(); await p.click('.yo-menu-band >> nth=1');
  teng(await p.textContent('.yo-tasdiq-matn'), 'Suhbat o\'chirilsinmi?', 'tasdiq matni');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-6-tasdiq.png') });
  await p.click('.yo-tasdiq-ha');
  teng(await p.evaluate(() => JSON.parse(localStorage.getItem('moliya-chat-suhbatlar')).suhbatlar.length), 3, 'suhbat o\'chirildi');
  // fon bosilsa yopiladi, Escape ham
  await p.mouse.click(340, 400); await p.waitForTimeout(300);
  teng(await p.evaluate(() => document.querySelector('.yo-panel').getBoundingClientRect().right <= 0), true, 'fon bosilsa panel yopildi');
  await p.click('#yordamchi-menyu'); await p.waitForTimeout(300); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  teng([await yoKorinadi('.yo-ekran'), await p.evaluate(() => document.querySelector('.yo-panel').getBoundingClientRect().right <= 0)], [true, true], 'Escape paneli yopadi, chat ochiq qoladi');

  // 4) sarlavhada nomni tahrirlash
  await p.click('.yo-sarlavha .yo-nom');
  await p.fill('.yo-tahrir-kiritish', '');
  await p.click('.yo-saqlash');
  teng(await p.isVisible('.yo-tahrir-xato'), true, 'bo\'sh nom qabul qilinmaydi');
  await p.fill('.yo-tahrir-kiritish', 'x'.repeat(60));
  teng(await p.inputValue('.yo-tahrir-kiritish'), 'x'.repeat(40), '40 belgigacha');
  await p.press('.yo-tahrir-kiritish', 'Escape');
  teng([await p.locator('.yo-tahrir').count(), await yoKorinadi('.yo-ekran'), await p.textContent('.yo-sarlavha .yo-nom-matn')], [0, true, nom1], 'Escape tahrirni bekor qiladi');
  await p.click('.yo-sarlavha .yo-nom'); await p.fill('.yo-tahrir-kiritish', 'Mening hisoblarim');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-7-sarlavha-tahrir.png') });
  await p.click('.yo-saqlash');
  teng(await p.textContent('.yo-sarlavha .yo-nom-matn'), 'Mening hisoblarim', 'sarlavhada nom saqlandi');

  // 5) eski suhbatni tanlab davom ettirish (xotira shu suhbatdan)
  await p.click('#yordamchi-menyu'); await p.waitForTimeout(300);
  await p.click('.yo-qator-nom >> text=Sentabr hisoboti'); await p.waitForTimeout(300);
  teng(await p.textContent('.yo-sarlavha .yo-nom-matn'), 'Sentabr hisoboti', 'eski suhbat ochildi');
  await p.fill('#yordamchi-kiritish', 'va oktabrda?'); await p.press('#yordamchi-kiritish', 'Enter');
  await p.waitForSelector('.yk-karta');
  const tarix = sorovlar[sorovlar.length - 2].tarix;
  teng([tarix.length, tarix[0].savol], [1, 'Sentabr hisoboti'], 'davom ettirilgan suhbatda AI xotirasi shu suhbatdan');
  teng(await p.evaluate(() => JSON.parse(localStorage.getItem('moliya-chat-suhbatlar')).suhbatlar.length), 3, 'yangi suhbat yaratilmadi');
  await p.screenshot({ path: path.join(RASMLAR, tema + '-8-davom.png') });

  // 6) yangi chat va yopib-ochish: bo'sh chat; chiqish tugmasi
  await p.click('#yordamchi-yangi');
  teng(await p.locator('.yo-salom').count(), 1, 'Yangi chat: bo\'sh chat');
  await p.click('#yordamchi-menyu'); await p.waitForTimeout(300); await p.click('#yordamchi-orqaga');
  teng(await yoKorinadi('.yo-ekran'), false, '"Ilovaga qaytish" chatni yopadi');
  await tugma.click();
  teng([await p.locator('.yo-salom').count(), await p.locator('.yo-savol').count()], [1, 0], 'qayta ochilganda oxirgi suhbat ochilmaydi');

  // 7) chiqilsa (Kirish.kuzat) suhbatlar tozalanadi
  await p.evaluate(() => { Kirish.holat = () => ({ kirgan: false, id: '', meta: null }); });
  teng(await p.evaluate(() => { Yordamchi.hammasiniTozala(); return localStorage.getItem('moliya-chat-suhbatlar'); }), null, 'chiqilsa suhbatlar tozalanadi');
  // 8) klaviatura ochilganda moslashuv (mavjud qoida): ekran balandligi visualViewport ga bog'liq
  teng(await p.evaluate(() => typeof window.visualViewport !== 'undefined' && /visualViewport/.test(Yordamchi.ochish.toString())), true, 'klaviatura moslashuvi saqlangan');
  await kontekst.close();
}

(async () => {
  const brauzer = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  for (const tema of ['light', 'dark']) await senariy(brauzer, tema);
  await brauzer.close();
  console.log(xatolar ? '✗ XATO: ' + xatolar + ' / ' + jami : '✓ Hammasi o\'tdi: ' + jami + ' tekshiruv');
  console.log('Rasmlar: ' + RASMLAR);
  process.exit(xatolar ? 1 : 0);
})();
