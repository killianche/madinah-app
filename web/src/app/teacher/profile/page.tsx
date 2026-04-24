import { requireAuth } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { USER_ROLE_LABEL } from "@/lib/types";

export const metadata = { title: "Профиль — Madinah" };
export const dynamic = "force-dynamic";

export default async function Profile() {
  const { user } = await requireAuth();

  return (
    <AppShell title="Профиль">
      <div className="bg-ivory shadow-ring rounded-md p-5 mb-6">
        <div className="text-sm text-olive-gray">ФИО</div>
        <div className="font-serif text-2xl mt-1">{user.full_name}</div>
        <div className="text-xs text-olive-gray mt-3">Роль</div>
        <div className="text-sm">{USER_ROLE_LABEL[user.role]}</div>
        {user.phone && (
          <>
            <div className="text-xs text-olive-gray mt-3">Логин</div>
            <div className="text-sm font-mono">{user.phone}</div>
          </>
        )}
        {user.email && (
          <>
            <div className="text-xs text-olive-gray mt-3">Email</div>
            <div className="text-sm">{user.email}</div>
          </>
        )}
      </div>

      <form action="/logout" method="post">
        <button
          type="submit"
          className="w-full bg-ivory shadow-ring rounded-md p-4 text-center text-terracotta font-medium hover:shadow-ring-strong transition-shadow"
        >
          Выйти
        </button>
      </form>
    </AppShell>
  );
}
