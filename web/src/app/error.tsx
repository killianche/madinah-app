"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Глобальный error boundary — ловит рантайм-ошибки на любом server/client component.
 * Показывает кнопку «На главную», чтобы юзер не застревал в сломанном экране
 * (особенно важно для PWA на главном экране — нет адресной строки чтоб исправить URL).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error boundary:", error);
  }, [error]);

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-parchment px-4"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <div className="w-full max-w-sm text-center">
        <h1
          className="font-medium text-[28px] leading-tight text-near-black"
          style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
        >
          Что-то пошло не так
        </h1>
        <p className="text-[13px] text-olive mt-2">
          Страница не открылась. Можно попробовать ещё раз или вернуться на главную.
        </p>
        {error.digest && (
          <p className="text-[11px] text-stone tabular-nums mt-2">
            Код ошибки: {error.digest}
          </p>
        )}
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={reset}
            className="bg-near-black text-ivory rounded-[12px] py-3 text-[14px] font-medium"
          >
            Попробовать ещё раз
          </button>
          <Link
            href="/"
            className="bg-ivory text-charcoal rounded-[12px] py-3 text-[14px] font-medium no-underline"
            style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
          >
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}
