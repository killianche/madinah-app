/**
 * Нормализует телефон к виду +7XXXXXXXXXX.
 * Принимает: +79991234567, 89991234567, 79991234567,
 * с пробелами/скобками/дефисами.
 * Если это не похоже на телефон (например логин "saydum1"),
 * возвращает оригинальную строку без изменений.
 */
export function normalizePhone(input: string): string {
  const trimmed = input.trim();
  // Оставляем только цифры + ведущий +
  const digits = trimmed.replace(/[^\d+]/g, "");
  // Если меньше 10 цифр — не телефон, возвращаем как есть
  const onlyDigits = digits.replace(/^\+/, "");
  if (onlyDigits.length < 10) return trimmed;

  // Варианты:
  // +7XXXXXXXXXX  → +7XXXXXXXXXX
  // 8XXXXXXXXXX   → +7XXXXXXXXXX
  // 7XXXXXXXXXX   → +7XXXXXXXXXX
  if (digits.startsWith("+7") && onlyDigits.length === 11) return digits;
  if (onlyDigits.length === 11) {
    if (onlyDigits.startsWith("7")) return "+7" + onlyDigits.slice(1);
    if (onlyDigits.startsWith("8")) return "+7" + onlyDigits.slice(1);
  }
  // Не смогли нормализовать — возвращаем оригинал
  return trimmed;
}
