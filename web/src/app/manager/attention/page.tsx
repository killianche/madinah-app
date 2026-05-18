import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { listStudentsNeedingAttention } from "@/lib/repos/students";
import { LESSON_STATUS_LABEL } from "@/lib/types";

export const metadata = { title: "Требует внимания — Madinah" };

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function daysAgo(d: Date | null): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

export default async function AttentionPage() {
  await requireRole("manager", "curator", "head", "admin", "director");
  const rows = await listStudentsNeedingAttention();

  const dropped = rows.filter((r) => r.attention_kind === "dropped");
  const skipping = rows.filter((r) => r.attention_kind === "skipping");
  const stale = rows.filter((r) => r.attention_kind === "stale");
  const graduated = rows.filter((r) => r.attention_kind === "graduated");

  return (
    <AppShell
      title="Требует внимания"
      back={{ href: "/manager", label: "Ученики" }}
    >
      <p className="text-sm text-olive-gray mb-6">
        Ученики в «серой зоне» и бросившие. Сигнал учителю или куратору разобраться.
      </p>

      {rows.length === 0 && (
        <div className="card text-center py-10 text-olive-gray">
          Все в порядке — сигналов нет.
        </div>
      )}

      {dropped.length > 0 && (
        <Section title={`Бросил · ${dropped.length}`} variant="terracotta">
          {dropped.map((r) => (
            <Row key={r.student_id} r={r} />
          ))}
        </Section>
      )}

      {skipping.length > 0 && (
        <Section title={`3 пропуска подряд · ${skipping.length}`} variant="warning">
          {skipping.map((r) => (
            <Row key={r.student_id} r={r} />
          ))}
        </Section>
      )}

      {stale.length > 0 && (
        <Section title={`Давно не было урока (10+ дней) · ${stale.length}`} variant="neutral">
          {stale.map((r) => (
            <Row key={r.student_id} r={r} />
          ))}
        </Section>
      )}

      {graduated.length > 0 && (
        <Section title={`Выпускники · ${graduated.length}`} variant="neutral">
          {graduated.map((r) => (
            <Row key={r.student_id} r={r} />
          ))}
        </Section>
      )}
    </AppShell>
  );
}

function Section({
  title,
  variant,
  children,
}: {
  title: string;
  variant: "terracotta" | "warning" | "neutral";
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Badge variant={variant}>{title}</Badge>
      </div>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}

function Row({
  r,
}: {
  r: Awaited<ReturnType<typeof listStudentsNeedingAttention>>[number];
}) {
  const last = r.last_any_lesson_date;
  const lastConducted = r.last_conducted_date;
  const da = daysAgo(last);
  return (
    <li className="bg-ivory rounded-md shadow-ring p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/teacher/student/${r.student_id}`}
            className="font-medium no-underline hover:text-terracotta"
          >
            {r.student_name}
          </Link>
          <div className="text-xs text-olive-gray mt-1">
            {r.teacher_name ?? "без учителя"}
            {r.phone ? ` · ${r.phone}` : ""}
          </div>
          <div className="text-xs text-olive-gray mt-1 flex gap-x-3 flex-wrap">
            <span>Последний урок: {fmtDate(last)}{da !== null ? ` (${da} дн.)` : ""}</span>
            {lastConducted && lastConducted !== last && (
              <span>Проведённый: {fmtDate(lastConducted)}</span>
            )}
            {r.last_3_statuses && r.attention_kind === "skipping" && (
              <span>
                Последние 3:{" "}
                {r.last_3_statuses
                  .map((s) => LESSON_STATUS_LABEL[s])
                  .join(" · ")}
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
