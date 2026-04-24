import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware на уровне Next — проверяет только наличие куки.
 * Реальная валидация сессии в БД происходит в requireAuth() внутри Server Components
 * (middleware в Next 15 работает в Edge runtime, а наш postgres-клиент — Node).
 */
const PUBLIC_PATHS = ["/login", "/api/health", "/_next", "/favicon.ico"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // пропускаем публичные
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = req.cookies.get("madinah_session")?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // всё кроме статики и api-health
    "/((?!_next/static|_next/image|favicon.ico|api/health).*)",
  ],
};
