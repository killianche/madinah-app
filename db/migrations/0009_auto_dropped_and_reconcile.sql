-- Madinah App — автоматизации:
-- 1) auto_drop_stale_students() — ставит dropped тем, у кого 20+ дней
--    нет conducted-урока и статус был active. Пишет audit_log.
-- 2) reconcile_balances() — сравнивает students.balance с balance_calculated
--    и выравнивает. Возвращает количество исправленных.

set search_path = public;

-- Системный actor для автоматических изменений
-- Используем первого admin из users
create or replace function _system_actor() returns uuid language sql stable as $$
  select id from users where role = 'admin' order by created_at limit 1;
$$;

-- ============================================================
-- 1. Авто-dropped через 20 дней без conducted-урока
-- ============================================================
create or replace function auto_drop_stale_students(days_threshold int default 20)
returns int language plpgsql as $$
declare
  actor uuid := _system_actor();
  cnt int := 0;
  sid uuid;
begin
  for sid in
    select s.id
    from students s
    left join lateral (
      select max(lesson_date) as d
      from lessons
      where student_id = s.id
        and deleted_at is null
        and status = 'conducted'
    ) last_conducted on true
    where s.status = 'active'
      and (
        last_conducted.d is null and (current_date - s.enrolled_at) >= days_threshold
        or (current_date - last_conducted.d) >= days_threshold
      )
  loop
    update students
    set status = 'dropped',
        archived_at = coalesce(archived_at, current_date),
        updated_at = now()
    where id = sid;

    insert into audit_log (actor_id, action, entity_type, entity_id, diff)
    values (actor, 'student.auto_dropped', 'student', sid,
            jsonb_build_object(
              'old_status', 'active',
              'new_status', 'dropped',
              'reason', format('автоматически: %s дн. без урока', days_threshold)
            ));
    cnt := cnt + 1;
  end loop;
  return cnt;
end $$;

comment on function auto_drop_stale_students(int) is
  'Ставит dropped ученикам без conducted-урока N дней. Вызывать ночным cron.';

-- ============================================================
-- 2. Сверка баланса — выравнивает students.balance по истории
-- ============================================================
create or replace function reconcile_balances() returns int language plpgsql as $$
declare
  actor uuid := _system_actor();
  cnt int := 0;
  rec record;
begin
  for rec in
    select s.id, s.balance as old_balance,
           coalesce(
             (select sum(lessons_added)::int from balance_topups where student_id = s.id),
             0
           ) -
           coalesce(
             (select count(*)::int from lessons
              where student_id = s.id
                and status in ('conducted', 'penalty')
                and deleted_at is null),
             0
           ) as calculated
    from students s
  loop
    if rec.calculated is distinct from rec.old_balance then
      update students set balance = rec.calculated, updated_at = now() where id = rec.id;
      insert into audit_log (actor_id, action, entity_type, entity_id, diff)
      values (actor, 'student.balance_reconciled', 'student', rec.id,
              jsonb_build_object('old_balance', rec.old_balance,
                                 'new_balance', rec.calculated));
      cnt := cnt + 1;
    end if;
  end loop;
  return cnt;
end $$;

comment on function reconcile_balances() is
  'Сверка students.balance с историей. Вызывать раз в сутки.';
