"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { haptic } from "@/lib/haptic";

/**
 * Минимальный pull-to-refresh для мобильных.
 * Срабатывает когда страница в самом верху и пользователь тянет вниз > THRESHOLD.
 * Триггерит router.refresh() — Next.js перезагружает данные.
 */
const THRESHOLD = 70;

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      if (window.scrollY > 0) return;
      startY.current = e.touches[0]?.clientY ?? null;
    }
    function onTouchMove(e: TouchEvent) {
      if (startY.current == null) return;
      const dy = (e.touches[0]?.clientY ?? 0) - startY.current;
      if (dy > 0 && window.scrollY === 0) {
        const damped = Math.min(dy * 0.5, 100);
        setPullY(damped);
      }
    }
    function onTouchEnd() {
      if (pullY > THRESHOLD && !refreshing) {
        setRefreshing(true);
        haptic("medium");
        router.refresh();
        setTimeout(() => {
          setRefreshing(false);
          setPullY(0);
        }, 800);
      } else {
        setPullY(0);
      }
      startY.current = null;
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [pullY, refreshing, router]);

  const progress = Math.min(pullY / THRESHOLD, 1);
  const showIndicator = pullY > 5 || refreshing;

  return (
    <>
      {showIndicator && (
        <div
          className="fixed top-0 left-0 right-0 z-30 flex items-center justify-center pointer-events-none"
          style={{
            height: refreshing ? 50 : Math.max(pullY, 0),
            opacity: progress,
            transition: refreshing ? "height 200ms ease" : undefined,
          }}
        >
          <div
            className={`w-7 h-7 rounded-full border-2 border-terracotta border-t-transparent ${
              refreshing ? "animate-spin" : ""
            }`}
            style={{
              transform: refreshing ? undefined : `rotate(${progress * 360}deg)`,
            }}
          />
        </div>
      )}
      <div
        style={{
          transform: pullY > 0 && !refreshing ? `translateY(${pullY * 0.5}px)` : undefined,
          transition: pullY === 0 ? "transform 200ms ease" : undefined,
        }}
      >
        {children}
      </div>
    </>
  );
}
