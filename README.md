# Moliya

Shaxsiy moliya ilovasi (telefon uchun veb-ilova). Texnik topshiriq: `TZ.md`.
Hozirgi holat: **5-bosqich** (yozuvlar, hisoblar, o'tkazma, kategoriyalar, filtr va qidiruv, hisobotlar).

## Kompyuterda ishga tushirish

Ilovani `index.html` ni ikki marta bosib emas, lokal server orqali oching
(service worker keyingi bosqichlarda `file://` da ishlamaydi). Papkada:

    python3 -m http.server 8000

So'ng brauzerda oching:

- Ilova: http://localhost:8000/
- Testlar: http://localhost:8000/tests.html

## Versiya

Ilova versiyasi `index.html` dagi `<meta name="versiya" content="...">` da yoziladi va "Yana" bo'limining
pastida ko'rinadi. Shu raqam `style.css?v=...` va `js/*.js?v=...` havolalarida ham turadi, shuning uchun
versiya o'zgarsa, brauzer eski fayllarni emas, yangilarini yuklaydi.

**Har yangilanishda versiyani oshiring** (misol: 0.13.0 → 0.13.1), `index.html` va `tests.html` da hammasini birdaniga:

    sed -i 's/0\.6\.0/0.7.0/g' index.html tests.html

`tests.html` dagi versiya testlari havolalar bir xil versiyada ekanini tekshiradi.

## Joylash

GitHub Pages bo'yicha yo'riqnoma 10-bosqichda yoziladi.
