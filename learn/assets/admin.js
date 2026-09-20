/* ============================================================
   Адмінка Вероніки: учениці, прогрес, перевірка домашніх
   ============================================================ */
import { CONFIG } from './config.js';
import { API } from './api.js';
import { COURSE, STEPS, moduleById } from './course.js';

const boot = document.getElementById('boot');
const menu = document.getElementById('menu');

let USER = null, STUDENTS = [], PROGRESS = [], HOMEWORK = [];

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl2br = s => esc(s).replace(/\n/g, '<br>');

/* скільки кроків зараз реально доступно в курсі */
function availableSteps() {
  return COURSE.modules.reduce((n, m) =>
    n + STEPS.filter(s => s.key === 'hw' || (s.key === 'video' ? !!m.video : !!m.deck)).length, 0);
}
const plural = (n, f) => {
  const a = Math.abs(n) % 100, b = a % 10;
  return f[a > 10 && a < 20 ? 2 : b === 1 ? 0 : b > 1 && b < 5 ? 1 : 2];
};
const steps_w = n => plural(n, ['крок', 'кроки', 'кроків']);
const dt = s => s ? new Date(s).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const dtm = s => s ? new Date(s).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

/* ---------------- учениці ---------------- */
function drawStudents() {
  const total = availableSteps();
  const byMail = {};
  PROGRESS.forEach(r => { byMail[r.email] = (byMail[r.email] || 0) + 1; });

  document.getElementById('cnt').innerHTML = `<i></i>${STUDENTS.length} у списку`;

  document.getElementById('stTbl').innerHTML = `
    <thead><tr><th>Учениця</th><th>Потік</th><th style="min-width:150px">Прогрес</th><th>Доступ</th><th></th></tr></thead>
    <tbody>${STUDENTS.map(s => {
      const done = byMail[s.email] || 0;
      const pct = total ? Math.round(done / total * 100) : 0;
      return `<tr>
        <td><b>${esc(s.full_name || '—')}</b><small>${esc(s.email)}${s.is_admin ? ' · викладач' : ''}</small></td>
        <td>${esc(s.flow || '—')}</td>
        <td>
          <div class="bar${pct === 100 ? ' full' : ''}"><i style="width:${pct}%"></i></div>
          <small>${pct}% · ${done} з ${total} ${steps_w(total)}</small>
        </td>
        <td>${s.access_until ? dt(s.access_until) : 'без обмежень'}<small>додано ${dt(s.created_at)}</small></td>
        <td style="text-align:right">${s.is_admin ? '' : `<button class="btn-sm danger" data-del="${esc(s.email)}">Видалити</button>`}</td>
      </tr>`;
    }).join('')}</tbody>`;

  document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
    const email = b.dataset.del;
    if (!confirm(`Прибрати ${email} зі списку? Учениця втратить доступ до кабінету.`)) return;
    b.disabled = true;
    try { await API.removeStudent(email); STUDENTS = await API.listStudents(); drawStudents(); }
    catch (e) { alert(e.message); b.disabled = false; }
  }));
}

/* ---------------- домашні ---------------- */
function drawHomework() {
  const wait = HOMEWORK.filter(h => h.status !== 'reviewed').length;
  document.getElementById('hwCnt').innerHTML = `<i></i>${wait} чекає перевірки · ${HOMEWORK.length} усього`;

  const box = document.getElementById('hwList');
  if (!HOMEWORK.length) {
    box.innerHTML = `<div class="empty">
      <div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></div>
      <h3>Поки що порожньо</h3><p>Тут зʼявляться домашні завдання, щойно учениці їх надішлють.</p></div>`;
    return;
  }

  box.innerHTML = HOMEWORK.map(h => {
    const m = moduleById(h.module_id);
    const st = STUDENTS.find(s => s.email === h.email);
    return `<details${h.status !== 'reviewed' ? ' open' : ''}>
      <summary>
        <span class="chip${h.status === 'reviewed' ? ' done' : ' going'}"><i></i>${h.status === 'reviewed' ? 'Перевірено' : 'Нове'}</span>
        <b>${esc(st && st.full_name ? st.full_name : h.email)} · модуль ${esc(m ? m.num : h.module_id)} ${esc(m ? m.title : '')}</b>
        <span class="muted" style="font-size:13px;font-weight:600">${dtm(h.updated_at || h.created_at)}</span>
      </summary>
      <div class="ans">${nl2br(h.answer)}${h.link ? `<p style="margin-top:14px"><a href="${esc(h.link)}" target="_blank" rel="noopener">Файл від учениці ↗</a></p>` : ''}</div>
      <form class="hwReview" data-email="${esc(h.email)}" data-mod="${esc(h.module_id)}" style="padding-bottom:20px">
        <label class="field"><span>Коментар для учениці</span><textarea name="feedback" placeholder="Що вийшло добре, що виправити…">${esc(h.feedback || '')}</textarea></label>
        <button class="btn-sm" type="submit">${h.status === 'reviewed' ? 'Оновити коментар' : 'Зберегти і позначити перевіреним'}</button>
      </form>
    </details>`;
  }).join('');

  document.querySelectorAll('.hwReview').forEach(f => f.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = f.querySelector('button'); btn.disabled = true; btn.textContent = 'Зберігаю…';
    try {
      await API.reviewHomework(f.dataset.email, f.dataset.mod, f.feedback.value.trim());
      HOMEWORK = await API.allHomework();
      drawHomework();
    } catch (ex) { alert(ex.message); btn.disabled = false; }
  }));
}

/* ---------------- старт ---------------- */
(async function start() {
  if (API.isDemo) document.getElementById('demoBar').hidden = false;

  USER = await API.currentUser();
  if (!USER) { location.replace('index.html'); return; }
  if (!USER.is_admin) { location.replace('app.html'); return; }

  document.getElementById('whoName').textContent = USER.full_name || USER.email;
  document.getElementById('whoAv').textContent = (USER.full_name || USER.email).slice(0, 1).toUpperCase();
  document.getElementById('loginUrl').textContent =
    (CONFIG.SITE_URL || location.origin) + location.pathname.replace(/\/[^/]*$/, '/');

  [STUDENTS, PROGRESS, HOMEWORK] = await Promise.all([API.listStudents(), API.allProgress(), API.allHomework()]);
  drawStudents();
  drawHomework();
  boot.classList.add('hide');

  document.getElementById('burger').addEventListener('click', () => menu.classList.toggle('open'));
  document.getElementById('exit').addEventListener('click', async () => { await API.signOut(); location.replace('index.html'); });

  document.getElementById('copyUrl').addEventListener('click', async e => {
    try {
      await navigator.clipboard.writeText(document.getElementById('loginUrl').textContent);
      e.target.textContent = 'Скопійовано ✓';
      setTimeout(() => { e.target.textContent = 'Копіювати'; }, 1600);
    } catch (ex) { alert('Скопіюйте вручну: ' + document.getElementById('loginUrl').textContent); }
  });

  const form = document.getElementById('addForm');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const err = document.getElementById('addErr'), ok = document.getElementById('addOk');
    err.classList.remove('show'); ok.classList.remove('show');
    const btn = form.querySelector('button[type=submit]'); btn.disabled = true;
    try {
      await API.addStudent({
        email: form.email.value,
        full_name: form.full_name.value.trim(),
        flow: form.flow.value.trim(),
        access_until: form.access_until.value || null
      });
      form.reset();
      ok.classList.add('show');
      [STUDENTS, PROGRESS] = await Promise.all([API.listStudents(), API.allProgress()]);
      drawStudents();
    } catch (ex) { err.textContent = ex.message; err.classList.add('show'); }
    btn.disabled = false;
  });
})();
