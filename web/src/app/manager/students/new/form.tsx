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
  const [teacherId, setTeacherId] = useState(teachers[0]?.id ?? "");
  const [initialBalance, setInitialBalance] = useState("0");
  const [isCharity, setIsCharity] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await createStudentAction({
        full_name: fullName,
        phone: phone || null,
        telegram_username: tg.replace(/^@/, "") || null,
        teacher_id: teacherId || null,
        initial_balance: parseInt(initialBalance, 10) || 0,
        is_charity: isCharity,
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

      <Field label="Telegram" helper="Без @">
        <Input value={tg} onChange={(e) => setTg(e.target.value)} placeholder="username" />
      </Field>

      <Field label="Учитель">
        <select className="input" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
          <option value="">— не назначен —</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </Field>

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
