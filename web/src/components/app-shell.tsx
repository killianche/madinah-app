import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { USER_ROLE_LABEL } from "@/lib/types";
import { BottomNav } from "./bottom-nav";

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
      <header className="sticky top-0 z-10 backdrop-blur bg-parchment/85 border-b border-subtle">
        <div className="container-prose flex items-center justify-between py-3">
          <div className="flex items-center gap-4">
            {back ? (
              <Link href={back.href} className="text-sm text-olive-gray hover:text-near-black no-underline">
                ← {back.label}
              </Link>
            ) : (
              <Link href="/" className="font-serif text-xl text-near-black no-underline">
                Madinah
              </Link>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-olive-gray hidden sm:inline">
              {user.full_name} · {USER_ROLE_LABEL[user.role]}
            </span>
            <form action="/logout" method="post" className="hidden sm:block">
              <button className="text-sm text-olive-gray hover:text-near-black">
                Выйти
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="container-prose py-6 sm:py-10 pb-28 sm:pb-10">
        {title ? <h1 className="mb-6">{title}</h1> : null}
        {children}
      </main>

      <BottomNav role={user.role} />
    </div>
  );
}
