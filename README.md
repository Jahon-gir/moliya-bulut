# Chuntak AI

Shaxsiy moliya ilovasi (telefon uchun veb-ilova, PWA): xarajat, daromad, qarz, byudjet va hisobotlar.
Ma'lumot faqat qurilmada saqlanadi, hech qayerga yuborilmaydi. Texnik topshiriq: `TZ.md`.

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

**Har yangilanishda versiyani oshiring** (misol: 0.21.0 → 0.21.1), `index.html` va `tests.html` da hammasini birdaniga:

    sed -i 's/0\.14\.0/0.21.0/g' index.html tests.html

`sw.js` ning o'zida versiya yo'q: u o'z manzilidagi `?v=` dan oladi. Agar `js/` ga yangi fayl qo'shsangiz, uni `index.html` ga
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
