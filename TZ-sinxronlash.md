# TZ: Chuntak AI, profil va sinxronlash (3-versiya, 1-qism)

Hujjat versiyasi: 22 (09.10.2026): 27-band (Tarix jamlarida qarz amallari, ilova 0.35.0) qo'shildi. Oldingi: 21 (09.10.2026): 26-band (AI yordamchi: erkin savollar va suhbat xotirasi, ilova 0.34.0) qo'shildi. Oldingi: 20 (09.10.2026): 25-band (AI yordamchi: kartochkali javoblar va tuzatishlar, ilova 0.33.0) qo'shildi. Oldingi: 19 (09.10.2026): 24-band (AI yordamchi: tugma, chat ekrani va hisoblash, ilova 0.32.0) qo'shildi. Oldingi: 18 (09.10.2026): 23-band (AI yordamchi: server qismi) qo'shildi. Oldingi: 17 (09.10.2026): 22-band (kategoriya ikonlari va Tarix ko'rinishi) qo'shildi. Oldingi: 16 (09.10.2026): 21-band (yangi dizayn) qo'shildi. Oldingi: 15 (09.10.2026): 20-band (soddalashtirish) qo'shildi. Oldingi: 14 (24.10.2026): 19-band (qarz amallari hisobotda) qo'shildi. Oldingi: 13 (23.10.2026): 18.5 (daromad/xarajat rangi va bog'liqlik xatosi) qo'shildi. Oldingi: 12 (22.10.2026): 18.4 (importdagi jiddiy xatolarni tuzatish, hisob qoldiqlarini moslash, sinxron xatosini ko'rsatish) qo'shildi. Oldingi: 11 (21.10.2026): 18.3 (qarz qatorlarini yuklash) qo'shildi. Oldingi: 10 (20.10.2026): 18-band (kirish ekrani va fayldan yuklash) qo'shildi. Oldingi: 8 (19.10.2026): S8 (yakuniy bosqich) bajarildi (17-band). Oldingi: 7 (18.10.2026): S6 va S7 bajarildi (16-band). Oldingi: 6 (17.10.2026): 0.20.1 xato tuzatish (15-band oxiri). Oldingi: 5 (16.10.2026): S5 bajarildi (15-band). S4: 14-band. Oldingi: S1 va S2 bajarildi (S2: faqat Google bilan kirish), 7-band "Menyu" ga moslandi, 13-band (S2 natijasi) qo'shildi. Bu TZ asosiy TZ.md ga qo'shimcha: undagi qoidalar (bir vaqtda bitta bosqich, TZ'da yo'q narsani qo'shmaslik, noaniq joyda so'rash, o'zbekcha matn, "vaqt hozirdan keyin bo'lmaydi", zaxira va migratsiya qoidalari) o'z kuchida.

## 1. Maqsad

Ilova ma'lumotini telefon brauzeridan tashqarida, himoyalangan serverda ham saqlash:

1. Telefon yo'qolsa yoki almashsa, profilga kirib ma'lumotni qaytarish.
2. Telefon va kompyuterda bir xil ma'lumotni ko'rish.
3. Hozirgi afzalliklarni yo'qotmaslik: ilova internetsiz to'liq ishlashi va tez bo'lishi.

## 2. Asosiy qarorlar

| Qaror | Tanlov | Sababi |
|---|---|---|
| Xizmat | Supabase (bepul tarif) | Baza, kirish va funksiya bitta joyda |
| Yondashuv | "Avval qurilma" (local-first) | Ilova hozirgidek IndexedDB bilan ishlaydi, server unga qo'shimcha. Internet bo'lmasa ham ishlaydi |
| Kirish | Email (bir martalik kod) va Google | Parol saqlash va unutish muammosi yo'q |
| Shifrlash | 1-qismda yo'q (server himoyasi va RLS bilan) | Murakkablik va "parolni unutsangiz ma'lumot yo'qoladi" xavfi. Keyin alohida qaror |
| Kirish majburiy emas | Ha | Kirmagan foydalanuvchi ilovani hozirgidek serversiz ishlatadi |
| Qo'lda zaxira | Qoladi | Bepul tarifda serverda avtomatik zaxira yo'q |

## 3. Qilinmaydi (bu qismda)

- Ma'lumotni foydalanuvchi parolida shifrlash (end-to-end).
- Bir nechta foydalanuvchi o'rtasida umumiy hisob.
- Sun'iy intellekt (matndan yozuv, chek rasmi). Bu alohida TZ.
- Valyuta, takroriy to'lovlar, PIN-kod (2-versiya).
- Bildirishnoma va fon rejimida sinxronlash.

## 4. Xavfsizlik talablari (majburiy)

1. **Qator darajasidagi himoya (RLS)** barcha jadvallarda yoqilgan. Har qator faqat egasiga (`auth.uid()`) ko'rinadi va o'zgartiriladi. RLS o'chiq jadval bo'lmasligi shart.
2. Ilova kodida va repozitoriyda (u ochiq) faqat Supabase **ochiq (anon/publishable) kaliti** bo'ladi. `service_role` yoki boshqa maxfiy kalit ilovaga va repozitoriyga hech qachon yozilmaydi.
3. Foydalanuvchi faqat o'z qatorlarini yoza oladi: `user_id` serverda `auth.uid()` ga majburiy tenglashtiriladi, ilovadan kelgan qiymatga ishonilmaydi.
4. Kirish: email kodi yoki Google. Bir urinish chegarasi va kod muddati Supabase sozlamalarida yoqilgan.
5. Foydalanuvchi o'z hisobini va serverdagi barcha ma'lumotini ilovadan o'chira oladi.
6. Serverga ketadigan ma'lumot: yozuvlar, hisoblar, kategoriyalar, byudjet, qarzlar va ularning to'lovlari. Xarajat izohlari ham. To'liq karta raqami saqlanmaydi (ilovada ham yo'q, faqat oxirgi 4 raqam).
7. Birinchi kirishda aniq ogohlantirish: "Ma'lumotlaringiz Supabase serverida saqlanadi".
8. Supabase va GitHub hisoblarida ikki bosqichli himoya yoqilgan (bu sizning ishingiz).

## 5. Ma'lumot tuzilishi (serverda)

Har jadvalda: `id` (UUID), `user_id`, `created_at`, `updated_at` (serverda avtomatik), `deleted` (mantiqiy o'chirish, "tombstone").

Jadvallar: `hisoblar`, `kategoriyalar`, `yozuvlar`, `byudjetlar`, `qarzlar`, `qarz_tolovlari`, `sozlamalar`. Maydonlar ilovadagi bilan bir xil (TZ.md 7-band), faqat yuqoridagi umumiy maydonlar qo'shiladi.

**Haqiqiy tuzilma (S1, `supabase/001_sxema.sql`).** Ilovadagi sxema 6 maydonlari serverdagi ustunlarga quyidagicha mos keladi. Hamma jadvalda umumiy ustunlar: `id` (UUID), `user_id` (auth.users ga bog'langan, serverda `auth.uid()` ga majburlanadi), `created_at`, `updated_at` (ikkalasi serverda belgilanadi; `user_id` va `created_at` o'zgarmaydi), `deleted`.

| Jadval | Ilovadagi maydon → serverdagi ustun |
|---|---|
| `hisoblar` | `yaratilgan` → `yaratilgan` (timestamptz); `nom`, `tur` (karta/bank/naqd/boshqa), `belgi`, `rang`, `oxirgi4` (bo'sh yoki aynan 4 raqam), `boshlangich_qoldiq` (butun son), `arxivlangan` → shu nomli ustunlar |
| `kategoriyalar` | `yaratilgan`, `nom`, `tur` (daromad/xarajat), `rang`, `belgi`, `arxivlangan` → shu nomli ustunlar |
| `yozuvlar` | `yaratilgan`; `tur` (daromad/xarajat/otkazma); `summa` → bigint (> 0); `sana` → date; `vaqt` ("HH:MM") → time; `hisob_id`, `qabul_hisob_id`, `kategoriya_id` → UUID (o'z qatoriga tashqi kalit); `izoh` |
| `byudjetlar` | `kategoriya_id` (kategoriya yoki `"umumiy"`) → `kategoriya_id` (UUID; **"umumiy" = NULL**); `oylik_limit` → bigint. Ilovada kalit `kategoriya_id` edi, serverda alohida `id` bor |
| `qarzlar` | `yaratilgan`, `yonalish` (berdim/oldim), `shaxs`, `summa`, `hisob_id`, `sana`, `vaqt`, `muddat` (bo'sh = **NULL**), `izoh`, `yopilgan` |
| `qarz_tolovlari` | ilovada `qarz.tolovlar[]` ro'yxati → alohida jadval: `qarz_id` (UUID), `sana`, `vaqt`, `summa`, `hisob_id`; to'lovning ilovadagi `id` si → `id` |
| `sozlamalar` | ilovadagi `asosiy` yozuvi → har foydalanuvchiga **bitta qator** (`user_id` unikal): `sxema_versiyasi`, `oxirgi_zaxira_sanasi` (date), `balans_yashirin`, `tema`. **PIN yozuvi (`pin`) serverga yozilmaydi** (faqat qurilmada) |

Serverda tekshiriladigan qoidalar faqat TZ.md 7-bandidagi tuzilmadan: tur qiymatlari, summa > 0, `oxirgi4`, o'tkazmada qabul qiluvchi hisob (boshqa hisob) va kategoriya yo'qligi, boshqa turlarda kategoriya majburiy. Nom takrorlanmasligi va jadvallararo qoidalar (kategoriya turi yozuv turiga mos, to'lovlar yig'indisi qarzdan oshmasligi) bazada tekshirilmaydi: sinxronlashda to'qnashuv chiqarmasligi uchun ularni ilova tekshiradi. Himoya: faqat `authenticated` roliga ruxsat, `anon` ga hech narsa, RLS (egasi), server triggeri. Ishga tushirish va tekshirish: `supabase/README.md`.

**Hisoblanadigan narsa serverga yozilmaydi:** balans, hisob qoldig'i, hisobot jamlari ilovada yozuvlardan hisoblanadi. Shunda ikki qurilmada raqam farq qilmaydi.

**Mahalliy ID.** Hozirgi ID lar (hisob, yozuv va h.k.) qurilmalar orasida takrorlanishi mumkin. Shuning uchun ular UUID ga o'tkaziladi (migratsiya). Eksportdagi "Y-000123" ko'rinishidagi ID lar faqat ko'rsatish uchun, ularga tegilmaydi.

## 6. Sinxronlash qoidalari

1. **Yozish doim avval mahalliy bazaga** (hozirgidek). Keyin o'zgarish "yuborish navbati"ga (outbox) tushadi va internet bo'lganda serverga yuboriladi.
2. **O'qish:** ilova hamma narsani mahalliy bazadan ko'rsatadi. Server o'zgarishlari alohida tortib olinadi (oxirgi sinxron vaqtidan keyingilar) va mahalliy bazaga qo'shiladi.
3. **To'qnashuv:** bir qator ikki qurilmada o'zgargan bo'lsa, `updated_at` bo'yicha oxirgisi g'olib ("oxirgi yozgan g'olib"), har qator alohida hal qilinadi.
4. **O'chirish:** qator darhol o'chirilmaydi, `deleted = true` bo'ladi, shunda boshqa qurilma ham o'chirishni biladi. 90 kundan keyin serverda tozalanadi.
5. **Bog'liqlik:** yozuv hali serverda yo'q hisob yoki kategoriyaga bog'langan bo'lsa, avval bog'langan qator yuboriladi (tartib: hisoblar, kategoriyalar, qolganlari).
6. **Takrorlanmaslik:** bir qator ikki marta yuborilsa ham bitta bo'ladi (UUID bo'yicha "upsert").
7. **Birinchi sinxron:** mahalliy ma'lumot serverga yuklanadi. Boshqa qurilmada birinchi kirishda mahalliy ma'lumot bo'sh bo'lsa, serverdan tortiladi. Ikkala tomonda ham ma'lumot bor bo'lsa, foydalanuvchiga tanlov beriladi: "Birlashtirish" yoki "Faqat serverdagini olish" yoki "Faqat shu qurilmadagini yuborish". Hech narsa jimgina o'chirilmaydi, tanlashdan oldin joriy holatning zaxirasi avtomatik yuklab beriladi.
8. **Holat ko'rsatkichi:** "Sinxronlangan (3 daqiqa oldin)", "Kutilmoqda (5 ta o'zgarish)", "Internet yo'q", "Xato".
9. **Vaqt qoidasi:** serverga yuboriladigan va tortiladigan yozuvlar uchun ham "vaqt hozirdan keyin bo'lmasin" tekshiriladi; buzuq qator rad etilib, xato ro'yxatida ko'rsatiladi, qolganlar to'xtamaydi.
10. **Zaxira va tiklash** (JSON) o'zgarmaydi. Zaxiradan tiklashdan keyin sinxronlash: tiklangan ma'lumot yangi o'zgarish sifatida serverga yuboriladi.

## 7. Ekranlar

- "Menyu" (☰, Asosiy sahifaning chap yuqori burchagi) → "Asosiy sozlamalar" kartochkasida "Profil va sinxronlash" qatori (u ochadigan ekranda): kirmagan holatda rozilik matni va "Google bilan kirish" (tugmani bosish = rozilik); kirgan holatda "Siz shu akkauntdasiz: email", "Chiqish" (faqat shu qurilmadan), "Hisobni o'chirish" (tasdiq oynasi), sinxron holati, "Hozir sinxronlash" (va xatoda "Qayta urinish"). Birinchi sinxron kirgan zahoti o'zi ishlaydi (17-band).
- Kirish oynasi: email maydoni (kod yuboriladi), "Google bilan kirish", maxfiylik izohi.
- Asosiy sahifada kichik sinxron holat belgisi.
- Barcha ekranlar 360 pikselda, yorug' va qorong'i rejimda; tugmalar 44 pikseldan kichik emas.

## 8. Qurish bosqichlari

Har bosqich alohida pull request, oldingisi tekshirilgandan keyin keyingisiga o'tiladi.

| Bosqich | Nima | Kim | Tekshirish |
|---|---|---|---|
| S0 | Tayyorgarlik: Supabase hisobi, loyiha, ikki bosqichli himoya, ochiq kalitni olish | **Foydalanuvchi** | Loyiha ochilgan, kalit yozib olingan |
| S1 ✅ | Baza sxemasi (jadvallar, indekslar, RLS, `updated_at` trigger) va xavfsizlik testlari. Ilovaga tegilmaydi | Claude Code | Ikkita sinov foydalanuvchi bir-birining ma'lumotini ko'ra olmaydi va o'zgartira olmaydi; kirmagan so'rov rad etiladi Fayllar tayyor (`supabase/`); foydalanuvchi Supabase'da qo'lda ishga tushirib tekshiradi (`supabase/README.md`) |
| S2 ✅ | Kirish ekrani (email kodi, Google), kirish holati; kirish majburiy emas. Sinxronlash hali yo'q | Claude Code | Kirish, chiqish, qayta ochilganda sessiya; kirmasdan ilova avvalgidek |
| S3 | Mahalliy ma'lumotga UUID, `updated_at`, `deleted` qo'shish; sxema versiyasi va migratsiya; o'chirish "mantiqiy" bo'ladi | Claude Code | Migratsiya eski bazaning nusxasida, hamma raqam bir xil, zaxira va tiklash ishlaydi | **Bajarildi (0.18.0).** Eslatma S4 uchun: sxema 7; `eski_id` — faqat mahalliy maydon (serverga yuborilmaydi); to'lovlar qarz ichida (`tolovlar[]`, o'chirilganlari `deleted`); byudjet qatoriga ham `id` qo'shildi (kalit `kategoriya_id` qoldi, `'umumiy'` ↔ serverda NULL); `pin` va `migratsiya-zaxira` sozlamalari sinxronlanmaydi |
| S4 ✅ | Birinchi yuklash: mahalliy ma'lumotni serverga yuborish (avtomatik zaxira bilan) | Claude Code | Server qatorlari soni mahalliy bilan mos | **Bajarildi (0.19.0)**, 14-bandga qarang |
| S5 ✅ | Ikki tomonlama sinxronlash: yuborish navbati, tortib olish, to'qnashuv, o'chirish, holat ko'rsatkichi | Claude Code | Ikki qurilmada yozuv qo'shish, tahrirlash, o'chirish bir-biriga o'tadi | **Bajarildi (0.20.0)**, 15-bandga qarang |
| S6 ✅ | Boshqa qurilmada birinchi kirish (tanlov oynasi), internetsiz rejim va qaytganda yuborish | Claude Code | Samolyot rejimida yozilgan yozuv internet qaytgach serverga o'tadi | **Bajarildi (0.21.0)**: asosiy qismi S5 da; bo'shliqlar 16-bandda |
| S7 ✅ | Hisobni va serverdagi ma'lumotni o'chirish, maxfiylik matni, xato holatlari | Claude Code | O'chirgandan keyin serverda hech narsa qolmaydi, mahalliy ma'lumot saqlanadi | **Bajarildi (0.21.0)**, 16-bandga qarang |
| S8 ✅ | Yakuniy sinov va hujjat yangilash | Claude Code va foydalanuvchi | 9-band mezonlari | **Bajarildi (0.22.0)**: avtomatik birinchi sinxron, rozilik, hisobni o'chirish yangi ko'rinishda, 90 kunlik tozalash; mezonlar jadvali 17-bandda. Haqiqiy serverdagi sinovlar foydalanuvchi uchun |

## 9. Qabul mezonlari

1. Ikki xil hisob (A va B) ochiladi: A ning ma'lumotini B hech qanday yo'l bilan ko'ra olmaydi, o'zgartira olmaydi va o'chira olmaydi (to'g'ridan-to'g'ri server so'rovi bilan ham).
2. Kirmasdan ilova hozirgidek to'liq ishlaydi.
3. Telefonda 5 ta yozuv, bitta o'tkazma, bitta qarz qo'shiladi, kompyuterda kirgach hammasi ko'rinadi, balans va hisob qoldiqlari ikki joyda bir xil.
4. Kompyuterda yozuv tahrirlanadi va o'chiriladi: telefonda ham shunday bo'ladi.
5. Samolyot rejimida yozilgan yozuv internet qaytgach serverga o'tadi va ikki marta yozilmaydi.
6. Bir yozuv ikki qurilmada turli o'zgartirilsa, oxirgisi g'olib, ma'lumot buzilmaydi.
7. Telefon almashtirilgani modellanadi: yangi qurilmada kirgach barcha ma'lumot qaytadi.
8. Eski zaxira fayli (sxema 1 dan hozirgigacha) tiklanadi va keyin sinxronlanadi.
9. Mavjud ma'lumot migratsiyadan keyin raqamma-raqam bir xil.
10. 5 000 yozuv bilan birinchi yuklash 60 soniyadan, oddiy sinxron 3 soniyadan oshmaydi.
11. Ilova kodi va repozitoriyda maxfiy kalit yo'q (tekshiruv: qidiruv).
12. Serverdagi ma'lumotni o'chirish ishlaydi.

## 10. Xavflar va cheklovlar

- **Bepul tarif:** 7 kun ishlatilmasa loyiha uxlaydi (uyg'otish kerak), bepul tarifda serverda avtomatik zaxira yo'q. Shuning uchun qo'lda zaxira (JSON) qoladi va ilova eslatadi.
- **Tarif o'zgarishi:** bepul limitlar o'zgarishi mumkin. Joriy limitlarni S0 da supabase.com/pricing da tekshiring.
- **Maxfiylik:** server egasi (Supabase) texnik jihatdan ma'lumotni ko'ra oladi, chunki u shifrlanmagan. Bu qaror 2-bandda ochiq yozilgan.
- **To'qnashuv:** "oxirgi yozgan g'olib" ba'zan eski o'zgarishni ustiga yozadi. Moliya yozuvlari kam o'zgaradi, shuning uchun qabul qilinadi.
- **Qurilma soati noto'g'ri bo'lsa** `updated_at` buziladi. Shuning uchun `updated_at` serverda belgilanadi.
- **O'zbekistondan** Supabase va Google kirishiga ulanish tezligi va to'siqlar tekshirilishi kerak (S0 da, sinov kirish bilan).

## 11. Foydalanuvchi bajaradigan ishlar (S0)

1. supabase.com da hisob oching (GitHub orqali kirish mumkin). Ikki bosqichli himoyani yoqing.
2. Yangi loyiha yarating: nomi `chuntak`, hudud sifatida eng yaqini (Yevropa), baza paroli kuchli va faqat sizda saqlansin (hech qachon repozitoriyga yoki sessiyaga yozilmasin).
3. Settings → API dan **faqat ochiq (anon/publishable) kalit va loyiha manzilini** nusxalang.
4. `service_role` kalitini hech kimga va hech qayerga (sessiya, repozitoriy, chat) bermang.

## 12. Ochiq savollar

1. ~~Google yoki email kodi?~~ S2 da **faqat Google** bilan kirish qilindi (foydalanuvchi qarori). Email kodi bilan kirish hozircha yo'q; kerak bo'lsa alohida bosqich.
2. Birinchi versiyada shifrlashsiz, RLS bilan boshlash qabul qilinadimi?
3. Ma'lumot saqlash hududi (Yevropa) qabul qilinadimi?
4. Eski qurilmalardagi ma'lumot birlashtirilganda takror yozuvlar (bir xil sana, vaqt, summa) ogohlantirilsinmi?

## 13. S2 natijasi (Google bilan kirish, 0.17.0)

- **Ekran:** Menyu (☰) → "Asosiy sozlamalar" → "Profil va sinxronlash" (kirmagan: "Kirish ixtiyoriy. Kirmasangiz ham ilova hozirgidek ishlaydi." va "Google bilan kirish"; kirgan: ism, email, "Chiqish"). Ma'lumot serverga yuborilmaydi, jadvallarga murojaat yo'q.
- **Kutubxona:** `@supabase/auth-js` 2.117.2 (supabase-js ning kirish qismi, MIT), `esbuild` bilan bitta faylga yig'ilgan: `js/vendor/supabase-auth.min.js` (~104 KB; to'liq `supabase-js` ~213 KB, jadval, real-time va fayl qismlari bilan). Sababi: CLAUDE.md "tashqi kutubxona ishlatilmaydi" deydi, shuning uchun faqat kerakli (kirish) qism olindi; jadvallar bilan ishlash qismi S4–S5 da kerak bo'lsa qo'shiladi. Fayl repoga ichki nusxa sifatida qo'shilgan (CDN yo'q) va service worker keshida (oflayn ishlaydi). Qayta yig'ish: `tools/supabase-auth-yasash.sh`.
- **Oqim:** PKCE (Google'dan faqat bir martalik kod qaytadi, token manzilda ko'rinmaydi). Sessiya qurilmada (`localStorage`, kalit `moliya-supabase-auth`) saqlanadi, token muddati tugamasdan o'zi yangilanadi. Internetsiz ilova ochiladi va saqlangan ism/email ko'rinadi; kirish tugmasi internet yo'q bo'lsa tushunarli xabar beradi (Google sahifasiga o'tmaydi). Chiqish faqat shu qurilmadagi sessiyani yopadi (internetsiz ham ishlaydi). "PINni unutdim" to'liq tozalashi sessiyani ham o'chiradi.
- **Google'dan qaytgach:** ilova o'z manziliga qaytadi (PIN yoqilgan bo'lsa avval PIN so'raladi, kirish fonda tugaydi), keyin Profil ekrani natija (kirdingiz yoki xato) bilan ochiladi.
- **Sozlash (foydalanuvchi, Supabase):** Authentication → URL Configuration → Redirect URLs ga ilovaning manzillari qo'shilgan bo'lishi kerak: `http://localhost:8000/` (kompyuterda sinash) va joylangan manzil (masalan, `https://<nom>.github.io/moliya-bulut/`). Google provayderi yoqilgan, Google Cloud'da ruxsat etilgan qaytish manzili `https://cqajcalwisdnsvadekxy.supabase.co/auth/v1/callback`.
- **Telefon (PWA) bo'yicha ehtiyot:** bosh ekranga o'rnatilgan ilovada Google sahifasi ilova ichida yoki alohida oynada ochilishi brauzerga bog'liq. Android (Chrome) odatda ilovaga qaytaradi. iPhone: o'rnatilgan ilovaning xotirasi Safari'dan alohida, shuning uchun Safari ochib qo'ysa, kirish ilovaga o'tmasligi mumkin. Bunda ilova "Kirish tugamadi" xabarini ko'rsatadi. Haqiqiy telefonda sinab ko'rilishi kerak.

## 14. S4 natijasi (birinchi yuklash, 0.19.0)

- **Ekran:** Menyu → Profil va sinxronlash (faqat kirgan foydalanuvchiga) → "Serverga yuklash" kartasi: "Oxirgi yuklash: sana va vaqt" (yoki "Hali yuklanmagan"), "Ma'lumotni serverga yuklash" tugmasi, progress ("1200 / 2500 (Yozuvlar)"), tugagach har jadval bo'yicha "Hisoblar: 6/6, Yozuvlar: 2500/2500 …" (server/mahalliy). Matnda: "Keyingi o'zgarishlar hozircha avtomatik yuborilmaydi."
- **Tasdiq oynasi:** ma'lumot xavfsiz serverga nusxalanishi, faqat o'z akkauntingiz ko'ra olishi, va halol ogohlantirish (shifrlanmagan, dasturchi texnik jihatdan bazani ko'ra oladi), PIN yuborilmasligi, avtomatik zaxira.
- **Zaxira:** boshlashdan oldin joriy holatning JSON zaxirasi avtomatik yuklab beriladi (`chuntak-zaxira-yuklashdan-oldin-…json`). Mahalliy ma'lumot o'zgarmaydi: faqat qurilmaning ichki `yuklash` yozuvi (user_id, boshlangan, tugagan, soni) yoziladi; u zaxira va eksportga kirmaydi va tiklashda saqlanadi.
- **Tartib:** hisoblar → kategoriyalar → yozuvlar → byudjetlar → qarzlar → qarz_tolovlari → sozlamalar; 300 qatorlik bo'laklar; upsert (`on_conflict=id`). `deleted = true` qatorlar ham yuklanadi. Yuborilmaydi: `eski_id`, `updated_at`/`created_at`/`user_id` (serverda), balans, PIN va boshqa mahalliy yozuvlar. Byudjet `"umumiy"` → NULL, qarzdagi `tolovlar[]` → `qarz_tolovlari`, bo'sh `muddat` → NULL.
- **Oldindan tekshiruv:** serverdagi qoidalarga mos kelmaydigan qator (noto'g'ri sana, summa, uzilgan havola va h.k.) bo'lsa, hech narsa yuborilmaydi va qaysi qatorlar ekani aytiladi.
- **Serverda ma'lumot bor bo'lsa:** hech narsa yozilmaydi va o'chirilmaydi; "Serverda allaqachon ma'lumot bor. Bu holat keyingi bosqichda hal qilinadi." Faqat quyidagi holatda davom etiladi: shu foydalanuvchi uchun shu qurilmada `yuklash` yozuvi bor VA serverdagi har bir ID mahalliy bazada ham bor (ya'ni bu bizning o'zimizning yarim qolgan yoki tugagan yuklashimiz). Bu "uzilgandan keyin davom etish" va "yana yuklash"ni ta'minlaydi, lekin boshqa qurilma ma'lumotiga tegmaydi. Qurilmadagi `yuklash` yozuvi yo'qolsa (masalan, "PINni unutdim" bilan to'liq tozalash), yuklash to'xtaydi: S5 da hal qilinadi.
- **Tekshiruv:** yuklangach har jadvalning server soni (`count`) mahalliy bilan solishtiriladi; mos kelmasa aniq xato va jadval nomi ko'rsatiladi, "tugagan" deb belgilanmaydi.
- **Kutubxona:** `@supabase/postgrest-js` 2.117.2 (MIT), `js/vendor/supabase-postgrest.min.js` (~18 KB, qayta yig'ish: `bash tools/supabase-postgrest-yasash.sh`). Faqat ochiq (publishable) kalit; kirish tokeni `Kirish.tokenOl()` dan olinadi.
- **Cheklov (S5 ga):** serverdagi `updated_at` yuklash vaqtida serverda belgilanadi (mahalliy `updated_at` yuborilmaydi), shuning uchun S5 da to'qnashuvni hal qilish serverdagi vaqtga tayanadi. Avtomatik yuborish, tortib olish va to'qnashuv hali yo'q.

## 15. S5 natijasi (ikki tomonlama sinxronlash, 0.20.0)

**Fayllar:** `js/sinxron.js` (tsikl, birinchi sinxron, holat), `js/sinxron-sof.js` (sof qoidalar: moslashtirish, to'qnashuv, birlashtirish), `js/data.js` (navbat va tortib olishni bazaga yozish), `js/yuklash.js` (S4: serverga yuborish yordamchilari; birinchi yuklashda ham ishlatiladi).

**Birinchi sinxron** ("Sinxronlashni boshlash", Profil): sinxronlash foydalanuvchi roziligisiz boshlanmaydi. Ikki tomon solishtiriladi:
- ikkalasi bo'sh (mahalliy faqat tayyor "Naqd pul" va kategoriyalar) — sinxron yoqiladi;
- mahalliy bor, server bo'sh — serverga yuklanadi (S4 mexanizmi, zaxira fayli, tasdiq, tekshiruv);
- mahalliy bo'sh, serverda bor — serverdan olinadi ("PINni unutdim" dan keyingi tiklash yo'li shu);
- ikkalasida ham bor — **tanlov ekrani**: "Birlashtirish" (hamma saqlanadi; bir xil nomli hisob/kategoriya bittadan; nomi bir xil, qoldig'i boshqa hisobning nomiga "(shu qurilma)" qo'shiladi; bir kategoriyaga ikkala tomonda chegara bo'lsa serverdagisi qoladi; sozlamalarda qurilmaning qiymati, serverdagi id), "Faqat serverdagini olish" (shu qurilma serverdagi bilan almashtiriladi), "Faqat shu qurilmadagini yuborish" (server shu qurilmadagi bilan bir xil bo'ladi: serverdagi ortiqcha qatorlar o'chirilgan deb belgilanadi, qatorlar saqlanadi). Har variantdan oldin joriy holatning zaxira fayli avtomatik yuklab beriladi; ikkita buzuvchi variant qo'shimcha tasdiq so'raydi. Natija tekshiruvdan o'tmasa (zaxira tekshiruvi bilan bir xil) hech narsa o'zgarmaydi.
- Sinxron holati va navbat qurilmada `sozlamalar` ichidagi mahalliy yozuvlarda (`sinxron`, `sinxron-navbat`) turadi: zaxiraga, eksportga va serverga tushmaydi, tiklashda saqlanadi.

**Yuborish (navbat):** sinxron yoqilgach har o'zgarish (qo'shish, tahrirlash, mantiqiy o'chirish, tiklash) o'zgargan qatorning KALITI sifatida navbatga yoziladi (qator bilan bitta tranzaksiyada). Yuborishda qator bazadan o'qiladi, shuning uchun ko'p marta o'zgargan qator bir marta yuboriladi; faqat o'zgarganlar yuboriladi (butun baza emas). Tartib: hisoblar, kategoriyalar, yozuvlar, byudjetlar, qarzlar, to'lovlar, sozlamalar (server tashqi kalitni tekshiradi). 300 qatorlik bo'laklar; yuborilgani navbatdan faqat qiymati (`updated_at`) o'zgarmagan bo'lsa olinadi (yuborish paytida yana o'zgartirilgan qator navbatda qoladi). Navbat ilova yopilsa ham saqlanadi. Serverga mos kelmaydigan qator butun navbatni to'xtatmaydi: chetga olinadi va Profilda ko'rsatiladi. Yuborish o'zgarishdan 2,5 soniya keyin (ketma-ket o'zgarishlar bitta so'rovga yig'iladi), internet qaytganda va ilova ochilganda ishlaydi.

**Tortib olish:** har jadvaldan `updated_at >= kursor − 5 soniya` bo'yicha (kursor — serverdagi eng oxirgi `updated_at`, har jadval uchun alohida), 1000 talik sahifalar. Ilova ochilganda, ilovaga qaytganda (fokus, kamida 8 soniya oraliq bilan), internet qaytganda va ilova ochiq turganda har 60 soniyada (faqat ko'rinib turganda). Har tsikl: avval tortish, keyin yuborish (kichik so'rovlar soni: tortishda 6 ta GET). Tortilgan qatorlar bitta tranzaksiyada qo'llanadi; yangi, o'zgargan va o'chirilgan (`deleted`) qatorlar o'tadi, ro'yxatlar o'zi yangilanadi. `sozlamalar` (mavzu, balans ko'zi, zaxira sanasi) tortilmaydi: ular har qurilmada alohida; yangi qurilmada birinchi sinxronda serverdagisi olinadi.

**TO'QNASHUV QOIDASI ("oxirgi yuborgan yutadi", har qator alohida).** `updated_at` serverda trigger bilan qo'yiladi, shuning uchun "oxirgi" — serverga OXIRGI YETIB BORGAN o'zgarish (qurilma soati hisobga olinmaydi). Yuborilmagan mahalliy o'zgarish tortib olishda HECH QACHON ustiga yozilmaydi: u keyin yuboriladi va serverdagisini almashtiradi. Misol: telefon va kompyuter bir yozuvni ko'rib turibdi (summa 100). Telefon internetsiz summani 111 qildi. Kompyuter 222 qildi va yubordi (server: 222). Telefon internetga ulandi: 222 ni tortadi, lekin o'zining yuborilmagan 111 ini saqlab qoladi va yuboradi: server 111 bo'ladi, kompyuter keyingi tortishda 111 ni oladi. Ikkala qurilmada ham 111, ma'lumot buzilmaydi, lekin kompyuterning 222 si almashtirildi. Bunday holat Profilda "To'qnashuv: N ta qator" deb sanaladi (o'zimiz yuborganimizning aks-sadosi sanalmaydi); zaxira fayli bor. Chegaralar: (1) telefon o'zgarishni kompyuterdan KEYIN, lekin internetga ERTAROQ yuborsa, u yutadi; (2) bir qatorning ikki qismini ikki qurilmada o'zgartirsangiz (masalan, biri summani, ikkinchisi izohni) qator butunlay oxirgi yuborganniki bo'ladi (maydonlar alohida birlashtirilmaydi). Moliya yozuvlari kam o'zgaradi, shuning uchun bu qabul qilindi (10-band). Byudjet: bir kategoriyaga ikki qurilma alohida chegara qo'ysa, ikkalasi ham bir xil g'olibni (katta id) tanlaydi, yutqazgani serverda o'chirilgan deb belgilanadi. Qarz to'lovlari: boshqa qurilmaning yangi to'lovi qarz yuborilmagan bo'lsa ham qo'shiladi.

**O'chirish:** mantiqiy o'chirish (`deleted = true`) boshqa qurilmaga o'tadi va u yerda ham ko'rinmaydi, balansga/hisobotga kirmaydi; qator ikkala joyda saqlanadi. Tiklash (zaxira fayli) bazani almashtirsa, tiklangan hamma qator yuboriladigan o'zgarish bo'ladi; zaxirada yo'q, lekin serverda bor qatorlar o'chirilmaydi va qaytib keladi.

**Holat:** Asosiy ekranda kichik belgi va Profilda matn: "Sinxronlangan (3 daqiqa oldin)", "Kutilmoqda (5 ta o'zgarish)", "Internet yo'q (N ta o'zgarish kutmoqda)", "Xato" (sabab va "Qayta urinish" tugmasi), "Sinxronlanmoqda…". Kirmagan foydalanuvchi uchun hech narsa ishlamaydi. Boshqa akkaunt bilan kirilsa, avtomatik yuborilmaydi (birinchi sinxron qaytadan so'raladi). Chiqishda yuborilmagan o'zgarish bo'lsa ogohlantiriladi; mahalliy ma'lumot o'chmaydi. "Serverga yuklash" tugmasi (S4) birinchi sinxronga qo'shildi (yuklash varianti), alohida tugma qolmadi.

**Ma'lum cheklovlar:** nomlar takrorlanmasligi qoidasini ikki qurilmada bir vaqtda bir xil nom qo'shilsa ilova bir lahzada tekshira olmaydi (ikkita bir xil nomli hisob/kategoriya paydo bo'lishi mumkin; birinchi sinxronda Birlashtirish ularni bitta qiladi). Oflayn rejim batafsil sinovi S6, hisob va server ma'lumotini o'chirish S7.

**0.20.1 (xato tuzatish).** Haqiqiy brauzerda tanlov ekranidan "Faqat serverdagini olish" bosilganda "Sinxronlash hozir davom etmoqda" chiqardi. Sabab: tasdiq oynasi (`confirm`) yopilgach brauzer `focus` hodisasini beradi, u fon sinxron tsiklini boshlardi, tsikl esa birinchi sinxron bilan BIR XIL qulfni ushlab turardi; birinchi sinxron qulfni band topib to'xtardi (zaxira fayli esa shu paytga kelib yuklab bo'lingan edi, shuning uchun har urinishda yangi fayl chiqardi). Tuzatish: birinchi sinxron alohida belgi (faqat xotirada, har doim olib tashlanadi) bilan ishlaydi; fon tsikli ketayotgan bo'lsa birinchi sinxron uni kutadi, birinchi sinxron paytida fon tsikli boshlanmaydi; "davom etmoqda" faqat haqiqatan boshqa birinchi sinxron ketayotganda chiqadi (kod: SYNC_LOCKED). Zaxira fayli bir urinishda bir marta va faqat qulf olinib, server javob berib, tekshiruvdan o'tgandan keyin (yozishdan oldin) yuklanadi. Xato matnlarida qisqa texnik kod: `NETWORK`, `HTTP_<holat>`, `PG_<kod>`, `SYNC_LOCKED`, `BACKUP_FAILED`, `DATA_INVALID`, `JS_<nom>`, `UI_<nom>`.

## 16. S6 va S7 natijasi (0.21.0)

**S6 — topilgan va tuzatilgan bo'shliqlar** (oflayn va ikkinchi qurilma S5 da bajarilgan):
1. Token yangilanmasa va internet yo'q bo'lsa, ilova "Kirish muddati tugagan" deb noto'g'ri aytardi. Endi server javob bermasa tarmoq xatosi hisoblanadi ("Internet..." , kod NETWORK), navbat saqlanadi, ulangach yuboriladi; faqat server javob berib token yaroqsiz bo'lsa "Kirish muddati tugagan" (chiqib, qayta kirish kerak; shu akkaunt bilan qayta kirsa navbat yuboriladi).
2. Serverdan 401 kelsa (token yo'lda eskirdi yoki qurilma soati noto'g'ri) token bir marta majburan yangilanib, so'rov qayta yuboriladi.
3. Akkaunt boshqa qurilmada o'chirilgan bo'lsa, tushunarli xabar: "Bu akkaunt serverdan o'chirilgan. Chiqib, qayta kiring" (navbat va mahalliy ma'lumot saqlanadi).
4. Juda katta navbat (3 000 qator) 300 talik bo'laklab yuboriladi, uzilsa davom etadi (sinaldi). Uzoq oflayn davr: navbat saqlanadi, tortish kursori eskirmaydi, to'qnashuv qoidasi o'zgarmagan. Bo'shliq topilmadi.

**S7 — maxfiylik, hisobni o'chirish**
- **Maxfiylik sahifasi:** `maxfiylik.html` (ilova bilan bir sayt, GitHub Pages: `https://jahon-gir.github.io/moliya-bulut/maxfiylik.html`): qanday ma'lumot, nima uchun, qayerda (Supabase, Yevropa/Irlandiya), shifrlanmagan va dasturchi texnik jihatdan ko'ra olishi, uchinchi tomonlar (Google, Supabase), reklama/analitika yo'qligi (kodda tekshirilgan: tashqi so'rovlar faqat Supabase), hisobni o'chirish, foydalanish shartlari (kafolatsiz, zaxira olib turish), bog'lanish. Ilovada: Profil → "Maxfiylik" (yangi oynada). Sahifa oflayn keshda.
- **Hisobni o'chirish (ilova):** Profil → "Hisobimni va serverdagi ma'lumotimni o'chirish" → ekranda nima bo'lishi, `O'CHIRISH` so'zini yozish (kichik harf va apostrof turlariga e'tiborsiz), oxirgi tasdiq oynasi, zaxira fayli avtomatik yuklanadi; yuborilmagan o'zgarish bo'lsa ogohlantiriladi va "Avval yuborib olish" taklif qilinadi. Natija: serverdagi hamma narsa va akkaunt o'chadi, shu qurilmadagi sessiya yopiladi, sinxron holati va navbat o'chadi, MAHALLIY MA'LUMOT SAQLANADI, "Hisob o'chirildi" xabari. Qayta kirsa (yangi akkaunt) server bo'sh bo'ladi: birinchi sinxronda mahalliy ma'lumot yuklanadi. Xatolar (internet yo'q, funksiya yo'q, kirish muddati tugagan, server xatosi) oddiy o'zbekcha va "(kod: ...)" bilan; xatoda hech narsa o'chmaydi.
- **Server:** `supabase/003_hisobni_ochirish.sql` (funksiya `public.hisobni_ochirish()`: parametrsiz, faqat `auth.uid()`, SECURITY DEFINER, bo'sh search_path, EXECUTE faqat authenticated; qatorlarni HAQIQATAN o'chiradi, keyin akkauntni) va `004_hisobni_ochirish_testi.sql` (18 tekshiruv: A o'chirsa B saqlanadi, anon va kirmagan o'chira olmaydi). Foydalanuvchi SQL Editor'da qo'lda ishga tushiradi (`supabase/README.md`, 1-b).
- **Xato matnlari:** barcha sinxron, o'chirish va kirish xatolarida qisqa texnik kod (NETWORK, NETWORK_OFFLINE, HTTP_*, PG_*, AUTH_*, SYNC_LOCKED, BACKUP_FAILED, DATA_INVALID, NOT_SIGNED_IN, UI_*, JS_*).
- **Cheklov:** boshqa qurilmadagi token hisob o'chirilgandan keyin ham ~1 soat amalda bo'lishi mumkin, lekin server akkaunt yo'qligi uchun yozishni rad etadi (bu holat yuqoridagi 3-xabar bilan ko'rsatiladi).

## 17. S8 natijasi (yakuniy bosqich, 0.22.0)

**Avtomatik birinchi sinxron.** "Google bilan kirish" tugmasi ustida rozilik matni (nima saqlanadi va boshqa qurilmalarda ko'rinadi, faqat siz ko'rasiz, shifrlanmagan va dasturchi texnik jihatdan ko'ra oladi, hisobni o'chirish mumkin, Maxfiylik havolasi). Tugmani bosish = rozilik: belgi qurilmada saqlanadi, Google dan qaytgach akkauntga bog'lanadi va **shu akkaunt uchun bir marta** mahalliy yozuvda (`rozilik`; zaxiraga kirmaydi) turadi. Alohida "Sinxronlashni boshlash" tugmasi olib tashlandi (faqat rozilik yozuvi yo'q eski kirgan foydalanuvchi uchun "Roziman, sinxronlashni yoqish"). Kirgan zahoti ikki tomon solishtiriladi: ikkalasi bo'sh — yoqiladi; qurilmada bor, server bo'sh — yuklanadi; qurilma bo'sh, serverda bor — tortiladi; ikkalasida ham bor — **tanlov ekrani** (zaxira fayli va tushuntirish bilan; Profil ochiq bo'lsa ekran o'zi ochiladi). Hech narsa jimgina o'chirilmaydi.
- **"Bo'sh" qurilma:** ilova birinchi ochilganda yaratgan standart ma'lumot (bitta "Naqd pul" hisobi, qoldig'i 0; standart kategoriyalar) "bo'sh" hisoblanadi: foydalanuvchining yozuvi, qarzi, byudjeti, boshqa hisobi, o'zgargan qoldiq yoki o'zgargan/arxivlangan kategoriya bo'lsa — "ma'lumot bor". Bo'sh qurilmada serverdagi ma'lumot to'g'ridan-to'g'ri tortiladi (standartlar serverdagilari bilan almashadi, takror bo'lmaydi). "Birlashtirish"da bir xil nomli (nom va tur bo'yicha) hisob/kategoriya bitta bo'ladi; mahalliy hisobning boshlang'ich qoldig'i 0 bo'lsa, u serverdagi bir xil nomli hisobga qo'shiladi (jami balans o'zgarmaydi).
- **Boshqa akkaunt:** bu qurilmadagi ma'lumot boshqa akkaunt bilan sinxronlangan bo'lsa va hozirgi akkauntning serveri bo'sh bo'lsa, ma'lumot o'z-o'zidan YUBORILMAYDI: "Ha, shu akkauntga saqlash" / "Yo'q, chiqish" tanlovi chiqadi. Serverda ma'lumot bo'lsa — oddiy tanlov ekrani (ogohlantirish bilan).
- **To'xtash:** chiqish (sessiya yo'q), hisobni o'chirish (sinxron holati, navbat va rozilik o'chadi) va rozilik yo'q holatda avtomatik sinxron ishlamaydi.
- **Uzilgan birinchi sinxron:** sahifa yangilansa (shu jumladan "Yangi versiya tayyor" → "Yangilash"), ilova yopilsa yoki internet uzilsa, keyingi ochilishda avtomatik davom etadi (yuklash — qolgan joyidan; takror yo'q). "Yangilash" bosilganda sinxron ketayotgan bo'lsa, u tugashi (15 soniyagacha) kutiladi.
- **Xatoda** faqat "Qayta urinish" tugmasi va sabab "(kod: ...)" bilan.

**Profil:** "Siz shu akkauntdasiz: email" (adashib boshqa Google akkaunt bilan kirmaslik uchun); ikkita alohida tugma: "Chiqish" va "Hisobni o'chirish". Hisobni o'chirish: tasdiq oynasi (nima o'chadi: serverdagi akkaunt va hamma ma'lumot; nima saqlanadi: shu qurilmadagi ma'lumot), "Bekor qilish" va qizil "O'chirish"; zaxira fayli avtomatik, yuborilmagan o'zgarish ogohlantirishi va xato kodlari avvalgidek ("O'CHIRISH" so'zini yozdirish olib tashlandi).

**Tortish tezligi va batareya:** fon tortishi faqat sahifa ko'rinib turganda va internet bor paytda (sahifa yashirinsa vaqt belgisi to'xtatiladi); foydalanuvchi 3 daqiqa tegmasa, tekshiruv 5 daqiqada bir marta. Bo'sh turganda har tsikl: `supabase/005_sinxron_xizmat.sql` o'rnatilgan bo'lsa **1 ta so'rov** (`rpc sinxron_holati`), faqat o'zgargan jadval tortiladi; o'rnatilmagan bo'lsa **6 ta GET**. Ilova ochilganda, "Hozir sinxronlash" va har 10-tsiklda hamma jadval tekshiriladi. Yuborish: faqat o'zgargan qatorlar (bo'laklar ≤300). Internet yo'q yoki sahifa yashirin bo'lsa so'rov ketmaydi. Kirish hodisalari (token yangilanishi) tsiklni qayta-qayta boshlamaydi (S8 da shunday to'fon topilib tuzatildi: akkaunt boshqa qurilmada o'chirilganda 401 → token yangilash → tsikl → 401 ... aylanasi; endi tsikl faqat akkaunt o'zgarganda boshlanadi, token yangilash 20 soniyada bir martadan ko'p emas).

**Tombstone tozalash (6-band 4):** S1–S7 da BAJARILMAGAN edi (faqat o'chirish ruxsati bor edi). S8 da qo'shildi: `public.tombstone_tozalash(90)` (faqat jadval egasi) + pg_cron kunlik 03:15 UTC (`005_sinxron_xizmat.sql`, qadamlar `supabase/README.md` 1-c). Bog'langan ota qatorlar (hisob, kategoriya, qarz) unga bog'langan qator bor ekan o'chirilmaydi. Mahalliy PostgreSQL 16 da 16/16 tekshiruv o'tdi; haqiqiy Supabase'da foydalanuvchi ishga tushiradi.

**Takror nomlar (12-band 4, ochiq savol):** hozirgi holat: ikki qurilmada bir vaqtda bir xil nomli YANGI hisob/kategoriya qo'shilsa, ikkalasi qoladi (ikkita bir xil nomli), ma'lumot yo'qolmaydi va buzilmaydi (testlangan). Birinchi sinxronda "Birlashtirish" bir xil nomlilarni bitta qiladi. Doimiy sinxronda avtomatik birlashtirish qilinmadi (yangi imkoniyat; noto'g'ri birlashtirish xavfi bor): foydalanuvchi ortiqchasini arxivlaydi.

**Boshqa o'zaro ta'sirlar (tekshirildi):** sessiya muddati (token yangilanmasa: internet bor-yo'qligi ajratiladi; 401 da bir marta yangilash), internetsiz ochish (saqlangan akkaunt ko'rinadi, o'zgarishlar navbatda, so'rov ketmaydi), PWA "Yangilash" (sinxron tugashini kutadi; birinchi sinxron uzilsa davom etadi).

### 9-band mezonlari: holat jadvali

| № | Mezon | Holat | Qanday tekshirildi |
|---|---|---|---|
| 1 | A ning ma'lumotini B ko'ra, o'zgartira, o'chira olmaydi (to'g'ridan-to'g'ri server so'rovi bilan ham) | O'tdi (mahalliy PostgreSQL); Supabase'da foydalanuvchi | `002_xavfsizlik_testi.sql` 75/75, `004` 18/18, `006` 16/16 mahalliy PostgreSQL 16 da (ikkita sinov foydalanuvchi, RLS, anon rad etiladi). Haqiqiy Supabase'da bu fayllarni foydalanuvchi ishga tushiradi |
| 2 | Kirmasdan ilova hozirgidek to'liq ishlaydi | O'tdi | Hamma e2e (S2, menyu, PIN, PWA, eksport, migratsiya) kirmasdan; kirmagan holatda serverga so'rov yo'qligi tekshirilgan; birlik testi: kirmagan uchun tsikl ishlamaydi |
| 3 | 5 yozuv, 1 o'tkazma, 1 qarz — ikkinchi qurilmada hammasi, balans va qoldiqlar bir xil | O'tdi (taqlid server) | Birlik testi "9-band/3": ikki alohida mahalliy baza, raqamlar JSON bilan aynan teng |
| 4 | Ikkinchi qurilmada tahrirlash va o'chirish ikkinchisida ham | O'tdi (taqlid) | Birlik testlari (ikki qurilma, qarz to'lovi) va brauzer testi (3 ta alohida brauzer konteksti) |
| 5 | Samolyot rejimida yozilgan yozuv internet qaytgach serverga o'tadi, ikki marta yozilmaydi | O'tdi (taqlid) | Birlik (navbat ilova qayta ochilgandan keyin ham, uzilishdan keyin dublikatsiz) va brauzer (`offline` rejim, `online` hodisasi) testlari |
| 6 | Bir yozuv ikki qurilmada turlicha o'zgartirilsa, oxirgisi yutadi, ma'lumot buzilmaydi | O'tdi (taqlid) | Birlik testi (yuborilmagan mahalliy o'zgarish ustiga yozilmaydi, to'qnashuv sanaladi); qoida 15-bandda |
| 7 | Telefon almashtirish: yangi qurilmada kirgach hamma ma'lumot qaytadi | O'tdi (taqlid) | Birlik va brauzer: baza tozalanib, qayta kirishda raqamlar aynan bir xil; "bo'sh qurilma" standart ma'lumot bilan tanlovsiz tortiladi |
| 8 | Eski zaxira fayli (1-sxemadan hozirgigacha) tiklanadi va keyin sinxronlanadi | O'tdi (taqlid); shu bilan birga 1–6 sxema fayllari oldingi bosqichlarda | Birlik: 1-sxema fayli tiklanadi → sinxron → ikkinchi qurilmada raqamlar bir xil; 3, 4, 5, 6 sxema fayllari S3 testlarida |
| 9 | Mavjud ma'lumot migratsiyadan keyin raqamma-raqam bir xil | O'tdi | S3: 2 500 yozuvli eski (0.17.0) bazada balans, kategoriya jami, byudjet, qarz, eksport ID lari aynan teng (birlik va brauzer testlari) |
| 10 | 5 000 yozuv birinchi yuklash < 60 s; oddiy sinxron < 3 s | Taqlid serverda o'tdi; **haqiqiy tarmoqda sinalmadi** | Birlik testi: 5 000 yozuv va bitta o'zgarish vaqti o'lchanadi. Haqiqiy tezlik internetga va Supabase hududiga bog'liq: foydalanuvchi o'lchaydi |
| 11 | Kodda va repozitoriyda maxfiy kalit yo'q | O'tdi | Avtomatik qidiruv testi (`service_role`, `sb_secret_`, JWT, parol) va qo'lda `grep`; faqat ochiq (publishable) kalit |
| 12 | Serverdagi ma'lumotni o'chirish ishlaydi | O'tdi (mahalliy PostgreSQL + taqlid); Supabase'da foydalanuvchi | `004` 18/18 (A o'chirsa B saqlanadi); brauzer testi: tasdiq oynasi, zaxira, mahalliy ma'lumot saqlanadi, qayta kirishda bo'sh server |

**Haqiqiy serverda faqat foydalanuvchi sina oladigan narsalar:** (a) `001`, `002`, `003`, `004`, `005`, `006` ni Supabase SQL Editor'da ishga tushirish va natijalarni ko'rish; (b) pg_cron yoqilishi va `cron.job` da kunlik topshiriq; (c) Google bilan haqiqiy kirish (telefon PWA'sida ham: iPhone/Android), Google Cloud Branding dagi maxfiylik manzili; (d) ikki haqiqiy qurilma orasida sinxron tezligi (5 000 yozuv, oddiy sinxron); (e) `delete from auth.users` ning funksiya ichidan haqiqiy Supabase'da ishlashi (ikkinchi sinov akkaunti bilan); (f) uzoq muddatli (soatlab/kunlab) oflayn va haqiqiy token muddati tugashi.

## 18. Kirish ekrani va fayldan yuklash (0.23.0 – 0.27.0)

Bu band asosiy TZ'da yo'q edi; foydalanuvchi talabi bilan qo'shildi. Sinxron mantig'iga (navbat, qulf, tortish) TEGILMAYDI. Ikkita alohida PR.

### 18.1. Kirish ekrani va zaxira tugmasini yashirish (0.23.0)

1. **Salomlashuv ekrani.** Ilova BIRINCHI ochilganda (bu qurilmada kirish bo'yicha tanlov hali qilinmagan bo'lsa) to'liq ekranli salomlashuv chiqadi: katta "Google bilan kirish" tugmasi, ustida qisqa izoh (ma'lumotlar serverda saqlanadi va hamma qurilmalarda ko'rinadi) va profildagi rozilik matni (bir xil matn); pastda kichik havola "Hozircha kirmasdan davom etish" (kamida 44 px). Tanlov (`kirdi` yoki `davom`) shu qurilmada `localStorage` (`moliya-kirish-tanlovi`) da saqlanadi va ekran qayta chiqmaydi. "PINni unutdim" to'liq tozalashi uni ham o'chiradi (qurilma yangidek boshlanadi). Kirish MAJBURIY emas, ilova internetsiz ham ishlaydi (Google tugmasi internet yo'q bo'lsa tushunarli xabar beradi, "kirmasdan davom etish" doim ishlaydi).
   - Allaqachon kirgan foydalanuvchi, yoki bu qurilmada o'z ma'lumoti bor (standart "Naqd pul" va kategoriyalardan boshqa) eski foydalanuvchi uchun salomlashuv chiqmaydi (tanlov o'zi belgilanadi): ular uchun faqat yumshoq eslatma.
   - Google'dan qaytish xato bilan tugasa, Profil xato matni bilan ochiladi; tanlov belgilanmaydi (keyingi ochilishda salomlashuv yana chiqadi).
2. **Yumshoq eslatma** (kirmaganlarga): bosh sahifada kartochka "Ma'lumotlaringiz faqat shu qurilmada. Saqlab qo'yish uchun Google bilan kiring." Kuniga ko'pi bilan bir marta (kun — qurilmaning mahalliy sanasi); "Yopish" bosilsa 7 kungacha qaytmaydi; "Kirish" Profilni ochadi. Salomlashuvda "kirmasdan davom etish" tanlangan kuni eslatma chiqmaydi.
3. **JSON zaxira tugmalari oddiy ko'rinishdan olib tashlandi** ("Zaxira nusxa olish", "Zaxiradan tiklash" va bosh sahifadagi zaxira kartochkasi). Menyudagi qator va ekran "Excelga yuklab olish" deb nomlandi; Excel tugmasi "Excelga yuklab olish (N ta qator)". Birinchi sinxrondagi, hisobni o'chirishdagi va tiklashdagi avtomatik zaxira ICHKI holda to'liq qoladi (o'zgarmagan). Yangilanishdan oldingi avtomatik nusxa kartochkasi (agar nusxa bor bo'lsa) qoladi. **Ilg'or rejim:** Menyu pastidagi versiya qatorini 7 marta bossangiz zaxira tugmalari qaytadi (o'chirmoqchi bo'lsangiz yana 7 marta); bu eski JSON zaxira fayllarini tiklash uchun.

### 18.2. Fayldan yuklash (Excel import) va chiroyli Excel eksport (0.24.0)

**Bajarildi (0.24.0).** Profil → "Fayldan yuklash" (faqat Excel `.xlsx`; CSV va eski `.xls` rad etiladi, `IMPORT_FORMAT`).

**Oqim.** Fayl tanlanadi → ustunlar nomidan taxmin qilinadi (sana, summa, tur, kategoriya, hisob, qayerga, izoh, ID, valyuta; har biri ro'yxatdan tuzatiladi) → **oldindan ko'rish** (qator soni, birinchi 10 ta yozuv, xato/takror/o'tkazib yuborilganlar sababi va kodi bilan) → "Yuklash" tasdig'i. Tasdiqlanmaguncha bazaga hech narsa yozilmaydi. Fayl qurilmadan chiqmaydi.

**O'qish.** Tashqi kutubxona yo'q (vendor qo'shilmadi, hajm qo'shilmadi): `js/xlsx-oqi.js` ZIP ni o'zi o'qiydi, siqilgan qismni brauzerning `DecompressionStream` i ochadi (eski brauzerda `IMPORT_BRAUZER`). Katak shrifti rangi (qizil/yashil) `styles.xml` dan o'qiladi; mavzu (theme) ranglari o'qilmaydi.

**Qoidalar** (`js/import-sof.js`, sof, testlanadi):
- Sarlavhalar katta-kichik harf va bo'shliqqa e'tiborsiz: begona jadval (DateTime, TransactionID, TransactionType, AccountFrom, TransferedTo, Category, EnteredAmount, Amount, TransactionCurrency, AccountChargedAmount, LoanName, LoanType, LoanChargedAmount, Comment) va o'zimizning eksport ustunlari.
- Summa: matn ("27 640,00 UZS", oddiy/buzilmas bo'shliq, vergul/nuqta kasr va minglik, oxirgi valyuta, qavs/minus) yoki raqam. Kasr eng yaqin butun so'mga yaxlitlanadi va qatorda ogohlantirish chiqadi. 0 yoki o'qilmasa — xato (`R_SUMMA`).
- Sana: `2026-10-05 09:12:33`, `2026-10-08`, `08.10.2026`, `08/10/2026` (kun birinchi), Excel seriya raqami; vaqt daqiqagacha saqlanadi, bo'lmasa 00:00. Kelajak vaqti — xato (`R_KELAJAK`), noto'g'ri sana — `R_SANA`. Ko'p qatorli izoh o'zgarmaydi.
- **Tur aniqlash tartibi:** "Tur" ustuni (Daromad/Xarajat/O'tkazma) → foydalanuvchining kategoriya bo'yicha tanlovi → summa manfiy (xarajat) → summa katagi shrifti rangi (qizil — xarajat, yashil — daromad) → kategoriya bo'yicha tanlov (standart: xarajat). Qaysi usul nechta qatorga ishlagani ko'rinishda yoziladi, har kategoriya uchun tuzatish mumkin. "Manual" turni aniqlamaydi.
- **O'tkazma:** `Transfer` / "O'tkazma" qatori ilovaning o'z o'tkazmasi bo'ladi (qayerdan va qayerga hisob kerak, ikkalasi har xil); aks holda o'tkazib yuboriladi (`R_OTKAZMA`). Qoldiqlar o'tkazma qoidasi bilan hisoblanadi, hisobotga kirmaydi.
- **Qarz qatorlari** (Tur=Qarz/Qarz to'lovi yoki LoanName/LoanType to'ldirilgan) yuklanmaydi, o'tkazib yuboriladi (`R_QARZ`): qarz yozuvlari alohida tuzilishga ega. Valyuta UZS emas — ogohlantirib o'tkazib yuboriladi (`R_VALYUTA`).
- **Noma'lum kategoriya/hisob:** nom bo'yicha guruhlanadi, har nom bir marta so'raladi: yangi yaratish yoki mavjudiga biriktirish. Yangi hisobning boshlang'ich qoldig'i 0. Kategoriyasiz qator — "Boshqa"ga, hisobsiz qator — birinchi hisobga.
- **Takror:** (1) ID bo'yicha (yangi maydon qo'shilmagan: yuklangan ID lar shu qurilmadagi mahalliy `import-tarixi` yozuvida, zaxira va serverga kirmaydi; bizning `Y-000001` ko'rinishidagi tartib raqamlari ID hisoblanmaydi), (2) sana + summa + kategoriya + izoh bo'yicha (har mavjud yozuv faqat bir qatorga mos keladi). Standart: o'tkazib yuborish, foydalanuvchi "baribir yuklash"ni tanlashi mumkin. Bir fayl ikki marta yuklansa ikkilanmaydi.

**Xavfsizlik.** Yuklashdan oldin joriy holatning zaxira fayli avtomatik yuklab beriladi; keyin hamma yozuv, yangi hisob va kategoriyalar **bitta tranzaksiyada** yoziladi (xato bo'lsa hech narsa o'zgarmaydi, `IMPORT_YOZISH`) va oddiy saqlash bilan bir xil maydonlar (`updated_at`, `deleted`) hamda sinxron navbatiga tushadi. Server sxemasi o'zgarmadi, sinxron mantig'iga (navbat, qulf, tortish) tegilmadi: faqat `Data.importYozish` navbat yozuvini oddiy saqlash formatida yozadi. **"Oxirgi yuklashni bekor qilish"** (Profil): yuklangan yozuvlar mantiqiy o'chiriladi, yaratilgan hisob/kategoriya — boshqa joyda ishlatilmasa; ID lar tarixdan chiqadi (`IMPORT_BEKOR`).

**Xato kodlari:** `IMPORT_PARSE` (buzilgan fayl), `IMPORT_EMPTY` (bo'sh), `IMPORT_FORMAT` (xlsx emas / .xls / CSV), `IMPORT_KATTA` (30 MB yoki 50 000 qatordan katta), `IMPORT_BRAUZER`, `IMPORT_YOZISH`, `IMPORT_BEKOR`; qator kodlari: `R_SANA`, `R_SUMMA`, `R_VALYUTA`, `R_KELAJAK`, `R_OTKAZMA`, `R_QARZ`, `R_HISOB`, `R_TAKROR`.

**Excel eksporti (yaxshilandi).** Xarajat summasi qizil, daromad yashil, o'tkazma va qarz oddiy; sarlavha qatori to'q fonda oq qalin matn; ustun kengligi mazmunga moslanadi; ko'p qatorli izoh o'raladi (qator balandligi bilan); sana va summa haqiqiy Excel turida; sarlavhalar o'zbekcha. Aylanish: eksport → toza baza → yuklash → eksport bir xil (testlangan).

### 18.3. Qarz qatorlarini yuklash (0.25.0)

**Muammo.** 0.24.0 da qarz qatorlari `R_QARZ` bilan o'tkazib yuborilardi. Qarz amallari hisob qoldig'iga ta'sir qiladi, shuning uchun ularsiz hisoblar boshqa ilovadagi qoldiqlardan farq qiladi. Endi qarzlar ham yuklanadi.

**Ilovada qarz qanday ishlaydi (mavjud mantiq, o'zgarmaydi).** Qarz = bitta yozuv: `{ yonalish: 'berdim' | 'oldim', shaxs, summa, hisob_id, sana, vaqt, muddat, izoh, tolovlar: [{ summa, hisob_id, sana, vaqt }] }`. "Berdim" (men berdim): qarz summasi hisobdan CHIQADI, qaytarilgan to'lovlar hisobga KIRADI. "Oldim" (men oldim): qarz summasi hisobga KIRADI, qaytarishlar hisobdan CHIQADI. To'lovlar yig'indisi qarz summasidan oshmaydi; to'lov vaqti qarz vaqtidan oldin bo'lmaydi; vaqt hozirdan keyin bo'lmaydi. Qolgan = summa − to'langan; hisob qoldig'i `Calc.hisobQoldigi` da yozuvlar va qarzlardan hisoblanadi (alohida saqlanmaydi). Qarz amallari hisobotga, byudjetga va diagrammalarga kirmaydi. Bir shaxsga bir nechta qarz yozuvi bo'lishi mumkin (ro'yxatda shaxs bo'yicha guruhlanadi).

**Talablar.**
1. `TransactionType = Loan` qatorlari o'tkazib yuborilmaydi; oldindan ko'rishda alohida "Qarzlar" bo'limida chiqadi. Qarz qatorlarida Category va TransferedTo "-" bo'lishi mumkin ("-" bo'sh deb o'qiladi).
2. Ilovaning o'z qarz mantiqi qayta ishlatiladi: qarz va to'lovlar `Calc.qarzniTekshir`, `Calc.tolovniTekshir`, `Calc.qarzniYangilash` va saqlashdagi `Calc.tolovlarniBirlashtir` orqali, qo'lda qo'shilgandek yaratiladi. Hisob qoldig'iga ta'sir ham aynan `Calc.hisobQoldigi` yo'li bilan.
3. Yo'nalish: standart — `Borrowing` = pul hisobga KIRDI (qarz olindi), `Lending` = pul hisobdan CHIQDI (qarz berildi yoki qaytarildi). Oldindan ko'rishda shu taxmin yoziladi va BITTA almashtirgich bilan teskarisiga o'zgartiriladi (foydalanuvchi tasdiqlaydi); qoldiqlarga ta'siri darhol yangilanadi.
4. **Hech narsa taxmin qilinmaydi, birlashtirilmaydi, juftlanmaydi.** Har qarz qatori boshqa ilovadagidek AYNAN ko'chadi: nom (`LoanName` matni o'zgarishsiz; faqat ortiqcha bo'shliqlar bitta bo'shliqqa keltiriladi, chunki ilovaning qarz shaxs maydoni shuni qiladi), sana-vaqt, summa, hisob, izoh, tur. O'xshash nomlar ("Tez karta" / "Tez kartada") birlashtirilmaydi, harf kattaligi ham farq qiladi; Lending ni Borrowing ga o'zimiz bog'lamaymiz. Ilovaning qarz modeli (qarz = asosiy summa + qaytarishlar) talab qilgan joydagina bog'lash bor va u FAQAT `LoanName` ning aynan o'zi bo'yicha, sana tartibida: shu nomning ochiq qarzi bo'lsa va amal teskari yo'nalishda bo'lsa — u qarzning qaytarishi (to'liq sig'adigan eng birinchi qarzga, sig'masa eng eskisidan boshlab bo'laklanadi); aks holda amal o'zi alohida qarz yozuvi bo'ladi. Qaytarish qarzdan oshsa, ortiqcha qismi teskari yo'nalishdagi yangi qarz bo'ladi (ogohlantirish bilan). Shu tariqa har amalning sanasi, summasi va hisobi saqlanadi, hisob qoldiqlari amallar yig'indisiga teng chiqadi.
5. Takror: `TransactionId` bo'yicha (qarz qatorlari uchun ham); ID bo'lmasa (yoki o'zimizning `Q-000001` tartib raqami bo'lsa) — yo'nalish, sana, summa, hisob va nom bo'yicha mavjud qarz amallari bilan solishtiriladi. Shu fayl ikki marta yuklansa qarz ikkilanmaydi. Oldin yuklangan oddiy qatorlarga tegilmaydi.
6. `AccountFrom` bizdagi hisobga moslanadi (oddiy qatorlardagi kabi: noma'lum bo'lsa bir marta so'raladi).
7. "Oxirgi yuklashni bekor qilish" qarz yozuvlarini ham to'liq qaytaradi (qarzlar mantiqiy o'chadi, hisob qoldiqlari avvalgi holatga qaytadi).
8. Oldindan ko'rishda: nechta qarz qatori va qarz yozuvi, nom bo'yicha ro'yxat (har nom: qator soni, kirdi/chiqdi yig'indisi), har qatorning sanasi, summasi va yo'nalishi (kirdi/chiqdi), har qarzning yakuniy qoldig'i va hisob qoldiqlariga ta'siri.
9. Excel eksporti qarz amallarini shu ustunlar bilan chiqaradi: "Tur" = Qarz / Qarz to'lovi (`TransactionType = Loan` ning o'zimizdagi ko'rinishi), "Qarz nomi" (`LoanName`), "Qarz turi" = Berilgan / Olingan (`LoanType`), "Hisob" (`AccountFrom`). Qaytarish muddati ham chiqadi ("Qaytarish muddati" ustuni, eksportning oxirgi ustuni; Excelda haqiqiy sana). Eksport → toza baza → yuklash → eksport qarzlar uchun ham bir xil chiqadi.

**Cheklovlar (ochiq aytiladi).** To'lov (qaytarish) izohi saqlanmaydi: ilovadagi to'lovda izoh maydoni yo'q (server sxemasi o'zgartirilmaydi). Qarz yozuvi modeli bitta asosiy summa va qaytarishlardan iborat, shuning uchun bir nom ostida qaytarishdan keyingi yangi Borrowing/Lending yangi qarz yozuvi bo'ladi. Fayl qisman yangilangan bo'lsa (oldin yuklangan qarzga yangi amallar qo'shilgan), yangi amallar alohida qarz yozuvi bo'ladi (ro'yxatda shaxs bo'yicha guruhlanib ko'rinadi).

### 18.4. Importdagi jiddiy xatolarni tuzatish va yaxshilash (0.26.0)

**Maqsad.** Boshqa ilovadan eksport qilingan Excel ni import qilgach, natija o'sha ilovadagi holat bilan bir xil bo'lishi kerak: bir xil hisoblar, yozuvlar, o'tkazmalar, qarzlar. Hech narsa o'zgartirilmaydi va taxmin qilinmaydi.

**Xato 1 — o'tkazma qatorlaridan soxta hisoblar.** Faylda `TransferedTo` (ba'zan `AccountFrom`, `Category`, `LoanName`) katagida nom summa va valyuta bilan birga yozilishi mumkin ("TBS salom 400 000,00 UZS", "Cash UZS 100 000,00 UZS"). Eski import shu butun matnni hisob nomi deb olib, har summa uchun yangi hisob yaratardi. Talablar:
 a) Oxiridagi "<summa> <valyuta kodi>" qismi (bo'sh joy yoki uzilmas bo'sh joy, vergul/nuqta kasr) ajratib tashlanadi. Faqat summadan keyin valyuta kodi (UZS, USD…) turgan bo'lsa tashlanadi: "Visa 1234" kabi oxirgi 4 raqam o'zgarmaydi. Ajratilgan summa o'tkazma summasiga mos kelmasa — qatorda ogohlantirish.
 b) Tozalangan nom mavjud hisobga (katta-kichik harf, bo'shliq, apostrof turlariga befarq) moslashadi, aks holda ko'rinishda "yangi hisob".
 c) Hisob nomi sifatida "-" yoki bo'sh qiymat hech qachon yangi hisob yaratmaydi: hisobsiz qator yuklanmaydi (`R_HISOB`), foydalanuvchi ko'rinishda hisob tanlasagina yuklanadi (avvalgi "birinchi hisobga" taxmini olib tashlandi).
 d) Ko'rinishda "yangi hisoblar: N ta". N fayldagi noyob (tozalangan) hisob nomlari sonidan ko'p bo'lsa yoki 15 dan oshsa — KATTA OGOHLANTIRISH va yuklash qo'shimcha tasdiq talab qiladi.
 e) O'tkazma `AccountFrom` dan chiqadi, `TransferedTo` ga kiradi; ikkalasi haqiqiy hisob bo'lishi shart; umumiy balansni o'zgartirmaydi.
 f) `Category` va `LoanName` ham shunday tozalanadi. `Comment` (izoh) O'ZGARTIRILMAYDI: izohdagi summa foydalanuvchining matni.
 Fayldan o'qilgan hamma matndan boshqaruv belgilari (NUL va boshqalar) va yarim surrogatlar olib tashlanadi: serverning matn maydoni ularni rad etadi.

**Xato 2 — sinxron "Xato (N ta o'zgarish kutmoqda)".** Import bitta tranzaksiyada yuzlab qator yaratadi; serverga yuborishda bitta rad etilgan qator butun paketni (va keyingi hamma urinishni) to'xtatib qo'yardi. Tuzatish (navbat, qulf, last-write-wins qoidalari o'zgarmagan): yuborish bo'laklab (≤ 150 qator) davom etadi; bo'lak ma'lumot xatosi (PG 22xxx/23xxx, HTTP 400/409/413/422) bilan rad etilsa, u teng ikkiga bo'linib qayta yuboriladi va xatoli qator(lar) ajratiladi: ular navbatdan chiqarilib "rad etilgan" ro'yxatiga kod, jadval, qator ID si va sabab bilan yoziladi; qolgan qatorlar yuboriladi. Tarmoq, kirish (401/403) va server (5xx) xatolari esa avvalgidek butun tsiklni to'xtatadi va navbat saqlanadi.

**Qo'shimcha 1 — xatoni telefonda ko'rish.** Bosh sahifadagi "Xato (N ta o'zgarish kutmoqda)" belgisi bosilganda oyna: xato KODI, qisqa sabab (o'zbekcha), kutayotgan o'zgarishlar soni, rad etilgan qatorlar (kod, jadval, ID), "Qayta urinish" va "Kodni nusxalash" tugmalari.

**Qo'shimcha 2 — hisob qoldiqlarini moslash (ixtiyoriy).** Excelda boshlang'ich qoldiq yo'q. Ko'rinishda har hisob uchun "Boshqa ilovadagi hozirgi qoldiq" kiritish mumkin. Kiritilsa: boshlang'ich = kiritilgan − (importdan kelgan jami o'zgarish: yozuvlar, o'tkazmalar va qarz amallari). Yangi hisobda shu qiymat boshlang'ich qoldiq bo'ladi; mavjud hisobning boshlang'ich qoldig'i faqat alohida tasdiq bilan (belgi) o'zgaradi, sukut bo'yicha o'zgarmaydi. "Hozir → keyin" kiritilgan qiymatga aynan teng chiqadi. Bo'sh qoldirilsa hech narsa o'zgarmaydi (hisob 0 dan hisoblanadi). Majburiy emas.

**Tozalash.**
 - "Oxirgi yuklashni bekor qilish" import yaratgan YANGI hisob va kategoriyalarni ham (boshqa yozuv bog'lanmagan bo'lsa) olib tashlaydi; o'zgartirilgan boshlang'ich qoldiqlar avvalgi holatga qaytadi. Yuklashlar steki saqlanadi: har yuklash o'zining bekor qilish yozuvi bilan, oxirgisidan boshlab ketma-ket qaytariladi (avval faqat oxirgi yuklashning hisoblari qaytardi, oldingi yuklashlardagilar qolib ketardi).
 - Hisoblar → "Soxta/bo'sh hisoblarni tozalash": nomi "… <summa> <valyuta>" bilan tugaydigan va yozuvi yo'q yoki faqat import yozuvlari bor hisoblar ro'yxati. Har biri uchun tasdiq bilan: yozuvi yo'q — o'chirish; yozuvi bor va tozalangan nomdagi haqiqiy hisob bor — yozuvlarni (o'tkazma qabul tomoni va qarz hisobi ham) shu hisobga ko'chirish va soxta hisobni o'chirish. Hech narsa avtomatik o'chirilmaydi; boshqa yozuvi bor hisobga tasdiqsiz tegilmaydi. Bu ko'chirish yuklashni bekor qilishning o'rniga toza qayta import qilishga muqobil; yo'l: avval "Oxirgi yuklashni bekor qilish" (takroran), keyin yangi versiya bilan qayta yuklash.

### 18.5. Daromad/xarajat aniqlash va sinxron bog'liqlik (PG_23503) xatolari (0.27.0)

**Xato A — barcha qator xarajat bo'lib qoldi (shrift rangi o'qilmadi).** Sabab (to'qima faylda takrorlandi): faylda shrift rangi `Amount` katagida, ilova esa faqat tanlangan summa ustunining (`EnteredAmount`) rangini o'qirdi; u rangsiz bo'lgani uchun hamma qator "kategoriya bo'yicha tanlov" (standart: xarajat) ga tushdi. Talablar:
 1. Rang avval tanlangan summa katagidan, rangsiz bo'lsa shu qatordagi boshqa summa ustunlaridan (`EnteredAmount`, `Amount`, `AccountChargedAmount`, "Summa") o'qiladi. Qizil (FFFF0000) — xarajat, yashil (FF008000) — daromad.
 2. Excel XML qismlari (workbook, rels, sharedStrings, styles, sheet) nom fazosi old qo'shimchasiga ("x:", "ss:", "main:" yoki yo'q) va BOM ga befarq o'qiladi (localName bo'yicha; rels ham, varaq yo'li ham, `r:id` ham).
 3. Himoya: 100 va undan ko'p oddiy qator bo'lib, na rang, na manfiy summa bilan hech biri aniqlanmasa (va foydalanuvchi kategoriya bo'yicha o'zi belgilamagan bo'lsa), ko'rinishda KATTA OGOHLANTIRISH: "Rang o'qilmadi, hamma qator xarajat deb olinmoqda. Kategoriya bo'yicha tekshiring." va "Yuklash" qo'shimcha tasdiq so'raydi.
 4. Ko'rinishda har doim: "xarajat: N ta, daromad: M ta, o'tkazma: K ta, qarz: L ta" va aniqlash usuli (rang / manfiy summa / "Tur" ustuni / kategoriya tanlovi).

**Xato B — sinxron "Server bog'liqlikni tasdiqlamadi" (PG_23503).** Yozuvning `hisob_id` yoki `kategoriya_id` (yoki `qabul_hisob_id`, qarz va uning to'lovi uchun `qarz_id`/`hisob_id`) serverda yo'q. Talablar:
 1. Yuborish tartibi har doim ota jadvallar oldin: hisoblar → kategoriyalar → yozuvlar → byudjetlar → qarzlar → qarz to'lovlari → sozlamalar; har jadval o'z bo'laklarida (≤ 150), rad etilgan bo'lak ikkiga bo'linganda ham tartib saqlanadi (bo'laklar bir jadval ichida).
 2. Bo'lak bog'liqlik xatosi bilan rad etilsa, u bo'linmaydi: qatorlarning ota qatorlari tekshiriladi; serverda YO'Q ota qator mahalliyda bor bo'lsa, avval o'sha yuboriladi (serverda bor qator ustiga yozilmaydi: boshqa qurilma o'zgartirgan nusxa yo'qolmasin), keyin farzandlar qayta yuboriladi.
 3. Ota qator mahalliyda ham yo'q bo'lsa, qator "rad etilgan" ro'yxatiga kod (PG_23503), jadval, ID, tavsif va qaysi ota qator yo'qligi bilan yoziladi va navbatdan chiqariladi, LEKIN doimiy xato bo'lmaydi: keyingi tsikllarda (5 marta) avtomatik qayta navbatga qo'yiladi; "Qayta urinish" cheklovsiz qayta yuboradi.
 4. Xato oynasi: har rad etilgan qator uchun yo'q ota qator ("Kategoriya: Ovqatlanish (id aaaaaaaa…) serverda topilmadi"), jami soni va 10 tadan ko'p bo'lsa "va yana N ta".
 5. Tozalash va bekor qilish ota qatorni faqat unga bog'langan tirik yozuv bo'lmaganda mantiqiy o'chiradi (yetim yozuv hosil bo'lmaydi); o'chirilgan ota qator serverda ham qator sifatida qoladi (`deleted = true`), shuning uchun bog'liqlik buzilmaydi.

## 19. Qarz amallari hisobotda — ixtiyoriy (0.28.0)

**Maqsad.** Ba'zi ilovalarda qarz amallari hisobot (Kategoriyalar diagrammasi, "Naqd pul oqimi") ga qo'shiladi: qarz olish — "Olingan qarz" nomli DAROMAD kategoriyasi, qarz berish/qaytarish — "Berilgan qarz" nomli XARAJAT kategoriyasi. Bizda esa qarz amallari hisobot, byudjet va diagrammalarga kirmaydi (TZ.md 6-qoida). Endi bu ixtiyoriy.

**Sozlama.** Menyu → Asosiy sozlamalar → "Qarzlarni hisobotga qo'shish". SUKUT: YOQIQ. Qiymat shu qurilmada saqlanadi (`localStorage`, kalit `moliya-qarz-hisobotda`). Akkauntga sinxronlanmaydi: serverdagi `sozlamalar` jadvalida bunday ustun yo'q, yangi ustun/jadval qo'shish esa taqiqlangan (server sxemasiga tegilmaydi); mavjud sozlama yozuvi serverdan tortilganda faqat serverdagi maydonlar bilan qayta quriladi, shuning uchun u yerga yozilgan qo'shimcha maydon yo'qolib ketardi. Yangi qurilmada sukut (yoqiq) amal qiladi.

**Qaysi amal qaysi tomonga tushadi** (oy — amal sanasiga qarab):
 - Hisobga PUL KIRDI = daromad tomoni, "Olingan qarz": olingan qarzning asosiy summasi; berilgan qarz qaytarib olinganda har bir qaytarish.
 - Hisobdan PUL CHIQDI = xarajat tomoni, "Berilgan qarz": berilgan qarzning asosiy summasi; olingan qarz qaytarilganda har bir qaytarish.
 - Mantiqiy o'chirilgan qarz va qaytarishlar hisobga olinmaydi.

**Qayerda ko'rinadi (yoqiq bo'lsa):** Asosiydagi "Kategoriyalar" (diagramma va ro'yxatda alohida qatorlar: daromad tomonida "Olingan qarz", xarajat tomonida "Berilgan qarz"), "Naqd pul oqimi" (Xarajat, Daromad, Sof balans), Hisobot ekrani (jami, oldingi davr bilan taqqoslash, doira va ustunli diagramma). "Olingan qarz" / "Berilgan qarz" qatori bosilsa Qarzlar bo'limi ochiladi (ular haqiqiy kategoriya emas, Tarix filtriga qo'yib bo'lmaydi).

**O'chiq bo'lsa:** hozirgi xatti-harakat saqlanadi (qarz hisobotga kirmaydi).

**Nimaga ta'sir QILMAYDI (qaror):** byudjet (qarz byudjet sarfiga kirmaydi: byudjet kategoriyalar bo'yicha oylik chegara, qarz esa kategoriyasiz), Tarix (qarz amallari avvalgidek alohida qatorlar; ~~kun va oy jami o'zgarmaydi~~ — bu qaror 27-band bilan ALMASHTIRILGAN: Tarix jamlariga qarz amallari endi qo'shiladi), hisob qoldig'i va umumiy balans (ular hamisha yozuvlar va qarzlardan hisoblanadi, sozlamaga bog'liq emas), Excel eksport, zaxira. Hisobotdagi "Olingan qarz"/"Berilgan qarz" faqat ko'rsatish uchun hisoblanadi (bazaga yozilmaydi, sinxronlanmaydi).

## 20. Soddalashtirish va yangi dizayn (0.29.0)

Maqsad: ortiqcha narsalarni olib tashlash. Yangi funksiya qo'shilmaydi. Sinxronlash yadrosi qoidalari (outbox, qulf, tombstone, ota-bola tartibi, partiyalash, oxirgi yozgan yutadi) va server sxemasi o'zgarmaydi.

### 20.1 Birinchi sinxronlash: tanlov yo'q
"Birlashtirish", "Faqat serverdagini olish", "Faqat shu qurilmadagini yuborish" tugmalari va tanlov ekrani olib tashlanadi. Google bilan kirgandan keyin, hech narsa so'ramasdan:
- Serverda shu foydalanuvchining ma'lumoti BOR bo'lsa: server yutadi. Qurilma serverdagidek bo'lib qoladi; shu qurilmadagi, serverga hali yuborilmagan ma'lumot tashlanadi (navbat ham tozalanadi).
- Serverda ma'lumot YO'Q bo'lsa: qurilmadagi ma'lumot serverga yuklanadi (hech narsa o'chirilmaydi).
- Ikkalasi ham bo'sh bo'lsa: oldingidek (shunchaki yoqiladi).
- Bu qoida faqat shu hisob uchun BIRINCHI sinxronda ishlaydi. Keyingi sinxronlashlar eski qoida bo'yicha (outbox, oxirgi yozgan yutadi).
- Eslatma: qurilma boshqa hisob bilan sinxronlangan bo'lsa ham qoida bir xil (serverda bor bo'lsa server yutadi, yo'q bo'lsa yuklanadi).
- Xatolik bo'lsa mahalliy ma'lumot o'zgarmaydi (almashtirish bitta tranzaksiyada) va oddiy "Qayta urinish" ishlaydi.

### 20.2 Bosh ekranda sinxron banneri yo'q
"Xato (N ta o'zgarish kutilmoqda)" va shunga o'xshash kulrang/qizil banner bosh ekrandan butunlay olib tashlanadi. Sinxronlash holati oynasi (kod, sabab, "Qayta urinish", "Kodni nusxalash") Menyu → Profil va sinxronlash ichida qoladi. PG_42501 xatosi Sozlamalar qatori uchun jimgina e'tiborsiz qoldiriladi: foydalanuvchiga ko'rinmaydi, kutilayotganlar sonida hisoblanmaydi.

### 20.3 Zahiralash (JSON zaxira) olib tashlanadi
JSON zaxira olish va tiklash, bosh ekrandagi zaxira kartasi va eslatmasi, "ilg'or rejim", import/sinxron/hisobni o'chirishdan oldingi avtomatik zaxira fayli, Sozlamalardagi zaxira matnlari olib tashlanadi. Excelga yuklab olish va Excel dan yuklash QOLADI. Serverdagi `oxirgi_zaxira_sanasi` ustuni sxemada qoladi (sxema o'zgarmaydi), lekin ilova uni ishlatmaydi.

### 20.4 Qarzlar har doim hisobotda
v0.28.0 dagi "Qarzlarni hisobotga qo'shish" tugmasi olib tashlanadi. Qarz amallari doim hisobotda: "Olingan qarz" — daromad tomonida, "Berilgan qarz" — xarajat tomonida (Kategoriyalar va Naqd pul oqimi). Byudjet va hisob qoldig'iga ta'siri o'zgarmaydi. Eski sozlama kaliti (`moliya-qarz-hisobotda`) e'tiborsiz qoldiriladi. (Tarixga ta'siri 27-band bilan o'zgargan: Tarix jamlariga qarz amallari qo'shiladi, qatorlar soni o'zgarmaydi.)

### 20.5 Saqlagandan keyin Tarixga o'tish
Xarajat, daromad yoki o'tkazma yozuvi TO'LIQ saqlangach forma yopiladi, ilova avtomatik "Tarix" bo'limiga o'tadi va yangi yozuvning oyi ko'rinadi (yangi yozuv ro'yxatda ko'rinadi). Forma qayta ochilmaydi.

## 21. Yangi dizayn (0.30.0)

Faqat ko'rinish va joylashuv o'zgaradi. Ma'lumot mantig'i, sinxronlash va hisob-kitoblar o'zgarmaydi. Hamma ekran yorug' va qora (tungi) rejimda; ranglar CSS o'zgaruvchilarida (`style.css`, "0.30.0" bo'limi).

### 21.1 Umumiy
- Kartalar yumaloq (burchak 18 px), nozik chegara, ichida yetarli bo'sh joy.
- Kategoriya belgisi: 40 px yumaloq-kvadrat katak, ikonning o'zi ≈23 px, katak foni ikon rangining ≈15% tusi (qisqa chip va ro'yxatlarda 28 px).
- Ekran tepasidagi sarlavha qatori (Asosiy: yumaloq menyu tugmasi va ekran nomi) `position: sticky; top: 0`: sahifa aylanganda joyida turadi, orqa foni to'liq qoplangan, pastida nozik chiziq.
- Pastki navigatsiya (Asosiy / Tarix / "+" / Qarzlar / Ko'proq): chetdan ichkarida suzuvchi, ≈22 px burchakli panel; tanlangan bo'lim engil rangli yumaloq fonda. iPhone pastki xavfsiz zonasi (safe-area) hisobga olinadi.
- Raqamlar kartadan chiqmaydi: bitta qator, tekis (tabular) raqamlar; katak ichiga sig'masa shrift 1 pikseldan kichrayadi (eng kichigi 11 px), shunda ham sig'masa qisqa ko'rinishga o'tadi ("10,8 mln"). Gorizontal siljish yo'q (`js/sigdir.js`).

### 21.2 Naqd pul oqimi ("C varianti")
Karta engil ko'k-kulrang fonda (yorug' `#E8EEF7`, qora `#1B2130`). Tepada "Naqd pul oqimi" va oy nomi (pill, hamon oy tanlagichi). Ikki kichik katak yonma-yon: Xarajat (yorug' `#B3412F`, qora `#FF8A78`, "−8 400 000") va Daromad (yorug' `#2F7A3F`, qora `#5FD38A`, "+10 850 000"); katak foni yorug' oq, qora `#262E40`. Eng pastida to'liq kenglikdagi tasma: "Sof balans" va yirik raqam (yorug' `#2F4A72`, qora `#3A64B5`, matn oq).

### 21.3 Donut diagramma (Kategoriyalar)
- Yarqin ranglar: binafsha `#7C5CFF`, ko'k `#1E9BFF`, yashil `#19C37D`, sariq `#FFB020`, pushti `#FF5C8A` va yana `#14C8C8`, `#FF7A3D`, `#B25CFF`; har bo'lak boshqa rang; "Boshqalar" kulrang.
- Tilimlar orasida ≈7 px ochiq joy, uchlari tekis (`stroke-linecap: butt`), halqa qalinligi 22 (viewBox 180, radius 64). Markazda "Xarajat" (yoki "Daromad") va qisqa jami summa ("8,4 mln").
- Eng katta 5 ta kategoriya alohida; qolgani va jami summaning 3% idan kichiklari bitta "Boshqalar" bo'lagiga yig'iladi (faqat ko'rinish: summalar o'zgarmaydi; yig'iladigan kategoriya bittagina bo'lsa, u o'z bo'lagida qoladi).
- Ro'yxat: har kategoriya uchun ikon katagi, nomi, foizi (va summasi). "Boshqalar" qatori "N ta, bosib oching" bilan yopiq; bosilsa ichidagi kategoriyalar shu qator ostida ochiladi, yana bossa yopiladi. Diagrammadagi "Boshqalar" bo'lagi bosilsa, o'sha kategoriyalarning yozuvlari ochiladi (avvalgidek).

### 21.4 Tarix
Tepada engil rangli karta: "Oy balansi" va oy nomi (pill), ostida katta raqam (oy sof balansi), undan keyin Xarajat va Daromad ikki katakda YONMA-YON. Ostida sana sarlavhasi ("9-oktabr") va har kun uchun yumaloq kartada yozuvlar. Har yozuvda faqat kategoriya belgisi (40 px); hisob belgisi yo'q, hisob nomi kategoriya nomi ostida kichik oddiy matn. Summa o'ngda: xarajat qizil, daromad yashil.

### 21.5 Qarzlar
Tepada ikkita katta tugma-karta yonma-yon: "Berilgan qarzlar" va "Olingan qarzlar", har birida jami summa; tanlangani rangli fon va rangli chegara bilan. Boshlang'ich holat — Berilgan. Pastda tanlangan tur ro'yxati: odam belgisi, ism, "Muddat: …", o'ngda qolgan summa. Qatorni bosish qarz tafsilotini ochadi (avvalgidek).

## 22. Kategoriya ikonlari, ranglari va Tarix ko'rinishi (0.31.0)

Sinxronlash yadrosi qoidalari (tombstone, ota-bola tartibi, partiyalash) o'zgarmaydi. Ma'lumot mantig'i va hisob-kitoblar o'zgarmaydi.

### 22.1 Ikon to'plami
Tabler Icons (MIT litsenziya, outline uslub) dan faqat kerakli SVG lar bitta lokal faylga (`js/ikonlar.js`) joylashtiriladi; internet va CDN kerak emas. Fayl `sw.js` keshiga qo'shiladi, litsenziya eslatmasi README da. Tabler da bo'lmagan nomlar yaqin ma'noli ikon bilan almashtirildi: `taxi` → `car-suv`, `tooth` → `dental`, `piggy-bank` → `moneybag`. Eski belgilar (`js/belgilar.js`) hisoblar uchun va eski kategoriyalarni ko'rsatish uchun qoladi.

### 22.2 Kategoriyada ikon va rang
- Har kategoriyada ikon kaliti (`belgi`) va rang (`rang`, hex) saqlanadi. Bu maydonlar lokal bazada ham, serverdagi `kategoriyalar` jadvalida ham ALLAQACHON bor va sinxronlanadi, shuning uchun yangi ustun va yangi SQL migratsiya KERAK EMAS; faqat `belgi` qiymatlari yangi (Tabler) kalitlar bo'ladi.
- Kategoriya qo'shish/tahrirlash oynasida "Ikonni tanlash": guruhlangan to'plam (Oziq-ovqat, Transport, Uy va kommunal, Sog'liq va go'zallik, Ta'lim va oila, Xarid va ko'ngilochar, Sovg'a va ehson, Daromad, Moliya va qarz, Boshqa), 4 ustun, ostida qisqa o'zbekcha nom. "Rangni tanlash": 16 ta tayyor yarqin rang (`#7C5CFF #1E8FFF #00B4D8 #14B870 #2EA84F #6FBF2E #E6B800 #F5A300 #FF7A2F #E5483D #F0407A #C2409B #9B4DDB #2F5DDB #26A69A #7B8498`) va "Boshqa rang" (rang tanlagich).
- Ikon ko'rinishi: 40 px yumaloq-kvadrat katak (burchak ≈13 px), TO'LIQ tanlangan rangda, ichida ≈23 px ikon. Ikon rangi avtomatik: rang och bo'lsa (nisbiy yorqinlik > 0,55; ko'z qabul qiladigan yorug'lik 0,299 R + 0,587 G + 0,114 B, shuning uchun sariq va to'q sariq "och" hisoblanadi) to'q `#1F2A3A`, aks holda oq. O'tkazma yozuvlari: `arrows-exchange`, kulrang `#7B8498`.
- Shu ikon va rang hamma joyda: Tarix, Kategoriyalar ro'yxati, byudjet, yozuv qo'shish oynasi, donut (har bo'lak kategoriyaning o'z rangida; "Boshqalar" `#7B8498`).

### 22.3 Bir martalik boshlang'ich ikon va rang
Yangi ikon tanlanmagan (eski kalitli) kategoriyalarga qurilmada BIR MARTA, nomga qarab (kichik harf, apostrof turlariga e'tiborsiz) beriladi; foydalanuvchi keyin o'zgartirsa, qayta ustiga yozilmaydi (qurilmadagi "bajarildi" belgisi va yangi kalitli kategoriyaga tegilmaydi). Qoidalar (birinchi mos kelgani): taksi → `car-suv` #F5A300; ovqat → `tools-kitchen-2` #14B870; do'kon/dokon/market → `building-store` #2EA84F; ro'zg'or/bozor → `shopping-cart` #1E8FFF; jamoat/avtobus → `bus` #00B4D8; benzin/yoqilg'i → `gas-station` #E5483D; ijara → `key` #6A4CE0; kommunal → `bulb` #E6B800; internet → `wifi` #3F6FE0; telefon/aloqa → `device-mobile` #3F6FE0; apteka/dori → `pill` #E0356B; shifokor/klinika → `stethoscope` #E0356B; kontrakt/o'qish/kurs → `school` #E08A00; kredit → `credit-card` #2F5DDB; komissiya → `percentage` #5C6BC0; keshbek/cashback → `arrow-back-up` #1C9AE0; ish haqi/oylik → `wallet` #12B76A; avans → `cash` #6FBF2E; go'sht → `meat` #E5483D; sunniy intellekt/ai → `robot` #00A3A3; trading → `chart-line` #0FA36B; kiyim → `shirt` #F0407A; sovg'a → `gift` #FF7A2F; ta'til/dam → `beach` #00B4D8; "boshqa" → `dots` #7B8498; "nomalum"/"noma'lum" → `help-circle` #8D6E63. Boshqa nomlar: `tag` ikoni va nomdan olingan barqaror (hash) yarqin rang (16 ta tayyor rangdan).

### 22.4 Tarix ko'rinishi
- Tepa qism STICKY (`position: sticky; top: 0`, orqa foni to'liq qoplangan, pastida nozik chiziq): menyu tugmasi, "Tarix" sarlavhasi, qidiruv va filtr tugmalari va ostida oylar qatori (siljitish chizig'i yashirin, tanlangan oy o'zi ko'rinadigan joyga suriladi). "Oy balansi" kartasi sticky emas. Asosiy, Qarzlar va Ko'proq sarlavhasi ham sticky (menyu tugmasi va ekran nomi).
- Kun sarlavhasi: chapda sana ("30-sentabr", qalin, bir qator), ostida kichik kulrang "Chorshanba · 5 ta yozuv" (bugun: "Bugun · Juma · 3 ta yozuv", kecha: "Kecha · …"; hafta kuni mahalliy sana bo'yicha). O'ngda ikki yumaloq belgi: qizil "−2 750 000" (xarajat), yashil "+6 114 594" (daromad), "so'm" yo'q, bo'lmagani ko'rsatilmaydi. Joy yetmasa ikkalasi birga "mln" ko'rinishiga o'tadi ("−2,75 mln", "+6,11 mln", "−12,3 mln", 100 mln va ko'pi butun "+100 mln"; 1 mln dan kichik bo'lsa "ming"); belgilar ikkiga bo'linmaydi va chapdagi sanani siqmaydi.
- Yozuvlar kun sarlavhasi ostida bitta yumaloq kartada (18 px), qatorlar nozik chiziq bilan. Qatorda: ikon katagi, nom (14 px), ostida bir qatorda "20:23 · Hisob nomi" (ellipsis), ostida izoh (bir qator, kulrang, ellipsis), o'ngda summa "−60 000 so'm" (siqilmaydi; xarajat qizil, daromad yashil, o'tkazma oddiy rangda). O'tkazmada hisob yo'li "Birinchi → Ikkinchi".
- Izoh bir qatordan uzun bo'lsa qisqartiriladi ("…"); izoh qismi bosilsa to'liq ochiladi, yana bossa yig'iladi; butun qatorni bosish yozuvni tahrirlashga olib boradi (avvalgidek). Izoh qisqa bo'lsa hech narsa o'zgarmaydi.

### 22.5 Pastki menyu
Qarzlar — `users` (ikki odam), Asosiy — `home`, Tarix — `history`, Ko'proq — `dots`. Markazdagi "+" tugmasi o'zgarmaydi.

## 23. AI yordamchi: server qismi (1-PR, jami 3 tadan)

Bu band 3-bandda "alohida TZ" deb qoldirilgan sun'iy intellektning birinchi qismi. Bu PR da ilova ko'rinishiga va ilova fayllariga (`index.html`, `js/`, `style.css`, `sw.js`) TEGILMAYDI; chat ekrani va tugma keyingi PR larda. Qilinmaydi: chat ekrani, ilovadagi hisoblash, pullik obuna, ovoz, chek rasmi.

### 23.1. G'oya (o'zgarmas qoida)
**AI hech qachon raqam hisoblamaydi va to'qimaydi.** 1) Savol -> AI tuzilgan so'rov (JSON) qaytaradi (rejim `reja`). 2) Ilova shu so'rovni telefonda o'z ma'lumotidan hisoblaydi (keyingi PR). 3) Hisoblangan natija -> AI uni 1–2 gapli o'zbekcha matnga aylantiradi (rejim `javob`).

### 23.2. Fayllar va joylash
`supabase/functions/yordamchi/index.ts` (Supabase Edge Function): BITTA fayl, boshqa mahalliy fayldan import yo'q, tashqi paket yo'q; Supabase Dashboard muharririga nusxalab joylanadi (CLI ishlatilmaydi). Qadamlar: `supabase/README.md` 5-bo'lim. Sinov: `supabase/functions/yordamchi/test.mjs` (29 tekshiruv, AI taqlid qilinadi). Limit: `supabase/007_ai_limit.sql` (+ `008_ai_limit_testi.sql`, 11 tekshiruv).

### 23.3. So'rov tanasi (POST, JSON) va javoblar
- `reja`: `{ rejim, savol, bugun: "YYYY-MM-DD", kategoriyalar: [nom…], hisoblar: [nom…] }` (har ro'yxat ≤ 100 ta, nom ≤ 60 belgi). Javob: `{ ok: true, sorov }`.
- `javob`: `{ rejim, savol, sorov, natija }`, `natija` — obyekt (faqat raqamlar, kategoriya/hisob nomlari, mantiqiy qiymat; chuqurlik ≤ 4, ≤ 4000 belgi). Javob: `{ ok: true, matn }` (≤ 400 belgi).
- Xato: `{ xato: { kod, sabab } }`, `sabab` o'zbekcha.

**Tuzilgan so'rov (sxema, qat'iy):** `{ amal, davr: {dan, gacha}, davr2: {dan, gacha} | null, tur: "xarajat" | "daromad" | null, kategoriya: nom | null, hisob: nom | null, matn: izohdan qidiriladigan so'z | null }`. Hamma 7 kalit bo'lishi shart, ortiqcha kalit rad etiladi. `amal`: `yigindi`, `kategoriyalar`, `qidiruv`, `taqqoslash`, `qarzlar`, `hisoblar`, `oylik_hisobot`, `tushunarsiz`. Qoidalar: sanalar haqiqiy (`YYYY-MM-DD`, `dan` ≤ `gacha`); `tushunarsiz` dan boshqa amalda `davr` shart; `davr2` faqat `taqqoslash` da (va unda shart); `qidiruv` da `matn` shart (≤ 40 belgi); `kategoriya` va `hisob` `reja` rejimida yuborilgan ro'yxatdagi nom bo'lishi shart (katta-kichik harf, bo'shliq, apostrof turlariga e'tiborsiz; ro'yxatdagi aniq yozuv qaytariladi). AI javobi sxemaga mos kelmasa (JSON emas, noma'lum amal, ro'yxatda yo'q nom va h.k.) `reja` rejimida xato emas, `amal = "tushunarsiz"` (qolgan maydonlar `null`) qaytadi.

### 23.4. Raqam tekshiruvi (`javob`)
AI matnidagi har raqam kirishda bo'lishi shart. Ruxsat etilgan raqamlar: `natija` dagi barcha sonlar (nomlardagi raqamlar ham) va `sorov.davr/davr2` sanalarining yil, oy, kun qismlari. Savoldagi raqamlar ham ruxsat etiladi (25.1-band bilan o'zgargan). "1 200 000", "1200000", "1,25 mln" (faqat ko'rsatilgan aniqlik doirasida yaxlitlash) mos hisoblanadi. Birorta raqam topilmasa, matn QAYTARILMAYDI: `AI_RAQAM` (502). AI ga raqamlarni so'z bilan yozmaslik buyuriladi (so'z bilan yozilgan raqamni tekshirib bo'lmaydi: cheklov).

### 23.5. Ruxsat va cheklovlar
- **Kirish:** `Authorization: Bearer <JWT>` bo'lmasa yoki yaroqsiz bo'lsa 401 `AI_RUXSAT`. JWT Supabase Auth (`/auth/v1/user`) orqali tekshiriladi.
- **Ruxsat ro'yxati:** kirgan foydalanuvchi emaili maxfiy o'zgaruvchi `AI_RUXSAT_EMAIL` (vergul bilan) da bo'lishi shart, aks holda 403 `AI_RUXSAT`. O'zgaruvchi yo'q yoki bo'sh bo'lsa hech kimga ruxsat yo'q. Email repoga yozilmaydi (sinov fayli ham tekshiradi).
- **Savol uzunligi:** ≤ 300 belgi, aks holda 413 `AI_UZUN`. AI javob tokenlari cheklangan (reja 300, javob 250).
- **Kunlik limit:** bir foydalanuvchiga kuniga 100 ta so'rov (kun — Asia/Tashkent). Har to'g'ri shakldagi so'rov (reja ham, javob ham alohida) sanaladi, ya'ni bitta savol 2 ta so'rov = kuniga ~50 ta savol. Hisoblash `public.ai_limit_oshir()` funksiyasi orqali (007): yangi jadval `ai_limit(user_id, kun, soni)`, RLS yoqilgan va FORCE, hech qanday siyosat yo'q (ilovadan jadvalga tegib bo'lmaydi), funksiya `SECURITY DEFINER`, faqat `auth.uid()`, EXECUTE faqat `authenticated`; hisob o'chirilsa qatorlar cascade bilan ketadi; 7 kundan eski qatorlar o'zi tozalanadi. 101-chi so'rov 429 `AI_LIMIT`. Jadval yo'q bo'lsa (007 ishga tushirilmagan) so'rov rad etiladi (503 `AI_LIMIT`), chunki cheklovsiz ishlash xavfli. Mavjud jadvallarga tegilmadi.
- **CORS:** faqat `https://jahon-gir.github.io` va `http://localhost:8000`; boshqa manzilga `Access-Control-Allow-Origin` berilmaydi.

### 23.6. Xato kodlari
| Kod | HTTP | Ma'nosi |
|---|---|---|
| `AI_RUXSAT` | 401 / 403 | Kirmagan yoki ruxsat etilmagan |
| `AI_KIRISH` | 400 / 405 | So'rov shakli noto'g'ri |
| `AI_UZUN` | 413 | Savol 300 belgidan uzun |
| `AI_LIMIT` | 429 / 503 | Kunlik limit tugadi / limitni tekshirib bo'lmadi |
| `AI_PROVAYDER` | 502 | Provayder sozlanmagan, kalit yo'q, xato yoki bo'sh javob |
| `AI_SXEMA` | 502 | `javob` rejimida AI matni talabga mos emas (juda uzun) |
| `AI_RAQAM` | 502 | AI matnidagi raqam natijada yo'q |
| `NETWORK` | 503 | Tarmoq xatosi (provayder yoki Supabase Auth) |

### 23.7. Provayder va maxfiy o'zgaruvchilar
Provayder sozlama bilan almashadi: `AI_PROVAYDER` (`openai` yoki `claude`), `AI_MODEL`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`. Hammasi FAQAT Supabase Secrets da; kodga, repoga, testga yozilmaydi. `AI_MODEL` ataylab sukut qiymatsiz: model nomi o'zgarib turadi, noto'g'ri nom o'rniga aniq xato (`AI_PROVAYDER`) berilgani yaxshi. So'rov vaqti chegarasi 20 soniya.

### 23.8. AI ga nima YUBORILMAYDI (maxfiylik)
AI ga yozuvlar ro'yxati, izohlar va qarzdagi shaxs ismlari yuborilmaydi. Yuboriladi: savol, bugungi sana, kategoriya/hisob nomlari, ilova hisoblagan jamlar. `javob` rejimida `natija` da `izoh`, `shaxs`, `ism`, `yozuvlar`, `qarzdor`, `tolovlar`, `matn`, `savol` kabi kalitlar bo'lsa so'rov rad etiladi (400 `AI_KIRISH`), AI chaqirilmaydi. Funksiya savol va natijani logga yozmaydi (kodda `console.*` yo'q; sinov tekshiradi) va bazaga ham saqlamaydi (faqat kunlik son).

### 23.9. Ochiq qolgan va qabul qilingan taxminlar
- Haqiqiy Supabase'da va haqiqiy AI provayderi bilan sinalmagan (kalit yo'q); foydalanuvchi `supabase/README.md` 5.4 bo'yicha tekshiradi.
- Ilovada chat ekrani, tugma va hisoblash keyingi PR larda; `natija` ning aniq shakli (qaysi amal qanday kalitlar qaytaradi) o'sha PR da belgilanadi.
- Versiya raqami (`index.html`) bu PR da oshirilmadi: ilova fayllariga tegilmadi.

## 24. AI yordamchi: tugma, chat ekrani va hisoblash (2-PR, jami 3 tadan, 0.32.0)

Server funksiyasiga (23-band), server sxemasiga va sinxronlash mantig'iga TEGILMAGAN. Javob bu bosqichda ODDIY MATNDA; kartochkali javoblar, ovoz, chek rasmi, pullik obuna va suhbatni saqlash qilinmaydi.

### 24.1. Fayllar
`js/yordamchi-sof.js` (sof: hisoblash, natija tekshiruvi, xato matnlari, tayyor savollar; `YordamchiSof`), `js/yordamchi.js` (server bilan aloqa, suzuvchi tugma, chat ekrani; `Yordamchi`). `index.html` va `sw.js` `royxat()` ga qo'shildi; `ui.js` da faqat ikki joy: `Yordamchi.boshlash(...)` va `chizish()` oxirida `Yordamchi.yangila()`. Stillar `style.css` oxirida ("0.32.0").

### 24.2. Suzuvchi tugma ("Ko'zlar")
- Faqat Asosiy sahifada (ichki ekran ochiq bo'lmaganda), pastki menyu ustida, o'ngdan 16 px, menyudan 16 px yuqorida. 58x58, to'liq dumaloq, foni `#1F2A3A`, atrofida 3 px oq hoshiya va yumshoq soya. Tungi rejimda foni `#3A64B5`, hoshiya sahifa foni rangida.
- Ichida faqat ikki ko'z (o'zim chizgan SVG): ikkita oq tik oval, to'q qorachiq, qorachiqlar biroz o'ngga-pastga qaragan. Har 6 soniyada bir marta pirpiraydi; bosilganda qorachiqlar markazga keladi. `prefers-reduced-motion` yoqiq bo'lsa pirpirash va siljish animatsiyasi yo'q. `aria-label="Yordamchi"`.
- Faqat Google bilan kirgan foydalanuvchiga ko'rinadi (chiqsa yashirinadi). PIN qulfida yashirin.
- **Yopiq belgisi:** server 403 (`AI_RUXSAT`) qaytarsa: "Yordamchi hozircha siz uchun yopiq" xabari, chat yopiladi va tugma shu qurilmada yashiriladi. Belgi `localStorage` da (`moliya-yordamchi-yopiq`), qiymati — foydalanuvchi id si (email saqlanmaydi, kodga yozilmaydi). Boshqa akkaunt bilan kirilsa shu akkaunt uchun yopiq emas. Chiqib (sessiya tugab) qayta kirilsa belgi o'chadi. (Haqiqiy server ruxsati o'zgarmaydi: bu faqat ko'rinish.)

### 24.3. Chat ekrani
To'liq ekran (pastki menyu yopiladi), sarlavha: "Orqaga" (44 px yumaloq), "Yordamchi", o'ngda "Suhbatni tozalash" (44 px). Savol: o'ngda, fon `#E8EEF7`, matn `#2F4A72`, 14 px qalin, burchak 16 px. Javob: to'liq kenglikdagi karta (oq fon, nozik chegara, burchak 18 px, ichki bo'shliq 16 px, 15 px oddiy matn). Bo'sh suhbatda "Faqat sizning yozuvlaringizdan javob beradi" va 5 ta tayyor savol ("Shu oy xarajatim", "Shu oy eng ko'p nimaga sarfladim?", "Menga kim qarzdor?", "Hisoblarimda qancha bor?", "<Joriy oy> hisoboti"). Pastda matn maydoni (300 belgi) va 48 px dumaloq "Yuborish". Kutishda javob o'rnida uch nuqta, yuborish o'chiq. Tungi rejim: fon `#12161F`, karta `#1B2130`, chegara `#2A3245`, matn `#E8ECF3`, kulrang `#9AA6BA`, savol foni `#262E40`, savol matni `#A9C2F0`. **Suhbat faqat xotirada** (o'zgaruvchi): bazaga, serverga, zaxiraga va `localStorage` ga yozilmaydi; ilova yopilsa yoki "Tozalash" bosilsa o'chadi (chatdan chiqib qaytsa, ilova ochiq turguncha saqlanadi). Qo'shimcha: Escape yopadi; iPhone klaviaturasi ochilganda ekran ko'rinadigan oynaga moslanadi.

### 24.4. Oqim
Savol -> `rejim: "reja"` (savol, bugungi sana, kategoriya va hisob nomlari) -> tuzilgan so'rov -> ilova telefonda hisoblaydi -> `rejim: "javob"` (savol, so'rov, natija) -> matn. `amal = "tushunarsiz"` bo'lsa serverga ikkinchi so'rov yuborilmaydi: "Savolni tushunmadim. Masalan: «Shu oy taksiga qancha ketdi?»". Internet yo'q bo'lsa so'rov umuman ketmaydi. 401 bo'lsa token bir marta yangilanib qayta yuboriladi.
**Serverga faqat** raqamlar, sanalar, kategoriya va hisob nomlari ketadi. Yozuvlar ro'yxati, izoh matni va qarzdagi shaxs ismlari yuborilmaydi: natijada bunday kalit yo'q va ilova yuborishdan oldin natijani server qoidalari bilan (taqiqlangan kalitlar, kalit nomi, uzunlik, chuqurlik) o'zi tekshiradi. Kategoriya nomlari ro'yxatiga hisobotdagi "Olingan qarz" va "Berilgan qarz" ham qo'shiladi (Asosiy sahifadagi hisobotda bor). Nomlar ≤ 60 belgi, ≤ 100 ta.

### 24.5. Natija shakllari (har amal)
Hisob-kitoblar mavjud `Calc` funksiyalari bilan (`hisobot`, `yozuvlarniSuz`, `hisobQoldigi`, `umumiyBalans`, `qarzlarJami`, `taqqoslash`); yozuvlar: o'chirilmaganlar + qarz amallari (20.4: "Olingan qarz" daromad, "Berilgan qarz" xarajat, Asosiy sahifadagi hisobot bilan bir xil); o'tkazma hisobotga kirmaydi, qarz qoldig'i `qarzQolgan` dan. `tur` bo'sh bo'lsa: kategoriyaning turi, u ham bo'lmasa `xarajat`. Barcha sonlar butun va MANFIY EMAS (server raqam tekshiruvi minusni tanimaydi): yo'nalish alohida so'z bilan. Qidiruv izohdan (qarz amallari qidirilmaydi, chunki ularning "izohi" shaxs ismi).
- `yigindi`: `{ tur, jami, yozuvlar_soni, kategoriya?, hisob? }`.
- `kategoriyalar`: `{ tur, jami, eng_katta: [{ nom, summa }] (ko'pi bilan 5 ta), hisob? }`.
- `qidiruv`: `{ tur, topilgan_soni, jami, kategoriya?, hisob? }`.
- `taqqoslash`: `{ tur, davr1_jami, davr2_jami, farq (≥ 0), yonalish: "oshgan" | "kamaygan" | "teng", foiz? (≥ 0; davr2 jami 0 bo'lsa yo'q), kategoriya?, hisob? }`.
- `qarzlar`: `{ berilgan_jami, olingan_jami, kishi_soni, eng_yaqin_muddat: { sana, summa, otgan } | null }` (ochiq qarzlar; kishi — ism bo'yicha noyob; eng yaqin muddat — eng erta muddat, o'tib ketgan bo'lsa ham, `otgan: true`; summa — shu sanadagi qarzlar qoldig'i).
- `hisoblar`: `{ jami_balans, jami_manfiy?, hisoblar: [{ nom, qoldiq, manfiy? }] }` (arxivlanmaganlar, ≤ 30 ta; `hisob` berilsa faqat shu).
- `oylik_hisobot`: `{ xarajat, daromad, sof_balans, sof_yonalish: "ortiqcha" | "kamomad" | "nol", eng_katta_kategoriya: { nom, summa } | null, hisob? }`.

### 24.6. Xatolar
Har xato: oddiy o'zbekcha gap + "(kod: ...)", javob kartasi o'rnida (qizil chegara), "Qayta urinish" tugmasi bilan (savol takrorlanmaydi): `NETWORK_OFFLINE` (internet yo'q), `NETWORK`, `AI_LIMIT` (bugungi limit tugadi), `AI_PROVAYDER`, `AI_RAQAM` / `AI_SXEMA` (qayta urinib ko'ring), `AUTH_EXPIRED` / 401 (kirish muddati tugagan: chiqib qayta kiring), `HTTP_<holat>`, `JS_<nom>`. `AI_UZUN` da qayta urinish tugmasi yo'q.

### 24.7. Qabul qilingan taxminlar va cheklovlar
- `tur` ko'rsatilmasa `xarajat` deb olinadi (yuqorida). Savolda "daromad" aytilsa AI `tur: "daromad"` beradi deb kutiladi.
- Qarz amallari hisobotga kiradi (20.4), shuning uchun "xarajatim" jamiga "Berilgan qarz" ham kiradi: Asosiy sahifadagi raqam bilan bir xil bo'lishi uchun.
- Server `reja` va `javob` ni alohida so'rov deb sanaydi (23.5): bir savol = 2 ta so'rov.
- Server natijadagi raqamlarni tekshiradi, shuning uchun yo'nalish ("oshgan", "kamaygan", "manfiy") so'z bilan beriladi.
- Tungi rejimda "Yuborish" tugmasi `#3A64B5` (yorug' rejimda `#2F4A72`): `#2F4A72` qora fonda yomon ko'rinadi.
- Android "orqaga" tugmasi chatni yopmaydi (brauzer tarixiga yozilmaydi); ekrandagi "Orqaga" va Escape yopadi.

## 25. AI yordamchi: kartochkali javoblar va tuzatishlar (3-PR, oxirgisi, 0.33.0)

Sinxronlash mantig'iga va server sxemasiga tegilmagan. Server funksiyasida (`index.ts`) faqat 25.1 ning o'zgarishi va bitta prompt qatori; funksiyani Dashboard'ga qayta joylash kerak.

### 25.1. AI_RAQAM juda qattiq edi
"Sentabrning 2-haftasida eng ko'p xarajat nimaga bo'lgan?" savolida AI "2-haftasida" degani uchun javob rad etilgan. Endi ruxsat etilgan raqamlar: natija, so'rov sanalari (yil, oy, kun) va foydalanuvchining SAVOLIDAGI raqamlar. Boshqa tekshiruvlar o'zgarmagan (natijada yo'q raqam, masalan "3-haftasida" savolda bo'lmasa, yana rad etiladi). Prompt'ga bitta qator: natijada `toza_jami` va `aralash_soni` bo'lsa jamini faqat `toza_jami` deb aytish.

### 25.2. Zaxira javob
`javob` rejimi `AI_RAQAM` yoki `AI_SXEMA` (yoki bo'sh matn) bilan tugasa, ilova xato ko'rsatmaydi: kartani ilova hisoblagan raqamlar bilan, AI gapisiz ko'rsatadi. Karta yo'q amalda (yigindi) ilovaning o'z gapi chiqadi: "Oktabr · xarajat · Taksi: 35 000 so'm (2 ta yozuv)." Tarmoq, limit, ruxsat va `AI_PROVAYDER` xatolari avvalgidek xato bo'lib qoladi.

### 25.3. Izohdan qidiruv: aniq qoida
Hisobni ilova qiladi, AI emas. Faqat oddiy yozuvlar (daromad/xarajat, `tur` bo'sh bo'lsa `xarajat`) qidiriladi; qarz amallari qidirilmaydi (ularning "izohi" shaxs ismi). So'z izoh bo'laklari (harf va raqamdan tashqari belgilar bo'yicha bo'linadi; harf kattaligi, apostrof turlari va bo'shliqqa e'tiborsiz) bilan solishtiriladi:
- **TOZA** yozuv: izoh faqat qidirilgan so'zdan va ixtiyoriy BITTA butun sondan (1–999) iborat. So'z o'zbekcha qo'shimcha bilan kelishi mumkin (`-lar`, `-ga`, `-ni`, `-ning`, `-da`, `-dan`, `-ka`, `-ki`, `-gacha`, egalik `-i`, `-si`, `-im`, `-ing`, `-imiz`, `-ingiz` va ularning birikmalari). Son: "2", "3ta", "2 ta", "2 dona". Misollar: `non`, `2 ta non`, `non 3ta`, `4 non`, `nonga`, `Nonlar`, `  NON  ` — toza.
- **ARALASH** yozuv: izohda so'z bor, lekin boshqa so'z ham bor (`non-choy`, `non, sut`, `ovqat va non`, `ovqat, non-choy`, `bozor non`) yoki son aniq emas (ikkita son: `non 2 3`; 1–999 dan tashqari: `non 5000`, `non 0`). Ular jamiga QO'SHILMAYDI; kartada alohida qatorda: "Yana N ta aralash yozuv sanalmadi" (bosilsa ochiladi). Aralash yozuv izohidan summa ajratilmaydi.
- **Topilmaydi:** so'z yo'q yoki faqat harflar ketma-ketligi ichida: `limon`, `makaron`, `nonushta`, `nonvoy` ("non" qidirilganda).
- **Soni:** izohdagi son. Dona narxi = summa / son. O'rtacha dona narxi = soni ko'rsatilgan toza yozuvlar summasi / ularning jami soni (butun so'mga yaxlitlanadi). Soni yozilmagan toza yozuv jamiga kiradi, lekin donaga va o'rtacha narxga kirmaydi. Misol: 5 000 (`non`), 12 000 (`2 ta non`), 9 000 (`non 3ta`), 20 000 (`4 non`), 7 000 (`nonga`): jami 53 000, 5 ta; jami dona 9; o'rtacha (12 000+9 000+20 000)/9 = 4 556. `ovqat, non-choy` (25 000), `non, sut`, `ovqat va non` — aralash, jamiga kirmaydi.
- **Natija (serverga):** `{ tur, toza_soni, toza_jami, aralash_soni, jami_dona?, ortacha_narx?, kategoriya?, hisob? }` (`jami_dona` va `ortacha_narx` faqat soni yozilgan yozuv bo'lsa). Izoh matni serverga ketmaydi. AI gapi: "Izohi «non» bo'lgan N ta yozuv: jami X so'm." Aralash yozuvlar summasi hech qachon jami deb aytilmaydi.
- `yigindi` va `taqqoslash` da `matn` berilsa ham shu qoida ishlaydi (jamlar — toza yozuvlar jami).

### 25.4. Kartochkali javoblar (6 xil; `yigindi` uchun karta yo'q)
Fayl: `js/yordamchi-karta.js` (+ `YordamchiSof.tahlil`: `{ natija, karta }`; karta ismlar va izohlarni ham o'z ichiga oladi, ular faqat ekranda). Karta oq (tungi `#1B2130`), nozik chegara, burchak 18 px, ichki bo'shliq 16 px; tepada 12 px kulrang izoh, katta raqam 28 px qalin, tekis raqamlar, `js/sigdir.js` bilan sig'diriladi. Kartadagi HAMMA raqam ilova natijasidan. AI gapi (bo'lsa) karta ustida 15 px oddiy matn. Karta tugmalari tegishli bo'limni ochadi va chat yopiladi (suhbat xotirada qoladi).
1. `kategoriyalar`: "Oktabr · jami xarajat", katta raqam (xarajat qizil, daromad yashil), eng katta 5 ta: 28 px kategoriya ikon katagi, nom, summa, 6 px chiziq kategoriya rangida (eng kattasi 100%). "Hisobotni ochish".
2. `qidiruv`: "Non · shu hafta"; "Jami: X so'm · N dona" (soni yo'q bo'lsa "N ta yozuv"); "O'rtacha 1 donasi: Y so'm" (soni bo'lsa); toza yozuvlar (sana, izoh bir qator, summa; 5 tadan ko'p bo'lsa "Yana N ta"); eng pastda aralash yozuvlar qatori. Toza yo'q bo'lsa "Faqat «non» deb yozilgan yozuv topilmadi" va aralashlar. Qatorni bosish yozuvni tahrirlashga olib boradi. (Bu kartada alohida 28 px raqam yo'q: "Jami" qatorining o'zi asosiy.)
3. `taqqoslash`: ikki davr ustma-ust (nom, summa, 10 px chiziq, kattasi 100%); rangli tasma "190 000 so'm (18%) ko'p/kam" (xarajat ko'paysa qizil, kamaysa yashil; daromadda aksincha; teng bo'lsa "Farq yo'q"; oldingi davr 0 bo'lsa foiz yo'q).
4. `qarzlar`: "Berilgan qarzlar · N kishi" (yoki Olingan), katta jami, qatorlar (odam belgisi, ism, "Muddat: …", qolgan summa), "Qarzlarni ochish". "Berilgan | Olingan" almashtirgich; boshlang'ich tomon: savolda "kimga", "qarzman", "oldim" kabi so'z bo'lsa Olingan, bo'lmasa Berilgan (berilgan yo'q bo'lsa Olingan). Ismlar faqat ekranda.
5. `hisoblar`: "Jami balans · N ta hisob", katta raqam; har hisob (kattadan kichikka); manfiy qoldiq qizil; "Hisoblarni ochish".
6. `oylik_hisobot`: Xarajat va Daromad ikki katakda, to'q ko'k tasmada Sof balans (21.2 ranglari), "Eng katta xarajat — …" qatori, "Hisobotni ochish".
Davr nomi: "shu hafta", "Oktabr", "2026-yil", "bugun", "kecha", aks holda "dd.mm.yyyy – dd.mm.yyyy".

### 25.5. Android "orqaga" tugmasi
Chat ochilganda bitta tarix yozuvi qo'shiladi; telefonning "orqaga" tugmasi (`popstate`) chatni yopadi, ilovadan chiqarmaydi. Ekrandagi "Orqaga"/Escape/karta tugmasi ham shu yozuvni olib tashlaydi.

### 25.6. Qabul qilingan taxminlar
- `qarzlar` kartasida tomon tanlash savoldagi so'zlar bo'yicha (AI so'rovida yo'nalish yo'q).
- Qidiruvdagi qo'shimchalar ro'yxati qisqa va cheklangan; ro'yxatda yo'q qo'shimcha ("nonchi") aralash/topilmaydi hisoblanadi.
- Bir yozuvda ikkita son bo'lsa aralash; 1000 va undan katta son izohda son emas, aralash deb olinadi.

## 26. AI yordamchi: erkin savollar va suhbat xotirasi (0.34.0)

Maqsad: yordamchi "har qanday savolga mantiqli javob" bersin, lekin o'zgarmas qoida saqlansin: **javobdagi HAR raqam ilova hisoblagan natijadan (yoki foydalanuvchining o'z savolidan) bo'ladi; AI raqam hisoblamaydi va to'qimaydi.** Sinxronlash mantig'i va server sxemasi (jadvallar) o'zgarmagan. Server funksiyasi (`index.ts`) o'zgardi: Dashboard'ga qayta joylash kerak (`supabase/README.md` 5-bo'lim). Bu band 23.3–23.6, 23.5 (limit) va 24.4 ning protokolini almashtiradi.

### 26.1. Haqiqiy sinovda topilgan kamchiliklar
Davom savollari ("taksigachi?") tushunilmasdi (oldingi xabar AI ga berilmasdi); "Xarajatlarim qaysi yildan boshlangan?", "Sentabrda eng ko'p pul qaysi hisobimda aylangan?" kabi 7 amalga sig'maydigan savollarga "tushunmadim"; "2 va 3-haftasida" tushunilmasdi; "Kimsan" ga ham "tushunmadim". Tuzatish: suhbat xotirasi, yangi amallar, bir rejada 5 tagacha so'rov, `suhbat`/`tashqari` turlari, aniq davr qoidalari.

### 26.2. Server protokoli
- **reja** (kirish): `{ rejim: "reja", savol, bugun, kategoriyalar, hisoblar, tarix? }`. `tarix` — oxirgi 3 almashinuv `[{ savol, reja, matn }]`; server uni jami 1500 belgigacha qirqadi (eng yangisi saqlanadi, matn qisqartiriladi, sig'masa eski elementlar tashlanadi); yaroqsiz elementlar jimgina tashlanadi. AI ga server oldindan hisoblagan **sana tayanchlari** ham beriladi (bugun, hafta kuni, shu/o'tgan hafta, oy, yil), shunda AI sanani o'zi hisoblab adashmaydi.
- **reja** (chiqish): `{ ok, reja }`, `reja` = `{ tur: "sorovlar", sorovlar: [1..5 so'rov] }` | `{ tur: "suhbat", matn }` | `{ tur: "tashqari" }`. `suhbat` — salomlashish, "kimsan", "nima qila olasan" (3–4 ta misol savol bilan), umumiy moliyaviy maslahat: AI o'zi yozadi; matnda SAVOLDA bo'lmagan raqam bo'lsa server `AI_RAQAM` beradi (ilova tayyor umumiy javob chiqaradi). `tashqari` — moliyaga aloqasiz savol. Eski `tushunarsiz` faqat savol umuman ma'nosiz bo'lsa. Yaroqsiz AI chiqishi (sxemaga mos kelmasa) — `tushunarsiz`; 5 tadan ko'p so'rov qirqiladi, yaroqsizlari tashlanadi; eski bitta-so'rov shakli ham qabul qilinadi.
- **javob** (kirish): `{ rejim: "javob", savol, tarix?, sorovlar: [1..5], natijalar: [shuncha] }`. Natijada taqiqlangan kalitlar (`izoh`, `shaxs`, `ism`, `yozuvlar`, `qarzdor`, `tolovlar`, `matn`, `savol` …), uzun matn (60 belgidan), 4 dan chuqur ichma-ichlik yo'q; bitta natija ≤ 4000, hammasi ≤ 10 000 belgi.
- **javob** (chiqish): `{ ok, matn, davom }`: 1–4 gapli o'zbekcha matn va 2–3 ta davom savoli (har biri ≤ 40 belgi, raqamsiz, ilova javob bera oladigan savol). Davom savollari sxemadan o'tmasa tashlanadi, javob o'zi qoladi. AI oddiy matn qaytarsa (JSON emas) ham javob qabul qilinadi (davomsiz).
- **Raqam tekshiruvi:** matndagi har raqam natijalarda (nomlardagi raqamlar, ISO sana qismlari ham), so'rov sanalarida yoki SAVOLDA bo'lishi shart; tarixdagi raqamlar ruxsat emas. "taxmin" amali bo'lsa javobda "taxmin" so'zi SHART (yo'q bo'lsa `AI_SXEMA`: ilova zaxira javob beradi).
- **Limit:** kuniga 200 so'rov (100 edi); `reja` va `javob` alohida so'rov.

### 26.3. So'rov amallari (13 + tushunarsiz)
Eski 7 amal (23.3) o'zgarmagan. Yangilari (kalitlar qat'iy; yetishmagan ixtiyoriy kalitlar sukut bilan to'ldiriladi; kategoriya/hisob ro'yxatdan; `davr` — `{dan, gacha}`):
- `jadval`: `{ guruh: kategoriya|hisob|kun|hafta|oy|yil|hafta_kuni|yoq, olchov: jami|soni|ortacha|eng_katta|eng_kichik, tur: xarajat|daromad|aylanma, davr, kategoriya|null, hisob|null, tartib: kamayish|osish, limit: 1..20 }`. `aylanma` — hisobga kirgan va chiqqan hamma pul (o'tkazma — ikki hisob uchun ikki harakat; qarz va qaytarishlar bilan), faqat `guruh` = `hisob` yoki `yoq` bilan, kategoriyasiz. `jami` — summa yig'indisi, `soni` — yozuvlar soni, `ortacha` — bitta yozuvning o'rtacha summasi, `eng_katta`/`eng_kichik` — bitta yozuv. Hafta dushanbadan (`Calc.davrChegarasi`).
- `chegara`: `{ tur|null, kategoriya|null, hisob|null }` — birinchi va oxirgi yozuv sanasi, jami yozuvlar soni (davrsiz, hamma vaqt; oddiy yozuvlar, `tur` bo'sh bo'lsa o'tkazma ham).
- `eng_katta_yozuvlar`: `{ tur: xarajat|daromad, davr, kategoriya|null, limit: 1..10 }` — alohida yozuvlar (oddiy yozuvlar; qarz amallari yozuv emas).
- `byudjet`: `{ kategoriya|null }` — joriy oy (`Calc.byudjetHisobi`: qarz va o'tkazma byudjetga kirmaydi).
- `taxmin`: `{}` — faqat joriy oy.
- `jamgarma`: `{ davr }`.

### 26.4. Davr qoidalari (AI ko'rsatmasida)
Bugungi sana va tayanchlar beriladi, AI ularni nusxalaydi. Hafta DUSHANBADAN. "Oyning N-haftasi" = oyning (N-1)*7+1 .. N*7 kunlari (oy oxiridan oshsa oy oxirigacha): sentabrning 2-haftasi = 8..14-sentabr. Ketma-ket davrlar BITTA oraliq ("2 va 3-hafta" = 8..21); ketma-ket bo'lmaganlar ("yanvar va mart") alohida so'rovlar. "Oxirgi N kun" = bugun-N+1 .. bugun. "Yoz" = iyun–avgust (eng so'nggi o'tgan yoki davom etayotgan). "O'tgan yil" = o'tgan kalendar yil. "Boshidan beri" = 2000-01-01 .. bugun. Davr aytilmasa — shu oy. **Davom savoli** ("taksigachi?", "o'tgan oychi?", "va daromad?"): yetishmagan qism (amal, davr, tur, hisob) tarixdagi oldingi rejadan olinadi, faqat aytilgan qism almashtiriladi.

### 26.5. Ilovada hisoblash (`js/yordamchi-sof.js`)
`YordamchiSof.tahlillar(sorovlar, malumot, bugun, savol)` bir rejadagi 5 tagacha so'rovni ketma-ket hisoblaydi (har biri `{ sorov, natija, karta, gap }`; tushunarsizlari va hisoblab bo'lmaganlari tashlanadi; natijalar jami ≤ 10 000 belgi). Barcha sonlar manfiy emas, yo'nalish so'z bilan (server raqam tekshiruvi minusni tanimaydi). Natija shakllari (yangilari; eskilari 24.5 va 25.3):
- `jadval`: `{ tur, guruh, olchov, umumiy, qatorlar_soni, qatorlar: [{ nom, qiymat, foiz? }], kategoriya?, hisob? }`. `umumiy` — hamma yozuvlar bo'yicha o'sha o'lchov (limitdan oldin); `foiz` = round(qiymat*100/umumiy), faqat `jami` va `soni` da; `nom` — kategoriya/hisob nomi, ISO sana (`kun`), hafta dushanbasi (`hafta`), `YYYY-MM` (`oy`), `YYYY` (`yil`), hafta kuni nomi, `Hammasi` (`yoq`). Daromad/xarajat uchun qarz amallari hisobotdagidek ("Olingan qarz"/"Berilgan qarz") kiradi (20.4).
- `chegara`: `{ birinchi_sana, oxirgi_sana, yozuvlar_soni, tur?, kategoriya?, hisob? }` (yozuv yo'q bo'lsa sanalar `null`).
- `eng_katta_yozuvlar`: `{ tur, topilgan_soni, royxat: [{ sana, kategoriya, summa }], kategoriya? }` (izoh natijada YO'Q; kalit `royxat`, chunki `yozuvlar` taqiqlangan).
- `byudjet`: `{ oy, belgilangan, umumiy: { limit, sarflangan, qolgan, oshgan, foiz } | null, kategoriyalar: [{ nom, limit, sarflangan, qolgan, oshgan, foiz }] }`.
- `taxmin`: `{ oy, shu_kungacha, otgan_kunlar, kunlik_ortacha, qolgan_kunlar, kutilayotgan_jami }`; `kutilayotgan_jami` = round(shu_kungacha + shu_kungacha/otgan_kunlar * qolgan_kunlar) (kunlik o'rtacha yaxlitlanmagan holda hisoblanadi). Xarajat hisobotdagidek (qarz amallari bilan).
- `jamgarma`: `{ daromad, xarajat, farq (≥ 0), farq_yonalish: ortiqcha|kamomad|nol, foiz? }`; `foiz` = round(farq*100/daromad), daromad 0 bo'lsa YO'Q. Manfiy farq: "xarajat daromaddan X so'm ko'p".

### 26.6. Ko'rinish (yangi dizayn yo'q, 25-band karta uslubi)
- Mavjud amal — o'zining kartasi (25.4). Bir nechta so'rov bo'lsa kartalar ketma-ket, AI gapi eng tepada oddiy matn.
- `jadval` — "Hisoblar" kartasi shaklida: tepada 12 px izoh ("Oktabr · hisoblar bo'yicha aylanma"), `jami` bo'lsa katta raqam (xarajat qizil, daromad yashil, aylanma oddiy), qatorlar (nom chapda, qiymat o'ngda, ulush foizi), 5 tadan ko'p bo'lsa "Yana N ta".
- `chegara` — uch qatorli karta (Birinchi yozuv, Oxirgi yozuv, Jami yozuvlar).
- `eng_katta_yozuvlar` — qidiruv kartasidagi yozuvlar ro'yxati shaklida (sana, kategoriya, izoh — faqat ekranda, summa); qatorni bosish yozuvni ochadi.
- `byudjet` — har qator nom, "sarflangan / chegara", 6 px chiziq (oshgan bo'lsa qizil), "Qolgan/Oshgan: X · N%"; byudjet belgilanmagan bo'lsa "Byudjet belgilanmagan"; "Byudjetni ochish" tugmasi.
- `taxmin`, `jamgarma` — kartasiz, AI gapi (zaxirada ilovaning o'z gapi: "Taxmin: oy oxirigacha jami taxminan … xarajat bo'ladi (…)" va "Oktabr: daromad …, xarajat … — … tejaldi (daromadning N%)").
- `suhbat` — oddiy matn javobi. `tashqari` — tayyor javob "Men faqat Chuntak AI dagi pullaringiz haqida gaplasha olaman." va 3 ta bosiladigan tayyor savol. `tushunarsiz` — "Savolni tushunmadim." va 4 ta bosiladigan tayyor savol. Ikkala holatda serverga ikkinchi so'rov yuborilmaydi.
- **Davom savollari:** javob ostida (faqat eng oxirgi javob ostida) bosiladigan tugmalar (chatdagi tayyor savollar uslubida); bosilsa savol yuboriladi. Sxemadan o'tmasa tugmalar yo'q.
- **Zaxira javob (25.2) saqlanadi:** `javob` `AI_RAQAM`/`AI_SXEMA` bilan tugasa kartalar gapsiz ko'rsatiladi (karta yo'q amalda ilovaning o'z gapi); `reja` bosqichida `suhbat` matni raqam tekshiruvidan o'tmasa (`AI_RAQAM`) tayyor umumiy javob chiqadi. Tarmoq, limit, ruxsat va `AI_PROVAYDER` xato bo'lib qoladi.

### 26.7. Suhbat xotirasi
Oxirgi 3 almashinuv (savol, reja, javob matni) faqat xotirada (o'zgaruvchi): bazaga, serverga (tarixdan tashqari), eksportga va `localStorage` ga yozilmaydi. "Suhbatni tozalash" va chatni yopish (Orqaga, karta tugmasi, Escape, telefon "orqaga" tugmasi) suhbatni ham, xotirani ham o'chiradi (qaror: ko'rinib turgan suhbat bilan AI xotirasi bir xil bo'lsin; 25-banddagi "yopilsa ham ilova ochiq turguncha saqlanadi" o'zgardi). Faqat muvaffaqiyatli javoblar xotiraga yoziladi.

### 26.8. Sinov savollari (misol)
"Xarajatlarim qaysi yildan boshlangan?" (`chegara`), "Sentabrda eng ko'p pul qaysi hisobimda aylangan?" (`jadval`, aylanma, hisob), "Sentabrning 2 va 3-haftasida eng ko'p xarajat nimaga bo'lgan?" (`jadval`/`kategoriyalar`, davr 8..21), "Qaysi kunlari ko'p pul sarflayman?" (`jadval`, hafta kuni), "Shu oy eng katta 5 ta xarajatim" (`eng_katta_yozuvlar`), "Byudjetimdan qancha qoldi?" (`byudjet`), "Shu tezlikda oy oxirigacha qancha sarflayman?" (`taxmin`), "Shu oy qancha tejadim?" (`jamgarma`), "Kimsan?" (`suhbat`), keyin "taksigachi?" (davom savoli: tarixdagi oldingi reja). Haqiqiy AI bilan sinash foydalanuvchi uchun (kalit repoda yo'q).

### 26.9. Qabul qilingan taxminlar va cheklovlar
- AI davrni to'g'ri berishi uning o'ziga bog'liq (server faqat tayanch sanalarni beradi va sxemani tekshiradi). Noto'g'ri davr — noto'g'ri, lekin to'qima emas, raqam.
- `taxmin` va `jamgarma` qarz amallarini ham hisobga oladi (Asosiy sahifadagi "Naqd pul oqimi" bilan bir xil raqam chiqishi uchun); `byudjet` va `eng_katta_yozuvlar` qarzni kiritmaydi.
- `jadval` natijasida `kun` guruhi uchun sana ISO ko'rinishida (server raqam tekshiruvi sana qismlarini ("3-sentabr") taniydi); kartada "dd.mm.yyyy" ko'rinadi.
- Yangi server ilova bilan birga qayta joylanishi shart: eski funksiya yangi ilovaning so'rovini tushunmaydi (xato chiqadi).
- Bir savol 1–2 so'rov hisoblanadi (`suhbat`, `tashqari`, `tushunarsiz` — 1 ta).

## 27. Tarix jamlarida qarz amallari (0.35.0)

**Muammo.** Sentabr uchun Asosiy sahifada (Kategoriyalar, Naqd pul oqimi) daromad 25,5 mln, Tarixdagi "Oy balansi" kartasida esa 20 994 026 so'm chiqardi. Sabab: 20.4-bandga ko'ra qarz amallari hisobotda doim sanaladi, Tarix esa ularni qo'shmasdi (19-banddagi eski qaror). Qaror: **Tarix jamlari Asosiy sahifa bilan aynan bir xil bo'lsin.** 19-banddagi va 20.4-bandning "Tarix o'zgarmaydi" qismi shu band bilan almashtirilgan.

**Qoida (Asosiy sahifa bilan bir xil, bitta joyda).** Hisobga pul KIRGAN qarz amali daromad tomoniga, hisobdan pul CHIQQAN qarz amali xarajat tomoniga tushadi: olingan qarzning asosiy summasi — daromad; berilgan qarzning asosiy summasi — xarajat; berilgan qarz qaytarilganda har bir qaytarish — daromad; olingan qarz qaytarilganda har bir qaytarish — xarajat. Amal o'z sanasi tushgan oyga/kunga kiradi. Mantiqiy o'chirilgan qarz va qaytarishlar sanalmaydi. Qoida `Calc.qarzKirdimi(yonalish, turi)` da (Asosiy ham, Tarix ham shuni ishlatadi).

**Nima o'zgardi.**
1. "Oy balansi" kartasi (sof balans, Xarajat, Daromad): `Calc.oyJami(hisobotYozuvlari(), oy)`: Asosiy "Naqd pul oqimi" ishlatadigan chaqiruv bilan bir xil.
2. Kun sarlavhasidagi qizil/yashil belgilar (`−2 750 000`, `+6 114 594`): `Calc.tarixGuruhlari` o'sha kundagi (filtrdan o'tgan) qarz amallarini ham qo'shadi. Faqat qarz amali bor kunda ham belgi chiqadi.
3. O'zgarmaydi: "N ta yozuv" soni va ro'yxat (qarz amallari avvalgidek alohida qatorlar), byudjet (qarz byudjetga kirmaydi), hisob qoldig'i, umumiy balans, Excel eksport, sinxronlash, "Barcha yozuvlar" ro'yxati.

**Filtr va qidiruv bilan (kun jamlari).** Qarz amali faqat ro'yxatda ko'ringan bo'lsagina kun jamiga qo'shiladi (`Calc.qarzSatrlariniSuz`): kategoriya filtri yoki tur filtri yoqilsa qarz amallari ko'rinmaydi va sanalmaydi (qarzda kategoriya yo'q); hisob filtri — faqat shu hisobdagi qarz amallari (asosiy summa va qaytarish o'z hisobi bo'yicha); sana oralig'i — shu oraliqdagi amallar; qidiruv — izoh yoki shaxs ismi bo'yicha. "Oy balansi" kartasi filtrga bog'liq emas (avvalgidek butun oy).

**Tekshiruv (testlar).** Bir oy uchun Tarixdagi kun jamlari yig'indisi va "Oy balansi" Asosiy "Naqd pul oqimi" raqamlariga (xarajat, daromad, sof balans) aynan teng (qarzli va qarzsiz uydirma ma'lumotda, olingan qarz va qaytarishlar bilan, o'chirilganlar sanalmasligi); AI yordamchining `oylik_hisobot` natijasi ham shu raqamlarga teng. Brauzerda sentabr sinovi: Asosiy "3 880 000 / 25 894 026 / +22 014 026", Tarix kartasi va kun belgilari yig'indisi shuncha.
