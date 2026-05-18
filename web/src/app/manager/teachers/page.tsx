import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { Chip } from "@/components/ui/chip";
import { listTeachersForCurator } from "@/lib/repos/teachers";

export const metadata = { title: "Учителя — Madinah" };
export const dynamic = "force-dynamic";

const STATUS_LABEL = {
  active: "активный",
  paused: "пауза",
  fired: "уволен",
  archived: "архив",
} as const;

export default async function TeachersPage() {
  await requireRole("manager", "curator", "head", "admin");
  const teachers = await listTeachersForCurator();

  return (
    <AppShell title="Учителя">
      <div className="flex flex-wrap gap-2 mb-4">
        <Link
          href="/manager/teachers/quality"
          className="inline-flex items-center gap-2 bg-ivory text-charcoal font-medium rounded-[12px] px-4 py-[10px] no-underline"
          style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="20" x2="20" y2="20" />
            <rect x="6" y="10" width="3" height="7" />
            <rect x="11" y="6" width="3" height="11" />
            <rect x="16" y="13" width="3" height="4" />
          </svg>
          <span>Качество</span>
        </Link>
        <Link
          href="/manager/teachers/match"
          className="inline-flex items-center gap-2 bg-terracotta text-ivory font-medium rounded-[12px] px-4 py-[10px] no-underline"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span>График учителей и свободные слоты</span>
        </Link>
        <Link
          href="/manager/teachers/new"
          className="inline-flex items-center gap-2 bg-ivory text-charcoal font-medium rounded-[12px] px-4 py-[10px] no-underline"
          style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Добавить учителя</span>
        </Link>
        <Link
          href="/manager/credentials"
          className="inline-flex items-center gap-2 bg-ivory text-charcoal font-medium rounded-[12px] px-4 py-[10px] no-underline"
          style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>Логины</span>
        </Link>
      </div>

      <p className="text-[13px] text-stone mb-3">{teachers.length} в школе</p>

      {teachers.length === 0 ? (
        <div
          className="bg-ivory rounded-[14px] py-10 text-center"
          style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
        >
          <p className="text-olive">Пока никого нет.</p>
        </div>
      ) : (
        <div
          className="bg-ivory rounded-[14px] px-4"
          style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
        >
          {teachers.map((t, i) => (
            <Link
              key={t.id}
              href={`/manager/teachers/${t.id}`}
              className={`grid grid-cols-[1fr_auto] items-center gap-3 py-[14px] no-underline text-near-black ${
                i > 0 ? "border-t border-border-cream" : ""
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[15px] font-medium truncate">{t.full_name}</span>
                  {t.status !== "active" && (
                    <Chip
                      tone={t.status === "fired" ? "bad" : "neutral"}
                      size="s"
                    >
                      {STATUS_LABEL[t.status as keyof typeof STATUS_LABEL] ?? t.status}
                    </Chip>
                  )}
                </div>
                <div className="text-[12px] text-olive mt-0.5 tabular-nums">
                  {t.active_students} активных · {t.total_lessons_30d} уроков за 30 дней
                  {t.user_phone && ` · ${t.user_phone}`}
                </div>
              </div>
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-stone" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
