-- =====================================================================
-- FAQAT MAHALLIY (dasturchi uchun): 016_eslatma_kroni.sql ni pg_cron va pg_net TAQLIDI bilan tekshiradi. Supabase'da ishga tushirmang.
-- Sababi: haqiqiy pg_cron va pg_net mahalliy PostgreSQL'da yo'q, shuning uchun 016 dagi "create extension" qatorlari olib tashlanib,
-- o'rniga cron.job, cron.schedule, cron.unschedule va net.http_post TAQLIDLARI yaratiladi. Haqiqiy cron ishlashi va haqiqiy HTTP chaqiruvi
-- SINALMAYDI (faqat Supabase'da ko'riladi: supabase/README.md 10-bo'lim). Ishga tushirish: bash supabase/mahalliy_sinov.sh
-- (u placeholder'lari uydirma qiymatga almashtirilgan vaqtinchalik nusxani :kron_fayl sifatida beradi).
-- =====================================================================
drop schema if exists cron cascade; drop schema if exists net cascade;
create schema cron; create schema net;
create table cron.job (jobid bigserial primary key, jobname text unique, schedule text not null, command text not null, active boolean not null default true);
create function cron.schedule(job_name text, schedule text, command text) returns bigint language sql as
  $$ insert into cron.job (jobname, schedule, command) values (job_name, schedule, command) returning jobid $$;   -- bir nom ikki marta bo'lsa unique xatosi (haqiqiy pg_cron yangilaydi; taqlid qat'iyroq)
create function cron.unschedule(job_name text) returns boolean language plpgsql as $$ begin delete from cron.job where jobname = job_name; return found; end $$;
create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds integer default 5000) returns bigint language sql as $$ select 1::bigint $$;

\i :kron_fayl
\i :kron_fayl

do $t$
declare n integer; j record;
begin
  select count(*) into n from cron.job;
  if n <> 1 then raise exception 'O''TMADI: ikki marta ishga tushirilgach % ta topshiriq (1 bo''lishi kerak)', n; end if;
  select * into j from cron.job;
  if j.jobname <> 'eslatma-yuborish' or j.schedule <> '*/5 * * * *' or not j.active then raise exception 'O''TMADI: nom/jadval/faollik: % % %', j.jobname, j.schedule, j.active; end if;
  if j.command not like '%https://sinov.invalid/functions/v1/eslatma-yuborish%' then raise exception 'O''TMADI: manzil buyruqda yo''q'; end if;
  if j.command not like '%''x-kron-sirri'', ''sinov-sir-0123456789abcdef''%' then raise exception 'O''TMADI: x-kron-sirri sarlavhasi buyruqda yo''q'; end if;
  if j.command like '%<<%' then raise exception 'O''TMADI: o''rinbosar qolgan'; end if;
  if j.command not like '%net.http_post(%' or j.command not like '%timeout_milliseconds := 20000%' then raise exception 'O''TMADI: net.http_post chaqiruvi'; end if;
  raise notice 'O''TDI: 016 ikki marta ishga tushirildi, bitta topshiriq (eslatma-yuborish, */5 * * * *), manzil va sarlavha buyruqda; buyruq net.http_post chaqiradi';
end $t$;
