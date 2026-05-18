"use client";

import Link from "next/link";
import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Chip } from "@/components/ui/chip";
import {
  LESSON_STATUS_LABEL,
  STUDENT_STATUS_LABEL,
  type LessonStatus,
  type StudentStatus,
} from "@/lib/types";
import {
  markReviewAction,
  clearReviewAction,
  closeAttentionCaseAction,
} from "@/app/manager/attention/actions";

const STATUS_TONE: Record<StudentStatus, "good" | "warn" | "bad" | "neutral"> = {
  active: "good",
  paused: "warn",
  graduated: "neutral",
  dropped: "bad",
  closed: "neutral",
  archived: "neutral",
};

interface Row {
  student_id: string;
  student_name: string;
  phone: string | null;
  teacher_id: string | null;
  teacher_name: string | null;
  status: string;
  balance: number;
  attention_kind: "dropped" | "skipping" | "stale" | "graduated" | null;
  last_any_lesson_date: string | null;
  last_conducted_date: string | null;
  last_3_statuses: LessonStatus[] | null;
  days_since_last: number | null;
  review_state: "in_progress" | "resolved" | null;
  review_note: string | null;
  review_actor_name: string | null;
  review_updated_at: string | null;
  review_valid: boolean;
  bucket: "fresh" | "week" | "older";
}

type Tab = "new" | "in_progress";

const TAB_LABEL: Record<Tab, string> = {
  new: "Новые",
  in_progress: "В работе",
};

const BUCKET_LABEL: Record<Row["bucket"], string> = {
  fresh: "Свежие · ≤ 7 дней",
  week: "За 1–4 недели",
  older: "Давнее",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function daysText(days: number | null): string {
  if (days === null) return "";
  if (days === 0) return "сегодня";
  if (days === 1) return "вчера";
  return `${days} дн.`;
}

export function CategoryClient({
  kind,
  rows,
  activeTab,
  canEdit,
}: {
  kind: "dropped" | "skipping" | "stale" | "graduated";
  rows: Row[];
  activeTab: Tab;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [teacherFilter, setTeacherFilter] = useState<string>("");
  const [confirmCloseId, setConfirmCloseId] = useState<string | null>(null);

  const teachers = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (r.teacher_id && r.teacher_name) map.set(r.teacher_id, r.teacher_name);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = rows.filter((r) => {
    if (teacherFilter) {
      if (teacherFilter === "__none__" && r.teacher_id !== null) return false;
      if (teacherFilter !== "__none__" && r.teacher_id !== teacherFilter) return false;
    }
    if (activeTab === "new") return !r.review_state || !r.review_valid;
    if (activeTab === "in_progress") return r.review_state === "in_progress" && r.review_valid;
    return false;
  });

  const counts = {
    new: rows.filter((r) => !r.review_state || !r.review_valid).length,
    in_progress: rows.filter(
      (r) => r.review_state === "in_progress" && r.review_valid,
    ).length,
  };

  const buckets: Array<{ key: Row["bucket"]; rows: Row[] }> = [];
  for (const b of ["fresh", "week", "older"] as const) {
    const list = filtered.filter((r) => r.bucket === b);
    if (list.length > 0) buckets.push({ key: b, rows: list });
  }

  function takeInWork(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await markReviewAction({
        student_id: id,
        state: "in_progress",
        note: null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function reopen(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await clearReviewAction({ student_id: id });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function closeCase(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await closeAttentionCaseAction({
        student_id: id,
        note: null,
      });
      if (!res.ok) {
        setError(res.error);
        setConfirmCloseId(null);
        return;
      }
      setConfirmCloseId(null);
      router.refresh();
    });
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-[6px] overflow-x-auto pb-1 mb-3">
        {(["new", "in_progress"] as const).map((t) => {
          const active = activeTab === t;
          return (
            <Link
              key={t}
              href={`/manager/attention/${kind}?tab=${t}`}
              scroll={false}
              className={`inline-flex items-center gap-[6px] px-3 py-[7px] rounded-full text-[13px] font-medium whitespace-nowrap no-underline ${
                active ? "bg-near-black text-ivory" : "text-charcoal"
              }`}
              style={!active ? { boxShadow: "inset 0 0 0 1px #e8e6dc" } : {}}
            >
              {TAB_LABEL[t]}
              <span
                className={`text-[11px] px-[6px] py-[1px] rounded-full tabular-nums ${
                  active ? "bg-[rgba(250,249,245,0.18)]" : "bg-warm-sand"
                }`}
              >
                {counts[t]}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Teacher filter */}
      {teachers.length > 1 && (
        <div className="mb-3">
          <select
            value={teacherFilter}
            onChange={(e) => setTeacherFilter(e.target.value)}
            className="w-full bg-ivory text-charcoal text-[13px] rounded-[10px] px-3 py-2"
            style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
          >
            <option value="">Все учителя</option>
            <option value="__none__">— без учителя —</option>
            {teachers.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="mb-3">
          <Chip tone="bad" size="m">{error}</Chip>
        </div>
      )}

      {filtered.length === 0 ? (
        <div
          className="bg-ivory rounded-[14px] py-10 text-center"
          style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
        >
          <p className="text-olive">
            {activeTab === "new"
              ? "Все разобраны."
              : activeTab === "in_progress"
                ? "Нет в работе."
                : "Закрытых нет."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {buckets.map((b) => (
            <section key={b.key}>
              <div className="text-[11px] uppercase tracking-[0.6px] font-medium text-stone mb-2">
                {BUCKET_LABEL[b.key]} · {b.rows.length}
              </div>
              <div className="space-y-2">
                {b.rows.slice(0, 100).map((r) => (
                  <RowCard
                    key={r.student_id}
                    r={r}
                    canEdit={canEdit}
                    activeTab={activeTab}
                    pending={pending}
                    confirmCloseId={confirmCloseId}
                    onTake={takeInWork}
                    onReopen={reopen}
                    onAskClose={(id) => setConfirmCloseId(id)}
                    onCancelClose={() => setConfirmCloseId(null)}
                    onConfirmClose={closeCase}
                  />
                ))}
                {b.rows.length > 100 && (
                  <div className="py-2 text-center text-[12px] text-stone">
                    Показано 100 из {b.rows.length}
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function RowCard({
  r,
  canEdit,
  activeTab,
  pending,
  confirmCloseId,
  onTake,
  onReopen,
  onAskClose,
  onCancelClose,
  onConfirmClose,
}: {
  r: Row;
  canEdit: boolean;
  activeTab: Tab;
  pending: boolean;
  confirmCloseId: string | null;
  onTake: (id: string) => void;
  onReopen: (id: string) => void;
  onAskClose: (id: string) => void;
  onCancelClose: () => void;
  onConfirmClose: (id: string) => void;
}) {
  const isCritical =
    r.bucket === "fresh" &&
    (r.attention_kind === "dropped" || r.attention_kind === "skipping");
  const wasReviewedButStale =
    activeTab === "new" && r.review_state && !r.review_valid;

  return (
    <div
      className="rounded-[14px] overflow-hidden flex"
      style={{
        boxShadow: "inset 0 0 0 1px #f0eee6",
        backgroundColor: "var(--bg-ivory, #faf9f5)",
      }}
    >
      {/* Левая полоса приоритета */}
      <div
        className="w-1 shrink-0"
        style={{
          backgroundColor: isCritical
            ? "#b53333"
            : r.bucket === "fresh"
              ? "#c96442"
              : r.bucket === "week"
                ? "#c89c6a"
                : "transparent",
        }}
      />
      <div className="flex-1 p-3 bg-ivory">
        <Link
          href={`/teacher/student/${r.student_id}`}
          className="block no-underline text-near-black"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15px] font-medium truncate">{r.student_name}</span>
            <Chip tone={STATUS_TONE[r.status as StudentStatus] ?? "neutral"} size="s">
              {STUDENT_STATUS_LABEL[r.status as StudentStatus] ?? r.status}
            </Chip>
            {r.phone && (
              <span className="text-[12px] text-stone tabular-nums">{r.phone}</span>
            )}
          </div>
          <div className="text-[12px] text-olive mt-0.5 tabular-nums">
            {r.teacher_name ?? "без учителя"}
            {r.last_conducted_date
              ? ` · посл. провёл ${fmtDate(r.last_conducted_date)} (${daysText(r.days_since_last)})`
              : " · не было проведённых уроков"}
          </div>
          {r.last_3_statuses && r.attention_kind === "skipping" && (
            <div className="text-[12px] text-stone mt-1">
              {r.last_3_statuses.map((s) => LESSON_STATUS_LABEL[s]).join(" · ")}
            </div>
          )}
        </Link>

        {/* Заметка от куратора */}
        {r.review_state && r.review_valid && r.review_note && (
          <div className="mt-2 px-3 py-2 rounded-[8px] bg-warm-sand text-[13px]">
            <div className="text-[10px] uppercase tracking-[0.6px] font-medium text-stone">
              {r.review_actor_name ?? "куратор"} · {fmtDate(r.review_updated_at)}
            </div>
            <div className="mt-0.5">{r.review_note}</div>
          </div>
        )}

        {wasReviewedButStale && (
          <div className="mt-2 text-[12px] text-stone">
            Была отметка «{r.review_state === "resolved" ? "решено" : "в работе"}» — ситуация изменилась.
          </div>
        )}

        {canEdit && (
          <div className="mt-3 flex flex-wrap gap-2">
            {activeTab === "new" && (
              <button
                type="button"
                disabled={pending}
                onClick={() => onTake(r.student_id)}
                className="text-[13px] font-medium px-3 py-2 rounded-[10px] bg-terracotta text-ivory disabled:opacity-40"
              >
                {pending ? "Беру…" : "Взял в работу"}
              </button>
            )}
            {activeTab === "in_progress" && (
              <>
                {confirmCloseId === r.student_id ? (
                  <>
                    <span className="text-[12px] text-stone self-center">
                      Закрыть кейс? Ученик получит статус «Закрыт» и больше не будет появляться во «Внимании».
                    </span>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onConfirmClose(r.student_id)}
                      className="text-[13px] font-medium px-3 py-2 rounded-[10px] bg-crimson text-ivory disabled:opacity-40"
                    >
                      {pending ? "Закрываю…" : "Да, закрыть"}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={onCancelClose}
                      className="text-[13px] text-stone px-3 py-2"
                    >
                      Нет
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onAskClose(r.student_id)}
                      className="text-[13px] font-medium px-3 py-2 rounded-[10px] bg-ivory text-crimson disabled:opacity-40"
                      style={{ boxShadow: "inset 0 0 0 1px rgba(181,51,51,0.35)" }}
                    >
                      Закрыть кейс
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onReopen(r.student_id)}
                      className="text-[13px] font-medium px-3 py-2 rounded-[10px] bg-ivory text-stone disabled:opacity-40"
                      style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
                    >
                      Вернуть в новые
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
