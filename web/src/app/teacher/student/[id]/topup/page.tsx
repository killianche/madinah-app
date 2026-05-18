import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { findStudentById } from "@/lib/repos/students";
import { AppShell } from "@/components/app-shell";
import { TopupForm } from "./form";

export const metadata = { title: "Пополнение баланса — Madinah" };

export default async function TopupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await requireAuth();
  const { id } = await params;
  const student = await findStudentById(id);
  if (!student) notFound();

  return (
    <AppShell
      title="Пополнить баланс"
      back={{ href: `/teacher/student/${student.id}`, label: student.full_name }}
    >
      <p className="text-[15px] text-olive mb-5">
        {student.full_name} · текущий баланс{" "}
        <span className="font-medium text-near-black tabular-nums">
          {student.balance}
        </span>
      </p>
      <TopupForm
        studentId={student.id}
        currentBalance={student.balance}
        actorName={auth.user.full_name}
      />
    </AppShell>
  );
}
