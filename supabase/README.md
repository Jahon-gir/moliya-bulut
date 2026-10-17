# Supabase: baza sxemasi va xavfsizlik testi (S1)

Bu papkada Chuntak AI uchun serverdagi baza (Supabase) tayyorlanadi. **Ilova hozircha bu bazaga ulanmaydi**: bu bosqichda faqat
baza va uning himoyasi tayyorlanadi, ilova kodi o'zgarmaydi.

Bu yerda **hech qanday maxfiy kalit yoki parol yo'q** va bo'lmasligi kerak (repozitoriy ochiq).

| Fayl | Nima uchun |
|---|---|
| `001_sxema.sql` | Jadvallar, ruxsatlar, qator himoyasi (RLS), triggerlar, indekslar. Supabase'da ishga tushiriladi |
| `002_xavfsizlik_testi.sql` | Himoyani tekshiradi: ikkita sinov foydalanuvchi bir-birining ma'lumotini ko'ra olmasligini va h.k. Supabase'da ishga tushiriladi |
| `003_hisobni_ochirish.sql` | Hisobni va serverdagi ma'lumotni o'chirish funksiyasi (S7). Supabase'da ishga tushiriladi |
| `004_hisobni_ochirish_testi.sql` | 003 ni tekshiradi: ikkita sinov foydalanuvchi, A o'chirsa B ning ma'lumoti saqlanadi. Supabase'da ishga tushiriladi |
| `005_sinxron_xizmat.sql` | Fon tortishini yengillashtiruvchi `sinxron_holati()` va 90 kunlik tombstone tozalash `tombstone_tozalash()` + kunlik jadval (pg_cron) (S8). Supabase'da ishga tushiriladi |
| `006_sinxron_xizmat_testi.sql` | 005 ni tekshiradi (16 tekshiruv). Supabase'da ishga tushiriladi |
| `007_ai_limit.sql` | AI yordamchi kunlik limiti: yangi jadval `ai_limit` (RLS, siyosatsiz) va `ai_limit_oshir()` funksiyasi. Supabase'da ishga tushiriladi |
| `008_ai_limit_testi.sql` | 007 ni tekshiradi (11 tekshiruv). Supabase'da ishga tushiriladi |
| `functions/yordamchi/index.ts` | AI yordamchi Edge Function (bitta fayl). Supabase Dashboard'ga nusxalab joylanadi (5-bo'lim) |
| `functions/yordamchi/test.mjs` | Funksiya sinovi (kompyuterda, `node --test`). AI taqlid qilinadi, haqiqiy kalit kerak emas |
| `../model-server/kopri.py`, `test_kopri.py` | "Ko'prik": uyingizdagi Ollama oldidagi kalit tekshiruvchi darvoza va uning sinovi (yozuv rejimi uchun, 6-bo'lim) |
| `mahalliy_taqlid.sql`, `mahalliy_sinov.sh` | Faqat dasturchi uchun: kompyuterdagi PostgreSQL'da sinash (001–008) (haqiqiy Supabase emas). Supabase'da ishga tushirmang |

## 1. Ishga tushirish (qadamma-qadam)

Oldindan: Supabase loyihangiz tayyor (S0). Loyiha sozlamalari: Data API yoqilgan, "Automatically expose new tables" **o'chirilgan**.
Shuning uchun `001_sxema.sql` ruxsatlarni (GRANT) o'zi beradi: faqat `authenticated` roliga, `anon` roliga hech narsa.

1. [supabase.com](https://supabase.com) → loyihangizni oching (`chuntak`).
2. Chap menyudan **SQL Editor** ni oching. **New query** (yangi so'rov) ni bosing.
3. Repozitoriydagi `supabase/001_sxema.sql` faylini oching, **hamma matnini** nusxalang va SQL Editor'ga qo'ying.
4. **Run** (yoki `Ctrl+Enter`) ni bosing. Natija: **"Success. No rows returned"** (xato qizil rangda chiqadi). Bu fayl mavjud ma'lumotga tegmaydi, uni qayta ishga tushirish xavfsiz.
5. Yana **New query** ni bosing. `supabase/002_xavfsizlik_testi.sql` matnini nusxalab qo'ying va **Run** ni bosing.
6. Natija jadval bo'lib chiqadi. Har qatorda **O'TDI** yoki **O'TMADI** yozilgan. Eng pastki qator: `JAMI: 75 ta o'tdi, 0 ta o'tmadi | HAMMASI O'TDI`.
   - Sinov **hech narsa saqlamaydi**: sinov foydalanuvchilar va qatorlar tranzaksiya ichida yaratilib, oxirida bekor qilinadi.
   - Qatorlar soni (75) keyingi o'zgarishlarda farq qilishi mumkin; muhimi: "O'TMADI" yo'q va oxirgi qatorda "HAMMASI O'TDI".

## 1-b. Hisobni o'chirish funksiyasi (S7): 003 va 004

Bu bosqich **ilovadagi "Hisobimni va serverdagi ma'lumotimni o'chirish" tugmasi ishlashi uchun kerak**. 001 va 002 ishga tushirilgan bo'lishi shart.

1. Supabase → **SQL Editor** → **New query**.
2. `supabase/003_hisobni_ochirish.sql` faylining **hamma matnini** nusxalab qo'ying va **Run** ni bosing. Natija: **"Success. No rows returned"**. Fayl mavjud ma'lumotga tegmaydi, qayta ishga tushirish xavfsiz.
3. Yana **New query**. `supabase/004_hisobni_ochirish_testi.sql` matnini nusxalab qo'ying va **Run** ni bosing.
4. Natija jadval: har qatorda **O'TDI** yoki **O'TMADI**. Eng pastki qator: `JAMI: 18 ta o'tdi, 0 ta o'tmadi | HAMMASI O'TDI`. Sinov **hech narsa saqlamaydi** (hamma narsa oxirida bekor qilinadi) va sizning haqiqiy akkauntingizga tegmaydi: u ikkita vaqtinchalik sinov foydalanuvchidan foydalanadi.
5. Tekshirish (ixtiyoriy): **Database → Functions** ro'yxatida `hisobni_ochirish` ko'rinadi.

**Funksiya nima qiladi:** kirgan foydalanuvchi (faqat chaqiruvchining o'zi, `auth.uid()` bo'yicha; parametr yo'q) 7 jadvaldagi hamma qatorini HAQIQATAN o'chiradi (tombstone ham qolmaydi), keyin `auth.users` dagi akkauntini o'chiradi. `SECURITY DEFINER`, `search_path` bo'sh, `EXECUTE` faqat `authenticated` roliga (anon va public ga yo'q). Hammasi bitta tranzaksiyada.

**Xatolar:**

| Xabar | Sababi va yechimi |
|---|---|
| Ilovada "Serverda bu funksiya yo'q ... (kod: PG_PGRST202)" | 003 ishga tushirilmagan (yoki Supabase kesh yangilanmagan: 1 daqiqa kuting). 003 ni ishga tushiring |
| 004 da "Kutilmagan xato: permission denied for table users" | SQL Editor `postgres` roli bilan ishlashi kerak (odatiy). Rol tanlash bo'lsa, `postgres` ni tanlang |
| 004 da biror qatorda **O'TMADI** | Ilovada hisobni o'chirish tugmasini ishlatmang va qator matnini menga yuboring |
| Ilovada "Qatorlarni o'chirib bo'lmadi (kod: PG_55000)" | Funksiya egasi RLS ni chetlab o'ta olmaydi. Hech narsa o'chmaydi. Xato matnini menga yuboring |

## 1-c. Sinxron xizmat funksiyalari va kunlik tozalash (S8): 005 va 006

Bu fayl **ixtiyoriy, lekin tavsiya etiladi**: ilova uni bo'lmasa ham ishlaydi. Nima beradi: (1) fon tortishi har daqiqa 6 ta so'rov o'rniga 1 ta so'rov yuboradi (batareya va so'rovlar tejaladi); (2) 90 kundan oshgan o'chirilgan qatorlar (tombstone) serverdan har kuni o'zi tozalanadi (bepul tarifda hajm 500 MB, shuni tejaydi).

1. SQL Editor → **New query** → `supabase/005_sinxron_xizmat.sql` matnini to'liq nusxalab qo'ying → **Run**.
2. Pastdagi **Results/Messages** da xabarni o'qing:
   - `Kunlik tozalash qo'yildi: har kuni 03:15 (UTC)...` — hammasi tayyor.
   - `pg_cron yoqib bo'lmadi...` — **Database → Extensions** ga o'ting, qidiruvga `pg_cron` yozing va yoqing (Enable), so'ng 005 ni **qayta Run** qiling (qayta ishga tushirish xavfsiz).
3. Tekshirish: yangi **New query** → `select jobname, schedule, active from cron.job;` → `chuntak-tombstone-tozalash | 15 3 * * * | true` qatori chiqishi kerak.
4. Sinov: **New query** → `supabase/006_sinxron_xizmat_testi.sql` → **Run** → `JAMI: 16 ta o'tdi, 0 ta o'tmadi | HAMMASI O'TDI`. Sinov hech narsa saqlamaydi.
5. Qo'lda bir marta tozalash (ixtiyoriy): `select public.tombstone_tozalash(90);` — natija nechta qator o'chganini ko'rsatadi. **Faqat SQL Editor'dan**: ilovadan chaqirib bo'lmaydi.

**Xavfsizlik:** `tombstone_tozalash` ga faqat jadval egasi (pg_cron, SQL Editor) kira oladi; `authenticated` va `anon` ga EXECUTE yo'q. U faqat 90 kundan eski `deleted = true` qatorlarni o'chiradi va ularga bog'langan tirik yoki yangi o'chirilgan qator bo'lsa tegmaydi (tashqi kalit buzilmaydi). `sinxron_holati` faqat kirgan foydalanuvchining o'z qatorlarini ko'radi (RLS).

**Cheklov:** 90 kundan ortiq internetsiz qolgan qurilma boshqa qurilmada o'chirilgan qatorni "tirik" deb saqlab qolishi mumkin (u qator qurilmada qoladi, serverga qaytarilmaydi, o'zgartirilmaguncha).

## 2. Qanday tekshirish (qo'shimcha)

- **Table Editor**: 7 ta jadval ko'rinadi (`hisoblar`, `kategoriyalar`, `yozuvlar`, `byudjetlar`, `qarzlar`, `qarz_tolovlari`, `sozlamalar`). Har birida "RLS enabled" yozuvi bor.
- **Authentication → Policies** (yoki Database → Policies): har jadvalda 4 ta siyosat (`..._egasi_select`, `_insert`, `_update`, `_delete`).
- **Database → Advisors (Security Advisor)**: RLS yo'qligi haqida ogohlantirish chiqmasligi kerak.
- **Kirmagan so'rov rad etilishini haqiqiy Data API orqali ko'rish** (ixtiyoriy). Kompyuter terminalida, `<loyiha>` va `<ochiq-kalit>` o'rniga o'zingizning **ochiq (anon/publishable)** kalitingiz va loyiha nomingizni qo'ying (maxfiy `service_role` kalitini HECH QACHON ishlatmang):

      curl -s "https://<loyiha>.supabase.co/rest/v1/yozuvlar?select=*" -H "apikey: <ochiq-kalit>" -H "Authorization: Bearer <ochiq-kalit>"

  Kutilgan natija: xato (`permission denied for table yozuvlar`, kod `42501`). Ma'lumot qaytmasligi kerak.

## 3. Xato chiqsa nima qilish

| Xabar | Sababi va yechimi |
|---|---|
| `relation "..." already exists` | Jadval allaqachon bor. Bu xato emas, fayl "if not exists" bilan yozilgan; boshqa qizil xato bo'lmasa, davom eting |
| `function auth.uid() does not exist` yoki `schema "auth" does not exist` | Bu Supabase loyihasi emas yoki noto'g'ri baza tanlangan. Supabase loyihangizning SQL Editor'ida ishga tushiring |
| `permission denied for table users` / `002` boshida xato (`auth.users` ga yozishda) | Sinov ikkita vaqtinchalik foydalanuvchini `auth.users` ga qo'shadi. SQL Editor `postgres` roli bilan ishlaydi, odatda ruxsat bor. Agar SQL Editor'da rol tanlash imkoni bo'lsa, `postgres` rolini tanlang |
| `002` da "Kutilmagan xato: ..." qatori | `auth.users` jadvalida sizning loyihangizda qo'shimcha trigger yoki majburiy ustun bor. Xato matnini saqlab oling va menga yuboring |
| `002` da biror qatorda **O'TMADI** | Himoyada kamchilik bor. **Ilovani bu bazaga ulamang.** Qator matnini menga yuboring, tuzataman |
| "Success. No rows returned", lekin jadval chiqmadi (`002`) | Faylning oxirgi qatori (`select * from pg_temp.xavfsizlik_sinovi();`) ham nusxalanganini tekshiring |
| Qo'lda `001` ni o'zgartirmoqchi bo'lsangiz | Avval menga ayting: o'zgartirish ruxsatlarga ta'sir qilishi mumkin |

## 4. Qaror va cheklovlar

- **Ma'lumot egasi:** har qator `user_id` ga ega. Server `user_id` ni `auth.uid()` ga tenglashtiradi; boshqa foydalanuvchi nomidan yozishga urinish rad etiladi.
- **Vaqt:** `created_at` va `updated_at` serverda belgilanadi; `user_id`, `created_at` va `id` o'zgartirilmaydi.
- **O'chirish:** ilova qatorni mantiqiy o'chiradi (`deleted = true`). Qatorni butunlay o'chirish (DELETE) ham o'z qatorlari uchun ruxsat etilgan. Hisobni o'chirish (S7) `public.hisobni_ochirish()` funksiyasi orqali (003). Foydalanuvchi hisobi o'chirilsa, uning hamma qatori avtomatik o'chadi.
- **Bog'liqlik:** hisob, kategoriya va qarzga havolalar faqat o'z qatorlariga bo'ladi (boshqa foydalanuvchi qatoriga bog'lab bo'lmaydi). Tekshiruv tranzaksiya oxirida bajariladi.
- **Saqlanmaydigan narsalar:** balans, hisob qoldig'i (ilovada hisoblanadi), PIN-kod, to'liq karta raqami.
- **Nom takrorlanishi** va boshqa jadvallararo qoidalar bazada tekshirilmaydi (sinxronlashda to'qnashuv chiqarmasligi uchun); ularni ilova tekshiradi.

## 5. AI yordamchi: server qismi (Edge Function `yordamchi`)

Bu qism ilovaga hali ulanmagan (chat ekrani keyingi bosqichlarda). Bu yerda faqat server tayyorlanadi va bitta sinov so'rovi bilan tekshiriladi.
**Kalitlar (OpenAI/Anthropic) faqat Supabase "Secrets" da turadi: ularni hech qachon repozitoriyga, chatga yoki ilova kodiga yozmang.**

> **Funksiya yana o'zgardi (0.37.1, mikrofon xatosi sababi):** Gemini xatosi endi logga (Edge Functions -> `yordamchi` -> Logs, qator `ovoz: ...`) va javobdagi `debug` maydoniga yoziladi (kalit, audio va matn yozilmaydi). **Dashboard'dagi funksiyaga qayta joylang.** Secrets o'zgarmagan.

> **Funksiya yana o'zgardi (0.37.0, mikrofon):** `index.ts` ga yangi `ovoz` rejimi qo'shildi (audio -> matn, Google Gemini). **Dashboard'dagi funksiyaga qayta joylang** va 7-bo'limdagi ikkita yangi Secret'ni kiriting (`GEMINI_API_KEY`, `GEMINI_MODEL`). 007 qayta kiritilmaydi.

> **Funksiya yana o'zgardi (0.36.0, "Gap bilan qo'shish"):** `index.ts` ga "narx jami" qoidasi qo'shildi (`yozuv` rejimi: "2 ta non va sut oldim 18 ming" endi 36 000 emas, 18 000 chiqadi; `TZ-sinxronlash.md` 28.4 va 29.8). **Dashboard'dagi funksiyaga qayta joylang** (pastdagi qadamlar bilan bir xil). Secrets va 007 qayta kiritilmaydi.

> **Funksiya yana o'zgardi (0.34.0, erkin savollar):** `index.ts` yangi protokolga o'tdi (reja: sorovlar/suhbat/tashqari, javob: matn va davom savollari, tarix, kuniga 200 so'rov). **Dashboard'dagi funksiyaga qayta joylang** (Edge Functions → `yordamchi` → eski matnni o'chirib, yangi `index.ts` ni to'liq nusxalab qo'ying → Deploy). Eski funksiya yangi ilovaning so'rovini tushunmaydi, shuning uchun ilovani yangilashdan oldin yoki birga joylang. Secrets va 007 qayta kiritilmaydi.

> **Funksiya o'zgardi (3-PR, 0.33.0):** `supabase/functions/yordamchi/index.ts` yangilandi (AI_RAQAM endi savoldagi raqamlarni ham ruxsat etadi). Dashboard'dagi funksiyaga **qayta joylang**: Edge Functions → `yordamchi` → muharrirdagi hamma matnni o'chirib, yangi `index.ts` ni to'liq nusxalab qo'ying → **Deploy**. Secrets va 007 qayta kiritilmaydi.

### 5.1. Limit jadvalini yaratish (007 va 008)

1. Supabase → **SQL Editor** → **New query**. `supabase/007_ai_limit.sql` matnini to'liq nusxalab qo'ying → **Run**. Natija: **"Success. No rows returned"** (qayta ishga tushirish xavfsiz).
2. Yana **New query**. `supabase/008_ai_limit_testi.sql` → **Run**. Oxirgi qator: `JAMI: 11 ta o'tdi, 0 ta o'tmadi | HAMMASI O'TDI`. Sinov hech narsa saqlamaydi.

### 5.2. Funksiyani Dashboard'da yaratish

1. Supabase → chap menyudan **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Funksiya nomi aynan: `yordamchi`.
3. Muharrirdagi namuna matnni butunlay o'chiring. `supabase/functions/yordamchi/index.ts` faylining **hamma matnini** nusxalab qo'ying.
4. **Deploy** ni bosing. "Verify JWT" (JWT tekshiruvi) yoqilgan holda qoldiring (odatiy).
5. Funksiya manzili: `https://<loyiha>.supabase.co/functions/v1/yordamchi` (loyiha manzili ilovada allaqachon bor).

### 5.3. Maxfiy o'zgaruvchilarni (Secrets) kiritish

Edge Functions → **Secrets** (yoki Project Settings → Edge Functions → Secrets) → **Add new secret**. Bittadan kiriting:

| Nom | Qiymat |
|---|---|
| `AI_PROVAYDER` | `openai` yoki `claude` |
| `AI_MODEL` | tanlangan provayderdagi model nomi (provayder hujjatidan oling; masalan, arzon va tez model) |
| `OPENAI_API_KEY` | OpenAI kaliti (faqat `AI_PROVAYDER=openai` bo'lsa kerak) |
| `ANTHROPIC_API_KEY` | Anthropic kaliti (faqat `AI_PROVAYDER=claude` bo'lsa kerak) |
| `AI_RUXSAT_EMAIL` | ruxsat berilgan Google email(lar), vergul bilan: `bir@gmail.com, ikki@gmail.com` |

Yozuv rejimi (gapdan yozuv) uchun qo'shimcha Secrets: 6.3-bo'lim.

`SUPABASE_URL` va `SUPABASE_ANON_KEY` ni Supabase o'zi beradi, ularni kiritmaysiz. Secret o'zgarsa funksiyani qayta Deploy qilish shart emas (yangi so'rovlar yangi qiymatni oladi). `AI_RUXSAT_EMAIL` bo'sh yoki yo'q bo'lsa funksiya HAMMAGA 403 qaytaradi.

### 5.4. Bitta sinov so'rovi

1. Ilovani GitHub Pages manzilida ochib (`https://jahon-gir.github.io/moliya-bulut/`), `AI_RUXSAT_EMAIL` dagi Google akkaunt bilan kiring.
2. Brauzerda **F12** (kompyuterda) → **Console**. Quyidagini nusxalab yopishtiring va Enter bosing:

       Kirish.tokenOl().then(function (t) {
         return fetch(Kirish.SUPABASE_MANZIL + '/functions/v1/yordamchi', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json', apikey: Kirish.OCHIQ_KALIT, Authorization: 'Bearer ' + t },
           body: JSON.stringify({ rejim: 'reja', savol: 'Bu oy oziq-ovqatga qancha sarfladim?', bugun: new Date().toISOString().slice(0, 10), kategoriyalar: ['Oziq-ovqat', 'Transport'], hisoblar: ['Naqd pul'] })
         });
       }).then(function (r) { return r.json(); }).then(console.log);

3. Kutilgan natija: `{ ok: true, sorov: { amal: 'yigindi', davr: { dan: '2026-10-01', gacha: '2026-10-31' }, tur: 'xarajat', kategoriya: 'Oziq-ovqat', ... } }`.
4. Xato chiqsa, `xato.kod` ga qarang:

| Kod | Sababi va yechimi |
|---|---|
| `AI_RUXSAT` (401) | Kirmagansiz yoki token eskirgan: ilovada qayta kiring |
| `AI_RUXSAT` (403) | Emailingiz `AI_RUXSAT_EMAIL` ro'yxatida yo'q (yozilishi aynan Google emailingiz bilan bir xil bo'lsin) |
| `AI_LIMIT` (503, "Limitni tekshirib bo'lmadi") | 007 ishga tushirilmagan: 5.1 ni bajaring |
| `AI_LIMIT` (429) | Bugun 100 ta so'rov ishlatilgan (kun O'zbekiston vaqti bilan) |
| `AI_PROVAYDER` | Provayder yoki model/kalit kiritilmagan yoki noto'g'ri, yoki provayderda pul/limit tugagan. Secrets ni tekshiring |
| `AI_UZUN` / `AI_KIRISH` | Savol 300 belgidan uzun yoki so'rov shakli noto'g'ri |
| `AI_SXEMA` / `AI_RAQAM` | AI javobi talabga mos kelmadi; matn ko'rsatilmaydi. Qayta urinib ko'ring |
| `NETWORK` | Internet yoki provayderga ulanish xatosi |

Funksiya jurnali (Edge Functions → yordamchi → **Logs**) da savol yoki natija ko'rinmaydi: funksiya ularni yozmaydi.

### 5.5. Provayderni almashtirish

Edge Functions → Secrets: `AI_PROVAYDER` ni `openai` ↔ `claude` ga o'zgartiring, `AI_MODEL` ni yangi provayderning model nomiga almashtiring va tegishli kalit (`OPENAI_API_KEY` yoki `ANTHROPIC_API_KEY`) kiritilganini tekshiring. Kodni o'zgartirish kerak emas. 5.4 dagi sinovni qayta bajaring.

### 5.6. AI ga nima yuboriladi

Faqat: savol matni, bugungi sana, kategoriya va hisob nomlari, ilova hisoblagan jamlar (raqamlar). Yozuvlar ro'yxati, izohlar va qarzdagi shaxs ismlari YUBORILMAYDI (funksiya natijada `izoh`, `shaxs`, `yozuvlar` kabi kalitlarni rad etadi). Savol va natija bazaga ham, logga ham yozilmaydi; bazada faqat kunlik so'rovlar soni (`ai_limit`) saqlanadi.

### 5.7. Funksiyani kompyuterda sinash (dasturchi uchun)

    node --test supabase/functions/yordamchi/test.mjs

Node 22.18 yoki yangisi kerak. Haqiqiy kalit va tarmoq ishlatilmaydi.

## 6. AI yordamchi: yozuv rejimi (o'z modelingiz uchun qadamlar)

**Bu nima.** Ilova keyinroq gapni ("bozorda 18 ming sarfladim") yozuvga aylantirishni so'raydi. Server buni avval **sizning kompyuteringizdagi modelga** (Ollama, `chuntak-v5`) yuboradi; kompyuter o'chiq bo'lsa OpenAI ga o'tadi. Bu bo'limda siz ikki narsani tayyorlaysiz: (1) kompyuterda himoya darvozasi ("ko'prik"), (2) uni internetga chiqarish va Supabase'ga manzilni aytish. Ilova hozircha bunga ulanmagan: 6.5 dagi sinov so'rovi bilan tekshirasiz.

**Muhim:** kalitni (parolni) o'zingiz o'ylab toping (kamida 16 belgi, harf va raqam aralash, masalan 30 ta tasodifiy belgi). Uni **chatga, repozitoriyga, rasmga yozmang**. Faqat PowerShell'ga va Supabase Secrets'ga kiritasiz. Quyida kalit o'rniga `<...>` turadi.

### 6.1. Ko'prikni Windows'da ishga tushirish

Oldindan: Ollama o'rnatilgan va `chuntak-v5` modeli bor (`ollama list` da ko'rinadi); Python 3 o'rnatilgan (`python --version`).

1. Repozitoriyni kompyuteringizga yuklab oling (yoki `git pull`), papkani oching.
2. Papkada **PowerShell** oching (papka ichida o'ng tugma, "Terminalda ochish").
3. Kalitni bering (qo'shtirnoq ichiga o'zingiz o'ylab topgan kalitni yozing):

       $env:MODEL_KALIT="<o'zingiz-o'ylab-topgan-uzun-kalit>"

4. Ko'prikni ishga tushiring:

       python model-server/kopri.py

5. Kutilgan natija: `Ko'prik ishga tushdi: http://127.0.0.1:8787 ...`. **Bu oynani yopmang**: yopsangiz ko'prik to'xtaydi. To'xtatish: `Ctrl+C`.
6. Kalit yo'q yoki 16 belgidan qisqa bo'lsa, dastur tushunarli xato bilan o'zi to'xtaydi.
7. Tekshirish (boshqa PowerShell oynasida): kalitsiz so'rov rad etilishi kerak:

       curl.exe -i -X POST http://127.0.0.1:8787/api/chat

   Kutilgan: `401`. Ko'prik logida faqat vaqt va raqam (`[2026-.. ..] 401`) chiqadi, so'rov matni chiqmaydi.

Ixtiyoriy: `$env:KOPRI_PORT="8788"` (port o'zgartirish), `$env:MODEL_RUXSAT="chuntak-v5,boshqa-model"` (ruxsat etilgan model nomlari). Odatda kerak emas.

### 6.2. Internetga chiqarish (Supabase sizning kompyuteringizga yetib kelishi uchun)

Supabase serveri internetda, kompyuteringiz uyda. Ko'prikni internetga xavfsiz chiqarishning ikki yo'li bor. **Bittasini tanlang.**

**A) Tailscale Funnel (tavsiya: manzil o'zgarmaydi).**

1. [tailscale.com](https://tailscale.com) da hisob oching (Google bilan kirish mumkin) va Windows uchun Tailscale'ni o'rnating, kiring.
2. Tailscale boshqaruv sahifasida (Admin console) **DNS** bo'limida **MagicDNS** va **HTTPS Certificates** ni yoqing.
3. Funnel ruxsatini yoqing: Admin console → **Access controls** (yoki Settings) da Funnel yoqish taklifi chiqadi; birinchi marta `tailscale funnel 8787` ni ishga tushirsangiz, buyruq o'zi havola beradi: shu havolani ochib, ruxsat bering.
4. Ko'prik ishlab turgan holda yangi PowerShell'da:

       tailscale funnel 8787

5. Natijada manzil chiqadi: `https://<kompyuter>.<tailnet>.ts.net`. Shu manzilni yozib oling (6.3 da `MODEL_URL` bo'ladi). Manzil oxirida `/` va `/api/chat` **bo'lmasin**.
6. Funnel o'chirish: `tailscale funnel reset`.

**B) Muqobil: Cloudflare "quick tunnel" (hisob kerak emas, lekin manzil o'zgaradi).**

1. `cloudflared` ni [Cloudflare sahifasidan](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) yuklab oling (Windows).
2. Ko'prik ishlab turgan holda:

       cloudflared tunnel --url http://127.0.0.1:8787

3. Chiqqan `https://<tasodifiy-nom>.trycloudflare.com` manzilini `MODEL_URL` ga qo'yasiz.
4. **Ogohlantirish:** bu manzil har ishga tushirganingizda **o'zgaradi**. Kompyuterni qayta yoqsangiz yoki buyruqni qayta ishga tushirsangiz, Supabase'da `MODEL_URL` ni yangilashingiz kerak, aks holda funksiya OpenAI ga tushib ketadi (xato chiqmaydi, faqat sekinroq va gap OpenAI ga ketadi). Doimiy ishlatish uchun A yo'li qulayroq.

### 6.3. Supabase Secrets

Supabase → Edge Functions → **Secrets** → **Add new secret**. Bittadan kiriting:

| Nom | Qiymat |
|---|---|
| `MODEL_URL` | 6.2 dagi manzil, masalan `https://<kompyuter>.<tailnet>.ts.net` (oxirida `/` yo'q) |
| `MODEL_KALIT` | 6.1 da PowerShell'ga bergan kalitingiz (aynan bir xil) |
| `MODEL_NOMI` | `chuntak-v5` (ixtiyoriy; yozmasangiz shu nom ishlatiladi) |
| `MODEL_VAQT` | `25` (ixtiyoriy; o'z model javobini necha sekund kutish. Model sovuq bo'lsa `40` qilish mumkin, eng ko'pi 120) |
| `YOZUV_PROVAYDER` | `oz_openai` (sukut: avval o'z model, bo'lmasa OpenAI) · `oz` (faqat o'z model; kompyuter o'chiq bo'lsa xato, gap OpenAI ga HECH QACHON chiqmaydi) · `openai` (faqat OpenAI) |

OpenAI zaxirasi uchun 5.3 dagi `AI_PROVAYDER`, `AI_MODEL`, `OPENAI_API_KEY` kiritilgan bo'lishi kerak (`oz` rejimida shart emas). Secret o'zgarsa funksiyani qayta joylash shart emas.

**Maxfiylik haqida:** `oz_openai` rejimida kompyuter o'chiq bo'lsa, gap (va unda aytilgan ismlar) OpenAI ga ketadi. Oldingi izohlar (`eski`) OpenAI ga hech qachon ketmaydi. Gap OpenAI ga umuman chiqmasin desangiz, `YOZUV_PROVAYDER=oz` qo'ying.

### 6.4. Funksiyani qayta joylash

`index.ts` yangilandi (yangi `yozuv` rejimi). Dashboard'dagi funksiyaga **qayta joylang**: Edge Functions → `yordamchi` → muharrirdagi hamma matnni o'chirib, yangi `supabase/functions/yordamchi/index.ts` ni **to'liq** nusxalab qo'ying → **Deploy**. "Verify JWT" yoqilgan qolsin. Boshqa rejimlar (savol-javob) o'zgarmagan.

### 6.5. Tekshirish

**Avval ko'prikni tashqaridan tekshiring** (PowerShell; `<manzil>` va `<kalit>` o'rniga o'zingiznikini qo'ying):

    curl.exe -i -X POST "<manzil>/api/chat"

Kutilgan: `401` (kalitsiz rad etildi: darvoza ishlayapti). Keyin kalit bilan:

    curl.exe -s -X POST "<manzil>/api/chat" -H "X-Model-Kalit: <kalit>" -H "Content-Type: application/json" -d "{\"model\":\"chuntak-v5\",\"messages\":[{\"role\":\"user\",\"content\":\"salom\"}]}"

Kutilgan: Ollama javobi (JSON, ichida `"message"`). Birinchi javob sekin bo'lishi mumkin (model xotiraga yuklanadi).

**Keyin funksiyani tekshiring.** Ilovani GitHub Pages manzilida ochib kiring, brauzerda **F12** → **Console** ga yopishtiring:

    Kirish.tokenOl().then(function (t) {
      return fetch(Kirish.SUPABASE_MANZIL + '/functions/v1/yordamchi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: Kirish.OCHIQ_KALIT, Authorization: 'Bearer ' + t },
        body: JSON.stringify({ rejim: 'yozuv', gap: 'bugun bozorda 2 ta non va sut oldim 18 ming', bugun: new Date().toISOString().slice(0, 10),
          kategoriyalar: ['Ovqatlanish', 'Transport', 'Boshqa xarajat'], hisoblar: [{ nom: 'Naqd pul', turi: 'naqd' }, { nom: 'Karta', turi: 'karta' }] })
      });
    }).then(function (r) { return r.json(); }).then(console.log);

Kutilgan: `{ ok: true, manba: 'model', yozuvlar: [ { tur: 'xarajat', summa: 18000, ... } ] }`. `manba: 'model'` — javobni sizning kompyuteringiz berdi; `manba: 'openai'` — zaxira ishladi (ko'prik/kompyuter/manzil bilan muammo bor, 6.6 ga qarang).

### 6.6. Nosozliklar

| Belgi | Sababi va yechimi |
|---|---|
| Doim `manba: 'openai'` (o'z model hech qachon ishlamaydi) | `MODEL_URL` yoki `MODEL_KALIT` Secrets'da yo'q yoki xato yozilgan; ko'prik oynasi yopilgan; Funnel/tunnel to'xtagan; Cloudflare manzili o'zgargan. 6.5 dagi `curl.exe` sinovini bajaring: u ishlamasa muammo kompyuter tomonda |
| `401` (curl da) | Kalit noto'g'ri yoki yo'q. PowerShell'dagi `$env:MODEL_KALIT` va Supabase'dagi `MODEL_KALIT` **aynan bir xil** bo'lsin (bo'shliq, qo'shtirnoq qo'shilmasin). PowerShell oynasi yopilsa kalit unutiladi: qayta bering |
| `502` `AI_PROVAYDER` (`YOZUV_PROVAYDER=oz` da) | O'z model javob bermadi. Ko'prik ishlayaptimi, Ollama ishlayaptimi (`ollama ps`) tekshiring. Ko'prik logida `502` chiqsa — Ollama o'chiq |
| `502` `AI_PROVAYDER` (sukut rejimda) | O'z model ham, OpenAI ham sozlanmagan yoki OpenAI kaliti/modeli noto'g'ri. 5.3 ni tekshiring |
| `sabab: 'tushunarsiz'` | Ikkala provayderdan ham o'qiladigan javob kelmadi (ikkalasi band yoki noto'g'ri JSON). Qayta urinib ko'ring; takrorlansa 6.5 sinovlarini bajaring |
| `sabab: 'yozuv_yoq'` | Model gapda yozuv topmadi (masalan kelajak rejasi). Bu xato emas |
| Birinchi javob sekin (20–40 s) | Model sovuq: Ollama uni xotiraga yuklayapti. `keep_alive` 30 daqiqa, shundan keyin tez. 25 s dan oshsa OpenAI ga o'tiladi: `MODEL_VAQT` ni `40` qiling |
| Kompyuter uxlab qoldi | Uyqu rejimida kompyuter javob bermaydi, zaxira ishlaydi. Windows: Sozlamalar → Tizim → Quvvat → "Uyqu" ni "Hech qachon" qiling (ishlatayotgan paytingizda) |
| `ollama ps` da `100% GPU` emas (masalan `100% CPU` yoki `40%/60% CPU/GPU`) | Model to'liq videokartaga sig'magan, shuning uchun sekin. Boshqa og'ir dasturlarni (o'yin, brauzer videolari) yoping va modelni qayta yuklang: `ollama stop chuntak-v5`, keyin yangi so'rov. Baribir `100% GPU` bo'lmasa video xotira yetmaydi: `MODEL_VAQT` ni oshiring yoki `YOZUV_PROVAYDER=oz_openai` da qoldiring |
| Kalit sizib chiqdi deb o'ylasangiz | Ko'prikni to'xtating (`Ctrl+C`), yangi kalit o'ylab toping, 6.1 va 6.3 da almashtiring |
| Windows Firewall so'rasa | Ko'prik faqat `127.0.0.1` da tinglaydi (tashqi tarmoqqa ochilmaydi): "Ruxsat bermaslik" (Cancel) ni tanlash mumkin, Funnel/tunnel baribir ishlaydi |

### 6.7. Sinash (dasturchi uchun)

    python3 model-server/test_kopri.py
    node --test supabase/functions/yordamchi/test.mjs

Ikkalasida ham Ollama, OpenAI va Supabase taqlid qilinadi; haqiqiy kalit va tarmoq kerak emas.

## 7. Mikrofon (ovozdan matn): `ovoz` rejimi uchun qadamlar

Gap ekranidagi mikrofon audioni funksiyaga yuboradi, funksiya uni Google Gemini orqali o'zbekchadan matnga o'giradi. Audio hech qayerda saqlanmaydi (faqat so'rov davomida xotirada turadi), lekin **Google Gemini'ga yuboriladi**.

### 7.1. Gemini kalitini olish
1. https://aistudio.google.com/apikey sahifasiga Google akkaunt bilan kiring va "Create API key" bosing.
2. Kalitni hech qayerga (chat, repoga, skrinshotga) yozmang: faqat 7.2 dagi Secrets'ga kiriting.
3. Bepul daraja cheklovli va Google u yerdagi so'rovlardan modelni yaxshilash uchun foydalanishi mumkin. Maxfiylik talabi muhim bo'lsa Google Cloud'da to'lovli rejim yoqilganini tekshiring (Google shartlari o'zgarishi mumkin, o'zingiz o'qib chiqing).

### 7.2. Secrets'ni kiritish
Supabase Dashboard -> Edge Functions -> Secrets -> Add new secret:

| Nom | Qiymat |
|---|---|
| `GEMINI_API_KEY` | 7.1 dagi kalit |
| `GEMINI_MODEL` | Model nomi. Bo'sh qoldirsangiz standart `gemini-2.5-flash` ishlatiladi. Audioni qabul qiladigan joriy barqaror tez "Flash" modelini https://ai.google.dev/gemini-api/docs/models sahifasidan tekshiring; nom o'zgarsa faqat shu Secret'ni yangilaysiz (kodga tegilmaydi) |

Secret o'zgarsa funksiyani qayta joylash shart emas.

### 7.3. Funksiyani QAYTA JOYLASH shart
`index.ts` yangilandi (yangi `ovoz` rejimi). Edge Functions -> `yordamchi` -> muharrirdagi hamma matnni o'chirib, yangi `supabase/functions/yordamchi/index.ts` ni **to'liq** nusxalab qo'ying -> **Deploy**. "Verify JWT" yoqilgan qolsin. Qayta joylamasangiz mikrofon "Yordamchi hozir javob bera olmayapti" xatosini beradi.

### 7.4. Tekshirish
Ilovada "Gap bilan" -> mikrofon -> bir jumla ayting -> matn maydonga tushishi kerak. Ishlamasa: Secrets nomlari (`GEMINI_API_KEY`), model nomi, Functions -> Logs (matn va kalit loglanmaydi, faqat HTTP kodi). Har ovoz so'rovi kunlik limitga (200) 1 ta bo'lib sanaladi.

### 7.5. Sinash (dasturchi uchun)
`node --test supabase/functions/yordamchi/test.mjs` (Gemini soxta javob bilan, tarmoqsiz).

## 8. Chek skaneri: `rasm` rejimi uchun qadamlar

Gap ekranidagi kamera tugmasi chek rasmini funksiyaga yuboradi. Funksiya avval Google Gemini bilan rasmdagi matnni o'qiydi, so'ng o'sha matnni mavjud yozuv tizimiga (o'z modelingiz, zaxirada OpenAI; `YOZUV_PROVAYDER` sozlamasi bilan bir xil) kategoriya va hisob tanlash uchun beradi. Summa, sana va izoh serverda chek matnidan olinadi (summa = chekdagi JAMI). Rasm hech qayerda saqlanmaydi, lekin **Google Gemini'ga yuboriladi**; chekdagi matn esa o'z modelingizga (yoki zaxirada OpenAI'ga) ketadi.

### 8.1. Yangi Secret kerak emas
`GEMINI_API_KEY` va `GEMINI_MODEL` (7.2) shu rejim uchun ham ishlatiladi. Model **rasmni** qabul qilishi kerak (standart `gemini-2.5-flash` qabul qiladi, lekin Google hujjatidan tekshirib qo'ying).

### 8.2. Funksiyani QAYTA JOYLASH shart
`index.ts` yangilandi (yangi `rasm` rejimi). 7.3 dagi qadamlar bilan bir xil: Dashboard'da `yordamchi` funksiyasi matnini yangi `supabase/functions/yordamchi/index.ts` bilan to'liq almashtirib **Deploy**. Yoki Supabase CLI bilan (kompyuteringizda, repoga kirgan papkada): `supabase functions deploy yordamchi --project-ref <loyiha-id>`.

### 8.3. Tekshirish
Ilovada "Gap bilan" -> kamera tugmasi -> "Galereyadan tanlash" -> o'zingizning chek rasmingiz -> "Chekdan o'qildi · tekshiring" kartasi chiqishi kerak. Xato kodlari: `RASM_KATTA` (2 MB dan katta), `RASM_FORMAT` (JPEG/PNG/WebP emas), `CHEK_EMAS` (rasmda chek yo'q), `RASM_OQILMADI` (Gemini matn o'qiy olmadi), `AI_PROVAYDER` + sabab (`gemini_...`: kalit, model yoki Google xatosi; Functions -> Logs da `rasm: gemini_... http=...` qatori). Har rasm so'rovi kunlik limitga (200) 1 ta bo'lib sanaladi.
