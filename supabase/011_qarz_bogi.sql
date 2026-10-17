-- =====================================================================
-- Chuntak AI — yozuvni qarzga bog'lash (qarz komissiyasi, ilova 0.45.0)
-- Fayl: supabase/011_qarz_bogi.sql
--
-- Nima qiladi:
--  1) public.yozuvlar ga ixtiyoriy ustun `qarz_bog_id` (uuid, bo'sh bo'lishi mumkin): qarz komissiyasi yozuvida shu komissiya tegishli qarzning id si.
--     Eski qatorlarda NULL, ular o'zgarmaydi.
--  2) Tashqi kalit (user_id, qarz_bog_id) -> qarzlar (user_id, id): bog'lanish faqat O'Z egasining qarziga ishora qila oladi. Boshqa tashqi kalitlar kabi
--     "deferrable initially deferred": tekshiruv tranzaksiya oxirida (trigger emas: u har qatorda darhol ishlab, tartibni buzardi). Qarz va komissiya
--     alohida so'rovlarda kelsa, ilova qarzni komissiyadan OLDIN yuboradi.
--     (009 dagi `bog_id` yozuvga ishora qiladi va qarzga ishora qila olmaydi, shuning uchun alohida ustun kerak bo'ldi.)
--  3) CHECK: yozuv bir vaqtda ham o'tkazmaga (bog_id), ham qarzga (qarz_bog_id) bog'lanmasin.
--  4) Indeks (user_id, qarz_bog_id).
--  5) tombstone_tozalash() yangilanadi (009 dagisi o'rniga): unga ishora qiluvchi komissiya yozuvi hali bor ekan, o'chirilgan qarz o'chirilmaydi
--     (aks holda kunlik tozalash tashqi kalit xatosi bilan to'xtardi); avval bog'langan yozuvlar tozalanadi.
-- RLS, ruxsatlar (GRANT) va triggerlar O'ZGARMAYDI. Eski ilova versiyasi bu ustunni yubormaydi (PostgREST faqat yuborilgan ustunlarni yangilaydi),
-- shuning uchun serverdagi qarz_bog_id ni o'chira olmaydi.
-- Qayerda ishga tushiriladi: Supabase -> SQL Editor. Qayta ishga tushirish xavfsiz. 001, 005 va 009 oldin ishga tushirilgan bo'lishi kerak.
-- Bu faylda maxfiy kalit yoki parol yo'q va bo'lmasligi kerak.
-- =====================================================================

alter table public.yozuvlar add column if not exists qarz_bog_id uuid;
comment on column public.yozuvlar.qarz_bog_id is 'Bog''langan qarz (o''zining egasi qatori): qarz komissiyasi yozuvida — qarzning id si. Bo''sh bo''lishi mumkin.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'yozuvlar_qarz_bog_fk' and conrelid = 'public.yozuvlar'::regclass) then
    alter table public.yozuvlar
      add constraint yozuvlar_qarz_bog_fk foreign key (user_id, qarz_bog_id) references public.qarzlar (user_id, id) deferrable initially deferred;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'yozuvlar_bog_bitta' and conrelid = 'public.yozuvlar'::regclass) then
    alter table public.yozuvlar
      add constraint yozuvlar_bog_bitta check (bog_id is null or qarz_bog_id is null);
  end if;
end;
$$;

create index if not exists yozuvlar_qarz_bog on public.yozuvlar (user_id, qarz_bog_id) where qarz_bog_id is not null;

-- ---------------------------------------------------------------------
-- 90 kundan oshgan tombstone larni tozalash (009 dagining yangilangani: yozuvlar va qarzlar qismi o'zgargan)
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
  -- Yozuvlar: avval bog'langan (bola) qatorlar (o'tkazma va qarz komissiyasi), keyin ota qatorlar; ota qator, unga ishora qiluvchi qator qolgan bo'lsa, qoladi
  delete from public.yozuvlar y where y.deleted and y.updated_at < chegara and (y.bog_id is not null or y.qarz_bog_id is not null);
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
    and not exists (select 1 from public.qarz_tolovlari t where t.user_id = q.user_id and t.qarz_id = q.id)
    and not exists (select 1 from public.yozuvlar y where y.user_id = q.user_id and y.qarz_bog_id = q.id);
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
comment on function public.tombstone_tozalash(integer) is 'Berilgan kundan (standart 90) eski mantiqiy o''chirilgan qatorlarni haqiqatan o''chiradi (bog''langan yozuvlar tartibi bilan). Faqat jadval egasi (pg_cron).';

-- Tayyor. Keyingi qadam: supabase/012_qarz_bogi_testi.sql
