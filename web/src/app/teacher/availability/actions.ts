"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { findTeacherByUserId } from "@/lib/repos/teachers";
import {
  replaceTeacherAvailability,
  setTeacherCapacity,
} from "@/lib/repos/availability";

const slotSchema = z.object({
  weekday: z.number().int().min(1).max(7),
  time_at: z
    .string()
    .regex(/^(0\d|1\d|2[0-3]):(00|30)$/, "Шаг 30 минут"),
});

const saveSchema = z.object({
  slots: z.array(slotSchema).max(7 * 28),
});

export async function saveAvailabilityAction(
  input: z.infer<typeof saveSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректные данные" };

  const { user } = await requireRole("teacher");
  const teacher = await findTeacherByUserId(user.id);
  if (!teacher) return { ok: false, error: "Профиль учителя не найден" };

  await replaceTeacherAvailability(teacher.id, parsed.data.slots);
  revalidatePath("/teacher/availability");
  return { ok: true };
}

const capacitySchema = z.object({
  max_new_students: z.number().int().min(0).max(999).nullable(),
});

export async function saveCapacityAction(
  input: z.infer<typeof capacitySchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = capacitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректное число" };

  const { user } = await requireRole("teacher");
  const teacher = await findTeacherByUserId(user.id);
  if (!teacher) return { ok: false, error: "Профиль учителя не найден" };

  await setTeacherCapacity(teacher.id, parsed.data.max_new_students);
  revalidatePath("/teacher/availability");
  return { ok: true };
}
