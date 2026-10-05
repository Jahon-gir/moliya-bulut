# TZ: Shaxsiy moliya ilovasi

Hujjat versiyasi: 10 (05.10.2026)

## 1. Maqsad

Bitta odam o'z pulini nazorat qiladigan, telefonda ishlaydigan ilova. U to'rtta savolga javob beradi:

1. Hozir menda qancha pul bor va u qayerda (naqd, karta)?
2. Shu kun, hafta, oy, yilda qancha topdim va qancha sarfladim?
3. Pul nimaga ketyapti va belgilagan chegaramdan oshib ketmadimmi?
4. Kimga qarz berganman va kimdan qarzdorman?

Ilova uch versiyada quriladi. Bu hujjat **1-versiyani to'liq** tavsiflaydi. 2 va 3-versiyalar 12-bandda qisqa reja sifatida berilgan va alohida TZ bilan aniqlashtiriladi.

## 2. Foydalanuvchi

- Bitta foydalanuvchi (ilova egasi). 1-versiyada ro'yxatdan o'tish, parol va boshqa foydalanuvchilar yo'q.
- Ilovani asosan telefonda, yo'l-yo'lakay ishlatadi. Yozuv qo'shish 10 soniyadan oshmasligi kerak.
- Dasturlashni bilmaydi, shuning uchun interfeys sodda va tushunarli bo'lishi kerak.

## 3. Asosiy tushunchalar

| Tushuncha | Ma'nosi |
|---|---|
| Hisob | Pul turgan joy: naqd pul, bank kartasi, jamg'arma |
| Yozuv | Bitta daromad, xarajat yoki o'tkazma |
| Vaqt | Yozuvning soat:daqiqasi (`HH:MM`, qurilmaning mahalliy vaqti). Yozuvning sanasi bilan birga uning aniq vaqtini beradi |
| O'tkazma | Pulni bir hisobdan boshqasiga ko'chirish (masalan, kartadan naqd yechish). Daromad ham, xarajat ham emas |
| Kategoriya | Daromad yoki xarajatlar guruhi |
| Byudjet | Xarajat kategoriyasiga qo'yilgan oylik chegara |
| Qarz | Birovga berilgan yoki birovdan olingan pul |
| Davr | Kun, hafta, oy yoki yil. Hafta dushanbadan yakshanbagacha |
| Qoldiq | Davr ichidagi daromadlar minus xarajatlar |
| Umumiy balans | Barcha hisoblardagi pulning yig'indisi |

## 4. Funksiyalar (1-versiya)

### F1. Hisoblar
- Hisob qo'shish: nomi, turi (naqd, karta, boshqa), boshlang'ich qoldiq.
- Ilova birinchi ochilganda "Naqd pul" hisobi tayyor turadi.
- Har bir hisobning joriy qoldig'i va barcha hisoblar bo'yicha umumiy balans ko'rsatiladi.
- Hisob nomini o'zgartirish mumkin. Yozuvlari bor hisob o'chirilmaydi, arxivlanadi (ro'yxatdan yashiriladi, eski yozuvlar saqlanadi).

### F2. Yozuv qo'shish
- **Kirish yo'li.** Pastki menyudagi "+" tugmasi darhol shaklni emas, pastdan chiqadigan "Yangi yozuv yaratish" oynasini ochadi. Oynada ikki qator, har birida o'z belgisi (SVG), sarlavha, ostida kulrang izoh va o'ng tomonda ">" belgisi:
  1. **"Tranzaksiya qo'shish"** — "Daromad, xarajat yoki o'tkazma qo'shing". Bosilsa quyidagi 5 qadamli oyna ochiladi. Bu qator birinchi turadi, rang bilan ajralib turadi va oyna ochilganda fokusda bo'ladi: tezkor yo'l "+" va Enter (yozuv qo'shish faqat bitta bosish ko'proq ketadi).
  2. **"Qarz qo'shish"** — "Berilgan yoki olingan qarz. Hisob qoldig'ini o'zgartiradi, hisobotga kirmaydi". Bosilsa qarz qo'shish oynasi ochiladi (F8); undagi "Orqaga" tanlov oynasiga qaytaradi. Qarz saqlansa, "Yana" → Qarzlar ro'yxati ochiladi.
  - Oyna tashqarisi, yopish belgisi yoki "Orqaga" bosilsa yopiladi (hech narsa saqlanmaydi, "+" bosilgan bo'limda qolinadi). Tugmalar kamida 44 piksel; klaviatura bilan ham ishlaydi: Esc yopadi, Tab bilan yurish oyna ichida aylanadi, har tugmada `aria-label`, oyna `role="dialog"`. Yopilganda fokus "+" tugmasiga qaytadi.
  - "Yana" → Qarzlar ichidagi "+ Qarz qo'shish" tugmasi tanlov oynasisiz to'g'ridan-to'g'ri qarz oynasini ochadi (u yerdagi "Orqaga" Qarzlar ro'yxatiga qaytaradi).
- Maydonlar: tur (daromad, xarajat, o'tkazma), summa, hisob, kategoriya, sana, soat, izoh.
- Standart qiymatlar: tur xarajat, sana va soat hozirgi vaqt (qurilmaning mahalliy vaqti, daqiqa aniqligida), hisob oxirgi ishlatilgani.
- **Qadamlar (wizard).** Yangi yozuv 5 ta ketma-ket qadamda kiritiladi. Har qadamda "Orqaga" tugmasi va "2 / 5" kabi ko'rsatkich bor:
  1. **Tur va summa.** Tur: Xarajat (standart), Daromad, O'tkazma. Katta summa maydoni: telefonda raqamli klaviatura ochiladi, mingliklar yozilganda ajraladi.
  2. **Kategoriya.** Turga qarab ro'yxat almashadi, rangli kataklar ko'rinishida. Katak bosilishi bilan keyingi qadamga o'tiladi. Oxirgi ishlatilgan kategoriya ajralib turadi.
  3. **Hisob.** Ro'yxatda hisob nomi va qoldig'i ko'rinadi. Oxirgi ishlatilgan hisob oldindan tanlangan turadi; bitta bosish bilan keyingi qadamga o'tiladi.
  4. **Sana va vaqt.** Standart "Hozir" ko'rinadi. Bosilsa, g'ildirakli tanlagich ochiladi: yil, oy, kun, soat, daqiqa ustunlari va "Tasdiqlash" tugmasi.
  5. **Izoh va saqlash.** Izoh ixtiyoriy. Tepada qisqa xulosa: tur, summa, kategoriya, hisob, sana va vaqt. "Saqlash" tugmasi.
  - O'tkazmada 2 va 3-qadamlar o'rniga "Qayerdan" va "Qayerga" qadamlari bo'ladi ("Qayerga" ro'yxatida "Qayerdan" tanlangan hisob ko'rinmaydi). 4 va 5-qadamlar o'zgarmaydi.
- **Tezkor saqlash.** 2-qadamdan boshlab pastda "Saqlash" tugmasi ko'rinib turadi. Bosilsa, shu paytgacha kiritilgan qiymatlar saqlanadi, kiritilmagan qadamlar standart qiymat oladi: hisob — oxirgi ishlatilgani (3-qadamda boshqasi tanlangan bo'lsa, o'sha), sana va vaqt — saqlash paytidagi hozirgi vaqt, izoh — bo'sh. Kategoriya majburiy: 2-qadamda tanlanmagan bo'lsa, xato xabari chiqadi.
- **Orqaga qaytganda** oldin kiritilgan qiymatlar (summa, kategoriya, hisob, vaqt, izoh) saqlanib turadi. Shakl yopilsa (1-qadamda "Orqaga", boshqa bo'limga o'tish) yoki yozuv saqlansa, hamma narsa tozalanadi va yangi shakl 1-qadamdan boshlanadi.
- **Sana va vaqt g'ildiragi** tashqi kutubxonasiz yoziladi (CSS scroll-snap). Kelajak qiymatlar (bugundan keyingi kun, bugun uchun hozirdan keyingi soat va daqiqa, joriy yil uchun kelgusi oylar) kulrang va tanlanmaydigan: tanlash faqat hozirgi vaqtgacha. Ustunlar bir-biriga mos tuzatiladi (masalan, oyning kunlari soni 28/29/30/31; bugunga o'tilganda soat va daqiqa hozirgidan oshmaydi).
- **Yozuvni tahrirlash** wizard emas: hamma maydon (tur, summa, kategoriya yoki hisoblar, sana va vaqt, izoh) bitta ekranda turadi. Sana va vaqt uchun ham shu g'ildirakli tanlagich ishlatiladi.
- **Vaqt qoidasi:** yozuv vaqti (sana va soat) hozirgi vaqtdan keyin bo'lmaydi, o'tmish mumkin. Bugundan keyingi sana va bugun uchun hozirdan keyingi soat tanlanmaydi. Tekshiruv daqiqa aniqligida: soat 21:00 bo'lsa, 21:00 mumkin, 21:01 mumkin emas.
- Hozirgi vaqt har safar qayta tekshiriladi: yozuvni saqlashda ham, tahrirlab saqlashda ham. Kelajak vaqt rad etiladi va tushunarli xato xabari chiqadi. Bu tekshiruv g'ildirakdan keyingi ikkinchi himoya bo'lib qoladi (masalan, g'ildirakda tanlangandan keyin qurilma soati orqaga surilgan bo'lsa).
- O'tkazmada kategoriya o'rniga ikkita hisob tanlanadi: qayerdan va qayerga.
- Summa kiritilayotganda mingliklar avtomatik ajratiladi (`1 250 000`).
- Summa bo'sh, nol yoki manfiy bo'lsa, yozuv saqlanmaydi va maydon yonida tushunarli xato xabari chiqadi.
- Saqlangach shakl tozalanadi (1-qadamdan boshlanadi) va "Saqlandi" xabari chiqadi; balans, ro'yxat va hisobotlar darhol yangilanadi.
- Oxirgi ishlatilgan hisob va kategoriya eslab qolinadi: keyingi yozuvda hisob oldindan tanlangan, kategoriya ajralib turadi.

### F3. Yozuvlar ro'yxati
- Yozuvlar kunlar bo'yicha guruhlangan, eng yangisi tepada. Har kun sarlavhasida o'sha kunning jami xarajati.
- Har yozuvda soat ko'rinadi. Kun ichida soati kattasi tepada, soat teng bo'lsa `yaratilgan` bo'yicha (yangisi tepada).
- Bazada allaqachon bor, vaqti hozirdan keyingi yozuvlar o'chirilmaydi va yashirilmaydi: ular ro'yxatda "Kelajak" belgisi bilan ko'rinadi. Ularni tahrirlashda vaqtni o'tmishga to'g'rilash talab qilinadi (o'chirish esa to'g'rilashsiz mumkin).
- Yozuvni tahrirlash mumkin. Tahrirlashda vaqt F2 dagi qoida bo'yicha qayta tekshiriladi.
- Yozuvni o'chirish mumkin. O'chirilgach 10 soniya davomida "Bekor qilish" tugmasi ko'rinadi.
- Filtrlar: tur, hisob, kategoriya, sana oralig'i. Izoh bo'yicha qidiruv.

### F4. Kategoriyalar
- Tayyor xarajat kategoriyalari: Oziq-ovqat, Transport, Kommunal to'lovlar, Uy-ro'zg'or, Sog'liq, Ta'lim, Kiyim, Aloqa va internet, Ko'ngilochar, Xayriya, Boshqa.
- Tayyor daromad kategoriyalari: Oylik maosh, Qo'shimcha daromad, Sovg'a, Boshqa.
- Yangi kategoriya qo'shish, nomini va rangini o'zgartirish mumkin.
- Nom o'zgartirilsa, eski yozuvlarda ham yangi nom ko'rinadi.
- Yozuvlari bor kategoriya o'chirilmaydi, arxivlanadi.

### F5. Hisobotlar
- Davr turi tanlanadi: kun, hafta, oy, yil yoki **erkin davr** (ikki sana). Tezkor yo'l sifatida "Kun / Hafta / Oy / Yil" tugmalari, "Oldingi", "Bugun" va "Keyingi" tugmalari turadi. Filtr oynasi (F6 dagi filtr belgisi) shu tugmalar bilan bir xil holatni boshqaradi.
- **Filtr oynasi** (pastdan chiqadi): sarlavha "Filtrlar", "Tozalash", yopish tugmasi va "Amalga oshirish". Chastota: *Oylik* (yil va oyni katak ko'rinishida tanlash), *Yillik* (yil tanlash), *Davr* (boshlanish va tugash sanasi, g'ildirakli tanlagich bilan). Kelajak oylar kulrang va tanlanmaydi, kelajak yil ro'yxatda yo'q. Erkin davrda tugash sanasi boshlanishdan oldin bo'lmaydi va ikkala sana ham bugundan keyin bo'lmaydi (g'ildirakda ham, saqlashda ham tekshiriladi). Qo'shimcha variantlar (yig'iladigan blok): hisobni tanlash. "Tozalash" tanlovni joriy oy va barcha hisoblarga qaytaradi.
- **Erkin davr:** hisobot, doira, ro'yxat va taqqoslash shu oraliq bo'yicha hisoblanadi (ikkala chekka kun kiradi). Taqqoslash: xuddi shuncha kun uzunlikdagi oldingi oraliq (masalan, 01.10–10.10 uchun 21.09–30.09). "Oldingi" va "Keyingi" tugmalari davrni o'z uzunligiga suradi; "Keyingi" tugash bugundan oshadigan bo'lsa o'chiq turadi. Kun, hafta, oy, yil tugmalaridan biri bosilsa, erkin davr tugagan oyga qaytiladi.
- **Xarajat / Daromadlar yorlig'i:** sarlavha ostida; standart — Xarajat. Doira va ro'yxat tanlangan tur bo'yicha almashadi (daromad taqsimoti ham doira bilan). Jami ko'rsatkichlar va taqqoslash (xarajat) yorliqqa bog'liq emas.
- Tanlangan davr uchun:
  - jami daromad, jami xarajat, qoldiq (manfiy bo'lsa alohida rangda);
  - xarajatlarning kategoriyalar bo'yicha taqsimoti: summa va foiz, kattasidan kichigiga;
  - daromadlarning kategoriyalar bo'yicha taqsimoti;
  - oldingi davr bilan taqqoslash: xarajat qanchaga o'zgargan (summa va foiz).
- Hisobotni bitta hisob bo'yicha yoki barcha hisoblar bo'yicha ko'rish mumkin (filtr oynasidagi "Qo'shimcha variantlar" da).
- O'tkazmalar va qarz amallari daromad yoki xarajat hisoblanmaydi va hisobotga kirmaydi.
- Davrda yozuv bo'lmasa, "Bu davrda yozuvlar yo'q" degan xabar chiqadi.

### F6. Diagrammalar
- **Hisobot ekrani tepasi:** sarlavha va o'ng tomonda ikkita belgi (SVG): diagramma belgisi va filtr belgisi (F5). **Bir vaqtda bitta diagramma** ko'rinadi: doira yoki ustunlar. Diagramma belgisi bosilsa doira o'rniga ustunli diagramma ochiladi va belgi doiraga qaytaruvchi belgiga almashadi; tanlov qurilmada eslab qolinadi. Kun davrida ustunli diagramma yo'q, belgi ham ko'rinmaydi.
- **Doiraviy diagramma** (halqa): tanlangan davr uchun tanlangan tur (xarajat yoki daromad) kategoriyalar bo'yicha taqsimoti. Tilim rangi — kategoriyaning o'z rangi (F4). Tilimlar orasida 2 piksel bo'shliq. Markazda davr nomi (uzun bo'lsa ikki qatorda) va jami summa, tilim ustiga olib borilsa (yoki ro'yxat qatoriga) shu kategoriya va summasi ko'rinadi. Diagramma ostida ro'yxat: har kategoriyaning rangi, nomi, summasi va foizi. Nomlar so'z o'rtasidan sinmaydi (kerak bo'lsa so'zlar bo'yicha keyingi qatorga o'raladi). Bitta kategoriya bo'lsa to'liq halqa.
- **"Boshqalar" tilimi:** eng katta 6 ta kategoriya (bu son kodda bitta joyda, `Calc.DONA_ENG_KATTA`, saqlanadi) alohida tilim, qolganlari bitta kulrang "Boshqalar" tilimiga birlashadi (summa va foiz yig'indisi; jami 100%). Qolgan bitta kategoriya bo'lsa birlashtirilmaydi (7 ta kategoriya = 7 tilim). Ro'yxatda hamma kategoriya to'liq turadi ("Boshqalar" qatori ostida o'z ichki qatorlari bilan). "Boshqalar" tilimi yoki qatori bosilsa, shu kategoriyalar bo'yicha filtrlangan yozuvlar ro'yxati ochiladi.
- **Vaqt bo'yicha ustunli diagramma:** hafta va oyda kunlar bo'yicha, yilda oylar bo'yicha (kun davri uchun bu diagramma yo'q). **Erkin davrda:** 31 kungacha kunlar bo'yicha, 366 kungacha (1 yil) haftalar bo'yicha (dushanba–yakshanba, davr chetlarida qisqartiriladi), undan uzunda oylar bo'yicha (chetdagi oylar ham qisqartiriladi). Hisoblash qoidasi boshqa davrlardagi bilan bir xil. Har ustunda daromad va xarajat yonma-yon (ko'k va to'q sariq: rang ko'rligi sinovidan o'tgan juft). O'qlarda sana va summa ko'rinadi; katta summalar qisqartiriladi (`1,2 mln`, `5 ming`, `2,5 mlrd`). Eng katta qiymatga bitta yozuv qo'yiladi, har ustunga raqam yozilmaydi. Juda kichik, lekin noldan katta qiymat ham ko'rinadi (kamida 2 piksel balandlikda).
- **Diagramma bo'lagini bossa** (sichqoncha, barmoq yoki Enter), o'sha kategoriya (tanlangan davr va hisob bo'yicha) yoki kunning (yilda oyning) yozuvlari filtrlangan ro'yxat sifatida ochiladi; "Orqaga" hisobotga qaytaradi.
- **Raqamlar hisobot bilan aynan mos:** diagrammadagi har tilim va ustun hisobot (F5) bilan bir xil hisob-kitobdan olinadi: tanlangan hisob filtri, o'tkazma va qarz kirmasligi, davr chegaralari bir xil.
- **Tashqi kutubxonasiz**, SVG bilan chiziladi; yorug' va qorong'i rejimda ranglar mos (ustun ranglari har rejim uchun alohida tanlangan). Tooltip (hover va klaviatura fokusida) faqat qo'shimcha: har qiymat diagramma ostidagi ro'yxatda yoki "Jadval ko'rinishi"da ham bor.
- **Ekran o'quvchilari uchun:** har tilim va ustunda matnli muqobil (`aria-label`: nom yoki sana, summa, foiz). Ustunlar orasida strelka tugmalari bilan yurish, Enter bilan yozuvlarni ochish mumkin. "Jadval ko'rinishi" har ustun va jami qiymatlarni jadval sifatida beradi.

### F7. Byudjet
- Har bir xarajat kategoriyasiga oylik chegara qo'yish mumkin (Byudjet bo'limi). Chegara qo'yish majburiy emas; chegarani o'zgartirish va olib tashlash mumkin (xarajatlar saqlanadi).
- Har bir chegara uchun ko'rsatiladi: sarflangan summa, chegara, qolgan summa, foiz va to'lish chizig'i.
- Faqat **joriy kalendar oyi** xarajatlari hisoblanadi (barcha hisoblar bo'yicha; daromad, o'tkazma va qarz kirmaydi). O'tgan oy xarajati hisobga kirmaydi.
- Chegaralar aniq solishtiriladi: aynan 80% gacha — me'yorda; 80% dan oshsa chiziq sariq (⚠); aynan 100% sariq; 100% dan oshsa qizil (✕) va oshgan summa ko'rsatiladi. Rang bilan birga belgi va matn ham bor. Ko'rsatiladigan foiz rangga zid kelmaydi (sariqda kamida 81, qizilda kamida 101).
- Bosh sahifada chegarasi 80 foizdan oshgan kategoriyalar (va umumiy chegara) haqida ogohlantirish chiqadi; to'lganlari birinchi. Bosilsa Byudjet bo'limi ochiladi.
- Ixtiyoriy umumiy oylik chegara (barcha xarajatlar uchun) shu ekranda o'rnatiladi.
- Arxivlangan kategoriyalar Byudjet ekranida ko'rinmaydi (ularning chegaralari saqlanib qoladi).
- Ma'lumot: `Byudjet = { kategoriya_id (yoki "umumiy"), oylik_limit }`.
- Misol: Oziq-ovqat chegarasi 500 000, sarflangan 450 000 = 90%, sariq, bosh sahifada ogohlantirish.

### F8. Qarzlar
- **Qarz qo'shish:** yo'nalish (men berdim yoki men oldim), kimga yoki kimdan (shaxs ismi), summa, hisob, sana va soat (`vaqt`), qaytarish muddati (ixtiyoriy), izoh.
- **Vaqt qoidasi qarzga ham tegishli:** qarzning sanasi va soati hozirgi vaqtdan keyin bo'lmaydi (F2 dagi qoida: daqiqa aniqligida, standart qiymat — hozirgi vaqt, sana va soat uchun F2 dagi g'ildirakli tanlagich; saqlashda hozirgi vaqt qayta tekshiriladi). Faqat **qaytarish muddati** bundan mustasno: u tabiatan kelajakda bo'ladi (lekin qarz sanasidan oldin bo'lmaydi).
- **To'lov (qaytarish):** qarzni qisman yoki to'liq qaytarilgan deb belgilash. Har bir to'lov summasi, sanasi, soati (`vaqt`) va hisobi bilan saqlanadi. To'lov summasi qolgan qarzdan oshmaydi. To'lov vaqti qarz vaqtidan oldin ham, hozirgi vaqtdan keyin ham bo'lmaydi (21:00 mumkin, 21:01 mumkin emas). To'lov hisobi qarz hisobidan farq qilishi mumkin. To'lovni tahrirlash va o'chirish mumkin. To'lovlar yig'indisi qarz summasiga yetsa, qarz avtomatik yopiladi (`yopilgan`); to'lov o'chirilsa, qayta ochiladi.
- **Hisob qoldig'iga ta'siri:** bergan qarz hisobdan chiqadi, olgan qarz hisobga kiradi, qaytarilgani teskari yo'nalishda o'zgaradi (8-band, 1-qoida). Qarz amallari daromad yoki xarajat hisoblanmaydi: hisobotga (F5), byudjetga (F7) va diagrammalarga (F6) kirmaydi.
- **Ko'rinish ("Yana" → Qarzlar):** tepada ikkita jami: "Menga qaytarilishi kerak" va "Men qaytarishim kerak" (qolgan summalar yig'indisi). Ro'yxat shaxs (va yo'nalish) bo'yicha guruhlangan: har guruhda qolgan summa, qaytarilgan/jami va to'lish chizig'i, ichida har bir qarz. Muddati o'tgan qarzlar rangdan tashqari ⚠ belgisi va "Muddati o'tgan" matni bilan ajratiladi (muddat kuni o'zi hali o'tgan hisoblanmaydi) va ro'yxatda birinchi turadi. To'liq yopilgan qarzlar alohida "Yopilganlar" ro'yxatiga o'tadi.
- **Tahrirlash va o'chirish:** qarzni tahrirlash mumkin, lekin summa shu paytgacha to'langandan kam bo'lmaydi va qarz vaqti mavjud to'lovlardan keyin bo'lmaydi. Qarzni ham, to'lovni ham o'chirishda 10 soniya davomida "Bekor qilish" turadi. Qarz o'chirilsa, uning hisob qoldig'iga ta'siri ham yo'qoladi.
- **Arxivlangan hisob:** hisobni arxivlashda unga bog'langan hali yopilmagan qarzlar bo'lsa, tasdiqlash oynasida ogohlantirish chiqadi (qarzlar saqlanadi). Arxivdagi hisobga bog'langan qarzda "⚠ Hisob arxivda" belgisi ko'rinadi, yangi to'lov uchun faol hisob taklif qilinadi.

### F9. Zaxira va eksport
- Ma'lumotlar faqat foydalanuvchining qurilmasida saqlanadi, hech qayerga yuborilmaydi.
- "Zaxira nusxa olish": barcha ma'lumot bitta JSON faylga saqlanadi. Fayl nomida sana bo'ladi.
- "Zaxiradan tiklash": JSON fayldan ma'lumot yuklanadi. Mavjud ma'lumot almashtirilishi haqida ogohlantiriladi va tiklashdan oldin joriy holatning zaxirasi avtomatik yuklab beriladi.
- Eski sxema versiyasidagi zaxira (masalan, `vaqt` maydoni yo'q 1-versiya) tiklanganda 7-bandagi ko'chirish qoidasi qo'llanadi: yozuvlarga `vaqt` qo'shiladi, hech narsa o'chirilmaydi. Zaxirada vaqti hozirdan keyin bo'lgan yozuv bo'lsa, u rad etilmaydi va o'chirilmaydi: F3 dagidek "Kelajak" belgisi bilan ko'rinadi. Zaxira fayliga `vaqt` ham yoziladi.
- "Excel uchun eksport": yozuvlar CSV faylga chiqariladi (UTF-8 BOM bilan, ajratuvchi nuqtali vergul), o'zbekcha harflar Excel'da to'g'ri ko'rinishi kerak. Sana ustunidan keyin alohida `vaqt` ustuni bo'ladi (`HH:MM`).
- Bosh sahifada oxirgi zaxira sanasi ko'rsatiladi. 14 kundan oshgan bo'lsa, eslatma chiqadi.

### F10. Telefonga o'rnatish va internetsiz ishlash
- Ilova telefon brauzerida ochiladi va "bosh ekranga qo'shish" orqali o'rnatiladi. O'rnatilgach o'z belgisi bilan, brauzer paneli ko'rinmaydigan holda ochiladi.
- Birinchi marta ochilgandan keyin internetsiz to'liq ishlaydi.

## 5. 1-versiyaga kirmaydigan narsalar

- Bir nechta valyuta, takroriy to'lovlar, PIN-kod, zakot kalkulyatori (2-versiya).
- Matn va ovozdan xarajatni tushunish, chek skanerlash, sun'iy intellekt maslahatlari (3-versiya).
- Qurilmalar orasida sinxronlash, ro'yxatdan o'tish, bulutda saqlash (3-versiya).
- Bank kartalari va to'lov tizimlari bilan avtomatik bog'lanish.
- Umumiy xarajatlarni bir necha kishi orasida bo'lish.
- App Store va Google Play'ga chiqarish.

Claude Code bu ro'yxatdagi narsalarni so'ralmaguncha qo'shmasligi kerak.

## 6. Texnik talablar

- **Turi:** progressiv veb-ilova (PWA). Statik fayllar: HTML, CSS, JavaScript. Server tomoni yo'q.
- **Kutubxonalar:** tashqi kutubxona va freymvork ishlatilmaydi. Diagrammalar SVG bilan chiziladi.
- **Saqlash:** IndexedDB. Ilova brauzerdan doimiy saqlashga ruxsat so'raydi (`navigator.storage.persist`).
- **Oflayn:** service worker barcha fayllarni keshlaydi. Yangi versiya chiqqanda foydalanuvchiga "Yangilash" tugmasi ko'rsatiladi.
- **Joylash:** GitHub Pages (HTTPS).
- **Kompyuterda sinash:** service worker `file://` manzilida ishlamaydi, shuning uchun sinov lokal server orqali o'tkaziladi. Ishga tushirish yo'li `README.md` da yoziladi.
- **Fayl tuzilishi:**
  - `index.html`, `style.css`
  - `js/data.js` — ma'lumotni saqlash va o'qish
  - `js/calc.js` — barcha hisob-kitoblar (yig'indilar, davrlar, byudjet, qarz). Bu faylda ekran bilan ishlaydigan kod bo'lmaydi
  - `js/glidirak.js` — g'ildirakli sana va vaqt tanlagich (ekran komponenti; qiymatlarni hisoblash `calc.js` da)
  - `js/diagramma.js` — SVG diagrammalar: doira va ustunli (ekran komponenti; barcha raqamlar `calc.js` dan)
  - `js/ui.js` — ekranlar
  - `manifest.json`, `sw.js`, belgilar
  - `tests.html` — brauzerda ochilganda `calc.js` testlarini ishga tushiradi va natijani ko'rsatadi
  - `README.md` — ishga tushirish va joylash yo'riqnomasi
- **Kod:** o'qilishi oson, muhim joylarida o'zbekcha izohlar.
- **Til:** interfeys to'liq o'zbek tilida, lotin yozuvida.
- **Valyuta:** so'm. Summalar butun son sifatida saqlanadi (tiyinsiz). Ko'rsatish: `1 250 000 so'm`.
- **Sana:** saqlashda `YYYY-MM-DD`, ko'rsatishda `KK.OO.YYYY`. Qurilmaning mahalliy vaqti ishlatiladi.
- **Vaqt (soat):** saqlashda `HH:MM` (24 soatlik, masalan `07:05`, `21:00`), qurilmaning mahalliy vaqti. Tekshiruv daqiqa aniqligida.
- **Ekran:** avvalo telefon uchun chiziladi (kengligi 360 pikseldan). Kompyuterda ham to'g'ri ko'rinadi. Tugmalar barmoq bilan bosishga qulay (kamida 44 piksel).
- **Ko'rinish:** yorug' va qorong'i rejim, qurilma sozlamasiga qarab.
- **Brauzerlar:** Chrome (Android), Safari (iPhone), Chrome va Edge (kompyuter).
- **Tezlik:** 5 000 ta yozuv bilan ham ro'yxat va hisobotlar 1 soniyadan tez ochiladi.

## 7. Ma'lumot tuzilishi

Barcha yozuvlarda noyob `id` va `yaratilgan` (vaqt belgisi) maydonlari bo'ladi.

| To'plam | Maydonlar |
|---|---|
| Hisob | id, nom, tur (naqd / karta / boshqa), boshlangich_qoldiq, arxivlangan |
| Yozuv | id, tur (daromad / xarajat / otkazma), summa, sana, vaqt, hisob_id, qabul_hisob_id (faqat o'tkazmada), kategoriya_id, izoh |
| Kategoriya | id, nom, tur (daromad / xarajat), rang, arxivlangan |
| Byudjet | kategoriya_id (yoki "umumiy"), oylik_limit |
| Qarz | id, yaratilgan, yonalish (berdim / oldim), shaxs, summa, hisob_id, sana, vaqt, muddat (bo'sh yoki sana), izoh, tolovlar [{id, sana, vaqt, summa, hisob_id}], yopilgan |
| Sozlamalar | sxema_versiyasi (hozir 3), oxirgi_zaxira_sanasi |

- Zaxira fayli shu to'plamlarning hammasini va `sxema_versiyasi` ni o'z ichiga oladi.
- Keyingi versiyalarda tuzilish o'zgarsa, eski zaxira fayllari avtomatik yangi tuzilishga o'tkaziladi.
- **Sxema versiyalari:** 1 — dastlabki tuzilish; 2 — yozuvga `vaqt` (`HH:MM`) qo'shildi; 3 — qarzlar: to'lovlar qarz ichida (`tolovlar`, har to'lovda `id`), qarzda `vaqt`, `muddat`, `izoh`, `yopilgan` majburiy maydonlar. To'lovlar alohida to'plam emas, qarzning ichida saqlanadi: qarz o'chirilsa, to'lovlari ham ketadi va ular bir butun sifatida zaxiraga tushadi.
- **Ko'chirish (2 → 3):** qarzda tushib qolgan maydonlar to'ldiriladi (`tolovlar` bo'sh ro'yxat, `vaqt` "00:00", `muddat` va `izoh` bo'sh, to'lovga `id`, `yopilgan` to'lovlardan hisoblanadi). To'liq qarzga va boshqa to'plamlarga tegilmaydi, hech narsa o'chirilmaydi; 1 → 2 bilan bitta tranzaksiyada bajariladi va takror ishlasa ham ma'lumot buzilmaydi.
- **Ko'chirish (1 → 2):** eski yozuvlarga faqat `vaqt` qo'shiladi, boshqa hech narsa o'zgarmaydi va hech narsa o'chirilmaydi. Yozuvning `yaratilgan` vaqtidagi (mahalliy) sana yozuvning `sana` si bilan bir xil bo'lsa, `vaqt` o'sha yaratilgan soat:daqiqa bo'ladi, aks holda `00:00`. Ko'chirish bitta amal sifatida bajariladi (yarim yo'lda to'xtamaydi) va ikkinchi marta ishlasa ham ma'lumot buzilmaydi. Shu qoida eski zaxira fayllarini tiklashda ham qo'llanadi.

## 8. Hisob-kitob qoidalari

1. **Hisob qoldig'i** = boshlang'ich qoldiq + daromadlar − xarajatlar + kirgan o'tkazmalar − chiqqan o'tkazmalar − bergan qarzlarim + menga qaytarilganlar + olgan qarzlarim − men qaytarganlarim. Balans doim barcha yozuvlarni hisobga oladi.
2. **Hafta** dushanbadan yakshanbagacha. Hafta ikki oyga yoki ikki yilga to'g'ri kelsa ham, haftalik hisobot to'liq yetti kunni ko'rsatadi. Oylik hisobotga esa faqat o'sha oy sanalari kiradi.
3. **Oldingi davr bilan taqqoslash:** oldingi davrda xarajat nol bo'lsa, foiz o'rniga "—" ko'rsatiladi.
4. **Foizlar** butun songa yaxlitlanadi. Taqsimotdagi foizlar yig'indisi 100 bo'lishi uchun yaxlitlash farqi eng katta kategoriyaga qo'shiladi.
5. **Byudjet** faqat joriy kalendar oyi xarajatlari bo'yicha hisoblanadi.
6. **Arxivlangan** hisob va kategoriyalar yangi yozuv shaklida ko'rinmaydi, lekin eski yozuvlar va hisobotlarda saqlanadi.
7. **Yozuv vaqti** hozirgi vaqtdan keyin bo'lmaydi, o'tmish mumkin (F2).
8. **Hisobotlar** yozuvni uning sanasi bo'yicha davrga kiritadi.

## 9. Ekranlar

Pastda beshta tugmali navigatsiya:

1. **Bosh sahifa:** umumiy balans, hisoblar qoldig'i, joriy oy daromadi va xarajati, byudjet ogohlantirishlari, oxirgi 10 ta yozuv, zaxira eslatmasi.
2. **Hisobot:** sarlavha va ikki belgi (diagramma almashtirish, filtr); Xarajat / Daromadlar yorlig'i; Kun / Hafta / Oy / Yil tezkor tugmalari; ko'rsatkichlar, taqqoslash; doira yoki ustunli diagramma. Filtr — pastdan chiqadigan oyna (oylik, yillik, davr, hisob).
3. **Qo'shish (+):** o'rtadagi katta tugma. Bosilsa pastdan "Yangi yozuv yaratish" oynasi chiqadi: "Tranzaksiya qo'shish" (birinchi, 5 qadamli yozuv oynasi, F2) va "Qarz qo'shish" (qarz oynasi, F8).
4. **Byudjet:** kategoriyalar bo'yicha chegaralar va ularning holati.
5. **Yana:** barcha yozuvlar (filtr bilan), qarzlar (jami, shaxs bo'yicha ro'yxat, yopilganlar), hisoblar, kategoriyalar, zaxira va eksport, ilova haqida.

## 10. Qurish bosqichlari

Har bir bosqich alohida bajariladi, sinab ko'riladi va saqlanadi (git commit). Keyingi bosqichga faqat oldingisi ishlagach o'tiladi.

| Bosqich | Nima quriladi | Tekshirish |
|---|---|---|
| 1 | Sahifa asosi, pastki navigatsiya, saqlash qatlami (`data.js`), `tests.html`, tayyor kategoriyalar va "Naqd pul" hisobi | Sahifa ochiladi, bo'limlar almashadi, testlar sahifasi ishlaydi |
| 2 | Yozuv qo'shish (daromad, xarajat), yozuvlar ro'yxati, bosh sahifadagi balans (F2, F3 ning ko'rsatish qismi) | Yozuv qo'shilsa, ro'yxatda chiqadi va balans o'zgaradi; sahifa qayta ochilganda joyida |
| 3 | Tahrirlash, o'chirish va bekor qilish, hisoblar va o'tkazma (F1, F3) | O'tkazma umumiy balansni o'zgartirmaydi, hisoblar qoldig'ini o'zgartiradi |
| 4 | Kategoriyalarni boshqarish (F4), filtr va qidiruv (F3) | Nom o'zgarsa, eski yozuvlarda ham yangilanadi |
| 5 | Hisobotlar va ularning testlari (F5) | 11-banddagi sinov raqamlari to'g'ri chiqadi |
| 6 | Diagrammalar (F6) | Diagrammalar hisobot raqamlariga mos |
| 7 | Byudjet (F7) | Chegara 80 va 100 foizda rang o'zgartiradi |
| 8 | Qarzlar (F8) | Qarz balansga ta'sir qiladi, hisobotga kirmaydi |
| 9 | Zaxira, tiklash, eksport (F9) | Zaxiradan tiklangach hamma raqam avvalgidek |
| 10 | PWA: manifest, service worker, belgi, GitHub Pages'ga joylash (F10) | Telefonda o'rnatiladi va internetsiz ishlaydi |

## 11. Qabul mezonlari

**Sinov ma'lumoti** (joriy oy ichida, barchasi "Naqd pul" hisobida, boshlang'ich qoldiq 0):

| Sana | Tur | Summa | Kategoriya yoki tafsilot |
|---|---|---|---|
| Oyning 1-kuni | Daromad | 5 000 000 | Oylik maosh |
| Oyning 2-kuni | Xarajat | 300 000 | Oziq-ovqat |
| Oyning 2-kuni | Xarajat | 50 000 | Transport |
| Oyning 3-kuni | Xarajat | 150 000 | Oziq-ovqat |
| Oyning 3-kuni | O'tkazma | 1 000 000 | Naqd puldan "Karta" hisobiga |
| Oyning 4-kuni | Qarz berdim | 200 000 | Naqd puldan, Ali |

Byudjet: Oziq-ovqat uchun oylik chegara 500 000 so'm.

Eslatma: yozuv vaqti hozirdan keyin bo'lmagani uchun, sinov ma'lumotini oyning 4-kunidan keyin kiriting (yoki oldingi oyni oling).

**Kutilgan natija:**

- Oylik hisobot: daromad 5 000 000, xarajat 500 000, qoldiq 4 500 000 so'm.
- Oyning 2-kuni uchun kunlik hisobot: xarajat 350 000 so'm.
- Kategoriyalar bo'yicha: Oziq-ovqat 450 000 so'm (90%), Transport 50 000 so'm (10%).
- "Naqd pul" qoldig'i 3 300 000, "Karta" qoldig'i 1 000 000, umumiy balans 4 300 000 so'm.
- Byudjet: Oziq-ovqat 450 000 / 500 000 (90%), chiziq sariq rangda, bosh sahifada ogohlantirish bor.
- Qarzlar: menga qaytarilishi kerak 200 000 so'm.
- Ali 200 000 so'mni qaytarsa: "Naqd pul" 3 500 000, umumiy balans 4 500 000, qarz yopilgan, oylik hisobot o'zgarmagan.

**Qo'shimcha tekshiruvlar:**

- `tests.html` dagi barcha testlar o'tadi. Testlar kamida quyidagilarni qamraydi: davr chegaralari (hafta ikki oyga to'g'ri kelishi, yil almashishi, kabisa yili), yig'indilar, foizlar, byudjet holati, hisob qoldig'i.
- Sahifa yopilib qayta ochilganda barcha ma'lumot joyida.
- Zaxira olinadi, ma'lumot o'chiriladi, zaxiradan tiklanadi va barcha raqamlar avvalgidek.
- Summa bo'sh qoldirilsa, yozuv saqlanmaydi va xato xabari chiqadi.
- O'chirilgan yozuv "Bekor qilish" bilan qaytadi.
- Telefonda bosh ekranga o'rnatiladi va samolyot rejimida to'liq ishlaydi.
- 360 piksel kenglikda gorizontal aylantirish yo'q.
- Yozuv shaklida sana va soat hozirgi vaqt bilan to'lib turadi. Soat 21:00 bo'lsa, 21:00 saqlanadi, 21:01 saqlanmaydi va xato xabari chiqadi. Ertangi sana tanlanmaydi. Tahrirlashda ham shunday.
- Yarim tundan o'tganda: soat 00:05 da kechagi 23:59 mumkin, bugungi 00:06 mumkin emas.
- Ro'yxatda har yozuvda soat ko'rinadi; kun ichida soati kattasi tepada.
- Yozuv qo'shish 5 qadamda: tur va summa, kategoriya, hisob, sana va vaqt, izoh. Har qadamda "Orqaga" va "n / 5". O'tkazmada 2 va 3-qadam "Qayerdan" va "Qayerga". Orqaga qaytganda kiritilgan qiymatlar joyida; shakl yopilsa yoki saqlansa, tozalanadi.
- Tezkor saqlash: 2-qadamdan boshlab pastdagi "Saqlash" yozuvni oxirgi ishlatilgan hisob (yoki tanlangani), hozirgi sana va vaqt bilan saqlaydi; kategoriya tanlanmagan bo'lsa, xato chiqadi.
- G'ildirakda kelajak kun, soat va daqiqa kulrang va tanlanmaydi (barmoq bilan aylantirilsa ham hozirgi vaqtga qaytadi). 360 piksel kenglikda va yorug' hamda qorong'i rejimda to'g'ri ko'rinadi.
- Yozuvni tahrirlash bitta ekranda, sana va vaqt shu g'ildirak bilan tanlanadi.
- Diagrammalar: doiradagi tilimlar va ustunlardagi raqamlar hisobotdagi raqamlarga aynan teng (sinov ma'lumoti bilan: oylik daromad 5 000 000, xarajat 500 000; Oziq-ovqat 450 000 (90%), Transport 50 000 (10%); 2-kun ustunida xarajat 350 000). Doira tilimi yoki ustun bosilsa, tegishli yozuvlar ochiladi.
- Diagrammalar chegara holatlarida to'g'ri: davrda yozuv yo'q, faqat bitta kategoriya, 15 ta kategoriya, juda katta va juda kichik summalar, manfiy qoldiq; 5 000 yozuv bilan 1 soniyadan tez; 360 piksel kenglikda gorizontal aylantirishsiz, yorug' va qorong'i rejimda.
- Qarzning sanasi va soati hozirdan keyin bo'lsa, qarz saqlanmaydi (21:00 mumkin, 21:01 mumkin emas); to'lov sanasi va soati ham shunday. Qaytarish muddati kelajakda bo'lishi mumkin.
- "+" tugmasi "Yangi yozuv yaratish" oynasini ochadi (ikki qator, birinchisi "Tranzaksiya qo'shish" fokusda); Esc, yopish belgisi, "Orqaga" va oyna tashqarisi yopadi; qarz oynasidan "Orqaga" tanlov oynasiga qaytaradi; "Yana" → Qarzlar ichidagi "+ Qarz qo'shish" qarz oynasini to'g'ridan-to'g'ri ochadi. Tugmalar kamida 44 piksel, 360 piksel kenglikda yorug' va qorong'i rejimda to'g'ri ko'rinadi.
- Qarz: to'lov summasi qolgan qarzdan oshsa rad etiladi; to'lov vaqti qarz vaqtidan oldin bo'lsa rad etiladi; summa to'langandan kam qilib tahrirlanmaydi; qisman va to'liq qaytarish; muddati o'tgan qarz ⚠ belgisi bilan; qarz va to'lovni o'chirish 10 soniya ichida "Bekor qilish" bilan qaytadi; arxivlanayotgan hisobga bog'langan qarz haqida ogohlantirish.
- Eski (2-versiya) bazani ochganda hech narsa o'chmaydi, qarzlarga faqat tushib qolgan maydonlar qo'shiladi (migratsiya eski bazaning nusxasida sinab ko'riladi).
- Eski (1-versiya) bazani ochganda hech narsa o'chmaydi, yozuvlarga faqat `vaqt` qo'shiladi; ilovani qayta ochish ma'lumotni o'zgartirmaydi.
- Bazada oldindan qolgan kelajak vaqtli yozuv o'chirilmaydi, "Kelajak" belgisi bilan ko'rinadi va tahrirlashda vaqtni o'tmishga to'g'rilashni talab qiladi.

## 12. Keyingi versiyalar (qisqa reja)

**2-versiya** (serversiz, 1-versiya ustiga quriladi):
- Bir nechta valyuta: har bir hisobning o'z valyutasi, kurs qo'lda kiritiladi.
- Takroriy to'lovlar: oylik maosh, ijara, internet kabi yozuvlar belgilangan kunda avtomatik qo'shiladi.
- PIN-kod bilan himoya.
- Zakot kalkulyatori.
- Jamg'arma maqsadlari.

**3-versiya** (server va sun'iy intellekt modeli talab qiladi):
- Oddiy gapdan yozuv yaratish ("tushlikka 45 ming sarfladim").
- Ovoz bilan kiritish va chek rasmini o'qish.
- Xarajatlar bo'yicha sun'iy intellekt tahlili va maslahatlari.
- Ro'yxatdan o'tish va qurilmalar orasida sinxronlash, avtomatik bulutli zaxira.

Bu versiyalar boshlanishidan oldin har biri uchun alohida TZ yoziladi.

## 13. Muhim eslatmalar

- **Ma'lumot xavfsizligi.** Ma'lumot faqat shu qurilmaning brauzer xotirasida turadi. Brauzer ma'lumotlari tozalansa yoki ilova o'chirilsa, yozuvlar yo'qoladi. Shuning uchun zaxira (F9) va uning eslatmasi majburiy.
- **Maxfiylik.** 1-versiyada PIN-kod yo'q: telefonni ochgan odam ilovani ham ochadi.
- **Nom va dizayn.** Ilova o'z nomi va o'z ko'rinishiga ega bo'ladi. Boshqa ilovalarning nomi, logotipi va dizayni ko'chirilmaydi.

## 14. Claude Code uchun ish qoidalari

1. Bir vaqtda faqat bitta bosqich bajariladi. Keyingi bosqichga foydalanuvchi aytgandagina o'tiladi.
2. Har bosqich boshida qisqa reja ko'rsatiladi.
3. Har bosqich oxirida: `tests.html` testlari yangilanadi, foydalanuvchiga nimani qanday tekshirish kerakligi aytiladi.
4. TZ'da yo'q funksiya qo'shilmaydi. Noaniq joy bo'lsa, taxmin qilinmaydi, so'raladi.
5. Tushuntirishlar sodda o'zbek tilida, foydalanuvchi boshlovchi ekanini hisobga olgan holda.
6. Har bosqich tugagach o'zgarishlar tushunarli xabar bilan commit qilinadi.

## 15. Ochiq savollar

Quyidagilar taxmin asosida yozilgan. Boshqacha bo'lishi kerak bo'lsa, qurishdan oldin o'zgartiriladi:

1. Telefon turi (Android yoki iPhone) noma'lum. Ilova ikkalasida ham ishlaydigan qilib yozilgan.
2. Ilova nomi tanlanmagan. 10-bosqichgacha nom va belgi kerak bo'ladi.
3. Kategoriyalar ro'yxati taxminiy.
4. Zaxira eslatmasi muddati 14 kun deb olingan.
