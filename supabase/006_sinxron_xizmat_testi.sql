-- =====================================================================
-- Chuntak AI — sinxron xizmat funksiyalarini tekshirish (S8)
-- Fayl: supabase/006_sinxron_xizmat_testi.sql
-- Tekshiradi: sinxron_holati() faqat o'z qatorlarini ko'radi; tombstone_tozalash() faqat 90 kundan eski o'chirilganlarni
-- va bog'langan ota qatorni qoldirib o'chiradi; uni foydalanuvchi chaqira olmaydi. Sinov HECH NARSANI SAQLAMAYDI (oxirida ROLLBACK).
-- Oldin 001, 003 va 005 ishga tushirilgan bo'lishi kerak.
-- =====================================================================
create or replace function pg_temp.qo(a text[], nom text, ok boolean)
returns text[] language sql as $$
  select a || ((case when ok is true then 'O''TDI' else 'O''TMADI' end) || E'\t' || nom)
$$;

create or replace function pg_temp.xizmat_sinovi()
returns table (raqam integer, tekshiruv text, natija text)
language plpgsql
as $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid();
  h1 uuid := gen_random_uuid(); h2 uuid := gen_random_uuid(); h3 uuid := gen_random_uuid(); h4 uuid := gen_random_uuid();
  k1 uuid := gen_random_uuid(); k2 uuid := gen_random_uuid();
  y1 uuid := gen_random_uuid(); y2 uuid := gen_random_uuid(); y3 uuid := gen_random_uuid(); y4 uuid := gen_random_uuid();
  q1 uuid := gen_random_uuid(); t1 uuid := gen_random_uuid();
  hb uuid := gen_random_uuid(); kb uuid := gen_random_uuid(); yb uuid := gen_random_uuid();
  n integer; m integer; ok boolean; xato text; r jsonb; v1 text; v2 text;
  eski timestamptz := now() - interval '120 days'; yangi timestamptz := now() - interval '10 days';
  jadvallar text[] := array['hisoblar', 'kategoriyalar', 'yozuvlar', 'byudjetlar', 'qarzlar', 'qarz_tolovlari', 'sozlamalar'];
  j text;
  l text[] := '{}';
begin
  begin
    set constraints all immediate;
    insert into auth.users (id, email) values (ua, 'a-xizmat@chuntak.invalid'), (ub, 'b-xizmat@chuntak.invalid');

    -- A ning ma'lumoti (A nomidan)
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', ua::text, true);
    set local role authenticated;
    insert into public.hisoblar (id, nom, tur, belgi, rang, deleted) values (h1, 'tirik', 'naqd', 'naqd', '#1', false), (h2, 'eski o''chirilgan, bog''liq', 'naqd', 'naqd', '#1', true),
                                                                       (h3, 'eski o''chirilgan, bog''liqsiz', 'naqd', 'naqd', '#1', true), (h4, 'yangi o''chirilgan', 'naqd', 'naqd', '#1', true);
    insert into public.kategoriyalar (id, nom, tur, rang, belgi, deleted) values (k1, 'tirik', 'xarajat', '#1', 'oziq', false), (k2, 'eski o''chirilgan', 'xarajat', '#1', 'oziq', true);
    insert into public.yozuvlar (id, tur, summa, sana, hisob_id, kategoriya_id, deleted) values
      (y1, 'xarajat', 10, '2026-10-01', h1, k1, false),                 -- tirik
      (y2, 'xarajat', 20, '2026-10-01', h2, k1, true),                  -- eski o'chirilgan (h2 ga bog'liq)
      (y3, 'xarajat', 30, '2026-10-01', h1, k1, true),                  -- yangi o'chirilgan (10 kun)
      (y4, 'xarajat', 40, '2026-10-01', h1, k1, false);                 -- tirik
    insert into public.qarzlar (id, yonalish, shaxs, summa, hisob_id, sana, deleted) values (q1, 'berdim', 'Ali', 100, h1, '2026-10-01', true);   -- eski o'chirilgan, lekin to'lovi bor
    insert into public.qarz_tolovlari (id, qarz_id, sana, summa, hisob_id, deleted) values (t1, q1, '2026-10-02', 10, h1, false);                 -- tirik to'lov: qarz tozalanmasin
    reset role;
    -- B ning ma'lumoti (B nomidan)
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', ub::text, true);
    set local role authenticated;
    insert into public.hisoblar (id, nom, tur, belgi, rang) values (hb, 'B hisob', 'naqd', 'naqd', '#1');
    insert into public.kategoriyalar (id, nom, tur, rang, belgi) values (kb, 'B kat', 'xarajat', '#1', 'oziq');
    insert into public.yozuvlar (id, tur, summa, sana, hisob_id, kategoriya_id, deleted) values (yb, 'xarajat', 5, '2026-10-01', hb, kb, true);   -- B ning o'chirilgani (eski bo'ladi)
    reset role;

    -- 1) sinxron_holati: faqat o'zining qatorlari
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', ua::text, true);
    r := public.sinxron_holati();
    select max(updated_at)::text into v1 from public.yozuvlar where user_id = ua;
    reset role;
    l := pg_temp.qo(l, 'sinxron_holati(): 6 jadval kaliti bor (byudjetlar bo''sh = null)', (select count(*) from jsonb_object_keys(r)) = 6 and r->'byudjetlar' = 'null'::jsonb);
    l := pg_temp.qo(l, 'sinxron_holati(): A ning yozuvlari bo''yicha eng oxirgi vaqt to''g''ri', (r->>'yozuvlar')::timestamptz = v1::timestamptz);
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', ub::text, true);
    r := public.sinxron_holati();
    select max(updated_at)::text into v2 from public.yozuvlar where user_id = ub;
    reset role;
    l := pg_temp.qo(l, 'sinxron_holati(): B faqat o''z qatorlarini ko''radi (A niki aralashmaydi)', (r->>'yozuvlar')::timestamptz = v2::timestamptz and r->'qarzlar' = 'null'::jsonb);
    set local role anon;
    ok := false; begin perform public.sinxron_holati(); exception when insufficient_privilege then ok := true; when others then ok := false; end;
    reset role;
    l := pg_temp.qo(l, 'sinxron_holati(): anon chaqira olmaydi', ok);

    -- 2) tombstone_tozalash: ruxsatlar
    l := pg_temp.qo(l, 'tombstone_tozalash(): authenticated va anon ga EXECUTE YO''Q', not has_function_privilege('authenticated', 'public.tombstone_tozalash(integer)', 'execute') and not has_function_privilege('anon', 'public.tombstone_tozalash(integer)', 'execute'));
    set local role authenticated;
    ok := false; begin perform public.tombstone_tozalash(90); exception when insufficient_privilege then ok := true; when others then ok := false; end;
    reset role;
    l := pg_temp.qo(l, 'tombstone_tozalash(): foydalanuvchi chaqirsa rad etiladi', ok);

    -- 3) Vaqtni eskirtirish (server triggerini vaqtincha o'chirib: u updated_at ni doim hozirgi qiladi). Faqat shu tranzaksiyada.
    foreach j in array jadvallar loop execute format('alter table public.%I disable trigger chuntak_belgilash', j); end loop;
    update public.yozuvlar set updated_at = eski where id in (y2, yb);
    update public.yozuvlar set updated_at = yangi where id = y3;
    update public.hisoblar set updated_at = eski where id in (h2, h3);
    update public.hisoblar set updated_at = yangi where id = h4;
    update public.kategoriyalar set updated_at = eski where id = k2;
    update public.qarzlar set updated_at = eski where id = q1;
    foreach j in array jadvallar loop execute format('alter table public.%I enable trigger chuntak_belgilash', j); end loop;

    -- 4) Tozalash (egasi sifatida)
    r := public.tombstone_tozalash(90);
    set constraints all immediate;
    select count(*) into n from public.yozuvlar where id in (y2, yb);
    l := pg_temp.qo(l, '90 kundan eski o''chirilgan yozuvlar (A va B niki) o''chdi', n = 0);
    select count(*) into n from public.yozuvlar where id in (y1, y3, y4);
    l := pg_temp.qo(l, 'Tirik yozuvlar va yangi (10 kunlik) o''chirilgan yozuv saqlandi', n = 3);
    select count(*) into n from public.hisoblar where id = h3;
    l := pg_temp.qo(l, 'Eski o''chirilgan, bog''liqsiz hisob o''chdi', n = 0);
    select count(*) into n from public.hisoblar where id in (h1, h4);
    l := pg_temp.qo(l, 'Tirik hisob va yangi o''chirilgan hisob saqlandi', n = 2);
    select count(*) into n from public.kategoriyalar where id = k2;
    l := pg_temp.qo(l, 'Eski o''chirilgan kategoriya (unga bog''langan qator yo''q — yozuv y2 tozalangan) o''chdi', n = 0);
    select count(*) into n from public.hisoblar where id = h2;
    l := pg_temp.qo(l, 'Eski o''chirilgan hisob o''chdi (bog''langan y2 ham tozalangan edi)', n = 0);
    select count(*) into n from public.qarzlar where id = q1;
    l := pg_temp.qo(l, 'Eski o''chirilgan qarz, lekin tirik to''lovi bor: SAQLANDI (tashqi kalit buzilmaydi)', n = 1);
    select count(*) into n from public.hisoblar where id = hb;
    m := (select count(*) from public.kategoriyalar where id = kb);
    l := pg_temp.qo(l, 'B ning tirik hisobi va kategoriyasi saqlandi', n = 1 and m = 1);
    l := pg_temp.qo(l, 'Hisobot: yozuvlar 2, hisoblar 2, kategoriyalar 1, qarzlar 0', (r->>'yozuvlar')::int = 2 and (r->>'hisoblar')::int = 2 and (r->>'kategoriyalar')::int = 1 and (r->>'qarzlar')::int = 0);

    -- 5) Takror ishga tushirish zararsiz
    r := public.tombstone_tozalash(90);
    l := pg_temp.qo(l, 'Takror ishga tushirish: hech narsa o''chmaydi (0)', (r->>'yozuvlar')::int = 0 and (r->>'hisoblar')::int = 0 and (r->>'kategoriyalar')::int = 0);

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

select * from pg_temp.xizmat_sinovi();
