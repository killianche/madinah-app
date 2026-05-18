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
  | "problems"
  | "teachers"
  | "wallet"
  | "settings"
  | "plus";

interface Tab {
  href: string;
  label: string;
  icon: IconName;
  match?: (pathname: string) => boolean;
  fab?: boolean;
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
        href: "/teacher/lesson/new",
        label: "Урок",
        icon: "plus",
        fab: true,
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
  if (role === "manager") {
    return [
      {
        href: "/manager",
        label: "Ученики",
        icon: "users",
        match: (p) =>
          p === "/manager" || p.startsWith("/manager?") || p.startsWith("/teacher/student/"),
      },
      { href: "/manager/students/new", label: "Создать", icon: "plus", fab: true },
      { href: "/teacher/profile", label: "Профиль", icon: "user" },
    ];
  }

  // admin — расширенный набор: дашборд, ученики, +, зарплата, профиль
  if (role === "admin") {
    return [
      {
        href: "/manager/dashboard",
        label: "Обзор",
        icon: "chart",
        match: (p) => p === "/manager/dashboard",
      },
      {
        href: "/manager",
        label: "Ученики",
        icon: "users",
        match: (p) =>
          p === "/manager" || p.startsWith("/manager?") || p.startsWith("/teacher/student/"),
      },
      { href: "/manager/students/new", label: "Ученик", icon: "plus", fab: true },
      {
        href: "/manager/salary",
        label: "Зарплата",
        icon: "wallet",
        match: (p) => p.startsWith("/manager/salary"),
      },
      { href: "/teacher/profile", label: "Профиль", icon: "user" },
    ];
  }

  // head — куратор + зарплата
  if (role === "head") {
    return [
      {
        href: "/manager",
        label: "Ученики",
        icon: "users",
        match: (p) =>
          p === "/manager" || p.startsWith("/manager?") || p.startsWith("/teacher/student/"),
      },
      {
        href: "/manager/attention",
        label: "Внимание",
        icon: "attention",
        match: (p) =>
          p.startsWith("/manager/attention") || p.startsWith("/manager/problems"),
      },
      { href: "/manager/students/new", label: "Ученик", icon: "plus", fab: true },
      {
        href: "/manager/salary",
        label: "Зарплата",
        icon: "wallet",
        match: (p) => p.startsWith("/manager/salary"),
      },
      { href: "/teacher/profile", label: "Профиль", icon: "user" },
    ];
  }

  // curator — без зарплаты
  return [
    {
      href: "/manager",
      label: "Ученики",
      icon: "users",
      match: (p) =>
        p === "/manager" || p.startsWith("/manager?") || p.startsWith("/teacher/student/"),
    },
    {
      href: "/manager/attention",
      label: "Внимание",
      icon: "attention",
      match: (p) =>
        p.startsWith("/manager/attention") || p.startsWith("/manager/problems"),
    },
    { href: "/manager/students/new", label: "Ученик", icon: "plus", fab: true },
    {
      href: "/manager/teachers",
      label: "Учителя",
      icon: "teachers",
      match: (p) => p.startsWith("/manager/teachers"),
    },
    { href: "/teacher/profile", label: "Профиль", icon: "user" },
  ];
}

export function BottomNav({ role }: { role: UserRole }) {
  const pathname = usePathname() ?? "";
  const tabs = tabsFor(role);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-ivory border-t border-border-cream"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 4px)" }}
      aria-label="Основная навигация"
    >
      <ul
        className="max-w-md mx-auto grid items-end pt-1"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}
      >
        {tabs.map((t) => {
          const active = t.match ? t.match(pathname) : pathname === t.href;
          if (t.fab) {
            return (
              <li key={t.href} className="relative flex justify-center">
                <Link
                  href={t.href}
                  className="flex flex-col items-center justify-center w-14 h-14 rounded-full bg-terracotta text-ivory no-underline active:scale-95 transition-transform -translate-y-3 shadow-[0_4px_12px_rgba(201,100,66,0.35),0_0_0_3px_#f5f4ed] dark:shadow-[0_4px_12px_rgba(201,100,66,0.25),0_0_0_3px_#141413]"
                  aria-label={t.label}
                >
                  <Icon name={t.icon} className="w-7 h-7" />
                </Link>
              </li>
            );
          }
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
    case "teachers":
      return (
        <svg {...props}>
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c3 3 9 3 12 0v-5" />
        </svg>
      );
    case "plus":
      return (
        <svg {...props} strokeWidth={2.4}>
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      );
    case "wallet":
      return (
        <svg {...props}>
          <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
          <path d="M4 6v12a2 2 0 0 0 2 2h14v-4" />
          <path d="M18 12a2 2 0 0 0-2 2c0 1.11.89 2 2 2h4v-4z" />
        </svg>
      );
    case "settings":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
  }
}
