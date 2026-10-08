# Chuntak AI

Shaxsiy moliya ilovasi (telefon uchun veb-ilova, PWA): xarajat, daromad, qarz, byudjet va hisobotlar.
Ma'lumot qurilma brauzerida (IndexedDB) saqlanadi va ilova **kirmasdan ham to'liq ishlaydi**. Google bilan kirsangiz (rozilik bilan),
ma'lumot Supabase serveriga nusxalanadi va boshqa qurilmalarda ko'rinadi (sinxronlash). Texnik topshiriq: `TZ.md`, sinxronlash: `TZ-sinxronlash.md`.

## Qanday ishlatish (ilova egasi uchun)

1. **Kirmasdan:** ilovani oching va ishlating. Hech narsa serverga ketmaydi.
2. **Sinxronlashni yoqish:** Menyu (☰) → Profil va sinxronlash → "Google bilan kirish". Tugmani bosish — tugma ustidagi rozilik matniga rozilik.
   Kirgan zahoti birinchi sinxron o'zi ishlaydi: ikkalasi bo'sh bo'lsa yoqiladi; qurilmada bor, server bo'sh bo'lsa yuklanadi; qurilma bo'sh (faqat
   tayyor "Naqd pul" va kategoriyalar), serverda bor bo'lsa tortiladi; ikkalasida ham bor bo'lsa **tanlov ekrani** chiqadi (Birlashtirish / Faqat
   serverdagini olish / Faqat shu qurilmadagini yuborish; avval zaxira fayli yuklanadi).
3. **Keyin:** o'zgarishlar avtomatik yuboriladi, boshqa qurilmadagilari avtomatik olinadi. Asosiy ekran va Profilda holat: "Sinxronlangan",
   "Kutilmoqda (N ta o'zgarish)", "Internet yo'q", "Xato" (sabab "(kod: ...)" bilan va "Qayta urinish").
4. **Chiqish** faqat shu qurilmadan chiqadi (ma'lumot qoladi). **Hisobni o'chirish** serverdagi akkaunt va hamma ma'lumotni o'chiradi (shu qurilmadagi ma'lumot qoladi; avval zaxira fayli yuklanadi).
5. **Excelga yuklab olish** (Menyu) — daromad, xarajat va o'tkazmalar chiroyli .xlsx faylga. **Fayldan yuklash** (Menyu → Profil) — Excel (.xlsx) fayldan yozuvlarni oldindan ko'rib, tasdiqlab yuklash; "Oxirgi yuklashni bekor qilish" bor (TZ-sinxronlash.md, 18-band). JSON zaxira oddiy ko'rinishda yashirin (Menyu pastidagi versiya qatorini 7 marta bosing); u sinxronlash o'rnini bosmaydi.
6. **Telefon yo'qolsa / almashsa:** yangi qurilmada ilovani oching, shu Google bilan kiring: serverdagi ma'lumot o'zi qaytadi.

## Tuzilma

| Papka/fayl | Nima |
|---|---|
| `index.html`, `style.css`, `manifest.json`, `sw.js` | Ilova sahifasi, uslub, PWA, service worker (kesh; IndexedDB ga tegmaydi) |
| `js/calc.js`, `js/data.js` | Hisob-kitob qoidalari (sof), mahalliy baza (IndexedDB `moliya`, sxema 7, navbat) |
| `js/ui.js`, `js/glidirak.js`, `js/diagramma.js`, `js/tema.js`, `js/pin*.js`, `js/pwa.js` | Ekranlar va ular bilan bog'liq narsalar |
| `js/kirish.js`, `js/sinxron-sof.js`, `js/sinxron.js`, `js/yuklash.js` | Google bilan kirish, sinxron qoidalari (sof), sinxron tsikli va birinchi sinxron, serverga yuborish yordamchilari |
| `js/vendor/` | Ichki kutubxonalar (`@supabase/auth-js`, `@supabase/postgrest-js`, MIT); CDN yo'q |
| `supabase/` | Serverdagi baza: SQL fayllar (001–006), testlar, `README.md` (qadamma-qadam) |
| `maxfiylik.html` | Maxfiylik va foydalanish shartlari (alohida ochiq sahifa) |
| `tests.html` | Avtomatik birlik testlari (brauzerda) |

## Ma'lum cheklovlar

- **To'qnashuv:** bir qator ikki qurilmada o'zgartirilsa, serverga OXIRGI YETIB BORGAN o'zgarish saqlanadi (maydonlar alohida birlashtirilmaydi). Tafsilot: `TZ-sinxronlash.md`, 15-band.
- **Takror nomlar:** ikki qurilmada bir vaqtda bir xil nomli hisob/kategoriya qo'shilsa, ikkita bo'lib qoladi (ma'lumot yo'qolmaydi; ortiqchasini arxivlang).
- **Shifrlanmagan:** serverdagi ma'lumot shifrlanmagan; dasturchi texnik jihatdan ko'ra oladi (maxfiylik sahifasida ochiq aytilgan).
- Zaxiradan tiklashda zaxirada yo'q, lekin serverda bor qatorlar o'chirilmaydi va qaytib keladi.
- O'chirilgan qatorlar serverda 90 kun saqlanadi, keyin tozalanadi (`supabase/005_sinxron_xizmat.sql`; pg_cron kerak).
- Boshqa qurilmada hisob o'chirilsa, bu qurilmada "akkaunt o'chirilgan" xabari chiqadi: chiqib, qayta kiring.

Ilova nomi `js/ilova.js` dagi `ILOVA` o'zgaruvchisida **bitta joyda** turadi (ilova ichidagi matnlar, sahifa sarlavhasi, fayl nomlari
shundan olinadi). `manifest.json` va `index.html` statik fayl bo'lgani uchun o'zgaruvchini o'qiy olmaydi: nomni o'zgartirsangiz,
ularni ham qo'lda yangilang (`tests.html` ularning bir xilligini tekshiradi).

## Kompyuterda ishga tushirish va sinash

Ilovani `index.html` ni ikki marta bosib emas, lokal server orqali oching (service worker `file://` da ishlamaydi).
`localhost` xavfsiz manzil hisoblanadi, shuning uchun HTTPS kerak emas. Papkada:

    python3 -m http.server 8000

So'ng brauzerda oching:

- Ilova: http://localhost:8000/
- Testlar: http://localhost:8000/tests.html

**Internetsiz ishlashni sinash:** ilovani bir marta oching va bir-ikki soniya kuting (fayllar keshlanadi). Keyin
brauzer DevTools → Application → Service Workers da "Offline" ni yoqing (yoki serverni to'xtating) va sahifani yangilang:
ilova to'liq ishlaydi.

**Yangilanishni sinash:** ilovani oching, so'ng versiyani oshiring (pastga qarang), saqlang va ilovaga qaytib
sahifani bir marta ko'ring (yoki bir necha soniya kuting): pastda "Yangi versiya tayyor" va "Yangilash" tugmasi chiqadi.
Tugma bosilganda ilova yangi versiyada qayta ochiladi; ma'lumotlar o'zgarmaydi.

## Versiya

Ilova versiyasi `index.html` dagi `<meta name="versiya" content="...">` da yoziladi va "Ko'proq" bo'limining
pastida ko'rinadi. Shu raqam `style.css?v=...` va `js/*.js?v=...` havolalarida ham turadi, service worker esa `sw.js?v=...`
orqali shu versiyadagi keshni yaratadi va eski keshni o'chiradi.

**Har yangilanishda versiyani oshiring** (misol: 0.26.0 → 0.26.1), `index.html` va `tests.html` da hammasini birdaniga:

    sed -i 's/0\.23\.0/0.26.1/g' index.html tests.html

`sw.js` ning o'zida versiya yo'q: u o'z manzilidagi `?v=` dan oladi (alohida o'zgartirish kerak emas). Agar `js/` ga yangi fayl qo'shsangiz, uni `index.html` ga
va `sw.js` dagi `royxat()` ga ham qo'shing (`tests.html` mosligini tekshiradi).

## Ilova belgisi

`icons/icon.svg` — o'zimiz chizgan belgi. PNG variantlari (192, 512, maskable, apple-touch) undan yasaladi:

    node tools/ikonka-yasash.js        # Playwright va Chromium kerak

## Joylash (GitHub Pages)

Repozitoriya sozlamalarida Settings → Pages → "Deploy from a branch" → `main` / `/ (root)`. Service worker faqat HTTPS da
ishlaydi (GitHub Pages HTTPS beradi). Barcha yo'llar nisbiy, shuning uchun ilova `https://<nom>.github.io/<repo>/` kabi
pastki yo'lda ham ishlaydi.

## Google bilan kirish (Supabase)

Kirish ixtiyoriy: kirmasdan ilova to'liq ishlaydi. Ochiq (publishable) kalit va loyiha manzili `js/kirish.js` da turadi; **maxfiy kalit
(`service_role`), Google Client Secret va parollar repozitoriyga hech qachon yozilmaydi.**

Supabase sozlamasi (bir marta): Authentication → URL Configuration → **Redirect URLs** ga qo'shing:
`http://localhost:8000/` (kompyuterda sinash uchun) va joylangan manzil (`https://<nom>.github.io/moliya-bulut/`).

Kutubxona `js/vendor/supabase-auth.min.js` (ichki nusxa, MIT; kerak bo'lsa qayta yig'ish: `bash tools/supabase-auth-yasash.sh`). Jadval kutubxonasi (S4, serverga yuklash): `js/vendor/supabase-postgrest.min.js` (`bash tools/supabase-postgrest-yasash.sh`).

## Maxfiylik sahifasi

`maxfiylik.html` — alohida ochiq sahifa (GitHub Pages: `https://jahon-gir.github.io/moliya-bulut/maxfiylik.html`). Google Cloud → Branding dagi "privacy policy" manzili shu bo'lishi kerak.
