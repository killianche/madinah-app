"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const saved = (localStorage.getItem("theme") as Theme | null) ?? "light";
    setTheme(saved);
  }, []);

  function apply(t: Theme) {
    setTheme(t);
    localStorage.setItem("theme", t);
    if (t === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }

  return (
    <div
      className="bg-ivory rounded-[14px] p-1 flex gap-1"
      style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
    >
      <button
        type="button"
        onClick={() => apply("light")}
        className={`flex-1 py-2 rounded-[10px] text-[14px] font-medium flex items-center justify-center gap-2 transition-colors ${
          theme === "light"
            ? "bg-parchment text-near-black"
            : "text-stone"
        }`}
        style={theme === "light" ? { boxShadow: "0 1px 2px rgba(20,20,19,0.06)" } : {}}
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
        Светлая
      </button>
      <button
        type="button"
        onClick={() => apply("dark")}
        className={`flex-1 py-2 rounded-[10px] text-[14px] font-medium flex items-center justify-center gap-2 transition-colors ${
          theme === "dark"
            ? "bg-near-black text-ivory"
            : "text-stone"
        }`}
        style={theme === "dark" ? { boxShadow: "0 1px 2px rgba(20,20,19,0.2)" } : {}}
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
        Тёмная
      </button>
    </div>
  );
}
