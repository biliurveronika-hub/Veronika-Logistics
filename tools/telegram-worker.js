/**
 * Приймач заявок із сайту veronika-logistics.com → група в Telegram.
 *
 * Як запустити (5 хвилин, безкоштовно, картка не потрібна):
 *  1. dash.cloudflare.com → Workers & Pages → Create → Start with Hello World → Deploy.
 *  2. Edit code → видалити все → вставити цей файл → Deploy.
 *  3. Worker → Settings → Variables and Secrets → Add:
 *       BOT_TOKEN = токен від @BotFather
 *       CHAT_ID   = id групи (від'ємне число, напр. -1001234567890)
 *     Обидва — типом Secret, щоб не світились у панелі.
 *  4. Скопіювати адресу воркера (…​.workers.dev) і дати її мені —
 *     я пропишу її у формі на сайті.
 *
 * Токен живе тільки тут, у коді сайту його немає.
 *
 * ⚠️ Автодеплою немає. Будь-яка зміна цього файлу = знову
 *    Edit code → виділити все → вставити → Deploy.
 */

const ALLOWED = [
  'https://veronika-logistics.com',
  'https://www.veronika-logistics.com',
  'https://ouranus4.github.io',
  'http://localhost:5510',
  'http://localhost:5531'
];

const cors = origin => ({
  'Access-Control-Allow-Origin': ALLOWED.includes(origin) ? origin : ALLOWED[0],
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
});

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cut = (s, n) => String(s == null ? '' : s).trim().slice(0, n);

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = cors(origin);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return new Response('Only POST', { status: 405, headers });

    let data;
    try { data = await request.json(); } catch { return json({ ok: false, error: 'bad json' }, 400, headers); }

    // ---- фільтр ботів ----
    // Ботам відповідаємо «ok», щоб не підбирали обхід.
    // 1) пастка: приховане поле має лишатись порожнім
    if (cut(data.company, 50)) return json({ ok: true }, 200, headers);
    // 2) запит не з нашого сайту (curl, скрипт): Origin відсутній або чужий
    if (!ALLOWED.includes(origin)) return json({ ok: true }, 200, headers);
    // 3) немає поля, яке рахує тільки справжня сторінка (t — мс на сторінці)
    const t = Number(data.t), hi = Number(data.hi);
    if (data.t == null || !Number.isFinite(t)) return json({ ok: true }, 200, headers);
    // 4) не частіше 3 заявок за 10 хвилин з однієї адреси
    const ip = request.headers.get('CF-Connecting-IP') || '';
    if (ip && await tooMany(ip)) return json({ ok: true }, 200, headers);

    const name = cut(data.name, 200);
    const contact = cut(data.contact, 200);
    if (!name || !contact) return json({ ok: false, error: 'name and contact required' }, 400, headers);

    // ознаки бота, але не стовідсоткові — таку заявку не губимо,
    // а позначаємо, щоб Вероніка вирішила сама
    const flags = [];
    if (t < 3000) flags.push('форму заповнено за ' + Math.max(0, Math.round(t / 1000)) + ' с');
    if (!(hi > 0)) flags.push('без жодного дотику чи натискання');
    if (/https?:|www\./i.test(name)) flags.push('посилання в імені');

    const interests = Array.isArray(data.interests) ? data.interests.slice(0, 5).map(i => cut(i, 40)) : [];
    const message = cut(data.message, 2000);
    const source = cut(data.source, 200);
    const preferred = cut(data.preferred, 100);   // «коли зручно на звʼязок»
    const when = new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv', dateStyle: 'short', timeStyle: 'short' });

    // ---- звідки заявка ----
    const cf = request.cf || {};
    const place = [cf.city, countryName(cf.country)].filter(Boolean).join(', ');
    const device = deviceOf(request.headers.get('User-Agent') || '');
    const utm = data.utm && typeof data.utm === 'object' ? data.utm : {};
    const utmLine = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']
      .map(k => cut(utm[k], 80)).filter(Boolean).join(' / ');
    const from = utmLine || refName(cut(data.ref, 200)) || 'прямий захід (посилання відкрили напряму)';

    const text =
      (flags.length ? `🤖 <b>Схоже на бота:</b> ${esc(flags.join('; '))}\n\n` : '') +
      '🚚 <b>Нова заявка з сайту</b>\n\n' +
      `👤 <b>${esc(name)}</b>\n` +
      `📱 ${contactLine(data, contact)}\n` +
      (preferred ? `🗓 ${esc(preferred)}\n` : '') +
      `🎯 ${esc(interests.join(', ') || '—')}\n` +
      (message ? `\n💬 ${esc(message)}\n` : '') +
      '\n<b>Звідки</b>\n' +
      `↪️ ${esc(from)}\n` +
      (place ? `🌍 ${esc(place)}\n` : '') +
      `📲 ${esc(device)}\n` +
      `\n🕐 ${esc(when)}` +
      (source ? `\n🔗 ${esc(source)}` : '');

    const tg = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true })
    });

    if (!tg.ok) {
      const detail = await tg.text();
      console.log('telegram error', tg.status, detail);
      return json({ ok: false, error: 'telegram ' + tg.status }, 502, headers);
    }
    return json({ ok: true }, 200, headers);
  }
};

function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}

// номер + де людині зручніше, з посиланням, по якому можна одразу написати
// (Viber-посилання Telegram не пропускає — для нього просто номер)
function contactLine(data, fallback) {
  const type = cut(data.contact_type, 20), v = cut(data.contact_value, 100);
  if (!/^\+\d{9,15}$/.test(v)) return esc(fallback);
  const d = v.slice(1);
  if (type === 'telegram') return `${v}\n💬 Зручно: <a href="https://t.me/+${d}">Telegram</a>`;
  if (type === 'whatsapp') return `${v}\n💬 Зручно: <a href="https://wa.me/${d}">WhatsApp</a>`;
  if (type === 'viber') return `${v}\n💬 Зручно: Viber`;
  if (type === 'call') return `${v}\n💬 Зручно: дзвінок`;
  return esc(fallback);
}

// ліміт частоти через кеш Cloudflare (у межах одного дата-центру — для спаму досить)
async function tooMany(ip) {
  const key = new Request('https://rate.local/' + encodeURIComponent(ip));
  const hit = await caches.default.match(key);
  const n = hit ? Number(await hit.text()) || 0 : 0;
  if (n >= 3) return true;
  await caches.default.put(key, new Response(String(n + 1), { headers: { 'Cache-Control': 'max-age=600' } }));
  return false;
}

function deviceOf(ua) {
  if (!ua) return 'без даних про пристрій';
  if (/bot|crawl|spider|curl|python|headless/i.test(ua)) return 'автоматичний клієнт';
  const os = /iPhone|iPad/i.test(ua) ? 'iPhone' : /Android/i.test(ua) ? 'Android'
    : /Windows/i.test(ua) ? 'Windows' : /Macintosh/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux' : 'невідомий пристрій';
  const app = /Instagram/i.test(ua) ? 'браузер Instagram' : /FBAN|FBAV/i.test(ua) ? 'браузер Facebook'
    : /Telegram/i.test(ua) ? 'браузер Telegram' : '';
  return [os, app].filter(Boolean).join(', ');
}

function refName(ref) {
  if (!ref) return '';
  try {
    const h = new URL(ref).hostname.replace(/^(www|l|lm|m)\./, '');
    if (/veronika-logistics\.com$/.test(h)) return '';
    if (/instagram\.com$/.test(h)) return 'Instagram';
    if (/facebook\.com$/.test(h)) return 'Facebook';
    if (/(^|\.)t\.me$|telegram/.test(h)) return 'Telegram';
    if (/google\./.test(h)) return 'Google';
    return h;
  } catch { return ''; }
}

function countryName(code) {
  if (!code) return '';
  try { return new Intl.DisplayNames(['uk'], { type: 'region' }).of(code) || code; } catch { return code; }
}
