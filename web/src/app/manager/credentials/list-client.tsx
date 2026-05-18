"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Chip } from "@/components/ui/chip";
import { resetPasswordAction } from "./actions";

interface Row {
  user_id: string;
  teacher_id: string | null;
  full_name: string;
  login: string | null;
  phone: string | null;
  password_plain: string | null;
  is_active: boolean;
  teacher_status: string | null;
}

function genPassword(len = 10): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz";
  let out = "";
  for (let i = 0; i < len; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

export function CredentialsList({ rows }: { rows: Row[] }) {
  const [search, setSearch] = useState("");
  const filtered = rows.filter((r) =>
    !search.trim()
      ? true
      : `${r.full_name} ${r.login ?? ""} ${r.phone ?? ""}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
  );
  return (
    <div className="space-y-3">
      <input
        type="search"
        placeholder="Поиск по имени, логину, телефону"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-ivory rounded-[12px] px-4 py-2.5 text-[14px] outline-none"
        style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
      />
      <p className="text-[12px] text-stone tabular-nums">
        {filtered.length} {filtered.length === rows.length ? "учителей" : `из ${rows.length}`}
      </p>
      <div
        className="bg-ivory rounded-[14px] px-4"
        style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
      >
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-olive text-[13px]">
            Никого не нашлось
          </div>
        ) : (
          filtered.map((r, i) => (
            <CredRow key={r.user_id} row={r} divider={i > 0} />
          ))
        )}
      </div>
    </div>
  );
}

function CredRow({ row, divider }: { row: Row; divider: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [resetting, setResetting] = useState(false);
  const [newPwd, setNewPwd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  function copy(text: string) {
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  function startReset() {
    setNewPwd(genPassword(10));
    setError(null);
    setResetting(true);
  }

  function submitReset() {
    if (newPwd.length < 6) {
      setError("Минимум 6 символов");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await resetPasswordAction({
        user_id: row.user_id,
        password: newPwd,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResetting(false);
      router.refresh();
    });
  }

  return (
    <div className={`py-[14px] ${divider ? "border-t border-border-cream" : ""}`}>
      <div className="grid grid-cols-[1fr_auto] gap-3 items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15px] font-medium truncate">{row.full_name}</span>
            {!row.is_active && <Chip tone="bad" size="s">деактивирован</Chip>}
            {row.teacher_status === "paused" && <Chip tone="amber" size="s">пауза</Chip>}
            {row.teacher_status === "fired" && <Chip tone="bad" size="s">уволен</Chip>}
          </div>
          <div className="text-[12px] text-olive mt-1 tabular-nums flex flex-wrap gap-x-3 gap-y-0.5">
            {row.login && (
              <span>
                логин:{" "}
                <button
                  type="button"
                  onClick={() => copy(row.login!)}
                  className="font-mono text-near-black underline-offset-2 hover:underline"
                >
                  {row.login}
                </button>
              </span>
            )}
            {row.phone && (
              <span>
                телефон:{" "}
                <button
                  type="button"
                  onClick={() => copy(row.phone!)}
                  className="font-mono text-near-black underline-offset-2 hover:underline"
                >
                  {row.phone}
                </button>
              </span>
            )}
          </div>
          <div className="text-[12px] text-olive mt-1.5">
            {row.password_plain ? (
              revealed ? (
                <span className="font-mono text-near-black select-all">
                  {row.password_plain}{" "}
                  <button
                    type="button"
                    onClick={() => copy(row.password_plain!)}
                    className="text-[11px] text-stone hover:text-near-black ml-2"
                  >
                    скопировать
                  </button>
                  <button
                    type="button"
                    onClick={() => setRevealed(false)}
                    className="text-[11px] text-stone hover:text-near-black ml-2"
                  >
                    скрыть
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setRevealed(true)}
                  className="text-[12px] text-charcoal underline-offset-2 hover:underline"
                >
                  показать пароль
                </button>
              )
            ) : (
              <span className="text-stone">пароль не сохранён — сбросьте, чтобы задать новый</span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1.5 items-end">
          {!resetting && (
            <button
              type="button"
              onClick={startReset}
              className="text-[12px] font-medium text-charcoal px-3 py-1.5 rounded-[10px] bg-ivory"
              style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
            >
              Сбросить пароль
            </button>
          )}
        </div>
      </div>

      {resetting && (
        <div
          className="mt-3 p-3 rounded-[10px]"
          style={{ boxShadow: "inset 0 0 0 1px rgba(201,100,66,0.45)" }}
        >
          <div className="text-[12px] uppercase tracking-[0.6px] font-medium text-stone mb-2">
            Новый пароль
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <input
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              className="flex-1 min-w-[160px] font-mono text-[14px] px-3 py-2 rounded-[8px] bg-ivory tabular-nums"
              style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setNewPwd(genPassword(10))}
              className="text-[12px] font-medium text-charcoal px-3 py-2 rounded-[10px] bg-ivory"
              style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
            >
              Сгенерировать
            </button>
          </div>
          {error && (
            <div className="mt-2">
              <Chip tone="bad" size="s">{error}</Chip>
            </div>
          )}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={submitReset}
              className="text-[13px] font-medium px-3 py-2 rounded-[10px] bg-terracotta text-ivory disabled:opacity-40"
            >
              {pending ? "Сохраняю…" : "Применить"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setResetting(false);
                setError(null);
              }}
              className="text-[13px] font-medium text-stone px-3 py-2 rounded-[10px] bg-ivory disabled:opacity-40"
              style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
            >
              Отмена
            </button>
          </div>
          <p className="text-[11px] text-stone mt-2">
            После применения старая сессия учителя будет завершена.
          </p>
        </div>
      )}
    </div>
  );
}
