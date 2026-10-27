-- =====================================================================
-- Chuntak AI — bildirishnoma asosi (Web Push), 0.49.0 (TZ-sinxronlash.md 46-band)
-- Fayl: supabase/013_bildirishnoma.sql
--
-- Nima qiladi: yangi jadval `bildirishnoma_qurilmalari` — har qator bitta qurilmaning (brauzerning) push obunasi va
-- eslatma sozlamasi. Ilova uni to'g'ridan-to'g'ri PostgREST orqali yozadi (upsert on_conflict=user_id,endpoint).
-- Mavjud jadvallarga va funksiyalarga tegilmaydi.
--
-- MUHIM: bu jadval SINXRON TIZIMIDA EMAS. Unda `deleted` (tombstone) ustuni yo'q, ilova outbox'i, tortib olish, eksport, zaxira va
-- sinxron_holati unga tegmaydi: u qurilmaga xos (har telefon o'z obunasi), qator HAQIQATAN o'chiriladi. tombstone_tozalash() ga ehtiyoj yo'q.
--
-- Data API ruxsati (Supabase 30-oktabrdan yangi jadvallarga avtomatik BERMAYDI): shu faylda ANIQ yozilgan —
--   authenticated: select, insert, update, delete;  anon: hech narsa (revoke).
--
-- Xavfsizlik:
--  - RLS yoqilgan va majburiy; egasi faqat o'z qatorlarini ko'radi, yozadi, o'chiradi (user_id = auth.uid()).
--  - user_id serverda auth.uid() ga majburlanadi (trigger), id/user_id/created_at keyin o'zgarmaydi.
--  - tz — haqiqiy IANA nomi (pg_timezone_names), vaqtlar 00:00–23:59 (soniyasiz), qarz_kunlar faqat 0/1/3 (takrorsiz, tartiblangan),
--    endpoint https:// bilan boshlanadi va 2048 belgidan oshmaydi.
--  - Bir endpoint = bitta brauzer obunasi = bitta egasi: boshqa akkaunt shu endpoint bilan yozsa, ESKI egasining qatori o'chiriladi
--    (obuna "yangi egaga qayta yoziladi"; eski akkaunt eslatmasi boshqa odam telefoniga bormaydi).
--  - Hisobni o'chirish (003): auth.users dagi yozuv o'chirilganda bu jadvaldagi qatorlar `on delete cascade` bilan o'chadi (003 ni o'zgartirish shart emas).
-- Qayerda ishga tushiriladi: Supabase → SQL Editor. Qayta ishga tushirish xavfsiz. Maxfiy kalit yoki parol bu faylda yo'q va bo'lmasligi kerak.
-- =====================================================================

create table if not exists public.bildirishnoma_qurilmalari (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  endpoint      text not null,
  p256dh        text not null,
  auth_kaliti   text not null,
  tz            text not null,                                  -- IANA nomi, masalan Asia/Tashkent
  kunlik_yoqiq  boolean not null default false,
  kunlik_vaqt   time not null default '21:00',
  qarz_yoqiq    boolean not null default false,
  qarz_kunlar   integer[] not null default '{0,1}',             -- muddatdan necha kun oldin: 0 (muddat kuni), 1, 3
  qarz_vaqt     time not null default '09:00',
  korsatish     boolean not null default true,                  -- bildirishnomada ism va summani ko'rsatish
  oxirgi_sinov  timestamptz,                                    -- "Sinab ko'rish" tezlik chegarasi uchun
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint bildirishnoma_unikal unique (user_id, endpoint),
  constraint bildirishnoma_endpoint_chk check (endpoint like 'https://%' and char_length(endpoint) between 12 and 2048),
  constraint bildirishnoma_p256dh_chk check (char_length(p256dh) between 1 and 200),
  constraint bildirishnoma_auth_chk check (char_length(auth_kaliti) between 1 and 100),
  constraint bildirishnoma_tz_chk check (char_length(tz) between 1 and 64),
  constraint bildirishnoma_kunlik_vaqt_chk check (kunlik_vaqt >= time '00:00' and kunlik_vaqt < time '24:00' and extract(second from kunlik_vaqt) = 0),
  constraint bildirishnoma_qarz_vaqt_chk check (qarz_vaqt >= time '00:00' and qarz_vaqt < time '24:00' and extract(second from qarz_vaqt) = 0),
  constraint bildirishnoma_qarz_kunlar_chk check (qarz_kunlar <@ array[0, 1, 3] and cardinality(qarz_kunlar) <= 3)
);
comment on table public.bildirishnoma_qurilmalari is 'Qurilmaning Web Push obunasi va eslatma sozlamasi. Sinxron tizimida emas: deleted yo''q, qator haqiqatan o''chiriladi.';

create index if not exists bildirishnoma_endpoint_idx on public.bildirishnoma_qurilmalari (endpoint);

-- ---------------------------------------------------------------------
-- Trigger 1 (bildirishnoma_belgilash): user_id, created_at, updated_at serverda; tz tekshiruvi; qarz_kunlar tartiblanadi
-- ---------------------------------------------------------------------
create or replace function public.bildirishnoma_qatorni_belgilash()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  kim uuid := auth.uid();
  t   timestamptz := pg_catalog.clock_timestamp();
begin
  if tg_op = 'INSERT' then
    if kim is null then
      raise exception 'Kirmagan foydalanuvchi qator qo''sha olmaydi' using errcode = '42501';
    end if;
    if new.user_id is not null and new.user_id <> kim then
      raise exception 'user_id boshqa foydalanuvchiniki bo''lishi mumkin emas' using errcode = '42501';
    end if;
    new.user_id    := kim;
    new.created_at := t;
    new.updated_at := t;
  else
    if new.id is distinct from old.id then
      raise exception 'id ni o''zgartirib bo''lmaydi' using errcode = '42501';
    end if;
    if new.user_id is distinct from old.user_id then
      raise exception 'user_id ni o''zgartirib bo''lmaydi' using errcode = '42501';
    end if;
    if new.created_at is distinct from old.created_at then
      raise exception 'created_at ni o''zgartirib bo''lmaydi' using errcode = '42501';
    end if;
    new.updated_at := t;
  end if;

  -- IANA vaqt zonasi haqiqatan borligi (CHECK ichida so'rov yozib bo'lmaydi, shuning uchun shu yerda)
  if not exists (select 1 from pg_catalog.pg_timezone_names n where n.name = new.tz) then
    raise exception 'tz noto''g''ri IANA nomi: %', new.tz using errcode = '23514';
  end if;

  -- qarz_kunlar: bo'sh elementli massiv rad etiladi (CHECK ham tutadi), takrorlar olib tashlanadi, tartiblanadi
  if new.qarz_kunlar is not null and new.qarz_kunlar <@ array[0, 1, 3] then
    new.qarz_kunlar := coalesce((select pg_catalog.array_agg(distinct x order by x) from pg_catalog.unnest(new.qarz_kunlar) as x), '{}'::integer[]);
  end if;
  return new;
end;
$$;
revoke all on function public.bildirishnoma_qatorni_belgilash() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Trigger 2 (bildirishnoma_yangi_ega): shu endpoint boshqa akkauntda qolgan bo'lsa, o'sha qator o'chiriladi.
-- SECURITY DEFINER: foydalanuvchi boshqa odam qatorini o'chira olmaydi, lekin shu endpoint ESKI egadan yangi egaga o'tadi.
-- Nomi alifbo bo'yicha birinchi triggerdan KEYIN turadi (user_id allaqachon belgilangan bo'ladi).
-- ---------------------------------------------------------------------
create or replace function public.bildirishnoma_yangi_ega()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  delete from public.bildirishnoma_qurilmalari where endpoint = new.endpoint and user_id <> new.user_id;
  return new;
end;
$$;
revoke all on function public.bildirishnoma_yangi_ega() from public, anon, authenticated;

drop trigger if exists bildirishnoma_belgilash on public.bildirishnoma_qurilmalari;
create trigger bildirishnoma_belgilash before insert or update on public.bildirishnoma_qurilmalari
  for each row execute function public.bildirishnoma_qatorni_belgilash();

drop trigger if exists bildirishnoma_yangi_ega on public.bildirishnoma_qurilmalari;
create trigger bildirishnoma_yangi_ega before insert or update of endpoint on public.bildirishnoma_qurilmalari
  for each row execute function public.bildirishnoma_yangi_ega();

-- ---------------------------------------------------------------------
-- RLS va ruxsatlar (Data API uchun ANIQ grant — Supabase yangi jadvalga o'zi bermaydi)
-- ---------------------------------------------------------------------
alter table public.bildirishnoma_qurilmalari enable row level security;
alter table public.bildirishnoma_qurilmalari force row level security;

revoke all on table public.bildirishnoma_qurilmalari from public, anon, authenticated;
grant select, insert, update, delete on table public.bildirishnoma_qurilmalari to authenticated;

drop policy if exists bildirishnoma_egasi_select on public.bildirishnoma_qurilmalari;
create policy bildirishnoma_egasi_select on public.bildirishnoma_qurilmalari for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists bildirishnoma_egasi_insert on public.bildirishnoma_qurilmalari;
create policy bildirishnoma_egasi_insert on public.bildirishnoma_qurilmalari for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists bildirishnoma_egasi_update on public.bildirishnoma_qurilmalari;
create policy bildirishnoma_egasi_update on public.bildirishnoma_qurilmalari for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists bildirishnoma_egasi_delete on public.bildirishnoma_qurilmalari;
create policy bildirishnoma_egasi_delete on public.bildirishnoma_qurilmalari for delete to authenticated
  using (user_id = (select auth.uid()));

-- Tayyor. Keyingi qadam: supabase/014_bildirishnoma_testi.sql ni ishga tushirib tekshiring.
