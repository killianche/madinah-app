import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { findTeacherByUserId } from "@/lib/repos/teachers";
import { getTeacherAvailability, getTeacherBusySlots } from "@/lib/repos/availability";
import { AvailabilityEditor } from "./editor-client";

export const metadata = { title: "Готов брать учеников — Madinah" };
export const dynamic = "force-dynamic";

export default async function AvailabilityPage() {
  const { user } = await requireRole("teacher");
  const teacher = await findTeacherByUserId(user.id);
  if (!teacher) notFound();

  const [data, busy] = await Promise.all([
    getTeacherAvailability(teacher.id),
    getTeacherBusySlots(teacher.id),
  ]);

  return (
    <AppShell title="Готов брать учеников">
      <AvailabilityEditor
        initialSlots={data.slots}
        initialMaxNewStudents={data.max_new_students}
        busySlots={busy}
      />
    </AppShell>
  );
}
