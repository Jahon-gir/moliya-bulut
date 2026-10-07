# Chuntak AI: ish qoidalari (Claude uchun)

Bu loyiha: shaxsiy moliya ilovasi (daromad, xarajat, hisoblar, qarzlar, byudjet, hisobot). Telefonda o'rnatiladigan veb-ilova (PWA), server yo'q, ma'lumot foydalanuvchi brauzerining IndexedDB xotirasida saqlanadi. Tashqi kutubxona ishlatilmaydi. Asosiy topshiriq: `TZ.md`. Foydalanuvchi dasturchi emas (boshlovchi), shuning uchun tushuntirishlar sodda bo'lsin.

## 1. Til va hisobot

- Barcha matn (ilova, izohlar, commit xabarlari, hisobot) o'zbek tilida, lotin yozuvida.
- Hisobot qisqa: nima o'zgardi, nima tekshirildi, foydalanuvchi nimani qanday tekshirishi kerak, ochiq qolgan masalalar va qabul qilingan taxminlar.
- Tekshirilmagan narsani "tekshirdim" dema. Tekshira olmagan narsani (masalan, haqiqiy telefon, Excel) ochiq yoz.

## 2. Ish tartibi

- Bir vaqtda bitta ish. Foydalanuvchi aytmaguncha keyingisiga o'tma.
- `TZ.md` da yo'q narsani qo'shma. Noaniq joyda taxmin qilma, so'ra (agar so'rash imkoni bo'lmasa, eng sodda variantni tanla va hisobotda ochiq yoz).
- Boshqa ilovalarning nomi, belgisi, rasmi, matni va ranglari nusxalanmasin. Belgilarni o'zing chiz (SVG).
- Har ishdan keyin versiyani oshir: `index.html` dagi `<meta name="versiya">` va `?v=` havolalari (hamda `tests.html` dagilar; README dagi `sed` buyrug'i). `sw.js` ga tegma: u versiyani o'z manzilidagi `?v=` dan oladi (`pwa.js` uni `index.html` versiyasi bilan ro'yxatdan o'tkazadi). Shunda telefon yangi fayllarni yuklaydi. Yangi fayl qo'shilsa, uni `sw.js` dagi `royxat()` ga ham qo'sh.

## 3. Sinov tartibi (tezlik va tejash uchun)

- Ish davomida faqat o'zgargan qismning testlarini yurgiz.
- Ma'lumot tuzilishi (sxema) o'zgarsa: migratsiya sinovi eski bazaning nusxasida shu zahoti. Hech narsa o'chmasin, migratsiya ikki marta ishlasa ham buzilmasin, zaxira va tiklash yangi maydonni qo'llasin.
- To'liq birlik va asosiy brauzer sinovlari merge'dan oldin bir marta.
- Ko'rinishi o'zgargan ekranlar uchun 360 px kenglikda yorug' va qorong'i rejim tekshiruvi (butun ilova uchun emas).
- Barcha vaqt zonalari sinovi va butun ilova bo'yicha yakuniy sinov faqat foydalanuvchi "yakuniy sinov" deb aytganida.
- Barcha kerakli testlar o'tsa pull request'ni merge qil, shubha bo'lsa merge qilma va sababini yoz.

## 4. Ma'lumot xavfsizligi

- Foydalanuvchi ma'lumoti IndexedDB da. Bazaning nomi (`moliya`) va sozlama kalitlari o'zgarmaydi: ilova nomi o'zgarsa ham ma'lumot yo'qolmasin.
- Service worker (`sw.js`) IndexedDB ga hech qachon tegmaydi. Keshlash xatosi ma'lumotni buzmasin.
- Tiklash, import va migratsiya: avval tekshiruv, keyin bitta tranzaksiya, xato bo'lsa hech narsa o'zgarmasin. Tiklashdan oldin joriy holatning zaxirasi yuklab berilsin.

## 5. Repozitoriy ochiq (public)

Quyidagilar repozitoriyga hech qachon qo'shilmasin: haqiqiy foydalanuvchi ma'lumoti, Excel va zaxira (JSON) fayllari, parol, API kalit, token, `service_role` va boshqa maxfiy kalitlar. Sinov uchun faqat uydirma ma'lumot ishlat.

## 6. Muhim qoidalar (TZ.md dan)

- Yozuv vaqti hozirgi vaqtdan keyin bo'lmaydi, o'tmish mumkin. Qarz va to'lovlarga ham tegishli (qaytarish muddati bundan mustasno).
- O'tkazma va qarz amallari hisob qoldig'ini o'zgartiradi, lekin daromad yoki xarajat sifatida hisobotga, byudjetga va diagrammalarga kirmaydi.
- Balans va hisob qoldig'i yozuvlardan hisoblanadi, alohida saqlanmaydi.
- Kategoriya va hisob nomlari takrorlanmaydi (katta-kichik harf, bo'shliq va apostrof turlariga e'tiborsiz).
- Summa butun son (so'm), ko'rsatishda mingliklar ajratiladi.
- Telefon avvalo: 360 px, tugmalar kamida 44 px, yorug' va qorong'i rejim, `aria-label`.
