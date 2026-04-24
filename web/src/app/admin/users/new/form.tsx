"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import type { UserRole } from "@/lib/types";
import { USER_ROLE_LABEL } from "@/lib/types";
import { createUserAction } from "./actions";

const ROLES: UserRole[] = ["teacher", "manager", "curator", "head", "director", "admin"];

export function NewUserForm({ teachers }: { teachers: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [successPwd, setSuccessPwd] = useState<string>();

  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("teacher");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [teacherId, setTeacherId] = useState<string>("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await createUserAction({
        full_name: fullName,
        role,
        phone: phone || null,
        email: email || null,
        teacher_id: role === "teacher" ? teacherId || null : null,
      });
      if (result.ok) {
        setSuccessPwd(result.temp_password);
      } else {
        setError(result.error);
      }
    });
  }

  if (successPwd) {
    return (
      <div className="space-y-4">
        <div className="bg-[#e3efd7] text-[#3e6527] rounded-md p-4">
          <p className="font-medium mb-2">Сотрудник создан</p>
          <p className="text-sm">
            Передайте пользователю временный пароль. После первого входа он сможет его сменить.
          </p>
        </div>
        <div className="bg-ivory shadow-ring rounded-md p-4 font-mono text-center text-lg select-all">
          {successPwd}
        </div>
        <div className="flex gap-3">
          <Button onClick={() => router.push("/admin")}>К списку сотрудников</Button>
          <Button
            variant="ghost"
            onClick={() => {
              setSuccessPwd(undefined);
              setFullName("");
              setPhone("");
              setEmail("");
            }}
          >
            Создать ещё
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="ФИО">
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </Field>

      <Field label="Роль">
        <select className="input" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {USER_ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </Field>

      {role === "teacher" && teachers.length > 0 && (
        <Field label="Привязать к существующему учителю" helper="Если в журнале уже есть история уроков этого учителя">
          <select className="input" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            <option value="">— создать нового —</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Телефон" helper="Для входа в систему">
        <Input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+7 999 123 45 67"
        />
      </Field>

      <Field label="Email (необязательно)">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>

      {error && <p className="text-sm text-terracotta">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Создаю…" : "Создать и сгенерировать пароль"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
