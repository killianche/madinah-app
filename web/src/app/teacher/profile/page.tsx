import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { Chip } from "@/components/ui/chip";
import { WeekStrip } from "@/components/ui/week-strip";
import { USER_ROLE_LABEL } from "@/lib/types";
import { findTeacherByUserId } from "@/lib/repos/teachers";
import { getTeacherWeekSchedule } from "@/lib/repos/schedules";
import { getTeacherTotalStats } from "@/lib/repos/lessons";
import { teacherStudentsNeedTopup } from "@/lib/repos/students";

export const metadata = { title: "Профиль — Madinah" };
export const dynamic = "force-dynamic";

export default async function Profile() {
  const { user } = await requireAuth();

  let teacherData: {
    weekSlots: { weekday: number; time_at: string }[];
    totals: Awaited<ReturnType<typeof getTeacherTotalStats>> | null;
    needTopup: Awaited<ReturnType<typeof teacherStudentsNeedTopup>>;
  } = { weekSlots: [], totals: null, needTopup: [] };

  if (user.role === "teacher") {
    const teacher = await findTeacherByUserId(user.id);
    if (teacher) {
      const [weekSlots, totals, needTopup] = await Promise.all([
        getTeacherWeekSchedule(teacher.id),
        getTeacherTotalStats(teacher.id),
        teacherStudentsNeedTopup(teacher.id, 10),
      ]);
      teacherData = { weekSlots, totals, needTopup };
    }
  }

  return (
    <AppShell title="Профиль">
      <div
        className="bg-ivory rounded-[16px] p-5 mb-[14px]"
        style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
      >
        <div className="text-[12px] uppercase tracking-[0.6px] font-medium text-stone">ФИО</div>
        <div className="font-serif text-[24px] font-medium mt-1 tracking-[-0.2px]">
          {user.full_name}
        </div>
        <div className="flex gap-2 mt-3">
          <Chip tone="neutral" size="m">{USER_ROLE_LABEL[user.role]}</Chip>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4">
          {user.phone && (
            <div>
              <div className="text-[11px] uppercase tracking-[0.6px] font-medium text-stone">Логин</div>
              <div className="text-[14px] font-mono mt-0.5">{user.phone}</div>
            </div>
          )}
          {user.email && (
            <div>
              <div className="text-[11px] uppercase tracking-[0.6px] font-medium text-stone">Email</div>
              <div className="text-[14px] mt-0.5 truncate">{user.email}</div>
            </div>
          )}
        </div>
      </div>

      {/* Счётчик уроков */}
      {teacherData.totals && teacherData.totals.total_lessons > 0 && (
        <div
          className="bg-ivory rounded-[16px] p-5 mb-[14px]"
          style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
        >
          <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone mb-3">
            Мои итоги
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="font-serif text-[24px] font-medium tabular-nums leading-none">
                {teacherData.totals.total_lessons}
              </div>
              <div className="text-[11px] text-olive mt-1">всего уроков</div>
            </div>
            <div>
              <div className="font-serif text-[24px] font-medium tabular-nums leading-none text-moss">
                {teacherData.totals.conducted}
              </div>
              <div className="text-[11px] text-olive mt-1">проведено</div>
            </div>
            <div>
              <div className="font-serif text-[24px] font-medium tabular-nums leading-none">
                {teacherData.totals.unique_students}
              </div>
              <div className="text-[11px] text-olive mt-1">учеников</div>
            </div>
          </div>
        </div>
      )}

      {/* Мой график недели */}
      {teacherData.weekSlots.length > 0 && (
        <div className="mb-[14px]">
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone">
              Мой график
            </span>
            <span className="text-[12px] text-stone">напоминание</span>
          </div>
          <WeekStrip slots={teacherData.weekSlots} />
        </div>
      )}

      {/* Нужно напомнить пополнить */}
      {teacherData.needTopup.length > 0 && (
        <div className="mb-[14px]">
          <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone mb-2">
            Давно без пополнений
          </div>
          <div
            className="bg-ivory rounded-[14px] px-4"
            style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
          >
            {teacherData.needTopup.map((s, i) => (
              <Link
                key={s.student_id}
                href={`/teacher/student/${s.student_id}`}
                className={`grid grid-cols-[1fr_auto] items-center gap-3 py-3 no-underline text-near-black ${
                  i > 0 ? "border-t border-border-cream" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="text-[14px] font-medium truncate">
                    {s.student_name}
                  </div>
                  <div className="text-[12px] text-olive tabular-nums mt-0.5">
                    баланс {s.balance}
                    {s.days_since_topup !== null
                      ? ` · ${s.days_since_topup} дн. без пополнения`
                      : " · никогда не пополнялся"}
                  </div>
                </div>
                <Chip tone="bad" size="s">напомнить</Chip>
              </Link>
            ))}
          </div>
        </div>
      )}

      <form action="/logout" method="post">
        <button
          type="submit"
          className="w-full bg-ivory rounded-[12px] py-4 text-center text-crimson font-medium hover:shadow-ring-strong transition-shadow"
          style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
        >
          Выйти
        </button>
      </form>
    </AppShell>
  );
}
