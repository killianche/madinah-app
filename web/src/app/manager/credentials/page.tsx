import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { sql } from "@/lib/db";
import { CredentialsList } from "./list-client";

export const metadata = { title: "Логины учителей — Madinah" };
export const dynamic = "force-dynamic";

export default async function CredentialsPage() {
  await requireRole("curator", "head", "admin");

  const rows = await sql<
    Array<{
      user_id: string;
      teacher_id: string | null;
      full_name: string;
      login: string | null;
      phone: string | null;
      password_plain: string | null;
      is_active: boolean;
      teacher_status: string | null;
    }>
  >`
    select
      u.id as user_id,
      t.id as teacher_id,
      u.full_name,
      u.login,
      u.phone,
      u.password_plain,
      u.is_active,
      t.status::text as teacher_status
    from users u
    left join teachers t on t.user_id = u.id
    where u.role = 'teacher'
    order by u.is_active desc, u.full_name
  `;

  return (
    <AppShell title="Логины учителей">
      <p className="text-[13px] text-olive mb-4">
        Логины и пароли всех учителей. Только куратор / руководитель / админ.
        Если пароль не виден — учитель создан до этой версии: можно сбросить на новый.
      </p>
      <CredentialsList
        rows={rows.map((r) => ({
          user_id: r.user_id,
          teacher_id: r.teacher_id,
          full_name: r.full_name,
          login: r.login,
          phone: r.phone,
          password_plain: r.password_plain,
          is_active: r.is_active,
          teacher_status: r.teacher_status,
        }))}
      />
    </AppShell>
  );
}
