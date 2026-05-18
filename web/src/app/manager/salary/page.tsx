import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import {
  getAllSalariesByHalfMonth,
  getSchoolSettings,
} from "@/lib/repos/admin";
import { SalaryClient } from "./salary-client";

export const metadata = { title: "Зарплата · Руководитель" };
export const dynamic = "force-dynamic";

export default async function ManagerSalaryPage() {
  // Доступ: руководитель (head), админ, директор. Куратор/менеджер не видят зарплат.
  await requireRole("head", "admin");

  // Один тяжёлый запрос — все 12 месяцев × 2 половинки. Кэш 5 мин.
  // Дальше клиентский компонент переключает периоды без серверных round-trip'ов.
  const [data, settings] = await Promise.all([
    getAllSalariesByHalfMonth(12),
    getSchoolSettings(),
  ]);

  return (
    <AppShell title="Зарплата">
      <div className="mb-3 flex items-center justify-end">
        <Link
          href="/manager/settings"
          className="text-sm text-olive hover:text-near-black no-underline hover:underline"
        >
          Настроить ставки →
        </Link>
      </div>
      <SalaryClient
        data={data}
        rates={{
          rate_conducted: settings.rate_conducted,
          rate_penalty: settings.rate_penalty,
        }}
      />
    </AppShell>
  );
}
