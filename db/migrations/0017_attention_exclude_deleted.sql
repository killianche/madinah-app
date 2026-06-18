-- 0017: исключить мягко удалённых (deleted_at) учеников из v_student_attention.
-- Баг: удалённый ученик оставался status=active и протекал во «Внимание».
create or replace view v_student_attention as
WITH last_conducted AS (
  SELECT lessons.student_id, max(lessons.lesson_date) AS d
  FROM lessons
  WHERE lessons.deleted_at IS NULL AND lessons.status = 'conducted'::lesson_status
  GROUP BY lessons.student_id
), last_lesson AS (
  SELECT lessons.student_id, max(lessons.lesson_date) AS d
  FROM lessons
  WHERE lessons.deleted_at IS NULL
  GROUP BY lessons.student_id
), last_3_statuses AS (
  SELECT t_1.student_id,
         array_agg(t_1.status ORDER BY t_1.lesson_date DESC, t_1.created_at DESC) AS statuses
  FROM ( SELECT lessons.student_id, lessons.status, lessons.lesson_date, lessons.created_at,
                row_number() OVER (PARTITION BY lessons.student_id ORDER BY lessons.lesson_date DESC, lessons.created_at DESC) AS rn
         FROM lessons
         WHERE lessons.deleted_at IS NULL) t_1
  WHERE t_1.rn <= 3
  GROUP BY t_1.student_id
)
SELECT s.id AS student_id, s.full_name AS student_name, s.phone, s.teacher_id,
       t.full_name AS teacher_name, s.status,
       lc.d AS last_conducted_date, ll.d AS last_any_lesson_date, l3.statuses AS last_3_statuses,
       CASE
         WHEN s.status = 'dropped'::student_status THEN 'dropped'::text
         WHEN s.status = 'graduated'::student_status THEN 'graduated'::text
         WHEN s.status = 'active'::student_status AND (lc.d IS NULL OR (CURRENT_DATE - lc.d) >= 10) THEN 'stale'::text
         WHEN s.status = 'active'::student_status AND array_length(l3.statuses, 1) >= 3
              AND (l3.statuses[1] = ANY (ARRAY['penalty'::lesson_status, 'cancelled_by_student'::lesson_status]))
              AND (l3.statuses[2] = ANY (ARRAY['penalty'::lesson_status, 'cancelled_by_student'::lesson_status]))
              AND (l3.statuses[3] = ANY (ARRAY['penalty'::lesson_status, 'cancelled_by_student'::lesson_status])) THEN 'skipping'::text
         ELSE NULL::text
       END AS attention_kind
FROM students s
  LEFT JOIN teachers t ON t.id = s.teacher_id
  LEFT JOIN last_conducted lc ON lc.student_id = s.id
  LEFT JOIN last_lesson ll ON ll.student_id = s.id
  LEFT JOIN last_3_statuses l3 ON l3.student_id = s.id
WHERE s.deleted_at IS NULL
  AND s.status = ANY (ARRAY['active'::student_status, 'dropped'::student_status, 'graduated'::student_status]);
