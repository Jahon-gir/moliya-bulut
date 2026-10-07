#!/usr/bin/env bash
# Supabase kirish kutubxonasini (@supabase/auth-js, MIT) bitta brauzer fayliga yig'adi: js/vendor/supabase-auth.min.js
# Faqat ishlab chiqish vaqtida kerak (ilovaning o'zi npm ishlatmaydi). Node.js va internet kerak.
# Ishlatish:  bash tools/supabase-auth-yasash.sh [versiya]     (standart: 2.117.2)
set -euo pipefail
VERSIYA="${1:-2.117.2}"
ILDIZ="$(cd "$(dirname "$0")/.." && pwd)"
ISHCHI="$(mktemp -d)"
trap 'rm -rf "$ISHCHI"' EXIT
cd "$ISHCHI"
npm init -y >/dev/null
npm install --silent "@supabase/auth-js@${VERSIYA}" esbuild
cat > kirish.js <<'JS'
import { GoTrueClient } from '@supabase/auth-js';
export { GoTrueClient };
JS
npx esbuild kirish.js --bundle --minify --format=iife --global-name=SupabaseAuth --target=es2019 --platform=browser --legal-comments=none \
  --banner:js="/* @supabase/auth-js ${VERSIYA} (MIT litsenziya, js/vendor/LICENSE-supabase-auth.txt). Yig'ish: tools/supabase-auth-yasash.sh */" \
  --outfile="$ILDIZ/js/vendor/supabase-auth.min.js"
cp node_modules/@supabase/auth-js/LICENSE "$ILDIZ/js/vendor/LICENSE-supabase-auth.txt"
echo "Tayyor: js/vendor/supabase-auth.min.js ($(wc -c < "$ILDIZ/js/vendor/supabase-auth.min.js") bayt), versiya ${VERSIYA}"
