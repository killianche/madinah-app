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
 * POST /api/integrations/sales/students/unclaim
 * Открепить ученика от менеджера (created_by_user_id -> null).
 * Только если ученик сейчас закреплён именно за этим менеджером —
 * чужого открепить нельзя.
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

  const cur = await sql<Array<{ created_by_user_id: string | null }>>`
    select created_by_user_id from students
    where id = ${data.quran_student_id} and deleted_at is null
    limit 1
  `;
  if (cur.length === 0) {
    return NextResponse.json({ error: "student not found" }, { status: 404 });
  }
  const currentCreator = cur[0]!.created_by_user_id;
  if (currentCreator === null) {
    return NextResponse.json({ ok: true, already: true });
  }
  if (currentCreator !== quranActorId) {
    return NextResponse.json(
      { error: "Этот ученик привязан к другому менеджеру" },
      { status: 409 },
    );
  }

  await sql.begin(async (tx) => {
    await tx`
      update students
      set created_by_user_id = null, updated_at = now()
      where id = ${data.quran_student_id} and created_by_user_id = ${quranActorId}
    `;
    await tx`
      insert into audit_log (actor_id, action, entity_type, entity_id, diff)
      values (${quranActorId}, 'student.unclaim_from_sales', 'student', ${data.quran_student_id},
              ${sql.json({ old_creator: quranActorId, new_creator: null })})
    `;
  });
  return NextResponse.json({ ok: true });
}
