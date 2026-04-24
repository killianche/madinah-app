-- Madinah App — initial schema
-- PostgreSQL 16+
-- Created: 2026-04-24

set search_path = public;

-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "pg_trgm";    -- fuzzy student search

-- ============================================================
-- ENUMS
-- ============================================================
create type user_role as enum (
  'admin',      -- Руслан (разработчик/владелец системы)
  'director',   -- Директор школы
  'manager',    -- Менеджер
  'curator',   -- Куратор
  'teacher'    -- Учитель
);

create type teacher_status as enum (
  'active',
  'archived'    -- ушедший, но история уроков сохранена
);

create type student_status as enum (
  'active',
  'paused',     -- временно не учится
  'archived'    -- закончил/ушёл
);

create type lesson_status as enum (
  'conducted',            -- Проведён         (−1 с баланса)
  'penalty',              -- Штрафной         (−1 с баланса)
  'cancelled_by_teacher', -- Отменён учителем (баланс не трогаем)
  'cancelled_by_student'  -- Отменён учеником (баланс не трогаем)
);

-- ============================================================
-- USERS (сотрудники школы, могут логиниться)
-- ============================================================
create table users (
  id              uuid primary key default gen_random_uuid(),
  role            user_role not null,
  full_name       text not null,
  phone           text unique,
  email           text unique,
  password_hash   text,                        -- argon2id; null если ещё не задал
  telegram_id     bigint unique,
  is_active       boolean not null default true,
  last_login_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_users_role on users(role) where is_active;

-- ============================================================
-- TEACHERS (профиль учителя; 1:1 с users если is_active)
-- ============================================================
create table teachers (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references users(id) on delete set null,  -- null для archived
  full_name       text not null,                 -- денормализовано: для archived учителей users нет
  phone           text,
  telegram_username text,
  status          teacher_status not null default 'active',
  hired_at        date,
  archived_at     date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_teachers_status on teachers(status);
create index idx_teachers_user on teachers(user_id) where user_id is not null;

-- ============================================================
-- STUDENTS
-- ============================================================
create table students (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null,
  phone           text,
  telegram_username text,
  teacher_id      uuid references teachers(id) on delete set null,
  balance         int not null default 0,       -- может уйти в минус
  is_charity      boolean not null default false,
  charity_since   date,
  charity_note    text,
  status          student_status not null default 'active',
  enrolled_at     date,
  archived_at     date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_students_teacher on students(teacher_id) where status = 'active';
create index idx_students_status on students(status);
create index idx_students_charity on students(is_charity) where is_charity;
create index idx_students_name_trgm on students using gin (full_name gin_trgm_ops);
create index idx_students_phone on students(phone) where phone is not null;
create index idx_students_tg on students(telegram_username) where telegram_username is not null;

-- ============================================================
-- LESSONS
-- ============================================================
create table lessons (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references students(id) on delete restrict,
  teacher_id      uuid not null references teachers(id) on delete restrict,
  lesson_date     date not null,
  lesson_time     time,                          -- null = время не указано (импорт из CSV)
  status          lesson_status not null,
  duration_units  int not null default 1 check (duration_units > 0),
  topic           text,
  notes           text,
  created_by      uuid references users(id),
  created_at      timestamptz not null default now(),
  edited_at       timestamptz,
  deleted_at      timestamptz                    -- soft delete
);

create index idx_lessons_teacher_date on lessons(teacher_id, lesson_date desc) where deleted_at is null;
create index idx_lessons_student_date on lessons(student_id, lesson_date desc) where deleted_at is null;
create index idx_lessons_date on lessons(lesson_date desc) where deleted_at is null;
create index idx_lessons_status on lessons(status) where deleted_at is null;

-- ============================================================
-- BALANCE TOPUPS (история пополнений)
-- ============================================================
create table balance_topups (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references students(id) on delete restrict,
  lessons_added   int not null check (lessons_added <> 0),  -- можно и отрицательное (корректировка)
  reason          text,
  added_by        uuid references users(id),
  created_at      timestamptz not null default now()
);

create index idx_topups_student on balance_topups(student_id, created_at desc);

-- ============================================================
-- AUDIT LOG (партиционирование по месяцу)
-- ============================================================
create table audit_log (
  id              bigserial,
  actor_id        uuid references users(id),
  action          text not null,                 -- 'lesson.create', 'student.update', ...
  entity_type     text not null,
  entity_id       uuid,
  diff            jsonb,
  ip              inet,
  user_agent      text,
  created_at      timestamptz not null default now(),
  primary key (id, created_at)
) partition by range (created_at);

-- стартовая партиция: текущий месяц
create table audit_log_2026_04 partition of audit_log
  for values from ('2026-04-01') to ('2026-05-01');
create table audit_log_2026_05 partition of audit_log
  for values from ('2026-05-01') to ('2026-06-01');

create index idx_audit_actor on audit_log(actor_id, created_at desc);
create index idx_audit_entity on audit_log(entity_type, entity_id, created_at desc);

-- ============================================================
-- TRIGGERS
-- ============================================================
-- updated_at автоматом
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_users_updated     before update on users     for each row execute function set_updated_at();
create trigger trg_teachers_updated  before update on teachers  for each row execute function set_updated_at();
create trigger trg_students_updated  before update on students  for each row execute function set_updated_at();

-- Пересчёт balance на лету при вставке/обновлении/удалении урока или пополнения.
-- НЕ используем триггеры для balance — считаем его явно в приложении в транзакции,
-- чтобы избежать race conditions и упростить отладку. Балансы периодически сверяются
-- скриптом reconcile_balances.sql (см. /scripts).

-- ============================================================
-- VIEWS — удобные проекции для UI и Metabase
-- ============================================================

-- Ученик + учитель + реальный баланс (посчитанный из истории)
create view v_student_full as
select
  s.*,
  t.full_name as teacher_name,
  coalesce(
    (select sum(lessons_added) from balance_topups where student_id = s.id),
    0
  ) - coalesce(
    (select count(*) from lessons
     where student_id = s.id
       and status in ('conducted', 'penalty')
       and deleted_at is null),
    0
  ) as balance_calculated
from students s
left join teachers t on t.id = s.teacher_id;

-- Урок с именами (для истории, экспорта)
create view v_lesson_full as
select
  l.id,
  l.lesson_date,
  l.lesson_time,
  l.status,
  s.id   as student_id,
  s.full_name as student_name,
  t.id   as teacher_id,
  t.full_name as teacher_name,
  l.topic,
  l.notes,
  l.created_at
from lessons l
join students s on s.id = l.student_id
join teachers t on t.id = l.teacher_id
where l.deleted_at is null;

comment on database current_database() is 'Madinah App — журнал уроков арабской школы';
