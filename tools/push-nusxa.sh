#!/usr/bin/env bash
# Web Push umumiy modulini (supabase/functions/_shared/push.ts — MANBA) funksiya papkalariga nusxalaydi.
# Sababi: Supabase Dashboard muharriri funksiya papkasidan tashqaridagi fayllarni ko'rmaydi. Testlar nusxalar bir xilligini tekshiradi.
# Ishlatish: repozitoriy papkasida  bash tools/push-nusxa.sh
set -euo pipefail
cd "$(dirname "$0")/.."
for f in bildirishnoma eslatma-yuborish; do
  mkdir -p "supabase/functions/$f"
  cp supabase/functions/_shared/push.ts "supabase/functions/$f/push.ts"
done
echo "push.ts nusxalandi: bildirishnoma, eslatma-yuborish"
