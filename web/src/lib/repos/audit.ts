import { sql } from "@/lib/db";

export interface AuditEntry {
  id: number;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  diff: Record<string, unknown> | null;
  created_at: Date;
}

export const ACTION_LABEL: Record<string, string> = {
  "lesson.create": "Записан урок",
  "lesson.edit": "Редактирован урок",
  "lesson.delete": "Удалён урок",
  "student.create": "Создан ученик",
  "student.update": "Изменён профиль ученика",
  "student.change_status": "Сменён статус ученика",
  "student.change_teacher": "Сменён учитель ученика",
  "student.auto_dropped": "Авто-перевод в «бросил»",
  "student.balance_reconciled": "Сверка баланса",
  "student.topup": "Пополнен баланс",
  "teacher.create": "Создан учитель",
  "teacher.update": "Изменён учитель",
  "teacher.set_status": "Сменён статус учителя",
  "teacher.reassign_all": "Перевод всех учеников учителя",
  "schedule.update": "Изменено расписание",
  "schedule.delete": "Удалён слот расписания",
  "user.create": "Создан сотрудник",
  "user.toggle_active": "Активация/деактивация",
  "user.password_reset": "Сброс пароля",
  "attention.review_marked": "Помечено во «Внимании»",
  "attention.review_cleared": "Снята метка «Внимания»",
};

export interface AuditFilter {
  action?: string;
  actor_id?: string;
  entity_type?: string;
  entity_id?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export async function listAuditLog(filter: AuditFilter = {}): Promise<AuditEntry[]> {
  const limit = Math.min(filter.limit ?? 100, 500);
  const offset = filter.offset ?? 0;

  const rows = await sql<AuditEntry[]>`
    select
      a.id,
      a.actor_id,
      u.full_name as actor_name,
      u.role::text as actor_role,
      a.action,
      a.entity_type,
      a.entity_id::text as entity_id,
      case
        when a.entity_type = 'student' then s.full_name
        when a.entity_type = 'teacher' then t.full_name
        when a.entity_type = 'lesson'  then ls.full_name
        when a.entity_type = 'user'    then ru.full_name
        else null
      end as entity_name,
      a.diff,
      a.created_at
    from audit_log a
    left join users u on u.id = a.actor_id
    left join students s on a.entity_type = 'student' and s.id = a.entity_id
    left join teachers t on a.entity_type = 'teacher' and t.id = a.entity_id
    left join lessons l on a.entity_type = 'lesson'  and l.id = a.entity_id
    left join students ls on l.student_id = ls.id
    left join users ru on a.entity_type = 'user'    and ru.id = a.entity_id
    where 1 = 1
      ${filter.action ? sql`and a.action = ${filter.action}` : sql``}
      ${filter.actor_id ? sql`and a.actor_id = ${filter.actor_id}` : sql``}
      ${filter.entity_type ? sql`and a.entity_type = ${filter.entity_type}` : sql``}
      ${filter.entity_id ? sql`and a.entity_id = ${filter.entity_id}` : sql``}
      ${filter.date_from ? sql`and a.created_at >= ${filter.date_from}::date` : sql``}
      ${filter.date_to ? sql`and a.created_at < (${filter.date_to}::date + interval '1 day')` : sql``}
    order by a.created_at desc, a.id desc
    limit ${limit} offset ${offset}
  `;
  return rows;
}

export async function listAuditActions(): Promise<Array<{ action: string; cnt: number }>> {
  return sql<Array<{ action: string; cnt: number }>>`
    select action, count(*)::int as cnt
    from audit_log
    where created_at >= current_date - interval '90 days'
    group by action
    order by cnt desc
  `;
}

export async function listAuditActors(): Promise<Array<{ id: string; full_name: string; role: string; cnt: number }>> {
  return sql<Array<{ id: string; full_name: string; role: string; cnt: number }>>`
    select u.id, u.full_name, u.role::text as role, count(*)::int as cnt
    from audit_log a
    join users u on u.id = a.actor_id
    where a.created_at >= current_date - interval '90 days'
    group by u.id, u.full_name, u.role
    order by cnt desc
    limit 50
  `;
}
