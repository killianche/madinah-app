/**
 * Утилиты для тестов:
 *  - resetDb() — TRUNCATE всех бизнес-таблиц перед каждым тестом, чтобы прогоны не влияли друг на друга.
 *  - seed(opts) — посеять минимальный набор: 2 учителя + 2 ученика + по уроку у каждого.
 *  - asUser(userId) — стопроцентного нет (server actions читают cookie, не аргумент);
 *    тесты вызывают функции репо напрямую, либо моким requireRole.
 *
 * Архитектура: тесты пишутся не на server actions целиком (они тянут next/headers),
 * а на функции из lib/repos/* и на pure-логику (валидаторы, политики).
 */

import postgres from "postgres";
import { hashPassword } from "@/lib/auth/password";

export function getSql() {
  return postgres(process.env.DATABASE_URL!);
}

export async function resetDb() {
  const sql = getSql();
  await sql`truncate table audit_log, user_sessions, lessons, balance_topups, attention_review,
                            student_schedules, students, teachers, users
                     restart identity cascade`;
  await sql.end();
}

export interface SeedResult {
  admin: { id: string };
  teacherA: { user_id: string; teacher_id: string };
  teacherB: { user_id: string; teacher_id: string };
  studentOfA: { id: string };
  studentOfB: { id: string };
  lessonOfA: { id: string };
  lessonOfB: { id: string };
}

export async function seed(): Promise<SeedResult> {
  const sql = getSql();
  const passwordHash = await hashPassword("test");
  try {
    const [admin] = await sql<Array<{ id: string }>>`
      insert into users (full_name, role, password_hash, is_active)
      values ('Admin', 'admin', ${passwordHash}, true)
      returning id
    `;
    const [tA] = await sql<Array<{ id: string }>>`
      insert into users (full_name, role, password_hash, is_active, login)
      values ('Teacher A', 'teacher', ${passwordHash}, true, 'teacher_a')
      returning id
    `;
    const [tB] = await sql<Array<{ id: string }>>`
      insert into users (full_name, role, password_hash, is_active, login)
      values ('Teacher B', 'teacher', ${passwordHash}, true, 'teacher_b')
      returning id
    `;
    const [teacherA] = await sql<Array<{ id: string }>>`
      insert into teachers (user_id, full_name, status)
      values (${tA!.id}, 'Teacher A', 'active') returning id
    `;
    const [teacherB] = await sql<Array<{ id: string }>>`
      insert into teachers (user_id, full_name, status)
      values (${tB!.id}, 'Teacher B', 'active') returning id
    `;
    const [studentA] = await sql<Array<{ id: string }>>`
      insert into students (full_name, status, teacher_id, balance, enrolled_at)
      values ('Student A', 'active', ${teacherA!.id}, 10, current_date - 30)
      returning id
    `;
    const [studentB] = await sql<Array<{ id: string }>>`
      insert into students (full_name, status, teacher_id, balance, enrolled_at)
      values ('Student B', 'active', ${teacherB!.id}, 10, current_date - 30)
      returning id
    `;
    const [lessonA] = await sql<Array<{ id: string }>>`
      insert into lessons (student_id, teacher_id, lesson_date, status, created_by)
      values (${studentA!.id}, ${teacherA!.id}, current_date - 1, 'conducted', ${tA!.id})
      returning id
    `;
    const [lessonB] = await sql<Array<{ id: string }>>`
      insert into lessons (student_id, teacher_id, lesson_date, status, created_by)
      values (${studentB!.id}, ${teacherB!.id}, current_date - 1, 'conducted', ${tB!.id})
      returning id
    `;

    return {
      admin: { id: admin!.id },
      teacherA: { user_id: tA!.id, teacher_id: teacherA!.id },
      teacherB: { user_id: tB!.id, teacher_id: teacherB!.id },
      studentOfA: { id: studentA!.id },
      studentOfB: { id: studentB!.id },
      lessonOfA: { id: lessonA!.id },
      lessonOfB: { id: lessonB!.id },
    };
  } finally {
    await sql.end();
  }
}
