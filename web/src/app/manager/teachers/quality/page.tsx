import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { Chip } from "@/components/ui/chip";
import { listTeacherQuality } from "@/lib/repos/teachers";

export const metadata = { title: "Качество — Madinah" };
export const dynamic = "force-dynamic";

export default async function TeacherQualityPage() {
  await requireRole("manager", "curator", "head", "admin");
  const rows = await listTeacherQuality();

  // Метки: «слабые» = top 30% по risk_score
  const sorted = [...rows].sort((a, b) => b.risk_score - a.risk_score);
  const weakThreshold = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.3)]?.risk_score ?? 0 : 0;

  return (
    <AppShell title="Качество учителей">
      <p className="text-[13px] text-olive mb-3">
        Risk score за 30 дней: штраф ×2 + отмена учителя ×1.5 + отмена ученика ×0.5 +
        брошенные за 90 дн. ×3 + сейчас в attention ×2. Ниже — лучше.
      </p>

      {rows.length === 0 ? (
        <div
          className="bg-ivory rounded-[14px] py-10 text-center"
          style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
        >
          <p className="text-olive">Нет данных.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const weak = r.risk_score >= weakThreshold && r.risk_score > 0;
            const noActivity = r.total_lessons_30d === 0;
            return (
              <Link
                key={r.teacher_id}
                href={`/manager/teachers/${r.teacher_id}`}
                className="block bg-ivory rounded-[14px] p-3 no-underline text-near-black"
                style={{
                  boxShadow: weak
                    ? "inset 0 0 0 1px rgba(181,51,51,0.35)"
                    : "inset 0 0 0 1px #f0eee6",
                }}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="text-[15px] font-medium truncate">{r.full_name}</span>
                    {r.status === "paused" && (
                      <Chip tone="neutral" size="s">пауза</Chip>
                    )}
                    {weak && <Chip tone="bad" size="s">слабый</Chip>}
                    {noActivity && <Chip tone="neutral" size="s">нет активности</Chip>}
                  </div>
                  <div className="font-serif text-[18px] font-medium tabular-nums leading-none">
                    {r.risk_score.toFixed(1)}
                  </div>
                </div>
                <div className="text-[12px] text-olive mt-1 tabular-nums flex flex-wrap gap-x-3 gap-y-0.5">
                  <span>{r.active_students} активных</span>
                  <span className="text-stone">·</span>
                  <span>{r.conducted_30d} провёл</span>
                  {r.penalty_30d > 0 && (
                    <>
                      <span className="text-stone">·</span>
                      <span className="text-crimson">
                        штраф {r.penalty_30d} ({r.penalty_pct}%)
                      </span>
                    </>
                  )}
                  {(r.cancelled_by_teacher_30d + r.cancelled_by_student_30d) > 0 && (
                    <>
                      <span className="text-stone">·</span>
                      <span>
                        отмен {r.cancelled_by_teacher_30d + r.cancelled_by_student_30d} (
                        {r.cancel_pct}%)
                      </span>
                    </>
                  )}
                </div>
                <div className="text-[12px] text-olive mt-0.5 tabular-nums flex flex-wrap gap-x-3 gap-y-0.5">
                  {r.dropped_last_90d > 0 && (
                    <span className="text-crimson">
                      бросили за 90д: {r.dropped_last_90d}
                    </span>
                  )}
                  {r.attention_now > 0 && (
                    <>
                      {r.dropped_last_90d > 0 && <span className="text-stone">·</span>}
                      <span>в attention сейчас: {r.attention_now}</span>
                    </>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
