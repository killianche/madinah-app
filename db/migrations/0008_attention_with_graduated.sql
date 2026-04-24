-- Madinah App — v_student_attention v2:
-- + graduated секция
-- + skipping = последние 3 в ('penalty', 'cancelled_by_student')
--   (отмена учителем — не вина ученика, в серую зону не идёт)

set search_path = public;

create or replace view v_student_attention as
with last_conducted as (
  select student_id, max(lesson_date) as d
  from lessons
  where deleted_at is null and status = 'conducted'
  group by student_id
),
last_lesson as (
  select student_id, max(lesson_date) as d
  from lessons
  where deleted_at is null
  group by student_id
),
last_3_statuses as (
  select student_id,
         array_agg(status order by lesson_date desc, created_at desc) as statuses
  from (
    select student_id, status, lesson_date, created_at,
           row_number() over (partition by student_id order by lesson_date desc, created_at desc) as rn
    from lessons
    where deleted_at is null
  ) t
  where rn <= 3
  group by student_id
)
select
  s.id                                          as student_id,
  s.full_name                                   as student_name,
  s.phone,
  s.teacher_id,
  t.full_name                                   as teacher_name,
  s.status,
  lc.d                                          as last_conducted_date,
  ll.d                                          as last_any_lesson_date,
  l3.statuses                                   as last_3_statuses,
  case
    when s.status = 'dropped'   then 'dropped'
    when s.status = 'graduated' then 'graduated'
    when s.status = 'active' and (
      lc.d is null
      or (current_date - lc.d) >= 10
    ) then 'stale'
    when s.status = 'active'
         and array_length(l3.statuses, 1) >= 3
         and l3.statuses[1] in ('penalty'::lesson_status, 'cancelled_by_student'::lesson_status)
         and l3.statuses[2] in ('penalty'::lesson_status, 'cancelled_by_student'::lesson_status)
         and l3.statuses[3] in ('penalty'::lesson_status, 'cancelled_by_student'::lesson_status)
      then 'skipping'
    else null
  end                                           as attention_kind
from students s
left join teachers t on t.id = s.teacher_id
left join last_conducted lc on lc.student_id = s.id
left join last_lesson ll on ll.student_id = s.id
left join last_3_statuses l3 on l3.student_id = s.id
where s.status in ('active', 'dropped', 'graduated');

comment on view v_student_attention is
  'Для куратора: серая зона (stale/skipping) + dropped + graduated. Серая зона только для active.';
