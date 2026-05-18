-- 0010 Teacher availability + capacity
-- =====================================
-- Capacity:  сколько учеников учитель ещё готов взять (null = «не задал»).
-- Availability: 30-минутные слоты, в которые учитель готов работать.
-- Шаг 30 минут жёстко зашит check-constraint'ом.

alter table teachers
  add column if not exists max_new_students int;

create table if not exists teacher_availability (
  teacher_id uuid not null references teachers(id) on delete cascade,
  weekday    smallint not null check (weekday between 1 and 7),
  time_at    time not null check (
    extract(minute from time_at) in (0, 30)
    and extract(second from time_at) = 0
  ),
  created_at timestamptz not null default now(),
  primary key (teacher_id, weekday, time_at)
);

create index if not exists idx_teacher_availability_teacher
  on teacher_availability (teacher_id);
create index if not exists idx_teacher_availability_slot
  on teacher_availability (weekday, time_at);
