import { describe, it, expect, beforeEach } from "vitest";
import { resetDb, seed } from "../helpers";
import {
  assertTeacherOwnsStudent,
  assertTeacherOwnsLesson,
  canTransitionStudentStatus,
} from "@/lib/repos/students";

describe("assertTeacherOwnsStudent", () => {
  beforeEach(resetDb);

  it("разрешает учителю своего ученика", async () => {
    const { teacherA, studentOfA } = await seed();
    await expect(
      assertTeacherOwnsStudent(teacherA.user_id, studentOfA.id),
    ).resolves.toBeUndefined();
  });

  it("блокирует учителя на чужом ученике", async () => {
    const { teacherA, studentOfB } = await seed();
    await expect(
      assertTeacherOwnsStudent(teacherA.user_id, studentOfB.id),
    ).rejects.toThrow("not_owner");
  });
});

describe("assertTeacherOwnsLesson", () => {
  beforeEach(resetDb);

  it("разрешает учителю свой урок", async () => {
    const { teacherA, lessonOfA } = await seed();
    await expect(
      assertTeacherOwnsLesson(teacherA.user_id, lessonOfA.id),
    ).resolves.toBeUndefined();
  });

  it("блокирует учителя на чужом уроке (P0 #1 — главная цель этого теста)", async () => {
    const { teacherA, lessonOfB } = await seed();
    await expect(
      assertTeacherOwnsLesson(teacherA.user_id, lessonOfB.id),
    ).rejects.toThrow("not_owner");
  });
});

describe("canTransitionStudentStatus", () => {
  it("active → paused — ок", () => {
    expect(canTransitionStudentStatus("active", "paused", null)).toEqual({ ok: true });
  });

  it("dropped → active без reason — отказ", () => {
    const r = canTransitionStudentStatus("dropped", "active", null);
    expect(r.ok).toBe(false);
  });

  it("dropped → active с пустым reason — отказ", () => {
    const r = canTransitionStudentStatus("dropped", "active", "  ");
    expect(r.ok).toBe(false);
  });

  it("dropped → active с reason ≥ 3 символа — ок", () => {
    expect(
      canTransitionStudentStatus("dropped", "active", "вернулся"),
    ).toEqual({ ok: true });
  });

  it("closed → active требует reason", () => {
    expect(canTransitionStudentStatus("closed", "active", null).ok).toBe(false);
    expect(canTransitionStudentStatus("closed", "active", "ок").ok).toBe(false);
    expect(canTransitionStudentStatus("closed", "active", "ок передумал").ok).toBe(true);
  });

  it("active → active — отказ (тот же статус)", () => {
    expect(canTransitionStudentStatus("active", "active", null).ok).toBe(false);
  });

  it("первая смена (from null) — ок", () => {
    expect(canTransitionStudentStatus(null, "active", null)).toEqual({ ok: true });
  });
});
