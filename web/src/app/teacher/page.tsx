import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { findTeacherByUserId } from "@/lib/repos/teachers";
import { teacherStudentList } from "@/lib/repos/students";
import { Badge } from "@/components/ui/badge";
import { LESSON_STATUS_LABEL } from "@/lib/types";

export const metadata = { title: "Мои ученики — Madinah" };

export default async function TeacherHome() {
  const { user } = await requireRole("teacher");
  const teacher = await findTeacherByUserId(user.id);

  if (!teacher) {
    return (
      <AppShell title="Мои ученики">
        <div className="card">
          <p className="text-olive-gray">
            Ваш профиль учителя не настроен. Обратитесь к администратору.
          </p>
        </div>
      </AppShell>
    );
  }

  const students = await teacherStudentList(teacher.id);

  return (
    <AppShell title="Мои ученики">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-olive-gray text-sm">
          {students.length > 0
            ? `${students.length} ${pluralize(students.length, ["ученик", "ученика", "учеников"])}`
            : "Пока никого"}
        </p>
        <Link href="/teacher/lesson/new" className="btn-primary no-underline">
          Записать урок
        </Link>
      </div>

      {students.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-olive-gray">
            Учеников пока нет. Менеджер добавит их в вашу группу.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {students.map((s) => (
            <li key={s.id}>
              <Link
                href={`/teacher/student/${s.id}`}
                className="block card hover:shadow-lift-md transition-shadow no-underline"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-medium truncate">{s.full_name}</h3>
                      {s.is_charity && <Badge variant="olive">Благотворительный</Badge>}
                    </div>
                    {s.last_lesson_date ? (
                      <p className="text-sm text-olive-gray mt-1">
                        Последний урок: {formatDate(s.last_lesson_date)} ·{" "}
                        {LESSON_STATUS_LABEL[s.last_lesson_status!]}
                      </p>
                    ) : (
                      <p className="text-sm text-olive-gray mt-1">Ещё не было уроков</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-serif text-2xl tabular-nums">
                      {Math.max(s.balance, 0)}
                    </p>
                    <p className="text-xs text-olive-gray">
                      {s.balance < 0 ? "в минусе" : "уроков"}
                    </p>
                  </div>
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
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function pluralize(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}
