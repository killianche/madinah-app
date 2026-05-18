"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Chip } from "@/components/ui/chip";
import { assignTeacherAction } from "@/app/manager/unassigned/actions";

interface Teacher {
  id: string;
  full_name: string;
  status: string;
  max_new_students: number | null;
  active_students: number;
  slots: Array<{ weekday: number; time_at: string }>;
}

const DAYS = [
  { wd: 1, full: "Понедельник", short: "ПН" },
  { wd: 2, full: "Вторник", short: "ВТ" },
  { wd: 3, full: "Среда", short: "СР" },
  { wd: 4, full: "Четверг", short: "ЧТ" },
  { wd: 5, full: "Пятница", short: "ПТ" },
  { wd: 6, full: "Суббота", short: "СБ" },
  { wd: 7, full: "Воскресенье", short: "ВС" },
];

const HOUR_FROM = 6;
const HOUR_TO = 23;
function buildHalfHours(): string[] {
  const out: string[] = [];
  for (let h = HOUR_FROM; h <= HOUR_TO; h++) {
    out.push(`${String(h).padStart(2, "0")}:00`);
    out.push(`${String(h).padStart(2, "0")}:30`);
  }
  return out;
}
const HALF_HOURS = buildHalfHours();

function k(wd: number, t: string): string {
  return `${wd}|${t}`;
}

function timeToMin(t: string): number {
  const [hStr, mStr] = t.split(":");
  return parseInt(hStr!, 10) * 60 + parseInt(mStr!, 10);
}

/** Для слота "wd|HH:MM" ищет ближайший слот учителя на том же дне.
 *  Возвращает null, если у учителя нет слотов в этот день. */
function findNearest(
  wantedKey: string,
  teacherSlots: Array<{ weekday: number; time_at: string }>,
): { nearKey: string; diffMin: number } | null {
  const [wdStr, timeStr] = wantedKey.split("|");
  const wd = Number(wdStr);
  const wantedMin = timeToMin(timeStr!);
  const sameDay = teacherSlots.filter((s) => s.weekday === wd);
  if (sameDay.length === 0) return null;
  let minDiff = Infinity;
  let nearKey = "";
  for (const s of sameDay) {
    const diff = Math.abs(timeToMin(s.time_at) - wantedMin);
    if (diff < minDiff) {
      minDiff = diff;
      nearKey = k(s.weekday, s.time_at);
    }
  }
  return { nearKey, diffMin: minDiff };
}

// Максимальный сдвиг времени для «ближайшего» варианта — 2 часа.
const NEAR_THRESHOLD_MIN = 120;

type SlotKind = "exact" | "near" | "missing";

interface SlotDetail {
  wantedKey: string;
  kind: SlotKind;
  nearKey?: string;   // ключ слота учителя, ближайшего к запросу
  diffMin: number;    // разница в минутах (0 для exact)
}

interface Match {
  teacher: Teacher;
  details: SlotDetail[];
  exactCount: number;
  allExact: boolean;   // все слоты совпали точно
  allCovered: boolean; // все дни перекрыты (exact или near в пределах порога)
  totalDiffMin: number;
  capacityFull: boolean;
}

export function MatchClient({
  teachers,
  studentId,
}: {
  teachers: Teacher[];
  studentId?: string;
}) {
  const router = useRouter();
  const [wanted, setWanted] = useState<Set<string>>(new Set());
  const [openDay, setOpenDay] = useState<number | null>(1);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  function toggle(wd: number, t: string) {
    const key = k(wd, t);
    const next = new Set(wanted);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setWanted(next);
  }

  function fillRange(wd: number, from: string, to: string) {
    const s = HALF_HOURS.indexOf(from);
    const e = HALF_HOURS.indexOf(to);
    if (s < 0 || e < 0 || e < s) return;
    const next = new Set(wanted);
    for (let i = s; i <= e; i++) next.add(k(wd, HALF_HOURS[i]!));
    setWanted(next);
  }

  function clearDay(wd: number) {
    const next = new Set(wanted);
    for (const t of HALF_HOURS) next.delete(k(wd, t));
    setWanted(next);
  }

  function clearAll() {
    setWanted(new Set());
  }

  const { fullMatches, nearMatches } = useMemo(() => {
    if (wanted.size === 0) return { fullMatches: [], nearMatches: [] };

    const wantedArr = [...wanted];

    const all: Match[] = teachers.map((t) => {
      const slotSet = new Set(t.slots.map((s) => k(s.weekday, s.time_at)));

      const details: SlotDetail[] = wantedArr.map((wKey) => {
        if (slotSet.has(wKey)) {
          return { wantedKey: wKey, kind: "exact", diffMin: 0 };
        }
        const nearest = findNearest(wKey, t.slots);
        if (nearest && nearest.diffMin <= NEAR_THRESHOLD_MIN) {
          return {
            wantedKey: wKey,
            kind: "near",
            nearKey: nearest.nearKey,
            diffMin: nearest.diffMin,
          };
        }
        return { wantedKey: wKey, kind: "missing", diffMin: Infinity };
      });

      const exactCount = details.filter((d) => d.kind === "exact").length;
      const allExact = exactCount === details.length;
      const allCovered = details.every((d) => d.kind !== "missing");
      const totalDiffMin = details.reduce(
        (s, d) => s + (d.diffMin === Infinity ? 9999 : d.diffMin),
        0,
      );
      const capacityFull =
        t.max_new_students !== null &&
        t.max_new_students > 0 &&
        t.active_students >= t.max_new_students;

      return { teacher: t, details, exactCount, allExact, allCovered, totalDiffMin, capacityFull };
    });

    const sortByLoad = (a: Match, b: Match) => {
      if (a.capacityFull !== b.capacityFull) return a.capacityFull ? 1 : -1;
      return a.teacher.active_students - b.teacher.active_students;
    };

    const fullMatches = all.filter((m) => m.allExact).sort(sortByLoad);

    // Ближайшие показываем только если нет точных совпадений.
    const nearMatches =
      fullMatches.length > 0
        ? []
        : all
            .filter((m) => m.allCovered && !m.allExact)
            .sort((a, b) => {
              if (a.totalDiffMin !== b.totalDiffMin) return a.totalDiffMin - b.totalDiffMin;
              return sortByLoad(a, b);
            });

    return { fullMatches, nearMatches };
  }, [teachers, wanted]);

  function assign(teacherId: string) {
    if (!studentId) return;
    setError(null);
    setAssigningId(teacherId);
    startTransition(async () => {
      const res = await assignTeacherAction({
        student_id: studentId,
        teacher_id: teacherId,
      });
      if (!res.ok) {
        setError(res.error);
        setAssigningId(null);
        return;
      }
      router.push(`/teacher/student/${studentId}`);
    });
  }

  const wantedList = [...wanted].sort();
  const hasAnyResult = fullMatches.length > 0 || nearMatches.length > 0;
  const isNear = fullMatches.length === 0 && nearMatches.length > 0;

  return (
    <div className="space-y-4">
      {/* ——— СЛОТ-ПИКЕР ——— */}
      <div
        className="bg-ivory rounded-[14px] p-4"
        style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
      >
        <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone mb-2">
          Какое время хочет ученик
        </div>
        <p className="text-[12px] text-olive mb-3">
          Тапни нужные получасовки. Учитель должен быть доступен во{" "}
          <strong>все</strong> выбранные дни и часы одновременно.
        </p>

        {wantedList.length > 0 && (
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-[11px] uppercase tracking-[0.6px] font-medium text-stone">
              Выбрано · {wantedList.length}
            </span>
            <button type="button" onClick={clearAll} className="text-[11px] text-stone underline-offset-2">
              сбросить
            </button>
          </div>
        )}

        <div className="grid grid-cols-7 gap-1 mb-3">
          {DAYS.map((d) => {
            const dayCount = HALF_HOURS.filter((t) => wanted.has(k(d.wd, t))).length;
            const isOpen = openDay === d.wd;
            return (
              <button
                key={d.wd}
                type="button"
                onClick={() => setOpenDay(isOpen ? null : d.wd)}
                className={`flex flex-col items-center justify-center py-2 rounded-[8px] text-[11px] font-medium ${
                  isOpen
                    ? "bg-near-black text-ivory"
                    : dayCount > 0
                      ? "bg-terracotta text-ivory"
                      : "bg-ivory text-charcoal"
                }`}
                style={{
                  boxShadow: isOpen || dayCount > 0 ? "none" : "inset 0 0 0 1px #e8e6dc",
                }}
              >
                <span>{d.short}</span>
                {dayCount > 0 && (
                  <span className="text-[10px] tabular-nums mt-0.5">{dayCount}</span>
                )}
              </button>
            );
          })}
        </div>

        {openDay !== null && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="font-serif text-[16px] font-medium first-letter:capitalize">
                {DAYS.find((x) => x.wd === openDay)?.full}
              </div>
              <button
                type="button"
                onClick={() => clearDay(openDay)}
                className="text-[11px] text-stone px-2 py-1 rounded-[8px]"
                style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
              >
                очистить день
              </button>
            </div>
            <div className="flex items-center gap-2 mb-2 flex-wrap text-[11px] text-olive">
              <span>Диапазон</span>
              <RangePicker onApply={(from, to) => fillRange(openDay, from, to)} />
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {HALF_HOURS.map((t) => {
                const on = wanted.has(k(openDay, t));
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggle(openDay, t)}
                    className={`h-9 rounded-[8px] text-[12px] font-medium tabular-nums ${
                      on ? "bg-terracotta text-ivory" : "bg-ivory text-charcoal"
                    }`}
                    style={{ boxShadow: on ? "none" : "inset 0 0 0 1px #e8e6dc" }}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ——— РЕЗУЛЬТАТЫ ——— */}
      {wanted.size === 0 ? (
        <div
          className="bg-ivory rounded-[14px] py-8 text-center"
          style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
        >
          <p className="text-olive text-[13px]">Выбери слоты сверху — снизу появятся учителя.</p>
        </div>
      ) : !hasAnyResult ? (
        <div
          className="bg-ivory rounded-[14px] py-8 text-center"
          style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
        >
          <p className="text-olive text-[13px]">Нет учителей с подходящим расписанием.</p>
          <p className="text-stone text-[12px] mt-1">
            Попробуй сдвинуть время на ±30–60 минут.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {error && (
            <div>
              <Chip tone="bad" size="m">{error}</Chip>
            </div>
          )}

          {/* Заголовок секции */}
          <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone">
            {isNear ? (
              <>Ближайшие варианты · {nearMatches.length}</>
            ) : (
              <>Совпадают все слоты · {fullMatches.length}</>
            )}
          </div>

          {/* Пояснение для ближайших */}
          {isNear && (
            <div
              className="bg-ivory rounded-[12px] px-4 py-3"
              style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
            >
              <p className="text-[12px] text-olive leading-relaxed">
                Точного совпадения нет. Показаны учителя, у которых есть слоты
                в нужные дни, но с небольшим сдвигом по времени (до 2 часов).
              </p>
            </div>
          )}

          {/* Карточки учителей */}
          <div className="space-y-2">
            {(isNear ? nearMatches : fullMatches).map((m) => (
              <TeacherCard
                key={m.teacher.id}
                m={m}
                studentId={studentId}
                pending={pending}
                assigningId={assigningId}
                onAssign={assign}
                isNear={isNear}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TeacherCard({
  m,
  studentId,
  pending,
  assigningId,
  onAssign,
  isNear,
}: {
  m: Match;
  studentId?: string;
  pending: boolean;
  assigningId: string | null;
  onAssign: (id: string) => void;
  isNear: boolean;
}) {
  return (
    <div
      className="bg-ivory rounded-[14px] p-3"
      style={{
        boxShadow: isNear
          ? "inset 0 0 0 1px rgba(185,140,60,0.35)"
          : "inset 0 0 0 1px rgba(63,107,61,0.4)",
      }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <Link
            href={`/manager/teachers/${m.teacher.id}`}
            className="text-[15px] font-medium text-near-black no-underline truncate"
          >
            {m.teacher.full_name}
          </Link>
          {m.capacityFull && <Chip tone="bad" size="s">мест нет</Chip>}
          {m.teacher.status === "paused" && <Chip tone="neutral" size="s">пауза</Chip>}
        </div>
        {studentId && (
          <button
            type="button"
            disabled={pending}
            onClick={() => onAssign(m.teacher.id)}
            className="text-[12px] font-medium px-3 py-2 rounded-[10px] bg-terracotta text-ivory disabled:opacity-40"
          >
            {pending && assigningId === m.teacher.id ? "Назначаю…" : "Назначить"}
          </button>
        )}
      </div>

      <div className="text-[12px] text-olive mt-1 tabular-nums">
        {m.teacher.active_students} активных
        {m.teacher.max_new_students !== null && (
          <> · возьмёт ещё {Math.max(0, m.teacher.max_new_students - m.teacher.active_students)}</>
        )}
      </div>

      {/* Детали по каждому слоту */}
      <div className="mt-2 space-y-0.5">
        {m.details.map((d) => (
          <SlotDetailRow key={d.wantedKey} d={d} />
        ))}
      </div>
    </div>
  );
}

function SlotDetailRow({ d }: { d: SlotDetail }) {
  const wantedLabel = prettySlot(d.wantedKey);
  if (d.kind === "exact") {
    return (
      <div className="flex items-center gap-1.5 text-[12px] text-moss">
        <span className="text-[10px]">✓</span>
        <span className="tabular-nums">{wantedLabel}</span>
      </div>
    );
  }
  if (d.kind === "near" && d.nearKey) {
    const nearLabel = prettySlot(d.nearKey).split(" ").slice(1).join(" "); // только время
    const sign = d.diffMin > 0 ? "+" : "";
    const diffStr =
      d.diffMin % 60 === 0
        ? `${sign}${d.diffMin / 60} ч`
        : `${sign}${d.diffMin} мин`;
    return (
      <div className="flex items-center gap-1.5 text-[12px] text-olive">
        <span className="text-[10px]">~</span>
        <span>
          <span className="tabular-nums">{wantedLabel}</span>
          <span className="text-stone ml-1">→ у учителя {nearLabel}</span>
          <span className="text-stone ml-1 tabular-nums">({diffStr})</span>
        </span>
      </div>
    );
  }
  // missing — не должно попасть сюда в current logic, но на всякий случай
  return (
    <div className="flex items-center gap-1.5 text-[12px] text-stone line-through">
      <span className="text-[10px]">✗</span>
      <span className="tabular-nums">{wantedLabel}</span>
    </div>
  );
}

function RangePicker({ onApply }: { onApply: (from: string, to: string) => void }) {
  const [from, setFrom] = useState("10:00");
  const [to, setTo] = useState("17:30");
  return (
    <div className="flex items-center gap-1.5">
      <select
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        className="bg-ivory text-near-black text-[12px] rounded-[6px] px-1.5 py-1 tabular-nums"
        style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
      >
        {HALF_HOURS.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      <span>—</span>
      <select
        value={to}
        onChange={(e) => setTo(e.target.value)}
        className="bg-ivory text-near-black text-[12px] rounded-[6px] px-1.5 py-1 tabular-nums"
        style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
      >
        {HALF_HOURS.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => onApply(from, to)}
        className="text-[11px] font-medium px-2 py-1 rounded-[6px] bg-terracotta text-ivory"
      >
        Заполнить
      </button>
    </div>
  );
}

function prettySlot(key: string): string {
  const [wd, t] = key.split("|");
  const day = DAYS.find((d) => String(d.wd) === wd);
  return `${day?.short ?? wd} ${t}`;
}
