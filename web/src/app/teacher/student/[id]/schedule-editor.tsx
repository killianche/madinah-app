"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { StudentSchedule } from "@/lib/types";
import { WEEKDAY_LABEL_LONG } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { saveScheduleAction, removeScheduleAction } from "./schedule-actions";

export function ScheduleEditor({
  studentId,
  initial,
}: {
  studentId: string;
  initial: StudentSchedule[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [weekday, setWeekday] = useState<number>(1);
  const [time, setTime] = useState("18:00");
  const [duration, setDuration] = useState(60);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function onAdd() {
    setError(undefined);
    startTransition(async () => {
      const res = await saveScheduleAction({
        student_id: studentId,
        weekday,
        time_at: time,
        duration_min: duration,
      });
      if (res.ok) {
        setItems([
          ...items.filter((it) => !(it.weekday === weekday && it.time_at === time)),
          {
            id: res.id,
            student_id: studentId,
            weekday,
            time_at: time,
            duration_min: duration,
            active: true,
            note: null,
          },
        ].sort((a, b) => a.weekday - b.weekday || a.time_at.localeCompare(b.time_at)));
        setAdding(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function onRemove(id: string) {
    startTransition(async () => {
      const res = await removeScheduleAction({ id });
      if (res.ok) {
        setItems(items.filter((i) => i.id !== id));
        router.refresh();
      }
    });
  }

  return (
    <div>
      {items.length === 0 ? (
        <p className="text-sm text-olive-gray mb-3">Расписание — просто напоминалка для учителя, когда примерно проводить уроки. Ни на что не влияет.</p>
      ) : (
        <ul className="space-y-2 mb-3">
          {items.map((it) => (
            <li key={it.id} className="flex items-center justify-between bg-ivory rounded-md shadow-ring p-3">
              <div className="text-sm">
                <span className="font-medium">{WEEKDAY_LABEL_LONG[it.weekday]}</span>
                <span className="text-olive-gray"> · {it.time_at} · {it.duration_min} мин</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => onRemove(it.id)} disabled={pending}>
                Удалить
              </Button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="bg-subtle/30 rounded-md p-3 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Field label="День">
              <select
                className="input"
                value={weekday}
                onChange={(e) => setWeekday(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <option key={d} value={d}>{WEEKDAY_LABEL_LONG[d]}</option>
                ))}
              </select>
            </Field>
            <Field label="Время">
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
            <Field label="Мин">
              <Input
                type="number"
                min={10}
                max={240}
                step={5}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </Field>
          </div>
          {error && <p className="text-xs text-terracotta">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={onAdd} disabled={pending}>Добавить</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)} disabled={pending}>
              Отмена
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
          + Добавить слот
        </Button>
      )}
    </div>
  );
}
