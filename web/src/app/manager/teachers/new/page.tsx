import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { NewTeacherForm } from "./form";

export const metadata = { title: "Новый учитель — Madinah" };

export default async function NewTeacherPage() {
  await requireRole("curator", "head", "admin");
  return (
    <AppShell title="Новый учитель">
      <NewTeacherForm />
    </AppShell>
  );
}
