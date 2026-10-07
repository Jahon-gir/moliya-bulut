-- =====================================================================
-- Chuntak AI — Supabase baza sxemasi (S1 bosqichi)
-- Fayl: supabase/001_sxema.sql
--
-- Nima qiladi: 7 ta jadval, ularning ruxsatlari (GRANT), qator darajasidagi himoya (RLS),
-- serverdagi triggerlar (user_id, created_at, updated_at) va indekslarni yaratadi.
-- Qayerda ishga tushiriladi: Supabase → SQL Editor (README.md ga qarang).
-- Qayta ishga tushirish xavfsiz: mavjud ma'lumotga tegmaydi (jadvallar "if not exists").
-- Bu faylda maxfiy kalit yoki parol yo'q va bo'lmasligi kerak.
--
-- Loyiha sozlamalari: Data API yoqilgan, "Automatically expose new tables" O'CHIRILGAN,
-- shuning uchun har jadvalga ruxsat quyida aniq beriladi: FAQAT `authenticated` roliga,
-- `anon` roliga (kirmagan foydalanuvchi) HECH NARSA berilmaydi.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Trigger funksiyasi: user_id, created_at va updated_at ni SERVERDA belgilaydi
--    (ilovadan kelgan qiymatga ishonilmaydi).
-- ---------------------------------------------------------------------
create or replace function public.chuntak_qatorni_belgilash()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  kim uuid := auth.uid();                          -- so'rovni yuborgan (kirgan) foydalanuvchi
  t   timestamptz := pg_catalog.clock_timestamp(); -- server vaqti (qurilma soatiga ishonilmaydi)
begin
  if tg_op = 'INSERT' then
    if kim is null then
      raise exception 'Kirmagan foydalanuvchi qator qo''sha olmaydi' using errcode = '42501';
    end if;
    -- Ilova user_id yuborsa ham, u faqat o'zinikiga teng bo'lishi mumkin; boshqasi rad etiladi
    if new.user_id is not null and new.user_id <> kim then
      raise exception 'user_id boshqa foydalanuvchiniki bo''lishi mumkin emas' using errcode = '42501';
    end if;
    new.user_id    := kim;
    new.created_at := t;
    new.updated_at := t;
  else  -- UPDATE
    if new.id is distinct from old.id then
      raise exception 'id ni o''zgartirib bo''lmaydi' using errcode = '42501';
    end if;
    if new.user_id is distinct from old.user_id then
      raise exception 'user_id ni o''zgartirib bo''lmaydi' using errcode = '42501';
    end if;
    if new.created_at is distinct from old.created_at then
      raise exception 'created_at ni o''zgartirib bo''lmaydi' using errcode = '42501';
    end if;
    new.updated_at := t;   -- har o'zgarishda serverda yangilanadi
  end if;
  return new;
end;
$$;

-- Funksiyani faqat trigger chaqiradi; Data API orqali hech kim chaqira olmaydi
revoke all on function public.chuntak_qatorni_belgilash() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2) Jadvallar. Har jadvalda: id (UUID), user_id, created_at, updated_at, deleted.
--    Balans va hisob qoldig'i SAQLANMAYDI (ilovada yozuvlardan hisoblanadi).
--    Summalar butun son (so'm, tiyinsiz): bigint.
--    Bog'liq qatorlar (hisob, kategoriya, qarz) faqat O'ZINING qatorlariga ulanadi:
--    tashqi kalitlar (user_id, id) juftligi bo'yicha.
--    Tashqi kalitlar "deferrable initially deferred": tekshiruv tranzaksiya oxirida bajariladi
--    (sinxronlashda bir so'rov ichida tartib muhim emas; hisobni o'chirishda hammasi birga o'chadi).
-- ---------------------------------------------------------------------

-- Hisoblar (ilovadagi "hisoblar" to'plami)
create table if not exists public.hisoblar (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted             boolean not null default false,
  yaratilgan          timestamptz not null default now(),          -- ilovadagi `yaratilgan` (qurilmada yaratilgan vaqt)
  nom                 text not null check (btrim(nom) <> ''),
  tur                 text not null check (tur in ('karta', 'bank', 'naqd', 'boshqa')),
  belgi               text not null check (belgi <> ''),            -- belgi kaliti (masalan 'karta')
  rang                text not null check (rang <> ''),
  oxirgi4             text not null default '' check (oxirgi4 ~ '^([0-9]{4})?$'),  -- faqat oxirgi 4 raqam; to'liq karta raqami saqlanmaydi
  boshlangich_qoldiq  bigint not null default 0 check (abs(boshlangich_qoldiq) <= 999999999999999),
  arxivlangan         boolean not null default false,
  unique (user_id, id)
);
comment on table public.hisoblar is 'Hisoblar (naqd, karta, bank, boshqa). Joriy qoldiq saqlanmaydi: ilova hisoblaydi.';

-- Kategoriyalar
create table if not exists public.kategoriyalar (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted      boolean not null default false,
  yaratilgan   timestamptz not null default now(),
  nom          text not null check (btrim(nom) <> ''),
  tur          text not null check (tur in ('daromad', 'xarajat')),
  rang         text not null check (rang <> ''),
  belgi        text not null check (belgi <> ''),
  arxivlangan  boolean not null default false,
  unique (user_id, id)
);
comment on table public.kategoriyalar is 'Daromad va xarajat kategoriyalari.';

-- Yozuvlar (daromad, xarajat, o'tkazma)
create table if not exists public.yozuvlar (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted          boolean not null default false,
  yaratilgan       timestamptz not null default now(),
  tur              text not null check (tur in ('daromad', 'xarajat', 'otkazma')),
  summa            bigint not null check (summa > 0 and summa <= 999999999999999),
  sana             date not null,                              -- ilovada 'YYYY-MM-DD'
  vaqt             time(0) not null default '00:00',           -- ilovada 'HH:MM'
  hisob_id         uuid not null,                              -- yozuv qaysi hisobdan (o'tkazmada: qayerdan)
  qabul_hisob_id   uuid,                                       -- faqat o'tkazmada: qayerga
  kategoriya_id    uuid,                                       -- o'tkazmada bo'sh
  izoh             text not null default '',
  unique (user_id, id),
  foreign key (user_id, hisob_id)       references public.hisoblar (user_id, id)       deferrable initially deferred,
  foreign key (user_id, qabul_hisob_id) references public.hisoblar (user_id, id)       deferrable initially deferred,
  foreign key (user_id, kategoriya_id)  references public.kategoriyalar (user_id, id)  deferrable initially deferred,
  -- TZ.md 7-band: o'tkazmada qabul qiluvchi hisob bor (boshqa hisob), kategoriya yo'q; boshqa turlarda aksincha
  check (
    (tur = 'otkazma' and qabul_hisob_id is not null and kategoriya_id is null and qabul_hisob_id <> hisob_id)
    or (tur <> 'otkazma' and qabul_hisob_id is null and kategoriya_id is not null)
  )
);
comment on table public.yozuvlar is 'Daromad, xarajat va o''tkazma yozuvlari. Summa har doim musbat: yo''nalishni `tur` aytadi.';

-- Byudjetlar (kategoriya_id bo'sh bo'lsa — "umumiy" oylik chegara)
create table if not exists public.byudjetlar (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted        boolean not null default false,
  kategoriya_id  uuid,
  oylik_limit    bigint not null check (oylik_limit > 0 and oylik_limit <= 999999999999999),
  unique (user_id, id),
  foreign key (user_id, kategoriya_id) references public.kategoriyalar (user_id, id) deferrable initially deferred
);
comment on table public.byudjetlar is 'Oylik chegaralar. kategoriya_id bo''sh = umumiy chegara (ilovada "umumiy").';

-- Qarzlar
create table if not exists public.qarzlar (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted     boolean not null default false,
  yaratilgan  timestamptz not null default now(),
  yonalish    text not null check (yonalish in ('berdim', 'oldim')),
  shaxs       text not null check (btrim(shaxs) <> ''),
  summa       bigint not null check (summa > 0 and summa <= 999999999999999),
  hisob_id    uuid not null,
  sana        date not null,
  vaqt        time(0) not null default '00:00',
  muddat      date,                                            -- ilovada '' (bo'sh) = bu yerda NULL
  izoh        text not null default '',
  yopilgan    boolean not null default false,                  -- ilovadagi `yopilgan` belgisi (to'lovlardan hisoblanadi, ilova yangilab turadi)
  unique (user_id, id),
  foreign key (user_id, hisob_id) references public.hisoblar (user_id, id) deferrable initially deferred
);
comment on table public.qarzlar is 'Qarzlar (berdim / oldim). To''lovlari qarz_tolovlari jadvalida.';

-- Qarz to'lovlari (ilovada qarzning ichidagi `tolovlar` ro'yxati; serverda alohida jadval)
create table if not exists public.qarz_tolovlari (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted     boolean not null default false,
  qarz_id     uuid not null,
  sana        date not null,
  vaqt        time(0) not null default '00:00',
  summa       bigint not null check (summa > 0 and summa <= 999999999999999),
  hisob_id    uuid not null,
  unique (user_id, id),
  foreign key (user_id, qarz_id)  references public.qarzlar (user_id, id)  deferrable initially deferred,
  foreign key (user_id, hisob_id) references public.hisoblar (user_id, id) deferrable initially deferred
);
comment on table public.qarz_tolovlari is 'Qarz to''lovlari (qarzning ichidagi `tolovlar` ro''yxati).';

-- Sozlamalar (ilovadagi `asosiy` yozuvi; har foydalanuvchiga bitta qator).
-- PIN-kod xeshi BU YERGA YOZILMAYDI: PIN faqat qurilmada qoladi.
create table if not exists public.sozlamalar (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  deleted                  boolean not null default false,
  sxema_versiyasi          integer not null check (sxema_versiyasi >= 1),
  oxirgi_zaxira_sanasi     date,
  balans_yashirin          boolean not null default false,
  tema                     text not null default 'qurilma' check (tema in ('qurilma', 'yorug', 'qorongi')),
  unique (user_id)                                             -- har foydalanuvchiga bitta sozlama qatori
);
comment on table public.sozlamalar is 'Foydalanuvchi sozlamalari (bitta qator). PIN-kod bu yerda saqlanmaydi.';

-- ---------------------------------------------------------------------
-- 3) Indekslar: sinxronlash so'rovlari (user_id + updated_at) va tashqi kalitlar uchun
-- ---------------------------------------------------------------------
create index if not exists hisoblar_user_updated        on public.hisoblar        (user_id, updated_at);
create index if not exists kategoriyalar_user_updated   on public.kategoriyalar   (user_id, updated_at);
create index if not exists yozuvlar_user_updated        on public.yozuvlar        (user_id, updated_at);
create index if not exists byudjetlar_user_updated      on public.byudjetlar      (user_id, updated_at);
create index if not exists qarzlar_user_updated         on public.qarzlar         (user_id, updated_at);
create index if not exists qarz_tolovlari_user_updated  on public.qarz_tolovlari (user_id, updated_at);
create index if not exists sozlamalar_user_updated      on public.sozlamalar      (user_id, updated_at);

create index if not exists yozuvlar_hisob       on public.yozuvlar (user_id, hisob_id);
create index if not exists yozuvlar_qabul_hisob on public.yozuvlar (user_id, qabul_hisob_id) where qabul_hisob_id is not null;
create index if not exists yozuvlar_kategoriya  on public.yozuvlar (user_id, kategoriya_id)  where kategoriya_id is not null;
create index if not exists byudjetlar_kategoriya on public.byudjetlar (user_id, kategoriya_id) where kategoriya_id is not null;
create index if not exists qarzlar_hisob        on public.qarzlar (user_id, hisob_id);
create index if not exists qarz_tolovlari_qarz  on public.qarz_tolovlari (user_id, qarz_id);
create index if not exists qarz_tolovlari_hisob on public.qarz_tolovlari (user_id, hisob_id);

-- ---------------------------------------------------------------------
-- 4) Triggerlar, RLS, ruxsatlar va siyosatlar (har jadval uchun bir xil)
-- ---------------------------------------------------------------------
do $$
declare
  j text;
begin
  foreach j in array array['hisoblar', 'kategoriyalar', 'yozuvlar', 'byudjetlar', 'qarzlar', 'qarz_tolovlari', 'sozlamalar'] loop

    -- Server triggeri: user_id, created_at, updated_at
    execute format('drop trigger if exists chuntak_belgilash on public.%I', j);
    execute format('create trigger chuntak_belgilash before insert or update on public.%I
                    for each row execute function public.chuntak_qatorni_belgilash()', j);

    -- Qator darajasidagi himoya (RLS) yoqiladi (jadval egasi uchun ham majburiy)
    execute format('alter table public.%I enable row level security', j);
    execute format('alter table public.%I force row level security', j);

    -- Ruxsatlar: anon — hech narsa; authenticated — faqat shu 4 amal
    execute format('revoke all on table public.%I from public, anon, authenticated', j);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', j);

    -- Siyosatlar: har kim faqat o'z qatorlari (user_id = auth.uid()) bilan ishlaydi.
    -- Qo'shish va o'zgartirishda WITH CHECK ham bor.
    execute format('drop policy if exists %I on public.%I', j || '_egasi_select', j);
    execute format('create policy %I on public.%I for select to authenticated
                    using (user_id = (select auth.uid()))', j || '_egasi_select', j);

    execute format('drop policy if exists %I on public.%I', j || '_egasi_insert', j);
    execute format('create policy %I on public.%I for insert to authenticated
                    with check (user_id = (select auth.uid()))', j || '_egasi_insert', j);

    execute format('drop policy if exists %I on public.%I', j || '_egasi_update', j);
    execute format('create policy %I on public.%I for update to authenticated
                    using (user_id = (select auth.uid()))
                    with check (user_id = (select auth.uid()))', j || '_egasi_update', j);

    execute format('drop policy if exists %I on public.%I', j || '_egasi_delete', j);
    execute format('create policy %I on public.%I for delete to authenticated
                    using (user_id = (select auth.uid()))', j || '_egasi_delete', j);
  end loop;
end;
$$;

-- Tayyor. Keyingi qadam: supabase/002_xavfsizlik_testi.sql ni ishga tushirib tekshiring.
