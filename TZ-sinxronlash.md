# TZ: Chuntak AI, profil va sinxronlash (3-versiya, 1-qism)

Hujjat versiyasi: 15 (09.10.2026): 20-band (soddalashtirish) qo'shildi. Oldingi: 14 (24.10.2026): 19-band (qarz amallari hisobotda) qo'shildi. Oldingi: 13 (23.10.2026): 18.5 (daromad/xarajat rangi va bog'liqlik xatosi) qo'shildi. Oldingi: 12 (22.10.2026): 18.4 (importdagi jiddiy xatolarni tuzatish, hisob qoldiqlarini moslash, sinxron xatosini ko'rsatish) qo'shildi. Oldingi: 11 (21.10.2026): 18.3 (qarz qatorlarini yuklash) qo'shildi. Oldingi: 10 (20.10.2026): 18-band (kirish ekrani va fayldan yuklash) qo'shildi. Oldingi: 8 (19.10.2026): S8 (yakuniy bosqich) bajarildi (17-band). Oldingi: 7 (18.10.2026): S6 va S7 bajarildi (16-band). Oldingi: 6 (17.10.2026): 0.20.1 xato tuzatish (15-band oxiri). Oldingi: 5 (16.10.2026): S5 bajarildi (15-band). S4: 14-band. Oldingi: S1 va S2 bajarildi (S2: faqat Google bilan kirish), 7-band "Menyu" ga moslandi, 13-band (S2 natijasi) qo'shildi. Bu TZ asosiy TZ.md ga qo'shimcha: undagi qoidalar (bir vaqtda bitta bosqich, TZ'da yo'q narsani qo'shmaslik, noaniq joyda so'rash, o'zbekcha matn, "vaqt hozirdan keyin bo'lmaydi", zaxira va migratsiya qoidalari) o'z kuchida.

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

**Nimaga ta'sir QILMAYDI (qaror):** byudjet (qarz byudjet sarfiga kirmaydi: byudjet kategoriyalar bo'yicha oylik chegara, qarz esa kategoriyasiz), Tarix (qarz amallari avvalgidek alohida qatorlar, kun va oy jami o'zgarmaydi), hisob qoldig'i va umumiy balans (ular hamisha yozuvlar va qarzlardan hisoblanadi, sozlamaga bog'liq emas), Excel eksport, zaxira. Hisobotdagi "Olingan qarz"/"Berilgan qarz" faqat ko'rsatish uchun hisoblanadi (bazaga yozilmaydi, sinxronlanmaydi).

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
v0.28.0 dagi "Qarzlarni hisobotga qo'shish" tugmasi olib tashlanadi. Qarz amallari doim hisobotda: "Olingan qarz" — daromad tomonida, "Berilgan qarz" — xarajat tomonida (Kategoriyalar va Naqd pul oqimi). Byudjet, Tarix va hisob qoldig'iga ta'siri o'zgarmaydi. Eski sozlama kaliti (`moliya-qarz-hisobotda`) e'tiborsiz qoldiriladi.

### 20.5 Saqlagandan keyin Tarixga o'tish
Xarajat, daromad yoki o'tkazma yozuvi TO'LIQ saqlangach forma yopiladi, ilova avtomatik "Tarix" bo'limiga o'tadi va yangi yozuvning oyi ko'rinadi (yangi yozuv ro'yxatda ko'rinadi). Forma qayta ochilmaydi.
