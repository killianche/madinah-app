"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { createTeacherAction } from "../actions";

function genPassword(len = 10): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

function suggestLogin(fullName: string): string {
  const transliterate = (s: string) => {
    const map: Record<string, string> = {
      а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh",
      з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
      п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts",
      ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu",
      я: "ya",
    };
    return s
      .toLowerCase()
      .split("")
      .map((c) => map[c] ?? (/[a-z0-9]/.test(c) ? c : ""))
      .join("");
  };
  const parts = fullName.trim().split(/\s+/);
  const first = transliterate(parts[0] ?? "");
  return first.slice(0, 16) || "user";
}

export function NewTeacherForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [created, setCreated] = useState<{ login: string; password: string } | null>(null);

  const [fullName, setFullName] = useState("");
  const [login, setLogin] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loginTouched, setLoginTouched] = useState(false);

  function onNameChange(v: string) {
    setFullName(v);
    if (!loginTouched) setLogin(suggestLogin(v));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const res = await createTeacherAction({
        full_name: fullName,
        login: login,
        phone: phone || null,
        password: password,
      });
      if (res.ok) {
        setCreated({ login, password });
      } else {
        setError(res.error);
      }
    });
  }

  if (created) {
    return (
      <div className="space-y-3">
        <div className="text-[10px] uppercase tracking-[0.6px] font-medium text-stone">
          Учитель создан
        </div>
        <div className="font-serif text-[20px] font-medium">{fullName}</div>
        <div className="bg-warm-sand px-3 py-3 rounded-[10px] space-y-1">
          <div className="text-[12px] text-olive">Логин</div>
          <div className="font-mono text-[16px] tabular-nums select-all">{created.login}</div>
          <div className="text-[12px] text-olive mt-2">Пароль</div>
          <div className="font-mono text-[16px] tabular-nums select-all">{created.password}</div>
        </div>
        <p className="text-[12px] text-olive">
          Логин и пароль также сохранены в разделе «Логины учителей» — куратор может их посмотреть.
        </p>
        <div className="flex gap-2 pt-2">
          <Button onClick={() => router.push("/manager/credentials")}>К логинам</Button>
          <Button variant="ghost" onClick={() => router.push("/manager/teachers")}>
            К списку
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="ФИО учителя">
        <Input value={fullName} onChange={(e) => onNameChange(e.target.value)} required />
      </Field>

      <Field label="Логин" helper="латиницей, минимум 2 символа — для входа">
        <Input
          value={login}
          onChange={(e) => {
            setLogin(e.target.value.replace(/\s/g, ""));
            setLoginTouched(true);
          }}
          required
          minLength={2}
          placeholder="ivan_petrov"
        />
      </Field>

      <Field label="Телефон" helper="второй логин — необязателен">
        <Input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+7..."
        />
      </Field>

      <Field label="Пароль" helper="минимум 6 символов">
        <div className="flex gap-2">
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            placeholder="придумай или сгенерируй"
            className="flex-1"
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

      {error && <p className="text-sm text-terracotta">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Создаю…" : "Создать учителя"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
