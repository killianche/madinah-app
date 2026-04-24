import { z } from "zod";

/**
 * Валидация переменных окружения на старте.
 * Если что-то не так — падаем сразу с понятной ошибкой.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url().startsWith("postgres"),
  // Base URL приложения (для cookies и redirects)
  APP_URL: z.string().url().default("http://localhost:3000"),
  // Секрет для CSRF и прочих подписей (не используется Lucia, но пригодится)
  SESSION_SECRET: z.string().min(32).default("change-me-in-production-1234567890"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Неверные переменные окружения:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
