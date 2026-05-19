import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { listAllStudentsForManager, listUnassignedStudents } from "@/lib/repos/students";
import { findActiveTeachers } from "@/lib/repos/teachers";
import { ManagerStudentsList } from "./manager-list-client";

export const metadata = { title: "Ученики — Madinah" };
export const dynamic = "force-dynamic";

export default async function ManagerHome() {
  const { user } = await requireRole("manager", "curator", "head", "admin");
  const isManager = user.role === "manager";
  const [students, unassigned, teachers] = await Promise.all([
    listAllStudentsForManager(),
    isManager ? Promise.resolve([]) : listUnassignedStudents(),
    findActiveTeachers(),
  ]);

  return (
    <AppShell title="Ученики">
      {!isManager && unassigned.length > 0 && (
        <Link
          href="/manager/unassigned"
          className="flex items-center justify-between bg-ivory rounded-[14px] px-4 py-[14px] mb-3 no-underline text-near-black"
          style={{ boxShadow: "inset 0 0 0 1px rgba(201,100,66,0.45)" }}
        >
          <div>
            <div className="text-[10px] uppercase tracking-[0.6px] font-medium text-terracotta">
              Без учителя
            </div>
            <div className="text-[15px] font-medium mt-0.5 tabular-nums">
              {unassigned.length} {unassigned.length === 1 ? "ученик ждёт" : "учеников ждут"} назначения
            </div>
          </div>
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-terracotta" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      )}

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
        {!isManager && (
          <>
            <Link
              href="/manager/attention"
              className="inline-flex items-center px-4 py-[10px] rounded-[12px] font-medium text-charcoal no-underline"
              style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
            >
              Внимание
            </Link>
            <Link
              href="/manager/teachers"
              className="inline-flex items-center px-4 py-[10px] rounded-[12px] font-medium text-charcoal no-underline"
              style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
            >
              Учителя
            </Link>
          </>
        )}
      </div>

      <ManagerStudentsList
        teachers={teachers.map((t) => ({ id: t.id, full_name: t.full_name }))}
        currentUserId={isManager ? user.id : undefined}
        students={students.map((s) => ({
          id: s.id,
          full_name: s.full_name,
          phone: s.phone,
          balance: s.balance,
          is_charity: s.is_charity,
          status: s.status,
          teacher_id: s.teacher_id,
          teacher_name: s.teacher_name,
          enrolled_at: s.enrolled_at ? s.enrolled_at.toISOString() : null,
          last_lesson_date: s.last_lesson_date ? s.last_lesson_date.toISOString() : null,
          counted_lessons: s.counted_lessons ?? 0,
          created_by_user_id: s.created_by_user_id,
        }))}
      />
    </AppShell>
  );
}
