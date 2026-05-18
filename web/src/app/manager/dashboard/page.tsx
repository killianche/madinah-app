import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { getAdminOverviewKPI } from "@/lib/repos/admin";

export const metadata = { title: "Обзор — Madinah" };
export const dynamic = "force-dynamic";

const RU = "ru-RU";
const fmt = (n: number) => Math.round(n).toLocaleString(RU);
const fmtRub = (n: number) =>
  n >= 10_000_000
    ? `${(n / 1_000_000).toFixed(1).replace(".", ",")} млн ₽`
    : `${Math.round(n).toLocaleString(RU)} ₽`;

function delta(curr: number, prev: number): { sign: 1 | -1 | 0; pct: number } {
  if (prev === 0) return { sign: curr > 0 ? 1 : 0, pct: 0 };
  const pct = ((curr - prev) / prev) * 100;
  return { sign: pct > 0 ? 1 : pct < 0 ? -1 : 0, pct: Math.abs(pct) };
}

export default async function DashboardPage() {
  const { user } = await requireRole("admin", "head");
  const canManageStaff = ["admin", "head"].includes(user.role);
  const isFullAdmin = user.role === "admin";
  const kpi = await getAdminOverviewKPI();
  const dLessons = delta(kpi.lessons_30d, kpi.prev_lessons_30d);
  const dPayroll = delta(kpi.payroll_30d, kpi.prev_payroll_30d);

  return (
    <AppShell title="Обзор">
      <p className="text-[12px] text-olive mb-4">
        Базовые показатели за последние 30 дней. Дельта — к предыдущим 30 дням.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <Kpi label="Активных учеников" value={fmt(kpi.active_students)} sub={`+${fmt(kpi.new_students_30d)} за 30д`} />
        <Kpi label="Активных учителей" value={fmt(kpi.active_teachers)} />

        <Kpi
          label="Уроков за 30д"
          value={fmt(kpi.lessons_30d)}
          sub={`${fmt(kpi.conducted_30d)} провёл · ${fmt(kpi.penalty_30d)} штраф`}
          delta={dLessons}
        />
        <Kpi
          label="ФОТ за 30д"
          value={fmtRub(kpi.payroll_30d)}
          sub={`посещ. ${kpi.attendance_pct.toFixed(1)}%`}
          delta={dPayroll}
        />

        <Kpi
          label="Посещаемость"
          value={`${kpi.attendance_pct.toFixed(1)}%`}
          sub="доля проведённых"
        />
        <Kpi label="Отменено за 30д" value={fmt(kpi.cancelled_30d)} sub="не оплачивается" />
      </div>

      {canManageStaff && (
        <>
          <div className="text-[12px] uppercase tracking-[0.8px] font-medium text-stone mt-6 mb-2">
            Управление
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ActionLink
              href="/manager/staff"
              title="Сотрудники"
              sub="создать, выключить"
            />
            <ActionLink
              href="/manager/credentials"
              title="Пароли учителей"
              sub="логины и пароли"
            />
            {isFullAdmin && (
              <ActionLink
                href="/manager/settings"
                title="Настройки"
                sub="ставки школы"
              />
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}

function ActionLink({ href, title, sub }: { href: string; title: string; sub: string }) {
  return (
    <Link
      href={href}
      className="block bg-ivory rounded-[14px] p-3.5 no-underline text-near-black"
      style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
    >
      <div
        className="font-medium text-[15px] text-near-black"
        style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
      >
        {title}
      </div>
      <div className="text-[11px] text-olive mt-0.5">{sub}</div>
    </Link>
  );
}

function Kpi({
  label,
  value,
  sub,
  delta,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: { sign: 1 | -1 | 0; pct: number };
}) {
  const deltaColor =
    delta?.sign === 1 ? "text-moss" : delta?.sign === -1 ? "text-crimson" : "text-stone";
  return (
    <div
      className="bg-ivory rounded-[14px] p-3.5"
      style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
    >
      <div className="text-[10px] uppercase tracking-[0.6px] font-medium text-stone mb-1.5">
        {label}
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <div
          className="font-medium text-[22px] leading-none tabular-nums text-near-black"
          style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
        >
          {value}
        </div>
        {delta && (
          <div className={`text-[12px] tabular-nums font-medium ${deltaColor}`}>
            {delta.sign > 0 ? "+" : delta.sign < 0 ? "−" : ""}
            {delta.pct.toFixed(0)}%
          </div>
        )}
      </div>
      {sub && <div className="text-[11px] text-olive mt-1.5 tabular-nums">{sub}</div>}
    </div>
  );
}
