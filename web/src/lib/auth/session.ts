import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import type { User, UserRole } from "@/lib/types";
import { createHash, randomBytes } from "node:crypto";

const COOKIE_NAME = "madinah_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 дней

export interface Session {
  id: string;
  user_id: string;
  expires_at: Date;
}

export interface AuthContext {
  user: User;
  session: Session;
}

/**
 * Собственная реализация сессий вместо Lucia: проще и без лишних зависимостей.
 * Токен = 32 случайных байта в hex, храним хэш (чтобы утечка таблицы не раскрывала сессии).
 */

function generateSessionId(): string {
  return randomBytes(32).toString("hex");
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export async function createSession(userId: string, meta?: { ip?: string; ua?: string }): Promise<{ token: string; session: Session }> {
  const token = generateSessionId();
  const id = sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await sql`
    insert into user_sessions (id, user_id, expires_at, user_agent, ip)
    values (${id}, ${userId}, ${expiresAt}, ${meta?.ua ?? null}, ${meta?.ip ?? null}::inet)
  `;

  return {
    token,
    session: { id, user_id: userId, expires_at: expiresAt },
  };
}

export async function getAuthFromToken(token: string | undefined): Promise<AuthContext | null> {
  if (!token) return null;
  const id = sha256(token);

  const rows = await sql<Array<{
    id: string; user_id: string; expires_at: Date;
    role: UserRole; full_name: string; phone: string | null; email: string | null;
    is_active: boolean; last_login_at: Date | null; created_at: Date;
  }>>`
    select s.id, s.user_id, s.expires_at,
           u.role, u.full_name, u.phone, u.email, u.is_active, u.last_login_at, u.created_at
    from user_sessions s
    join users u on u.id = s.user_id
    where s.id = ${id}
      and s.expires_at > now()
      and u.is_active = true
    limit 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    session: { id: row.id, user_id: row.user_id, expires_at: row.expires_at },
    user: {
      id: row.user_id,
      role: row.role,
      full_name: row.full_name,
      phone: row.phone,
      email: row.email,
      is_active: row.is_active,
      last_login_at: row.last_login_at,
      created_at: row.created_at,
    },
  };
}

export async function deleteSession(sessionId: string): Promise<void> {
  await sql`delete from user_sessions where id = ${sessionId}`;
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    // Secure cookie только если APP_URL реально https — иначе cookie
    // не долетит через http и логин разваливается.
    secure: (process.env.APP_URL ?? "").startsWith("https://"),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value;
}

/**
 * Главный хелпер для Server Components / Server Actions — достаёт текущего юзера.
 */
export async function getAuth(): Promise<AuthContext | null> {
  const token = await getSessionToken();
  return getAuthFromToken(token);
}

/**
 * Строгий вариант: редирект на /login если не авторизован.
 */
export async function requireAuth(): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  return auth;
}

/**
 * Строгий вариант с проверкой роли.
 */
export async function requireRole(...roles: UserRole[]): Promise<AuthContext> {
  const auth = await requireAuth();
  if (!roles.includes(auth.user.role)) redirect("/");
  return auth;
}
