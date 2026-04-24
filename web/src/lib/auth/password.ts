import { hash, verify } from "@node-rs/argon2";

/**
 * argon2id с параметрами OWASP recommended (на 2024-2025).
 * memory=19MB, iterations=2, parallelism=1 — сбалансировано для ~100ms на современном железе.
 */
const OPTIONS = {
  memoryCost: 19_456, // 19 MB
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(
  hashStr: string,
  password: string,
): Promise<boolean> {
  return verify(hashStr, password, OPTIONS);
}

/**
 * Генерирует случайный временный пароль, который админ выдаёт пользователю.
 * 12 символов, уверенная энтропия, читаемый (без 0/O/1/l).
 */
export function generateTempPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
