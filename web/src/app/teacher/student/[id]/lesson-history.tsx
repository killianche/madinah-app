"use client";

import { useState, useMemo } from "react";
import { Chip } from "@/components/ui/chip";
import type { LessonStatus } from "@/lib/types";
import { LESSON_STATUS_LABEL } from "@/lib/types";

export interface LessonRow {
  id: string;
  lesson_date: string | Date;
  status: LessonStatus;
  teacher_name: string;
  topic: string | null;
  ordinal: number;
}

type Filter = "all" | "held" | "bad";

function fmtDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function statusChip(status: LessonStatus) {
  if (status === "conducted")
    return (
      <Chip tone="good" size="s">
        проведён
      </Chip>
    );
  if (status === "penalty")
    return (
      <Chip tone="bad" size="s">
        штраф
      </Chip>
    );
  // cancelled_by_student / cancelled_by_teacher — жёлтая пилюля
  return (
    <Chip tone="amber" size="s">
      {LESSON_STATUS_LABEL[status]}
    </Chip>
  );
}

export function LessonHistory({ lessons }: { lessons: LessonRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(20);

  const filtered = useMemo(() => {
    return lessons.filter((l) => {
      if (filter === "all") return true;
      if (filter === "held") return l.status === "conducted";
      return l.status !== "conducted"; // bad
    });
  }, [filter, lessons]);

  const shown = filtered.slice(0, limit);

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-[6px] mb-3">
        <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>
          Все
        </FilterPill>
        <FilterPill active={filter === "held"} onClick={() => setFilter("held")}>
          Проведённые
        </FilterPill>
        <FilterPill active={filter === "bad"} onClick={() => setFilter("bad")}>
          Проблемные
        </FilterPill>
        <span className="ml-auto text-[12px] text-stone tabular-nums">
          {filtered.length} всего
        </span>
      </div>

      {shown.length === 0 ? (
        <div className="bg-ivory rounded-[14px] shadow-ring p-4 text-olive text-sm">
          Нет уроков в выбранной категории.
        </div>
      ) : (
        <div className="bg-ivory rounded-[14px] shadow-ring px-4">
          {shown.map((l, i) => (
            <div
              key={l.id}
              className={`grid grid-cols-[44px_1fr_auto] gap-3 items-center py-[14px] ${
                i > 0 ? "border-t border-border-cream" : ""
              }`}
            >
              <span className="font-serif text-[20px] tabular-nums text-near-black">
                #{l.ordinal}
              </span>
              <div className="min-w-0">
                <div className="font-medium text-[15px] tabular-nums">
                  {fmtDate(l.lesson_date)}
                </div>
                <div className="text-[13px] text-olive truncate">
                  {l.teacher_name}
                  {l.topic ? ` · ${l.topic}` : ""}
                </div>
              </div>
              {statusChip(l.status)}
            </div>
          ))}
          {filtered.length > limit && (
            <button
              type="button"
              onClick={() => setLimit((n) => n + 20)}
              className="w-full my-2 py-[10px] text-[14px] font-medium text-charcoal rounded-[12px]"
              style={{ boxShadow: "inset 0 0 0 1px #e8e6dc" }}
            >
              Показать ещё
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FilterPill({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[13px] font-medium px-[10px] py-[6px] rounded-full transition-colors ${
        active
          ? "bg-near-black text-ivory"
          : "text-charcoal"
      }`}
      style={!active ? { boxShadow: "inset 0 0 0 1px #e8e6dc" } : {}}
    >
      {children}
    </button>
  );
}
