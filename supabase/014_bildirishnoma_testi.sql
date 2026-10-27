-- =====================================================================
-- Chuntak AI — bildirishnoma jadvalini tekshirish (ilova 0.49.0, TZ-sinxronlash.md 46-band)
-- Fayl: supabase/014_bildirishnoma_testi.sql
-- Tekshiradi: jadval tuzilishi (sinxron ustuni `deleted` yo'q); RLS; GRANT (authenticated ga 4 amal, anon ga HECH NARSA); egasi siyosatlari
-- (A ning qatorini B ko'ra/o'zgartira/o'chira olmaydi); user_id serverda majburlanishi; anon rad etilishi; unique (user_id, endpoint) va upsert;
-- cheklovlar (endpoint, tz, vaqt, qarz_kunlar); endpoint yangi egaga o'tishi; auth.users o'chirilganda cascade; hisobni o'chirish funksiyasi (003);
-- tombstone_tozalash() ga tegmasligi.
-- Sinov HECH NARSANI SAQLAMAYDI (oxirida ROLLBACK). Oldin 001, 003, 005 va 013 ishga tushirilgan bo'lishi kerak.
-- =====================================================================
create or replace function pg_temp.qo(a text[], nom text, ok boolean)
returns text[] language sql as $$
  select a || ((case when ok is true then 'O''TDI' else 'O''TMADI' end) || E'\t' || nom)
$$;

-- Kimdir sifatida kirish (JWT da'volari) — Supabase'ning auth.uid() ishlashi uchun
create or replace function pg_temp.kirish(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u::text, true);
end $$;

create or replace function pg_temp.bildirishnoma_sinovi()
returns table (raqam integer, tekshiruv text, natija text)
language plpgsql
as $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); uc uuid := gen_random_uuid();
  ra uuid := gen_random_uuid(); rb uuid := gen_random_uuid();
  ea text := 'https://push.example.invalid/a/' || gen_random_uuid();
  eb text := 'https://push.example.invalid/b/' || gen_random_uuid();
  ec text := 'https://push.example.invalid/c/' || gen_random_uuid();
  n integer; m integer; ok boolean; k integer[]; x uuid; r jsonb;
  l text[] := '{}';
begin
  begin
    set constraints all immediate;
    insert into auth.users (id, email) values (ua, 'a-bild@chuntak.invalid'), (ub, 'b-bild@chuntak.invalid'), (uc, 'c-bild@chuntak.invalid');

    -- ============ 1) Tuzilish ============
    l := pg_temp.qo(l, 'Jadval bor, RLS yoqilgan va majburiy', (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.bildirishnoma_qurilmalari'::regclass));
    select count(*) into n from information_schema.columns where table_schema = 'public' and table_name = 'bildirishnoma_qurilmalari'
      and column_name in ('id', 'user_id', 'endpoint', 'p256dh', 'auth_kaliti', 'tz', 'kunlik_yoqiq', 'kunlik_vaqt', 'qarz_yoqiq', 'qarz_kunlar', 'qarz_vaqt', 'korsatish', 'oxirgi_sinov', 'created_at', 'updated_at');
    l := pg_temp.qo(l, 'Hamma 15 ustun bor', n = 15);
    select count(*) into n from information_schema.columns where table_schema = 'public' and table_name = 'bildirishnoma_qurilmalari' and column_name = 'deleted';
    l := pg_temp.qo(l, 'SINXRON TIZIMIDA EMAS: `deleted` ustuni yo''q', n = 0);
    l := pg_temp.qo(l, 'user_id: auth.users ga bog''langan, on delete cascade', exists (
      select 1 from pg_constraint where conrelid = 'public.bildirishnoma_qurilmalari'::regclass and contype = 'f' and confrelid = 'auth.users'::regclass and confdeltype = 'c'));
    l := pg_temp.qo(l, 'unique (user_id, endpoint) bor', exists (
      select 1 from pg_constraint where conrelid = 'public.bildirishnoma_qurilmalari'::regclass and conname = 'bildirishnoma_unikal' and contype = 'u'));

    -- ============ 2) GRANT (Data API) ============
    l := pg_temp.qo(l, 'authenticated: select, insert, update, delete BOR', has_table_privilege('authenticated', 'public.bildirishnoma_qurilmalari', 'select')
      and has_table_privilege('authenticated', 'public.bildirishnoma_qurilmalari', 'insert') and has_table_privilege('authenticated', 'public.bildirishnoma_qurilmalari', 'update')
      and has_table_privilege('authenticated', 'public.bildirishnoma_qurilmalari', 'delete'));
    l := pg_temp.qo(l, 'authenticated: truncate, references, trigger YO''Q', not has_table_privilege('authenticated', 'public.bildirishnoma_qurilmalari', 'truncate')
      and not has_table_privilege('authenticated', 'public.bildirishnoma_qurilmalari', 'references') and not has_table_privilege('authenticated', 'public.bildirishnoma_qurilmalari', 'trigger'));
    l := pg_temp.qo(l, 'anon: HECH QANDAY huquq yo''q (select, insert, update, delete, truncate, references, trigger)', not exists (
      select 1 from unnest(array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']) p where has_table_privilege('anon', 'public.bildirishnoma_qurilmalari', p)));
    select count(*) into n from pg_class c, aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a where c.oid = 'public.bildirishnoma_qurilmalari'::regclass and a.grantee = 0;
    l := pg_temp.qo(l, 'PUBLIC (hamma) ga hech narsa berilmagan', n = 0);
    select count(*) into n from pg_policies where schemaname = 'public' and tablename = 'bildirishnoma_qurilmalari' and roles = '{authenticated}';
    l := pg_temp.qo(l, '4 ta egasi siyosati bor (select, insert, update, delete), hammasi faqat authenticated uchun', n = 4
      and (select count(distinct cmd) from pg_policies where schemaname = 'public' and tablename = 'bildirishnoma_qurilmalari') = 4);
    l := pg_temp.qo(l, 'Trigger funksiyalariga authenticated va anon EXECUTE qila olmaydi', not has_function_privilege('authenticated', 'public.bildirishnoma_qatorni_belgilash()', 'execute')
      and not has_function_privilege('anon', 'public.bildirishnoma_qatorni_belgilash()', 'execute') and not has_function_privilege('authenticated', 'public.bildirishnoma_yangi_ega()', 'execute')
      and not has_function_privilege('anon', 'public.bildirishnoma_yangi_ega()', 'execute'));

    -- ============ 3) A yozadi: user_id serverda belgilanadi ============
    perform pg_temp.kirish(ua);
    set local role authenticated;
    insert into public.bildirishnoma_qurilmalari (id, endpoint, p256dh, auth_kaliti, tz) values (ra, ea, 'p-a', 'k-a', 'Asia/Tashkent');   -- user_id yuborilmadi
    reset role;
    l := pg_temp.qo(l, 'A qo''shdi: user_id = A (serverda majburlandi), boshlang''ich sozlama: o''chiq, 21:00, 09:00, {0,1}, ko''rsatish yoqiq', exists (
      select 1 from public.bildirishnoma_qurilmalari where id = ra and user_id = ua and not kunlik_yoqiq and kunlik_vaqt = '21:00' and not qarz_yoqiq and qarz_vaqt = '09:00' and qarz_kunlar = '{0,1}' and korsatish and oxirgi_sinov is null));

    perform pg_temp.kirish(ua); set local role authenticated;
    ok := false; begin insert into public.bildirishnoma_qurilmalari (endpoint, p256dh, auth_kaliti, tz, user_id) values ('https://push.example.invalid/x', 'p', 'k', 'Asia/Tashkent', ub); exception when insufficient_privilege then ok := true; when others then ok := false; end;
    reset role;
    l := pg_temp.qo(l, 'A boshqa (B ning) user_id si bilan qo''sha olmaydi', ok);

    perform pg_temp.kirish(ua); set local role authenticated;
    update public.bildirishnoma_qurilmalari set kunlik_yoqiq = true, kunlik_vaqt = '07:45', qarz_yoqiq = true, qarz_kunlar = '{3,1,0}', korsatish = false, oxirgi_sinov = now() where id = ra;
    get diagnostics n = row_count;
    reset role;
    l := pg_temp.qo(l, 'A o''z qatorini yangiladi (egasi); qarz_kunlar {3,1,0} -> {0,1,3} tartiblandi', n = 1 and exists (select 1 from public.bildirishnoma_qurilmalari where id = ra and kunlik_yoqiq and kunlik_vaqt = '07:45' and qarz_kunlar = '{0,1,3}' and not korsatish and oxirgi_sinov is not null));

    -- ============ 4) B A ning qatoriga tega olmaydi ============
    perform pg_temp.kirish(ub); set local role authenticated;
    insert into public.bildirishnoma_qurilmalari (id, endpoint, p256dh, auth_kaliti, tz) values (rb, eb, 'p-b', 'k-b', 'Europe/Moscow');
    select count(*) into n from public.bildirishnoma_qurilmalari;
    select count(*) into m from public.bildirishnoma_qurilmalari where id = ra;
    reset role;
    l := pg_temp.qo(l, 'B faqat o''z qatorini ko''radi (1 ta), A ning qatori ko''rinmaydi', n = 1 and m = 0);

    perform pg_temp.kirish(ub); set local role authenticated;
    update public.bildirishnoma_qurilmalari set kunlik_yoqiq = false, korsatish = true where id = ra;
    get diagnostics n = row_count;
    delete from public.bildirishnoma_qurilmalari where id = ra;
    get diagnostics m = row_count;
    reset role;
    l := pg_temp.qo(l, 'B A ning qatorini o''zgartira olmadi (0) va o''chira olmadi (0), A ning qatori joyida', n = 0 and m = 0 and exists (select 1 from public.bildirishnoma_qurilmalari where id = ra and kunlik_yoqiq and not korsatish));

    perform pg_temp.kirish(ub); set local role authenticated;
    ok := false; begin update public.bildirishnoma_qurilmalari set user_id = ua where id = rb; exception when insufficient_privilege then ok := true; when others then ok := false; end;
    reset role;
    l := pg_temp.qo(l, 'B o''z qatorini A ga o''tkaza olmaydi (user_id o''zgarmaydi)', ok);

    perform pg_temp.kirish(ub); set local role authenticated;
    ok := false; begin update public.bildirishnoma_qurilmalari set id = gen_random_uuid() where id = rb; exception when insufficient_privilege then ok := true; when others then ok := false; end;
    reset role;
    l := pg_temp.qo(l, 'id o''zgartirib bo''lmaydi', ok);

    -- ============ 5) anon va kirmagan ============
    set local role anon;
    ok := false; begin perform count(*) from public.bildirishnoma_qurilmalari; exception when insufficient_privilege then ok := true; when others then ok := false; end;
    reset role;
    l := pg_temp.qo(l, 'anon o''qiy olmaydi (permission denied)', ok);
    set local role anon;
    ok := false; begin insert into public.bildirishnoma_qurilmalari (endpoint, p256dh, auth_kaliti, tz) values ('https://push.example.invalid/anon', 'p', 'k', 'Asia/Tashkent'); exception when insufficient_privilege then ok := true; when others then ok := false; end;
    reset role;
    l := pg_temp.qo(l, 'anon yoza olmaydi', ok);
    set local role anon;
    ok := false; begin delete from public.bildirishnoma_qurilmalari; exception when insufficient_privilege then ok := true; when others then ok := false; end;
    reset role;
    l := pg_temp.qo(l, 'anon o''chira olmaydi', ok);
    perform set_config('request.jwt.claims', '', true); perform set_config('request.jwt.claim.sub', '', true);
    set local role authenticated;
    ok := false; begin insert into public.bildirishnoma_qurilmalari (endpoint, p256dh, auth_kaliti, tz) values ('https://push.example.invalid/nouid', 'p', 'k', 'Asia/Tashkent'); exception when others then ok := true; end;
    select count(*) into n from public.bildirishnoma_qurilmalari;
    reset role;
    l := pg_temp.qo(l, 'Tokensiz (auth.uid() bo''sh) authenticated yoza olmaydi va hech narsa ko''rmaydi', ok and n = 0);

    -- ============ 6) unique va upsert ============
    perform pg_temp.kirish(ua); set local role authenticated;
    ok := false; begin insert into public.bildirishnoma_qurilmalari (endpoint, p256dh, auth_kaliti, tz) values (ea, 'p2', 'k2', 'Asia/Tashkent'); exception when unique_violation then ok := true; when others then ok := false; end;
    reset role;
    l := pg_temp.qo(l, 'Bir akkauntda bir endpoint ikki marta bo''lmaydi (unique)', ok);

    perform pg_temp.kirish(ua); set local role authenticated;
    insert into public.bildirishnoma_qurilmalari (endpoint, p256dh, auth_kaliti, tz, kunlik_yoqiq, kunlik_vaqt, qarz_yoqiq, qarz_kunlar, qarz_vaqt, korsatish)
      values (ea, 'p-yangi', 'k-yangi', 'Asia/Samarkand', true, '20:30', false, '{1}', '10:15', true)
      on conflict (user_id, endpoint) do update set p256dh = excluded.p256dh, auth_kaliti = excluded.auth_kaliti, tz = excluded.tz, kunlik_yoqiq = excluded.kunlik_yoqiq,
        kunlik_vaqt = excluded.kunlik_vaqt, qarz_yoqiq = excluded.qarz_yoqiq, qarz_kunlar = excluded.qarz_kunlar, qarz_vaqt = excluded.qarz_vaqt, korsatish = excluded.korsatish;
    select count(*) into n from public.bildirishnoma_qurilmalari where endpoint = ea;
    reset role;
    l := pg_temp.qo(l, 'Upsert (on_conflict user_id,endpoint): yangi qator emas, mavjud qator yangilandi (id saqlandi)', n = 1 and exists (
      select 1 from public.bildirishnoma_qurilmalari where id = ra and p256dh = 'p-yangi' and tz = 'Asia/Samarkand' and kunlik_vaqt = '20:30' and qarz_kunlar = '{1}' and qarz_vaqt = '10:15' and not qarz_yoqiq));

    -- ============ 7) Cheklovlar ============
    perform pg_temp.kirish(ua); set local role authenticated;
    ok := false; begin insert into public.bildirishnoma_qurilmalari (endpoint, p256dh, auth_kaliti, tz) values ('http://push.example.invalid/h', 'p', 'k', 'Asia/Tashkent'); exception when check_violation then ok := true; when others then ok := false; end;
    l := pg_temp.qo(l, 'endpoint http:// bilan boshlansa rad etiladi (https shart)', ok);
    ok := false; begin insert into public.bildirishnoma_qurilmalari (endpoint, p256dh, auth_kaliti, tz) values ('https://push.example.invalid/' || repeat('x', 2100), 'p', 'k', 'Asia/Tashkent'); exception when check_violation then ok := true; when others then ok := false; end;
    l := pg_temp.qo(l, 'endpoint 2048 belgidan uzun bo''lsa rad etiladi', ok);
    ok := false; begin insert into public.bildirishnoma_qurilmalari (endpoint, p256dh, auth_kaliti, tz) values ('https://push.example.invalid/tz1', 'p', 'k', 'Mars/Olympus'); exception when check_violation then ok := true; when others then ok := false; end;
    l := pg_temp.qo(l, 'tz IANA nomi bo''lmasa rad etiladi', ok);
    ok := false; begin insert into public.bildirishnoma_qurilmalari (endpoint, p256dh, auth_kaliti, tz) values ('https://push.example.invalid/tz2', 'p', 'k', ''); exception when check_violation then ok := true; when others then ok := false; end;
    l := pg_temp.qo(l, 'bo''sh tz rad etiladi', ok);
    ok := false; begin insert into public.bildirishnoma_qurilmalari (endpoint, p256dh, auth_kaliti, tz, kunlik_vaqt) values ('https://push.example.invalid/v1', 'p', 'k', 'Asia/Tashkent', '24:00'); exception when check_violation then ok := true; when others then ok := false; end;
    l := pg_temp.qo(l, 'kunlik_vaqt 24:00 rad etiladi', ok);
    ok := false; begin insert into public.bildirishnoma_qurilmalari (endpoint, p256dh, auth_kaliti, tz, qarz_vaqt) values ('https://push.example.invalid/v2', 'p', 'k', 'Asia/Tashkent', '09:30:15'); exception when check_violation then ok := true; when others then ok := false; end;
    l := pg_temp.qo(l, 'qarz_vaqt soniyali (09:30:15) rad etiladi', ok);
    ok := false; begin insert into public.bildirishnoma_qurilmalari (endpoint, p256dh, auth_kaliti, tz, qarz_kunlar) values ('https://push.example.invalid/q1', 'p', 'k', 'Asia/Tashkent', '{2}'); exception when check_violation then ok := true; when others then ok := false; end;
    l := pg_temp.qo(l, 'qarz_kunlar {2} rad etiladi (faqat 0/1/3)', ok);
    ok := false; begin insert into public.bildirishnoma_qurilmalari (endpoint, p256dh, auth_kaliti, tz, qarz_kunlar) values ('https://push.example.invalid/q2', 'p', 'k', 'Asia/Tashkent', '{0,7}'); exception when check_violation then ok := true; when others then ok := false; end;
    l := pg_temp.qo(l, 'qarz_kunlar {0,7} rad etiladi', ok);
    ok := false; begin insert into public.bildirishnoma_qurilmalari (endpoint, p256dh, auth_kaliti, tz, qarz_kunlar) values ('https://push.example.invalid/q3', 'p', 'k', 'Asia/Tashkent', array[0, null]::integer[]); exception when check_violation then ok := true; when others then ok := false; end;
    l := pg_temp.qo(l, 'qarz_kunlar ichida NULL rad etiladi', ok);
    insert into public.bildirishnoma_qurilmalari (endpoint, p256dh, auth_kaliti, tz, qarz_kunlar) values ('https://push.example.invalid/q4', 'p', 'k', 'Asia/Tashkent', '{1,1,0,0}') returning qarz_kunlar into k;
    l := pg_temp.qo(l, 'qarz_kunlar {1,1,0,0} takrorsiz {0,1} bo''ladi', k = '{0,1}');
    insert into public.bildirishnoma_qurilmalari (endpoint, p256dh, auth_kaliti, tz, qarz_kunlar) values ('https://push.example.invalid/q5', 'p', 'k', 'Asia/Tashkent', '{}') returning qarz_kunlar into k;
    l := pg_temp.qo(l, 'qarz_kunlar bo''sh bo''lishi mumkin', k = '{}');
    insert into public.bildirishnoma_qurilmalari (endpoint, p256dh, auth_kaliti, tz, kunlik_vaqt, qarz_vaqt) values ('https://push.example.invalid/v3', 'p', 'k', 'Asia/Tashkent', '00:00', '23:59');
    l := pg_temp.qo(l, 'Chegaraviy vaqtlar 00:00 va 23:59 qabul qilinadi', true);
    reset role;

    -- ============ 8) Endpoint yangi egaga o'tadi ============
    perform pg_temp.kirish(ua); set local role authenticated;
    insert into public.bildirishnoma_qurilmalari (endpoint, p256dh, auth_kaliti, tz) values (ec, 'p-c1', 'k-c1', 'Asia/Tashkent');
    reset role;
    perform pg_temp.kirish(uc); set local role authenticated;
    insert into public.bildirishnoma_qurilmalari (endpoint, p256dh, auth_kaliti, tz) values (ec, 'p-c2', 'k-c2', 'Asia/Tashkent')
      on conflict (user_id, endpoint) do update set p256dh = excluded.p256dh;
    select count(*) into n from public.bildirishnoma_qurilmalari where endpoint = ec;
    reset role;
    l := pg_temp.qo(l, 'Boshqa akkaunt (C) shu endpoint bilan yozdi: endpoint faqat C da qoldi, A ning eski qatori o''chdi', n = 1
      and not exists (select 1 from public.bildirishnoma_qurilmalari where endpoint = ec and user_id = ua)
      and exists (select 1 from public.bildirishnoma_qurilmalari where endpoint = ec and user_id = uc and p256dh = 'p-c2'));
    l := pg_temp.qo(l, 'Boshqa endpointlar (A ning ea, B ning eb) tegilmadi', exists (select 1 from public.bildirishnoma_qurilmalari where endpoint = ea and user_id = ua)
      and exists (select 1 from public.bildirishnoma_qurilmalari where endpoint = eb and user_id = ub));

    -- ============ 9) tombstone_tozalash() bu jadvalga tegmaydi ============
    alter table public.bildirishnoma_qurilmalari disable trigger bildirishnoma_belgilash;
    update public.bildirishnoma_qurilmalari set updated_at = now() - interval '400 days';
    alter table public.bildirishnoma_qurilmalari enable trigger bildirishnoma_belgilash;
    select count(*) into n from public.bildirishnoma_qurilmalari;
    r := public.tombstone_tozalash(90);
    select count(*) into m from public.bildirishnoma_qurilmalari;
    l := pg_temp.qo(l, 'tombstone_tozalash(90): 400 kunlik eski qatorlar ham SAQLANDI (jadval sinxron tizimida emas)', n = m and m > 0);

    -- ============ 10) Egasi qatorni o'chira oladi ============
    perform pg_temp.kirish(ub); set local role authenticated;
    delete from public.bildirishnoma_qurilmalari where id = rb;
    get diagnostics n = row_count;
    reset role;
    l := pg_temp.qo(l, 'B o''z qatorini o''chirdi (haqiqatan, tombstone emas)', n = 1 and not exists (select 1 from public.bildirishnoma_qurilmalari where id = rb));

    -- ============ 11) Hisobni o'chirish (003) va cascade ============
    select count(*) into n from public.bildirishnoma_qurilmalari where user_id = ua;
    perform pg_temp.kirish(ua); set local role authenticated;
    r := public.hisobni_ochirish();
    reset role;
    l := pg_temp.qo(l, 'hisobni_ochirish(): A ning ' || n || ' ta bildirishnoma qatori ham o''chdi (cascade), 003 funksiyasini o''zgartirish kerak emas', n > 0
      and not exists (select 1 from public.bildirishnoma_qurilmalari where user_id = ua) and not exists (select 1 from auth.users where id = ua));
    l := pg_temp.qo(l, 'hisobni_ochirish(): C ning qatori joyida qoldi', exists (select 1 from public.bildirishnoma_qurilmalari where user_id = uc));

    delete from auth.users where id = uc;
    l := pg_temp.qo(l, 'auth.users qatori o''chirilsa (C), qurilma qatorlari cascade bilan o''chadi', not exists (select 1 from public.bildirishnoma_qurilmalari where user_id = uc));

    raise exception 'SINOV_TUGADI' using errcode = 'ZZ002';
  exception
    when sqlstate 'ZZ002' then null;
    when others then
      l := l || ('O''TMADI' || E'\t' || 'Kutilmagan xato: ' || sqlerrm);
  end;

  return query
    select (t.i)::integer, split_part(t.x, E'\t', 2), split_part(t.x, E'\t', 1)
    from unnest(l) with ordinality as t(x, i)
    union all
    select 999,
      'JAMI: ' || (select count(*) from unnest(l) u where u like 'O''TDI%') || ' ta o''tdi, '
        || (select count(*) from unnest(l) u where u like 'O''TMADI%') || ' ta o''tmadi',
      case when (select count(*) from unnest(l) u where u like 'O''TMADI%') = 0 and coalesce(array_length(l, 1), 0) > 0
           then 'HAMMASI O''TDI' else 'O''TMADI' end
    order by 1;
end;
$$;

select * from pg_temp.bildirishnoma_sinovi();
