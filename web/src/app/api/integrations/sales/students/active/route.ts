import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { checkSalesToken } from "../../_helpers";

export const dynamic = "force-dynamic";

/**
 * GET /api/integrations/sales/students/active[?unassigned_only=1]
 * Все активные/paused ученики или только без менеджера (created_by_user_id IS NULL).
 */
export async function GET(req: NextRequest) {
  const auth = checkSalesToken(req);
  if (auth) return auth;

  const unassignedOnly = req.nextUrl.searchParams.get("unassigned_only") === "1";
  const lowOnly = req.nextUrl.searchParams.get("low_only") === "1";

  const rows = await sql<Array<{
    id: string;
    full_name: string;
    phone: string | null;
    whatsapp_phone: string | null;
    telegram_username: string | null;
    status: string;
    balance: number;
    teacher_name: string | null;
    last_lesson_date: Date | null;
    created_by_user_id: string | null;
    creator_name: string | null;
  }>>`
    select s.id, s.full_name, s.phone, s.whatsapp_phone, s.telegram_username,
           s.status::text as status, s.balance::int as balance,
           t.full_name as teacher_name,
           (select max(lesson_date) from lessons
            where student_id = s.id and deleted_at is null) as last_lesson_date,
           s.created_by_user_id,
           u.full_name as creator_name
    from students s
    left join teachers t on t.id = s.teacher_id
    left join users u on u.id = s.created_by_user_id
    where s.deleted_at is null
      and s.status in ('active', 'paused')
      ${unassignedOnly ? sql`and s.created_by_user_id is null` : sql``}
      ${lowOnly ? sql`and s.balance <= 4` : sql``}
    order by
      case s.status when 'active' then 0 else 1 end,
      s.balance asc,
      s.full_name
  `;

  return NextResponse.json({ students: rows });
}
