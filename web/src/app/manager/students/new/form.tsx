"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { createStudentAction } from "./actions";

export function NewStudentForm({ teachers }: { teachers: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [tg, setTg] = useState("");
  const [tgPhone, setTgPhone] = useState("");
  const [tgSameAsPhone, setTgSameAsPhone] = useState(false);
  const [wa, setWa] = useState("");
  const [waSameAsPhone, setWaSameAsPhone] = useState(false);
  const [teacherId, setTeacherId] = useState("");
  const [initialBalance, setInitialBalance] = useState("0");
  const [isCharity, setIsCharity] = useState(false);
  const [schedule, setSchedule] = useState<Array<{ weekday: number; time_at: string }>>([]);

  function addScheduleRow() {
    setSchedule((prev) => [...prev, { weekday: 1, time_at: "17:00" }]);
  }
  function removeScheduleRow(idx: number) {
    setSchedule((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateScheduleRow(idx: number, field: "weekday" | "time_at", value: number | string) {
    setSchedule((prev) =>
      prev.map((row, i) =>
        i === idx ? { ...row, [field]: value } : row,
      ),
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    const validSchedule = schedule.filter(
      (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s.time_at),
    );
    startTransition(async () => {
      const result = await createStudentAction({
        full_name: fullName,
        phone: phone || null,
        telegram_username: tg.replace(/^@/, "") || null,
        telegram_phone: tgSameAsPhone ? phone || null : tgPhone || null,
        whatsapp_phone: waSameAsPhone ? phone || null : wa || null,
        teacher_id: teacherId || null,
        initial_balance: parseInt(initialBalance, 10) || 0,
        is_charity: isCharity,
        schedule: validSchedule,
      });
      if (result.ok) {
        router.push("/manager");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="ФИО ученика">
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </Field>

      <Field label="Телефон">
        <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7..." />
      </Field>

      <Field label="Telegram username" helper="Без @ — например, ivan_petrov">
        <Input value={tg} onChange={(e) => setTg(e.target.value)} placeholder="username" />
      </Field>

      <Field label="Telegram номер" helper="Если в TG другой номер — впиши">
        <div className="flex flex-col gap-2">
          <Input
            value={tgSameAsPhone ? phone : tgPhone}
            onChange={(e) => setTgPhone(e.target.value)}
            placeholder="+7..."
            disabled={tgSameAsPhone}
            type="tel"
          />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={tgSameAsPhone}
              onChange={(e) => setTgSameAsPhone(e.target.checked)}
              className="accent-terracotta"
            />
            <span>Тот же что и основной телефон</span>
          </label>
        </div>
      </Field>

      <Field label="WhatsApp номер" helper="Если в WhatsApp другой номер — впиши">
        <div className="flex flex-col gap-2">
          <Input
            value={waSameAsPhone ? phone : wa}
            onChange={(e) => setWa(e.target.value)}
            placeholder="+7..."
            disabled={waSameAsPhone}
            type="tel"
          />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={waSameAsPhone}
              onChange={(e) => setWaSameAsPhone(e.target.checked)}
              className="accent-terracotta"
            />
            <span>Тот же что и основной телефон</span>
          </label>
        </div>
      </Field>

      <Field label="Учитель" helper="Если оставить пустым — куратор назначит сам">
        <select className="input" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
          <option value="">— назначит куратор —</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </Field>

      <div>
        <div className="text-sm font-medium text-near-black mb-1.5">
          Расписание ученика
        </div>
        <p className="text-[12px] text-olive-gray mb-2">
          Когда ученик хочет заниматься. 4–5 дней — обычная нагрузка.
        </p>
        <div className="space-y-2">
          {schedule.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={row.weekday}
                onChange={(e) =>
                  updateScheduleRow(i, "weekday", parseInt(e.target.value, 10))
                }
                className="input flex-1"
              >
                <option value={1}>Понедельник</option>
                <option value={2}>Вторник</option>
                <option value={3}>Среда</option>
                <option value={4}>Четверг</option>
                <option value={5}>Пятница</option>
                <option value={6}>Суббота</option>
                <option value={7}>Воскресенье</option>
              </select>
              <input
                type="time"
                value={row.time_at}
                onChange={(e) => updateScheduleRow(i, "time_at", e.target.value)}
                className="input w-28 tabular-nums"
              />
              <button
                type="button"
                onClick={() => removeScheduleRow(i)}
                className="w-9 h-9 flex items-center justify-center rounded-[10px] text-stone"
                style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
                aria-label="Удалить"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addScheduleRow}
            className="text-[13px] font-medium text-charcoal px-3 py-2 rounded-[10px] bg-ivory"
            style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
          >
            + добавить день
          </button>
        </div>
      </div>

      <Field label="Стартовый баланс (уроков)" helper="Например, 20 — при оплаченном пакете 20 уроков">
        <Input
          type="number"
          value={initialBalance}
          onChange={(e) => setInitialBalance(e.target.value)}
        />
      </Field>

      <label className="flex items-center gap-3 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={isCharity}
          onChange={(e) => setIsCharity(e.target.checked)}
          className="accent-terracotta"
        />
        <span>Благотворительный ученик</span>
      </label>

      {error && <p className="text-sm text-terracotta">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Сохраняю…" : "Создать"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
