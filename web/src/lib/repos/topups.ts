import { sql } from "@/lib/db";
import { notifyTopup, notifyLowBalanceIfNeeded } from "@/lib/notify";

type SqlClient = typeof sql;

export interface CreateTopupInput {
  student_id: string;
  lessons_added: number;
  reason?: string | null;
  added_by: string;
  sales_payment_id?: string | null;
}

export interface CreateTopupResult {
  topup_id: string;
  duplicate: boolean;
}

export async function createTopup(input: CreateTopupInput): Promise<string> {
  const result = await createTopupWithIdempotency(input);
  return result.topup_id;
}

/**
 * Атомарное пополнение внутри переданной транзакции.
 * Используется когда нужно объединить создание ученика и стартовое пополнение в одну транзакцию.
 * Уведомления должен слать вызывающий код после коммита.
 */
export async function createTopupTx(
  tx: SqlClient,
  input: CreateTopupInput,
): Promise<CreateTopupResult> {
  const inserted = await tx<Array<{ id: string }>>`
    insert into balance_topups (student_id, lessons_added, reason, added_by, sales_payment_id)
    values (${input.student_id}, ${input.lessons_added}, ${input.reason ?? null},
            ${input.added_by}, ${input.sales_payment_id ?? null})
    on conflict (sales_payment_id) where (sales_payment_id is not null) do nothing
    returning id
  `;

  if (inserted.length === 0) {
    const existing = await tx<Array<{ id: string }>>`
      select id from balance_topups where sales_payment_id = ${input.sales_payment_id!} limit 1
    `;
    return { topup_id: existing[0]!.id, duplicate: true };
  }

  const id = inserted[0]!.id;
  await tx`
    update students set balance = balance + ${input.lessons_added}, updated_at = now()
    where id = ${input.student_id}
  `;
  await tx`
    insert into audit_log (actor_id, action, entity_type, entity_id, diff)
    values (${input.added_by}, 'topup.create', 'student', ${input.student_id}, ${sql.json({
      lessons_added: input.lessons_added,
      reason: input.reason,
      sales_payment_id: input.sales_payment_id ?? null,
    })})
  `;
  return { topup_id: id, duplicate: false };
}

/**
 * Атомарное пополнение с идемпотентностью по sales_payment_id + уведомления.
 */
export async function createTopupWithIdempotency(
  input: CreateTopupInput,
): Promise<CreateTopupResult> {
  const result = await sql.begin<CreateTopupResult>(async (tx) => createTopupTx(tx, input));

  if (!result.duplicate) {
    await notifyTopup(input.student_id, input.lessons_added, input.added_by);
    if (input.lessons_added < 0) {
      await notifyLowBalanceIfNeeded(input.student_id);
    }
  }
  return result;
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
