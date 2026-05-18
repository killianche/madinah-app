"use client";

import { useEffect, useRef, useState } from "react";

export function AutoHideHeader({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    function onScroll() {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y < 24) {
          setHidden(false);
        } else if (y > lastY.current + 6) {
          setHidden(true);
        } else if (y < lastY.current - 6) {
          setHidden(false);
        }
        lastY.current = y;
        ticking.current = false;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-10 backdrop-blur bg-parchment/85 dark:bg-[rgba(20,20,19,0.92)] border-b border-subtle dark:border-[#2a2a28] transition-transform duration-200 ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      {children}
    </header>
  );
}
