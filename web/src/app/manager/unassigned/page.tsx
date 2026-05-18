import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { listUnassignedStudents } from "@/lib/repos/students";
import { findActiveTeachers } from "@/lib/repos/teachers";
import { listSchedulesForStudent } from "@/lib/repos/schedules";
import { UnassignedList } from "./list-client";

export const metadata = { title: "Без учителя — Madinah" };
export const dynamic = "force-dynamic";

export default async function UnassignedPage() {
  await requireRole("curator", "head", "manager", "admin");
  const [students, teachers] = await Promise.all([
    listUnassignedStudents(),
    findActiveTeachers(),
  ]);

  // Загружаем расписание для каждого — параллельно, чтобы быстро.
  const schedulesByStudent = await Promise.all(
    students.map(async (s) => ({
      id: s.id,
      slots: (await listSchedulesForStudent(s.id))
        .filter((x) => x.active)
        .map((x) => ({ weekday: x.weekday, time_at: x.time_at })),
    })),
  );
  const schedulesMap = Object.fromEntries(
    schedulesByStudent.map((s) => [s.id, s.slots]),
  );

  return (
    <AppShell title="Без учителя">
      {students.length === 0 ? (
        <div
          className="bg-ivory rounded-[14px] py-10 text-center"
          style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
        >
          <p className="text-olive">Все ученики распределены.</p>
        </div>
      ) : (
        <>
          <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone mb-2">
            Назначить учителя · {students.length}
          </div>
          <UnassignedList
            students={students.map((s) => ({
              id: s.id,
              full_name: s.full_name,
              phone: s.phone,
              balance: s.balance,
              created_by_name: s.created_by_name,
              days_unassigned: s.days_unassigned,
              schedule: schedulesMap[s.id] ?? [],
            }))}
            teachers={teachers.map((t) => ({ id: t.id, full_name: t.full_name }))}
          />
        </>
      )}
    </AppShell>
  );
}
