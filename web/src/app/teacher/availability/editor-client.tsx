"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { saveAvailabilityAction, saveCapacityAction } from "./actions";

interface Slot {
  weekday: number;
  time_at: string;
}

interface BusySlot {
  weekday: number;
  time_at: string;
  student_name: string;
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
const HOUR_TO = 23; // last cell starts 23:30
function buildHalfHours(): string[] {
  const out: string[] = [];
  for (let h = HOUR_FROM; h <= HOUR_TO; h++) {
    out.push(`${String(h).padStart(2, "0")}:00`);
    out.push(`${String(h).padStart(2, "0")}:30`);
  }
  return out;
}
const HALF_HOURS = buildHalfHours(); // 28 cells

function key(wd: number, t: string): string {
  return `${wd}|${t}`;
}

function rangeFill(set: Set<string>, wd: number, from: string, to: string) {
  const start = HALF_HOURS.indexOf(from);
  const end = HALF_HOURS.indexOf(to);
  if (start < 0 || end < 0 || end < start) return;
  for (let i = start; i <= end; i++) {
    set.add(key(wd, HALF_HOURS[i]!));
  }
}

export function AvailabilityEditor({
  initialSlots,
  initialMaxNewStudents,
  busySlots = [],
}: {
  initialSlots: Slot[];
  initialMaxNewStudents: number | null;
  busySlots?: BusySlot[];
}) {
  const busyByKey = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const b of busySlots) {
      const k = key(b.weekday, b.time_at);
      const arr = map.get(k) ?? [];
      arr.push(b.student_name);
      map.set(k, arr);
    }
    return map;
  }, [busySlots]);
  const toast = useToast();

  const initialSet = useMemo(() => {
    const s = new Set<string>();
    for (const x of initialSlots) s.add(key(x.weekday, x.time_at));
    return s;
  }, [initialSlots]);

  const [active, setActive] = useState<Set<string>>(() => new Set(initialSet));
  const [capNumber, setCapNumber] = useState<string>(
    initialMaxNewStudents !== null ? String(initialMaxNewStudents) : "",
  );

  const [, startSlots] = useTransition();
  const [, startCapacity] = useTransition();
  const slotsTimer = useRef<NodeJS.Timeout | null>(null);
  const capacityTimer = useRef<NodeJS.Timeout | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const savedFlashTimer = useRef<NodeJS.Timeout | null>(null);

  function flashSaved() {
    setSaveState("saved");
    if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current);
    savedFlashTimer.current = setTimeout(() => setSaveState("idle"), 1500);
  }

  function persistSlotsDebounced(next: Set<string>) {
    if (slotsTimer.current) clearTimeout(slotsTimer.current);
    setSaveState("saving");
    slotsTimer.current = setTimeout(() => {
      const slots: Slot[] = [];
      for (const k of next) {
        const [wd, t] = k.split("|");
        if (wd && t) slots.push({ weekday: Number(wd), time_at: t });
      }
      startSlots(async () => {
        const res = await saveAvailabilityAction({ slots });
        if (!res.ok) {
          setSaveState("error");
          toast.error(res.error);
          return;
        }
        flashSaved();
      });
    }, 500);
  }

  function persistCapacityDebounced(value: number | null) {
    if (capacityTimer.current) clearTimeout(capacityTimer.current);
    setSaveState("saving");
    capacityTimer.current = setTimeout(() => {
      startCapacity(async () => {
        const res = await saveCapacityAction({ max_new_students: value });
        if (!res.ok) {
          setSaveState("error");
          toast.error(res.error);
          return;
        }
        flashSaved();
      });
    }, 500);
  }

  const isFirstRender = useRef(true);
  // persistCapacityDebounced — стабильна между рендерами (использует ref для таймера),
  // поэтому безопасно держать deps только на capNumber. Внутри функции читаются актуальные
  // значения из замыкания — реальной утечки нет. Линтер заглушен осознанно.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const trimmed = capNumber.trim();
    if (trimmed === "") {
      persistCapacityDebounced(null);
      return;
    }
    const n = parseInt(trimmed, 10);
    if (Number.isNaN(n) || n < 0 || n > 99) return;
    persistCapacityDebounced(n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capNumber]);

  function toggle(wd: number, t: string) {
    const k = key(wd, t);
    const next = new Set(active);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setActive(next);
    persistSlotsDebounced(next);
  }

  function fillRange(wd: number, from: string, to: string) {
    const next = new Set(active);
    rangeFill(next, wd, from, to);
    setActive(next);
    persistSlotsDebounced(next);
  }

  function clearDay(wd: number) {
    const next = new Set(active);
    for (const t of HALF_HOURS) next.delete(key(wd, t));
    setActive(next);
    persistSlotsDebounced(next);
  }

  return (
    <div className="space-y-5">
      <div className="h-5 text-[12px] tabular-nums">
        {saveState === "saving" && <span className="text-stone">Сохраняю…</span>}
        {saveState === "saved" && <span className="text-moss">Сохранено</span>}
        {saveState === "error" && <span className="text-crimson">Ошибка сохранения</span>}
      </div>
      <CapacityCard number={capNumber} setNumber={setCapNumber} />

      <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone">
        Когда готов работать
      </div>

      {DAYS.map((d) => (
        <DayCard
          key={d.wd}
          weekday={d.wd}
          fullName={d.full}
          active={active}
          busyByKey={busyByKey}
          onToggle={(t) => toggle(d.wd, t)}
          onFillRange={(from, to) => fillRange(d.wd, from, to)}
          onClearDay={() => clearDay(d.wd)}
        />
      ))}

      <p className="text-[12px] text-olive">
        Сохраняется автоматически. Куратор увидит свободные слоты.
      </p>
    </div>
  );
}

function CapacityCard({
  number,
  setNumber,
}: {
  number: string;
  setNumber: (n: string) => void;
}) {
  function onChange(raw: string) {
    const cleaned = raw.replace(/\D/g, "").slice(0, 2);
    setNumber(cleaned);
  }
  const empty = number.trim() === "";
  return (
    <div
      className="bg-ivory rounded-[14px] p-4"
      style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
    >
      <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone mb-3">
        Сколько ещё учеников возьму
      </div>
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={number}
          onChange={(e) => onChange(e.target.value)}
          placeholder="—"
          className="w-full h-14 bg-ivory rounded-[12px] text-near-black text-[28px] font-serif font-medium tabular-nums text-center outline-none placeholder:text-stone"
          style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
          aria-label="Сколько ещё учеников"
        />
        {!empty && (
          <button
            type="button"
            onClick={() => setNumber("")}
            aria-label="Очистить"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full text-stone"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        )}
      </div>
      <p className="text-[12px] text-olive mt-2">
        {empty ? "Оставь пустым — куратор спросит при необходимости" : "Куратор увидит это число при подборе"}
      </p>
    </div>
  );
}

function DayCard({
  weekday,
  fullName,
  active,
  busyByKey,
  onToggle,
  onFillRange,
  onClearDay,
}: {
  weekday: number;
  fullName: string;
  active: Set<string>;
  busyByKey: Map<string, string[]>;
  onToggle: (t: string) => void;
  onFillRange: (from: string, to: string) => void;
  onClearDay: () => void;
}) {
  const [from, setFrom] = useState("10:00");
  const [to, setTo] = useState("17:30");

  const fromIdx = HALF_HOURS.indexOf(from);
  const toIdx = HALF_HOURS.indexOf(to);
  const rangeOk = fromIdx >= 0 && toIdx >= 0 && toIdx >= fromIdx;

  const dayHasAny = HALF_HOURS.some((t) => active.has(key(weekday, t)));

  return (
    <div
      className="bg-ivory rounded-[14px] p-4"
      style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="font-serif text-[18px] font-medium first-letter:capitalize">
          {fullName}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onClearDay}
            disabled={!dayHasAny}
            className="text-[12px] text-stone px-3 py-1.5 rounded-[10px] disabled:opacity-40"
            style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
            aria-label="Очистить день"
          >
            очистить
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-[12px] text-olive">Диапазон</span>
        <select
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="bg-ivory text-near-black text-[13px] rounded-[8px] px-2 py-1.5 tabular-nums"
          style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
        >
          {HALF_HOURS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <span className="text-[12px] text-olive">—</span>
        <select
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="bg-ivory text-near-black text-[13px] rounded-[8px] px-2 py-1.5 tabular-nums"
          style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
        >
          {HALF_HOURS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={!rangeOk}
          onClick={() => onFillRange(from, to)}
          className="text-[12px] font-medium px-3 py-1.5 rounded-[10px] bg-terracotta text-ivory disabled:opacity-40"
        >
          Заполнить
        </button>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {HALF_HOURS.map((t) => {
          const on = active.has(key(weekday, t));
          const busyNames = busyByKey.get(key(weekday, t));
          const busy = !!busyNames;
          const label = busy ? busyNames![0]!.split(" ")[0] : null;
          return (
            <button
              key={t}
              type="button"
              onClick={() => onToggle(t)}
              className={`h-12 rounded-[8px] text-[12px] font-medium tabular-nums flex flex-col items-center justify-center leading-tight ${
                on
                  ? "bg-terracotta text-ivory"
                  : busy
                    ? "bg-warm-sand text-charcoal"
                    : "bg-ivory text-charcoal"
              }`}
              style={{
                boxShadow: on ? "none" : "inset 0 0 0 1px #e8e6dc",
              }}
              aria-pressed={on}
              title={busy ? `Занято: ${busyNames!.join(", ")}` : undefined}
            >
              <span className="text-[13px]">{t}</span>
              {busy && (
                <span
                  className={`text-[10px] mt-0.5 truncate max-w-full px-1 ${
                    on ? "text-ivory/85" : "text-olive"
                  }`}
                >
                  {label}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mt-3 text-[11px] text-olive">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-[3px] bg-terracotta" />
          готов
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-[3px] bg-warm-sand" style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }} />
          занят с учеником
        </span>
      </div>
    </div>
  );
}
