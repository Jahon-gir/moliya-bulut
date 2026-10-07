# TZ: Chuntak AI, profil va sinxronlash (3-versiya, 1-qism)

Hujjat versiyasi: 3 (13.10.2026): S1 va S2 bajarildi (S2: faqat Google bilan kirish), 7-band "Menyu" ga moslandi, 13-band (S2 natijasi) qo'shildi. Bu TZ asosiy TZ.md ga qo'shimcha: undagi qoidalar (bir vaqtda bitta bosqich, TZ'da yo'q narsani qo'shmaslik, noaniq joyda so'rash, o'zbekcha matn, "vaqt hozirdan keyin bo'lmaydi", zaxira va migratsiya qoidalari) o'z kuchida.

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

- "Menyu" (☰, Asosiy sahifaning chap yuqori burchagi) → "Asosiy sozlamalar" kartochkasida "Profil va sinxronlash" qatori (u ochadigan ekranda): kirmagan holatda "Kirish" tugmasi va qisqa izoh; kirgan holatda email, sinxron holati, "Hozir sinxronlash", "Chiqish", "Serverdagi ma'lumotni o'chirish".
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
| S3 | Mahalliy ma'lumotga UUID, `updated_at`, `deleted` qo'shish; sxema versiyasi va migratsiya; o'chirish "mantiqiy" bo'ladi | Claude Code | Migratsiya eski bazaning nusxasida, hamma raqam bir xil, zaxira va tiklash ishlaydi |
| S4 | Birinchi yuklash: mahalliy ma'lumotni serverga yuborish (avtomatik zaxira bilan) | Claude Code | Server qatorlari soni mahalliy bilan mos |
| S5 | Ikki tomonlama sinxronlash: yuborish navbati, tortib olish, to'qnashuv, o'chirish, holat ko'rsatkichi | Claude Code | Ikki qurilmada yozuv qo'shish, tahrirlash, o'chirish bir-biriga o'tadi |
| S6 | Boshqa qurilmada birinchi kirish (tanlov oynasi), internetsiz rejim va qaytganda yuborish | Claude Code | Samolyot rejimida yozilgan yozuv internet qaytgach serverga o'tadi |
| S7 | Hisobni va serverdagi ma'lumotni o'chirish, maxfiylik matni, xato holatlari | Claude Code | O'chirgandan keyin serverda hech narsa qolmaydi, mahalliy ma'lumot saqlanadi |
| S8 | Yakuniy sinov va hujjat yangilash | Claude Code va foydalanuvchi | 9-band mezonlari |

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
