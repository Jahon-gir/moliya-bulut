-- =====================================================================
-- Chuntak AI — AI yordamchi kunlik limiti (AI yordamchi: server qismi)
-- Fayl: supabase/007_ai_limit.sql
--
-- Nima qiladi: har foydalanuvchi uchun kuniga nechta AI so'rovi yuborilganini sanaydi.
-- Yangi jadval `ai_limit` (mavjud jadvallarga tegilmaydi) va bitta funksiya `ai_limit_oshir()`.
-- Edge Function `yordamchi` har so'rovdan oldin shu funksiyani chaqiradi; natija 100 dan oshsa so'rovni rad etadi.
--
-- Xavfsizlik:
--  - jadvalda RLS yoqilgan va HECH QANDAY siyosat yo'q: ilovadan (anon/authenticated) to'g'ridan-to'g'ri o'qib ham, yozib ham bo'lmaydi.
--  - funksiya faqat chaqiruvchining o'z qatoriga yozadi (auth.uid()), parametr yo'q; EXECUTE faqat authenticated roliga.
--  - foydalanuvchi hisobi o'chirilsa, uning qatorlari ham avtomatik o'chadi (on delete cascade).
--  - savol, javob yoki boshqa matn saqlanmaydi: faqat sana va son.
-- Kun — O'zbekiston vaqti (Asia/Tashkent) bo'yicha. Qayta ishga tushirish xavfsiz.
-- Bu faylda maxfiy kalit yoki parol yo'q va bo'lmasligi kerak.
-- =====================================================================

create table if not exists public.ai_limit (
  user_id uuid not null references auth.users (id) on delete cascade,
  kun     date not null,
  soni    integer not null default 0 check (soni >= 0),
  primary key (user_id, kun)
);
comment on table public.ai_limit is 'AI yordamchi: foydalanuvchining kunlik so''rovlar soni (matn saqlanmaydi).';

alter table public.ai_limit enable row level security;
alter table public.ai_limit force row level security;
revoke all on public.ai_limit from public, anon, authenticated;
-- Ataylab siyosat yo'q: jadvalga faqat quyidagi funksiya (egasi nomidan) yozadi.

create or replace function public.ai_limit_oshir()
returns integer
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  u uuid := auth.uid();
  bugun date := (pg_catalog.now() at time zone 'Asia/Tashkent')::date;
  n integer;
begin
  if u is null then
    raise exception 'Kirish kerak' using errcode = '28000';
  end if;
  -- eski kunlarni shu foydalanuvchi uchun tozalash (jadval o'smasligi uchun)
  delete from public.ai_limit where user_id = u and kun < bugun - 7;
  insert into public.ai_limit as t (user_id, kun, soni)
  values (u, bugun, 1)
  on conflict (user_id, kun) do update set soni = t.soni + 1
  returning t.soni into n;
  return n;
end
$$;
comment on function public.ai_limit_oshir() is 'Chaqiruvchining bugungi AI so''rovlar sonini 1 ga oshiradi va yangi sonni qaytaradi.';
revoke all on function public.ai_limit_oshir() from public, anon;
grant execute on function public.ai_limit_oshir() to authenticated;
