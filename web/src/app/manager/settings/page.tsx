import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { getSchoolSettings } from "@/lib/repos/admin";
import { GlobalRatesForm } from "./form";

export const metadata = { title: "Настройки — Madinah" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireRole("admin", "head");
  const settings = await getSchoolSettings();
  return (
    <AppShell title="Настройки">
      <p className="text-[12px] text-olive mb-4">
        Глобальные ставки оплаты учителей. Применяются ко всем учителям школы — индивидуальных
        переопределений нет (как было раньше — упрощено).
      </p>
      <div
        className="bg-ivory rounded-[14px] p-4"
        style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
      >
        <GlobalRatesForm
          initial={{
            rate_conducted: settings.rate_conducted,
            rate_penalty: settings.rate_penalty,
          }}
        />
      </div>
    </AppShell>
  );
}
