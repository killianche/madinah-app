"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { editTeacherAction } from "./actions";

export function EditTeacherForm({
  teacherId,
  initial,
}: {
  teacherId: string;
  initial: { full_name: string; phone: string; login: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  const [fullName, setFullName] = useState(initial.full_name);
  const [phone, setPhone] = useState(initial.phone);
  const [login, setLogin] = useState(initial.login);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const res = await editTeacherAction({
        teacher_id: teacherId,
        full_name: fullName,
        phone: phone || null,
        login: login || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/manager/teachers/${teacherId}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="ФИО">
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </Field>
      <Field label="Логин">
        <Input
          value={login}
          onChange={(e) => setLogin(e.target.value.replace(/\s/g, ""))}
          minLength={2}
          placeholder="ivan_petrov"
        />
      </Field>
      <Field label="Телефон">
        <Input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+7..."
        />
      </Field>

      {error && <p className="text-sm text-terracotta">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Сохраняю…" : "Сохранить"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
