-- ============================================================
--  Veronika Logistics — база для кабінету учениць
--  Виконати один раз: Supabase → SQL Editor → New query → Run
-- ============================================================

-- ---------- 1. Таблиці ----------

create table if not exists public.students (
  email        text primary key,
  full_name    text,
  flow         text,
  access_until date,                                  -- порожньо = без обмежень
  plan         text not null default 'support',       -- 'self' або 'support'
  active       boolean not null default true,         -- зняти = закрити доступ, прогрес лишається
  note         text,                                  -- нотатка для себе: оплата, звідки прийшла
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);

-- якщо таблиця вже існувала з минулого запуску — додаємо нові колонки
alter table public.students add column if not exists plan   text    not null default 'support';
alter table public.students add column if not exists active boolean not null default true;
alter table public.students add column if not exists note   text;

alter table public.students drop constraint if exists students_plan_check;
alter table public.students add  constraint students_plan_check check (plan in ('self', 'support'));

create table if not exists public.progress (
  id         bigserial primary key,
  email      text not null references public.students(email) on delete cascade,
  lesson_id  text not null,
  done       boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (email, lesson_id)
);

create table if not exists public.homework (
  id         bigserial primary key,
  email      text not null references public.students(email) on delete cascade,
  module_id  text not null,
  answer     text not null,
  link       text,
  status     text not null default 'sent',
  feedback   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email, module_id)
);

create index if not exists progress_email_idx on public.progress (email);
create index if not exists homework_email_idx on public.homework (email);

-- ---------- 2. Хто зараз у системі ----------

create or replace function public.me() returns text
language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

-- security definer — щоб політика на students не викликала сама себе
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.students where email = public.me()), false)
$$;

-- ---------- 3. Захист рядків (RLS) ----------

alter table public.students enable row level security;
alter table public.progress enable row level security;
alter table public.homework enable row level security;

drop policy if exists students_self   on public.students;
drop policy if exists students_admin  on public.students;
drop policy if exists progress_self   on public.progress;
drop policy if exists progress_admin  on public.progress;
drop policy if exists homework_self   on public.homework;
drop policy if exists homework_admin  on public.homework;

-- учениця бачить тільки свій рядок; Вероніка — усі й може редагувати
create policy students_self  on public.students for select using (email = public.me());
create policy students_admin on public.students for all
  using (public.is_admin()) with check (public.is_admin());

-- прогрес: свій — читає й пише; Вероніка бачить увесь
create policy progress_self  on public.progress for all
  using (email = public.me()) with check (email = public.me());
create policy progress_admin on public.progress for all
  using (public.is_admin()) with check (public.is_admin());

-- домашні: учениця пише свої, Вероніка читає всі й додає коментар
create policy homework_self  on public.homework for all
  using (email = public.me()) with check (email = public.me());
create policy homework_admin on public.homework for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------- 4. Анонімна перевірка пошти перед входом ----------
-- Сторінка входу має дізнатися, чи є пошта в списку, ще ДО авторизації.
-- Ця функція повертає тільки true/false і нічого більше не розкриває.

create or replace function public.email_allowed(p_email text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.students where email = lower(trim(p_email)))
$$;

grant execute on function public.email_allowed(text) to anon, authenticated;

-- ---------- 5. АДМІНИ ----------
-- ⚠️ ЄДИНЕ МІСЦЕ, ЯКЕ ТРЕБА ЗМІНИТИ РУКАМИ.
-- Замініть пошти нижче на справжні — ТІ, якими будете заходити в кабінет.
-- Пошта має збігатися до літери, інакше адмінка не відкриється.
-- Другий рядок можна видалити, якщо адмін один.

insert into public.students (email, full_name, flow, plan, is_admin) values
  ('ЗАМІНІТЬ-НА-ПОШТУ-ВЕРОНІКИ', 'Вероніка', 'Викладач', 'support', true),
  ('ЗАМІНІТЬ-НА-ПОШТУ-ОЛЬГИ',   'Ольга',    'Адмін',    'support', true)
on conflict (email) do update set is_admin = true, active = true;
