import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import {
  listAuditLog,
  listAuditActions,
  listAuditActors,
  ACTION_LABEL,
} from "@/lib/repos/audit";

export const metadata = { title: "Журнал действий — Madinah" };
export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  admin: "Админ",
  curator: "Куратор",
  head: "Руководитель",
  manager: "Менеджер",
  teacher: "Учитель",
};

function fmt(d: Date): string {
  const dt = new Date(d);
  return `${dt.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })} ${dt
    .toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
}

function formatDiff(diff: Record<string, unknown> | null): string {
  if (!diff) return "";
  const entries = Object.entries(diff);
  if (entries.length === 0) return "";
  return entries
    .map(([k, v]) => {
      if (typeof v === "object") return `${k}: ${JSON.stringify(v)}`;
      return `${k}: ${String(v)}`;
    })
    .join(" · ");
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    action?: string;
    actor?: string;
    entity?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  await requireRole("curator", "head", "admin");
  const sp = await searchParams;
  const pageNum = Math.max(1, parseInt(sp.page ?? "1", 10));
  const PAGE_SIZE = 100;

  const [entries, actions, actors] = await Promise.all([
    listAuditLog({
      action: sp.action || undefined,
      actor_id: sp.actor || undefined,
      entity_type: sp.entity || undefined,
      date_from: sp.from || undefined,
      date_to: sp.to || undefined,
      limit: PAGE_SIZE,
      offset: (pageNum - 1) * PAGE_SIZE,
    }),
    listAuditActions(),
    listAuditActors(),
  ]);

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const merged = { ...sp, ...overrides };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `/manager/audit?${qs}` : "/manager/audit";
  };

  return (
    <AppShell
      title="Журнал действий"
      back={{ href: "/manager", label: "Менеджер" }}
    >
      <p className="text-[12px] text-olive mb-4">
        Кто что делал. Полная лента изменений: уроки, ученики, учителя, статусы, расписание.
      </p>

      {/* Filters */}
      <div className="bg-ivory rounded-[14px] p-4 mb-4 space-y-3" style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}>
        <div>
          <div className="text-[11px] uppercase tracking-[0.6px] font-medium text-stone mb-2">
            Тип действия
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Link
              href={buildHref({ action: undefined, page: undefined })}
              className={`text-[12px] px-2.5 py-1 rounded-full no-underline ${
                !sp.action
                  ? "bg-near-black text-ivory"
                  : "bg-parchment text-charcoal"
              }`}
              style={!sp.action ? {} : { boxShadow: "inset 0 0 0 1px #e8e6dc" }}
            >
              Все
            </Link>
            {actions.slice(0, 10).map((a) => (
              <Link
                key={a.action}
                href={buildHref({ action: a.action, page: undefined })}
                className={`text-[12px] px-2.5 py-1 rounded-full no-underline ${
                  sp.action === a.action
                    ? "bg-near-black text-ivory"
                    : "bg-parchment text-charcoal"
                }`}
                style={sp.action === a.action ? {} : { boxShadow: "inset 0 0 0 1px #e8e6dc" }}
              >
                {ACTION_LABEL[a.action] ?? a.action} <span className="opacity-60 tabular-nums">{a.cnt}</span>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-[0.6px] font-medium text-stone mb-2">
            Кто
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Link
              href={buildHref({ actor: undefined, page: undefined })}
              className={`text-[12px] px-2.5 py-1 rounded-full no-underline ${
                !sp.actor
                  ? "bg-near-black text-ivory"
                  : "bg-parchment text-charcoal"
              }`}
              style={!sp.actor ? {} : { boxShadow: "inset 0 0 0 1px #e8e6dc" }}
            >
              Все
            </Link>
            {actors.slice(0, 12).map((a) => (
              <Link
                key={a.id}
                href={buildHref({ actor: a.id, page: undefined })}
                className={`text-[12px] px-2.5 py-1 rounded-full no-underline ${
                  sp.actor === a.id
                    ? "bg-near-black text-ivory"
                    : "bg-parchment text-charcoal"
                }`}
                style={sp.actor === a.id ? {} : { boxShadow: "inset 0 0 0 1px #e8e6dc" }}
              >
                {a.full_name} <span className="opacity-60 tabular-nums">{a.cnt}</span>
              </Link>
            ))}
          </div>
        </div>

        <form className="flex flex-wrap gap-2 items-end pt-1">
          <input type="hidden" name="action" value={sp.action ?? ""} />
          <input type="hidden" name="actor" value={sp.actor ?? ""} />
          <input type="hidden" name="entity" value={sp.entity ?? ""} />
          <label className="text-[12px] text-charcoal">
            <span className="block text-[11px] uppercase tracking-[0.6px] font-medium text-stone mb-1">
              С даты
            </span>
            <input
              type="date"
              name="from"
              defaultValue={sp.from ?? ""}
              className="bg-parchment text-near-black text-[13px] rounded-[8px] px-2.5 py-1.5"
              style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
            />
          </label>
          <label className="text-[12px] text-charcoal">
            <span className="block text-[11px] uppercase tracking-[0.6px] font-medium text-stone mb-1">
              По
            </span>
            <input
              type="date"
              name="to"
              defaultValue={sp.to ?? ""}
              className="bg-parchment text-near-black text-[13px] rounded-[8px] px-2.5 py-1.5"
              style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
            />
          </label>
          <button
            type="submit"
            className="text-[13px] font-medium px-3 py-1.5 rounded-[8px] bg-near-black text-ivory"
          >
            Применить
          </button>
          {(sp.from || sp.to) && (
            <Link
              href={buildHref({ from: undefined, to: undefined, page: undefined })}
              className="text-[12px] text-stone no-underline px-2"
            >
              Сбросить даты
            </Link>
          )}
        </form>
      </div>

      {/* Entries */}
      {entries.length === 0 ? (
        <div className="bg-ivory rounded-[14px] py-10 text-center" style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}>
          <p className="text-olive">По выбранным фильтрам ничего нет.</p>
        </div>
      ) : (
        <div className="bg-ivory rounded-[14px] overflow-hidden" style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.6px] font-medium text-stone border-b border-[#ece9dd]">
                <th className="text-left py-2.5 px-4">Когда</th>
                <th className="text-left py-2.5 px-3">Кто</th>
                <th className="text-left py-2.5 px-3">Действие</th>
                <th className="text-left py-2.5 px-3">Объект</th>
                <th className="text-left py-2.5 px-4">Детали</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const entityHref =
                  e.entity_type === "student" && e.entity_id
                    ? `/teacher/student/${e.entity_id}`
                    : e.entity_type === "teacher" && e.entity_id
                      ? `/manager/teachers/${e.entity_id}`
                      : null;
                return (
                  <tr key={e.id} className={`border-t border-[#ece9dd] ${i % 2 === 0 ? "" : "bg-parchment/40"}`}>
                    <td className="py-2 px-4 text-stone tabular-nums whitespace-nowrap">
                      {fmt(e.created_at)}
                    </td>
                    <td className="py-2 px-3">
                      <span className="text-near-black">{e.actor_name ?? "—"}</span>
                      {e.actor_role && (
                        <span className="ml-1.5 text-[11px] text-stone">
                          {ROLE_LABEL[e.actor_role] ?? e.actor_role}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-charcoal">
                      {ACTION_LABEL[e.action] ?? e.action}
                    </td>
                    <td className="py-2 px-3">
                      {entityHref && e.entity_name ? (
                        <Link href={entityHref} className="text-charcoal no-underline hover:text-terracotta">
                          {e.entity_name}
                        </Link>
                      ) : (
                        <span className="text-stone">{e.entity_name ?? e.entity_type}</span>
                      )}
                    </td>
                    <td className="py-2 px-4 text-[12px] text-olive">{formatDiff(e.diff)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="flex justify-between items-center mt-3 text-[12px] text-stone tabular-nums">
        <span>Страница {pageNum} · показано {entries.length}</span>
        <div className="flex gap-2">
          {pageNum > 1 && (
            <Link
              href={buildHref({ page: String(pageNum - 1) })}
              className="px-3 py-1.5 rounded-[8px] bg-ivory no-underline text-charcoal"
              style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
            >
              ← Назад
            </Link>
          )}
          {entries.length === PAGE_SIZE && (
            <Link
              href={buildHref({ page: String(pageNum + 1) })}
              className="px-3 py-1.5 rounded-[8px] bg-ivory no-underline text-charcoal"
              style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
            >
              Далее →
            </Link>
          )}
        </div>
      </div>
    </AppShell>
  );
}
