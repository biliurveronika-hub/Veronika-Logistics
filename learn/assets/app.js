/* ============================================================
   Кабінет учениці — маршрутизація і рендер
   ============================================================ */
import { CONFIG } from './config.js';
import { API } from './api.js';
import { COURSE, STEPS, moduleById } from './course.js';

const view   = document.getElementById('view');
const boot   = document.getElementById('boot');
const menu   = document.getElementById('menu');

let USER = null, PROG = {}, HW = {};

/* ---------------- утиліти ---------------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl2br = s => esc(s).replace(/\n/g, '<br>');
const firstName = u => (u.full_name || u.email).trim().split(/\s+/)[0];
const initials = u => (u.full_name || u.email).trim().slice(0, 1).toUpperCase();
/* українська множина: 1 крок / 2 кроки / 5 кроків */
const plural = (n, f) => {
  const a = Math.abs(n) % 100, b = a % 10;
  return f[a > 10 && a < 20 ? 2 : b === 1 ? 0 : b > 1 && b < 5 ? 1 : 2];
};
const steps_w = n => plural(n, ['крок', 'кроки', 'кроків']);
const mods_w  = n => plural(n, ['модуль', 'модулі', 'модулів']);

/* кроки, які реально доступні в модулі */
function steps(m) {
  return STEPS.filter(s => s.key === 'hw' || (s.key === 'video' ? !!m.video : !!m.deck));
}
const key = (m, s) => m.id + ':' + s;
const stepDone = (m, s) => !!PROG[key(m, s)];
function modStat(m) {
  const av = steps(m);
  const done = av.filter(s => stepDone(m, s.key)).length;
  return { done, total: av.length, pct: av.length ? Math.round(done / av.length * 100) : 0, full: av.length > 0 && done === av.length };
}
function overall() {
  let done = 0, total = 0;
  COURSE.modules.forEach(m => { const s = modStat(m); done += s.done; total += s.total; });
  return { done, total, pct: total ? Math.round(done / total * 100) : 0 };
}
const iconArr = '<span class="arr"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M7 17 17 7M8 7h9v9"/></svg></span>';

/* ---------------- завантаження даних ---------------- */
async function refresh() {
  [PROG, HW] = await Promise.all([API.getProgress(USER.email), API.getHomework(USER.email)]);
}

/* ============================================================
   ЕКРАН: ДАШБОРД
   ============================================================ */
function renderHome() {
  const o = overall();
  const doneMods = COURSE.modules.filter(m => modStat(m).full).length;
  const hwSent = Object.keys(HW).length;
  const hwOk = Object.values(HW).filter(h => h.status === 'reviewed').length;
  const next = COURSE.modules.find(m => !modStat(m).full) || COURSE.modules[0];

  view.innerHTML = `
  <section class="page">
    <div class="page-head">
      <span class="label">${esc(USER.flow || 'Навчання')}</span>
      <h1>Вітаю, <em>${esc(firstName(USER))}</em></h1>
      <p class="lead">${o.pct === 0
        ? 'Почнімо з вступу — він короткий і пояснює, як влаштований курс.'
        : o.pct === 100
          ? 'Ви пройшли всю програму. Вітаю — тепер найважливіше: практика.'
          : 'Ви вже в дорозі. Продовжуйте у своєму темпі — прогрес зберігається сам.'}</p>
    </div>

    <div class="prog-card">
      <div class="prog-top">
        <div>
          <span class="label dark">Прогрес курсу</span>
          <h2>${doneMods} з ${COURSE.modules.length} ${mods_w(COURSE.modules.length)} <em>пройдено</em></h2>
        </div>
        <div class="prog-pct"><b>${o.pct}<small style="font-size:.4em">%</small></b><span>маршруту</span></div>
      </div>

      <div class="road">
        <div class="line"></div>
        <div class="fill" id="roadFill"></div>
        <div class="truck" id="roadTruck">
          <svg viewBox="0 0 56 30"><rect x="0" y="4" width="34" height="18" rx="3" fill="#9DBBD9"/><path d="M36 22V9q0-3 3-3h7l6 8v8Z" fill="#fff"/><path d="M40 9h5l4 5h-9Z" fill="#3E6E91"/><circle cx="9" cy="24" r="4" fill="#14232E" stroke="#fff" stroke-width="1.5"/><circle cx="26" cy="24" r="4" fill="#14232E" stroke="#fff" stroke-width="1.5"/><circle cx="45" cy="24" r="4" fill="#14232E" stroke="#fff" stroke-width="1.5"/></svg>
        </div>
        <span class="flag">🏁</span>
      </div>

      <div class="prog-stats">
        <div><b>${doneMods}</b><span>модулів пройдено</span></div>
        <div><b>${o.done}<small style="font-size:.5em;font-weight:400"> / ${o.total}</small></b><span>${steps_w(o.total)} виконано</span></div>
        <div><b>${hwSent}</b><span>домашніх надіслано</span></div>
        <div><b>${hwOk}</b><span>перевірено Веронікою</span></div>
      </div>
    </div>

    <a class="resume" href="#/m/${next.id}">
      <div>
        <span class="label plain" style="color:var(--blue)">${modStat(next).done ? 'Продовжити' : 'Наступний крок'}</span>
        <h3>${esc(next.num)} · ${esc(next.title)}</h3>
        <p>${esc(next.lead)}</p>
      </div>
      <span class="btn btn-green">Відкрити ${iconArr}</span>
    </a>

    <div class="sec-head">
      <h2>Програма <em>курсу</em></h2>
      <span class="chip"><i></i>${COURSE.modules.length} ${mods_w(COURSE.modules.length)} · у своєму темпі</span>
    </div>

    <div class="mods">${COURSE.modules.map(cardMod).join('')}</div>
  </section>`;

  requestAnimationFrame(() => {
    const f = document.getElementById('roadFill'), t = document.getElementById('roadTruck');
    if (f) f.style.width = o.pct + '%';
    if (t) { t.style.left = o.pct + '%'; t.style.transform = 'translateX(-' + o.pct + '%)'; }
    document.querySelectorAll('.mini i').forEach(el => { el.style.width = el.dataset.w + '%'; });
  });
}

function cardMod(m) {
  const s = modStat(m);
  const soon = !m.video && !m.deck;
  const chip = s.full
    ? '<span class="chip done"><i></i>Пройдено</span>'
    : s.done > 0
      ? '<span class="chip going"><i></i>В процесі</span>'
      : soon
        ? '<span class="chip soon"><i></i>Скоро</span>'
        : '<span class="chip"><i></i>Не розпочато</span>';
  return `
  <a class="mod${s.full ? ' done' : ''}${m.kind === 'intro' && !s.full ? ' intro' : ''}" href="#/m/${m.id}">
    <div class="num"><b>${esc(m.num)}</b>${chip}</div>
    <h3>${esc(m.title)}</h3>
    <p>${esc(m.lead)}</p>
    <div class="mini"><i data-w="${s.pct}"></i></div>
    <div class="mod-foot"><span>${m.duration ? esc(m.duration) + ' · ' : ''}${s.done} / ${s.total} ${steps_w(s.total)}</span><span>Відкрити →</span></div>
  </a>`;
}

/* ============================================================
   ЕКРАН: МОДУЛЬ
   ============================================================ */
function renderModule(id) {
  const m = moduleById(id);
  if (!m) return renderHome();
  const idx = COURSE.modules.indexOf(m);
  const prev = COURSE.modules[idx - 1], next = COURSE.modules[idx + 1];
  const s = modStat(m);
  const av = steps(m);
  const hw = HW[m.id];

  const player = m.video && CONFIG.BUNNY_LIBRARY_ID
    ? `<iframe src="https://iframe.mediadelivery.net/embed/${encodeURIComponent(CONFIG.BUNNY_LIBRARY_ID)}/${encodeURIComponent(m.video)}?autoplay=false&preload=true&responsive=true" loading="lazy" allow="accelerometer;gyroscope;encrypted-media;picture-in-picture;fullscreen" allowfullscreen></iframe>`
    : `<div class="soon-box">
         <span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span>
         <b>Відео скоро зʼявиться</b>
         <span>Вероніка завантажує урок. Поки що можна прочитати план модуля і виконати домашнє завдання.</span>
       </div>`;

  const deckPane = m.deck
    ? `<a class="dl" href="materials/presentations/${encodeURI(m.deck)}" target="_blank" rel="noopener" data-step="deck">
         <span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg></span>
         <span><b>Презентація · модуль ${esc(m.num)}</b><small>PDF · усе, що я розповідаю в уроці</small></span>
         <span class="go">↗</span>
       </a>`
    : `<div class="dl off">
         <span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg></span>
         <span><b>Презентація готується</b><small>Зʼявиться тут після завантаження</small></span>
       </div>`;

  const filesHtml = m.files && m.files.length
    ? m.files.map(f => `<a class="dl" style="margin-top:12px" href="materials/files/${encodeURI(f.file)}" target="_blank" rel="noopener">
        <span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 20 3 17V4l6 3 6-3 6 3v13l-6-3-6 3Z"/><path d="M9 7v13M15 4v13"/></svg></span>
        <span><b>${esc(f.title)}</b><small>${esc(f.note || 'Додатковий матеріал')}</small></span><span class="go">↗</span></a>`).join('')
    : `<p class="muted" style="margin-top:14px">До цього модуля окремих файлів поки немає.</p>`;

  view.innerHTML = `
  <section class="page">
    <div class="crumbs"><a href="#/">Навчання</a><span>/</span><span>Модуль ${esc(m.num)}</span></div>

    <div class="page-head" style="margin-bottom:26px">
      <span class="label">Модуль ${esc(m.num)}${m.duration ? ' · ' + esc(m.duration) : ''}</span>
      <h1 style="font-size:clamp(30px,3.8vw,50px)">${esc(m.title)}</h1>
      <p class="lead">${esc(m.lead)}</p>
    </div>

    <div class="lesson-grid">
      <div>
        <div class="player">${player}</div>

        <div class="tabs" id="tabs">
          <button class="on" data-pane="plan">План уроку</button>
          <button data-pane="deck">Презентація</button>
          <button data-pane="hw">Домашнє завдання</button>
          <button data-pane="files">Матеріали</button>
        </div>

        <div class="pane on" data-pane="plan">
          <div class="card">
            <h3>Що розбираємо</h3>
            <ul class="points">${m.points.map((p, i) => `<li><i>${i + 1}</i><span>${esc(p)}</span></li>`).join('')}</ul>
          </div>
        </div>

        <div class="pane" data-pane="deck"><div class="card"><h3>Презентація</h3><p style="margin-bottom:18px">Той самий матеріал у текстовому вигляді — зручно повертатися й шукати потрібне.</p>${deckPane}</div></div>

        <div class="pane" data-pane="hw"><div class="card" id="hwCard">${hwBlock(m, hw)}</div></div>

        <div class="pane" data-pane="files"><div class="card"><h3>Матеріали модуля</h3>${filesHtml}</div></div>
      </div>

      <aside class="side">
        <div class="side-card">
          <h4>Ваш прогрес</h4>
          <div class="ring">
            ${ringSvg(s.pct)}
            <div><b>${s.pct}%</b><span>${s.done} з ${s.total} ${steps_w(s.total)}</span></div>
          </div>
        </div>

        <div class="side-card">
          <h4>Кроки модуля</h4>
          <div class="steps">
            ${av.map(st => `
              <label${st.key === 'hw' ? ' class="lock"' : ''}>
                <span>${st.label}${st.key === 'hw' ? '<small>Позначається після надсилання</small>' : ''}</span>
                <i class="tg sm${stepDone(m, st.key) ? ' on' : ''}" data-step="${st.key}" role="switch" aria-checked="${stepDone(m, st.key)}" tabindex="0"></i>
              </label>`).join('')}
            ${!m.video ? '<label class="lock"><span>Відео-урок<small>Зʼявиться пізніше</small></span><i class="tg sm"></i></label>' : ''}
            ${!m.deck ? '<label class="lock"><span>Презентація<small>Зʼявиться пізніше</small></span><i class="tg sm"></i></label>' : ''}
          </div>
        </div>

        <div class="nav-lr">
          <a href="${prev ? '#/m/' + prev.id : '#'}" class="${prev ? '' : 'off'}"><small>← Попередній</small><b>${prev ? esc(prev.title) : '—'}</b></a>
          <a href="${next ? '#/m/' + next.id : '#'}" class="next ${next ? '' : 'off'}"><small>Наступний →</small><b>${next ? esc(next.title) : '—'}</b></a>
        </div>
      </aside>
    </div>
  </section>`;

  /* вкладки */
  const tabs = document.getElementById('tabs');
  tabs.addEventListener('click', e => {
    const b = e.target.closest('button[data-pane]'); if (!b) return;
    tabs.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    view.querySelectorAll('.pane').forEach(p => p.classList.toggle('on', p.dataset.pane === b.dataset.pane));
  });

  /* тумблери кроків */
  view.querySelectorAll('.tg[data-step]').forEach(t => {
    const toggle = async () => {
      const on = !t.classList.contains('on');
      t.classList.toggle('on', on);
      t.setAttribute('aria-checked', String(on));
      PROG[key(m, t.dataset.step)] = on || undefined;
      if (!on) delete PROG[key(m, t.dataset.step)];
      await API.setProgress(USER.email, key(m, t.dataset.step), on);
      const ns = modStat(m);
      view.querySelector('.ring b').textContent = ns.pct + '%';
      view.querySelector('.ring span').textContent = `${ns.done} з ${ns.total} ${steps_w(ns.total)}`;
      const c = view.querySelector('.ring .fgc');
      c.style.strokeDashoffset = String(201 - 201 * ns.pct / 100);
    };
    t.addEventListener('click', toggle);
    t.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  });

  /* відкриття презентації = крок зараховано */
  const deckLink = view.querySelector('.dl[data-step="deck"]');
  if (deckLink) deckLink.addEventListener('click', () => {
    const t = view.querySelector('.tg[data-step="deck"]');
    if (t && !t.classList.contains('on')) t.click();
  });

  bindHwForm(m);
}

function ringSvg(pct) {
  const off = 201 - 201 * pct / 100;
  return `<svg viewBox="0 0 74 74"><circle class="bgc" cx="37" cy="37" r="32"/><circle class="fgc" cx="37" cy="37" r="32" stroke-dasharray="201" stroke-dashoffset="${off}"/></svg>`;
}

/* ---------------- домашнє завдання ---------------- */
function hwBlock(m, hw) {
  const state = !hw ? '' : hw.status === 'reviewed'
    ? `<div class="hw-state reviewed"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="#1E6B34" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg></span>Вероніка перевірила вашу роботу</div>`
    : `<div class="hw-state sent"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="#244A5E" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span>Надіслано — чекаємо на перевірку</div>`;

  const fb = hw && hw.feedback
    ? `<div class="feedback"><small>Коментар Вероніки</small><p>${nl2br(hw.feedback)}</p></div>` : '';

  return `
    <h3>Домашнє завдання</h3>
    ${state}
    <div class="task">${nl2br(m.homework)}</div>
    <div class="msg ok" id="hwOk">Готово! Домашнє надіслано Вероніці.</div>
    <div class="msg err" id="hwErr"></div>
    <form id="hwForm">
      <label class="field">
        <span>Ваша відповідь</span>
        <textarea name="answer" required placeholder="Напишіть відповідь тут…">${esc(hw ? hw.answer : '')}</textarea>
      </label>
      <label class="field">
        <span>Посилання на файл (необовʼязково)</span>
        <input name="link" placeholder="Google Drive, Dropbox…" value="${esc(hw && hw.link ? hw.link : '')}">
        <small>Якщо роботу зручніше надіслати файлом — завантажте його в хмару і вставте посилання.</small>
      </label>
      <button class="btn btn-green" type="submit">${hw ? 'Оновити відповідь' : 'Надіслати домашнє'} ${iconArr}</button>
    </form>
    ${fb}`;
}

function bindHwForm(m) {
  const form = document.getElementById('hwForm');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const ok = document.getElementById('hwOk'), err = document.getElementById('hwErr');
    ok.classList.remove('show'); err.classList.remove('show');
    const btn = form.querySelector('button'); btn.disabled = true;
    try {
      const answer = form.answer.value.trim();
      if (!answer) throw new Error('Напишіть відповідь перед надсиланням.');
      await API.submitHomework(USER.email, m.id, answer, form.link.value.trim());
      await refresh();
      ok.classList.add('show');
      const t = document.querySelector('.tg[data-step="hw"]');
      if (t) { t.classList.add('on'); t.setAttribute('aria-checked', 'true'); }
      const ns = modStat(m);
      document.querySelector('.ring b').textContent = ns.pct + '%';
      document.querySelector('.ring span').textContent = `${ns.done} з ${ns.total} ${steps_w(ns.total)}`;
      document.querySelector('.ring .fgc').style.strokeDashoffset = String(201 - 201 * ns.pct / 100);
      btn.textContent = 'Оновити відповідь';
    } catch (ex) {
      err.textContent = ex.message; err.classList.add('show');
    }
    btn.disabled = false;
  });
}

/* ============================================================
   ЕКРАН: МОЇ ДОМАШНІ
   ============================================================ */
function renderHomework() {
  const rows = COURSE.modules.map(m => ({ m, hw: HW[m.id] }));
  const sent = rows.filter(r => r.hw).length;

  view.innerHTML = `
  <section class="page">
    <div class="page-head">
      <span class="label">Домашні завдання</span>
      <h1>Ваші <em>роботи</em></h1>
      <p class="lead">Надіслано ${sent} з ${COURSE.modules.length}. Вероніка перевіряє роботи вручну — коментар зʼявиться тут і всередині модуля.</p>
    </div>
    <div class="hw-list">
      ${rows.map(({ m, hw }) => `
        <a class="hw-row" href="#/m/${m.id}">
          <span class="n">${esc(m.num)}</span>
          <span><b>${esc(m.title)}</b><p>${hw ? esc(hw.answer) : esc(m.homework)}</p></span>
          ${hw
            ? (hw.status === 'reviewed'
              ? '<span class="chip done"><i></i>Перевірено</span>'
              : '<span class="chip going"><i></i>На перевірці</span>')
            : '<span class="chip"><i></i>Не надіслано</span>'}
        </a>`).join('')}
    </div>
  </section>`;
}

/* ============================================================
   ЕКРАН: МАТЕРІАЛИ
   ============================================================ */
function renderMaterials() {
  const decks = COURSE.modules.filter(m => m.deck);
  const files = COURSE.modules.flatMap(m => (m.files || []).map(f => ({ ...f, m })));

  view.innerHTML = `
  <section class="page">
    <div class="page-head">
      <span class="label">Матеріали</span>
      <h1>Усе <em>в одному місці</em></h1>
      <p class="lead">Презентації, файли з маршрутами, документи й шаблони. Тут завжди остання версія.</p>
    </div>

    <div class="card">
      <h3 style="margin-bottom:18px">Презентації</h3>
      ${decks.length
        ? decks.map(m => `<a class="dl" style="margin-bottom:12px" href="materials/presentations/${encodeURI(m.deck)}" target="_blank" rel="noopener">
            <span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg></span>
            <span><b>${esc(m.num)} · ${esc(m.title)}</b><small>PDF-презентація модуля</small></span><span class="go">↗</span></a>`).join('')
        : `<div class="empty" style="padding:40px 10px">
             <div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg></div>
             <h3>Презентації готуються</h3><p>Зʼявляться тут одразу після завантаження.</p></div>`}
    </div>

    <div class="card">
      <h3 style="margin-bottom:18px">Файли й шаблони</h3>
      ${files.length
        ? files.map(f => `<a class="dl" style="margin-bottom:12px" href="materials/files/${encodeURI(f.file)}" target="_blank" rel="noopener">
            <span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 20 3 17V4l6 3 6-3 6 3v13l-6-3-6 3Z"/><path d="M9 7v13M15 4v13"/></svg></span>
            <span><b>${esc(f.title)}</b><small>Модуль ${esc(f.m.num)} · ${esc(f.note || 'матеріал')}</small></span><span class="go">↗</span></a>`).join('')
        : `<p class="muted">Файли з маршрутами, CMR, zlecenie і книгу про час праці водія Вероніка додасть сюди.</p>`}
    </div>
  </section>`;
}

/* ============================================================
   РОУТЕР
   ============================================================ */
function route() {
  const h = (location.hash || '#/').slice(1);
  document.querySelectorAll('.menu a[data-route]').forEach(a =>
    a.classList.toggle('on', a.dataset.route === (h.startsWith('/m/') ? '/' : h)));
  menu.classList.remove('open');
  window.scrollTo(0, 0);

  if (h.startsWith('/m/')) return renderModule(h.slice(3));
  if (h === '/homework')  return renderHomework();
  if (h === '/materials') return renderMaterials();
  return renderHome();
}

/* ============================================================
   СТАРТ
   ============================================================ */
(async function start() {
  if (API.isDemo) document.getElementById('demoBar').hidden = false;

  USER = await API.currentUser();
  if (!USER) { location.replace('index.html'); return; }
  if (USER.blocked) {
    boot.classList.add('hide');
    view.innerHTML = `<section class="page"><div class="empty">
      <div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></div>
      <h3>Доступ ще не відкрито</h3>
      <p>Ви увійшли як ${esc(USER.email)}, але цієї пошти немає в списку учениць.<br>Напишіть Вероніці — вона додасть вас.</p>
      <p style="margin-top:22px"><a href="index.html" class="btn-sm">Увійти іншою поштою</a></p>
    </div></section>`;
    return;
  }

  document.getElementById('whoName').textContent = USER.full_name || USER.email;
  const av = document.getElementById('whoAv');
  av.textContent = initials(USER);
  if (USER.is_admin) { av.classList.add('adm'); const l = document.getElementById('admLink'); l.hidden = false; l.href = 'admin.html'; }

  await refresh();
  route();
  boot.classList.add('hide');

  addEventListener('hashchange', route);
  document.getElementById('burger').addEventListener('click', () => menu.classList.toggle('open'));
  document.getElementById('exit').addEventListener('click', async () => {
    await API.signOut(); location.replace('index.html');
  });
})();
