import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { listAllActiveStudents } from "@/lib/repos/students";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Менеджер — Madinah" };

export default async function ManagerHome() {
  await requireRole("manager", "curator", "director");
  const students = await listAllActiveStudents();

  return (
    <AppShell title="Ученики">
      <div className="flex flex-wrap gap-3 mb-6">
        <Link href="/manager/students/new" className="btn-primary no-underline">
          Создать ученика
        </Link>
        <Link href="/manager/problems" className="btn-secondary no-underline">
          Проблемные
        </Link>
      </div>

      <p className="text-sm text-olive-gray mb-4">
        Активных учеников: {students.length}
        {students.length >= 500 ? " (показаны первые 500)" : ""}
      </p>

      <ul className="space-y-2">
        {students.map((s) => (
          <li
            key={s.id}
            className="bg-ivory rounded-md shadow-ring p-3 flex items-center justify-between"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{s.full_name}</span>
                {s.is_charity && <Badge variant="olive">Благотворительный</Badge>}
              </div>
              <div className="text-xs text-olive-gray mt-0.5">
                {s.teacher_name ?? "без учителя"}
                {s.phone ? ` · ${s.phone}` : ""}
              </div>
            </div>
            <div className="text-right shrink-0 tabular-nums font-medium">
              {Math.max(s.balance, 0)}
            </div>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
