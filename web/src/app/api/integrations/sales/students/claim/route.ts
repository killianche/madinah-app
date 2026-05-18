import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { checkSalesToken } from "../../_helpers";

export const dynamic = "force-dynamic";

const schema = z.object({
  sales_user_id: z.string().uuid(),
  quran_student_id: z.string().uuid(),
});

/**
 * POST /api/integrations/sales/students/claim
 * Прикрепить ученика к менеджеру (created_by_user_id = mapped quran user).
 */
export async function POST(req: NextRequest) {
  const auth = checkSalesToken(req);
  if (auth) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad input" }, { status: 400 });
  }
  const data = parsed.data;

  const mapping = await sql<Array<{ id: string }>>`
    select id from users where sales_user_id = ${data.sales_user_id} limit 1
  `;
  if (mapping.length === 0) {
    return NextResponse.json({ error: "manager not mapped" }, { status: 422 });
  }
  const quranActorId = mapping[0]!.id;

  const updated = await sql<Array<{ id: string; old_creator: string | null }>>`
    with old as (
      select created_by_user_id from students where id = ${data.quran_student_id}
    )
    update students
    set created_by_user_id = ${quranActorId}, updated_at = now()
    where id = ${data.quran_student_id} and deleted_at is null
    returning id, (select created_by_user_id from old) as old_creator
  `;
  if (updated.length === 0) {
    return NextResponse.json({ error: "student not found" }, { status: 404 });
  }

  await sql`
    insert into audit_log (actor_id, action, entity_type, entity_id, diff)
    values (${quranActorId}, 'student.claim_from_sales', 'student', ${data.quran_student_id},
            ${sql.json({ old_creator: updated[0]!.old_creator, new_creator: quranActorId })})
  `;
  return NextResponse.json({ ok: true });
}
