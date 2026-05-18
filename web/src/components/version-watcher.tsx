"use client";

import { useEffect, useState } from "react";

/**
 * Опрашивает /api/version и сравнивает с версией, с которой был открыт таб.
 * Если на сервере уже новее — показывает баннер с авто-перезагрузкой через 10 сек.
 *
 * Дополнительно опрашивает при возврате таба в фокус — типовой сценарий
 * «пользователь не закрывал вкладку с утра».
 */
export function VersionWatcher({ current }: { current: string }) {
  const [latest, setLatest] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(10);

  // Поллинг
  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { version?: string };
        if (cancelled) return;
        if (data.version && data.version !== current) {
          setLatest(data.version);
        }
      } catch {
        // тихо
      }
    }
    // Первый чек — через 30 сек, чтобы не делать запрос сразу при загрузке.
    const initial = setTimeout(check, 30_000);
    const interval = setInterval(check, 60_000);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      clearTimeout(initial);
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [current]);

  // Обратный отсчёт + авто-reload
  useEffect(() => {
    if (!latest) return;
    setCountdown(10);
    const tick = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) {
          clearInterval(tick);
          window.location.reload();
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [latest]);

  if (!latest) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-[12px] flex items-center gap-3 bg-near-black text-ivory shadow-lg max-w-[92vw]"
      style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}
    >
      <span className="text-[13px]">
        Новая версия <span className="font-mono">{latest}</span>. Обновление через {countdown}…
      </span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="text-[12px] font-medium bg-terracotta text-ivory px-3 py-[6px] rounded-[8px]"
      >
        Обновить
      </button>
    </div>
  );
}
