"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { haptic } from "@/lib/haptic";

type ToastTone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  tone: ToastTone;
  text: string;
}

interface ToastApi {
  toast: (tone: ToastTone, text: string) => void;
  success: (text: string) => void;
  error: (text: string) => void;
  info: (text: string) => void;
}

const ToastCtx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((tone: ToastTone, text: string) => {
    const id = Date.now() + Math.random();
    setItems((arr) => [...arr, { id, tone, text }]);
    haptic(tone === "error" ? "error" : tone === "success" ? "success" : "light");
    setTimeout(() => setItems((arr) => arr.filter((t) => t.id !== id)), 3500);
  }, []);

  const api: ToastApi = {
    toast,
    success: (t) => toast("success", t),
    error: (t) => toast("error", t),
    info: (t) => toast("info", t),
  };

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="fixed top-[env(safe-area-inset-top)] left-0 right-0 z-[60] flex flex-col items-center gap-2 pt-4 px-4 pointer-events-none">
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-[12px] px-4 py-[10px] text-[14px] font-medium max-w-md shadow-lift-md ${
              t.tone === "success"
                ? "bg-moss text-ivory"
                : t.tone === "error"
                  ? "bg-crimson text-ivory"
                  : "bg-near-black text-ivory"
            }`}
            style={{ animation: "toast-in 200ms ease" }}
          >
            {t.text}
          </div>
        ))}
      </div>
      <style>{`@keyframes toast-in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    // Fallback — no provider, noop
    return {
      toast: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
    };
  }
  return ctx;
}

// Hook for a transient local note on a page (e.g., "Сохранено")
export function useTransientNote(ms = 2000) {
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), ms);
    return () => clearTimeout(t);
  }, [note, ms]);
  return [note, setNote] as const;
}
