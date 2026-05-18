"use client";

import { useMemo, useState } from "react";
import type { SalaryHalfMonthBucket } from "@/lib/repos/admin";
import {
  currentHalfMonth,
  recentMonths,
  type Half,
} from "@/lib/half-month";

const RU = "ru-RU";
const fmt = (n: number) => Math.round(n).toLocaleString(RU);
const fmtRub = (n: number) => `${Math.round(n).toLocaleString(RU)} ₽`;

const RU_MONTHS_FULL = [
  "январь",
  "февраль",
  "март",
  "апрель",
  "май",
  "июнь",
  "июль",
  "август",
  "сентябрь",
  "октябрь",
  "ноябрь",
  "декабрь",
];

function periodLabel(year: number, month: number, half: Half): string {
  const monthName = RU_MONTHS_FULL[month - 1];
  if (half === "all") return `${monthName} ${year}`;
  const lastDay = new Date(year, month, 0).getDate();
  const fromDay = half === "first" ? 1 : 16;
  const toDay = half === "first" ? 15 : lastDay;
  return `${fromDay}–${toDay} ${monthName} ${year}`;
}

function monthLabel(year: number, month: number): string {
  const m = RU_MONTHS_FULL[month - 1]!;
  return `${m.charAt(0).toUpperCase()}${m.slice(1)} ${year}`;
}

export function SalaryClient({
  data,
  rates,
}: {
  data: SalaryHalfMonthBucket[];
  rates: { rate_conducted: number; rate_penalty: number };
}) {
  const cur = useMemo(() => currentHalfMonth(), []);
  const [year, setYear] = useState(cur.year);
  const [month, setMonth] = useState(cur.month);
  const [half, setHalf] = useState<Half>(cur.half);

  const months = useMemo(() => recentMonths(12), []);

  // Группируем data по teacher_id и фильтруем по выбранному периоду.
  // Для half='all' — складываем обе половинки одного месяца у каждого учителя.
  const filtered = useMemo(() => {
    const monthBuckets = data.filter((b) => b.year === year && b.month === month);
    if (half !== "all") {
      return monthBuckets
        .filter((b) => b.half === half)
        .sort((a, b) => b.earned - a.earned || a.full_name.localeCompare(b.full_name));
    }
    // Аггрегируем обе половинки в один ряд на учителя.
    const map = new Map<string, SalaryHalfMonthBucket>();
    for (const b of monthBuckets) {
      const prev = map.get(b.teacher_id);
      if (!prev) {
        map.set(b.teacher_id, { ...b, half: "all" });
      } else {
        map.set(b.teacher_id, {
          ...prev,
          conducted: prev.conducted + b.conducted,
          penalty: prev.penalty + b.penalty,
          cancelled: prev.cancelled + b.cancelled,
          earned: prev.earned + b.earned,
        });
      }
    }
    return [...map.values()].sort(
      (a, b) => b.earned - a.earned || a.full_name.localeCompare(b.full_name),
    );
  }, [data, year, month, half]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.conducted += r.conducted;
        acc.penalty += r.penalty;
        acc.cancelled += r.cancelled;
        acc.earned += r.earned;
        return acc;
      },
      { conducted: 0, penalty: 0, cancelled: 0, earned: 0 },
    );
  }, [filtered]);

  return (
    <>
      <p className="text-[12px] text-olive mb-3">
        Период: <strong>{periodLabel(year, month, half)}</strong>. Ставки школы:{" "}
        {fmtRub(rates.rate_conducted)} провёл · {fmtRub(rates.rate_penalty)} штраф.
      </p>

      {/* Half tabs — instant client-side switch */}
      <div className="flex gap-2 mb-3">
        <TabButton active={half === "first"} onClick={() => setHalf("first")}>
          1–15
        </TabButton>
        <TabButton active={half === "second"} onClick={() => setHalf("second")}>
          16–конец
        </TabButton>
        <TabButton active={half === "all"} onClick={() => setHalf("all")}>
          Весь месяц
        </TabButton>
      </div>

      {/* Month picker — chips */}
      <div className="mb-4">
        <div className="text-[11px] uppercase tracking-[0.6px] font-medium text-stone mb-2">
          Месяц
        </div>
        <div className="flex flex-wrap gap-1.5">
          {months.map((m) => {
            const active = m.year === year && m.month === month;
            return (
              <button
                key={`${m.year}-${m.month}`}
                type="button"
                onClick={() => {
                  setYear(m.year);
                  setMonth(m.month);
                }}
                className={`text-[12px] px-2.5 py-1 rounded-full ${
                  active ? "bg-near-black text-ivory" : "bg-parchment text-charcoal"
                }`}
                style={active ? {} : { boxShadow: "inset 0 0 0 1px #e8e6dc" }}
              >
                {monthLabel(m.year, m.month)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <SummaryCard
          label="Уроков"
          value={fmt(totals.conducted + totals.penalty)}
          sub={`провёл ${fmt(totals.conducted)} · штраф ${fmt(totals.penalty)}`}
        />
        <SummaryCard
          label="Итого ФОТ"
          value={fmtRub(totals.earned)}
          sub={`${fmt(filtered.length)} учителей`}
          highlight
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div
          className="bg-ivory rounded-[14px] py-10 text-center"
          style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
        >
          <p className="text-olive text-[13px]">За этот период уроков ещё нет.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => (
            <li
              key={r.teacher_id}
              className="bg-ivory rounded-[14px] p-3.5"
              style={{ boxShadow: "inset 0 0 0 1px #f0eee6" }}
            >
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[15px] font-medium text-near-black truncate">
                      {r.full_name}
                    </span>
                    {r.status === "paused" && (
                      <span className="text-[10px] uppercase tracking-[0.4px] font-medium text-[#c89c6a] bg-[rgba(200,156,106,0.16)] px-1.5 py-0.5 rounded">
                        пауза
                      </span>
                    )}
                  </div>
                  <div className="text-[12px] text-olive mt-0.5 tabular-nums">
                    провёл {fmt(r.conducted)} · штраф {fmt(r.penalty)}
                    {r.cancelled > 0 ? ` · отм. ${fmt(r.cancelled)}` : ""}
                  </div>
                  <div className="text-[11px] text-stone mt-0.5 tabular-nums">
                    {fmtRub(r.rate_conducted)}/{fmtRub(r.rate_penalty)}
                  </div>
                </div>
                <div
                  className="font-medium text-[18px] tabular-nums leading-none text-near-black"
                  style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
                >
                  {fmtRub(r.earned)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px] text-stone text-center mt-4 leading-[1.5]">
        Зарплата = провёл × ставка_провёл + штраф × ставка_штраф. Отмены не оплачиваются.
        Данные кэшируются на 5 минут.
      </p>
    </>
  );
}

function TabButton({
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
      className={`flex-1 text-[13px] font-medium py-2 rounded-[10px] ${
        active ? "bg-near-black text-ivory" : "bg-parchment text-charcoal"
      }`}
      style={active ? {} : { boxShadow: "inset 0 0 0 1px #e8e6dc" }}
    >
      {children}
    </button>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-[14px] p-3.5 ${highlight ? "bg-[rgba(201,100,66,0.08)]" : "bg-ivory"}`}
      style={{
        boxShadow: highlight
          ? "inset 0 0 0 1px rgba(201,100,66,0.25)"
          : "inset 0 0 0 1px #f0eee6",
      }}
    >
      <div className="text-[10px] uppercase tracking-[0.6px] font-medium text-stone mb-1">
        {label}
      </div>
      <div
        className="font-medium text-[20px] leading-none tabular-nums text-near-black"
        style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
      >
        {value}
      </div>
      {sub && <div className="text-[11px] text-olive mt-1 tabular-nums">{sub}</div>}
    </div>
  );
}
