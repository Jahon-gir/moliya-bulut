-- =====================================================================
-- Chuntak AI — sinxronlash xizmat funksiyalari (S8)
-- Fayl: supabase/005_sinxron_xizmat.sql
--
-- Nima qiladi (ikkita funksiya va kunlik tozalash jadvali):
--  1) public.sinxron_holati(): kirgan foydalanuvchining har jadvalidagi eng oxirgi o'zgarish vaqtini BITTA so'rovda qaytaradi.
--     Ilova fonda har daqiqa 6 ta so'rov o'rniga shu bitta so'rovni yuboradi va faqat o'zgargan jadvalni tortadi (so'rovlar va batareya tejaladi).
--     Bu funksiya bo'lmasa ham ilova ishlaydi (eski usulga qaytadi).
--  2) public.tombstone_tozalash(kun): 90 kundan oshgan mantiqiy o'chirilgan (deleted = true) qatorlarni serverdan HAQIQATAN o'chiradi
--     (TZ-sinxronlash.md 6-band 4). Boshqa qatorlar bog'langan (qaralmagan) o'chirilgan qatorga tegilmaydi.
--     Uni faqat jadval egasi (pg_cron yoki SQL Editor) chaqira oladi: authenticated va anon ga EXECUTE YO'Q.
--  3) pg_cron mavjud bo'lsa, tozalashni har kuni 03:15 (UTC) ga qo'yadi. Bepul tarifda pg_cron bor; yoqilmagan bo'lsa, xabar chiqadi
--     (README.md, 1-c bo'lim).
-- Qayta ishga tushirish xavfsiz. Bu faylda maxfiy kalit yoki parol yo'q va bo'lmasligi kerak.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Sinxron holati: har jadvalning eng oxirgi updated_at i (faqat chaqiruvchining o'z qatorlari: RLS ishlaydi)
-- ---------------------------------------------------------------------
create or replace function public.sinxron_holati()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'hisoblar',       (select max(updated_at) from public.hisoblar),
    'kategoriyalar',  (select max(updated_at) from public.kategoriyalar),
    'yozuvlar',       (select max(updated_at) from public.yozuvlar),
    'byudjetlar',     (select max(updated_at) from public.byudjetlar),
    'qarzlar',        (select max(updated_at) from public.qarzlar),
    'qarz_tolovlari', (select max(updated_at) from public.qarz_tolovlari)
  )
$$;
comment on function public.sinxron_holati() is 'Kirgan foydalanuvchining jadvallaridagi eng oxirgi o''zgarish vaqtlari (RLS bilan: faqat o''zining qatorlari).';
revoke all on function public.sinxron_holati() from public, anon;
grant execute on function public.sinxron_holati() to authenticated;

-- ---------------------------------------------------------------------
-- 2) 90 kundan oshgan tombstone larni tozalash
--    Tartib: bog'langan (bola) jadvallar oldin. Ota qator (hisob, kategoriya, qarz) faqat unga hech qanday qator
--    (o'chirilgan yoki yo'q) bog'lanmagan bo'lsa o'chiriladi: aks holda tashqi kalit buzilardi.
--    Hamma foydalanuvchining eski tombstone lari o'chadi (bu — xizmat amali), tirik qatorlarga tegilmaydi.
-- ---------------------------------------------------------------------
create or replace function public.tombstone_tozalash(kun integer default 90)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  chegara timestamptz := pg_catalog.now() - pg_catalog.make_interval(days => greatest(kun, 1));
  n integer;
  hisobot jsonb := '{}'::jsonb;
begin
  delete from public.yozuvlar y where y.deleted and y.updated_at < chegara;
  get diagnostics n = row_count; hisobot := hisobot || jsonb_build_object('yozuvlar', n);

  delete from public.byudjetlar b where b.deleted and b.updated_at < chegara;
  get diagnostics n = row_count; hisobot := hisobot || jsonb_build_object('byudjetlar', n);

  delete from public.qarz_tolovlari t where t.deleted and t.updated_at < chegara;
  get diagnostics n = row_count; hisobot := hisobot || jsonb_build_object('qarz_tolovlari', n);

  delete from public.qarzlar q where q.deleted and q.updated_at < chegara
    and not exists (select 1 from public.qarz_tolovlari t where t.user_id = q.user_id and t.qarz_id = q.id);
  get diagnostics n = row_count; hisobot := hisobot || jsonb_build_object('qarzlar', n);

  delete from public.kategoriyalar k where k.deleted and k.updated_at < chegara
    and not exists (select 1 from public.yozuvlar y where y.user_id = k.user_id and y.kategoriya_id = k.id)
    and not exists (select 1 from public.byudjetlar b where b.user_id = k.user_id and b.kategoriya_id = k.id);
  get diagnostics n = row_count; hisobot := hisobot || jsonb_build_object('kategoriyalar', n);

  delete from public.hisoblar h where h.deleted and h.updated_at < chegara
    and not exists (select 1 from public.yozuvlar y where y.user_id = h.user_id and (y.hisob_id = h.id or y.qabul_hisob_id = h.id))
    and not exists (select 1 from public.qarzlar q where q.user_id = h.user_id and q.hisob_id = h.id)
    and not exists (select 1 from public.qarz_tolovlari t where t.user_id = h.user_id and t.hisob_id = h.id);
  get diagnostics n = row_count; hisobot := hisobot || jsonb_build_object('hisoblar', n);

  return hisobot;
end;
$$;
comment on function public.tombstone_tozalash(integer) is 'Berilgan kundan (standart 90) eski mantiqiy o''chirilgan qatorlarni haqiqatan o''chiradi. Faqat jadval egasi (pg_cron).';
revoke all on function public.tombstone_tozalash(integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3) Kunlik jadval (pg_cron). pg_cron yo'q bo'lsa — xabar (xato emas), qolgan qismlar ishlayveradi.
-- ---------------------------------------------------------------------
do $$
begin
  begin
    create extension if not exists pg_cron with schema pg_catalog;
  exception when others then
    raise notice 'pg_cron yoqib bo''lmadi (%). Supabase: Database -> Extensions -> pg_cron ni yoqing va bu faylni qayta ishga tushiring.', sqlerrm;
  end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'chuntak-tombstone-tozalash';
    perform cron.schedule('chuntak-tombstone-tozalash', '15 3 * * *', 'select public.tombstone_tozalash(90)');
    raise notice 'Kunlik tozalash qo''yildi: har kuni 03:15 (UTC), job nomi chuntak-tombstone-tozalash.';
  else
    raise notice 'pg_cron mavjud emas: kunlik tozalash qo''yilmadi. Qo''lda: select public.tombstone_tozalash(90);';
  end if;
end;
$$;

-- Tayyor. Keyingi qadam (ixtiyoriy): supabase/006_sinxron_xizmat_testi.sql
