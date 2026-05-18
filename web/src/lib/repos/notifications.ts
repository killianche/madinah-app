import { sql } from "@/lib/db";

export type NotificationKind = "topup" | "student_assigned" | "low_balance";

export interface NotificationRow {
  id: string;
  user_id: string;
  kind: NotificationKind;
  payload: Record<string, unknown>;
  read_at: Date | null;
  created_at: Date;
}

export async function createNotification(input: {
  user_id: string;
  kind: NotificationKind;
  payload: Record<string, unknown>;
}): Promise<void> {
  await sql`
    insert into notifications (user_id, kind, payload)
    values (${input.user_id}, ${input.kind}, ${sql.json(input.payload as Parameters<typeof sql.json>[0])})
  `;
}

export async function listNotificationsForUser(
  userId: string,
  limit = 50,
): Promise<NotificationRow[]> {
  return sql<NotificationRow[]>`
    select id, user_id, kind, payload, read_at, created_at
    from notifications
    where user_id = ${userId}
    order by read_at is null desc, created_at desc
    limit ${limit}
  `;
}

export async function countUnreadForUser(userId: string): Promise<number> {
  const rows = await sql<Array<{ n: number }>>`
    select count(*)::int as n from notifications
    where user_id = ${userId} and read_at is null
  `;
  return rows[0]?.n ?? 0;
}

export async function markAllReadForUser(userId: string): Promise<void> {
  await sql`
    update notifications set read_at = now()
    where user_id = ${userId} and read_at is null
  `;
}

/** Был ли low_balance-нотифик для этого user+student за последние N дней. */
export async function recentLowBalanceExists(
  userId: string,
  studentId: string,
  daysWindow: number,
): Promise<boolean> {
  const rows = await sql<Array<{ exists: boolean }>>`
    select exists(
      select 1 from notifications
      where user_id = ${userId}
        and kind = 'low_balance'
        and payload->>'student_id' = ${studentId}
        and created_at > now() - (${daysWindow} || ' days')::interval
    ) as exists
  `;
  return rows[0]?.exists ?? false;
}
