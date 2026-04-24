import { sql } from "@/lib/db";
import type { Teacher } from "@/lib/types";

export async function findActiveTeachers(): Promise<Teacher[]> {
  return sql<Teacher[]>`
    select * from teachers where status = 'active' order by full_name
  `;
}

export async function findTeacherByUserId(userId: string): Promise<Teacher | null> {
  const rows = await sql<Teacher[]>`
    select * from teachers where user_id = ${userId} limit 1
  `;
  return rows[0] ?? null;
}
