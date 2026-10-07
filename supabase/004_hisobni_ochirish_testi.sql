-- =====================================================================
-- Chuntak AI — hisobni o'chirish funksiyasini tekshirish (S7)
-- Fayl: supabase/004_hisobni_ochirish_testi.sql
--
-- Nima qiladi: ikkita sinov foydalanuvchi (A va B) yaratib, A hisobini o'chirsa B ning ma'lumoti saqlanishini,
-- anon va kirmagan foydalanuvchi o'chira olmasligini, tombstone ham haqiqatan o'chishini tekshiradi.
-- Natija: O'TDI yoki O'TMADI. Sinov HECH NARSANI SAQLAMAYDI (002 dagi kabi: hammasi bir tranzaksiyada va oxirida ROLLBACK).
-- Oldin 001_sxema.sql va 003_hisobni_ochirish.sql ishga tushirilgan bo'lishi kerak.
-- =====================================================================

create or replace function pg_temp.qo(a text[], nom text, ok boolean)
returns text[] language sql as $$
  select a || ((case when ok is true then 'O''TDI' else 'O''TMADI' end) || E'\t' || nom)
$$;

create or replace function pg_temp.ochirish_sinovi()
returns table (raqam integer, tekshiruv text, natija text)
language plpgsql
as $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid();
  ha uuid := gen_random_uuid(); ha2 uuid := gen_random_uuid(); ka uuid := gen_random_uuid(); ya uuid := gen_random_uuid(); ya2 uuid := gen_random_uuid(); ba uuid := gen_random_uuid();
  qa uuid := gen_random_uuid(); ta uuid := gen_random_uuid(); sa uuid := gen_random_uuid();
  hb uuid := gen_random_uuid(); kb uuid := gen_random_uuid(); yb uuid := gen_random_uuid(); bb uuid := gen_random_uuid();
  qb uuid := gen_random_uuid(); tb uuid := gen_random_uuid(); sb uuid := gen_random_uuid();
  jadvallar text[] := array['hisoblar', 'kategoriyalar', 'yozuvlar', 'byudjetlar', 'qarzlar', 'qarz_tolovlari', 'sozlamalar'];
  j text; n integer; m integer; ok boolean; xato text; sh text; natija jsonb; imzo_b text; imzo_b2 text;
  l text[] := '{}';
begin
  begin  -- ichki blok: oxirida hammasi bekor qilinadi (ROLLBACK)
    set constraints all immediate;
    insert into auth.users (id, email) values (ua, 'a-ochir@chuntak.invalid'), (ub, 'b-ochir@chuntak.invalid');

    -- ============ 1) Funksiya tuzilmasi va ruxsatlar ============
    select count(*) into n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
      where s.nspname = 'public' and p.proname = 'hisobni_ochirish' and p.pronargs = 0 and p.prosecdef;
    l := pg_temp.qo(l, 'Funksiya bor, PARAMETRSIZ (kimni o''chirishni tanlab bo''lmaydi) va SECURITY DEFINER', n = 1);

    select (p.proconfig::text ~ 'search_path=""' or p.proconfig::text ~ 'search_path=')::boolean into ok from pg_proc p join pg_namespace s on s.oid = p.pronamespace
      where s.nspname = 'public' and p.proname = 'hisobni_ochirish';
    l := pg_temp.qo(l, 'search_path qat''iy belgilangan (bo''sh)', coalesce(ok, false));

    l := pg_temp.qo(l, 'EXECUTE: authenticated roliga bor', has_function_privilege('authenticated', 'public.hisobni_ochirish()', 'execute'));
    l := pg_temp.qo(l, 'EXECUTE: anon roliga YO''Q', not has_function_privilege('anon', 'public.hisobni_ochirish()', 'execute'));
    select count(*) into n from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      where p.proname = 'hisobni_ochirish' and p.pronamespace = 'public'::regnamespace and a.grantee = 0;   -- grantee 0 = PUBLIC
    l := pg_temp.qo(l, 'EXECUTE: PUBLIC (hamma) ga YO''Q', n = 0);

    -- ============ 2) Ikkala foydalanuvchining to'liq ma'lumoti (7 jadval), A da o'chirilgan (tombstone) qatorlar ham ============
    -- A ning qatorlari (A nomidan: user_id ni server qo'yadi)
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', ua::text, true);
    set local role authenticated;
    insert into public.hisoblar (id, nom, tur, belgi, rang) values (ha, 'A naqd', 'naqd', 'naqd', '#43a047'), (ha2, 'A karta', 'karta', 'karta', '#1e88e5');
    insert into public.kategoriyalar (id, nom, tur, rang, belgi) values (ka, 'A oziq', 'xarajat', '#e57373', 'oziq');
    insert into public.yozuvlar (id, tur, summa, sana, vaqt, hisob_id, kategoriya_id, izoh, deleted) values
      (ya, 'xarajat', 12000, '2026-10-05', '10:30', ha, ka, 'A izoh', false),
      (ya2, 'xarajat', 777, '2026-10-06', '11:00', ha, ka, 'A o''chirilgan (tombstone)', true);
    insert into public.byudjetlar (id, kategoriya_id, oylik_limit) values (ba, ka, 500000);
    insert into public.qarzlar (id, yonalish, shaxs, summa, hisob_id, sana) values (qa, 'berdim', 'Ali', 200000, ha, '2026-10-04');
    insert into public.qarz_tolovlari (id, qarz_id, sana, summa, hisob_id) values (ta, qa, '2026-10-05', 50000, ha);
    insert into public.sozlamalar (id, sxema_versiyasi) values (sa, 7);
    reset role;
    -- B ning qatorlari (B nomidan)
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', ub::text, true);
    set local role authenticated;
    insert into public.hisoblar (id, nom, tur, belgi, rang) values (hb, 'B naqd', 'naqd', 'naqd', '#43a047');
    insert into public.kategoriyalar (id, nom, tur, rang, belgi) values (kb, 'B transport', 'xarajat', '#64b5f6', 'transport');
    insert into public.yozuvlar (id, tur, summa, sana, vaqt, hisob_id, kategoriya_id, izoh) values (yb, 'xarajat', 34000, '2026-10-05', '09:00', hb, kb, 'B ning maxfiy izohi');
    insert into public.byudjetlar (id, kategoriya_id, oylik_limit) values (bb, kb, 900000);
    insert into public.qarzlar (id, yonalish, shaxs, summa, hisob_id, sana) values (qb, 'oldim', 'Vali', 100000, hb, '2026-10-04');
    insert into public.qarz_tolovlari (id, qarz_id, sana, summa, hisob_id) values (tb, qb, '2026-10-05', 10000, hb);
    insert into public.sozlamalar (id, sxema_versiyasi) values (sb, 7);
    reset role;

    select md5(string_agg(t::text, '|' order by t::text)) into imzo_b from (
      select hb::text || nom as t from public.hisoblar where user_id = ub
      union all select kb::text || nom from public.kategoriyalar where user_id = ub
      union all select yb::text || izoh || summa from public.yozuvlar where user_id = ub
      union all select bb::text || oylik_limit from public.byudjetlar where user_id = ub
      union all select qb::text || shaxs || summa from public.qarzlar where user_id = ub
      union all select tb::text || summa from public.qarz_tolovlari where user_id = ub
      union all select sb::text || sxema_versiyasi from public.sozlamalar where user_id = ub) q;

    -- ============ 3) anon va kirmagan foydalanuvchi o'chira olmaydi ============
    perform set_config('request.jwt.claims', '', true);
    perform set_config('request.jwt.claim.sub', '', true);
    set local role anon;
    ok := false;
    begin perform public.hisobni_ochirish(); exception when insufficient_privilege then ok := true; when others then ok := false; end;
    reset role;
    l := pg_temp.qo(l, 'anon (kirmagan) hisobni o''chira olmaydi: ruxsat rad etiladi', ok);

    set local role authenticated;   -- authenticated, lekin JWT (auth.uid()) yo'q
    ok := false;
    begin perform public.hisobni_ochirish(); exception when insufficient_privilege then ok := true; when others then ok := false; end;
    reset role;
    select count(*) into n from auth.users where id in (ua, ub);
    l := pg_temp.qo(l, 'auth.uid() bo''lmasa o''chirilmaydi va hech narsa o''zgarmaydi', ok and n = 2);

    -- ============ 4) A o'z hisobini o'chiradi ============
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', ua::text, true);
    set local role authenticated;
    ok := true; xato := null;
    begin natija := public.hisobni_ochirish(); exception when others then ok := false; xato := sqlerrm; end;
    reset role;
    l := pg_temp.qo(l, 'A hisobni o''chira oladi' || coalesce(' [' || xato || ']', ''), ok);
    l := pg_temp.qo(l, 'Natija hisoboti: 2 hisob, 1 kategoriya, 2 yozuv (tombstone ham), 1 byudjet, 1 qarz, 1 to''lov, 1 sozlama, 1 akkaunt',
      natija = '{"hisoblar":2,"kategoriyalar":1,"yozuvlar":2,"byudjetlar":1,"qarzlar":1,"qarz_tolovlari":1,"sozlamalar":1,"akkaunt":1}'::jsonb);

    set constraints all immediate;
    n := 0;
    foreach j in array jadvallar loop
      execute format('select count(*) from public.%I where user_id = $1', j) into m using ua;
      n := n + m;
    end loop;
    l := pg_temp.qo(l, 'A ning HECH QANDAY qatori qolmagan (7 jadval; tombstone ham haqiqatan o''chgan)', n = 0);
    select count(*) into n from public.yozuvlar where id = ya2;
    l := pg_temp.qo(l, 'A ning mantiqiy o''chirilgan (deleted = true) qatori ham butunlay yo''q', n = 0);
    select count(*) into n from auth.users where id = ua;
    l := pg_temp.qo(l, 'A ning akkaunti (auth.users) o''chgan', n = 0);

    -- ============ 5) B ning ma'lumoti va akkaunti SAQLANGAN ============
    select count(*) into n from auth.users where id = ub;
    l := pg_temp.qo(l, 'B ning akkaunti saqlangan', n = 1);
    select md5(string_agg(t::text, '|' order by t::text)) into imzo_b2 from (
      select hb::text || nom as t from public.hisoblar where user_id = ub
      union all select kb::text || nom from public.kategoriyalar where user_id = ub
      union all select yb::text || izoh || summa from public.yozuvlar where user_id = ub
      union all select bb::text || oylik_limit from public.byudjetlar where user_id = ub
      union all select qb::text || shaxs || summa from public.qarzlar where user_id = ub
      union all select tb::text || summa from public.qarz_tolovlari where user_id = ub
      union all select sb::text || sxema_versiyasi from public.sozlamalar where user_id = ub) q;
    l := pg_temp.qo(l, 'B ning 7 jadvaldagi hamma qatori o''zgarishsiz saqlangan (imzo bir xil)', imzo_b is not null and imzo_b = imzo_b2);
    select count(*) into n from public.hisoblar where user_id = ub and id = hb;
    select count(*) into m from public.yozuvlar where user_id = ub and id = yb and izoh = 'B ning maxfiy izohi' and summa = 34000;
    l := pg_temp.qo(l, 'B ning hisobi va yozuvi joyida', n = 1 and m = 1);

    -- ============ 6) Qayta chaqirish zararsiz (token hali amalda, lekin akkaunt yo'q); B ni o'chirishga urinish imkonsiz ============
    set local role authenticated;
    ok := true; xato := null;
    begin natija := public.hisobni_ochirish(); exception when others then ok := false; xato := sqlerrm; end;
    reset role;
    l := pg_temp.qo(l, 'Qayta chaqirish (A): xato bermaydi, hech narsa o''chmaydi' || coalesce(' [' || xato || ']', ''), ok and natija->>'akkaunt' = '0');
    select count(*) into n from public.hisoblar where user_id = ub;
    l := pg_temp.qo(l, 'Qayta chaqirishdan keyin ham B ning ma''lumoti saqlangan', n = 1);

    -- B o'z hisobini o'chiradi: A ga (allaqachon yo'q) va boshqalarga ta'sir qilmaydi, faqat B ketadi
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', ub::text, true);
    set local role authenticated;
    natija := public.hisobni_ochirish();
    reset role;
    set constraints all immediate;
    select count(*) into n from auth.users where id = ub;
    select count(*) into m from public.yozuvlar where user_id = ub;
    l := pg_temp.qo(l, 'B ham o''z hisobini o''chira oladi (B ning hamma qatori va akkaunti ketadi)', n = 0 and m = 0 and (natija->>'akkaunt') = '1');

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

select * from pg_temp.ochirish_sinovi();
