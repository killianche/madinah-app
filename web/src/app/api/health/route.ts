import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    const [row] = await sql<Array<{ ok: number }>>`select 1 as ok`;
    return NextResponse.json({ status: "ok", db: row?.ok === 1 });
  } catch {
    return NextResponse.json({ status: "error", db: false }, { status: 503 });
  }
}
