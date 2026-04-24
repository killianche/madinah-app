import { Chip } from "@/components/ui/chip";
import { StackedBar } from "@/components/ui/stacked-bar";
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
      <div className="bg-ivory rounded-[14px] shadow-ring p-4 text-olive text-sm">
        Уроков ещё не было.
      </div>
    );
  }

  return (
    <div className="space-y-[10px]">
      {stats.map((s) => {
        const isCurrent = s.teacher_id === currentTeacherId;
        const counted = s.conducted + s.penalty; // основные (списанные с баланса)
        const cancelled = s.cancelled_by_student + s.cancelled_by_teacher;
        return (
          <div
            key={s.teacher_id}
            className="bg-ivory rounded-[14px] shadow-ring p-4"
          >
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-medium text-[15px]">{s.teacher_name}</span>
              {isCurrent && (
                <Chip tone="warn" size="s">
                  сейчас
                </Chip>
              )}
              {!isCurrent && s.teacher_status === "archived" && (
                <Chip tone="neutral" size="s">
                  архив
                </Chip>
              )}
              <span className="ml-auto font-serif text-[22px] font-medium tabular-nums text-near-black">
                {counted}
                <span className="text-[12px] text-stone font-sans font-normal ml-1">
                  уроков
                </span>
              </span>
            </div>
            <div className="text-[12px] text-olive tabular-nums mb-2">
              {fmtDate(s.first_lesson_date)} → {fmtDate(s.last_lesson_date)}
            </div>
            <StackedBar
              conducted={s.conducted}
              penalty={s.penalty}
              cancelled={cancelled}
            />
            <div className="flex gap-[6px] mt-2 flex-wrap">
              {s.conducted > 0 && <Chip tone="good" size="s">{s.conducted} провёл</Chip>}
              {s.penalty > 0 && <Chip tone="bad" size="s">{s.penalty} штраф</Chip>}
              {cancelled > 0 && <Chip tone="amber" size="s">{cancelled} отм.</Chip>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
