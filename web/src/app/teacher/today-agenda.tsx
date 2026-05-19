import Link from "next/link";
import type { LessonListItem } from "@/lib/repos/lessons";
import type { UpcomingSlot } from "@/lib/repos/schedules";
import type { LessonStatus } from "@/lib/types";
import { LESSON_STATUS_LABEL } from "@/lib/types";
import { Chip } from "@/components/ui/chip";

const WD_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

function todayISO(): string {
  return new Date().toLocaleDateString("sv-SE");
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function dateLabel(iso: string): string {
  const today = todayISO();
  if (iso === today) return "сегодня";
  if (iso === shiftDate(today, 1)) return "завтра";
  if (iso === shiftDate(today, -1)) return "вчера";
  const d = new Date(iso);
  return `${WD_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}

function relativeUpcoming(iso: string, slotTime: string): string | null {
  if (iso !== todayISO()) return null;
  const [h, m] = slotTime.split(":").map(Number);
  if (h === undefined || m === undefined) return null;
  const now = new Date();
  const slot = new Date();
  slot.setHours(h, m, 0, 0);
  const diffMin = Math.round((slot.getTime() - now.getTime()) / 60000);
  if (diffMin <= 0) return null;
  if (diffMin < 60) return `через ${diffMin} мин`;
  const hours = Math.floor(diffMin / 60);
  if (hours < 8) return `через ${hours} ч`;
  return null;
}

function statusChip(status: LessonStatus) {
  if (status === "conducted") return <Chip tone="good" size="s">проведён</Chip>;
  if (status === "penalty") return <Chip tone="bad" size="s">штраф</Chip>;
  return <Chip tone="amber" size="s">{LESSON_STATUS_LABEL[status]}</Chip>;
}

function StatusDot({ tone }: { tone: "good" | "bad" | "warn" | "muted" }) {
  const color =
    tone === "good" ? "#3f6b3d" :
    tone === "bad" ? "#b53333" :
    tone === "warn" ? "#c96442" :
    "#bdb9a8";
  return <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />;
}

interface Item {
  key: string;
  isPast: boolean;
  iso: string;
  slot_time: string;
  student_id: string;
  student_name: string;
  student_balance?: number;
  status?: LessonStatus;
  lesson_id?: string;
}

/**
 * Расписание: 2 прошедших урока + 6 предстоящих слотов, в хронологическом порядке.
 * Кросс-дневное — не зависит от выбранной даты.
 */
export function TodayAgenda({
  pastLessons,
  upcomingSlots,
}: {
  pastLessons: LessonListItem[];
  upcomingSlots: UpcomingSlot[];
}) {
  // Past: уже отсортированы DESC. Берём 2 свежих, разворачиваем чтобы старший был сверху.
  const past: Item[] = pastLessons.slice(0, 2).slice().reverse().map((l) => ({
    key: `p-${l.id}`,
    isPast: true,
    iso: new Date(l.lesson_date).toLocaleDateString("sv-SE"),
    slot_time: l.lesson_time ?? "—",
    student_id: l.student_id,
    student_name: l.student_name,
    status: l.status,
    lesson_id: l.id,
  }));

  const upcoming: Item[] = upcomingSlots.map((s) => ({
    key: `u-${s.student_id}-${s.lesson_date}-${s.slot_time}`,
    isPast: false,
    iso: s.lesson_date,
    slot_time: s.slot_time,
    student_id: s.student_id,
    student_name: s.student_name,
    student_balance: s.student_balance,
  }));

  const items = [...past, ...upcoming];
  const isEmpty = items.length === 0;

  return (
    <section className="mb-6">
      <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone mb-2">
        Расписание
      </div>

      {isEmpty ? (
        <div
          className="bg-ivory rounded-[14px] py-10 text-center"
          style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
        >
          <p className="text-olive">Уроков нет.</p>
        </div>
      ) : (
        <div
          className="bg-ivory rounded-[14px] px-4"
          style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
        >
          {items.map((it, i) => {
            const tone =
              it.isPast
                ? (it.status === "conducted" ? "good" : it.status === "penalty" ? "bad" : "warn")
                : "warn";
            const dLabel = dateLabel(it.iso);
            const rel = !it.isPast ? relativeUpcoming(it.iso, it.slot_time) : null;
            const lowBalance =
              !it.isPast && typeof it.student_balance === "number" && it.student_balance <= 0;

            return (
              <Link
                key={it.key}
                href={`/teacher/student/${it.student_id}`}
                className={`grid grid-cols-[8px_56px_1fr_auto] items-center gap-3 py-[13px] no-underline text-near-black ${
                  i > 0 ? "border-t border-border-cream" : ""
                } ${it.isPast ? "opacity-60" : ""}`}
              >
                <StatusDot tone={tone} />
                <span
                  className={`font-serif text-[18px] font-medium tabular-nums tracking-[-0.2px] ${
                    it.isPast ? "line-through text-stone" : ""
                  }`}
                >
                  {it.slot_time}
                </span>
                <div className="min-w-0">
                  <div className="text-[15px] font-medium truncate">{it.student_name}</div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {dLabel !== "сегодня" && (
                      <span className="text-[11px] text-olive first-letter:uppercase">
                        {dLabel}
                      </span>
                    )}
                    {rel && <Chip tone="warn" size="s">{rel}</Chip>}
                    {lowBalance && <Chip tone="bad" size="s">низкий баланс</Chip>}
                  </div>
                </div>
                {it.isPast && it.status && (
                  <span className="justify-self-end">{statusChip(it.status)}</span>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {pastLessons.length > 0 && (
        <div className="mt-6">
          <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone mb-2">
            Последние уроки
          </div>
          <div
            className="bg-ivory rounded-[14px] px-4"
            style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
          >
            {pastLessons.map((l, i) => (
              <Link
                key={l.id}
                href={`/teacher/student/${l.student_id}`}
                className={`grid grid-cols-[1fr_auto] items-center gap-3 py-[12px] no-underline text-near-black ${
                  i > 0 ? "border-t border-border-cream" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="text-[15px] font-medium truncate">
                    {l.student_name}
                  </div>
                  <div className="text-[12px] text-olive tabular-nums mt-0.5">
                    {new Date(l.lesson_date).toLocaleDateString("ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                    {l.topic ? ` · ${l.topic}` : ""}
                  </div>
                </div>
                {statusChip(l.status)}
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
