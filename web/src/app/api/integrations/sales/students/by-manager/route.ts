import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { checkSalesToken } from "../../_helpers";

export const dynamic = "force-dynamic";

/**
 * GET /api/integrations/sales/students/by-manager?sales_user=<uuid>[&low_only=1]
 * Список учеников, чей created_by_user_id = mapped(sales_user).
 * low_only=1 → только active с balance ≤ 4.
 */
export async function GET(req: NextRequest) {
  const auth = checkSalesToken(req);
  if (auth) return auth;

  const salesUser = req.nextUrl.searchParams.get("sales_user");
  const lowOnly = req.nextUrl.searchParams.get("low_only") === "1";
  if (!salesUser) return NextResponse.json({ error: "sales_user required" }, { status: 400 });

  const mapping = await sql<Array<{ id: string }>>`
    select id from users where sales_user_id = ${salesUser} limit 1
  `;
  if (mapping.length === 0) {
    return NextResponse.json({ error: "manager not mapped" }, { status: 422 });
  }
  const quranUserId = mapping[0]!.id;

  const rows = await sql<Array<{
    id: string;
    full_name: string;
    phone: string | null;
    whatsapp_phone: string | null;
    telegram_username: string | null;
    balance: number;
    status: string;
    teacher_name: string | null;
    last_lesson_date: Date | null;
    created_by_user_id: string | null;
    creator_name: string | null;
  }>>`
    select s.id, s.full_name, s.phone, s.whatsapp_phone, s.telegram_username,
           s.balance::int as balance, s.status::text as status,
           t.full_name as teacher_name,
           (select max(lesson_date) from lessons
            where student_id = s.id and deleted_at is null) as last_lesson_date,
           s.created_by_user_id,
           u.full_name as creator_name
    from students s
    left join teachers t on t.id = s.teacher_id
    left join users u on u.id = s.created_by_user_id
    where s.deleted_at is null
      and s.created_by_user_id = ${quranUserId}
      ${lowOnly ? sql`and s.status = 'active' and s.balance <= 4` : sql``}
    order by
      case when s.status = 'active' then 0 else 1 end,
      s.balance asc,
      s.full_name
  `;

  return NextResponse.json({ students: rows });
}
