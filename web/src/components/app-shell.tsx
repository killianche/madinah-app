import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { USER_ROLE_LABEL } from "@/lib/types";
import { APP_VERSION } from "@/lib/version";
import { BottomNav } from "./bottom-nav";
import { ThemeToggleCompact } from "./ui/theme-toggle-compact";
import { PullToRefresh } from "./ui/pull-to-refresh";
import { AutoHideHeader } from "./auto-hide-header";
import { NotificationBell } from "./notification-bell";
import { VersionWatcher } from "./version-watcher";

export async function AppShell({
  children,
  title,
  back,
}: {
  children: React.ReactNode;
  title?: string;
  back?: { href: string; label: string };
}) {
  const { user } = await requireAuth();

  return (
    <div className="min-h-screen bg-parchment">
      <AutoHideHeader>
        <div className="container-prose flex items-center justify-between py-3">
          <div className="flex items-center gap-4">
            {back ? (
              <Link href={back.href} className="text-sm text-olive-gray dark:text-[#a8a69c] hover:text-near-black dark:hover:text-ivory no-underline">
                ← {back.label}
              </Link>
            ) : (
              <>
                <Link href="/" className="font-serif text-xl text-near-black dark:text-ivory no-underline">
                  Madinah
                </Link>
                <span className="text-[11px] text-olive-gray dark:text-[#a8a69c] font-mono">{APP_VERSION}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-olive-gray dark:text-[#a8a69c] hidden sm:inline">
              {user.full_name} · {USER_ROLE_LABEL[user.role]}
            </span>
            <NotificationBell userId={user.id} />
            <ThemeToggleCompact />
            <form action="/logout" method="post" className="hidden sm:block">
              <button className="text-sm text-olive-gray dark:text-[#a8a69c] hover:text-near-black dark:hover:text-ivory">
                Выйти
              </button>
            </form>
          </div>
        </div>
      </AutoHideHeader>

      <PullToRefresh>
        <main className="container-prose py-6 sm:py-10 pb-28 sm:pb-10">
          {title ? <h1 className="mb-6">{title}</h1> : null}
          {children}
        </main>
      </PullToRefresh>

      <BottomNav role={user.role} />
      <VersionWatcher current={APP_VERSION} />
    </div>
  );
}
