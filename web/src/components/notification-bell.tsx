import Link from "next/link";
import { countUnreadForUser } from "@/lib/repos/notifications";

export async function NotificationBell({ userId }: { userId: string }) {
  let unread = 0;
  try {
    unread = await countUnreadForUser(userId);
  } catch {
    // не валим хедер из-за уведомлений
  }
  return (
    <Link
      href="/notifications"
      aria-label={`Уведомления (${unread})`}
      className="relative inline-flex items-center justify-center w-9 h-9 rounded-full text-near-black dark:text-ivory no-underline"
    >
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 16v-5a6 6 0 0 0-12 0v5l-2 2h16l-2-2z" />
        <path d="M10 21a2 2 0 0 0 4 0" />
      </svg>
      {unread > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full bg-terracotta text-ivory text-[10px] font-medium tabular-nums"
          style={{ lineHeight: 1 }}
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
