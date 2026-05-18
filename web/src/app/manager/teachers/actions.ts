"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { createUser } from "@/lib/repos/users";
import { setTeacherStatus, reassignAllStudents } from "@/lib/repos/teachers";

const createSchema = z.object({
  full_name: z.string().trim().min(2),
  login: z.string().trim().min(2, "Логин минимум 2 символа").max(40),
  phone: z.string().trim().nullable().optional(),
  password: z.string().min(6, "Пароль минимум 6 символов").max(60),
});

export async function createTeacherAction(
  input: z.infer<typeof createSchema>,
): Promise<
  | { ok: true; id: string; temp_password: string }
  | { ok: false; error: string }
> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? "Некорректные данные";
    return { ok: false, error: msg };
  }

  const { user } = await requireRole("curator", "head", "admin");

  try {
    const teacherId = await sql.begin(async (tx) => {
      const rows = await tx<Array<{ id: string }>>`
        insert into teachers (full_name, phone, status, hired_at)
        values (${parsed.data.full_name}, ${parsed.data.phone ?? null}, 'active', current_date)
        returning id
      `;
      return rows[0]!.id;
    });

    await createUser({
      role: "teacher",
      full_name: parsed.data.full_name,
      login: parsed.data.login,
      phone: parsed.data.phone || null,
      email: null,
      password: parsed.data.password,
      teacher_id: teacherId,
      created_by: user.id,
    });

    revalidatePath("/manager/teachers");
    revalidatePath("/manager/credentials");
    return { ok: true, id: teacherId, temp_password: parsed.data.password };
  } catch (err: unknown) {
    console.error("createTeacher failed:", err);
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return { ok: false, error: "Логин или телефон уже заняты" };
    }
    return { ok: false, error: "Не удалось создать учителя" };
  }
}

const statusSchema = z.object({
  teacher_id: z.string().uuid(),
  status: z.enum(["active", "paused", "fired", "archived"]),
});

export async function setTeacherStatusAction(
  input: z.infer<typeof statusSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректные данные" };
  const { user } = await requireRole("curator", "head", "admin");
  await setTeacherStatus(parsed.data.teacher_id, parsed.data.status, user.id);
  revalidatePath("/manager/teachers");
  revalidatePath(`/manager/teachers/${parsed.data.teacher_id}`);
  return { ok: true };
}

const reassignSchema = z.object({
  from_teacher_id: z.string().uuid(),
  to_teacher_id: z.string().uuid().nullable(),
});

export async function reassignAllStudentsAction(
  input: z.infer<typeof reassignSchema>,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const parsed = reassignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректные данные" };
  const { user } = await requireRole("curator", "head", "admin");
  if (parsed.data.from_teacher_id === parsed.data.to_teacher_id) {
    return { ok: false, error: "Нельзя перевести к тому же учителю" };
  }
  const count = await reassignAllStudents(
    parsed.data.from_teacher_id,
    parsed.data.to_teacher_id,
    user.id,
  );
  revalidatePath("/manager");
  revalidatePath("/manager/teachers");
  revalidatePath(`/manager/teachers/${parsed.data.from_teacher_id}`);
  if (parsed.data.to_teacher_id) {
    revalidatePath(`/manager/teachers/${parsed.data.to_teacher_id}`);
  }
  return { ok: true, count };
}
