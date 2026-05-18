import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/version";

// Без кэша, чтобы клиент всегда видел актуальную версию контейнера.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export function GET() {
  return NextResponse.json(
    { version: APP_VERSION },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    },
  );
}
