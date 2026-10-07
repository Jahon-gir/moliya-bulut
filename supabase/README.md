# Supabase: baza sxemasi va xavfsizlik testi (S1)

Bu papkada Chuntak AI uchun serverdagi baza (Supabase) tayyorlanadi. **Ilova hozircha bu bazaga ulanmaydi**: bu bosqichda faqat
baza va uning himoyasi tayyorlanadi, ilova kodi o'zgarmaydi.

Bu yerda **hech qanday maxfiy kalit yoki parol yo'q** va bo'lmasligi kerak (repozitoriy ochiq).

| Fayl | Nima uchun |
|---|---|
| `001_sxema.sql` | Jadvallar, ruxsatlar, qator himoyasi (RLS), triggerlar, indekslar. Supabase'da ishga tushiriladi |
| `002_xavfsizlik_testi.sql` | Himoyani tekshiradi: ikkita sinov foydalanuvchi bir-birining ma'lumotini ko'ra olmasligini va h.k. Supabase'da ishga tushiriladi |
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
- **O'chirish:** ilova qatorni mantiqiy o'chiradi (`deleted = true`). Qatorni butunlay o'chirish (DELETE) ham o'z qatorlari uchun ruxsat etilgan (keyingi bosqichlarda 90 kundan keyin tozalash va hisobni o'chirish uchun). Foydalanuvchi hisobi o'chirilsa, uning hamma qatori avtomatik o'chadi.
- **Bog'liqlik:** hisob, kategoriya va qarzga havolalar faqat o'z qatorlariga bo'ladi (boshqa foydalanuvchi qatoriga bog'lab bo'lmaydi). Tekshiruv tranzaksiya oxirida bajariladi.
- **Saqlanmaydigan narsalar:** balans, hisob qoldig'i (ilovada hisoblanadi), PIN-kod, to'liq karta raqami.
- **Nom takrorlanishi** va boshqa jadvallararo qoidalar bazada tekshirilmaydi (sinxronlashda to'qnashuv chiqarmasligi uchun); ularni ilova tekshiradi.
