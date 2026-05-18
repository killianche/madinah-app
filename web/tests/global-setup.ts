/**
 * vitest globalSetup — выполняется ДО всех файлов тестов и до их imports.
 * Поднимает Postgres в testcontainers, накатывает миграции, кладёт URL в process.env
 * чтобы lib/env.ts валидация прошла.
 */

import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

let container: StartedPostgreSqlContainer | null = null;

export async function setup() {
  container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("madinah_test")
    .withUsername("test")
    .withPassword("test")
    .start();

  process.env.DATABASE_URL = container.getConnectionUri();
  process.env.SESSION_COOKIE_NAME = "session";
  process.env.SESSION_COOKIE_SECURE = "false";

  const sql = postgres(process.env.DATABASE_URL);
  const migrationsDir = path.resolve(__dirname, "../../db/migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    const content = readFileSync(path.join(migrationsDir, f), "utf8");
    await sql.unsafe(content);
  }
  await sql.end();
}

export async function teardown() {
  if (container) await container.stop();
}
