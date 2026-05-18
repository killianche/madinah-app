"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { changeTeacherAction } from "./actions";

interface Teacher {
  id: string;
  full_name: string;
}

export function ChangeTeacherDialog({
  studentId,
  currentTeacherId,
  teachers,
}: {
  studentId: string;
  currentTeacherId: string | null;
  teachers: Teacher[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string>("");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((t) => t.full_name.toLowerCase().includes(q));
  }, [query, teachers]);

  function close() {
    setOpen(false);
    setQuery("");
    setSelected("");
    setReason("");
    setError(undefined);
  }

  function submit() {
    if (!selected) {
      setError("Выбери учителя");
      return;
    }
    if (selected === currentTeacherId) {
      setError("Это уже текущий учитель");
      return;
    }
    setError(undefined);
    startTransition(async () => {
      const res = await changeTeacherAction({
        student_id: studentId,
        new_teacher_id: selected,
        reason: reason.trim() || null,
      });
      if (res.ok) {
        close();
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary"
      >
        Сменить учителя
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-near-black/40 flex items-center justify-center p-4 z-50"
          onClick={close}
        >
          <div
            className="bg-ivory rounded-lg shadow-ring w-full max-w-md p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-2xl">Сменить учителя</h3>

            <div>
              <label className="block text-sm font-medium mb-1">
                Новый учитель
              </label>
              <input
                type="text"
                className="input mb-2"
                placeholder="Поиск по имени…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
              <div className="max-h-60 overflow-y-auto rounded-md border border-parchment">
                {filtered.length === 0 ? (
                  <div className="p-3 text-sm text-olive-gray">
                    Никого не нашёл.
                  </div>
                ) : (
                  filtered.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelected(t.id)}
                      className={`w-full text-left px-3 py-2 text-sm transition ${
                        selected === t.id
                          ? "bg-terracotta text-ivory"
                          : "hover:bg-parchment"
                      } ${t.id === currentTeacherId ? "opacity-60" : ""}`}
                    >
                      {t.full_name}
                      {t.id === currentTeacherId && (
                        <span className="text-xs ml-2">· текущий</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Причина <span className="text-olive-gray">(необязательно)</span>
              </label>
              <textarea
                className="input"
                rows={2}
                maxLength={500}
                placeholder="Например: попросил сменить"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-terracotta">{error}</p>}

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={close}
                className="btn-secondary"
                disabled={pending}
              >
                Отмена
              </button>
              <Button onClick={submit} disabled={pending || !selected}>
                {pending ? "Меняю…" : "Подтвердить"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
