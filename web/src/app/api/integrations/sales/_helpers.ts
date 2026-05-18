import { NextResponse, type NextRequest } from "next/server";

/** Проверяет Bearer-токен от Sales. Возвращает NextResponse 401 если не валиден. */
export function checkSalesToken(req: NextRequest): NextResponse | null {
  const expected = process.env.SALES_INTEGRATION_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "integration disabled" }, { status: 503 });
  }
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
