import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { findStudentById } from "@/lib/repos/students";
import { findTeacherByUserId } from "@/lib/repos/teachers";
import { AppShell } from "@/components/app-shell";
import { AdjustForm } from "./form";

export const metadata = { title: "Коррекция баланса — Madinah" };

const PRIVILEGED_ROLES = ["manager", "curator", "head", "admin"] as const;

export default async function AdjustPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await requireAuth();
  const { id } = await params;
  const student = await findStudentById(id);
  if (!student) notFound();

  const isPrivileged = (PRIVILEGED_ROLES as readonly string[]).includes(auth.user.role);
  if (!isPrivileged) {
    if (auth.user.role !== "teacher") notFound();
    const ownTeacher = await findTeacherByUserId(auth.user.id);
    if (!ownTeacher || student.teacher_id !== ownTeacher.id) notFound();
  }

  return (
    <AppShell
      title="Коррекция баланса"
      back={{ href: `/teacher/student/${student.id}`, label: student.full_name }}
    >
      <p className="text-[15px] text-olive mb-5">
        {student.full_name} · текущий баланс{" "}
        <span className="font-medium text-near-black tabular-nums">
          {student.balance}
        </span>
      </p>
      <AdjustForm studentId={student.id} currentBalance={student.balance} />
    </AppShell>
  );
}
