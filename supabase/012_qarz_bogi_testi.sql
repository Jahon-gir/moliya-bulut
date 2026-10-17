-- =====================================================================
-- Chuntak AI — qarz bog'ini (qarz_bog_id) tekshirish (ilova 0.45.0, qarz komissiyasi)
-- Fayl: supabase/012_qarz_bogi_testi.sql
-- Tekshiradi: ustun va tashqi kalit; bog'lanish faqat o'z egasi qarziga; tartibdan mustaqillik (bir tranzaksiyada); bog_id bilan birga bo'lmasligi;
-- ustunni yubormagan (eski) so'rov qarz_bog_id ni o'chirmaydi; RLS; tombstone tozalash; hisobni o'chirish.
-- Sinov HECH NARSANI SAQLAMAYDI (oxirida ROLLBACK). Oldin 001, 003, 005, 009 va 011 ishga tushirilgan bo'lishi kerak.
-- =====================================================================
create or replace function pg_temp.qo(a text[], nom text, ok boolean)
returns text[] language sql as $$
  select a || ((case when ok is true then 'O''TDI' else 'O''TMADI' end) || E'\t' || nom)
$$;

create or replace function pg_temp.qarz_bog_sinovi()
returns table (raqam integer, tekshiruv text, natija text)
language plpgsql
as $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid();
  ha uuid := gen_random_uuid(); ka uuid := gen_random_uuid(); hb uuid := gen_random_uuid();
  qa1 uuid := gen_random_uuid(); ca1 uuid := gen_random_uuid();   -- A: qarz va komissiya
  qa2 uuid := gen_random_uuid(); ca2 uuid := gen_random_uuid();   -- A: tartib sinovi (komissiya avval)
  qa3 uuid := gen_random_uuid(); ca3 uuid := gen_random_uuid();   -- A: tozalash: eski o'chirilgan ikkalasi
  qa4 uuid := gen_random_uuid(); ca4 uuid := gen_random_uuid();   -- A: tozalash: eski o'chirilgan qarz, TIRIK komissiya
  qb uuid := gen_random_uuid(); ya uuid := gen_random_uuid();
  c5 uuid := gen_random_uuid(); c6 uuid := gen_random_uuid(); c7 uuid := gen_random_uuid();
  n integer; m integer; ok boolean; r jsonb;
  eski timestamptz := now() - interval '120 days';
  jadvallar text[] := array['hisoblar', 'kategoriyalar', 'yozuvlar', 'byudjetlar', 'qarzlar', 'qarz_tolovlari', 'sozlamalar'];
  j text;
  l text[] := '{}';
begin
  begin
    set constraints all immediate;
    insert into auth.users (id, email) values (ua, 'a-qbog@chuntak.invalid'), (ub, 'b-qbog@chuntak.invalid');

    -- 1) Ustun, indeks, tashqi kalit, check
    l := pg_temp.qo(l, 'yozuvlar.qarz_bog_id: uuid, bo''sh bo''lishi mumkin', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'yozuvlar' and column_name = 'qarz_bog_id' and data_type = 'uuid' and is_nullable = 'YES'));
    l := pg_temp.qo(l, 'Indeks yozuvlar_qarz_bog bor', exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'yozuvlar' and indexname = 'yozuvlar_qarz_bog'));
    l := pg_temp.qo(l, 'Tashqi kalit (user_id, qarz_bog_id) -> qarzlar bor va kechiktirilgan', exists (select 1 from pg_constraint where conname = 'yozuvlar_qarz_bog_fk' and contype = 'f' and condeferrable and condeferred and confrelid = 'public.qarzlar'::regclass));
    l := pg_temp.qo(l, 'RLS yoqilgan va majburiy (yozuvlar), anon ga hech narsa yo''q', (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.yozuvlar'::regclass) and not has_table_privilege('anon', 'public.yozuvlar', 'select'));
    l := pg_temp.qo(l, 'Trigger chuntak_belgilash o''zgarmagan', exists (select 1 from pg_trigger where tgrelid = 'public.yozuvlar'::regclass and tgname = 'chuntak_belgilash' and not tgisinternal));

    -- A: hisob, kategoriya, qarz (qaytariladigan 102 900) va komissiya (2 900)
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', ua::text, true);
    set local role authenticated;
    insert into public.hisoblar (id, nom, tur, belgi, rang) values (ha, 'A1', 'karta', 'karta', '#1');
    insert into public.kategoriyalar (id, nom, tur, rang, belgi) values (ka, 'Komissiyalar', 'xarajat', '#5C6BC0', 'percentage');
    insert into public.qarzlar (id, yonalish, shaxs, summa, hisob_id, sana) values (qa1, 'oldim', 'Mikroqarz', 102900, ha, '2026-10-05');
    insert into public.yozuvlar (id, tur, summa, sana, vaqt, hisob_id, kategoriya_id, izoh, qarz_bog_id) values (ca1, 'xarajat', 2900, '2026-10-05', '10:30', ha, ka, 'Qarz komissiyasi (2,9%)', qa1);
    reset role;
    set constraints all immediate;
    select count(*) into n from public.yozuvlar where id = ca1 and qarz_bog_id = qa1;
    l := pg_temp.qo(l, 'Komissiya o''z qarziga bog''lanadi (qarz_bog_id saqlandi)', n = 1);

    -- 2) Tartibdan mustaqil: komissiya qarzdan OLDIN (bir tranzaksiyada)
    set constraints all deferred;
    set local role authenticated;
    insert into public.yozuvlar (id, tur, summa, sana, hisob_id, kategoriya_id, qarz_bog_id) values (ca2, 'xarajat', 100, '2026-10-05', ha, ka, qa2);
    insert into public.qarzlar (id, yonalish, shaxs, summa, hisob_id, sana) values (qa2, 'oldim', 'Boshqa', 1100, ha, '2026-10-05');
    reset role;
    ok := false;
    begin set constraints all immediate; ok := true; exception when others then ok := false; end;
    l := pg_temp.qo(l, 'Komissiya qarzdan oldin yozilsa ham (bir tranzaksiyada) tashqi kalit tranzaksiya oxirida o''tadi', ok);

    -- 3) Mavjud bo'lmagan qarzga bog'lash rad etiladi
    set constraints all deferred;
    set local role authenticated;
    ok := false;
    begin
      insert into public.yozuvlar (id, tur, summa, sana, hisob_id, kategoriya_id, qarz_bog_id) values (c5, 'xarajat', 1, '2026-10-05', ha, ka, gen_random_uuid());
      reset role;
      set constraints all immediate;
    exception when foreign_key_violation then ok := true; when others then ok := false; end;
    reset role;
    set constraints all immediate;
    l := pg_temp.qo(l, 'Mavjud bo''lmagan qarzga bog''lash rad etiladi (foreign_key_violation)', ok);

    -- 4) bog_id va qarz_bog_id birga bo'lmaydi
    set local role authenticated;
    ok := false;
    begin insert into public.yozuvlar (id, tur, summa, sana, hisob_id, kategoriya_id, bog_id, qarz_bog_id) values (c6, 'xarajat', 1, '2026-10-05', ha, ka, ca1, qa1);
    exception when check_violation then ok := true; when others then ok := false; end;
    reset role;
    l := pg_temp.qo(l, 'Yozuv bir vaqtda ham o''tkazmaga, ham qarzga bog''lana olmaydi (check_violation)', ok);

    -- B ning qarzi
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', ub::text, true);
    set local role authenticated;
    insert into public.hisoblar (id, nom, tur, belgi, rang) values (hb, 'B1', 'karta', 'karta', '#1');
    insert into public.qarzlar (id, yonalish, shaxs, summa, hisob_id, sana) values (qb, 'oldim', 'B qarz', 500, hb, '2026-10-05');
    reset role;

    -- 5) A, B ning qarziga bog'lay olmaydi
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', ua::text, true);
    set constraints all deferred;
    set local role authenticated;
    ok := false;
    begin
      insert into public.yozuvlar (id, tur, summa, sana, hisob_id, kategoriya_id, qarz_bog_id) values (c7, 'xarajat', 1, '2026-10-05', ha, ka, qb);
      reset role;
      set constraints all immediate;
    exception when foreign_key_violation then ok := true; when others then ok := false; end;
    reset role;
    set constraints all immediate;
    l := pg_temp.qo(l, 'A boshqa foydalanuvchi (B) qarziga bog''lay olmaydi', ok);
    set constraints all deferred;
    set local role authenticated;
    ok := false;
    begin
      update public.yozuvlar set qarz_bog_id = qb where id = ca1;
      reset role;
      set constraints all immediate;
    exception when foreign_key_violation then ok := true; when others then ok := false; end;
    reset role;
    set constraints all immediate;
    l := pg_temp.qo(l, 'A o''z yozuvini B ning qarziga ulashga (update) urinsa ham rad etiladi', ok);

    -- 6) RLS: B, A ning komissiyasini ko'rmaydi va o'zgartira olmaydi
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', ub::text, true);
    set local role authenticated;
    select count(*) into n from public.yozuvlar where id in (ca1, ca2);
    update public.yozuvlar set qarz_bog_id = null where id = ca1;
    get diagnostics m = row_count;
    reset role;
    l := pg_temp.qo(l, 'B A ning komissiyasini ko''rmaydi va qarz_bog_id ni o''zgartira olmaydi', n = 0 and m = 0);

    -- 7) Eski ilova: ustunsiz upsert qarz_bog_id ni o'chirmaydi
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', ua::text, true);
    set local role authenticated;
    insert into public.yozuvlar (id, tur, summa, sana, vaqt, hisob_id, kategoriya_id, izoh) values (ca1, 'xarajat', 3000, '2026-10-05', '10:30', ha, ka, 'eski ilova tahriri')
      on conflict (id) do update set summa = excluded.summa, izoh = excluded.izoh;
    reset role;
    select count(*) into n from public.yozuvlar where id = ca1 and qarz_bog_id = qa1 and summa = 3000;
    l := pg_temp.qo(l, 'Ustunsiz (eski ilova) upsert summani yangilaydi, lekin qarz_bog_id ni o''chirmaydi', n = 1);
    set local role authenticated;
    insert into public.yozuvlar (id, tur, summa, sana, vaqt, hisob_id, kategoriya_id, izoh, qarz_bog_id) values (ca1, 'xarajat', 2900, '2026-10-05', '10:30', ha, ka, 'Qarz komissiyasi (2,9%)', qa1)
      on conflict (id) do update set summa = excluded.summa, izoh = excluded.izoh, qarz_bog_id = excluded.qarz_bog_id;
    reset role;
    select count(*) into n from public.yozuvlar where id = ca1 and qarz_bog_id = qa1 and summa = 2900;
    l := pg_temp.qo(l, 'qarz_bog_id bilan upsert (yangi ilova) ishlaydi', n = 1);

    -- 8) Tombstone tozalash
    set local role authenticated;
    insert into public.qarzlar (id, yonalish, shaxs, summa, hisob_id, sana, deleted) values (qa3, 'oldim', 'Eski', 10, ha, '2026-07-01', true), (qa4, 'oldim', 'Eski2', 20, ha, '2026-07-01', true);
    insert into public.yozuvlar (id, tur, summa, sana, hisob_id, kategoriya_id, qarz_bog_id, deleted) values (ca3, 'xarajat', 1, '2026-07-01', ha, ka, qa3, true), (ca4, 'xarajat', 2, '2026-07-01', ha, ka, qa4, false);
    reset role;
    foreach j in array jadvallar loop execute format('alter table public.%I disable trigger chuntak_belgilash', j); end loop;
    update public.qarzlar set updated_at = eski where id in (qa3, qa4);
    update public.yozuvlar set updated_at = eski where id in (ca3);
    foreach j in array jadvallar loop execute format('alter table public.%I enable trigger chuntak_belgilash', j); end loop;
    r := public.tombstone_tozalash(90);
    set constraints all immediate;
    select count(*) into n from public.qarzlar where id = qa3; select count(*) into m from public.yozuvlar where id = ca3;
    l := pg_temp.qo(l, 'Tozalash: eski o''chirilgan qarz va uning o''chirilgan komissiyasi BIRGA o''chdi (tashqi kalit xatosiz)', n = 0 and m = 0);
    select count(*) into n from public.qarzlar where id = qa4; select count(*) into m from public.yozuvlar where id = ca4;
    l := pg_temp.qo(l, 'Tozalash: tirik komissiya ishora qilayotgan eski o''chirilgan qarz SAQLANDI', n = 1 and m = 1);
    r := public.tombstone_tozalash(90);
    l := pg_temp.qo(l, 'Takror tozalash zararsiz (0 yozuv, 0 qarz)', (r->>'yozuvlar')::int = 0 and (r->>'qarzlar')::int = 0);
    l := pg_temp.qo(l, 'tombstone_tozalash(): authenticated va anon ga EXECUTE hamon YO''Q', not has_function_privilege('authenticated', 'public.tombstone_tozalash(integer)', 'execute') and not has_function_privilege('anon', 'public.tombstone_tozalash(integer)', 'execute'));

    -- 9) Hisobni o'chirish
    set local role authenticated;
    r := public.hisobni_ochirish();
    reset role;
    set constraints all immediate;
    select count(*) into n from public.yozuvlar where user_id = ua; select count(*) into m from public.qarzlar where user_id = ua;
    l := pg_temp.qo(l, 'hisobni_ochirish(): A ning qarz va komissiya qatorlari o''chdi, B ning qarzi qoldi', n = 0 and m = 0 and (select count(*) from public.qarzlar where id = qb) = 1);

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

select * from pg_temp.qarz_bog_sinovi();
