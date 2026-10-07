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
| `mahalliy_taqlid.sql`, `mahalliy_sinov.sh` | Faqat dasturchi uchun: kompyuterdagi PostgreSQL'da sinash (haqiqiy Supabase emas). Supabase'da ishga tushirmang |

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
