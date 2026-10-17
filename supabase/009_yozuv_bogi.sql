-- =====================================================================
-- Chuntak AI — yozuvni boshqa yozuvga bog'lash (o'tkazma komissiyasi, ilova 0.44.0)
-- Fayl: supabase/009_yozuv_bogi.sql
--
-- Nima qiladi:
--  1) public.yozuvlar ga ixtiyoriy ustun `bog_id` (uuid, bo'sh bo'lishi mumkin) qo'shadi: komissiya yozuvida shu komissiya
--     tegishli o'tkazmaning id si turadi. Eski qatorlarda u NULL, ular o'zgarmaydi.
--  2) Tashqi kalit (user_id, bog_id) -> yozuvlar (user_id, id): bog'lanish faqat o'z egasining qatoriga ishora qila oladi
--     (boshqa foydalanuvchi qatoriga bog'lab bo'lmaydi). Boshqa tashqi kalitlar kabi "deferrable initially deferred":
--     tekshiruv tranzaksiya oxirida, shuning uchun sinxronlashda bir so'rov ichida o'tkazma va komissiya istalgan tartibda kela oladi
--     (so'rovlar o'rtasida ilova o'tkazmani komissiyadan OLDIN yuboradi). Trigger YO'Q: u har qatorda darhol ishlab, tartibni buzardi.
--  3) CHECK: yozuv o'ziga ishora qilmasin (bog_id <> id).
--  4) Indeks (user_id, bog_id).
--  5) tombstone_tozalash() yangilanadi (005 dagisi o'rniga): bog'langan o'tkazma, unga ishora qiluvchi qator hali bor ekan, o'chirilmaydi —
--     aks holda kunlik tozalash tashqi kalit xatosi bilan butunlay to'xtardi. Avval bog'langan (bola) qatorlar, keyin ota qatorlar tozalanadi.
-- RLS, ruxsatlar (GRANT) va triggerlar O'ZGARMAYDI (001 dagi `chuntak_belgilash` yangi ustun bilan ham ishlayveradi).
-- Eski ilova versiyasi bu ustunni umuman yubormaydi (PostgREST faqat yuborilgan ustunlarni yangilaydi), shuning uchun u serverdagi bog_id ni o'chira olmaydi.
-- Qayerda ishga tushiriladi: Supabase -> SQL Editor. Qayta ishga tushirish xavfsiz. 001 va 005 oldin ishga tushirilgan bo'lishi kerak.
-- Bu faylda maxfiy kalit yoki parol yo'q va bo'lmasligi kerak.
-- =====================================================================

alter table public.yozuvlar add column if not exists bog_id uuid;
comment on column public.yozuvlar.bog_id is 'Bog''langan yozuv (o''zining egasi qatori): komissiya yozuvida — o''tkazmaning id si. Bo''sh bo''lishi mumkin.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'yozuvlar_bog_fk' and conrelid = 'public.yozuvlar'::regclass) then
    alter table public.yozuvlar
      add constraint yozuvlar_bog_fk foreign key (user_id, bog_id) references public.yozuvlar (user_id, id) deferrable initially deferred;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'yozuvlar_bog_oziga_emas' and conrelid = 'public.yozuvlar'::regclass) then
    alter table public.yozuvlar
      add constraint yozuvlar_bog_oziga_emas check (bog_id is null or bog_id <> id);
  end if;
end;
$$;

create index if not exists yozuvlar_bog on public.yozuvlar (user_id, bog_id) where bog_id is not null;

-- ---------------------------------------------------------------------
-- 90 kundan oshgan tombstone larni tozalash (005 dagining yangilangani: faqat yozuvlar qismi o'zgargan)
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
  yozuv_soni integer := 0;
  hisobot jsonb := '{}'::jsonb;
begin
  -- Yozuvlar: avval bog'langan (bola) qatorlar (komissiya), keyin ota qatorlar; ota qator, unga ishora qiluvchi qator qolgan bo'lsa, qoladi
  delete from public.yozuvlar y where y.deleted and y.updated_at < chegara and y.bog_id is not null;
  get diagnostics n = row_count; yozuv_soni := yozuv_soni + n;
  delete from public.yozuvlar y where y.deleted and y.updated_at < chegara
    and not exists (select 1 from public.yozuvlar c where c.user_id = y.user_id and c.bog_id = y.id);
  get diagnostics n = row_count; yozuv_soni := yozuv_soni + n;
  hisobot := hisobot || jsonb_build_object('yozuvlar', yozuv_soni);

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
comment on function public.tombstone_tozalash(integer) is 'Berilgan kundan (standart 90) eski mantiqiy o''chirilgan qatorlarni haqiqatan o''chiradi (bog''langan yozuvlar tartibi bilan). Faqat jadval egasi (pg_cron).';
revoke all on function public.tombstone_tozalash(integer) from public, anon, authenticated;

-- Tayyor. Keyingi qadam: supabase/010_yozuv_bogi_testi.sql
