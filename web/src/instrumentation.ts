/**
 * Next.js instrumentation hook.
 * Если задан SENTRY_DSN в env — инициализируется Sentry.
 * Иначе — no-op, ошибки только в console/docker logs.
 *
 * Для подключения Sentry:
 *   cd web && npm install @sentry/nextjs
 *   Установить SENTRY_DSN в .env.production
 *   Раскомментировать import ниже
 */
export async function register() {
  if (!process.env.SENTRY_DSN) return;
  // const Sentry = await import("@sentry/nextjs");
  // Sentry.init({
  //   dsn: process.env.SENTRY_DSN,
  //   tracesSampleRate: 0.1,
  //   environment: process.env.NODE_ENV,
  // });
}

export function onRequestError(
  err: unknown,
  request: { path: string; method: string; headers: Record<string, string> },
) {
  console.error("[onRequestError]", request.method, request.path, err);
  // if (process.env.SENTRY_DSN) Sentry.captureRequestError(err, request);
}
