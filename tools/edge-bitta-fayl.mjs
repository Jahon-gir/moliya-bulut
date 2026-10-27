// Funksiyani BITTA faylga birlashtiradi (Supabase Dashboard muharriri ikkinchi fayl qabul qilmasa kerak bo'ladi).
// Ishlatish:  node tools/edge-bitta-fayl.mjs eslatma-yuborish     (yoki: bildirishnoma)
// Natija: supabase/functions/<nom>/bitta-fayl.ts — uning HAMMA matnini Dashboard'dagi index.ts o'rniga joylang. Bu fayl repozitoriyga qo'shilmaydi (.gitignore).
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const nom = process.argv[2];
if (!['eslatma-yuborish', 'bildirishnoma'].includes(nom)) { console.error('Funksiya nomi: eslatma-yuborish yoki bildirishnoma'); process.exit(1); }
const papka = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'functions', nom);
const push = readFileSync(join(papka, 'push.ts'), 'utf8');
const index = readFileSync(join(papka, 'index.ts'), 'utf8')
  .replace(/^import [^\n]*from "\.\/push\.ts";\n/gm, '')          // ./push.ts importlari (matni quyida joylanadi)
  .replace(/^export (type )?\{[^}]*\};\n/gm, '');                // push.ts nomlarini qayta eksport qilish (ichida allaqachon eksport qilingan)
writeFileSync(join(papka, 'bitta-fayl.ts'), push + '\n' + index);
console.log('Tayyor: supabase/functions/' + nom + '/bitta-fayl.ts');
