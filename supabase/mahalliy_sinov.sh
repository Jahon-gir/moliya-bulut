#!/usr/bin/env bash
# Mahalliy PostgreSQL da 001 va 002 fayllarni sinash (Supabase TAQLIDI, haqiqiy Supabase emas).
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
echo "--- Sinovdan keyin bazada qolgan sinov qatorlari (0 bo'lishi kerak) ---"
"${PSQL[@]}" -A -t -c "select (select count(*) from auth.users) || ' ta foydalanuvchi, ' || (select count(*) from public.hisoblar) || ' ta hisob, ' || (select count(*) from public.yozuvlar) || ' ta yozuv'"
