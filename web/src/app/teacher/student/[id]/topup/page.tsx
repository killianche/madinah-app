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
  await requireAuth();
  const { id } = await params;
  const student = await findStudentById(id);
  if (!student) notFound();

  return (
    <AppShell title="Пополнить баланс" back={{ href: `/teacher/student/${student.id}`, label: student.full_name }}>
      <div className="card">
        <p className="text-sm text-olive-gray mb-4">
          Ученик: <strong>{student.full_name}</strong> · текущий баланс:{" "}
          <strong>{Math.max(student.balance, 0)}</strong>
        </p>
        <TopupForm studentId={student.id} currentBalance={student.balance} />
      </div>
    </AppShell>
  );
}
