/**
 * Haptic-feedback на устройствах с навигатором vibrate (Android Chrome, iOS PWA в standalone).
 * Безопасно вызывать в SSR — внутри проверяет окружение.
 */
type Strength = "light" | "medium" | "heavy" | "success" | "warning" | "error";

const PATTERNS: Record<Strength, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 40,
  success: [10, 30, 10],
  warning: [20, 40, 20],
  error: [30, 30, 30, 30, 60],
};

export function haptic(strength: Strength = "light"): void {
  if (typeof window === "undefined") return;
  const v = (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }).vibrate;
  if (typeof v !== "function") return;
  try {
    v(PATTERNS[strength]);
  } catch {
    // ignore — некоторые браузеры запрещают без user-gesture
  }
}
