// Kategoriya ikonlari (TZ-sinxronlash.md 22-band). Tabler Icons (https://tabler.io/icons, MIT litsenziya, outline uslub) dan FAQAT kerakli SVG yo'llari
// shu faylga ko'chirilgan: internet, CDN va npm paketi ilova ishlashi uchun kerak emas. Litsenziya matni README.md da eslatilgan.
// Tabler da bo'lmagan nomlar yaqin ma'noli ikon bilan almashtirilgan: taxi -> car-suv, tooth -> dental, piggy-bank -> moneybag.
// Bu yerda DOM yo'q (chiz() dan tashqari): ro'yxat, rang va nomga qarab boshlang'ich tanlov tests.html da to'liq sinaladi.
var Ikonlar = (function () {
  'use strict';

  // kalit -> SVG yo'llari (24x24, stroke 2, chiziqli); har bir satr — bitta <path d="...">
  var YOLLAR = {
    'shopping-cart': ['M6 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M17 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M17 17h-11v-14h-2', 'M6 5l14 1l-1 7h-13'],
    'tools-kitchen-2': ['M19 3v12h-5c-.023 -3.681 .184 -7.406 5 -12zm0 12v6h-1v-3m-10 -14v17m-3 -17v3a3 3 0 1 0 6 0v-3'],
    'coffee': ['M3 14c.83 .642 2.077 1.017 3.5 1c1.423 .017 2.67 -.358 3.5 -1c.83 -.642 2.077 -1.017 3.5 -1c1.423 -.017 2.67 .358 3.5 1', 'M8 3a2.4 2.4 0 0 0 -1 2a2.4 2.4 0 0 0 1 2', 'M12 3a2.4 2.4 0 0 0 -1 2a2.4 2.4 0 0 0 1 2', 'M3 10h14v5a6 6 0 0 1 -6 6h-2a6 6 0 0 1 -6 -6v-5z', 'M16.746 16.726a3 3 0 1 0 .252 -5.555'],
    'bread': ['M18 4a3 3 0 0 1 2 5.235v8.765a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-8.764a3 3 0 0 1 1.824 -5.231h12.176v-.005z'],
    'apple': ['M4 11.319c0 3.102 .444 5.319 2.222 7.978c1.351 1.797 3.156 2.247 5.08 .988c.426 -.268 .97 -.268 1.397 0c1.923 1.26 3.728 .809 5.079 -.988c1.778 -2.66 2.222 -4.876 2.222 -7.977c0 -2.661 -1.99 -5.32 -4.444 -5.32c-1.267 0 -2.41 .693 -3.22 1.44a.5 .5 0 0 1 -.672 0c-.809 -.746 -1.953 -1.44 -3.22 -1.44c-2.454 0 -4.444 2.66 -4.444 5.319', 'M7 12c0 -1.47 .454 -2.34 1.5 -3', 'M12 7c0 -1.2 .867 -4 3 -4'],
    'pizza': ['M12 21.5c-3.04 0 -5.952 -.714 -8.5 -1.983l8.5 -16.517l8.5 16.517a19.09 19.09 0 0 1 -8.5 1.983z', 'M5.38 15.866a14.94 14.94 0 0 0 6.815 1.634a14.944 14.944 0 0 0 6.502 -1.479', 'M13 11.01v-.01', 'M11 14v-.01'],
    'cup': ['M5 11h14v-3h-14z', 'M17.5 11l-1.5 10h-8l-1.5 -10', 'M6 8v-1a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v1', 'M15 5v-2'],
    'cake': ['M3 20h18v-8a3 3 0 0 0 -3 -3h-12a3 3 0 0 0 -3 3v8z', 'M3 14.803c.312 .135 .654 .204 1 .197a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1c.35 .007 .692 -.062 1 -.197', 'M12 4l1.465 1.638a2 2 0 1 1 -3.015 .099l1.55 -1.737z'],
    'bus': ['M6 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M18 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M4 17h-2v-11a1 1 0 0 1 1 -1h14a5 7 0 0 1 5 7v5h-2m-4 0h-8', 'M16 5l1.5 7l4.5 0', 'M2 10l15 0', 'M7 5l0 5', 'M12 5l0 5'],
    'car': ['M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M5 17h-2v-6l2 -5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0h-6m-6 -6h15m-6 0v-5'],
    'gas-station': ['M14 11h1a2 2 0 0 1 2 2v3a1.5 1.5 0 0 0 3 0v-7l-3 -3', 'M4 20v-14a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v14', 'M3 20l12 0', 'M18 7v1a1 1 0 0 0 1 1h1', 'M4 11l10 0'],
    'car-suv': ['M5 17a2 2 0 1 0 4 0a2 2 0 0 0 -4 0', 'M16 17a2 2 0 1 0 4 0a2 2 0 0 0 -4 0', 'M5 9l2 -4h7.438a2 2 0 0 1 1.94 1.515l.622 2.485h3a2 2 0 0 1 2 2v3', 'M10 9v-4', 'M2 7v4', 'M22.001 14.001a4.992 4.992 0 0 0 -4.001 -2.001a4.992 4.992 0 0 0 -4 2h-3a4.998 4.998 0 0 0 -8.003 .003', 'M5 12v-3h13'],
    'train': ['M21 13c0 -3.87 -3.37 -7 -10 -7h-8', 'M3 15h16a2 2 0 0 0 2 -2', 'M3 6v5h17.5', 'M3 11v4', 'M8 11v-5', 'M13 11v-4.5', 'M3 19h18'],
    'plane': ['M16 10h4a2 2 0 0 1 0 4h-4l-4 7h-3l2 -7h-4l-2 2h-3l2 -4l-2 -4h3l2 2h4l-2 -7h3z'],
    'bike': ['M5 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', 'M19 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', 'M12 19l0 -4l-3 -3l5 -4l2 3l3 0', 'M17 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0'],
    'car-crash': ['M10 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M7 6l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0h-5m0 -6h8m-6 0v-5m2 0h-4', 'M14 8v-2', 'M19 12h2', 'M17.5 15.5l1.5 1.5', 'M17.5 8.5l1.5 -1.5'],
    'home': ['M5 12l-2 0l9 -9l9 9l-2 0', 'M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7', 'M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6'],
    'home-2': ['M5 12l-2 0l9 -9l9 9l-2 0', 'M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7', 'M10 12h4v4h-4z'],
    'key': ['M16.555 3.843l3.602 3.602a2.877 2.877 0 0 1 0 4.069l-2.643 2.643a2.877 2.877 0 0 1 -4.069 0l-.301 -.301l-6.558 6.558a2 2 0 0 1 -1.239 .578l-.175 .008h-1.172a1 1 0 0 1 -.993 -.883l-.007 -.117v-1.172a2 2 0 0 1 .467 -1.284l.119 -.13l.414 -.414h2v-2h2v-2l2.144 -2.144l-.301 -.301a2.877 2.877 0 0 1 0 -4.069l2.643 -2.643a2.877 2.877 0 0 1 4.069 0z', 'M15 9h.01'],
    'bulb': ['M3 12h1m8 -9v1m8 8h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7', 'M9 16a5 5 0 1 1 6 0a3.5 3.5 0 0 0 -1 3a2 2 0 0 1 -4 0a3.5 3.5 0 0 0 -1 -3', 'M9.7 17l4.6 0'],
    'droplet': ['M7.502 19.423c2.602 2.105 6.395 2.105 8.996 0c2.602 -2.105 3.262 -5.708 1.566 -8.546l-4.89 -7.26c-.42 -.625 -1.287 -.803 -1.936 -.397a1.376 1.376 0 0 0 -.41 .397l-4.893 7.26c-1.695 2.838 -1.035 6.441 1.567 8.546z'],
    'flame': ['M12 10.941c2.333 -3.308 .167 -7.823 -1 -8.941c0 3.395 -2.235 5.299 -3.667 6.706c-1.43 1.408 -2.333 3.621 -2.333 5.588c0 3.704 3.134 6.706 7 6.706s7 -3.002 7 -6.706c0 -1.712 -1.232 -4.403 -2.333 -5.588c-2.084 3.353 -3.257 3.353 -4.667 2.235'],
    'wifi': ['M12 18l.01 0', 'M9.172 15.172a4 4 0 0 1 5.656 0', 'M6.343 12.343a8 8 0 0 1 11.314 0', 'M3.515 9.515c4.686 -4.687 12.284 -4.687 17 0'],
    'device-mobile': ['M6 5a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2v-14z', 'M11 4h2', 'M12 17v.01'],
    'device-laptop': ['M3 19l18 0', 'M5 6m0 1a1 1 0 0 1 1 -1h12a1 1 0 0 1 1 1v8a1 1 0 0 1 -1 1h-12a1 1 0 0 1 -1 -1z'],
    'tool': ['M7 10h3v-3l-3.5 -3.5a6 6 0 0 1 8 8l6 6a2 2 0 0 1 -3 3l-6 -6a6 6 0 0 1 -8 -8l3.5 3.5'],
    'pill': ['M4.5 12.5l8 -8a4.94 4.94 0 0 1 7 7l-8 8a4.94 4.94 0 0 1 -7 -7', 'M8.5 8.5l7 7'],
    'stethoscope': ['M6 4h-1a2 2 0 0 0 -2 2v3.5h0a5.5 5.5 0 0 0 11 0v-3.5a2 2 0 0 0 -2 -2h-1', 'M8 15a6 6 0 1 0 12 0v-3', 'M11 3v2', 'M6 3v2', 'M20 10m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0'],
    'heartbeat': ['M19.5 13.572l-7.5 7.428l-2.896 -2.868m-6.117 -8.104a5 5 0 0 1 9.013 -3.022a5 5 0 1 1 7.5 6.572', 'M3 13h2l2 3l2 -6l1 3h3'],
    'dental': ['M12 5.5c-1.074 -.586 -2.583 -1.5 -4 -1.5c-2.1 0 -4 1.247 -4 5c0 4.899 1.056 8.41 2.671 10.537c.573 .756 1.97 .521 2.567 -.236c.398 -.505 .819 -1.439 1.262 -2.801c.292 -.771 .892 -1.504 1.5 -1.5c.602 0 1.21 .737 1.5 1.5c.443 1.362 .864 2.295 1.262 2.8c.597 .759 2 .993 2.567 .237c1.615 -2.127 2.671 -5.637 2.671 -10.537c0 -3.74 -1.908 -5 -4 -5c-1.423 0 -2.92 .911 -4 1.5z', 'M12 5.5l3 1.5'],
    'scissors': ['M6 7m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', 'M6 17m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', 'M8.6 8.6l10.4 10.4', 'M8.6 15.4l10.4 -10.4'],
    'brush': ['M3 21v-4a4 4 0 1 1 4 4h-4', 'M21 3a16 16 0 0 0 -12.8 10.2', 'M21 3a16 16 0 0 1 -10.2 12.8', 'M10.6 9a9 9 0 0 1 4.4 4.4'],
    'barbell': ['M2 12h1', 'M6 8h-2a1 1 0 0 0 -1 1v6a1 1 0 0 0 1 1h2', 'M6 7v10a1 1 0 0 0 1 1h1a1 1 0 0 0 1 -1v-10a1 1 0 0 0 -1 -1h-1a1 1 0 0 0 -1 1z', 'M9 12h6', 'M15 7v10a1 1 0 0 0 1 1h1a1 1 0 0 0 1 -1v-10a1 1 0 0 0 -1 -1h-1a1 1 0 0 0 -1 1z', 'M18 8h2a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-2', 'M22 12h-1'],
    'bath': ['M4 12h16a1 1 0 0 1 1 1v3a4 4 0 0 1 -4 4h-10a4 4 0 0 1 -4 -4v-3a1 1 0 0 1 1 -1z', 'M6 12v-7a2 2 0 0 1 2 -2h3v2.25', 'M4 21l1 -1.5', 'M20 21l-1 -1.5'],
    'school': ['M22 9l-10 -4l-10 4l10 4l10 -4v6', 'M6 10.6v5.4a6 3 0 0 0 12 0v-5.4'],
    'book': ['M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0', 'M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0', 'M3 6l0 13', 'M12 6l0 13', 'M21 6l0 13'],
    'book-2': ['M19 4v16h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12z', 'M19 16h-12a2 2 0 0 0 -2 2', 'M9 8h6'],
    'certificate': ['M15 15m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', 'M13 17.5v4.5l2 -1.5l2 1.5v-4.5', 'M10 19h-5a2 2 0 0 1 -2 -2v-10c0 -1.1 .9 -2 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -1 1.73', 'M6 9l12 0', 'M6 12l3 0', 'M6 15l2 0'],
    'baby-carriage': ['M8 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M18 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M2 5h2.5l1.632 4.897a6 6 0 0 0 5.693 4.103h2.675a5.5 5.5 0 0 0 0 -11h-.5v6', 'M6 9h14', 'M9 17l1 -3', 'M16 14l1 3'],
    'baby-bottle': ['M5 10h14', 'M12 2v2', 'M12 4a5 5 0 0 1 5 5v11a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2v-11a5 5 0 0 1 5 -5z'],
    'mood-kid': ['M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0', 'M9 10l.01 0', 'M15 10l.01 0', 'M9.5 15a3.5 3.5 0 0 0 5 0', 'M12 3a2 2 0 0 0 0 4'],
    'paw': ['M14.7 13.5c-1.1 -2 -1.441 -2.5 -2.7 -2.5c-1.259 0 -1.736 .755 -2.836 2.747c-.942 1.703 -2.846 1.845 -3.321 3.291c-.097 .265 -.145 .677 -.143 .962c0 1.176 .787 2 1.8 2c1.259 0 3 -1 4.5 -1s3.241 1 4.5 1c1.013 0 1.8 -.823 1.8 -2c0 -.285 -.049 -.697 -.146 -.962c-.475 -1.451 -2.512 -1.835 -3.454 -3.538z', 'M20.188 8.082a1.039 1.039 0 0 0 -.406 -.082h-.015c-.735 .012 -1.56 .75 -1.993 1.866c-.519 1.335 -.28 2.7 .538 3.052c.129 .055 .267 .082 .406 .082c.739 0 1.575 -.742 2.011 -1.866c.516 -1.335 .273 -2.7 -.54 -3.052z', 'M9.474 9c.055 0 .109 0 .163 -.011c.944 -.128 1.533 -1.346 1.32 -2.722c-.203 -1.297 -1.047 -2.267 -1.932 -2.267c-.055 0 -.109 0 -.163 .011c-.944 .128 -1.533 1.346 -1.32 2.722c.204 1.293 1.048 2.267 1.933 2.267z', 'M16.456 6.733c.214 -1.376 -.375 -2.594 -1.32 -2.722a1.164 1.164 0 0 0 -.162 -.011c-.885 0 -1.728 .97 -1.93 2.267c-.214 1.376 .375 2.594 1.32 2.722c.054 .007 .108 .011 .162 .011c.885 0 1.73 -.974 1.93 -2.267z', 'M5.69 12.918c.816 -.352 1.054 -1.719 .536 -3.052c-.436 -1.124 -1.271 -1.866 -2.009 -1.866c-.14 0 -.277 .027 -.407 .082c-.816 .352 -1.054 1.719 -.536 3.052c.436 1.124 1.271 1.866 2.009 1.866c.14 0 .277 -.027 .407 -.082z'],
    'shirt': ['M15 4l6 2v5h-3v8a1 1 0 0 1 -1 1h-10a1 1 0 0 1 -1 -1v-8h-3v-5l6 -2a3 3 0 0 0 6 0'],
    'shoe': ['M4 6h5.426a1 1 0 0 1 .863 .496l1.064 1.823a3 3 0 0 0 1.896 1.407l4.677 1.114a4 4 0 0 1 3.074 3.89v2.27a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1v-10a1 1 0 0 1 1 -1z', 'M14 13l1 -2', 'M8 18v-1a4 4 0 0 0 -4 -4h-1', 'M10 12l1.5 -3'],
    'shopping-bag': ['M6.331 8h11.339a2 2 0 0 1 1.977 2.304l-1.255 8.152a3 3 0 0 1 -2.966 2.544h-6.852a3 3 0 0 1 -2.965 -2.544l-1.255 -8.152a2 2 0 0 1 1.977 -2.304z', 'M9 11v-5a3 3 0 0 1 6 0v5'],
    'movie': ['M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z', 'M8 4l0 16', 'M16 4l0 16', 'M4 8l4 0', 'M4 16l4 0', 'M4 12l16 0', 'M16 8l4 0', 'M16 16l4 0'],
    'device-gamepad-2': ['M12 5h3.5a5 5 0 0 1 0 10h-5.5l-4.015 4.227a2.3 2.3 0 0 1 -3.923 -2.035l1.634 -8.173a5 5 0 0 1 4.904 -4.019h3.4z', 'M14 15l4.07 4.284a2.3 2.3 0 0 0 3.925 -2.023l-1.6 -8.232', 'M8 9v2', 'M7 10h2', 'M14 10h2'],
    'music': ['M3 17a3 3 0 1 0 6 0a3 3 0 0 0 -6 0', 'M13 17a3 3 0 1 0 6 0a3 3 0 0 0 -6 0', 'M9 17v-13h10v13', 'M9 8h10'],
    'beach': ['M17.553 16.75a7.5 7.5 0 0 0 -10.606 0', 'M18 3.804a6 6 0 0 0 -8.196 2.196l10.392 6a6 6 0 0 0 -2.196 -8.196z', 'M16.732 10c1.658 -2.87 2.225 -5.644 1.268 -6.196c-.957 -.552 -3.075 1.326 -4.732 4.196', 'M15 9l-3 5.196', 'M3 19.25a2.4 2.4 0 0 1 1 -.25a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 1 .25'],
    'gift': ['M3 8m0 1a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1z', 'M12 8l0 13', 'M19 12v7a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-7', 'M7.5 8a2.5 2.5 0 0 1 0 -5a4.8 8 0 0 1 4.5 5a4.8 8 0 0 1 4.5 -5a2.5 2.5 0 0 1 0 5'],
    'confetti': ['M4 5h2', 'M5 4v2', 'M11.5 4l-.5 2', 'M18 5h2', 'M19 4v2', 'M15 9l-1 1', 'M18 13l2 -.5', 'M18 19h2', 'M19 18v2', 'M14 16.518l-6.518 -6.518l-4.39 9.58a1 1 0 0 0 1.329 1.329l9.579 -4.39z'],
    'heart-handshake': ['M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572', 'M12 6l-3.293 3.293a1 1 0 0 0 0 1.414l.543 .543c.69 .69 1.81 .69 2.5 0l1 -1a3.182 3.182 0 0 1 4.5 0l2.25 2.25', 'M12.5 15.5l2 2', 'M15 13l2 2'],
    'building-mosque': ['M3 21h7v-2a2 2 0 1 1 4 0v2h7', 'M4 21v-10', 'M20 21v-10', 'M4 16h3v-3h10v3h3', 'M17 13a5 5 0 0 0 -10 0', 'M21 10.5c0 -.329 -.077 -.653 -.224 -.947l-.776 -1.553l-.776 1.553a2.118 2.118 0 0 0 -.224 .947a.5 .5 0 0 0 .5 .5h1a.5 .5 0 0 0 .5 -.5z', 'M5 10.5c0 -.329 -.077 -.653 -.224 -.947l-.776 -1.553l-.776 1.553a2.118 2.118 0 0 0 -.224 .947a.5 .5 0 0 0 .5 .5h1a.5 .5 0 0 0 .5 -.5z', 'M12 2a2 2 0 1 0 2 2', 'M12 6v2'],
    'heart': ['M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572'],
    'package': ['M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5', 'M12 12l8 -4.5', 'M12 12l0 9', 'M12 12l-8 -4.5', 'M16 5.25l-8 4.5'],
    'truck-delivery': ['M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M5 17h-2v-4m-1 -8h11v12m-4 0h6m4 0h2v-6h-8m0 -5h5l3 5', 'M3 9l4 0'],
    'building-store': ['M3 21l18 0', 'M3 7v1a3 3 0 0 0 6 0v-1m0 1a3 3 0 0 0 6 0v-1m0 1a3 3 0 0 0 6 0v-1h-18l2 -4h14l2 4', 'M5 21l0 -10.15', 'M19 21l0 -10.15', 'M9 21v-4a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v4'],
    'wallet': ['M17 8v-3a1 1 0 0 0 -1 -1h-10a2 2 0 0 0 0 4h12a1 1 0 0 1 1 1v3m0 4v3a1 1 0 0 1 -1 1h-12a2 2 0 0 1 -2 -2v-12', 'M20 12v4h-4a2 2 0 0 1 0 -4h4'],
    'cash': ['M7 15h-3a1 1 0 0 1 -1 -1v-8a1 1 0 0 1 1 -1h12a1 1 0 0 1 1 1v3', 'M7 9m0 1a1 1 0 0 1 1 -1h12a1 1 0 0 1 1 1v8a1 1 0 0 1 -1 1h-12a1 1 0 0 1 -1 -1z', 'M12 14a2 2 0 1 0 4 0a2 2 0 0 0 -4 0'],
    'coin': ['M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0', 'M14.8 9a2 2 0 0 0 -1.8 -1h-2a2 2 0 1 0 0 4h2a2 2 0 1 1 0 4h-2a2 2 0 0 1 -1.8 -1', 'M12 7v10'],
    'briefcase': ['M3 7m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z', 'M8 7v-2a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v2', 'M12 12l0 .01', 'M3 13a20 20 0 0 0 18 0'],
    'trending-up': ['M3 17l6 -6l4 4l8 -8', 'M14 7l7 0l0 7'],
    'arrow-back-up': ['M9 14l-4 -4l4 -4', 'M5 10h11a4 4 0 1 1 0 8h-1'],
    'award': ['M12 9m-6 0a6 6 0 1 0 12 0a6 6 0 1 0 -12 0', 'M12 15l3.4 5.89l1.598 -3.233l3.598 .232l-3.4 -5.889', 'M6.802 12l-3.4 5.89l3.598 -.233l1.598 3.232l3.4 -5.889'],
    'building-bank': ['M3 21l18 0', 'M3 10l18 0', 'M5 6l7 -3l7 3', 'M4 10l0 11', 'M20 10l0 11', 'M8 14l0 3', 'M12 14l0 3', 'M16 14l0 3'],
    'credit-card': ['M3 5m0 3a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z', 'M3 10l18 0', 'M7 15l.01 0', 'M11 15l2 0'],
    'receipt': ['M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16l-3 -2l-2 2l-2 -2l-2 2l-2 -2l-3 2m4 -14h6m-6 4h6m-2 4h2'],
    'report-money': ['M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2', 'M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z', 'M14 11h-2.5a1.5 1.5 0 0 0 0 3h1a1.5 1.5 0 0 1 0 3h-2.5', 'M12 17v1m0 -8v1'],
    'moneybag': ['M9.5 3h5a1.5 1.5 0 0 1 1.5 1.5a3.5 3.5 0 0 1 -3.5 3.5h-1a3.5 3.5 0 0 1 -3.5 -3.5a1.5 1.5 0 0 1 1.5 -1.5', 'M4 17v-1a8 8 0 1 1 16 0v1a4 4 0 0 1 -4 4h-8a4 4 0 0 1 -4 -4'],
    'arrows-exchange': ['M7 10h14l-4 -4', 'M17 14h-14l4 4'],
    'repeat': ['M4 12v-3a3 3 0 0 1 3 -3h13m-3 -3l3 3l-3 3', 'M20 12v3a3 3 0 0 1 -3 3h-13m3 3l-3 -3l3 -3'],
    'shield-check': ['M11.46 20.846a12 12 0 0 1 -7.96 -14.846a12 12 0 0 0 8.5 -3a12 12 0 0 0 8.5 3a12 12 0 0 1 -.09 7.06', 'M15 19l2 2l4 -4'],
    'dots': ['M5 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0', 'M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0', 'M19 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0'],
    'help-circle': ['M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0', 'M12 16v.01', 'M12 13a2 2 0 0 0 .914 -3.782a1.98 1.98 0 0 0 -2.414 .483'],
    'pencil': ['M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4', 'M13.5 6.5l4 4'],
    'tag': ['M7.5 7.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0', 'M3 6v5.172a2 2 0 0 0 .586 1.414l7.71 7.71a2.41 2.41 0 0 0 3.408 0l5.592 -5.592a2.41 2.41 0 0 0 0 -3.408l-7.71 -7.71a2 2 0 0 0 -1.414 -.586h-5.172a3 3 0 0 0 -3 3z'],
    'percentage': ['M17 17m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0', 'M7 7m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0', 'M6 18l12 -12'],
    'meat': ['M13.62 8.382l1.966 -1.967a2 2 0 1 1 3.414 -1.415a2 2 0 1 1 -1.413 3.414l-1.82 1.821', 'M5.904 18.596c2.733 2.734 5.9 4 7.07 2.829c1.172 -1.172 -.094 -4.338 -2.828 -7.071c-2.733 -2.734 -5.9 -4 -7.07 -2.829c-1.172 1.172 .094 4.338 2.828 7.071z', 'M7.5 16l1 1', 'M12.975 21.425c3.905 -3.906 4.855 -9.288 2.121 -12.021c-2.733 -2.734 -8.115 -1.784 -12.02 2.121'],
    'robot': ['M6 4m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z', 'M12 2v2', 'M9 12v9', 'M15 12v9', 'M5 16l4 -2', 'M15 14l4 2', 'M9 18h6', 'M10 8v.01', 'M14 8v.01'],
    'users': ['M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0', 'M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2', 'M16 3.13a4 4 0 0 1 0 7.75', 'M21 21v-2a4 4 0 0 0 -3 -3.85'],
    'users-group': ['M10 13a2 2 0 1 0 4 0a2 2 0 0 0 -4 0', 'M8 21v-1a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v1', 'M15 5a2 2 0 1 0 4 0a2 2 0 0 0 -4 0', 'M17 10h2a2 2 0 0 1 2 2v1', 'M5 5a2 2 0 1 0 4 0a2 2 0 0 0 -4 0', 'M3 13v-1a2 2 0 0 1 2 -2h2'],
    'user': ['M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0', 'M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2'],
    'chart-line': ['M4 19l16 0', 'M4 15l4 -6l4 2l4 -5l4 4'],
    'signature': ['M3 17c3.333 -3.333 5 -6 5 -8c0 -3 -1 -3 -2 -3s-2.032 1.085 -2 3c.034 2.048 1.658 4.877 2.5 6c1.5 2 2.5 2.5 3.5 1l2 -3c.333 2.667 1.333 4 3 4c.53 0 2.639 -2 3 -2c.517 0 1.517 .667 3 2'],
    'file-text': ['M14 3v4a1 1 0 0 0 1 1h4', 'M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z', 'M9 9l1 0', 'M9 13l6 0', 'M9 17l6 0'],
    'menu-2': ['M4 6l16 0', 'M4 12l16 0', 'M4 18l16 0'],
    'history': ['M12 8l0 4l2 2', 'M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5'],
    'search': ['M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0', 'M21 21l-6 -6'],
    'filter': ['M4 4h16v2.172a2 2 0 0 1 -.586 1.414l-4.414 4.414v7l-6 2v-8.5l-4.48 -4.928a2 2 0 0 1 -.52 -1.345v-2.227z']
  };

  // Ikonni tanlash oynasidagi guruhlar: [kalit, qisqa o'zbekcha nom]
  var GURUHLAR = [
    { nom: 'Oziq-ovqat', ikonlar: [['tools-kitchen-2', 'Ovqat'], ['shopping-cart', 'Bozorlik'], ['bread', 'Non'], ['apple', 'Meva'], ['meat', 'Go\'sht'], ['pizza', 'Fast-fud'], ['coffee', 'Kofe'], ['cup', 'Ichimlik'], ['cake', 'Shirinlik']] },
    { nom: 'Transport', ikonlar: [['bus', 'Avtobus'], ['car', 'Mashina'], ['car-suv', 'Taksi'], ['gas-station', 'Yoqilg\'i'], ['train', 'Poyezd'], ['plane', 'Samolyot'], ['bike', 'Velosiped'], ['car-crash', 'Avariya']] },
    { nom: 'Uy va kommunal', ikonlar: [['home', 'Uy'], ['home-2', 'Xonadon'], ['key', 'Ijara'], ['bulb', 'Elektr'], ['droplet', 'Suv'], ['flame', 'Gaz'], ['wifi', 'Internet'], ['device-mobile', 'Telefon'], ['device-laptop', 'Noutbuk'], ['tool', 'Ta\'mir']] },
    { nom: 'Sog\'liq va go\'zallik', ikonlar: [['pill', 'Dori'], ['stethoscope', 'Shifokor'], ['heartbeat', 'Sog\'liq'], ['dental', 'Tish'], ['scissors', 'Soch'], ['brush', 'Go\'zallik'], ['barbell', 'Sport'], ['bath', 'Hammom']] },
    { nom: 'Ta\'lim va oila', ikonlar: [['school', 'Ta\'lim'], ['book', 'Kitob'], ['book-2', 'Daftar'], ['certificate', 'Sertifikat'], ['baby-carriage', 'Aravacha'], ['baby-bottle', 'Chaqaloq'], ['mood-kid', 'Bola'], ['paw', 'Uy hayvoni']] },
    { nom: 'Xarid va ko\'ngilochar', ikonlar: [['shirt', 'Kiyim'], ['shoe', 'Poyabzal'], ['shopping-bag', 'Xarid'], ['building-store', 'Do\'kon'], ['movie', 'Kino'], ['device-gamepad-2', 'O\'yin'], ['music', 'Musiqa'], ['beach', 'Ta\'til']] },
    { nom: 'Sovg\'a va ehson', ikonlar: [['gift', 'Sovg\'a'], ['confetti', 'Bayram'], ['heart-handshake', 'Ehson'], ['building-mosque', 'Masjid'], ['heart', 'Mehr'], ['package', 'Posilka'], ['truck-delivery', 'Yetkazish']] },
    { nom: 'Daromad', ikonlar: [['wallet', 'Hamyon'], ['cash', 'Naqd pul'], ['coin', 'Tanga'], ['briefcase', 'Ish'], ['trending-up', 'O\'sish'], ['arrow-back-up', 'Keshbek'], ['award', 'Mukofot'], ['chart-line', 'Trading']] },
    { nom: 'Moliya va qarz', ikonlar: [['building-bank', 'Bank'], ['credit-card', 'Karta'], ['receipt', 'Chek'], ['report-money', 'Hisobot'], ['moneybag', 'Jamg\'arma'], ['arrows-exchange', 'O\'tkazma'], ['repeat', 'Takroriy'], ['shield-check', 'Sug\'urta'], ['percentage', 'Foiz']] },
    { nom: 'Boshqa', ikonlar: [['dots', 'Boshqa'], ['help-circle', 'Noma\'lum'], ['pencil', 'Qalam'], ['tag', 'Yorliq'], ['robot', 'Robot'], ['users', 'Odamlar'], ['users-group', 'Guruh'], ['user', 'Odam'], ['signature', 'Imzo'], ['file-text', 'Hujjat']] }
  ];

  // 16 ta tayyor yarqin rang
  var RANGLAR = ['#7C5CFF', '#1E8FFF', '#00B4D8', '#14B870', '#2EA84F', '#6FBF2E', '#E6B800', '#F5A300', '#FF7A2F', '#E5483D', '#F0407A', '#C2409B', '#9B4DDB', '#2F5DDB', '#26A69A', '#7B8498'];
  var KULRANG = '#7B8498';   // "Boshqalar" bo'lagi va o'tkazma
  var OTKAZMA = { belgi: 'arrows-exchange', rang: KULRANG };

  function bormi(kalit) { return Object.prototype.hasOwnProperty.call(YOLLAR, kalit); }
  function yollar(kalit) { return bormi(kalit) ? YOLLAR[kalit] : null; }

  // Nisbiy yorqinlik (0..1): ko'z qabul qiladigan yorug'lik (Rec. 601: 0,299 R + 0,587 G + 0,114 B). Sariq, to'q sariq va och yashil "och" hisoblanadi,
  // shuning uchun ularda ikon to'q rangda (WCAG yorqinligi bilan sariq ham "to'q" chiqib, oq ikon yomon ko'rinardi).
  function yorqinlik(hex) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex));
    if (!m) return 0;
    return (0.299 * parseInt(m[1], 16) + 0.587 * parseInt(m[2], 16) + 0.114 * parseInt(m[3], 16)) / 255;
  }
  // Ikon rangi avtomatik: rang och bo'lsa (nisbiy yorqinlik > 0,55) to'q, aks holda oq
  function ikonRangi(hex) { return yorqinlik(hex) > 0.55 ? '#1f2a3a' : '#ffffff'; }

  // ---- Nomga qarab bir martalik boshlang'ich ikon va rang ----
  function tozala(nom) { return String(nom == null ? '' : nom).toLowerCase().replace(/[ʻʼ‘’`´']/g, '').replace(/\s+/g, ' ').trim(); }
  // tok: true bo'lsa — butun so'z sifatida (qisqa so'zlar boshqa so'zning ichida topilmasin: "ai", "dam")
  var QOIDALAR = [
    [['taksi'], 'car-suv', '#F5A300'], [['ovqat'], 'tools-kitchen-2', '#14B870'], [['dokon', 'market'], 'building-store', '#2EA84F'],
    [['rozgor', 'bozor'], 'shopping-cart', '#1E8FFF'], [['jamoat', 'avtobus'], 'bus', '#00B4D8'], [['benzin', 'yoqilgi'], 'gas-station', '#E5483D'],
    [['ijara'], 'key', '#6A4CE0'], [['kommunal'], 'bulb', '#E6B800'], [['internet'], 'wifi', '#3F6FE0'], [['telefon', 'aloqa'], 'device-mobile', '#3F6FE0'],
    [['apteka', 'dori'], 'pill', '#E0356B'], [['shifokor', 'klinika'], 'stethoscope', '#E0356B'], [['kontrakt', 'oqish', 'kurs'], 'school', '#E08A00'],
    [['kredit'], 'credit-card', '#2F5DDB'], [['komissiya'], 'percentage', '#5C6BC0'], [['keshbek', 'cashback'], 'arrow-back-up', '#1C9AE0'],
    [['ish haqi', 'oylik'], 'wallet', '#12B76A'], [['avans'], 'cash', '#6FBF2E'], [['gosht'], 'meat', '#E5483D'],
    [['sunniy intellekt', 'ai'], 'robot', '#00A3A3', ['ai']], [['trading'], 'chart-line', '#0FA36B'], [['kiyim'], 'shirt', '#F0407A'], [['sovga'], 'gift', '#FF7A2F'],
    [['tatil', 'dam'], 'beach', '#00B4D8', ['dam']], [['boshqa'], 'dots', KULRANG], [['nomalum', 'nomalum'], 'help-circle', '#8D6E63']
  ];
  // FNV-1a: nomdan barqaror son
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function hashRang(nom) { return RANGLAR[hash(tozala(nom)) % RANGLAR.length]; }
  // Natija: { belgi, rang, qoida: true | false (false — "tag" va hash rang) }
  function boshlangich(nom) {
    var n = tozala(nom), soz = n.split(/[^a-z0-9]+/).filter(Boolean);
    for (var i = 0; i < QOIDALAR.length; i++) {
      var q = QOIDALAR[i], tok = q[3] || [];
      for (var j = 0; j < q[0].length; j++) {
        var k = q[0][j], mos = tok.indexOf(k) >= 0 ? soz.indexOf(k) >= 0 : n.indexOf(k) >= 0;
        if (mos) return { belgi: q[1], rang: q[2], qoida: true };
      }
    }
    return { belgi: 'tag', rang: hashRang(nom), qoida: false };
  }
  // Ikoni hali yangi to'plamdan tanlanmagan kategoriya (eski kalit yoki bo'sh) uchun
  function yangiTanlanganmi(k) { return !!k && typeof k.belgi === 'string' && bormi(k.belgi); }
  // Bir martalik boshlang'ich: faqat ikoni yangi to'plamdan tanlanmagan kategoriyalarga nomga qarab ikon va rang beriladi. Foydalanuvchi ikon tanlagan
  // (yangi kalitli) kategoriyaga TEGILMAYDI, shuning uchun qayta ishlasa ham ustiga yozilmaydi (ikkinchi marta bo'sh ro'yxat). Natija: [{ id, belgi, rang }]
  function boshlangichRejasi(kategoriyalar) {
    return (kategoriyalar || []).filter(function (k) { return k && !yangiTanlanganmi(k); }).map(function (k) { var b = boshlangich(k.nom); return { id: k.id, belgi: b.belgi, rang: b.rang }; });
  }

  // SVG chizish (faqat brauzerda). Rang — currentColor. olcham — piksel.
  function chiz(kalit, olcham) {
    var NS = 'http://www.w3.org/2000/svg', y = yollar(kalit) || YOLLAR['tag'];
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('width', String(olcham || 24));
    s.setAttribute('height', String(olcham || 24));
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '2');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    y.forEach(function (d) { var e = document.createElementNS(NS, 'path'); e.setAttribute('d', d); s.appendChild(e); });
    return s;
  }

  var HAMMASI = [];
  GURUHLAR.forEach(function (g) { g.ikonlar.forEach(function (x) { HAMMASI.push(x[0]); }); });

  return {
    YOLLAR: YOLLAR, GURUHLAR: GURUHLAR, RANGLAR: RANGLAR, KULRANG: KULRANG, OTKAZMA: OTKAZMA, QOIDALAR: QOIDALAR, HAMMASI: HAMMASI,
    bormi: bormi, yollar: yollar, yorqinlik: yorqinlik, ikonRangi: ikonRangi, tozala: tozala, hash: hash, hashRang: hashRang, boshlangich: boshlangich,
    yangiTanlanganmi: yangiTanlanganmi, boshlangichRejasi: boshlangichRejasi, chiz: chiz
  };
})();
