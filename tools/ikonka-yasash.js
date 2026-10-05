// Ilova belgisi PNG larini icons/icon.svg dan yasaydi (faqat ishlab chiqish vaqtida; ilovaning o'zi uni ishlatmaydi).
// Ishga tushirish: node tools/ikonka-yasash.js   (Playwright va Chromium kerak)
const fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const papka = path.join(__dirname, '..', 'icons');
const asl = fs.readFileSync(path.join(papka, 'icon.svg'), 'utf8');
// maskable: butun kvadrat to'ldiriladi (burchaksiz), belgi markaziy xavfsiz hududda
const maskable = asl.replace(/<rect[^>]*\/>/, '<rect width="512" height="512" fill="#0f8b6d"/>').replace('<g transform="translate(0 -40)"', '<g transform="translate(256 256) scale(0.86) translate(-256 -296)"');
const ishlar = [['icon-192.png', asl, 192, true], ['icon-512.png', asl, 512, true], ['icon-maskable-192.png', maskable, 192, false], ['icon-maskable-512.png', maskable, 512, false], ['apple-touch-icon.png', maskable, 180, false]];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  for (const [nom, svg, olcham, shaffof] of ishlar) {
    const p = await b.newPage({ viewport: { width: olcham, height: olcham } });
    await p.setContent('<style>html,body{margin:0;background:transparent}svg{display:block;width:' + olcham + 'px;height:' + olcham + 'px}</style>' + svg);
    await p.screenshot({ path: path.join(papka, nom), omitBackground: shaffof, clip: { x: 0, y: 0, width: olcham, height: olcham } });
    await p.close();
  }
  await b.close();
})();
