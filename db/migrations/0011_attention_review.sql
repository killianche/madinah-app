-- 0011 Attention review workflow
-- ===============================
-- Куратор отмечает учеников из «Требует внимания» как «в работе» или «закрыто»,
-- с заметкой. Если строки в этой таблице нет → ученик «новый» (показать сверху).

create table if not exists attention_review (
  student_id  uuid primary key references students(id) on delete cascade,
  state       text not null check (state in ('in_progress', 'resolved')),
  note        text,
  actor_id    uuid references users(id),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_attention_review_state
  on attention_review(state);
