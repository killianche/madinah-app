import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { Chip } from "@/components/ui/chip";
import {
  getAttentionDashboardSummary,
  listUrgentAttention,
} from "@/lib/repos/attention";

export const metadata = { title: "Внимание — Madinah" };
export const dynamic = "force-dynamic";

const CATEGORY_META: Record<
  string,
  { title: string; description: string; tone: "bad" | "warn" | "amber" | "neutral" | "good" }
> = {
  dropped: {
    title: "Недавно бросили",
    description: "Статус «бросил», но последний урок ≤ 10 дней назад — свежие, шанс вернуть",
    tone: "bad",
  },
  no_first_lesson: {
    title: "Новые без первого урока",
    description: "Записаны 5+ дней назад, но ещё ни одного проведённого",
    tone: "warn",
  },
  skipping: {
    title: "3 пропуска подряд",
    description: "Последние 3 урока — штраф/отмена",
    tone: "warn",
  },
  low_balance: {
    title: "Низкий баланс",
    description: "Активные с балансом ≤ 0 — нужна оплата",
    tone: "bad",
  },
  stale: {
    title: "Серая зона · 7–30 дней",
    description: "Не приходят неделю и больше — ещё можно вернуть",
    tone: "amber",
  },
  problems: {
    title: "Проблемные",
    description: "Композитный score: пропуски + давность + баланс",
    tone: "warn",
  },
};

const ORDER: Array<keyof typeof CATEGORY_META> = [
  "dropped",
  "no_first_lesson",
  "skipping",
  "low_balance",
  "stale",
  "problems",
];

function fmtRelative(d: Date | null, days: number): string {
  if (!d) return "—";
  if (days === 0) return "сегодня";
  if (days === 1) return "вчера";
  if (days < 7) return `${days} дн.`;
  return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

const URGENT_LABEL: Record<string, string> = {
  dropped: "бросил",
  skipping: "3 пропуска",
  stale: "стал",
  graduated: "выпускник",
};

const PERIODS = [
  { id: "7", label: "7 дней", days: 7 },
  { id: "14", label: "14 дней", days: 14 },
  { id: "30", label: "30 дней", days: 30 },
] as const;

export default async function AttentionDashboard({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireRole("manager", "curator", "head", "admin");
  const sp = await searchParams;
  const periodId = PERIODS.find((p) => p.id === sp.period)?.id ?? "30";
  const days = PERIODS.find((p) => p.id === periodId)!.days;

  const [summary, urgent] = await Promise.all([
    getAttentionDashboardSummary(days),
    listUrgentAttention(),
  ]);

  const summaryByKind = new Map<string, (typeof summary)[number]>(
    summary.map((s) => [s.kind, s]),
  );
  const totalAcrossKinds = summary
    .filter((s) => s.kind !== "low_balance" && s.kind !== "problems")
    .reduce((acc, s) => acc + s.total, 0);

  return (
    <AppShell title="Внимание">
      {/* Period filter */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-[11px] uppercase tracking-[0.6px] font-medium text-stone">
          Окно последнего урока
        </span>
        <div className="flex gap-1.5">
          {PERIODS.map((p) => {
            const active = p.id === periodId;
            return (
              <Link
                key={p.id}
                href={`/manager/attention?period=${p.id}`}
                className={`text-[12px] px-2.5 py-1 rounded-full no-underline ${
                  active ? "bg-near-black text-ivory" : "bg-parchment text-charcoal"
                }`}
                style={active ? {} : { boxShadow: "inset 0 0 0 1px #e8e6dc" }}
              >
                {p.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Срочные — самое важное сверху */}
      {urgent.length > 0 && (
        <section className="mb-5">
          <div className="flex items-baseline justify-between mb-2">
            <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone">
              Срочные · {urgent.length}
            </div>
            <span className="text-[11px] text-stone">ушли за 3 дня</span>
          </div>
          <p className="text-[12px] text-olive mb-3">
            Свежие — шанс вернуть пока не остыли. Позвонить или написать.
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {urgent.map((u) => (
              <Link
                key={u.student_id}
                href={`/teacher/student/${u.student_id}`}
                className="bg-ivory rounded-[14px] p-3 no-underline text-near-black min-w-[220px] max-w-[260px] shrink-0"
                style={{ boxShadow: "inset 0 0 0 1px rgba(181,51,51,0.45)" }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-crimson shrink-0" />
                  <span className="text-[11px] uppercase tracking-[0.6px] font-medium text-crimson">
                    {URGENT_LABEL[u.attention_kind] ?? u.attention_kind}
                  </span>
                </div>
                <div className="text-[15px] font-medium truncate">{u.student_name}</div>
                <div className="text-[12px] text-olive mt-1 tabular-nums truncate">
                  {u.teacher_name ?? "без учителя"}
                  {u.phone ? ` · ${u.phone}` : ""}
                </div>
                <div className="text-[12px] text-stone tabular-nums mt-0.5">
                  посл. провёл {fmtRelative(u.last_lesson_date, u.days_since_last_lesson)}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Категории */}
      <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone mb-2">
        Категории
      </div>
      <div className="grid gap-2">
        {ORDER.map((kind) => {
          const s = summaryByKind.get(kind);
          if (!s) return null;
          const meta = CATEGORY_META[kind]!;
          const isEmpty = s.total === 0;
          return (
            <Link
              key={kind}
              href={`/manager/attention/${kind}`}
              className={`block bg-ivory rounded-[14px] p-4 no-underline text-near-black ${
                isEmpty ? "opacity-60" : ""
              }`}
              style={{
                boxShadow:
                  meta.tone === "bad" && !isEmpty
                    ? "inset 0 0 0 1px rgba(181,51,51,0.35)"
                    : meta.tone === "warn" && !isEmpty
                      ? "inset 0 0 0 1px rgba(201,100,66,0.35)"
                      : "inset 0 0 0 1px #f0eee6",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        meta.tone === "bad"
                          ? "bg-crimson"
                          : meta.tone === "warn"
                            ? "bg-terracotta"
                            : meta.tone === "amber"
                              ? "bg-[#c89c6a]"
                              : meta.tone === "good"
                                ? "bg-moss"
                                : "bg-stone"
                      }`}
                    />
                    <span className="text-[15px] font-medium">{meta.title}</span>
                  </div>
                  <p className="text-[12px] text-olive mt-1">{meta.description}</p>
                  {(s.in_progress_count > 0 || s.resolved_count > 0) && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {s.new_count > 0 && (
                        <Chip tone="warn" size="s">
                          новых {s.new_count}
                        </Chip>
                      )}
                      {s.in_progress_count > 0 && (
                        <Chip tone="neutral" size="s">
                          в работе {s.in_progress_count}
                        </Chip>
                      )}
                      {s.resolved_count > 0 && (
                        <Chip tone="good" size="s">
                          закрыто {s.resolved_count}
                        </Chip>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div
                    className={`font-serif text-[28px] font-medium tabular-nums leading-none ${
                      isEmpty ? "text-stone" : ""
                    }`}
                  >
                    {s.total}
                  </div>
                  <svg
                    viewBox="0 0 24 24"
                    className="w-4 h-4 text-stone ml-auto mt-2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {totalAcrossKinds === 0 && (
        <p className="text-[12px] text-stone mt-3 text-center">
          Сегодня всё под контролем.
        </p>
      )}

      <p className="text-[11px] text-stone mt-4 leading-[1.5]">
        Категории могут пересекаться: один и тот же ученик может попасть и в «3 пропуска»,
        и в «низкий баланс», и в «проблемные». Это не дубликаты — это разные углы зрения.
      </p>
    </AppShell>
  );
}
