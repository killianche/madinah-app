-- 0013 Расширяем teacher_status: paused (не берёт новых), fired (уволен).
-- 'active' и 'archived' уже существуют.
do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumtypid = 'teacher_status'::regtype and enumlabel = 'paused'
  ) then
    alter type teacher_status add value 'paused';
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumtypid = 'teacher_status'::regtype and enumlabel = 'fired'
  ) then
    alter type teacher_status add value 'fired';
  end if;
end$$;
