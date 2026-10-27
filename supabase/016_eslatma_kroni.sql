-- =====================================================================
-- ##################################################################
-- ##  DIQQAT: ISHGA TUSHIRISHDAN OLDIN IKKITA O'RINBOSARNI ALMASHTIRING  ##
-- ##    <<LOYIHA_MANZILI>>  ->  https://<loyiha>.supabase.co  (oxirida "/" yo'q)  ##
-- ##    <<CRON_SIRRI>>      ->  Secrets'dagi CRON_SIRRI qiymati bilan AYNAN bir xil  ##
-- ##  ALMASHTIRILGAN FAYLNI SAQLAMANG, GitHub'ga YUBORMANG, hech kimga bermang.  ##
-- ##  (Almashtirish SQL Editor oynasida qilinadi; oyna yopilgach matn yo'qoladi.)  ##
-- ##################################################################
--
-- Chuntak AI — eslatmalarni vaqtida yuborish: cron (ilova 0.50.0, TZ-sinxronlash.md 47-band)
-- Fayl: supabase/016_eslatma_kroni.sql
--
-- Nima qiladi: pg_cron va pg_net kengaytmalarini yoqadi va har 5 daqiqada Edge Function `eslatma-yuborish` ni chaqiradigan topshiriq
-- (cron.job: "eslatma-yuborish") yaratadi. Chaqiruv `x-kron-sirri` sarlavhasini yuboradi; funksiya uni Secrets'dagi CRON_SIRRI bilan solishtiradi.
-- Idempotent: qayta ishga tushirilsa eski topshiriq avval o'chiriladi (cron.unschedule), keyin yangisi yaratiladi — bitta topshiriq qoladi.
-- O'rinbosarlar almashtirilmagan bo'lsa fayl XATO bilan to'xtaydi va hech narsa yaratmaydi.
--
-- Eslatma: sir cron.job jadvalidagi buyruq matnida saqlanadi (faqat bazaning o'zida, postgres roli ko'radi). Holatni ko'rishda `command` ustunini
-- tanlamang (supabase/README.md 10-bo'lim so'rovlari buni hisobga olgan).
-- Bu repozitoriydagi faylda HAQIQIY manzil va sir YO'Q va bo'lmasligi kerak.
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $kron$
declare
  buyruq text := $buyruq$select net.http_post(
      url := '<<LOYIHA_MANZILI>>/functions/v1/eslatma-yuborish',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-kron-sirri', '<<CRON_SIRRI>>'),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000
    )$buyruq$;
begin
  -- Himoya: o'rinbosarlar almashtirilmagan bo'lsa to'xtaydi ("<<" belgilari qolgan)
  if position(chr(60) || chr(60) in buyruq) > 0 then
    raise exception 'O''rinbosarlar (LOYIHA_MANZILI va CRON_SIRRI) almashtirilmagan: fayl boshidagi izohni o''qing' using errcode = '22023';
  end if;
  if buyruq not like 'select net.http_post(%url := ''https://%' then
    raise exception 'Loyiha manzili https:// bilan boshlanishi kerak' using errcode = '22023';
  end if;
  if exists (select 1 from cron.job where jobname = 'eslatma-yuborish') then
    perform cron.unschedule('eslatma-yuborish');
  end if;
  perform cron.schedule('eslatma-yuborish', '*/5 * * * *', buyruq);
end
$kron$;
