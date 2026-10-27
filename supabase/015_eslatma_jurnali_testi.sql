-- =====================================================================
-- Chuntak AI — eslatma jurnalini tekshirish (ilova 0.50.0, TZ-sinxronlash.md 47-band)
-- Fayl: supabase/015_eslatma_jurnali_testi.sql
-- Tekshiradi: jadval tuzilishi (sinxron ustuni `deleted` yo'q); RLS (majburiy, siyosatsiz); GRANT (anon va authenticated ga HECH NARSA, service_role ga
-- aniq ruxsat); anon/authenticated rad etilishi; unique va `on conflict do nothing`; kalit cheklovi; tashqi kalit; cascade (qurilma, hisobni o'chirish,
-- auth.users); tombstone_tozalash() ga tegmasligi; mavjud jadvallarning anon/authenticated ruxsati o'zgarmaganligi.
-- Sinov HECH NARSANI SAQLAMAYDI (oxirida ROLLBACK). Oldin 001, 003, 005, 013 va 015 ishga tushirilgan bo'lishi kerak.
-- Supabase'da: service_role roli bor (BYPASSRLS); SQL Editor'da `set local role service_role` ishlaydi.
-- =====================================================================
create or replace function pg_temp.qo(a text[], nom text, ok boolean)
returns text[] language sql as $$
  select a || ((case when ok is true then 'O''TDI' else 'O''TMADI' end) || E'\t' || nom)
$$;
create or replace function pg_temp.kirish(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u::text, true);
end $$;

create or replace function pg_temp.jurnal_sinovi()
returns table (raqam integer, tekshiruv text, natija text)
language plpgsql
as $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid();
  da uuid := gen_random_uuid(); da2 uuid := gen_random_uuid(); db uuid := gen_random_uuid();
  qid uuid := gen_random_uuid();
  n integer; m integer; ok boolean; r jsonb;
  priv text[] := array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger'];
  l text[] := '{}';
begin
  begin
    set constraints all immediate;
    insert into auth.users (id, email) values (ua, 'a-jur@chuntak.invalid'), (ub, 'b-jur@chuntak.invalid');

    -- ============ 1) Tuzilish ============
    l := pg_temp.qo(l, 'Jadval bor, RLS yoqilgan va majburiy', (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.eslatma_jurnali'::regclass));
    select count(*) into n from information_schema.columns where table_schema = 'public' and table_name = 'eslatma_jurnali' and column_name in ('qurilma_id', 'kalit', 'sana', 'created_at');
    l := pg_temp.qo(l, '4 ustun bor (qurilma_id, kalit, sana, created_at)', n = 4);
    select count(*) into n from information_schema.columns where table_schema = 'public' and table_name = 'eslatma_jurnali';
    l := pg_temp.qo(l, 'Boshqa ustun yo''q; SINXRON TIZIMIDA EMAS: `deleted` yo''q', n = 4);
    l := pg_temp.qo(l, 'unique (qurilma_id, kalit, sana) bor', exists (select 1 from pg_constraint where conrelid = 'public.eslatma_jurnali'::regclass and contype in ('p', 'u')
      and (select array_agg(a.attname::text order by a.attname) from pg_attribute a where a.attrelid = conrelid and a.attnum = any (conkey)) = array['kalit', 'qurilma_id', 'sana']));
    l := pg_temp.qo(l, 'qurilma_id: bildirishnoma_qurilmalari ga bog''langan, on delete cascade', exists (
      select 1 from pg_constraint where conrelid = 'public.eslatma_jurnali'::regclass and contype = 'f' and confrelid = 'public.bildirishnoma_qurilmalari'::regclass and confdeltype = 'c'));
    select count(*) into n from pg_policies where schemaname = 'public' and tablename = 'eslatma_jurnali';
    l := pg_temp.qo(l, 'Siyosat YO''Q (anon va authenticated ga yo''l yo''q)', n = 0);

    -- ============ 2) GRANT ============
    l := pg_temp.qo(l, 'anon: HECH QANDAY huquq yo''q', not exists (select 1 from unnest(priv) p where has_table_privilege('anon', 'public.eslatma_jurnali', p)));
    l := pg_temp.qo(l, 'authenticated: HECH QANDAY huquq yo''q', not exists (select 1 from unnest(priv) p where has_table_privilege('authenticated', 'public.eslatma_jurnali', p)));
    select count(*) into n from pg_class c, aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a where c.oid = 'public.eslatma_jurnali'::regclass and a.grantee = 0;
    l := pg_temp.qo(l, 'PUBLIC (hamma) ga hech narsa berilmagan', n = 0);
    l := pg_temp.qo(l, 'service_role: select, insert, update, delete ANIQ berilgan', has_table_privilege('service_role', 'public.eslatma_jurnali', 'select') and has_table_privilege('service_role', 'public.eslatma_jurnali', 'insert')
      and has_table_privilege('service_role', 'public.eslatma_jurnali', 'update') and has_table_privilege('service_role', 'public.eslatma_jurnali', 'delete'));
    l := pg_temp.qo(l, 'service_role: truncate, references, trigger berilmagan', not has_table_privilege('service_role', 'public.eslatma_jurnali', 'truncate') and not has_table_privilege('service_role', 'public.eslatma_jurnali', 'references')
      and not has_table_privilege('service_role', 'public.eslatma_jurnali', 'trigger'));
    l := pg_temp.qo(l, 'service_role: qurilmalardan select va delete, qarzlardan va to''lovlardan select (funksiya o''qiydigan jadvallar)', has_table_privilege('service_role', 'public.bildirishnoma_qurilmalari', 'select')
      and has_table_privilege('service_role', 'public.bildirishnoma_qurilmalari', 'delete') and has_table_privilege('service_role', 'public.qarzlar', 'select') and has_table_privilege('service_role', 'public.qarz_tolovlari', 'select'));
    l := pg_temp.qo(l, 'Mavjud jadvallarda anon ga hamon HECH NARSA, authenticated ga o''zgarish yo''q (qarzlar, qarz_tolovlari, bildirishnoma_qurilmalari)', not exists (
        select 1 from unnest(array['public.qarzlar', 'public.qarz_tolovlari', 'public.bildirishnoma_qurilmalari']) t, unnest(priv) p where has_table_privilege('anon', t, p))
      and has_table_privilege('authenticated', 'public.qarzlar', 'select') and has_table_privilege('authenticated', 'public.bildirishnoma_qurilmalari', 'delete'));

    -- ============ 3) Qurilmalar (A: ikkita, B: bitta), keyin anon va authenticated rad etiladi ============
    perform pg_temp.kirish(ua); set local role authenticated;
    insert into public.bildirishnoma_qurilmalari (id, endpoint, p256dh, auth_kaliti, tz, kunlik_yoqiq) values
      (da, 'https://fcm.googleapis.com/fcm/send/ja', 'p', 'k', 'Asia/Tashkent', true), (da2, 'https://fcm.googleapis.com/fcm/send/ja2', 'p', 'k', 'Asia/Tashkent', true);
    reset role;
    perform pg_temp.kirish(ub); set local role authenticated;
    insert into public.bildirishnoma_qurilmalari (id, endpoint, p256dh, auth_kaliti, tz, kunlik_yoqiq) values (db, 'https://fcm.googleapis.com/fcm/send/jb', 'p', 'k', 'Asia/Tashkent', true);
    reset role;

    perform pg_temp.kirish(ua); set local role authenticated;
    ok := false; begin perform count(*) from public.eslatma_jurnali; exception when insufficient_privilege then ok := true; when others then ok := false; end;
    l := pg_temp.qo(l, 'authenticated jurnalni o''qiy olmaydi (permission denied)', ok);
    ok := false; begin insert into public.eslatma_jurnali (qurilma_id, kalit, sana) values (da, 'kunlik', '2026-10-27'); exception when insufficient_privilege then ok := true; when others then ok := false; end;
    l := pg_temp.qo(l, 'authenticated yoza olmaydi (o''z qurilmasiga ham)', ok);
    ok := false; begin delete from public.eslatma_jurnali; exception when insufficient_privilege then ok := true; when others then ok := false; end;
    l := pg_temp.qo(l, 'authenticated o''chira olmaydi', ok);
    reset role;
    set local role anon;
    ok := false; begin perform count(*) from public.eslatma_jurnali; exception when insufficient_privilege then ok := true; when others then ok := false; end;
    l := pg_temp.qo(l, 'anon o''qiy olmaydi', ok);
    ok := false; begin insert into public.eslatma_jurnali (qurilma_id, kalit, sana) values (da, 'kunlik', '2026-10-27'); exception when insufficient_privilege then ok := true; when others then ok := false; end;
    l := pg_temp.qo(l, 'anon yoza olmaydi', ok);
    reset role;

    -- ============ 4) service_role: yozish, takror (on conflict do nothing), unique, cheklovlar, tashqi kalit ============
    set local role service_role;
    insert into public.eslatma_jurnali (qurilma_id, kalit, sana) values (da, 'kunlik', '2026-10-27') on conflict (qurilma_id, kalit, sana) do nothing;
    get diagnostics n = row_count;
    insert into public.eslatma_jurnali (qurilma_id, kalit, sana) values (da, 'kunlik', '2026-10-27') on conflict (qurilma_id, kalit, sana) do nothing;
    get diagnostics m = row_count;
    l := pg_temp.qo(l, 'service_role: birinchi insert 1 qator, takror "on conflict do nothing" 0 qator (parallel chaqiruv ikki marta yubormaydi)', n = 1 and m = 0);
    ok := false; begin insert into public.eslatma_jurnali (qurilma_id, kalit, sana) values (da, 'kunlik', '2026-10-27'); exception when unique_violation then ok := true; when others then ok := false; end;
    l := pg_temp.qo(l, 'unique (qurilma_id, kalit, sana): takror qator xato beradi', ok);
    insert into public.eslatma_jurnali (qurilma_id, kalit, sana) values (da, 'kunlik', '2026-10-28'), (da2, 'kunlik', '2026-10-27'), (db, 'kunlik', '2026-10-27');
    l := pg_temp.qo(l, 'Boshqa sana va boshqa qurilma uchun shu kalit alohida qator bo''ladi', (select count(*) from public.eslatma_jurnali) = 4);
    insert into public.eslatma_jurnali (qurilma_id, kalit, sana) values (da, 'qarz:' || qid || ':0', '2026-10-27'), (da, 'qarz:' || qid || ':1', '2026-10-28'), (da, 'qarz:' || qid || ':3', '2026-10-30');
    l := pg_temp.qo(l, 'kalit "qarz:<uuid>:0/1/3" qabul qilinadi', (select count(*) from public.eslatma_jurnali where kalit like 'qarz:%') = 3);
    ok := false; begin insert into public.eslatma_jurnali (qurilma_id, kalit, sana) values (da, 'qarz:' || qid || ':2', '2026-10-27'); exception when check_violation then ok := true; when others then ok := false; end;
    l := pg_temp.qo(l, 'kalit "qarz:<uuid>:2" rad etiladi (faqat 0/1/3)', ok);
    ok := false; begin insert into public.eslatma_jurnali (qurilma_id, kalit, sana) values (da, 'boshqa', '2026-10-27'); exception when check_violation then ok := true; when others then ok := false; end;
    l := pg_temp.qo(l, 'noma''lum kalit rad etiladi', ok);
    ok := false; begin insert into public.eslatma_jurnali (qurilma_id, kalit, sana) values (da, 'qarz:nouuid:0', '2026-10-27'); exception when check_violation then ok := true; when others then ok := false; end;
    l := pg_temp.qo(l, 'kalitda uuid bo''lmasa rad etiladi', ok);
    ok := false; begin insert into public.eslatma_jurnali (qurilma_id, kalit, sana) values (gen_random_uuid(), 'kunlik', '2026-10-27'); exception when foreign_key_violation then ok := true; when others then ok := false; end;
    l := pg_temp.qo(l, 'mavjud bo''lmagan qurilma uchun yozib bo''lmaydi (tashqi kalit)', ok);
    -- 14 kundan eski qatorlarni o'chirish (funksiya shunday qiladi)
    update public.eslatma_jurnali set created_at = now() - interval '15 days' where qurilma_id = db;
    update public.eslatma_jurnali set created_at = now() - interval '13 days' where qurilma_id = da2;
    delete from public.eslatma_jurnali where created_at < now() - interval '14 days';
    get diagnostics n = row_count;
    l := pg_temp.qo(l, 'service_role eski (15 kunlik) qatorni o''chiradi, 13 kunlik qoladi', n = 1 and exists (select 1 from public.eslatma_jurnali where qurilma_id = da2) and not exists (select 1 from public.eslatma_jurnali where qurilma_id = db));
    reset role;

    -- ============ 5) tombstone_tozalash() tegmaydi ============
    update public.eslatma_jurnali set created_at = now() - interval '400 days' where qurilma_id = da;
    select count(*) into n from public.eslatma_jurnali;
    r := public.tombstone_tozalash(90);
    select count(*) into m from public.eslatma_jurnali;
    l := pg_temp.qo(l, 'tombstone_tozalash(90) jurnalga TEGMAYDI (jadval sinxron tizimida emas)', n = m and m > 0);

    -- ============ 6) Cascade ============
    -- 6a) qurilma qatori o'chsa (404/410 da funksiya shunday qiladi), jurnali ham ketadi
    select count(*) into n from public.eslatma_jurnali where qurilma_id = da2;
    set local role service_role;
    delete from public.bildirishnoma_qurilmalari where id = da2;
    reset role;
    l := pg_temp.qo(l, 'service_role qurilma qatorini o''chiradi: ' || n || ' ta jurnal qatori cascade bilan ketdi', n > 0 and not exists (select 1 from public.eslatma_jurnali where qurilma_id = da2));
    -- 6b) hisobni o'chirish (003): A ning qurilmasi va jurnali ketadi, B niki qoladi
    insert into public.eslatma_jurnali (qurilma_id, kalit, sana) values (db, 'kunlik', '2026-10-27');
    select count(*) into n from public.eslatma_jurnali where qurilma_id = da;
    perform pg_temp.kirish(ua); set local role authenticated;
    r := public.hisobni_ochirish();
    reset role;
    l := pg_temp.qo(l, 'hisobni_ochirish(): A ning ' || n || ' ta jurnal qatori ham o''chdi (cascade), 003 ni o''zgartirish kerak emas', n > 0 and not exists (select 1 from public.eslatma_jurnali where qurilma_id = da)
      and not exists (select 1 from public.bildirishnoma_qurilmalari where user_id = ua) and not exists (select 1 from auth.users where id = ua));
    l := pg_temp.qo(l, 'hisobni_ochirish(): B ning qurilmasi va jurnali joyida', exists (select 1 from public.eslatma_jurnali where qurilma_id = db) and exists (select 1 from public.bildirishnoma_qurilmalari where id = db));
    -- 6c) auth.users o'chirilsa
    delete from auth.users where id = ub;
    l := pg_temp.qo(l, 'auth.users (B) o''chirilsa, qurilma va jurnal cascade bilan ketadi', not exists (select 1 from public.eslatma_jurnali where qurilma_id = db) and not exists (select 1 from public.bildirishnoma_qurilmalari where id = db));

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

select * from pg_temp.jurnal_sinovi();
