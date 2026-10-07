-- =====================================================================
-- Chuntak AI — hisobni va serverdagi ma'lumotni o'chirish (S7)
-- Fayl: supabase/003_hisobni_ochirish.sql
--
-- Nima qiladi: public.hisobni_ochirish() funksiyasini yaratadi. Ilova uni chaqirsa, KIRGAN foydalanuvchining
-- (faqat chaqiruvchining o'zining) hamma qatori 7 jadvaldan HAQIQATAN o'chiriladi (tombstone ham qolmaydi),
-- keyin uning akkaunti (auth.users dagi yozuv) ham o'chiriladi. Boshqa foydalanuvchiga tegmaydi.
--
-- Xavfsizlik:
--  * Funksiyada PARAMETR yo'q: kimni o'chirishni chaqiruvchi tanlay olmaydi, faqat auth.uid() (kirgan foydalanuvchi) o'chadi.
--  * SECURITY DEFINER (jadval egasi huquqi bilan ishlaydi: foydalanuvchi o'z akkauntini (auth.users) o'zi o'chira olmaydi),
--    search_path bo'sh (soxta jadval/funksiya almashtirib bo'lmaydi), RLS o'chirilgan holda ham har DELETE da user_id = auth.uid().
--  * EXECUTE huquqi faqat `authenticated` roliga; `anon` va public ga YO'Q.
--  * Hammasi bitta tranzaksiyada: xato bo'lsa hech narsa o'chmaydi.
-- Qayerda ishga tushiriladi: Supabase → SQL Editor (README.md ga qarang). Qayta ishga tushirish xavfsiz.
-- Bu faylda maxfiy kalit yoki parol yo'q va bo'lmasligi kerak.
-- =====================================================================

create or replace function public.hisobni_ochirish()
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  kim uuid := auth.uid();          -- so'rovni yuborgan (kirgan) foydalanuvchi
  j text;
  n integer;
  hisobot jsonb := '{}'::jsonb;
begin
  if kim is null then
    raise exception 'Kirmagan foydalanuvchi hisobni o''chira olmaydi' using errcode = '42501';
  end if;

  -- Tartib: avval bog'langan qatorlar (tashqi kalitlar kechiktirilgan, baribir tranzaksiya oxirida tekshiriladi)
  foreach j in array array['yozuvlar', 'byudjetlar', 'qarz_tolovlari', 'qarzlar', 'kategoriyalar', 'hisoblar', 'sozlamalar'] loop
    execute format('delete from public.%I where user_id = $1', j) using kim;   -- HAQIQIY o'chirish (deleted = true qatorlar ham)
    get diagnostics n = row_count;
    hisobot := hisobot || jsonb_build_object(j, n);
    -- Tekshiruv: shu foydalanuvchining qatori qolmagan bo'lishi shart (aks holda hammasi bekor qilinadi)
    execute format('select count(*) from public.%I where user_id = $1', j) into n using kim;
    if n <> 0 then
      raise exception 'Qatorlarni o''chirib bo''lmadi (%): hech narsa o''zgarmadi', j using errcode = '55000';
    end if;
  end loop;

  delete from auth.users where id = kim;   -- akkaunt (kirish yozuvi, sessiyalar va identity lar ham cascade bilan ketadi)
  get diagnostics n = row_count;
  hisobot := hisobot || jsonb_build_object('akkaunt', n);
  return hisobot;
end;
$$;

comment on function public.hisobni_ochirish() is 'Kirgan foydalanuvchining hamma ma''lumotini haqiqatan o''chiradi va akkauntini o''chiradi. Faqat chaqiruvchining o''zi uchun.';

-- Ruxsat: faqat kirgan foydalanuvchilar (anon va public ga yo'q)
revoke all on function public.hisobni_ochirish() from public, anon;
grant execute on function public.hisobni_ochirish() to authenticated;

-- Tayyor. Keyingi qadam (ixtiyoriy): supabase/004_hisobni_ochirish_testi.sql ni ishga tushirib tekshiring.
