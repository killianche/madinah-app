#!/usr/bin/env bash
# Удаляет все тестовые данные: учеников с префиксом 'ТЕСТ ' и 'Лейла Тестова'
# + их уроки, расписание, пополнения, audit.
set -euo pipefail
export DATABASE_URL="postgresql://madinah:m9Xk2pQrLwY7vNh3@localhost:5432/madinah"

psql "$DATABASE_URL" <<'SQL'
do $$
declare
  sid uuid;
begin
  for sid in
    select id from students
    where full_name like 'ТЕСТ %'
       or full_name like 'Лейла Тестова%'
  loop
    delete from audit_log where entity_id = sid;
    delete from balance_topups where student_id = sid;
    delete from student_schedules where student_id = sid;
    delete from lessons where student_id = sid;
    delete from students where id = sid;
  end loop;
end $$;

select 'Осталось учеников с ТЕСТ:' as check, count(*) from students where full_name like 'ТЕСТ %'
union all
select 'Осталось Лейла Тестова:', count(*) from students where full_name like 'Лейла Тестова%';
SQL
