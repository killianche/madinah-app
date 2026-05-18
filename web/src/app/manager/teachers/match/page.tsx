import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { listTeachersAvailabilityForCurator } from "@/lib/repos/availability";
import { MatchClient } from "./match-client";

export const metadata = { title: "График учителей и свободные слоты — Madinah" };
export const dynamic = "force-dynamic";

export default async function MatchPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  await requireRole("curator", "head", "manager", "admin");
  const sp = await searchParams;
  const teachers = await listTeachersAvailabilityForCurator();

  return (
    <AppShell title="График и свободные слоты">
      <MatchClient
        teachers={teachers.map((t) => ({
          id: t.teacher_id,
          full_name: t.full_name,
          status: t.status,
          max_new_students: t.max_new_students,
          active_students: t.active_students,
          slots: t.slots,
        }))}
        studentId={sp.student}
      />
    </AppShell>
  );
}
