/* ============================================================
   Шар даних. Працює у двох режимах:
   · SUPABASE — якщо заповнено config.js
   · ДЕМО     — інакше: усе в localStorage цього браузера
   ============================================================ */
import { CONFIG, IS_DEMO } from './config.js';

const LS = {
  session:  'vl_demo_session',
  progress: 'vl_demo_progress',
  hw:       'vl_demo_hw',
  students: 'vl_demo_students'
};
const read  = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

let sb = null;
async function client() {
  if (sb) return sb;
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  /* implicit, а не pkce: посилання з листа має спрацювати в будь-якому
     браузері, а не лише в тому, де його замовляли. Учениця відкриває пошту
     на телефоні — лист відкривається у вбудованому браузері поштового
     застосунку, і pkce там ламається. */
  sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    auth: { flowType: 'implicit', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true }
  });
  return sb;
}

const appUrl = () => {
  const origin = CONFIG.SITE_URL ? new URL(CONFIG.SITE_URL).origin : location.origin;
  return origin + location.pathname.replace(/\/[^/]*$/, '/app.html');
};

function demoStudents() {
  const saved = read(LS.students, null);
  if (saved) return saved;
  const seed = CONFIG.DEMO_STUDENTS.map(s => ({ ...s, created_at: new Date().toISOString(), access_until: null }));
  write(LS.students, seed);
  return seed;
}

export const API = {
  isDemo: IS_DEMO,

  /* ---------------- вхід ---------------- */

  async sendMagicLink(email) {
    email = String(email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Перевірте адресу пошти.');

    if (IS_DEMO) {
      const st = demoStudents().find(s => s.email.toLowerCase() === email);
      if (!st) throw new Error('Цієї пошти немає в списку учениць. Напишіть Вероніці — вона відкриє доступ.');
      write(LS.session, st);
      return { demo: true };
    }

    const s = await client();
    /* публічна функція email_allowed — єдине, що видно до входу */
    const { data: allowed, error: chkErr } = await s.rpc('email_allowed', { p_email: email });
    if (chkErr) throw new Error('Сервер недоступний. Спробуйте за хвилину.');
    if (!allowed) throw new Error('Цієї пошти немає в списку учениць. Напишіть Вероніці — вона відкриє доступ.');

    const { error } = await s.auth.signInWithOtp({
      email, options: { emailRedirectTo: appUrl(), shouldCreateUser: true }
    });
    if (error) throw new Error(error.message);
    return { demo: false };
  },

  /* вхід за паролем — якщо учениця його вже створила */
  async signInWithPassword(email, password) {
    email = String(email || '').trim().toLowerCase();

    if (IS_DEMO) {
      const st = demoStudents().find(s => s.email.toLowerCase() === email);
      if (!st) throw new Error('Цієї пошти немає в списку учениць.');
      write(LS.session, st);
      return { demo: true };
    }

    const s = await client();
    const { error } = await s.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(/credential/i.test(error.message)
        ? 'Пошта або пароль не підходять. Якщо пароль ще не створений — лишіть поле порожнім, і ми надішлемо посилання.'
        : error.message);
    }
    return { demo: false };
  },

  /* створити або змінити пароль (вже всередині кабінету) */
  async setPassword(password) {
    if (IS_DEMO) return true;
    const s = await client();
    const { error } = await s.auth.updateUser({ password, data: { has_password: true } });
    if (error) throw new Error(error.message);
    return true;
  },

  async hasPassword() {
    if (IS_DEMO) return true;
    const s = await client();
    const { data: { session } } = await s.auth.getSession();
    return !!(session && session.user && session.user.user_metadata
              && session.user.user_metadata.has_password);
  },

  async currentUser() {
    if (IS_DEMO) return read(LS.session, null);
    const s = await client();
    const { data: { session } } = await s.auth.getSession();
    if (!session) return null;
    const email = String(session.user.email).toLowerCase();
    const { data } = await s.from('students').select('*').eq('email', email).maybeSingle();
    return data || { email, full_name: email, is_admin: false, blocked: true };
  },

  async signOut() {
    if (IS_DEMO) { localStorage.removeItem(LS.session); return; }
    const s = await client(); await s.auth.signOut();
  },

  /* ---------------- прогрес ---------------- */

  async getProgress(email) {
    if (IS_DEMO) return read(LS.progress, {})[email] || {};
    const s = await client();
    const { data } = await s.from('progress').select('lesson_id,done').eq('email', email);
    const out = {};
    (data || []).forEach(r => { if (r.done) out[r.lesson_id] = true; });
    return out;
  },

  async setProgress(email, lessonId, done) {
    if (IS_DEMO) {
      const all = read(LS.progress, {});
      const mine = all[email] || {};
      if (done) mine[lessonId] = true; else delete mine[lessonId];
      all[email] = mine; write(LS.progress, all);
      return;
    }
    const s = await client();
    await s.from('progress').upsert(
      { email, lesson_id: lessonId, done, updated_at: new Date().toISOString() },
      { onConflict: 'email,lesson_id' }
    );
  },

  /* ---------------- домашні ---------------- */

  async getHomework(email) {
    if (IS_DEMO) {
      const rows = read(LS.hw, []).filter(r => r.email === email);
      return Object.fromEntries(rows.map(r => [r.module_id, r]));
    }
    const s = await client();
    const { data } = await s.from('homework').select('*').eq('email', email);
    return Object.fromEntries((data || []).map(r => [r.module_id, r]));
  },

  async submitHomework(email, moduleId, answer, link) {
    const row = {
      email, module_id: moduleId, answer, link: link || null,
      status: 'sent', updated_at: new Date().toISOString()
    };
    if (IS_DEMO) {
      const all = read(LS.hw, []).filter(r => !(r.email === email && r.module_id === moduleId));
      all.push({ ...row, id: Date.now(), feedback: null, created_at: row.updated_at });
      write(LS.hw, all);
    } else {
      const s = await client();
      const { error } = await s.from('homework').upsert(row, { onConflict: 'email,module_id' });
      if (error) throw new Error(error.message);
    }
    await API.setProgress(email, moduleId + ':hw', true);
  },

  /* ---------------- адмінка ---------------- */

  async listStudents() {
    if (IS_DEMO) return demoStudents();
    const s = await client();
    const { data, error } = await s.from('students').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async addStudent(st) {
    const row = {
      email: String(st.email).trim().toLowerCase(),
      full_name: st.full_name || null,
      flow: st.flow || null,
      access_until: st.access_until || null,
      plan: st.plan === 'self' ? 'self' : 'support',
      active: st.active !== false,
      note: st.note || null,
      is_admin: !!st.is_admin
    };
    if (IS_DEMO) {
      const all = demoStudents();
      if (all.some(x => x.email === row.email)) throw new Error('Така пошта вже є в списку.');
      all.unshift({ ...row, created_at: new Date().toISOString() });
      write(LS.students, all); return;
    }
    const s = await client();
    const { error } = await s.from('students').insert(row);
    if (error) throw new Error(error.code === '23505' ? 'Така пошта вже є в списку.' : error.message);
  },

  /* змінити тариф, строк доступу, імʼя, відкрити або закрити доступ */
  async updateStudent(email, patch) {
    const allowed = ['full_name', 'flow', 'access_until', 'plan', 'active', 'note'];
    const row = {};
    allowed.forEach(k => { if (k in patch) row[k] = patch[k]; });
    if (!Object.keys(row).length) return;

    if (IS_DEMO) {
      const all = demoStudents();
      const st = all.find(x => x.email === email);
      if (st) Object.assign(st, row);
      write(LS.students, all);
      return;
    }
    const s = await client();
    const { error } = await s.from('students').update(row).eq('email', email);
    if (error) throw new Error(error.message);
  },

  async removeStudent(email) {
    if (IS_DEMO) { write(LS.students, demoStudents().filter(s => s.email !== email)); return; }
    const s = await client();
    const { error } = await s.from('students').delete().eq('email', email);
    if (error) throw new Error(error.message);
  },

  async allProgress() {
    if (IS_DEMO) {
      const all = read(LS.progress, {}); const out = [];
      Object.entries(all).forEach(([email, m]) =>
        Object.keys(m).forEach(lesson_id => out.push({ email, lesson_id, done: true })));
      return out;
    }
    const s = await client();
    const { data } = await s.from('progress').select('email,lesson_id,done').eq('done', true);
    return data || [];
  },

  async allHomework() {
    if (IS_DEMO) return read(LS.hw, []).sort((a, b) => (b.updated_at > a.updated_at ? 1 : -1));
    const s = await client();
    const { data } = await s.from('homework').select('*').order('updated_at', { ascending: false });
    return data || [];
  },

  async reviewHomework(email, moduleId, feedback) {
    if (IS_DEMO) {
      const all = read(LS.hw, []);
      const r = all.find(x => x.email === email && x.module_id === moduleId);
      if (r) { r.feedback = feedback; r.status = 'reviewed'; r.updated_at = new Date().toISOString(); }
      write(LS.hw, all); return;
    }
    const s = await client();
    const { error } = await s.from('homework')
      .update({ feedback, status: 'reviewed', updated_at: new Date().toISOString() })
      .eq('email', email).eq('module_id', moduleId);
    if (error) throw new Error(error.message);
  }
};
