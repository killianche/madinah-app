"use server";

import { z } from "zod";
import { sql } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { normalizePhone } from "@/lib/auth/phone";

const scheduleSchema = z.object({
  weekday: z.number().int().min(1).max(7),
  time_at: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM"),
});

const schema = z.object({
  full_name: z.string().trim().min(1, "Введите ФИО ученика"),
  phone: z.string().trim().nullable().optional(),
  telegram_username: z.string().trim().nullable().optional(),
  telegram_phone: z.string().trim().nullable().optional(),
  whatsapp_phone: z.string().trim().nullable().optional(),
  teacher_id: z.string().uuid().nullable().optional(),
  initial_balance: z.number().int().default(0),
  is_charity: z.boolean().default(false),
  schedule: z.array(scheduleSchema).max(14).optional(),
});

export async function createStudentAction(
  input: z.infer<typeof schema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  const { user } = await requireRole("manager", "curator", "head", "admin");

  // Б6: нормализация телефонов до канонического +7XXXXXXXXXX, чтобы поиск/уникальность работали.
  const normalizedPhone = parsed.data.phone ? normalizePhone(parsed.data.phone) : null;
  const normalizedTgPhone = parsed.data.telegram_phone
    ? normalizePhone(parsed.data.telegram_phone)
    : null;
  const normalizedWaPhone = parsed.data.whatsapp_phone
    ? normalizePhone(parsed.data.whatsapp_phone)
    : null;

  // Д3 (предотвратим): не назначать архивированного/уволенного учителя.
  if (parsed.data.teacher_id) {
    const t = await sql<Array<{ status: string }>>`
      select status::text from teachers where id = ${parsed.data.teacher_id}
    `;
    if (t.length === 0) return { ok: false, error: "Учитель не найден" };
    if (t[0]!.status === "archived" || t[0]!.status === "fired") {
      return { ok: false, error: "Этот учитель не активен — выберите другого" };
    }
  }

  try {
    const id = await sql.begin(async (tx) => {
      const rows = await tx<Array<{ id: string }>>`
        insert into students (full_name, phone, telegram_username, telegram_phone, whatsapp_phone, teacher_id, balance, is_charity, charity_since, enrolled_at, created_by_user_id)
        values (${parsed.data.full_name}, ${normalizedPhone},
                ${parsed.data.telegram_username ?? null},
                ${normalizedTgPhone},
                ${normalizedWaPhone},
                ${parsed.data.teacher_id ?? null},
                ${parsed.data.initial_balance},
                ${parsed.data.is_charity},
                ${parsed.data.is_charity ? new Date() : null},
                ${new Date()},
                ${user.id})
        returning id
      `;
      const studentId = rows[0]!.id;
      if (parsed.data.initial_balance !== 0) {
        await tx`
          insert into balance_topups (student_id, lessons_added, reason, added_by)
          values (${studentId}, ${parsed.data.initial_balance}, 'Стартовый баланс', ${user.id})
        `;
      }
      if (parsed.data.schedule && parsed.data.schedule.length > 0) {
        const values = parsed.data.schedule.map((s) => ({
          student_id: studentId,
          weekday: s.weekday,
          time_at: s.time_at,
        }));
        await tx`
          insert into student_schedules ${tx(values, "student_id", "weekday", "time_at")}
        `;
      }
      await tx`
        insert into audit_log (actor_id, action, entity_type, entity_id, diff)
        values (${user.id}, 'student.create', 'student', ${studentId}, ${sql.json({
          is_charity: parsed.data.is_charity,
          initial_balance: parsed.data.initial_balance,
          schedule_count: parsed.data.schedule?.length ?? 0,
        })})
      `;
      return studentId;
    });
    return { ok: true, id };
  } catch (err) {
    console.error("createStudent failed:", err);
    return { ok: false, error: "Не удалось создать ученика" };
  }
}
