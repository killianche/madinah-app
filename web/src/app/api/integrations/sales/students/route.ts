import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { normalizePhone } from "@/lib/auth/phone";
import { createTopup } from "@/lib/repos/topups";
import { checkSalesToken } from "../_helpers";

export const dynamic = "force-dynamic";

const schema = z.object({
  /** ID менеджера в Sales — для маппинга на Quran user. */
  sales_user_id: z.string().uuid(),
  full_name: z.string().trim().min(1).max(200),
  phone: z.string().trim().nullable().optional(),
  telegram_username: z.string().trim().nullable().optional(),
  whatsapp_phone: z.string().trim().nullable().optional(),
  initial_lessons: z.number().int().min(0).default(0),
  is_charity: z.boolean().optional().default(false),
  /** Идемпотентность: ID оплаты в Sales. Если уже создавали — вернём существующего. */
  sales_payment_id: z.string().uuid().optional(),
  /** Если false — created_by_user_id остаётся NULL (ученик «непривязанный»). По умолчанию true. */
  claim_as_manager: z.boolean().optional().default(true),
});

/**
 * POST /api/integrations/sales/students
 * Создаёт ученика в Quran от лица менеджера Sales.
 *   - сопоставляет sales_user_id → quran user_id
 *   - вставляет students с created_by_user_id = mapped
 *   - если initial_lessons > 0 — пополняет баланс через createTopup (там же триггер уведомлений)
 *   - идемпотентность по sales_payment_id через audit_log
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

  // 1) Идемпотентность: если уже есть запись с этим sales_payment_id — вернём её.
  if (data.sales_payment_id) {
    const dup = await sql<Array<{ entity_id: string }>>`
      select entity_id from audit_log
      where action = 'student.create_from_sales'
        and diff->>'sales_payment_id' = ${data.sales_payment_id}
      limit 1
    `;
    if (dup.length > 0) {
      const id = dup[0]!.entity_id;
      return NextResponse.json({ student_id: id, duplicate: true });
    }
  }

  // 2) Маппинг менеджера.
  const mapping = await sql<Array<{ id: string }>>`
    select id from users where sales_user_id = ${data.sales_user_id} limit 1
  `;
  if (mapping.length === 0) {
    return NextResponse.json({ error: "manager not mapped to Quran identity" }, { status: 422 });
  }
  const quranActorId = mapping[0]!.id;

  // 3) Нормализация телефонов.
  const normPhone = data.phone ? normalizePhone(data.phone) : null;
  const normTgPhone = null;
  const normWaPhone = data.whatsapp_phone ? normalizePhone(data.whatsapp_phone) : null;

  // 4) Создаём ученика + audit + (опц.) topup в одной транзакции.
  const creatorIdToWrite = data.claim_as_manager ? quranActorId : null;
  const studentId = await sql.begin(async (tx) => {
    const rows = await tx<Array<{ id: string }>>`
      insert into students (
        full_name, phone, telegram_username, telegram_phone, whatsapp_phone,
        teacher_id, balance, is_charity, charity_since, enrolled_at, created_by_user_id
      )
      values (
        ${data.full_name}, ${normPhone},
        ${data.telegram_username ?? null}, ${normTgPhone}, ${normWaPhone},
        null, 0, ${data.is_charity}, ${data.is_charity ? new Date() : null},
        ${new Date()}, ${creatorIdToWrite}
      )
      returning id
    `;
    const id = rows[0]!.id;
    await tx`
      insert into audit_log (actor_id, action, entity_type, entity_id, diff)
      values (${quranActorId}, 'student.create_from_sales', 'student', ${id}, ${sql.json({
        source: "sales",
        sales_user_id: data.sales_user_id,
        sales_payment_id: data.sales_payment_id ?? null,
        initial_lessons: data.initial_lessons,
      })})
    `;
    return id;
  });

  // 5) Если есть стартовые уроки — пополняем (createTopup сам триггерит notifyTopup/lowBalance).
  if (data.initial_lessons > 0) {
    await createTopup({
      student_id: studentId,
      lessons_added: data.initial_lessons,
      reason: "Стартовый баланс (Sales)",
      added_by: quranActorId,
    });
  }

  return NextResponse.json({ student_id: studentId, duplicate: false });
}
