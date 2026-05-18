import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { checkSalesToken } from "../_helpers";
import {
  listNotificationsForUser,
  countUnreadForUser,
  markAllReadForUser,
} from "@/lib/repos/notifications";

export const dynamic = "force-dynamic";

/**
 * GET /api/integrations/sales/notifications?sales_user=<uuid>
 * Возвращает уведомления для менеджера Sales (по маппингу sales_user_id → quran user).
 *
 * POST с body { sales_user, action: "mark_all_read" } — помечает прочитанным.
 */
async function resolveQuranUserId(salesUser: string): Promise<string | null> {
  const rows = await sql<Array<{ id: string }>>`
    select id from users where sales_user_id = ${salesUser} limit 1
  `;
  return rows[0]?.id ?? null;
}

export async function GET(req: NextRequest) {
  const auth = checkSalesToken(req);
  if (auth) return auth;
  const salesUser = req.nextUrl.searchParams.get("sales_user");
  if (!salesUser) return NextResponse.json({ error: "sales_user required" }, { status: 400 });
  const quranUserId = await resolveQuranUserId(salesUser);
  if (!quranUserId) return NextResponse.json({ error: "manager not mapped" }, { status: 422 });

  const [items, unread] = await Promise.all([
    listNotificationsForUser(quranUserId, 100),
    countUnreadForUser(quranUserId),
  ]);
  return NextResponse.json({
    unread,
    items: items.map((i) => ({
      id: i.id,
      kind: i.kind,
      payload: i.payload,
      read_at: i.read_at,
      created_at: i.created_at,
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = checkSalesToken(req);
  if (auth) return auth;
  let body: { sales_user?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.sales_user) return NextResponse.json({ error: "sales_user required" }, { status: 400 });
  if (body.action !== "mark_all_read") {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
  const quranUserId = await resolveQuranUserId(body.sales_user);
  if (!quranUserId) return NextResponse.json({ error: "manager not mapped" }, { status: 422 });
  await markAllReadForUser(quranUserId);
  return NextResponse.json({ ok: true });
}
