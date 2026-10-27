#!/usr/bin/env bash
# Mahalliy PostgreSQL da 001–016 fayllarni sinash (Supabase TAQLIDI, haqiqiy Supabase emas).
# Ishlatish:  bash supabase/mahalliy_sinov.sh        (psql va ishlab turgan PostgreSQL kerak; DB: chuntak_sinov)
set -euo pipefail
cd "$(dirname "$0")"
PSQL=(psql -X -v ON_ERROR_STOP=1 -q -d chuntak_sinov)
psql -X -q -d postgres -c "drop database if exists chuntak_sinov" -c "create database chuntak_sinov"
"${PSQL[@]}" -f mahalliy_taqlid.sql
echo "--- 001_sxema.sql (1-marta) ---";  "${PSQL[@]}" -f 001_sxema.sql && echo "OK"
echo "--- 001_sxema.sql (2-marta: qayta ishga tushirish xavfsizmi) ---"; "${PSQL[@]}" -f 001_sxema.sql && echo "OK"
echo "--- 002_xavfsizlik_testi.sql ---"
"${PSQL[@]}" -A -F ' | ' -f 002_xavfsizlik_testi.sql
echo "--- 003_hisobni_ochirish.sql (1-marta) ---"; "${PSQL[@]}" -f 003_hisobni_ochirish.sql && echo "OK"
echo "--- 003_hisobni_ochirish.sql (2-marta) ---"; "${PSQL[@]}" -f 003_hisobni_ochirish.sql && echo "OK"
echo "--- 004_hisobni_ochirish_testi.sql ---"
"${PSQL[@]}" -A -F ' | ' -f 004_hisobni_ochirish_testi.sql
echo "--- 005_sinxron_xizmat.sql (1-marta, 2-marta) ---"; "${PSQL[@]}" -f 005_sinxron_xizmat.sql && "${PSQL[@]}" -f 005_sinxron_xizmat.sql && echo "OK"
echo "--- 006_sinxron_xizmat_testi.sql ---"
"${PSQL[@]}" -A -F ' | ' -f 006_sinxron_xizmat_testi.sql
echo "--- 007_ai_limit.sql (1-marta, 2-marta) ---"; "${PSQL[@]}" -f 007_ai_limit.sql && "${PSQL[@]}" -f 007_ai_limit.sql && echo "OK"
echo "--- 008_ai_limit_testi.sql ---"
"${PSQL[@]}" -A -F ' | ' -f 008_ai_limit_testi.sql
echo "--- 009_yozuv_bogi.sql (1-marta, 2-marta) ---"; "${PSQL[@]}" -f 009_yozuv_bogi.sql && "${PSQL[@]}" -f 009_yozuv_bogi.sql && echo "OK"
echo "--- 010_yozuv_bogi_testi.sql ---"
"${PSQL[@]}" -A -F ' | ' -f 010_yozuv_bogi_testi.sql
echo "--- 011_qarz_bogi.sql (1-marta, 2-marta) ---"; "${PSQL[@]}" -f 011_qarz_bogi.sql && "${PSQL[@]}" -f 011_qarz_bogi.sql && echo "OK"
echo "--- 012_qarz_bogi_testi.sql ---"
"${PSQL[@]}" -A -F ' | ' -f 012_qarz_bogi_testi.sql
echo "--- 013_bildirishnoma.sql (1-marta, 2-marta) ---"; "${PSQL[@]}" -f 013_bildirishnoma.sql && "${PSQL[@]}" -f 013_bildirishnoma.sql && echo "OK"
echo "--- 014_bildirishnoma_testi.sql ---"
"${PSQL[@]}" -A -F ' | ' -f 014_bildirishnoma_testi.sql
echo "--- 015_eslatma_jurnali.sql (1-marta, 2-marta) ---"; "${PSQL[@]}" -f 015_eslatma_jurnali.sql && "${PSQL[@]}" -f 015_eslatma_jurnali.sql && echo "OK"
echo "--- 015_eslatma_jurnali_testi.sql ---"
"${PSQL[@]}" -A -F ' | ' -f 015_eslatma_jurnali_testi.sql
echo "--- 016_eslatma_kroni.sql (pg_cron va pg_net TAQLIDI bilan; haqiqiy kengaytmalar mahalliy bazada yo'q) ---"
TMP="$(mktemp)"; trap 'rm -f "$TMP"' EXIT
sed -e '/^create extension/d' -e 's#<<LOYIHA_MANZILI>>#https://sinov.invalid#' -e 's#<<CRON_SIRRI>>#sinov-sir-0123456789abcdef#' 016_eslatma_kroni.sql > "$TMP"
"${PSQL[@]}" -v kron_fayl="$TMP" -f 016_eslatma_kroni_testi.sql && echo "OK"
echo "--- 016: o'rinbosarlar almashtirilmasa fayl XATO bilan to'xtashi kerak ---"
sed -e '/^create extension/d' 016_eslatma_kroni.sql > "$TMP"
if "${PSQL[@]}" -v kron_fayl="$TMP" -f 016_eslatma_kroni_testi.sql 2>/dev/null; then echo "O'TMADI: almashtirilmagan fayl xatosiz o'tdi"; exit 1; else echo "O'TDI: almashtirilmagan fayl rad etildi"; fi
echo "--- 006 (009 dan keyin yana: tozalash funksiyasi yangilandi) ---"
"${PSQL[@]}" -A -F ' | ' -f 006_sinxron_xizmat_testi.sql
echo "--- Sinovdan keyin bazada qolgan sinov qatorlari (0 bo'lishi kerak) ---"
"${PSQL[@]}" -A -t -c "select (select count(*) from auth.users) || ' ta foydalanuvchi, ' || (select count(*) from public.hisoblar) || ' ta hisob, ' || (select count(*) from public.yozuvlar) || ' ta yozuv, ' || (select count(*) from public.bildirishnoma_qurilmalari) || ' ta bildirishnoma qatori, ' || (select count(*) from public.eslatma_jurnali) || ' ta jurnal qatori'"
