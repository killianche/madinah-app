"use server";

import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { sql } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";

const schema = z.object({
  rate_conducted: z.number().min(0).max(100000),
  rate_penalty: z.number().min(0).max(100000),
});

/**
 * Глобальные ставки школы. Только эта пара значений — индивидуальные ставки
 * учителей удалены из UI (см. /manager/settings).
 */
export async function saveGlobalRatesAction(
  input: z.infer<typeof schema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректные ставки" };
  await requireRole("admin", "head");
  await sql`
    update school_settings
    set rate_conducted = ${parsed.data.rate_conducted},
        rate_penalty = ${parsed.data.rate_penalty},
        updated_at = now()
    where id = 1
  `;
  revalidatePath("/manager/settings");
  revalidatePath("/manager/salary");
  revalidateTag("salary"); // сбрасываем кэш зарплат — пересчитаются с новыми ставками
  return { ok: true };
}
