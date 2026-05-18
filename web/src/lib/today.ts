/**
 * Возвращает сегодняшнюю дату в формате YYYY-MM-DD в ТЕКУЩЕЙ тайм-зоне.
 * (не UTC — важно, так как TZ=Europe/Moscow в контейнере).
 */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
