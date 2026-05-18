/**
 * Превращает массив объектов в CSV-строку с BOM для корректного открытия в Excel
 * с кириллицей. Запятые/кавычки/переводы строк экранируются по RFC 4180.
 */
export function toCSV<T extends Record<string, unknown>>(
  rows: T[],
  columns: Array<{ key: keyof T; label: string; map?: (v: unknown, row: T) => string | number }>,
): string {
  const head = columns.map((c) => quote(c.label)).join(",");
  const body = rows
    .map((r) =>
      columns
        .map((c) => {
          const raw = c.map ? c.map(r[c.key], r) : r[c.key];
          return quote(formatValue(raw));
        })
        .join(","),
    )
    .join("\n");
  return "\uFEFF" + head + "\n" + body + "\n";
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "да" : "нет";
  return String(v);
}

function quote(v: string): string {
  if (/[",\n\r;]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function downloadCSV(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
