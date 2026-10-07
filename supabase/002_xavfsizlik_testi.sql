-- =====================================================================
-- Chuntak AI — xavfsizlik testi (S1 bosqichi)
-- Fayl: supabase/002_xavfsizlik_testi.sql
--
-- Nima qiladi: ikkita sinov foydalanuvchini (A va B) taqlid qilib, 001_sxema.sql dagi himoyani tekshiradi.
-- Har tekshiruv uchun natija: O'TDI yoki O'TMADI.
--
-- Xavfsizlik: sinov HECH NARSANI SAQLAMAYDI. Hamma amal (sinov foydalanuvchilar va qatorlar ham)
-- bitta tranzaksiya ichida bajariladi va oxirida ROLLBACK qilinadi: pastdagi funksiya oxirida
-- ataylab xato chiqarib, ichki tranzaksiyani to'liq bekor qiladi. Sizning haqiqiy ma'lumotingizga tegilmaydi.
-- (Funksiya vaqtinchalik: pg_temp ichida, ulanish yopilganda yo'qoladi.)
--
-- Oldin 001_sxema.sql ishga tushirilgan bo'lishi kerak.
-- Natija pastdagi oxirgi so'rovdan jadval bo'lib chiqadi: "natija" ustunida O'TDI / O'TMADI.
-- =====================================================================

-- Natijani qatorga qo'shuvchi yordamchi
create or replace function pg_temp.qo(a text[], nom text, ok boolean)
returns text[] language sql as $$
  select a || ((case when ok is true then 'O''TDI' else 'O''TMADI' end) || E'\t' || nom)
$$;

create or replace function pg_temp.xavfsizlik_sinovi()
returns table (raqam integer, tekshiruv text, natija text)
language plpgsql
as $$
declare
  ua uuid := gen_random_uuid();   -- A foydalanuvchi
  ub uuid := gen_random_uuid();   -- B foydalanuvchi
  -- A ning qatorlari
  ha uuid := gen_random_uuid(); ka uuid := gen_random_uuid(); ya uuid := gen_random_uuid(); ba uuid := gen_random_uuid();
  qa uuid := gen_random_uuid(); ta uuid := gen_random_uuid(); sa uuid := gen_random_uuid();
  -- B ning qatorlari
  hb uuid := gen_random_uuid(); kb uuid := gen_random_uuid(); sb uuid := gen_random_uuid();
  jadvallar text[] := array['hisoblar', 'kategoriyalar', 'yozuvlar', 'byudjetlar', 'qarzlar', 'qarz_tolovlari', 'sozlamalar'];
  idlar uuid[];
  j text; i integer; n integer; m integer;
  ok boolean; xato text;
  v1 timestamptz; v2 timestamptz; c1 timestamptz;
  l text[] := '{}';
begin
  idlar := array[ha, ka, ya, ba, qa, ta, sa];
  begin  -- ichki blok: oxirida hammasi bekor qilinadi (ROLLBACK)

    set constraints all immediate;   -- tashqi kalit tekshiruvi darhol (aks holda tranzaksiya oxirigacha kutadi)

    -- ============ 0) Tayyorgarlik: ikki sinov foydalanuvchi (rollback bilan yo'qoladi) ============
    insert into auth.users (id, email) values (ua, 'a-sinov@chuntak.invalid'), (ub, 'b-sinov@chuntak.invalid');

    -- ============ 1) Tuzilma tekshiruvi (katalog) ============
    select count(*) into n from pg_class c join pg_namespace s on s.oid = c.relnamespace
      where s.nspname = 'public' and c.relname = any (jadvallar) and c.relrowsecurity and c.relforcerowsecurity;
    l := pg_temp.qo(l, 'Hamma 7 jadvalda RLS yoqilgan (va majburiy)', n = 7);

    select count(*) into n from pg_class c join pg_namespace s on s.oid = c.relnamespace
      where s.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity;
    l := pg_temp.qo(l, 'public sxemasida RLS o''chiq jadval yo''q', n = 0);

    foreach j in array jadvallar loop
      select count(*) into n from pg_policies where schemaname = 'public' and tablename = j and roles = array['authenticated']::name[];
      select count(*) into m from pg_policies where schemaname = 'public' and tablename = j;
      l := pg_temp.qo(l, j || ': 4 ta siyosat (select, insert, update, delete), faqat authenticated uchun', n = 4 and m = 4);

      ok := not (has_table_privilege('anon', 'public.' || j, 'select') or has_table_privilege('anon', 'public.' || j, 'insert')
              or has_table_privilege('anon', 'public.' || j, 'update') or has_table_privilege('anon', 'public.' || j, 'delete')
              or has_table_privilege('anon', 'public.' || j, 'truncate') or has_table_privilege('anon', 'public.' || j, 'references')
              or has_table_privilege('anon', 'public.' || j, 'trigger'));
      l := pg_temp.qo(l, j || ': anon roliga HECH QANDAY ruxsat berilmagan', ok);

      ok := has_table_privilege('authenticated', 'public.' || j, 'select') and has_table_privilege('authenticated', 'public.' || j, 'insert')
        and has_table_privilege('authenticated', 'public.' || j, 'update') and has_table_privilege('authenticated', 'public.' || j, 'delete')
        and not (has_table_privilege('authenticated', 'public.' || j, 'truncate') or has_table_privilege('authenticated', 'public.' || j, 'references')
                 or has_table_privilege('authenticated', 'public.' || j, 'trigger'));
      l := pg_temp.qo(l, j || ': authenticated roliga faqat select, insert, update, delete', ok);
    end loop;

    select count(*) into n from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace s on s.oid = c.relnamespace
      where s.nspname = 'public' and c.relname = any (jadvallar) and t.tgname = 'chuntak_belgilash' and t.tgenabled = 'O' and not t.tgisinternal;
    l := pg_temp.qo(l, 'Hamma 7 jadvalda server triggeri (user_id, created_at, updated_at) yoqilgan', n = 7);

    select count(*) into n from information_schema.columns
      where table_schema = 'public' and table_name = any (jadvallar)
        and (column_name ~ 'balans' or column_name ~ 'qoldiq') and column_name not in ('boshlangich_qoldiq', 'balans_yashirin');
    l := pg_temp.qo(l, 'Balans va joriy qoldiq ustuni yo''q (ilovada hisoblanadi)', n = 0);

    select count(*) into n from information_schema.columns
      where table_schema = 'public' and table_name = any (jadvallar) and column_name in ('id', 'user_id', 'created_at', 'updated_at', 'deleted');
    l := pg_temp.qo(l, 'Har jadvalda id, user_id, created_at, updated_at, deleted bor (7 x 5 = 35)', n = 35);

    -- ============ 2) A o'z qatorlarini qo'sha oladi va o'qiy oladi ============
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', ua::text, true);
    set local role authenticated;

    ok := true;
    begin
      insert into public.hisoblar (id, nom, tur, belgi, rang) values (ha, 'A naqd', 'naqd', 'naqd', '#43a047');   -- user_id yuborilmaydi
      insert into public.kategoriyalar (id, nom, tur, rang, belgi) values (ka, 'A oziq-ovqat', 'xarajat', '#e57373', 'oziq');
      insert into public.yozuvlar (id, tur, summa, sana, vaqt, hisob_id, kategoriya_id, izoh) values (ya, 'xarajat', 12000, '2026-10-05', '10:30', ha, ka, 'A ning maxfiy izohi');
      insert into public.byudjetlar (id, kategoriya_id, oylik_limit) values (ba, ka, 500000);
      insert into public.qarzlar (id, yonalish, shaxs, summa, hisob_id, sana) values (qa, 'berdim', 'Ali', 200000, ha, '2026-10-04');
      insert into public.qarz_tolovlari (id, qarz_id, sana, summa, hisob_id) values (ta, qa, '2026-10-05', 50000, ha);
      insert into public.sozlamalar (id, sxema_versiyasi) values (sa, 6);
    exception when others then
      ok := false; xato := sqlerrm;
    end;
    reset role;
    l := pg_temp.qo(l, 'A o''z qatorlarini qo''sha oladi (7 jadvalning hammasiga, user_id yubormasdan)' || coalesce(' [' || xato || ']', ''), ok);

    -- B ning o'z qatorlari (A ning ma'lumotidan alohida)
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', ub::text, true);
    set local role authenticated;
    ok := true; xato := null;
    begin
      insert into public.hisoblar (id, nom, tur, belgi, rang) values (hb, 'B naqd', 'naqd', 'naqd', '#43a047');
      insert into public.kategoriyalar (id, nom, tur, rang, belgi) values (kb, 'B transport', 'xarajat', '#64b5f6', 'transport');
      insert into public.sozlamalar (id, sxema_versiyasi) values (sb, 6);
    exception when others then
      ok := false; xato := sqlerrm;
    end;
    reset role;
    l := pg_temp.qo(l, 'B ham o''z qatorlarini qo''sha oladi' || coalesce(' [' || xato || ']', ''), ok);

    -- user_id serverda auth.uid() ga tenglashtirilgan
    select count(*) into n from public.hisoblar where id = ha and user_id = ua;
    select count(*) into m from public.yozuvlar where id = ya and user_id = ua;
    l := pg_temp.qo(l, 'user_id serverda auth.uid() ga tenglashtirilgan (A ning qatorlari A niki)', n = 1 and m = 1);

    -- A o'z qatorini o'qiy oladi
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', ua::text, true);
    set local role authenticated;
    foreach j in array jadvallar loop
      i := array_position(jadvallar, j);
      execute format('select count(*) from public.%I where id = $1', j) into n using idlar[i];
      execute format('select count(*) from public.%I', j) into m;
      l := pg_temp.qo(l, j || ': A o''z qatorini o''qiy oladi', n = 1 and m >= 1);
    end loop;
    select (izoh = 'A ning maxfiy izohi' and summa = 12000) into ok from public.yozuvlar where id = ya;
    reset role;
    l := pg_temp.qo(l, 'A o''z yozuvining ma''lumotini to''liq o''qiydi', ok is true);

    -- ============ 3) B A ning qatorlarini ko'ra olmaydi, o'zgartira olmaydi, o'chira olmaydi ============
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', ub::text, true);
    set local role authenticated;
    foreach j in array jadvallar loop
      i := array_position(jadvallar, j);
      execute format('select count(*) from public.%I where id = $1', j) into n using idlar[i];
      l := pg_temp.qo(l, j || ': B A ning qatorini KO''RA OLMAYDI', n = 0);
    end loop;
    select count(*) into n from public.hisoblar;
    select count(*) into m from public.yozuvlar;
    l := pg_temp.qo(l, 'B faqat o''z qatorlarini ko''radi (hisoblar: 1 ta, yozuvlar: 0 ta)', n = 1 and m = 0);

    ok := true;
    foreach j in array jadvallar loop
      i := array_position(jadvallar, j);
      execute format('update public.%I set deleted = true where id = $1', j) using idlar[i];
      get diagnostics n = row_count;
      if n <> 0 then ok := false; end if;
    end loop;
    l := pg_temp.qo(l, 'B A ning qatorlarini O''ZGARTIRA OLMAYDI (7 jadval, 0 qator o''zgargan)', ok);

    ok := true;
    foreach j in array jadvallar loop
      i := array_position(jadvallar, j);
      execute format('delete from public.%I where id = $1', j) using idlar[i];
      get diagnostics n = row_count;
      if n <> 0 then ok := false; end if;
    end loop;
    l := pg_temp.qo(l, 'B A ning qatorlarini O''CHIRA OLMAYDI (7 jadval, 0 qator o''chgan)', ok);
    reset role;

    -- A ning ma'lumoti joyida (B hech narsani buzmagan)
    select count(*) into n from public.hisoblar where id = ha and nom = 'A naqd' and not deleted;
    select count(*) into m from public.yozuvlar where id = ya and not deleted;
    l := pg_temp.qo(l, 'B urinishlaridan keyin A ning ma''lumoti o''zgarmagan', n = 1 and m = 1);

    -- B A ning hisobi/kategoriyasi/qarziga o'z qatorini bog'lay olmaydi (tashqi kalit faqat o'ziga)
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', ub::text, true);
    set local role authenticated;
    ok := false;
    begin
      insert into public.yozuvlar (tur, summa, sana, hisob_id, kategoriya_id) values ('xarajat', 1000, '2026-10-05', ha, kb);
      raise exception 'KUTILMAGAN_OK' using errcode = 'ZZ001';
    exception when others then ok := (sqlstate = '23503');
    end;
    reset role;
    l := pg_temp.qo(l, 'B yozuvini A ning hisobiga bog''lay olmaydi (tashqi kalit xatosi)', ok);
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    set local role authenticated;
    ok := false;
    begin
      insert into public.qarz_tolovlari (qarz_id, sana, summa, hisob_id) values (qa, '2026-10-05', 1000, hb);
      raise exception 'KUTILMAGAN_OK' using errcode = 'ZZ001';
    exception when others then ok := (sqlstate = '23503');
    end;
    reset role;
    l := pg_temp.qo(l, 'B to''lovini A ning qarziga bog''lay olmaydi (tashqi kalit xatosi)', ok);

    -- ============ 4) A boshqaning user_id si bilan qator qo'sha olmaydi ============
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', ua::text, true);
    set local role authenticated;
    ok := false;
    begin
      insert into public.hisoblar (user_id, nom, tur, belgi, rang) values (ub, 'A dan B ga', 'naqd', 'naqd', '#000000');
      raise exception 'KUTILMAGAN_OK' using errcode = 'ZZ001';
    exception when others then ok := (sqlstate = '42501');
    end;
    reset role;
    select count(*) into n from public.hisoblar where nom = 'A dan B ga';
    l := pg_temp.qo(l, 'A B ning user_id si bilan qator qo''sha olmaydi (rad etiladi, qator paydo bo''lmaydi)', ok and n = 0);

    -- Himoyaning ikkinchi qatlami: server triggeri o'chiq bo'lsa ham RLS (WITH CHECK) to'sadi
    begin alter table public.hisoblar disable trigger chuntak_belgilash; exception when others then null; end;   -- trigger yo'q bo'lsa ham sinov davom etadi
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    set local role authenticated;
    ok := false;
    begin
      insert into public.hisoblar (user_id, nom, tur, belgi, rang) values (ub, 'RLS sinovi', 'naqd', 'naqd', '#000000');
      raise exception 'KUTILMAGAN_OK' using errcode = 'ZZ001';
    exception when others then ok := (sqlstate = '42501' and sqlerrm like '%row-level security%');
    end;
    reset role;
    l := pg_temp.qo(l, 'Trigger o''chiq bo''lsa ham: RLS (WITH CHECK) boshqaning user_id si bilan INSERT ni rad etadi', ok);
    set local role authenticated;
    ok := false;
    begin
      update public.hisoblar set user_id = ub where id = ha;
      raise exception 'KUTILMAGAN_OK' using errcode = 'ZZ001';
    exception when others then ok := (sqlstate = '42501' and sqlerrm like '%row-level security%');
    end;
    reset role;
    l := pg_temp.qo(l, 'Trigger o''chiq bo''lsa ham: RLS (WITH CHECK) user_id ni boshqaga o''zgartirishni rad etadi', ok);
    begin alter table public.hisoblar enable trigger chuntak_belgilash; exception when others then null; end;

    -- ============ 5) Kirmagan (anon) hech narsa ko'ra olmaydi va yoza olmaydi ============
    perform set_config('request.jwt.claims', '', true);
    perform set_config('request.jwt.claim.sub', '', true);
    set local role anon;
    foreach j in array jadvallar loop
      ok := true;
      begin execute format('select count(*) from public.%I', j); ok := false; exception when others then if sqlstate <> '42501' then ok := false; end if; end;
      begin execute format('insert into public.%I (id) values (gen_random_uuid())', j); ok := false; exception when others then if sqlstate <> '42501' then ok := false; end if; end;
      begin execute format('update public.%I set deleted = true', j); ok := false; exception when others then if sqlstate <> '42501' then ok := false; end if; end;
      begin execute format('delete from public.%I', j); ok := false; exception when others then if sqlstate <> '42501' then ok := false; end if; end;
      reset role;
      l := pg_temp.qo(l, j || ': anon (kirmagan) o''qiy olmaydi, qo''sha, o''zgartira va o''chira olmaydi (ruxsat yo''q)', ok);
      set local role anon;
    end loop;
    reset role;

    -- Roli authenticated, lekin foydalanuvchi aniqlanmagan (auth.uid() = NULL): hech narsa ko'rinmaydi, yozib bo'lmaydi
    perform set_config('request.jwt.claims', '', true);
    perform set_config('request.jwt.claim.sub', '', true);
    set local role authenticated;
    select count(*) into n from public.hisoblar;
    select count(*) into m from public.yozuvlar;
    ok := false;
    begin
      insert into public.hisoblar (nom, tur, belgi, rang) values ('Egasiz', 'naqd', 'naqd', '#000000');
      raise exception 'KUTILMAGAN_OK' using errcode = 'ZZ001';
    exception when others then ok := (sqlstate = '42501');
    end;
    reset role;
    l := pg_temp.qo(l, 'Foydalanuvchisiz (auth.uid() NULL) so''rov: qator ko''rinmaydi va qo''shib bo''lmaydi', n = 0 and m = 0 and ok);

    -- ============ 6) user_id, created_at (va id) o'zgartirib bo'lmaydi; updated_at serverda ============
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', ua::text, true);
    set local role authenticated;
    foreach j in array array['user_id', 'created_at', 'id'] loop
      ok := false;
      begin
        if j = 'user_id' then update public.hisoblar set user_id = ub where id = ha;
        elsif j = 'created_at' then update public.hisoblar set created_at = '2001-01-01' where id = ha;
        else update public.hisoblar set id = gen_random_uuid() where id = ha;
        end if;
        raise exception 'KUTILMAGAN_OK' using errcode = 'ZZ001';
      exception when others then ok := (sqlstate = '42501');
      end;
      reset role;
      l := pg_temp.qo(l, 'A o''z qatorida ' || j || ' ni o''zgartira olmaydi', ok);
      set local role authenticated;
    end loop;
    reset role;

    -- updated_at / created_at: qurilma yuborgan qiymat e'tiborga olinmaydi
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', ua::text, true);
    set local role authenticated;
    insert into public.kategoriyalar (id, nom, tur, rang, belgi, created_at, updated_at)
      values (gen_random_uuid(), 'Soat sinovi', 'daromad', '#43a047', 'ishhaqi', '2001-01-01', '2001-01-01');
    select created_at, updated_at into c1, v1 from public.kategoriyalar where nom = 'Soat sinovi';
    reset role;
    l := pg_temp.qo(l, 'INSERT: created_at va updated_at serverda belgilandi (qurilma yuborgan 2001-yil e''tiborga olinmadi)',
      c1 > now() - interval '1 day' and v1 > now() - interval '1 day' and c1 = v1);

    perform pg_sleep(0.05);
    set local role authenticated;
    update public.kategoriyalar set nom = 'Soat sinovi 2', updated_at = '2001-01-01' where nom = 'Soat sinovi';
    select updated_at into v2 from public.kategoriyalar where nom = 'Soat sinovi 2';
    select created_at into c1 from public.kategoriyalar where nom = 'Soat sinovi 2';
    reset role;
    l := pg_temp.qo(l, 'UPDATE: updated_at serverda yangilandi (qurilma 2001 yuborsa ham), created_at o''zgarmadi',
      v2 > v1 and v2 > now() - interval '1 day' and c1 = (select created_at from public.kategoriyalar where nom = 'Soat sinovi 2'));

    -- ============ 7) A o'z qatorini o'zgartira va o'chira oladi ============
    set local role authenticated;
    update public.hisoblar set nom = 'A naqd (yangi)' where id = ha;
    get diagnostics n = row_count;
    update public.yozuvlar set deleted = true where id = ya;           -- mantiqiy o'chirish
    get diagnostics m = row_count;
    reset role;
    l := pg_temp.qo(l, 'A o''z qatorini o''zgartira oladi va mantiqiy o''chira oladi (deleted = true)', n = 1 and m = 1);

    set local role authenticated;
    delete from public.qarz_tolovlari where id = ta;
    get diagnostics n = row_count;
    reset role;
    l := pg_temp.qo(l, 'A o''z qatorini butunlay o''chira oladi (DELETE siyosati)', n = 1);

    -- ============ 8) Ma'lumot cheklovlari (TZ.md 7-band) ============
    set local role authenticated;
    foreach j in array array['summa0', 'otkazma_bir_hisob', 'xarajat_kategoriyasiz', 'oxirgi4', 'tur', 'ikkinchi_sozlama'] loop
      ok := false;
      begin
        if j = 'summa0' then insert into public.yozuvlar (tur, summa, sana, hisob_id, kategoriya_id) values ('xarajat', 0, '2026-10-05', ha, ka);
        elsif j = 'otkazma_bir_hisob' then insert into public.yozuvlar (tur, summa, sana, hisob_id, qabul_hisob_id) values ('otkazma', 10, '2026-10-05', ha, ha);
        elsif j = 'xarajat_kategoriyasiz' then insert into public.yozuvlar (tur, summa, sana, hisob_id) values ('xarajat', 10, '2026-10-05', ha);
        elsif j = 'oxirgi4' then insert into public.hisoblar (nom, tur, belgi, rang, oxirgi4) values ('Karta', 'karta', 'karta', '#1e88e5', '4276123456789012');
        elsif j = 'tur' then insert into public.kategoriyalar (nom, tur, rang, belgi) values ('Xato tur', 'boshqa', '#000000', 'umumiy');
        else insert into public.sozlamalar (sxema_versiyasi) values (6);
        end if;
        raise exception 'KUTILMAGAN_OK' using errcode = 'ZZ001';
      exception when others then ok := (sqlstate in ('23514', '23505'));
      end;
      reset role;
      l := pg_temp.qo(l, 'Cheklov: ' || case j when 'summa0' then 'summa 0 bo''lishi mumkin emas' when 'otkazma_bir_hisob' then 'o''tkazma bir hisobning o''zida bo''lmaydi'
        when 'xarajat_kategoriyasiz' then 'xarajatda kategoriya majburiy' when 'oxirgi4' then 'to''liq karta raqami (faqat oxirgi 4 raqam) saqlanmaydi'
        when 'tur' then 'noto''g''ri kategoriya turi rad etiladi' else 'har foydalanuvchiga bitta sozlama qatori' end, ok);
      set local role authenticated;
    end loop;
    reset role;

    -- ============ 9) Hisobni o'chirish: foydalanuvchi o'chsa, uning hamma qatori o'chadi, B niki qoladi ============
    delete from auth.users where id = ua;
    set constraints all immediate;
    select count(*) into n from public.hisoblar where user_id = ua;
    select count(*) into m from public.yozuvlar where user_id = ua;
    select count(*) into i from public.hisoblar where user_id = ub;
    l := pg_temp.qo(l, 'Foydalanuvchi o''chirilsa, uning hamma qatori ham o''chadi (A: 0 ta), B ning ma''lumoti qoladi', n = 0 and m = 0 and i = 1);

    -- Sinov tugadi: ataylab xato bilan ICHKI TRANZAKSIYANI BEKOR QILAMIZ (ROLLBACK): hech narsa saqlanmaydi
    raise exception 'SINOV_TUGADI' using errcode = 'ZZ002';

  exception
    when sqlstate 'ZZ002' then null;   -- kutilgan tugash: hamma o'zgarish bekor qilindi
    when others then
      l := l || ('O''TMADI' || E'\t' || 'Kutilmagan xato: ' || sqlerrm);
  end;

  -- Natija (o'zgaruvchi tranzaksiya bekor qilinsa ham saqlanadi)
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

-- Sinovni ishga tushirish (natija jadval bo'lib chiqadi)
select * from pg_temp.xavfsizlik_sinovi();
