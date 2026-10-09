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
 */

const ALLOWED = [
  'https://veronika-logistics.com',
  'https://www.veronika-logistics.com',
  'https://ouranus4.github.io',
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

    // пастка для ботів: приховане поле має лишатись порожнім
    if (cut(data.company, 50)) return json({ ok: true }, 200, headers);

    const name = cut(data.name, 200);
    const contact = cut(data.contact, 200);
    if (!name || !contact) return json({ ok: false, error: 'name and contact required' }, 400, headers);

    const interests = Array.isArray(data.interests) ? data.interests.slice(0, 5).map(i => cut(i, 40)) : [];
    const message = cut(data.message, 2000);
    const source = cut(data.source, 200);
    const when = new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv', dateStyle: 'short', timeStyle: 'short' });

    const text =
      '🚚 <b>Нова заявка з сайту</b>\n\n' +
      `👤 <b>${esc(name)}</b>\n` +
      `📱 ${esc(contact)}\n` +
      `🎯 ${esc(interests.join(', ') || '—')}\n` +
      (message ? `\n💬 ${esc(message)}\n` : '') +
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
