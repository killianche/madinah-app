import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { findTeacherByUserId } from "@/lib/repos/teachers";
import { AppShell } from "@/components/app-shell";
import { sql } from "@/lib/db";
import { EditLessonForm } from "./form";

export const metadata = { title: "Редактировать урок — Madinah" };
export const dynamic = "force-dynamic";

export default async function EditLessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await requireAuth();
  const { id } = await params;

  const rows = await sql<
    Array<{
      id: string;
      student_id: string;
      teacher_id: string;
      lesson_date: Date;
      lesson_time: string | null;
      status: string;
      topic: string | null;
      notes: string | null;
      student_name: string;
      teacher_name: string;
    }>
  >`
    select l.id, l.student_id, l.teacher_id, l.lesson_date, l.lesson_time::text, l.status::text, l.topic, l.notes,
           s.full_name as student_name, t.full_name as teacher_name
    from lessons l
    join students s on s.id = l.student_id
    join teachers t on t.id = l.teacher_id
    where l.id = ${id} and l.deleted_at is null
    limit 1
  `;
  const lesson = rows[0];
  if (!lesson) notFound();

  // Доступ: учитель только своего урока, куратор/admin — любого
  const isPrivileged = ["curator", "head", "admin"].includes(auth.user.role);
  if (!isPrivileged) {
    if (auth.user.role !== "teacher") notFound();
    const t = await findTeacherByUserId(auth.user.id);
    if (!t || t.id !== lesson.teacher_id) notFound();
  }

  const dateIso =
    lesson.lesson_date instanceof Date
      ? lesson.lesson_date.toISOString().slice(0, 10)
      : String(lesson.lesson_date).slice(0, 10);

  // Для учителя: можно редактировать ТОЛЬКО последний урок с этим учеником.
  let isLastForTeacher = false;
  if (auth.user.role === "teacher") {
    const last = await sql<Array<{ id: string }>>`
      select id from lessons
      where teacher_id = ${lesson.teacher_id}
        and student_id = ${lesson.student_id}
        and deleted_at is null
      order by created_at desc, id desc
      limit 1
    `;
    isLastForTeacher = last[0]?.id === lesson.id;
  }
  const blockedForTeacher = auth.user.role === "teacher" && !isLastForTeacher;

  return (
    <AppShell
      title="Редактировать урок"
      back={{ href: `/teacher/student/${lesson.student_id}`, label: lesson.student_name }}
    >
      <div
        className="bg-ivory rounded-[14px] p-5 max-w-xl"
        style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
      >
        <p className="text-[12px] text-olive mb-4 tabular-nums">
          {lesson.student_name} · учитель: {lesson.teacher_name}
        </p>
        {blockedForTeacher ? (
          <div
            className="bg-parchment rounded-[12px] p-4 text-[13px] text-charcoal"
            style={{ boxShadow: "inset 0 0 0 1px rgba(201,100,66,0.35)" }}
          >
            <p className="font-medium mb-1">
              Этот урок не последний.
            </p>
            <p className="text-olive">
              Учитель может редактировать или удалять только свой последний добавленный урок.
              Если нужна правка более раннего — обратитесь к куратору.
            </p>
          </div>
        ) : (
          <EditLessonForm
            lessonId={lesson.id}
            studentId={lesson.student_id}
            canDelete={isPrivileged || isLastForTeacher}
            initial={{
              lesson_date: dateIso,
              lesson_time: (lesson.lesson_time ?? "").slice(0, 5),
              status: lesson.status,
              topic: lesson.topic ?? "",
              notes: lesson.notes ?? "",
            }}
          />
        )}
      </div>
    </AppShell>
  );
}
