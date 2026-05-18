import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { Chip } from "@/components/ui/chip";
import {
  listAttentionByKind,
  listLowBalance,
  listProblems,
  listNoFirstLesson,
  type CategoryRow,
} from "@/lib/repos/attention";
import type { AttentionKind } from "@/lib/repos/students";
import { CategoryClient } from "./category-client";

export const dynamic = "force-dynamic";

const TITLE_BY_KIND: Record<string, string> = {
  dropped: "Недавно бросили",
  skipping: "3 пропуска подряд",
  stale: "Серая зона · 7–30 дней",
  graduated: "Выпускники",
  low_balance: "Низкий баланс",
  problems: "Проблемные",
  no_first_lesson: "Новые без первого урока",
};

const ALLOWED = [
  "dropped",
  "skipping",
  "stale",
  "graduated",
  "low_balance",
  "problems",
  "no_first_lesson",
] as const;
type Kind = (typeof ALLOWED)[number];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  const { kind } = await params;
  const title = TITLE_BY_KIND[kind] ?? "Внимание";
  return { title: `${title} — Madinah` };
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function daysAgoText(days: number | null): string {
  if (days === null) return "";
  if (days === 0) return "сегодня";
  if (days === 1) return "вчера";
  return `${days} дн.`;
}

function serializeRow(r: CategoryRow) {
  return {
    student_id: r.student_id,
    student_name: r.student_name,
    phone: r.phone,
    teacher_id: r.teacher_id,
    teacher_name: r.teacher_name,
    status: r.status,
    balance: r.balance,
    attention_kind: r.attention_kind,
    last_any_lesson_date: r.last_any_lesson_date
      ? r.last_any_lesson_date.toISOString()
      : null,
    last_conducted_date: r.last_conducted_date
      ? r.last_conducted_date.toISOString()
      : null,
    last_3_statuses: r.last_3_statuses,
    days_since_last: r.days_since_last,
    review_state: r.review_state,
    review_note: r.review_note,
    review_actor_name: r.review_actor_name,
    review_updated_at: r.review_updated_at
      ? r.review_updated_at.toISOString()
      : null,
    review_valid: r.review_valid,
    bucket: r.bucket,
  };
}

function Empty() {
  return (
    <div
      className="bg-ivory rounded-[14px] py-10 text-center"
      style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
    >
      <p className="text-olive">В этой категории чисто.</p>
    </div>
  );
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { user } = await requireRole(
    "manager",
    "curator",
    "head",
    "admin",
  );
  const { kind } = await params;
  const sp = await searchParams;
  if (!(ALLOWED as readonly string[]).includes(kind)) notFound();
  const k = kind as Kind;

  const canEdit = ["curator", "head", "admin"].includes(user.role);

  if (k === "low_balance") {
    const rows = await listLowBalance();
    return (
      <AppShell
        title="Низкий баланс"
        back={{ href: "/manager/attention", label: "Внимание" }}
      >
        <p className="text-[13px] text-olive mb-3">
          Активные с балансом ≤ 0 — нужно напомнить пополнить.
        </p>
        {rows.length === 0 ? (
          <Empty />
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <Link
                key={r.student_id}
                href={`/teacher/student/${r.student_id}`}
                className="block bg-ivory rounded-[14px] p-3 no-underline text-near-black"
                style={{ boxShadow: "inset 0 0 0 1px rgba(181,51,51,0.35)" }}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[15px] font-medium truncate">{r.student_name}</span>
                      {r.phone && (
                        <span className="text-[12px] text-stone tabular-nums">{r.phone}</span>
                      )}
                    </div>
                    <div className="text-[12px] text-olive mt-0.5 tabular-nums">
                      {r.teacher_name ?? "без учителя"}
                      {r.last_any_lesson_date
                        ? ` · посл. ${fmtDate(r.last_any_lesson_date)} (${daysAgoText(r.days_since_last)})`
                        : " · ещё не было уроков"}
                    </div>
                  </div>
                  <div className="font-serif text-[20px] font-medium tabular-nums leading-none text-crimson">
                    {r.balance}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </AppShell>
    );
  }

  if (k === "problems") {
    const rows = await listProblems();
    return (
      <AppShell
        title="Проблемные"
        back={{ href: "/manager/attention", label: "Внимание" }}
      >
        <p className="text-[13px] text-olive mb-3">
          Композитный score: давность × 0.3 + отмены × 0.5 + (баланс &lt; 5) × 2. Чем выше — тем критичнее.
        </p>
        {rows.length === 0 ? (
          <Empty />
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <Link
                key={r.student_id}
                href={`/teacher/student/${r.student_id}`}
                className="block bg-ivory rounded-[14px] p-3 no-underline text-near-black"
                style={{
                  boxShadow:
                    r.score >= 10
                      ? "inset 0 0 0 1px rgba(181,51,51,0.35)"
                      : r.score >= 5
                        ? "inset 0 0 0 1px rgba(201,100,66,0.35)"
                        : "inset 0 0 0 1px #f0eee6",
                }}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[15px] font-medium truncate">{r.student_name}</span>
                      {r.is_charity && <Chip tone="neutral" size="s">благ.</Chip>}
                      {r.phone && (
                        <span className="text-[12px] text-stone tabular-nums">{r.phone}</span>
                      )}
                    </div>
                    <div className="text-[12px] text-olive mt-1 tabular-nums">
                      {r.teacher_name ?? "без учителя"}
                      {" · "}баланс {r.balance}
                      {r.days_since_last !== null
                        ? ` · ${r.days_since_last} дн. без урока`
                        : " · нет уроков"}
                      {r.cancellations_30d > 0
                        ? ` · ${r.cancellations_30d} отмен за 30д`
                        : ""}
                    </div>
                  </div>
                  <div className="font-serif text-[18px] font-medium tabular-nums leading-none text-terracotta">
                    {r.score.toFixed(1)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </AppShell>
    );
  }

  if (k === "no_first_lesson") {
    const rows = await listNoFirstLesson();
    return (
      <AppShell
        title="Новые без первого урока"
        back={{ href: "/manager/attention", label: "Внимание" }}
      >
        <p className="text-[13px] text-olive mb-3">
          Записаны 5+ дней назад, но ни одного проведённого урока. Свяжитесь — записать на первый.
        </p>
        {rows.length === 0 ? (
          <Empty />
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <Link
                key={r.student_id}
                href={`/teacher/student/${r.student_id}`}
                className="block bg-ivory rounded-[14px] p-3 no-underline text-near-black"
                style={{ boxShadow: "inset 0 0 0 1px rgba(201,156,106,0.45)" }}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[15px] font-medium truncate">{r.student_name}</span>
                      {r.phone && (
                        <span className="text-[12px] text-stone tabular-nums">{r.phone}</span>
                      )}
                    </div>
                    <div className="text-[12px] text-olive mt-0.5 tabular-nums">
                      {r.teacher_name ?? "без учителя"}
                      {r.days_since_last !== null
                        ? ` · в системе ${r.days_since_last} дн.`
                        : ""}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </AppShell>
    );
  }

  // attention_kind: dropped/skipping/stale/graduated
  const allRows = await listAttentionByKind(k as AttentionKind);
  const tab = (["new", "in_progress"] as const).includes(
    sp.tab as "new" | "in_progress",
  )
    ? (sp.tab as "new" | "in_progress")
    : "new";

  return (
    <AppShell
      title={TITLE_BY_KIND[k]!}
      back={{ href: "/manager/attention", label: "Внимание" }}
    >
      <CategoryClient
        kind={k}
        rows={allRows.map((r) => serializeRow(r))}
        activeTab={tab}
        canEdit={canEdit}
      />
    </AppShell>
  );
}
