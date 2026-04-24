import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { listAllStudentsFull } from "@/lib/repos/students";
import { ManagerStudentsList } from "./manager-list-client";

export const metadata = { title: "Ученики — Madinah" };
export const dynamic = "force-dynamic";

export default async function ManagerHome() {
  await requireRole("manager", "curator", "head", "director", "admin");
  const students = await listAllStudentsFull();

  return (
    <AppShell title="Ученики">
      <div className="flex flex-wrap gap-2 mb-5">
        <Link
          href="/manager/students/new"
          className="inline-flex items-center gap-2 bg-terracotta text-ivory font-medium rounded-[12px] px-4 py-[10px] no-underline"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Создать ученика</span>
        </Link>
        <Link
          href="/manager/problems"
          className="inline-flex items-center px-4 py-[10px] rounded-[12px] font-medium text-charcoal no-underline"
          style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
        >
          Проблемные
        </Link>
        <Link
          href="/manager/attention"
          className="inline-flex items-center px-4 py-[10px] rounded-[12px] font-medium text-charcoal no-underline"
          style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
        >
          Внимание
        </Link>
      </div>

      <ManagerStudentsList students={students.map((s) => ({
        id: s.id,
        full_name: s.full_name,
        phone: s.phone,
        balance: s.balance,
        is_charity: s.is_charity,
        status: s.status,
        teacher_name: s.teacher_name,
      }))} />
    </AppShell>
  );
}
