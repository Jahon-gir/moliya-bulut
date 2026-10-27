-- =====================================================================
-- Chuntak AI — eslatmalarni vaqtida yuborish: jurnal jadvali (ilova 0.50.0, TZ-sinxronlash.md 47-band)
-- Fayl: supabase/015_eslatma_jurnali.sql
--
-- Nima qiladi: yangi jadval `eslatma_jurnali` — qaysi qurilmaga qaysi eslatma qaysi sana uchun yuborilgani (takror yuborilmasligi uchun).
-- Edge Function `eslatma-yuborish` yuborishdan OLDIN `insert ... on conflict do nothing` qiladi va faqat haqiqatan qo'shilgan bo'lsa yuboradi.
-- Kalit: "kunlik" yoki "qarz:<qarz_id>:<k>" (k = 0, 1, 3). 14 kundan eski qatorlarni funksiya o'zi o'chiradi.
--
-- Bu jadval SINXRON TIZIMIDA EMAS (046-band kabi): `deleted` ustuni, outbox, tortib olish, eksport, zaxira, sinxron_holati() unga tegmaydi.
-- Hisobni o'chirish: auth.users -> bildirishnoma_qurilmalari -> eslatma_jurnali `on delete cascade` zanjiri bilan tozalanadi (003 o'zgarmaydi).
--
-- Ruxsat (Supabase 30-oktabrdan yangi jadvallarga Data API ruxsatini o'zi BERMAYDI — hammasi ANIQ yozilgan):
--  * eslatma_jurnali: RLS yoqiq va majburiy, siyosat YO'Q; anon va authenticated ga HECH NARSA (revoke all);
--    FAQAT service_role: select, insert, update, delete (Edge Function shu rol bilan ishlaydi).
--  * Funksiya `eslatma-yuborish` o'qiydigan mavjud jadvallar uchun service_role ga aniq grant: bildirishnoma_qurilmalari (select, delete),
--    qarzlar (select), qarz_tolovlari (select). Bu ruxsatlar anon/authenticated ga TEGMAYDI (ularniki o'zgarmaydi).
-- Qayerda ishga tushiriladi: Supabase → SQL Editor. Qayta ishga tushirish xavfsiz. Maxfiy kalit yoki parol bu faylda yo'q.
-- =====================================================================

create table if not exists public.eslatma_jurnali (
  qurilma_id  uuid not null references public.bildirishnoma_qurilmalari (id) on delete cascade,
  kalit       text not null,
  sana        date not null,
  created_at  timestamptz not null default now(),
  constraint eslatma_jurnali_pk primary key (qurilma_id, kalit, sana),    -- unique (qurilma_id, kalit, sana)
  constraint eslatma_jurnali_kalit_chk check (kalit = 'kunlik' or kalit ~ '^qarz:[0-9a-fA-F-]{36}:(0|1|3)$')
);
comment on table public.eslatma_jurnali is 'Yuborilgan eslatmalar jurnali (takror yuborilmasligi uchun). Sinxron tizimida emas; faqat service_role.';

create index if not exists eslatma_jurnali_created_idx on public.eslatma_jurnali (created_at);

alter table public.eslatma_jurnali enable row level security;
alter table public.eslatma_jurnali force row level security;
-- Ataylab siyosat YO'Q: anon va authenticated ga umuman yo'l yo'q (service_role RLS ni chetlab o'tadi)

revoke all on table public.eslatma_jurnali from public, anon, authenticated;
grant select, insert, update, delete on table public.eslatma_jurnali to service_role;

-- Funksiya o'qiydigan boshqa jadvallar: service_role ga aniq ruxsat (yangi loyihalarda avtomatik berilmaydi)
grant select, delete on table public.bildirishnoma_qurilmalari to service_role;
grant select on table public.qarzlar to service_role;
grant select on table public.qarz_tolovlari to service_role;

-- Tayyor. Keyingi qadam: supabase/015_eslatma_jurnali_testi.sql ni ishga tushirib tekshiring.
