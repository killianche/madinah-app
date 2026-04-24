-- Madinah App — «Серая зона»: ученики, которые требуют внимания куратора.
-- Вычисляемый (не сохраняемый) флаг: проверяется по истории уроков на лету.

set search_path = public;

-- ============================================================
-- v_student_attention: объединяет всех active+dropped и помечает,
-- кому нужно внимание куратора.
--
-- attention_kind:
--   'stale'    — active, но нет conducted-урока ≥ 10 дней
--   'skipping' — active и последние 3 урока — отмены/штрафы
--                (cancelled_by_student или penalty)
--   'dropped'  — status='dropped' (для общего списка)
--   null       — всё ок, не показываем
-- ============================================================
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
    when s.status = 'dropped' then 'dropped'
    when s.status = 'active' and (
      lc.d is null
      or (current_date - lc.d) >= 10
    ) then 'stale'
    when s.status = 'active'
         and array_length(l3.statuses, 1) >= 3
         and l3.statuses[1] in ('cancelled_by_student'::lesson_status, 'penalty'::lesson_status)
         and l3.statuses[2] in ('cancelled_by_student'::lesson_status, 'penalty'::lesson_status)
         and l3.statuses[3] in ('cancelled_by_student'::lesson_status, 'penalty'::lesson_status)
      then 'skipping'
    else null
  end                                           as attention_kind
from students s
left join teachers t on t.id = s.teacher_id
left join last_conducted lc on lc.student_id = s.id
left join last_lesson ll on ll.student_id = s.id
left join last_3_statuses l3 on l3.student_id = s.id
where s.status in ('active', 'dropped');

comment on view v_student_attention is
  'Ученики для куратора: ''серая зона'' (stale/skipping) + dropped. Вычисляется на лету.';
