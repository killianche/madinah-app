import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import {
  listNotificationsForUser,
  markAllReadForUser,
} from "@/lib/repos/notifications";

export const metadata = { title: "Уведомления — Madinah" };
export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  topup: "Пополнение",
  student_assigned: "Новый ученик",
  low_balance: "Низкий баланс",
};

function timeAgo(d: Date): string {
  const sec = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (sec < 60) return "только что";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин назад`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ч назад`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} д назад`;
  return new Date(d).toLocaleDateString("ru-RU");
}

export default async function NotificationsPage() {
  const { user } = await requireAuth();
  const items = await listNotificationsForUser(user.id, 100);
  // Помечаем все как прочитанные после того, как загрузили (чтобы badge отразил visual state).
  if (items.some((i) => i.read_at === null)) {
    await markAllReadForUser(user.id);
  }

  return (
    <AppShell title="Уведомления">
      {items.length === 0 ? (
        <div
          className="bg-ivory rounded-[14px] py-10 text-center"
          style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
        >
          <p className="text-olive">Пока нет уведомлений.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const p = n.payload as Record<string, unknown>;
            const studentId = typeof p.student_id === "string" ? p.student_id : null;
            const studentName = typeof p.student_name === "string" ? p.student_name : "—";
            const wasUnread = n.read_at === null;

            let body: React.ReactNode = null;
            if (n.kind === "topup") {
              const added = typeof p.lessons_added === "number" ? p.lessons_added : 0;
              body = (
                <>
                  <span className="font-medium">{studentName}</span> пополнил баланс
                  {" "}
                  <span className="tabular-nums text-moss">+{added}</span> уроков
                </>
              );
            } else if (n.kind === "student_assigned") {
              body = (
                <>
                  Вам назначен ученик <span className="font-medium">{studentName}</span>
                </>
              );
            } else if (n.kind === "low_balance") {
              const bal = typeof p.balance === "number" ? p.balance : 0;
              body = (
                <>
                  У <span className="font-medium">{studentName}</span> низкий баланс:
                  {" "}
                  <span className="tabular-nums text-crimson">{bal}</span>
                </>
              );
            }

            const Inner = (
              <div
                className="bg-ivory rounded-[14px] p-3"
                style={{
                  boxShadow: wasUnread
                    ? "inset 0 0 0 1px rgba(201,100,66,0.45)"
                    : "inset 0 0 0 1px #f0eee6",
                }}
              >
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="text-[11px] uppercase tracking-[0.6px] font-medium text-stone">
                    {KIND_LABEL[n.kind] ?? n.kind}
                  </span>
                  <span className="text-[11px] text-stone tabular-nums">
                    {timeAgo(n.created_at)}
                  </span>
                </div>
                <div className="text-[14px] text-near-black">{body}</div>
              </div>
            );

            return (
              <li key={n.id}>
                {studentId ? (
                  <Link
                    href={`/teacher/student/${studentId}`}
                    className="block no-underline text-near-black"
                  >
                    {Inner}
                  </Link>
                ) : (
                  Inner
                )}
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
