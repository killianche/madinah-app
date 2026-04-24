import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { findTeacherByUserId } from "@/lib/repos/teachers";
import { teacherStudentList } from "@/lib/repos/students";
import { LESSON_STATUS_LABEL } from "@/lib/types";

export const metadata = { title: "Мои ученики — Madinah" };
export const dynamic = "force-dynamic";

export default async function TeacherStudents() {
  const { user } = await requireRole("teacher");
  const teacher = await findTeacherByUserId(user.id);
  if (!teacher) notFound();

  const students = await teacherStudentList(teacher.id);

  return (
    <AppShell title="Мои ученики">
      <p className="text-sm text-olive-gray mb-4">
        {students.length} {pluralize(students.length, ["ученик", "ученика", "учеников"])}
      </p>

      {students.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-olive-gray">
            Учеников пока нет. Менеджер добавит их в вашу группу.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {students.map((s) => (
            <li key={s.id}>
              <Link
                href={`/teacher/student/${s.id}`}
                className="flex items-center justify-between gap-4 card-compact hover:shadow-lift-md transition-shadow no-underline"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{s.full_name}</span>
                    {s.is_charity && <Badge variant="olive">Благ.</Badge>}
                  </div>
                  {s.last_lesson_date ? (
                    <p className="text-xs text-olive-gray mt-0.5">
                      {formatDate(s.last_lesson_date)} ·{" "}
                      {LESSON_STATUS_LABEL[s.last_lesson_status!]}
                    </p>
                  ) : (
                    <p className="text-xs text-olive-gray mt-0.5">Ещё не было уроков</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-serif text-xl tabular-nums">
                    {Math.max(s.balance, 0)}
                  </p>
                  <p className="text-[10px] text-olive-gray uppercase tracking-wider">
                    {s.balance < 0 ? "в минусе" : "уроков"}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}

function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function pluralize(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}
