-- Mahalliy PostgreSQL da Supabase'ni MINIMAL taqlid qilish (faqat sinov uchun!).
-- Bu HAQIQIY Supabase EMAS: faqat rollar (anon, authenticated), auth sxemasi (auth.users, auth.uid())
-- va public sxemasiga kerakli ruxsatlar. Supabase'ning qolgan qismlari (Data API, JWT tekshiruvi, hooklar) yo'q.
-- Supabase'da ishga tushirmang: u yerda bularning hammasi tayyor.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
end $$;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key,
  email text,
  aud text,
  role text,
  created_at timestamptz default now()
);

-- Supabase'dagi auth.uid() ga o'xshash: JWT dagi "sub" ni o'qiydi
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
