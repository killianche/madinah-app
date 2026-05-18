-- 0014 Snapshot-поля для attention_review
-- Когда куратор отметил «решено», запоминаем «контекст». Если контекст изменился —
-- отметка устаревает и ученик возвращается в «Новые».

alter table attention_review
  add column if not exists snapshot_kind text,
  add column if not exists snapshot_status text,
  add column if not exists snapshot_last_lesson_date date,
  add column if not exists snapshot_student_updated_at timestamptz;
