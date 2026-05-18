"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Chip } from "@/components/ui/chip";
import { replaceStudentScheduleAction } from "./schedule-actions";

const DAYS = [
  { wd: 1, full: "Понедельник", short: "ПН" },
  { wd: 2, full: "Вторник", short: "ВТ" },
  { wd: 3, full: "Среда", short: "СР" },
  { wd: 4, full: "Четверг", short: "ЧТ" },
  { wd: 5, full: "Пятница", short: "ПТ" },
  { wd: 6, full: "Суббота", short: "СБ" },
  { wd: 7, full: "Воскресенье", short: "ВС" },
];

interface Slot {
  weekday: number;
  time_at: string;
}

interface SlotWithKey extends Slot {
  _key: string;
}

function newKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export function ScheduleEditClient({
  studentId,
  initialSlots,
}: {
  studentId: string;
  initialSlots: Slot[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<SlotWithKey[]>(() =>
    initialSlots.map((s) => ({ ...s, _key: newKey() })),
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function add() {
    setSlots((prev) => [...prev, { weekday: 1, time_at: "17:00", _key: newKey() }]);
  }

  function update(key: string, field: "weekday" | "time_at", value: number | string) {
    setSlots((prev) => prev.map((s) => (s._key === key ? { ...s, [field]: value } : s)));
  }

  function remove(key: string) {
    setSlots((prev) => prev.filter((s) => s._key !== key));
  }

  function save() {
    setError(null);
    const valid = slots.filter((s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s.time_at));
    startTransition(async () => {
      const res = await replaceStudentScheduleAction({
        student_id: studentId,
        slots: valid,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  function cancel() {
    setSlots(initialSlots.map((s) => ({ ...s, _key: newKey() })));
    setError(null);
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[12px] font-medium text-charcoal px-3 py-1.5 rounded-[10px] bg-ivory"
        style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
      >
        Изменить
      </button>
    );
  }

  return (
    <div
      className="bg-ivory rounded-[14px] p-4 mt-2"
      style={{ boxShadow: "inset 0 0 0 1px rgba(201,100,66,0.45)" }}
    >
      <div className="text-[12px] uppercase tracking-[0.6px] font-medium text-stone mb-2">
        Редактировать расписание
      </div>
      <div className="space-y-2 mb-3">
        {slots.map((s) => (
          <div key={s._key} className="flex items-center gap-2">
            <select
              value={s.weekday}
              onChange={(e) => update(s._key, "weekday", parseInt(e.target.value, 10))}
              className="flex-1 bg-ivory text-near-black text-[14px] rounded-[10px] px-3 py-2"
              style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
            >
              {DAYS.map((d) => (
                <option key={d.wd} value={d.wd}>{d.full}</option>
              ))}
            </select>
            <input
              type="time"
              value={s.time_at}
              onChange={(e) => update(s._key, "time_at", e.target.value)}
              className="w-28 bg-ivory text-near-black text-[14px] rounded-[10px] px-3 py-2 tabular-nums"
              style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
            />
            <button
              type="button"
              onClick={() => remove(s._key)}
              className="w-9 h-9 flex items-center justify-center rounded-[10px] text-stone"
              style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
              aria-label="Удалить"
            >
              ×
            </button>
          </div>
        ))}
        {slots.length === 0 && (
          <p className="text-[13px] text-olive">Расписание пустое — добавь нужные дни.</p>
        )}
        <button
          type="button"
          onClick={add}
          className="text-[13px] font-medium text-charcoal px-3 py-2 rounded-[10px] bg-ivory"
          style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
        >
          + добавить день
        </button>
      </div>

      {error && (
        <div className="mb-2">
          <Chip tone="bad" size="s">{error}</Chip>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="text-[13px] font-medium px-3 py-2 rounded-[10px] bg-terracotta text-ivory disabled:opacity-40"
        >
          {pending ? "Сохраняю…" : "Сохранить"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={cancel}
          className="text-[13px] font-medium text-stone px-3 py-2 rounded-[10px] bg-ivory disabled:opacity-40"
          style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
