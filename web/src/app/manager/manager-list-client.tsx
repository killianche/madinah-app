"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Chip } from "@/components/ui/chip";
import { STUDENT_STATUS_LABEL, type StudentStatus } from "@/lib/types";

interface Row {
  id: string;
  full_name: string;
  phone: string | null;
  balance: number;
  is_charity: boolean;
  status: StudentStatus;
  teacher_id: string | null;
  teacher_name: string | null;
  enrolled_at: string | null;
  last_lesson_date: string | null;
  counted_lessons: number;
  created_by_user_id: string | null;
}

interface TeacherOption {
  id: string;
  full_name: string;
}

type Filter = "all" | "active" | "low" | "paused" | "graduated" | "dropped" | "archived" | "mine" | "mine_low";
type Sort = "name" | "enrolled_desc" | "enrolled_asc" | "last_lesson_desc" | "balance_asc" | "balance_desc";
type Group = "none" | "teacher" | "enrolled_month";

const PAGE = 50;

const SORT_LABEL: Record<Sort, string> = {
  name: "Имя",
  enrolled_desc: "Поступил недавно",
  enrolled_asc: "Поступил давно",
  last_lesson_desc: "Последний урок",
  balance_asc: "Низкий баланс",
  balance_desc: "Высокий баланс",
};

const GROUP_LABEL: Record<Group, string> = {
  none: "Без группировки",
  teacher: "По учителю",
  enrolled_month: "По месяцу поступления",
};

const MONTHS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

function ymKey(iso: string | null): string {
  if (!iso) return "9999-12";
  return iso.slice(0, 7);
}

function ymLabel(key: string): string {
  if (key === "9999-12") return "Без даты поступления";
  const parts = key.split("-");
  const y = parts[0];
  const m = parts[1];
  if (!y || !m) return key;
  return `${MONTHS_RU[parseInt(m, 10) - 1]} ${y}`;
}

export function ManagerStudentsList({
  students,
  teachers,
  currentUserId,
}: {
  students: Row[];
  teachers: TeacherOption[];
  /** Передан если роль = manager; включает фильтр «Мои». */
  currentUserId?: string;
}) {
  const [search, setSearch] = useState("");
  const [focused, setFocused] = useState(false);
  const [filter, setFilter] = useState<Filter>(currentUserId ? "mine" : "active");
  const [teacherFilter, setTeacherFilter] = useState<string>("");
  const [sort, setSort] = useState<Sort>("name");
  const [group, setGroup] = useState<Group>("none");
  const [shown, setShown] = useState(PAGE);

  const counts = useMemo(() => {
    const mineRows = currentUserId
      ? students.filter((s) => s.created_by_user_id === currentUserId)
      : [];
    return {
      all: students.length,
      active: students.filter((s) => s.status === "active").length,
      low: students.filter((s) => s.status === "active" && s.balance <= 0).length,
      paused: students.filter((s) => s.status === "paused").length,
      graduated: students.filter((s) => s.status === "graduated").length,
      dropped: students.filter((s) => s.status === "dropped").length,
      archived: students.filter((s) => s.status === "archived").length,
      mine: mineRows.length,
      mine_low: mineRows.filter((s) => s.status === "active" && s.balance <= 4).length,
    };
  }, [students, currentUserId]);

  const filtered = useMemo(() => {
    let list: Row[] = students;
    if (filter === "all") list = list;
    else if (filter === "active") list = list.filter((s) => s.status === "active");
    else if (filter === "low")
      list = list.filter((s) => s.status === "active" && s.balance <= 0);
    else if (filter === "mine")
      list = list.filter((s) => s.created_by_user_id === currentUserId);
    else if (filter === "mine_low")
      list = list.filter(
        (s) => s.created_by_user_id === currentUserId && s.status === "active" && s.balance <= 4,
      );
    else list = list.filter((s) => s.status === filter);

    if (teacherFilter) {
      if (teacherFilter === "__none__") {
        list = list.filter((s) => !s.teacher_id);
      } else {
        list = list.filter((s) => s.teacher_id === teacherFilter);
      }
    }

    const q = search.trim().toLowerCase();
    if (q) {
      const qDigits = q.replace(/\D/g, "");
      list = list.filter((s) => {
        if (s.full_name.toLowerCase().includes(q)) return true;
        if (s.teacher_name && s.teacher_name.toLowerCase().includes(q)) return true;
        if (s.phone) {
          const phoneDigits = s.phone.replace(/\D/g, "");
          if (qDigits.length >= 2 && phoneDigits.includes(qDigits)) return true;
          if (s.phone.toLowerCase().includes(q)) return true;
        }
        return false;
      });
    }

    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sort) {
        case "name":
          return a.full_name.localeCompare(b.full_name);
        case "enrolled_desc":
          return (b.enrolled_at ?? "").localeCompare(a.enrolled_at ?? "");
        case "enrolled_asc":
          return (a.enrolled_at ?? "9999").localeCompare(b.enrolled_at ?? "9999");
        case "last_lesson_desc":
          return (b.last_lesson_date ?? "").localeCompare(a.last_lesson_date ?? "");
        case "balance_asc":
          return a.balance - b.balance;
        case "balance_desc":
          return b.balance - a.balance;
      }
    });
    return sorted;
  }, [students, filter, teacherFilter, search, sort]);

  const groups = useMemo(() => {
    if (group === "none") {
      return [{ key: "_", label: "", rows: filtered.slice(0, shown) }];
    }
    const buckets = new Map<string, Row[]>();
    for (const s of filtered) {
      const k =
        group === "teacher"
          ? s.teacher_name ?? "__no__"
          : ymKey(s.enrolled_at);
      const arr = buckets.get(k) ?? [];
      arr.push(s);
      buckets.set(k, arr);
    }
    const sortedKeys = [...buckets.keys()].sort((a, b) => {
      if (group === "teacher") return a.localeCompare(b);
      return b.localeCompare(a); // recent month first
    });
    let remaining = shown;
    const out: { key: string; label: string; rows: Row[] }[] = [];
    for (const k of sortedKeys) {
      if (remaining <= 0) break;
      const all = buckets.get(k)!;
      const slice = all.slice(0, remaining);
      remaining -= slice.length;
      out.push({
        key: k,
        label:
          group === "teacher"
            ? k === "__no__"
              ? "Без учителя"
              : k
            : ymLabel(k),
        rows: slice,
      });
    }
    return out;
  }, [filtered, group, shown]);

  return (
    <div>
      {/* Search */}
      <div
        className="flex items-center gap-[10px] bg-ivory rounded-[12px] px-[14px] py-[10px] mb-[10px] transition-shadow"
        style={{
          boxShadow: focused
            ? "inset 0 0 0 1px #e8e6dc, 0 0 0 3px rgba(56,152,236,0.25)"
            : "inset 0 0 0 1px #f0eee6",
        }}
      >
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] text-stone" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Поиск по имени, телефону, учителю"
          className="flex-1 bg-transparent border-0 outline-none text-[15px] text-near-black p-0"
        />
        {search && (
          <button type="button" onClick={() => setSearch("")} className="text-stone">×</button>
        )}
      </div>

      {/* Filter pills (status) */}
      <div className="flex gap-[6px] overflow-x-auto pb-1 mb-2">
        {currentUserId && (
          <>
            <Pill active={filter === "mine"} count={counts.mine} onClick={() => setFilter("mine")}>
              Мои
            </Pill>
            {counts.mine_low > 0 && (
              <Pill
                active={filter === "mine_low"}
                count={counts.mine_low}
                onClick={() => setFilter("mine_low")}
                tone="warn"
              >
                Мои · низкий
              </Pill>
            )}
          </>
        )}
        <Pill active={filter === "all"} count={counts.all} onClick={() => setFilter("all")}>
          Все
        </Pill>
        <Pill active={filter === "active"} count={counts.active} onClick={() => setFilter("active")}>
          Активные
        </Pill>
        <Pill active={filter === "low"} count={counts.low} onClick={() => setFilter("low")}>
          Низкий баланс
        </Pill>
        {counts.paused > 0 && (
          <Pill active={filter === "paused"} count={counts.paused} onClick={() => setFilter("paused")}>
            В отпуске
          </Pill>
        )}
        {counts.graduated > 0 && (
          <Pill active={filter === "graduated"} count={counts.graduated} onClick={() => setFilter("graduated")}>
            Выпускники
          </Pill>
        )}
        {counts.dropped > 0 && (
          <Pill active={filter === "dropped"} count={counts.dropped} onClick={() => setFilter("dropped")}>
            Бросили
          </Pill>
        )}
        {counts.archived > 0 && (
          <Pill active={filter === "archived"} count={counts.archived} onClick={() => setFilter("archived")}>
            Архив
          </Pill>
        )}
      </div>

      {/* Sort + group + teacher filter */}
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <select
          value={teacherFilter}
          onChange={(e) => setTeacherFilter(e.target.value)}
          className="bg-ivory text-charcoal text-[13px] rounded-[10px] px-3 py-2"
          style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
        >
          <option value="">Все учителя</option>
          <option value="__none__">— без учителя —</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>{t.full_name}</option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="bg-ivory text-charcoal text-[13px] rounded-[10px] px-3 py-2"
          style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
        >
          {(Object.keys(SORT_LABEL) as Sort[]).map((s) => (
            <option key={s} value={s}>{SORT_LABEL[s]}</option>
          ))}
        </select>
        <select
          value={group}
          onChange={(e) => setGroup(e.target.value as Group)}
          className="bg-ivory text-charcoal text-[13px] rounded-[10px] px-3 py-2"
          style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
        >
          {(Object.keys(GROUP_LABEL) as Group[]).map((g) => (
            <option key={g} value={g}>{GROUP_LABEL[g]}</option>
          ))}
        </select>
      </div>

      <p className="text-[12px] text-stone mb-2 tabular-nums">
        {filtered.length}{search ? ` по запросу «${search}»` : ""}
      </p>

      {filtered.length === 0 ? (
        <div className="py-10 text-center text-olive text-sm">Никого не нашлось</div>
      ) : (
        <>
          {groups.map((g) => (
            <div key={g.key} className="mb-3">
              {g.label && (
                <div className="text-[11px] uppercase tracking-[0.6px] font-medium text-stone mb-2 mt-1">
                  {g.label} · {g.rows.length}
                </div>
              )}
              <div
                className="bg-ivory rounded-[14px] px-4"
                style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
              >
                {g.rows.map((s, i) => (
                  <Link
                    key={s.id}
                    href={`/teacher/student/${s.id}`}
                    className={`grid grid-cols-[1fr_auto] items-center gap-3 py-[14px] no-underline text-near-black ${
                      i > 0 ? "border-t border-border-cream" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[15px] font-medium truncate">{s.full_name}</span>
                        {s.is_charity && <Chip tone="neutral" size="s">благ.</Chip>}
                        {s.status !== "active" && (
                          <Chip tone={s.status === "dropped" ? "bad" : "neutral"} size="s">
                            {STUDENT_STATUS_LABEL[s.status].toLowerCase()}
                          </Chip>
                        )}
                      </div>
                      <div className="text-[12px] text-olive mt-0.5 tabular-nums">
                        {s.teacher_name ?? "без учителя"}
                        {s.phone ? ` · ${s.phone}` : ""}
                        {sort === "enrolled_desc" || sort === "enrolled_asc" ? (
                          s.enrolled_at && ` · с ${new Date(s.enrolled_at).toLocaleDateString("ru-RU")}`
                        ) : sort === "last_lesson_desc" && s.last_lesson_date ? (
                          ` · посл. ${new Date(s.last_lesson_date).toLocaleDateString("ru-RU")}`
                        ) : null}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-serif text-[20px] font-medium tabular-nums leading-none text-near-black">
                        {s.counted_lessons}
                      </div>
                      <div className="text-[9px] font-medium uppercase tracking-[0.6px] text-stone mt-0.5">
                        уроков
                      </div>
                      <div
                        className={`flex items-center gap-1 justify-end mt-1 text-[11px] tabular-nums ${
                          s.balance <= 0 ? "text-crimson" : "text-stone"
                        }`}
                      >
                        <ManagerWalletIcon />
                        {s.balance}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
          {filtered.length > shown && (
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={() => setShown((n) => n + PAGE)}
                className="text-[13px] font-medium text-charcoal px-4 py-2 rounded-[10px] bg-ivory"
                style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
              >
                Показать ещё {Math.min(PAGE, filtered.length - shown)} ·{" "}
                <span className="text-stone">осталось {filtered.length - shown}</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Pill({
  active,
  count,
  onClick,
  children,
  tone,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "warn";
}) {
  const isWarn = tone === "warn";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-[6px] px-3 py-[7px] rounded-full text-[13px] font-medium whitespace-nowrap transition-colors ${
        active
          ? isWarn
            ? "bg-crimson text-ivory"
            : "bg-near-black text-ivory"
          : isWarn
            ? "text-crimson"
            : "text-charcoal"
      }`}
      style={
        !active
          ? { boxShadow: isWarn ? "inset 0 0 0 1px rgba(185,28,28,0.35)" : "inset 0 0 0 1px #e8e6dc" }
          : {}
      }
    >
      {children}
      <span
        className={`text-[11px] px-[6px] py-[1px] rounded-full ${
          active ? "bg-[rgba(250,249,245,0.18)]" : isWarn ? "bg-[rgba(185,28,28,0.10)]" : "bg-warm-sand"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function ManagerWalletIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
      <path d="M4 6v12a2 2 0 0 0 2 2h14v-4" />
      <path d="M18 12a2 2 0 0 0-2 2c0 1.11.89 2 2 2h4v-4z" />
    </svg>
  );
}
