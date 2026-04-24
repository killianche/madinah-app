import { sql } from "@/lib/db";
import type { User, UserRole } from "@/lib/types";
import { hashPassword } from "@/lib/auth/password";

export interface CreateUserInput {
  role: UserRole;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  password: string; // plain — хэшируется внутри
  teacher_id?: string | null; // если role=teacher и уже есть запись в teachers
  created_by: string; // actor
}

export async function createUser(input: CreateUserInput): Promise<string> {
  const hash = await hashPassword(input.password);
  return sql.begin(async (tx) => {
    const rows = await tx<Array<{ id: string }>>`
      insert into users (role, full_name, phone, email, password_hash)
      values (${input.role}, ${input.full_name},
              ${input.phone ?? null}, ${input.email?.toLowerCase() ?? null}, ${hash})
      returning id
    `;
    const userId = rows[0]!.id;
    if (input.teacher_id) {
      await tx`update teachers set user_id = ${userId} where id = ${input.teacher_id}`;
    }
    await tx`
      insert into audit_log (actor_id, action, entity_type, entity_id, diff)
      values (${input.created_by}, 'user.create', 'user', ${userId}, ${sql.json({
        role: input.role,
        has_teacher: !!input.teacher_id,
      })})
    `;
    return userId;
  });
}

export async function listAllUsers(): Promise<User[]> {
  return sql<User[]>`
    select id, role, full_name, phone, email, is_active, last_login_at, created_at
    from users
    order by is_active desc, full_name
  `;
}

export async function deactivateUser(userId: string, actorId: string): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`update users set is_active = false where id = ${userId}`;
    await tx`delete from user_sessions where user_id = ${userId}`;
    await tx`
      insert into audit_log (actor_id, action, entity_type, entity_id)
      values (${actorId}, 'user.deactivate', 'user', ${userId})
    `;
  });
}
