import postgres from "postgres";
import { env } from "./env";

/**
 * Единый клиент Postgres на процесс.
 * В dev Next делает HMR и может создавать по соединению на перезапуск —
 * сохраняем инстанс в globalThis, чтобы не плодить пулы.
 */
declare global {
  // eslint-disable-next-line no-var
  var __sql: ReturnType<typeof postgres> | undefined;
}

export const sql =
  global.__sql ??
  postgres(env.DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // Совместимо с pgbouncer в transaction mode
  });

if (env.NODE_ENV !== "production") {
  global.__sql = sql;
}
