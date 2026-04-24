"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import type { UserRole } from "@/lib/types";

type IconName =
  | "calendar"
  | "users"
  | "chart"
  | "user"
  | "attention"
  | "problems";

interface Tab {
  href: string;
  label: string;
  icon: IconName;
  match?: (pathname: string) => boolean;
}

function tabsFor(role: UserRole): Tab[] {
  if (role === "teacher") {
    return [
      {
        href: "/teacher",
        label: "Сегодня",
        icon: "calendar",
        match: (p) => p === "/teacher" || p.startsWith("/teacher?"),
      },
      {
        href: "/teacher/students",
        label: "Ученики",
        icon: "users",
        match: (p) =>
          p.startsWith("/teacher/students") || p.startsWith("/teacher/student/"),
      },
      {
        href: "/teacher/stats",
        label: "Статистика",
        icon: "chart",
      },
      {
        href: "/teacher/profile",
        label: "Профиль",
        icon: "user",
      },
    ];
  }
  if (role === "admin") {
    return [
      { href: "/admin", label: "Сотрудники", icon: "users" },
      { href: "/manager", label: "Ученики", icon: "calendar" },
      { href: "/manager/attention", label: "Внимание", icon: "attention" },
      { href: "/teacher/profile", label: "Профиль", icon: "user" },
    ];
  }
  // manager, curator, head, director
  return [
    {
      href: "/manager",
      label: "Ученики",
      icon: "users",
      match: (p) =>
        p === "/manager" || p.startsWith("/manager?") || p.startsWith("/teacher/student/"),
    },
    { href: "/manager/attention", label: "Внимание", icon: "attention" },
    { href: "/manager/problems", label: "Проблемные", icon: "problems" },
    { href: "/teacher/profile", label: "Профиль", icon: "user" },
  ];
}

export function BottomNav({ role }: { role: UserRole }) {
  const pathname = usePathname() ?? "";
  const tabs = tabsFor(role);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-ivory border-t border-border-cream pb-[env(safe-area-inset-bottom)]"
      aria-label="Основная навигация"
    >
      <ul
        className="max-w-md mx-auto grid"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}
      >
        {tabs.map((t) => {
          const active = t.match ? t.match(pathname) : pathname === t.href;
          return (
            <li key={t.href} className="relative">
              {active && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-7 h-[2px] rounded-full bg-terracotta"
                  aria-hidden
                />
              )}
              <Link
                href={t.href}
                className={cn(
                  "flex flex-col items-center justify-center pt-2 pb-1 no-underline min-h-[52px] gap-1",
                  active
                    ? "text-near-black font-medium"
                    : "text-stone hover:text-near-black",
                )}
              >
                <Icon name={t.icon} className="w-[22px] h-[22px]" />
                <span className="text-[12px] leading-tight">{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Icon({ name, className }: { name: IconName; className?: string }) {
  const props = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "calendar":
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case "users":
      return (
        <svg {...props}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
          <circle cx="10" cy="7" r="4" />
          <path d="M21 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M17 3.13A4 4 0 0 1 17 11" />
        </svg>
      );
    case "chart":
      return (
        <svg {...props}>
          <line x1="4" y1="20" x2="20" y2="20" />
          <rect x="6" y="10" width="3" height="7" />
          <rect x="11" y="6" width="3" height="11" />
          <rect x="16" y="13" width="3" height="4" />
        </svg>
      );
    case "user":
      return (
        <svg {...props}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case "attention":
      return (
        <svg {...props}>
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case "problems":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
  }
}
