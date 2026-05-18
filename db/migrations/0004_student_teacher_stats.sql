-- Madinah App — агрегат «История ученика по учителям»
-- Сколько уроков у ученика с каждым учителем (с разбивкой по статусам + даты).

set search_path = public;

create or replace view v_student_teacher_stats as
select
  l.student_id,
  l.teacher_id,
  t.full_name                                                       as teacher_name,
  t.status                                                          as teacher_status,
  count(*)::int                                                     as total,
  count(*) filter (where l.status = 'conducted')::int              as conducted,
  count(*) filter (where l.status = 'penalty')::int                as penalty,
  count(*) filter (where l.status = 'cancelled_by_student')::int   as cancelled_by_student,
  count(*) filter (where l.status = 'cancelled_by_teacher')::int   as cancelled_by_teacher,
  min(l.lesson_date)                                                as first_lesson_date,
  max(l.lesson_date)                                                as last_lesson_date
from lessons l
join teachers t on t.id = l.teacher_id
where l.deleted_at is null
group by l.student_id, l.teacher_id, t.full_name, t.status;

comment on view v_student_teacher_stats is
  'Разбивка уроков ученика по учителям (totals + статусы + период). Для карточки ученика и отчётов.';
