"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Chip } from "@/components/ui/chip";
import type { StudentListItem } from "@/lib/repos/students";

type Filter = "all" | "active" | "low" | "paused";
type Sort = "name" | "last" | "balance";

function fmtDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function daysAgo(d: Date | string | null): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

export function StudentsList({ students }: { students: StudentListItem[] }) {
  const [search, setSearch] = useState("");
  const [focused, setFocused] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("name");

  const activeCount = students.filter((s) => s.status === "active").length;
  const lowCount = students.filter((s) => s.balance <= 0).length;
  const pausedCount = students.filter((s) => s.status === "paused").length;

  const filtered = useMemo(() => {
    let list = students;
    if (filter === "active") list = list.filter((s) => s.status === "active");
    if (filter === "low") list = list.filter((s) => s.balance <= 0);
    if (filter === "paused") list = list.filter((s) => s.status === "paused");
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((s) => s.full_name.toLowerCase().includes(q));
    const sorted = [...list];
    if (sort === "name") sorted.sort((a, b) => a.full_name.localeCompare(b.full_name));
    if (sort === "last")
      sorted.sort((a, b) => {
        const da = a.last_lesson_date ? new Date(a.last_lesson_date).getTime() : 0;
        const db = b.last_lesson_date ? new Date(b.last_lesson_date).getTime() : 0;
        return db - da;
      });
    if (sort === "balance") sorted.sort((a, b) => a.balance - b.balance);
    return sorted;
  }, [students, search, filter, sort]);

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
          placeholder="Поиск по имени"
          className="flex-1 bg-transparent border-0 outline-none text-[15px] text-near-black p-0"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="text-stone hover:text-near-black"
            aria-label="Очистить"
          >
            ×
          </button>
        )}
      </div>

      {/* Filter pills */}
      <div className="flex gap-[6px] overflow-x-auto pb-1 mb-2">
        <FilterPill active={filter === "all"} count={students.length} onClick={() => setFilter("all")}>
          Все
        </FilterPill>
        <FilterPill active={filter === "active"} count={activeCount} onClick={() => setFilter("active")}>
          Активные
        </FilterPill>
        <FilterPill active={filter === "low"} count={lowCount} onClick={() => setFilter("low")}>
          Низкий баланс
        </FilterPill>
        {pausedCount > 0 && (
          <FilterPill active={filter === "paused"} count={pausedCount} onClick={() => setFilter("paused")}>
            В отпуске
          </FilterPill>
        )}
      </div>

      {/* Sort */}
      <div className="flex gap-[6px] mb-3 text-[12px]">
        <span className="text-stone self-center">Сортировка:</span>
        <SortChip active={sort === "name"} onClick={() => setSort("name")}>по алфавиту</SortChip>
        <SortChip active={sort === "last"} onClick={() => setSort("last")}>по последнему уроку</SortChip>
        <SortChip active={sort === "balance"} onClick={() => setSort("balance")}>по балансу</SortChip>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="py-8 text-center text-olive text-sm">Никого не нашлось</div>
      ) : (
        <div className="bg-ivory rounded-[14px] shadow-ring">
          {filtered.map((s, i) => {
            const ago = daysAgo(s.last_lesson_date);
            const isNew = s.first_lesson_date
              ? (daysAgo(s.first_lesson_date) ?? 999) < 30
              : false;
            const isStale = ago !== null && ago >= 10;
            const isLow = s.balance <= 0;
            return (
              <Link
                key={s.id}
                href={`/teacher/student/${s.id}`}
                className={`grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-[14px] no-underline text-near-black ${
                  i > 0 ? "border-t border-border-cream" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[16px] font-medium truncate">{s.full_name}</span>
                    {isNew && <Chip tone="warn" size="s">новый</Chip>}
                    {isLow && <Chip tone="bad" size="s">низкий баланс</Chip>}
                    {isStale && !isLow && <Chip tone="warn" size="s">давно не было</Chip>}
                    {s.is_charity && <Chip tone="neutral" size="s">благ.</Chip>}
                  </div>
                  <div className="text-[13px] text-olive tabular-nums mt-0.5">
                    {s.last_lesson_date
                      ? `${fmtDate(s.last_lesson_date)}${ago !== null ? ` · ${ago} дн.` : ""}`
                      : "Ещё не было уроков"}
                    {s.attendance_pct !== null && (
                      <span className="ml-2 text-stone">· посещ. {s.attendance_pct}%</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div
                    className={`font-serif text-[22px] font-medium tabular-nums leading-none ${
                      s.balance <= 0 ? "text-crimson" : ""
                    }`}
                  >
                    {s.balance}
                  </div>
                  <div className="text-[10px] font-medium uppercase tracking-[0.6px] text-stone mt-1">
                    уроков
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterPill({
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
          active ? "bg-[rgba(250,249,245,0.18)] text-ivory" : "bg-warm-sand text-charcoal"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function SortChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-[10px] py-[4px] rounded-full text-[12px] font-medium whitespace-nowrap ${
        active ? "bg-warm-sand text-near-black" : "text-stone hover:text-charcoal"
      }`}
    >
      {children}
    </button>
  );
}
