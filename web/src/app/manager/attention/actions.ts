"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { setAttentionReview, clearAttentionReview } from "@/lib/repos/students";

const markSchema = z.object({
  student_id: z.string().uuid(),
  state: z.enum(["in_progress", "resolved"]),
  note: z.string().trim().max(500).nullable().optional(),
});

export async function markReviewAction(
  input: z.infer<typeof markSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = markSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректные данные" };
  const { user } = await requireRole("curator", "head", "admin");

  // Снапшот: тянем текущий контекст по ученику
  const snap = await sql<
    Array<{
      attention_kind: string;
      status: string;
      last_any_lesson_date: Date | null;
      student_updated_at: Date;
    }>
  >`
    select
      v.attention_kind::text,
      v.status::text,
      v.last_any_lesson_date,
      s.updated_at as student_updated_at
    from v_student_attention v
    join students s on s.id = v.student_id
    where v.student_id = ${parsed.data.student_id}
    limit 1
  `;
  if (snap.length === 0 || !snap[0]!.attention_kind) {
    return { ok: false, error: "Ученик не в attention сейчас" };
  }
  const ctx = snap[0]!;

  await setAttentionReview(
    parsed.data.student_id,
    parsed.data.state,
    parsed.data.note?.trim() || null,
    user.id,
    {
      kind: ctx.attention_kind,
      status: ctx.status,
      last_lesson_date: ctx.last_any_lesson_date,
      student_updated_at: ctx.student_updated_at,
    },
  );

  await sql`
    insert into audit_log (actor_id, action, entity_type, entity_id, diff)
    values (${user.id}, 'attention.review', 'student', ${parsed.data.student_id},
            ${sql.json({ state: parsed.data.state, note: parsed.data.note ?? null })})
  `;

  revalidatePath("/manager/attention");
  return { ok: true };
}

const clearSchema = z.object({ student_id: z.string().uuid() });

export async function clearReviewAction(
  input: z.infer<typeof clearSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = clearSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректные данные" };
  const { user } = await requireRole("curator", "head", "admin");
  await clearAttentionReview(parsed.data.student_id);
  await sql`
    insert into audit_log (actor_id, action, entity_type, entity_id, diff)
    values (${user.id}, 'attention.review_clear', 'student', ${parsed.data.student_id}, ${sql.json({})})
  `;
  revalidatePath("/manager/attention");
  return { ok: true };
}

const closeSchema = z.object({
  student_id: z.string().uuid(),
  note: z.string().trim().max(500).nullable().optional(),
});

/** Закрыть кейс: ставим статус ученика 'closed' — он больше не появляется во «Внимании». */
export async function closeAttentionCaseAction(
  input: z.infer<typeof closeSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = closeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректные данные" };
  const { user } = await requireRole("curator", "head", "admin");

  try {
    await sql.begin(async (tx) => {
      const rows = await tx<Array<{ status: string }>>`
        select status::text from students where id = ${parsed.data.student_id}
      `;
      if (rows.length === 0) throw new Error("not_found");
      const oldStatus = rows[0]!.status;

      await tx`
        update students
        set status = 'closed'::student_status, updated_at = now()
        where id = ${parsed.data.student_id}
      `;
      await tx`
        delete from attention_review where student_id = ${parsed.data.student_id}
      `;
      await tx`
        insert into audit_log (actor_id, action, entity_type, entity_id, diff)
        values (${user.id}, 'student.change_status', 'student', ${parsed.data.student_id},
                ${sql.json({
                  old_status: oldStatus,
                  new_status: "closed",
                  reason: parsed.data.note?.trim() || "Закрыт куратором из «Внимания»",
                })})
      `;
    });
    revalidatePath("/manager/attention");
    revalidatePath(`/teacher/student/${parsed.data.student_id}`);
    return { ok: true };
  } catch (err) {
    console.error("closeAttentionCaseAction failed:", err);
    return { ok: false, error: "Не удалось закрыть кейс" };
  }
}
