import { sql } from "@/lib/db";
import { notifyTopup, notifyLowBalanceIfNeeded } from "@/lib/notify";

export interface CreateTopupInput {
  student_id: string;
  lessons_added: number;
  reason?: string | null;
  added_by: string;
}

export async function createTopup(input: CreateTopupInput): Promise<string> {
  const topupId = await sql.begin(async (tx) => {
    const rows = await tx<Array<{ id: string }>>`
      insert into balance_topups (student_id, lessons_added, reason, added_by)
      values (${input.student_id}, ${input.lessons_added}, ${input.reason ?? null}, ${input.added_by})
      returning id
    `;
    const id = rows[0]!.id;
    await tx`
      update students set balance = balance + ${input.lessons_added}, updated_at = now()
      where id = ${input.student_id}
    `;
    await tx`
      insert into audit_log (actor_id, action, entity_type, entity_id, diff)
      values (${input.added_by}, 'topup.create', 'student', ${input.student_id}, ${sql.json({
        lessons_added: input.lessons_added,
        reason: input.reason,
      })})
    `;
    return id;
  });

  // После транзакции: триггеры уведомлений (тихие, не ломают основную операцию).
  await notifyTopup(input.student_id, input.lessons_added, input.added_by);
  // Если коррекция была отрицательной — баланс мог упасть, проверим low_balance.
  if (input.lessons_added < 0) {
    await notifyLowBalanceIfNeeded(input.student_id);
  }
  return topupId;
}

export interface TopupListItem {
  id: string;
  lessons_added: number;
  reason: string | null;
  created_at: Date;
  added_by_name: string | null;
}

export async function listTopupsForStudent(studentId: string): Promise<TopupListItem[]> {
  const rows = await sql<TopupListItem[]>`
    select b.id, b.lessons_added, b.reason, b.created_at, u.full_name as added_by_name
    from balance_topups b
    left join users u on u.id = b.added_by
    where b.student_id = ${studentId}
    order by b.created_at desc
  `;
  return rows;
}
