import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { checkSalesToken } from "../../_helpers";

export const dynamic = "force-dynamic";

/**
 * GET /api/integrations/sales/students/search?q=<query>
 * Поиск учеников Quran для autocomplete в Sales.
 * Алгоритм: цифры → телефон; буквы → trigram similarity.
 */
export async function GET(req: NextRequest) {
  const auth = checkSalesToken(req);
  if (auth) return auth;

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const digits = q.replace(/\D/g, "");
  // Последние 7 цифр — для матчинга разных форматов +7/8/без префикса.
  const phoneTail = digits.length >= 7 ? digits.slice(-7) : null;

  const rows = await sql<Array<{
    id: string;
    full_name: string;
    phone: string | null;
    whatsapp_phone: string | null;
    telegram_username: string | null;
    status: string;
    balance: number;
    teacher_name: string | null;
    last_lesson_date: Date | null;
    score: number;
  }>>`
    select s.id, s.full_name, s.phone, s.whatsapp_phone, s.telegram_username,
           s.status::text as status, s.balance::int as balance,
           t.full_name as teacher_name,
           (select max(lesson_date) from lessons
            where student_id = s.id and deleted_at is null) as last_lesson_date,
           greatest(
             coalesce(similarity(s.full_name, ${q}), 0)::float,
             case when ${phoneTail}::text is not null
                       and (regexp_replace(coalesce(s.full_name, ''), '\D', '', 'g') like '%' || ${phoneTail}::text
                            or regexp_replace(coalesce(s.phone, ''), '\D', '', 'g') like '%' || ${phoneTail}::text)
                  then 1.0::float else 0.0::float end
           ) as score
    from students s
    left join teachers t on t.id = s.teacher_id
    where s.deleted_at is null
      and (
        similarity(s.full_name, ${q}) > 0.25
        or (${phoneTail}::text is not null
            and (regexp_replace(coalesce(s.full_name, ''), '\D', '', 'g') like '%' || ${phoneTail}::text
                 or regexp_replace(coalesce(s.phone, ''), '\D', '', 'g') like '%' || ${phoneTail}::text))
      )
    order by score desc, s.full_name
    limit 10
  `;

  return NextResponse.json({
    results: rows.map((r) => ({
      id: r.id,
      full_name: r.full_name,
      phone: r.phone,
      whatsapp_phone: r.whatsapp_phone,
      telegram_username: r.telegram_username,
      status: r.status,
      balance: r.balance,
      teacher_name: r.teacher_name,
      last_lesson_date: r.last_lesson_date,
    })),
  });
}
