import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { findTeacherById } from "@/lib/repos/teachers";
import { sql } from "@/lib/db";
import { EditTeacherForm } from "./form";

export const metadata = { title: "Редактировать учителя — Madinah" };
export const dynamic = "force-dynamic";

export default async function EditTeacherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("curator", "head", "admin");
  const { id } = await params;
  const teacher = await findTeacherById(id);
  if (!teacher) notFound();
  const userRow = teacher.user_id
    ? (
        await sql<Array<{ login: string | null }>>`
        select login from users where id = ${teacher.user_id}
      `
      )[0]
    : null;

  return (
    <AppShell title="Редактировать учителя" back={{ href: `/manager/teachers/${id}`, label: teacher.full_name }}>
      <div className="bg-ivory rounded-[14px] p-5 max-w-xl" style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}>
        <EditTeacherForm
          teacherId={teacher.id}
          initial={{
            full_name: teacher.full_name,
            phone: teacher.phone ?? "",
            login: userRow?.login ?? "",
          }}
        />
      </div>
    </AppShell>
  );
}
