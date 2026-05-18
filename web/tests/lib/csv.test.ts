import { describe, it, expect } from "vitest";
import { toCSV } from "@/lib/csv";

describe("toCSV", () => {
  it("экранирует запятые и кавычки", () => {
    const csv = toCSV(
      [{ name: 'Иван "Длин" Петров, мл.', age: 30 }],
      [
        { key: "name", label: "ФИО" },
        { key: "age", label: "Возраст" },
      ],
    );
    expect(csv).toContain('"Иван ""Длин"" Петров, мл."');
    expect(csv.startsWith("﻿")).toBe(true);
  });

  it("пустые значения = пустая строка", () => {
    const csv = toCSV(
      [{ a: null, b: undefined, c: "x" }],
      [
        { key: "a", label: "A" },
        { key: "b", label: "B" },
        { key: "c", label: "C" },
      ],
    );
    expect(csv).toContain(",,x");
  });

  it("числа без кавычек", () => {
    const csv = toCSV([{ n: 42 }], [{ key: "n", label: "N" }]);
    expect(csv).toContain("42\n");
    expect(csv).not.toContain('"42"');
  });
});
