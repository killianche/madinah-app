import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { createTopup } from "@/lib/repos/topups";
import { checkSalesToken } from "../_helpers";

export const dynamic = "force-dynamic";

const schema = z.object({
  sales_user_id: z.string().uuid(),
  quran_student_id: z.string().uuid(),
  lessons_added: z.number().int().min(1).max(1000),
  sales_payment_id: z.string().uuid().optional(),
  reason: z.string().trim().max(200).optional(),
});

/**
 * POST /api/integrations/sales/topups
 * Пополнение баланса существующего Quran-ученика от лица менеджера Sales.
 * Идемпотентность по sales_payment_id.
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
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "bad input" }, { status: 400 });
  }
  const data = parsed.data;

  if (data.sales_payment_id) {
    const dup = await sql<Array<{ entity_id: string }>>`
      select entity_id from audit_log
      where action = 'topup.create_from_sales'
        and diff->>'sales_payment_id' = ${data.sales_payment_id}
      limit 1
    `;
    if (dup.length > 0) {
      return NextResponse.json({ topup_id: dup[0]!.entity_id, duplicate: true });
    }
  }

  const mapping = await sql<Array<{ id: string }>>`
    select id from users where sales_user_id = ${data.sales_user_id} limit 1
  `;
  if (mapping.length === 0) {
    return NextResponse.json({ error: "manager not mapped" }, { status: 422 });
  }
  const quranActorId = mapping[0]!.id;

  const student = await sql<Array<{ id: string }>>`
    select id from students where id = ${data.quran_student_id} and deleted_at is null limit 1
  `;
  if (student.length === 0) {
    return NextResponse.json({ error: "student not found" }, { status: 404 });
  }

  const topupId = await createTopup({
    student_id: data.quran_student_id,
    lessons_added: data.lessons_added,
    reason: data.reason ?? "Продление (Sales)",
    added_by: quranActorId,
  });

  // Маркер для идемпотентности — отдельной записью в audit.
  if (data.sales_payment_id) {
    await sql`
      insert into audit_log (actor_id, action, entity_type, entity_id, diff)
      values (${quranActorId}, 'topup.create_from_sales', 'topup', ${topupId}, ${sql.json({
        source: "sales",
        sales_user_id: data.sales_user_id,
        sales_payment_id: data.sales_payment_id,
        lessons_added: data.lessons_added,
        student_id: data.quran_student_id,
      })})
    `;
  }

  return NextResponse.json({ topup_id: topupId, duplicate: false });
}
