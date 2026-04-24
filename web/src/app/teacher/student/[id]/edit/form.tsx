"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateStudentAction } from "./actions";
import { useToast } from "@/components/ui/toast";

export function EditStudentForm({
  id,
  initial,
}: {
  id: string;
  initial: {
    full_name: string;
    phone: string | null;
    telegram_username: string | null;
    is_charity: boolean;
    charity_note: string | null;
  };
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [fullName, setFullName] = useState(initial.full_name);
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [tg, setTg] = useState(initial.telegram_username ?? "");
  const [charity, setCharity] = useState(initial.is_charity);
  const [note, setNote] = useState(initial.charity_note ?? "");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateStudentAction({
        student_id: id,
        full_name: fullName,
        phone: phone || null,
        telegram_username: tg || null,
        is_charity: charity,
        charity_note: charity ? note || null : null,
      });
      if (res.ok) {
        toast.success("Сохранено");
        router.push(`/teacher/student/${id}`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field label="ФИО">
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          maxLength={200}
          className="input-field"
        />
      </Field>

      <Field label="Телефон">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+7 999 123-45-67"
          className="input-field"
        />
      </Field>

      <Field label="Telegram">
        <input
          type="text"
          value={tg}
          onChange={(e) => setTg(e.target.value)}
          placeholder="@username"
          className="input-field"
        />
      </Field>

      <div>
        <label className="flex items-start gap-3 p-3 rounded-[12px] bg-ivory cursor-pointer"
          style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
        >
          <input
            type="checkbox"
            checked={charity}
            onChange={(e) => setCharity(e.target.checked)}
            className="mt-1 accent-terracotta"
          />
          <div>
            <div className="text-[15px] font-medium">Благотворительный ученик</div>
            <div className="text-[12px] text-olive mt-0.5">
              учится бесплатно, балансы не трогаем
            </div>
          </div>
        </label>
        {charity && (
          <div className="mt-3">
            <Field label="Комментарий по благотворительности">
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="напр. сирота, малоимущая семья"
                maxLength={200}
                className="input-field"
              />
            </Field>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 bg-terracotta text-ivory font-medium rounded-[12px] py-[14px] disabled:opacity-40"
        >
          {pending ? "Сохраняю…" : "Сохранить"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-[14px] rounded-[12px] font-medium text-charcoal"
          style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
        >
          Отмена
        </button>
      </div>

      <style>{`.input-field{width:100%;background:#faf9f5;border-radius:12px;padding:12px 16px;font-size:15px;color:#141413;border:0;outline:0;box-shadow:inset 0 0 0 1px #f0eee6}.input-field:focus{box-shadow:inset 0 0 0 1px #e8e6dc, 0 0 0 3px rgba(56,152,236,0.25)}`}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.6px] font-medium text-stone mb-2">
        {label}
      </div>
      {children}
    </div>
  );
}
