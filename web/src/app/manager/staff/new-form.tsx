"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/lib/types";
import { USER_ROLE_LABEL } from "@/lib/types";
import { createStaffAction } from "./actions";

// Менеджеры заводятся только в Sales (op.appmadinah.ru). В Quran они — identity для
// created_by_user_id и не должны создаваться отсюда.
const ALL_ROLES: UserRole[] = ["teacher", "curator", "head", "admin"];
const HEAD_ROLES: UserRole[] = ["teacher", "curator", "head"];

function genPassword(len = 10): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz";
  let out = "";
  for (let i = 0; i < len; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

export function NewStaffForm({
  teachers,
  allowAdmin,
}: {
  teachers: { id: string; name: string }[];
  allowAdmin: boolean;
}) {
  const ROLES = allowAdmin ? ALL_ROLES : HEAD_ROLES;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [created, setCreated] = useState<{ login: string; password: string } | null>(null);

  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("teacher");
  const [login, setLogin] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [teacherId, setTeacherId] = useState<string>("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await createStaffAction({
        full_name: fullName,
        role,
        login,
        phone: phone || null,
        password,
        teacher_id: role === "teacher" ? teacherId || null : null,
      });
      if (result.ok) {
        setCreated({ login, password });
      } else {
        setError(result.error);
      }
    });
  }

  if (created) {
    return (
      <div className="space-y-3">
        <div className="text-[10px] uppercase tracking-[0.6px] font-medium text-stone">
          Сотрудник создан
        </div>
        <div className="font-serif text-[20px] font-medium text-near-black">{fullName}</div>
        <div className="bg-warm-sand px-3 py-3 rounded-[10px] space-y-1">
          <div className="text-[12px] text-olive">Логин</div>
          <div className="font-mono text-[16px] tabular-nums select-all text-near-black">{created.login}</div>
          <div className="text-[12px] text-olive mt-2">Пароль</div>
          <div className="font-mono text-[16px] tabular-nums select-all text-near-black">{created.password}</div>
        </div>
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => router.push("/manager/staff")}
            className="text-[14px] font-medium px-4 py-2 rounded-[10px] bg-terracotta text-ivory"
          >
            К списку
          </button>
          <button
            type="button"
            onClick={() => {
              setCreated(null);
              setFullName("");
              setLogin("");
              setPhone("");
              setPassword("");
            }}
            className="text-[14px] font-medium px-4 py-2 rounded-[10px] bg-ivory text-charcoal"
            style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
          >
            Создать ещё
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field label="ФИО">
        <input
          className="input"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
      </Field>

      <Field label="Роль">
        <select
          className="input"
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {USER_ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </Field>

      {role === "teacher" && teachers.length > 0 && (
        <Field
          label="Привязать к существующему учителю"
          helper="Если в журнале уже есть история уроков этого учителя"
        >
          <select
            className="input"
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
          >
            <option value="">— создать нового —</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Логин" helper="латиницей, для входа">
        <input
          className="input"
          value={login}
          onChange={(e) => setLogin(e.target.value.replace(/\s/g, ""))}
          required
          minLength={2}
          placeholder="ivan_petrov"
        />
      </Field>

      <Field label="Телефон" helper="второй логин — необязательно">
        <input
          className="input"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+7 999 123 45 67"
        />
      </Field>

      <Field label="Пароль" helper="минимум 6 символов">
        <div className="flex gap-2">
          <input
            className="input flex-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            placeholder="придумай или сгенерируй"
          />
          <button
            type="button"
            onClick={() => setPassword(genPassword(10))}
            className="text-[13px] font-medium text-charcoal px-3 rounded-[10px] bg-ivory whitespace-nowrap"
            style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
          >
            Сгенерировать
          </button>
        </div>
      </Field>

      {error && <p className="text-[13px] text-crimson">{error}</p>}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="text-[14px] font-medium px-4 py-2 rounded-[10px] bg-terracotta text-ivory disabled:opacity-40"
        >
          {pending ? "Создаю…" : "Создать"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-[14px] font-medium px-4 py-2 rounded-[10px] bg-ivory text-charcoal"
          style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
        >
          Отмена
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-[0.6px] font-medium text-stone mb-1">
        {label}
      </div>
      {children}
      {helper && <div className="text-[11px] text-olive mt-1">{helper}</div>}
    </label>
  );
}
