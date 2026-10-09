-- =====================================================================
-- Chuntak AI — AI yordamchi limitini tekshirish
-- Fayl: supabase/008_ai_limit_testi.sql
-- Tekshiradi: ai_limit_oshir() faqat chaqiruvchining o'z hisobini oshiradi; jadvalga to'g'ridan-to'g'ri tegib bo'lmaydi;
-- anon va kirmagan chaqira olmaydi; hisob o'chirilsa qatorlar ham o'chadi. Sinov HECH NARSANI SAQLAMAYDI (oxirida bekor qilinadi).
-- Oldin 001 va 007 ishga tushirilgan bo'lishi kerak.
-- =====================================================================
create or replace function pg_temp.qo(a text[], nom text, ok boolean)
returns text[] language sql as $$
  select a || ((case when ok is true then 'O''TDI' else 'O''TMADI' end) || E'\t' || nom)
$$;

create or replace function pg_temp.ai_limit_sinovi()
returns table (raqam integer, tekshiruv text, natija text)
language plpgsql
as $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid();
  v integer; c integer; xato text;
  l text[] := '{}';
begin
  begin
    insert into auth.users (id, email) values (ua, 'a-ai@chuntak.invalid'), (ub, 'b-ai@chuntak.invalid');

    -- A sifatida
    perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', ua::text, true);
    set local role authenticated;
    v := public.ai_limit_oshir();
    l := pg_temp.qo(l, 'A: birinchi chaqiruv 1 qaytaradi', v = 1);
    v := public.ai_limit_oshir();
    l := pg_temp.qo(l, 'A: ikkinchi chaqiruv 2 qaytaradi', v = 2);
    begin perform 1 from public.ai_limit; xato := null; exception when others then xato := sqlstate; end;
    l := pg_temp.qo(l, 'A: jadvalni to''g''ridan-to''g''ri o''qib bo''lmaydi', xato = '42501');
    begin insert into public.ai_limit (user_id, kun, soni) values (ua, current_date, 0); xato := null; exception when others then xato := sqlstate; end;
    l := pg_temp.qo(l, 'A: jadvalga to''g''ridan-to''g''ri yozib bo''lmaydi', xato = '42501');
    reset role;

    -- B sifatida: hisobi A nikidan mustaqil
    perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', ub::text, true);
    set local role authenticated;
    v := public.ai_limit_oshir();
    l := pg_temp.qo(l, 'B: o''z hisobi 1 dan boshlanadi', v = 1);
    reset role;

    -- anon chaqira olmaydi
    set local role anon;
    begin perform public.ai_limit_oshir(); xato := null; exception when others then xato := sqlstate; end;
    l := pg_temp.qo(l, 'anon funksiyani chaqira olmaydi', xato = '42501');
    reset role;

    -- kirmagan (foydalanuvchi aniqlanmagan) authenticated rad etiladi
    perform set_config('request.jwt.claims', '', true);
    perform set_config('request.jwt.claim.sub', '', true);
    set local role authenticated;
    begin perform public.ai_limit_oshir(); xato := null; exception when others then xato := sqlstate; end;
    l := pg_temp.qo(l, 'kirmagan foydalanuvchi rad etiladi', xato = '28000');
    reset role;

    -- egasi sifatida: qatorlar va hisob o'chirilganda cascade
    select count(*) into c from public.ai_limit where user_id in (ua, ub);
    l := pg_temp.qo(l, 'Jadvalda 2 qator bor (A va B)', c = 2);
    select soni into v from public.ai_limit where user_id = ua;
    l := pg_temp.qo(l, 'A ning soni 2', v = 2);
    delete from auth.users where id = ua;
    select count(*) into c from public.ai_limit where user_id = ua;
    l := pg_temp.qo(l, 'Hisob o''chirilsa A ning qatori ham o''chadi', c = 0);
    select count(*) into c from public.ai_limit where user_id = ub;
    l := pg_temp.qo(l, 'B ning qatori saqlanadi', c = 1);

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

select * from pg_temp.ai_limit_sinovi();
