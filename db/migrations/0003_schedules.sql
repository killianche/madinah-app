-- Madinah App — расписание учеников + перенос уроков
-- PostgreSQL 16+
-- Добавляет:
--   1) student_schedules — регулярные слоты (день недели + время) для каждого ученика
--   2) lessons.scheduled_date / scheduled_time — плановое время, если урок проведён не по графику
--   3) view v_today_teacher_agenda — сегодняшние слоты + уже проведённые уроки для учителя

set search_path = public;

-- ============================================================
-- STUDENT SCHEDULES
-- У одного ученика может быть несколько слотов в неделю (пн/ср/пт и т.п.).
-- weekday: 1=пн, 2=вт, 3=ср, 4=чт, 5=пт, 6=сб, 7=вс (ISO 8601, совпадает с EXTRACT(ISODOW))
-- ============================================================
create table student_schedules (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references students(id) on delete cascade,
  weekday         smallint not null check (weekday between 1 and 7),
  time_at         time not null,                               -- локальное МСК время
  duration_min    smallint not null default 60 check (duration_min between 10 and 240),
  active          boolean not null default true,
  note            text,                                         -- «летом по средам»
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- один и тот же слот у одного ученика не дублируем
  unique (student_id, weekday, time_at) deferrable initially deferred
);

create index idx_schedules_student on student_schedules(student_id) where active;
create index idx_schedules_weekday on student_schedules(weekday, time_at) where active;

create trigger trg_schedules_updated
  before update on student_schedules
  for each row execute function set_updated_at();

comment on table student_schedules is
  'Регулярные слоты ученика (день недели + время). Не «события»: календарь строится на лету.';

-- ============================================================
-- LESSONS: scheduled_date / scheduled_time
-- Если урок проведён в тот же день, что и по графику — эти поля равны lesson_date/lesson_time.
-- Если урок перенесён (планово в понедельник, фактически во вторник) — scheduled_* хранит план,
-- lesson_date/lesson_time — факт.
-- ============================================================
alter table lessons
  add column scheduled_date date,
  add column scheduled_time time;

-- Для существующих записей: фактическая = плановой (миграция не знает о переносах).
update lessons set scheduled_date = lesson_date, scheduled_time = lesson_time where scheduled_date is null;

-- После бэкофилла делаем NOT NULL только для scheduled_date (scheduled_time как и lesson_time может быть null).
alter table lessons alter column scheduled_date set not null;

create index idx_lessons_scheduled_date on lessons(scheduled_date desc) where deleted_at is null;

comment on column lessons.lesson_date    is 'Фактическая дата проведения';
comment on column lessons.scheduled_date is 'Плановая дата по графику. = lesson_date, если не переносили';

-- ============================================================
-- VIEW: дневная повестка учителя
-- На вход teacher_id и дату, получаем объединение:
--   (a) слотов из расписания учеников этого учителя на этот день недели
--   (b) уроков, уже записанных этим учителем на эту дату (включая off-schedule)
-- Используется для экрана «Сегодня» у учителя.
-- Сделано функцией, т.к. view не может принимать параметры удобно.
-- ============================================================
create or replace function teacher_day_agenda(p_teacher_id uuid, p_date date)
returns table (
  kind              text,          -- 'scheduled' | 'lesson'
  slot_time         time,
  student_id        uuid,
  student_name      text,
  student_balance   int,
  lesson_id         uuid,
  lesson_status     lesson_status,
  scheduled_date    date,
  off_schedule      boolean
) language sql stable as $$
  -- слоты по расписанию на этот день недели, по которым ещё нет урока на p_date
  select
    'scheduled'::text as kind,
    sc.time_at        as slot_time,
    s.id              as student_id,
    s.full_name       as student_name,
    s.balance         as student_balance,
    null::uuid        as lesson_id,
    null::lesson_status as lesson_status,
    p_date            as scheduled_date,
    false             as off_schedule
  from student_schedules sc
  join students s on s.id = sc.student_id
  where sc.active
    and s.status = 'active'
    and s.teacher_id = p_teacher_id
    and sc.weekday = extract(isodow from p_date)::smallint
    and not exists (
      select 1 from lessons l
      where l.student_id = s.id
        and l.scheduled_date = p_date
        and l.deleted_at is null
    )

  union all

  -- уроки, уже записанные этим учителем на эту дату (фактически или по плану)
  select
    'lesson'::text,
    coalesce(l.lesson_time, l.scheduled_time) as slot_time,
    s.id,
    s.full_name,
    s.balance,
    l.id,
    l.status,
    l.scheduled_date,
    (l.scheduled_date <> l.lesson_date) as off_schedule
  from lessons l
  join students s on s.id = l.student_id
  where l.teacher_id = p_teacher_id
    and l.deleted_at is null
    and (l.scheduled_date = p_date or l.lesson_date = p_date)
$$;

comment on function teacher_day_agenda(uuid, date) is
  'Дневная повестка учителя: слоты по расписанию + уроки (включая проведённые не по графику)';
