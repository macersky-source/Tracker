import { describe, expect, it } from "vitest";
import { sumMacros } from "@/lib/diary";

describe("sumMacros", () => {
  it("sums calories and macros", () => {
    expect(
      sumMacros([
        { calories: 100, protein: 10, fat: 5, carbs: 8 },
        { calories: 50.5, protein: 1, fat: 2, carbs: 3 },
      ]),
    ).toEqual({ calories: 150.5, protein: 11, fat: 7, carbs: 11 });
  });

  it("returns zeros for empty list", () => {
    expect(sumMacros([])).toEqual({
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
    });
  });
});
