-- =====================================================================
-- Chuntak AI — yozuv bog'ini (bog_id) tekshirish (ilova 0.44.0, o'tkazma komissiyasi)
-- Fayl: supabase/010_yozuv_bogi_testi.sql
-- Tekshiradi: ustun va tashqi kalit; bog'lanish faqat o'z egasi qatoriga; tartibdan mustaqillik (bir tranzaksiyada); o'ziga ishora rad etiladi;
-- ustunni yubormagan (eski) so'rov bog_id ni o'chirmaydi; RLS; tombstone tozalash bog'langan qatorlarni buzmaydi; hisobni o'chirish ishlaydi.
-- Sinov HECH NARSANI SAQLAMAYDI (oxirida ROLLBACK). Oldin 001, 003, 005 va 009 ishga tushirilgan bo'lishi kerak.
-- =====================================================================
create or replace function pg_temp.qo(a text[], nom text, ok boolean)
returns text[] language sql as $$
  select a || ((case when ok is true then 'O''TDI' else 'O''TMADI' end) || E'\t' || nom)
$$;

create or replace function pg_temp.bog_sinovi()
returns table (raqam integer, tekshiruv text, natija text)
language plpgsql
as $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid();
  ha1 uuid := gen_random_uuid(); ha2 uuid := gen_random_uuid(); ka uuid := gen_random_uuid();
  hb1 uuid := gen_random_uuid(); hb2 uuid := gen_random_uuid(); kb uuid := gen_random_uuid();
  o1 uuid := gen_random_uuid(); c1 uuid := gen_random_uuid();   -- A: o'tkazma va komissiya
  o2 uuid := gen_random_uuid(); c2 uuid := gen_random_uuid();   -- A: tartib sinovi (komissiya avval)
  o3 uuid := gen_random_uuid(); c3 uuid := gen_random_uuid();   -- A: tozalash: eski o'chirilgan ikkalasi
  o4 uuid := gen_random_uuid(); c4 uuid := gen_random_uuid();   -- A: tozalash: eski o'chirilgan o'tkazma, lekin TIRIK komissiya
  ob uuid := gen_random_uuid(); cb uuid := gen_random_uuid();   -- B ning
  c5 uuid := gen_random_uuid(); c6 uuid := gen_random_uuid();
  n integer; m integer; ok boolean; r jsonb; v uuid; u1 timestamptz; u2 timestamptz; kod text;
  eski timestamptz := now() - interval '120 days';
  jadvallar text[] := array['hisoblar', 'kategoriyalar', 'yozuvlar', 'byudjetlar', 'qarzlar', 'qarz_tolovlari', 'sozlamalar'];
  j text;
  l text[] := '{}';
begin
  begin
    set constraints all immediate;
    insert into auth.users (id, email) values (ua, 'a-bog@chuntak.invalid'), (ub, 'b-bog@chuntak.invalid');

    -- 1) Ustun va indeks
    l := pg_temp.qo(l, 'yozuvlar.bog_id: uuid, bo''sh bo''lishi mumkin', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'yozuvlar' and column_name = 'bog_id' and data_type = 'uuid' and is_nullable = 'YES'));
    l := pg_temp.qo(l, 'Indeks yozuvlar_bog bor', exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'yozuvlar' and indexname = 'yozuvlar_bog'));
    l := pg_temp.qo(l, 'Tashqi kalit (user_id, bog_id) bor va kechiktirilgan (deferrable initially deferred)', exists (select 1 from pg_constraint where conname = 'yozuvlar_bog_fk' and contype = 'f' and condeferrable and condeferred));
    l := pg_temp.qo(l, 'RLS yoqilgan va majburiy (yozuvlar), anon ga hech narsa yo''q', (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.yozuvlar'::regclass) and not has_table_privilege('anon', 'public.yozuvlar', 'select'));
    l := pg_temp.qo(l, 'Trigger chuntak_belgilash o''zgarmagan (yozuvlarda bor)', exists (select 1 from pg_trigger where tgrelid = 'public.yozuvlar'::regclass and tgname = 'chuntak_belgilash' and not tgisinternal));

    -- A nomidan: hisoblar, kategoriya, o'tkazma + komissiya
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', ua::text, true);
    set local role authenticated;
    insert into public.hisoblar (id, nom, tur, belgi, rang) values (ha1, 'A1', 'karta', 'karta', '#1'), (ha2, 'A2', 'karta', 'karta', '#1');
    insert into public.kategoriyalar (id, nom, tur, rang, belgi) values (ka, 'Komissiya', 'xarajat', '#5C6BC0', 'percentage');
    -- o'tkazma 100 000 va unga bog'langan komissiya 1 000
    insert into public.yozuvlar (id, tur, summa, sana, vaqt, hisob_id, qabul_hisob_id, kategoriya_id, izoh) values (o1, 'otkazma', 100000, '2026-10-05', '10:30', ha1, ha2, null, '');
    insert into public.yozuvlar (id, tur, summa, sana, vaqt, hisob_id, kategoriya_id, izoh, bog_id) values (c1, 'xarajat', 1000, '2026-10-05', '10:30', ha1, ka, 'O''tkazma komissiyasi (1%)', o1);
    reset role;
    set constraints all immediate;
    select count(*) into n from public.yozuvlar where id = c1 and bog_id = o1;
    l := pg_temp.qo(l, 'Komissiya o''z o''tkazmasiga bog''lanadi (bog_id saqlandi)', n = 1);
    select count(*) into n from public.yozuvlar where id = o1 and bog_id is null;
    l := pg_temp.qo(l, 'O''tkazmaning o''zida bog_id bo''sh; eski qatorlar (bog_id yo''q) ishlaydi', n = 1);

    -- 2) Tartibdan mustaqil: komissiya o'tkazmadan OLDIN (bir tranzaksiyada) kelsa ham tranzaksiya oxirida tekshiruv o'tadi
    set constraints all deferred;
    set local role authenticated;
    insert into public.yozuvlar (id, tur, summa, sana, vaqt, hisob_id, kategoriya_id, izoh, bog_id) values (c2, 'xarajat', 500, '2026-10-05', '11:00', ha1, ka, '', o2);
    insert into public.yozuvlar (id, tur, summa, sana, vaqt, hisob_id, qabul_hisob_id, izoh) values (o2, 'otkazma', 50000, '2026-10-05', '11:00', ha1, ha2, '');
    reset role;
    ok := false;
    begin set constraints all immediate; ok := true; exception when others then ok := false; end;
    l := pg_temp.qo(l, 'Komissiya o''tkazmadan oldin yozilsa ham (bir tranzaksiyada) tashqi kalit tranzaksiya oxirida o''tadi', ok);

    -- 3) Mavjud bo'lmagan qatorga bog'lash rad etiladi (tranzaksiya oxirida)
    set constraints all deferred;
    set local role authenticated;
    ok := false;
    begin
      insert into public.yozuvlar (id, tur, summa, sana, hisob_id, kategoriya_id, bog_id) values (c5, 'xarajat', 1, '2026-10-05', ha1, ka, gen_random_uuid());
      reset role;
      set constraints all immediate;
    exception when foreign_key_violation then ok := true; when others then ok := false; end;
    reset role;
    l := pg_temp.qo(l, 'Mavjud bo''lmagan yozuvga bog''lash rad etiladi (foreign_key_violation)', ok);
    set constraints all immediate;

    -- 4) O'ziga ishora rad etiladi
    set local role authenticated;
    ok := false;
    begin insert into public.yozuvlar (id, tur, summa, sana, hisob_id, kategoriya_id, bog_id) values (c6, 'xarajat', 1, '2026-10-05', ha1, ka, c6);
    exception when check_violation then ok := true; when others then ok := false; end;
    reset role;
    l := pg_temp.qo(l, 'Yozuv o''ziga ishora qila olmaydi (check_violation)', ok);

    -- B ning ma'lumoti
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', ub::text, true);
    set local role authenticated;
    insert into public.hisoblar (id, nom, tur, belgi, rang) values (hb1, 'B1', 'karta', 'karta', '#1'), (hb2, 'B2', 'karta', 'karta', '#1');
    insert into public.kategoriyalar (id, nom, tur, rang, belgi) values (kb, 'Komissiya', 'xarajat', '#5C6BC0', 'percentage');
    insert into public.yozuvlar (id, tur, summa, sana, hisob_id, qabul_hisob_id, izoh) values (ob, 'otkazma', 70000, '2026-10-05', hb1, hb2, '');
    reset role;

    -- 5) A, B ning o'tkazmasiga bog'lay olmaydi (tashqi kalit (user_id, bog_id) juftligi bo'yicha)
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', ua::text, true);
    set constraints all deferred;
    set local role authenticated;
    ok := false;
    begin
      insert into public.yozuvlar (id, tur, summa, sana, hisob_id, kategoriya_id, bog_id) values (c5, 'xarajat', 1, '2026-10-05', ha1, ka, ob);
      reset role;
      set constraints all immediate;
    exception when foreign_key_violation then ok := true; when others then ok := false; end;
    reset role;
    set constraints all immediate;
    l := pg_temp.qo(l, 'A boshqa foydalanuvchi (B) o''tkazmasiga bog''lay olmaydi', ok);
    -- A mavjud o'z qatorini B ning qatoriga ulashga urinadi (update)
    set constraints all deferred;
    set local role authenticated;
    ok := false;
    begin
      update public.yozuvlar set bog_id = ob where id = c1;
      reset role;
      set constraints all immediate;
    exception when foreign_key_violation then ok := true; when others then ok := false; end;
    reset role;
    set constraints all immediate;
    l := pg_temp.qo(l, 'A o''z qatorini B ning qatoriga ulashga (update) urinsa ham rad etiladi', ok);

    -- 6) RLS: B, A ning komissiyasini ko'rmaydi va o'zgartira olmaydi
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', ub::text, true);
    set local role authenticated;
    select count(*) into n from public.yozuvlar where id in (c1, c2, o1, o2);
    update public.yozuvlar set bog_id = null where id = c1;
    get diagnostics m = row_count;
    reset role;
    l := pg_temp.qo(l, 'B A ning yozuvlarini (komissiya ham) ko''rmaydi va bog_id ni o''zgartira olmaydi', n = 0 and m = 0);
    select count(*) into n from public.yozuvlar where id = c1 and bog_id = o1;
    l := pg_temp.qo(l, 'A ning bog_id si joyida qoldi', n = 1);

    -- 7) Eski ilova nusxasi: bog_id ustunini yubormaydigan upsert (PostgREST faqat yuborilgan ustunlarni yangilaydi) serverdagi bog_id ni o'chirmaydi
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', ua::text, true);
    set local role authenticated;
    insert into public.yozuvlar (id, tur, summa, sana, vaqt, hisob_id, kategoriya_id, izoh) values (c1, 'xarajat', 1200, '2026-10-05', '10:30', ha1, ka, 'eski ilova tahriri')
      on conflict (id) do update set tur = excluded.tur, summa = excluded.summa, sana = excluded.sana, vaqt = excluded.vaqt, hisob_id = excluded.hisob_id, kategoriya_id = excluded.kategoriya_id, izoh = excluded.izoh;
    reset role;
    select count(*) into n from public.yozuvlar where id = c1 and bog_id = o1 and summa = 1200;
    l := pg_temp.qo(l, 'Ustunsiz (eski ilova) upsert summani yangilaydi, lekin bog_id ni o''chirmaydi', n = 1);
    -- yangi ilova nusxasi: bog_id bilan upsert (o'tkazma va komissiya birga)
    set local role authenticated;
    insert into public.yozuvlar (id, tur, summa, sana, vaqt, hisob_id, kategoriya_id, izoh, bog_id) values (c1, 'xarajat', 1000, '2026-10-05', '10:30', ha1, ka, 'O''tkazma komissiyasi (1%)', o1)
      on conflict (id) do update set summa = excluded.summa, izoh = excluded.izoh, bog_id = excluded.bog_id;
    reset role;
    select count(*) into n from public.yozuvlar where id = c1 and bog_id = o1 and summa = 1000;
    l := pg_temp.qo(l, 'bog_id bilan upsert (yangi ilova) ishlaydi', n = 1);

    -- 8) updated_at va user_id serverda belgilanadi (bog_id o'zgarganda ham)
    select updated_at into u1 from public.yozuvlar where id = c1;
    perform pg_sleep(0.01);
    set local role authenticated;
    update public.yozuvlar set izoh = 'o''zgardi' where id = c1;
    reset role;
    select updated_at into u2 from public.yozuvlar where id = c1;
    l := pg_temp.qo(l, 'updated_at serverda yangilanadi', u2 > u1);
    select count(*) into n from public.yozuvlar where id = c1 and user_id = ua;
    l := pg_temp.qo(l, 'user_id serverda belgilangan (A)', n = 1);

    -- 9) Tombstone tozalash bog'langan qatorlar bilan (xizmat funksiyasi)
    set constraints all immediate;
    set local role authenticated;
    insert into public.yozuvlar (id, tur, summa, sana, hisob_id, qabul_hisob_id, izoh, deleted) values (o3, 'otkazma', 10, '2026-07-01', ha1, ha2, '', true), (o4, 'otkazma', 20, '2026-07-01', ha1, ha2, '', true);
    insert into public.yozuvlar (id, tur, summa, sana, hisob_id, kategoriya_id, izoh, bog_id, deleted) values (c3, 'xarajat', 1, '2026-07-01', ha1, ka, '', o3, true), (c4, 'xarajat', 2, '2026-07-01', ha1, ka, '', o4, false);
    reset role;
    foreach j in array jadvallar loop execute format('alter table public.%I disable trigger chuntak_belgilash', j); end loop;
    update public.yozuvlar set updated_at = eski where id in (o3, c3, o4);
    foreach j in array jadvallar loop execute format('alter table public.%I enable trigger chuntak_belgilash', j); end loop;
    r := public.tombstone_tozalash(90);
    set constraints all immediate;
    select count(*) into n from public.yozuvlar where id in (o3, c3);
    l := pg_temp.qo(l, 'Tozalash: eski o''chirilgan o''tkazma va uning o''chirilgan komissiyasi BIRGA o''chdi (tashqi kalit xatosiz)', n = 0);
    select count(*) into n from public.yozuvlar where id in (o4, c4);
    l := pg_temp.qo(l, 'Tozalash: tirik komissiya ishora qilayotgan eski o''chirilgan o''tkazma SAQLANDI (tashqi kalit buzilmaydi)', n = 2);
    l := pg_temp.qo(l, 'Tozalash hisoboti: yozuvlar 2 ta', (r->>'yozuvlar')::int = 2);
    r := public.tombstone_tozalash(90);
    l := pg_temp.qo(l, 'Takror tozalash zararsiz (0)', (r->>'yozuvlar')::int = 0);
    l := pg_temp.qo(l, 'tombstone_tozalash(): authenticated va anon ga EXECUTE hamon YO''Q', not has_function_privilege('authenticated', 'public.tombstone_tozalash(integer)', 'execute') and not has_function_privilege('anon', 'public.tombstone_tozalash(integer)', 'execute'));

    -- 10) Hisobni o'chirish bog'langan qatorlar bilan ishlaydi (A o'chadi, B qoladi)
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', ua::text, true);
    set local role authenticated;
    r := public.hisobni_ochirish();
    reset role;
    set constraints all immediate;
    select count(*) into n from public.yozuvlar where user_id = ua;
    select count(*) into m from public.yozuvlar where id = ob;
    l := pg_temp.qo(l, 'hisobni_ochirish(): A ning bog''langan qatorlari ham o''chdi, B ning qatori qoldi', n = 0 and m = 1);

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

select * from pg_temp.bog_sinovi();
