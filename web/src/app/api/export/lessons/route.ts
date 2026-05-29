import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// Экспорт всех уроков в CSV для Google Sheets (IMPORTDATA).
// Защита: секретный токен в query (?token=...), т.к. IMPORTDATA не шлёт заголовки.
export const dynamic = "force-dynamic";

const STATUS_RU: Record<string, string> = {
  conducted: "Проведён",
  penalty: "Штраф",
  cancelled_by_teacher: "Отмена (учитель)",
  cancelled_by_student: "Отмена (ученик)",
};

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
    return "\"" + s.replace(/\"/g, "\"\"") + "\"";
  }
  return s;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const expected = process.env.EXPORT_TOKEN;
  if (!expected || token !== expected) {
    return new NextResponse("forbidden", { status: 403 });
  }

  // Необязательный фильтр по датам ?from=YYYY-MM-DD&to=YYYY-MM-DD.
  // Нужен, т.к. Google IMPORTDATA не тянет весь объём (~41k строк) за раз.
  const fromRaw = req.nextUrl.searchParams.get("from");
  const toRaw = req.nextUrl.searchParams.get("to");
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const from = fromRaw && dateRe.test(fromRaw) ? fromRaw : null;
  const to = toRaw && dateRe.test(toRaw) ? toRaw : null;

  const rows = await sql<Array<{
    lesson_date: string;
    lesson_time: string | null;
    teacher: string;
    student: string;
    status: string;
    topic: string | null;
    duration_units: number;
  }>>`
    select
      to_char(l.lesson_date, 'YYYY-MM-DD') as lesson_date,
      to_char(l.lesson_time, 'HH24:MI') as lesson_time,
      t.full_name as teacher,
      s.full_name as student,
      l.status::text as status,
      coalesce(l.topic, '') as topic,
      l.duration_units
    from lessons l
    join teachers t on t.id = l.teacher_id
    join students s on s.id = l.student_id
    where l.deleted_at is null
      ${from ? sql`and l.lesson_date >= ${from}::date` : sql``}
      ${to ? sql`and l.lesson_date <= ${to}::date` : sql``}
    order by l.lesson_date desc, l.lesson_time desc nulls last
  `;

  const header = ["Дата", "Время", "Учитель", "Ученик", "Статус", "Тема", "Единиц"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([
      csvCell(r.lesson_date),
      csvCell(r.lesson_time ?? ""),
      csvCell(r.teacher),
      csvCell(r.student),
      csvCell(STATUS_RU[r.status] ?? r.status),
      csvCell(r.topic ?? ""),
      csvCell(r.duration_units),
    ].join(","));
  }
  const csv = lines.join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
