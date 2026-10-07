#!/usr/bin/env bash
# Supabase jadval kutubxonasini (@supabase/postgrest-js, MIT) bitta brauzer fayliga yig'adi: js/vendor/supabase-postgrest.min.js
# Faqat ishlab chiqish vaqtida kerak (ilovaning o'zi npm ishlatmaydi). Node.js va internet kerak.
# Ishlatish:  bash tools/supabase-postgrest-yasash.sh [versiya]     (standart: 2.117.2)
set -euo pipefail
VERSIYA="${1:-2.117.2}"
ILDIZ="$(cd "$(dirname "$0")/.." && pwd)"
ISHCHI="$(mktemp -d)"
trap 'rm -rf "$ISHCHI"' EXIT
cd "$ISHCHI"
npm init -y >/dev/null
npm install --silent "@supabase/postgrest-js@${VERSIYA}" esbuild
cat > jadval.js <<'JS'
import { PostgrestClient } from '@supabase/postgrest-js';
export { PostgrestClient };
JS
npx esbuild jadval.js --bundle --minify --format=iife --global-name=SupabasePostgrest --target=es2019 --platform=browser --legal-comments=none \
  --banner:js="/* @supabase/postgrest-js ${VERSIYA} (MIT litsenziya, js/vendor/LICENSE-supabase-postgrest.txt). Yig'ish: tools/supabase-postgrest-yasash.sh */" \
  --outfile="$ILDIZ/js/vendor/supabase-postgrest.min.js"
cp node_modules/@supabase/postgrest-js/LICENSE "$ILDIZ/js/vendor/LICENSE-supabase-postgrest.txt"
echo "Tayyor: js/vendor/supabase-postgrest.min.js ($(wc -c < "$ILDIZ/js/vendor/supabase-postgrest.min.js") bayt), versiya ${VERSIYA}"
