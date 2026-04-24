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
  teacher_name: string | null;
}

type Filter = "all" | "active" | "low" | "paused" | "graduated" | "dropped" | "archived";

export function ManagerStudentsList({ students }: { students: Row[] }) {
  const [search, setSearch] = useState("");
  const [focused, setFocused] = useState(false);
  const [filter, setFilter] = useState<Filter>("active");

  const counts = useMemo(() => {
    return {
      all: students.length,
      active: students.filter((s) => s.status === "active").length,
      low: students.filter((s) => s.status === "active" && s.balance <= 0).length,
      paused: students.filter((s) => s.status === "paused").length,
      graduated: students.filter((s) => s.status === "graduated").length,
      dropped: students.filter((s) => s.status === "dropped").length,
      archived: students.filter((s) => s.status === "archived").length,
    };
  }, [students]);

  const filtered = useMemo(() => {
    let list = students;
    if (filter === "all") list = students;
    else if (filter === "active") list = list.filter((s) => s.status === "active");
    else if (filter === "low")
      list = list.filter((s) => s.status === "active" && s.balance <= 0);
    else list = list.filter((s) => s.status === filter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          s.full_name.toLowerCase().includes(q) ||
          (s.phone && s.phone.includes(q)) ||
          (s.teacher_name && s.teacher_name.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [students, search, filter]);

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

      {/* Filter pills */}
      <div className="flex gap-[6px] overflow-x-auto pb-1 mb-3">
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

      <p className="text-[12px] text-stone mb-2 tabular-nums">
        {filtered.length}{search ? ` по запросу «${search}»` : ""}
      </p>

      {filtered.length === 0 ? (
        <div className="py-10 text-center text-olive text-sm">Никого не нашлось</div>
      ) : (
        <div
          className="bg-ivory rounded-[14px] px-4"
          style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
        >
          {filtered.slice(0, 200).map((s, i) => (
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
                </div>
              </div>
              <div
                className={`font-serif text-[20px] font-medium tabular-nums ${
                  s.balance <= 0 ? "text-crimson" : ""
                }`}
              >
                {s.balance}
              </div>
            </Link>
          ))}
          {filtered.length > 200 && (
            <div className="py-3 text-center text-[12px] text-stone">
              Показано 200 из {filtered.length} — уточни поиск
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Pill({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-[6px] px-3 py-[7px] rounded-full text-[13px] font-medium whitespace-nowrap transition-colors ${
        active ? "bg-near-black text-ivory" : "text-charcoal"
      }`}
      style={!active ? { boxShadow: "inset 0 0 0 1px #e8e6dc" } : {}}
    >
      {children}
      <span
        className={`text-[11px] px-[6px] py-[1px] rounded-full ${
          active ? "bg-[rgba(250,249,245,0.18)]" : "bg-warm-sand"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
