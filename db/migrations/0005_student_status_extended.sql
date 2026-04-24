-- Madinah App — миграция 0005
-- 1) Расширение статусов ученика: добавляем 'graduated' и 'dropped'.
-- 2) Отказ от концепции «вне графика»: удаляем lessons.scheduled_date/scheduled_time.
--    Расписание ученика (student_schedules) теперь — просто визуальное напоминание учителю.
-- 3) Переписываем teacher_day_agenda без ссылок на scheduled_*.

set search_path = public;

-- ============================================================
-- 1. Статусы ученика: graduated / dropped
-- ============================================================
alter type student_status add value if not exists 'graduated';
alter type student_status add value if not exists 'dropped';

comment on type student_status is
  'active — обучается; paused — в отпуске; graduated — выпускник; dropped — бросил; archived — архив (общий)';

-- ============================================================
-- 2. Удаляем scheduled_date / scheduled_time из lessons
-- ============================================================
drop index if exists idx_lessons_scheduled_date;

-- функция agenda ссылалась на эти колонки — дропаем, ниже пересоздадим без них
drop function if exists teacher_day_agenda(uuid, date);

alter table lessons drop column if exists scheduled_date;
alter table lessons drop column if exists scheduled_time;

-- ============================================================
-- 3. Новая teacher_day_agenda — без off_schedule/scheduled_date
-- ============================================================
create or replace function teacher_day_agenda(p_teacher_id uuid, p_date date)
returns table (
  kind              text,            -- 'scheduled' | 'lesson'
  slot_time         time,
  student_id        uuid,
  student_name      text,
  student_balance   int,
  lesson_id         uuid,
  lesson_status     lesson_status
) language sql stable as $$
  -- слоты-напоминалки из расписания ученика на этот день недели
  select
    'scheduled'::text           as kind,
    sc.time_at                  as slot_time,
    s.id                        as student_id,
    s.full_name                 as student_name,
    s.balance                   as student_balance,
    null::uuid                  as lesson_id,
    null::lesson_status         as lesson_status
  from student_schedules sc
  join students s on s.id = sc.student_id
  where sc.active = true
    and s.teacher_id = p_teacher_id
    and s.status = 'active'
    and sc.weekday = extract(isodow from p_date)::smallint

  union all

  -- все записанные уроки на эту дату
  select
    'lesson'::text              as kind,
    l.lesson_time               as slot_time,
    s.id                        as student_id,
    s.full_name                 as student_name,
    s.balance                   as student_balance,
    l.id                        as lesson_id,
    l.status                    as lesson_status
  from lessons l
  join students s on s.id = l.student_id
  where l.teacher_id = p_teacher_id
    and l.lesson_date = p_date
    and l.deleted_at is null;
$$;

comment on function teacher_day_agenda(uuid, date) is
  'Дневная повестка учителя: слоты-напоминалки + фактические уроки на дату. Никакой автоматической связи.';
