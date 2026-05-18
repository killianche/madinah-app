/**
 * Период «половина месяца»: 1–15 или 16–конец.
 * Используется в /manager/salary для head/admin.
 */

const RU_MONTHS = [
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
] as const;

export type Half = "first" | "second" | "all";

export interface HalfMonthRange {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  label: string;
  year: number;
  month: number; // 1-12
  half: Half;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function makeHalfMonth(
  year: number,
  month: number, // 1-12
  half: Half,
): HalfMonthRange {
  const lastDay = new Date(year, month, 0).getDate();
  const monthName = RU_MONTHS[month - 1]!;
  if (half === "all") {
    return {
      from: `${year}-${pad2(month)}-01`,
      to: `${year}-${pad2(month)}-${pad2(lastDay)}`,
      label: `${monthName} ${year}`,
      year,
      month,
      half,
    };
  }
  const fromDay = half === "first" ? 1 : 16;
  const toDay = half === "first" ? 15 : lastDay;
  return {
    from: `${year}-${pad2(month)}-${pad2(fromDay)}`,
    to: `${year}-${pad2(month)}-${pad2(toDay)}`,
    label: `${fromDay}–${toDay} ${monthName} ${year}`,
    year,
    month,
    half,
  };
}

export function currentHalfMonth(now: Date = new Date()): HalfMonthRange {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const half: Half = now.getDate() <= 15 ? "first" : "second";
  return makeHalfMonth(year, month, half);
}

/** Список последних N месяцев для пикера (новый в начале). */
export function recentMonths(count = 12, now: Date = new Date()): Array<{
  year: number;
  month: number;
  label: string;
}> {
  const out: Array<{ year: number; month: number; label: string }> = [];
  const y0 = now.getFullYear();
  const m0 = now.getMonth() + 1;
  for (let i = 0; i < count; i++) {
    const totalMonth = m0 - i;
    const year = y0 + Math.floor((totalMonth - 1) / 12);
    const month = ((totalMonth - 1) % 12 + 12) % 12 + 1;
    const monthName = RU_MONTHS[month - 1]!;
    const cap = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    out.push({ year, month, label: `${cap} ${year}` });
  }
  return out;
}

export function monthLabel(year: number, month: number): string {
  const monthName = RU_MONTHS[month - 1]!;
  const cap = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  return `${cap} ${year}`;
}
