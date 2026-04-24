import { Badge } from "@/components/ui/badge";
import type { StudentTeacherStat } from "@/lib/repos/students";

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function TeacherBreakdown({
  stats,
  currentTeacherId,
}: {
  stats: StudentTeacherStat[];
  currentTeacherId: string | null;
}) {
  if (stats.length === 0) {
    return (
      <div className="card text-olive-gray">Уроков ещё не было.</div>
    );
  }

  const total = stats.reduce((sum, s) => sum + s.total, 0);
  const conducted = stats.reduce((sum, s) => sum + s.conducted, 0);
  const penalty = stats.reduce((sum, s) => sum + s.penalty, 0);
  const cancelled = stats.reduce(
    (sum, s) => sum + s.cancelled_by_student + s.cancelled_by_teacher,
    0,
  );

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-4">
        <h2 className="!mb-0">История по учителям</h2>
        <span className="text-sm text-olive-gray">
          всего {total} · проведено {conducted} · штраф {penalty} · отменено{" "}
          {cancelled}
        </span>
      </div>

      <ul className="space-y-2">
        {stats.map((s) => {
          const isCurrent = s.teacher_id === currentTeacherId;
          return (
            <li
              key={s.teacher_id}
              className="bg-ivory rounded-md shadow-ring p-3"
            >
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-medium">{s.teacher_name}</span>
                {isCurrent && <Badge variant="terracotta">сейчас</Badge>}
                {!isCurrent && s.teacher_status === "archived" && (
                  <Badge variant="olive">архив</Badge>
                )}
                <span className="ml-auto text-sm tabular-nums">
                  {s.total} {s.total === 1 ? "урок" : s.total < 5 ? "урока" : "уроков"}
                </span>
              </div>
              <div className="text-xs text-olive-gray mb-1">
                {fmtDate(s.first_lesson_date)} → {fmtDate(s.last_lesson_date)}
              </div>
              <div className="text-xs text-olive-gray flex gap-3 flex-wrap">
                <span>✓ {s.conducted}</span>
                {s.penalty > 0 && <span>штраф {s.penalty}</span>}
                {s.cancelled_by_student > 0 && (
                  <span>отм. учеником {s.cancelled_by_student}</span>
                )}
                {s.cancelled_by_teacher > 0 && (
                  <span>отм. учителем {s.cancelled_by_teacher}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
