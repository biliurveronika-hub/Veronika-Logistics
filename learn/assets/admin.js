/* ============================================================
   Адмінка Вероніки: учениці, прогрес, перевірка домашніх
   ============================================================ */
import { CONFIG } from './config.js';
import { API } from './api.js';
import { COURSE, STEPS, moduleById, PLANS, planOf } from './course.js';

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
const iso = d => d.toISOString().slice(0, 10);

function accessChip(st) {
  if (st.active === false) return '<span class="chip soon"><i></i>Призупинено</span>';
  if (!st.access_until)    return '<span class="chip"><i></i>Без обмежень</span>';
  const till = new Date(st.access_until + 'T23:59:59');
  const left = Math.ceil((till - new Date()) / 86400000);
  if (left < 0)   return '<span class="chip soon"><i></i>Завершився ' + dt(st.access_until) + '</span>';
  if (left <= 14) return '<span class="chip going"><i></i>' + left + ' дн. · до ' + dt(st.access_until) + '</span>';
  return '<span class="chip done"><i></i>до ' + dt(st.access_until) + '</span>';
}

function drawStudents() {
  const total = availableSteps();
  const byMail = {};
  PROGRESS.forEach(r => { byMail[r.email] = (byMail[r.email] || 0) + 1; });

  document.getElementById('cnt').innerHTML = `<i></i>${STUDENTS.length} у списку`;

  document.getElementById('stTbl').innerHTML = `
    <thead><tr><th>Учениця</th><th>Тариф</th><th style="min-width:140px">Прогрес</th><th>Доступ</th><th></th></tr></thead>
    <tbody>${STUDENTS.map(st => {
      const done = byMail[st.email] || 0;
      const pct = total ? Math.round(done / total * 100) : 0;
      const pl = planOf(st.plan);
      return `<tr class="st-row${st.active === false ? ' off' : ''}">
        <td><b>${esc(st.full_name || '—')}</b><small>${esc(st.email)}${st.is_admin ? ' · викладач' : ''}${st.flow ? ' · ' + esc(st.flow) : ''}</small></td>
        <td><span class="chip${pl.feedback ? ' going' : ''}"><i></i>${esc(pl.title)}</span></td>
        <td>
          <div class="bar${pct === 100 ? ' full' : ''}"><i style="width:${pct}%"></i></div>
          <small>${pct}% · ${done} з ${total} ${steps_w(total)}</small>
        </td>
        <td>${accessChip(st)}<small>додано ${dt(st.created_at)}</small></td>
        <td style="text-align:right">${st.is_admin ? '' : `<button class="btn-sm" data-edit="${esc(st.email)}">Змінити</button>`}</td>
      </tr>
      <tr class="st-edit" data-row="${esc(st.email)}" hidden><td colspan="5">
        <form class="edit-form" data-email="${esc(st.email)}">
          <div class="ef-grid">
            <label class="field"><span>Імʼя та прізвище</span><input name="full_name" value="${esc(st.full_name || '')}"></label>
            <label class="field"><span>Потік / група</span><input name="flow" value="${esc(st.flow || '')}"></label>
            <label class="field"><span>Тариф</span><select name="plan">
              ${Object.values(PLANS).map(pp => `<option value="${pp.id}"${st.plan === pp.id ? ' selected' : ''}>${pp.title} — ${pp.short}</option>`).join('')}
            </select></label>
            <label class="field"><span>Доступ до</span><input name="access_until" type="date" value="${esc(st.access_until || '')}"><small>Порожньо = без обмежень</small></label>
          </div>
          <label class="field"><span>Нотатка для себе</span><input name="note" value="${esc(st.note || '')}" placeholder="оплата, звідки прийшла…"></label>
          <div class="ef-quick">
            <span>Продовжити:</span>
            <button type="button" class="btn-sm" data-add="30">+1 місяць</button>
            <button type="button" class="btn-sm" data-add="90">+3 місяці</button>
            <button type="button" class="btn-sm" data-add="180">+6 місяців</button>
            <button type="button" class="btn-sm" data-add="0">Без обмежень</button>
          </div>
          <label class="choice ef-active">
            <span><b>Доступ відкрито</b><small>Зняти — закрити кабінет, не видаляючи прогрес</small></span>
            <input type="checkbox" name="active" ${st.active !== false ? 'checked' : ''}><i class="tg"></i>
          </label>
          <div class="ef-foot">
            <button class="btn btn-green" type="submit">Зберегти <span class="arr"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M7 17 17 7M8 7h9v9"/></svg></span></button>
            <button type="button" class="btn-sm" data-close>Закрити</button>
            <button type="button" class="btn-sm danger" data-del="${esc(st.email)}">Видалити назавжди</button>
          </div>
        </form>
      </td></tr>`;
    }).join('')}</tbody>`;

  /* розгорнути / згорнути картку учениці */
  document.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => {
    const row = document.querySelector('.st-edit[data-row="' + CSS.escape(b.dataset.edit) + '"]');
    const open = row.hidden;
    document.querySelectorAll('.st-edit').forEach(r => { r.hidden = true; });
    document.querySelectorAll('[data-edit]').forEach(x => { x.textContent = 'Змінити'; });
    row.hidden = !open;
    if (open) b.textContent = 'Згорнути';
  }));
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => {
    b.closest('.st-edit').hidden = true;
    document.querySelectorAll('[data-edit]').forEach(x => { x.textContent = 'Змінити'; });
  }));

  /* швидке продовження строку */
  document.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => {
    const f = b.closest('form');
    const n = Number(b.dataset.add);
    if (!n) { f.access_until.value = ''; return; }
    const cur = f.access_until.value ? new Date(f.access_until.value) : null;
    const base = (cur && cur > new Date()) ? cur : new Date();
    base.setDate(base.getDate() + n);
    f.access_until.value = iso(base);
  }));

  /* збереження змін */
  document.querySelectorAll('.edit-form').forEach(f => f.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = f.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      await API.updateStudent(f.dataset.email, {
        full_name: f.full_name.value.trim() || null,
        flow: f.flow.value.trim() || null,
        plan: f.plan.value,
        access_until: f.access_until.value || null,
        note: f.note.value.trim() || null,
        active: f.active.checked
      });
      STUDENTS = await API.listStudents();
      drawStudents();
      toast('Збережено');
    } catch (ex) { toast(ex.message, true); btn.disabled = false; }
  }));

  /* видалення назавжди */
  document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
    const email = b.dataset.del;
    const warn = 'Видалити ' + email + ' назавжди?\n\n' +
      'Разом з ученицею зникнуть її прогрес і домашні.\n' +
      'Щоб просто закрити доступ — зніміть перемикач «Доступ відкрито».';
    if (!confirm(warn)) return;
    b.disabled = true;
    try {
      await API.removeStudent(email);
      STUDENTS = await API.listStudents();
      drawStudents();
      toast('Ученицю видалено');
    } catch (e) { toast(e.message, true); b.disabled = false; }
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

/* ---------------- спливаюче повідомлення ---------------- */
let toastTimer = null;
function toast(text, bad) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = text;
  el.classList.toggle('bad', !!bad);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
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
        plan: form.plan.value,
        note: form.note.value.trim(),
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
