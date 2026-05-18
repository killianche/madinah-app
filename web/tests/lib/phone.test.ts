import { describe, it, expect } from "vitest";
import { normalizePhone } from "@/lib/auth/phone";

describe("normalizePhone", () => {
  it("приводит к +7XXXXXXXXXX", () => {
    expect(normalizePhone("89991234567")).toBe("+79991234567");
    expect(normalizePhone("79991234567")).toBe("+79991234567");
    expect(normalizePhone("+7 (999) 123-45-67")).toBe("+79991234567");
    expect(normalizePhone("+7-999-123-45-67")).toBe("+79991234567");
  });

  it("оставляет логин без изменений", () => {
    expect(normalizePhone("saydum1")).toBe("saydum1");
    expect(normalizePhone("teacher_a")).toBe("teacher_a");
  });

  it("пустую строку или короткую — возвращает как есть", () => {
    expect(normalizePhone("")).toBe("");
    expect(normalizePhone("123")).toBe("123");
  });
});
