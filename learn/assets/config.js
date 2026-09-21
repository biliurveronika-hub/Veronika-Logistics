/* ============================================================
   НАЛАШТУВАННЯ ПЛАТФОРМИ
   Це єдиний файл, який треба відредагувати руками.
   Детальна інструкція — у файлі НАСТРОЙКА-ПЛАТФОРМЫ.md
   ============================================================ */

export const CONFIG = {

  /* --- 1. SUPABASE (зберігання учениць, прогресу, домашок) ---
     Візьміть у Supabase → Project Settings → API
     Поки поля порожні — платформа працює в ДЕМО-режимі
     (дані зберігаються тільки в браузері, вхід без пошти).          */
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',

  /* --- 2. BUNNY.NET STREAM (відео) ---
     Video Library → дивіться номер бібліотеки в URL панелі Bunny.   */
  BUNNY_LIBRARY_ID: '758767',

  /* --- 3. Адреса сайту для листа-входу ---
     Найпростіше лишити порожнім — адреса визначиться сама.
     Заповнюйте, лише якщо сайт відкривається на кількох доменах:
     тут потрібен ТІЛЬКИ домен, без шляху, напр. 'https://veronikalogistics.com'
     (для GitHub Pages — 'https://ouranus4.github.io')                 */
  SITE_URL: '',

  /* --- 4. Демо-доступи (працюють ЛИШЕ поки не заповнено Supabase) --- */
  DEMO_STUDENTS: [
    { email: 'demo@veronika.pl',  full_name: 'Демо Учениця', flow: 'Потік 1', is_admin: false },
    { email: 'veronika@veronika.pl', full_name: 'Вероніка',  flow: 'Викладач', is_admin: true  }
  ]
};

export const IS_DEMO = !(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
