import { describe, expect, it } from "vitest";
import {
  extractJsonArray,
  normalizeParsedItems,
} from "@/lib/openai-parse";

describe("extractJsonArray / normalizeParsedItems", () => {
  it("parses plain array", () => {
    const data = extractJsonArray(
      '[{"name":"гречка","amount":150,"unit":"г"}]',
    );
    expect(normalizeParsedItems(data)).toEqual([
      { name: "гречка", amount: 150, unit: "г" },
    ]);
  });

  it("parses fenced markdown", () => {
    const data = extractJsonArray(
      '```json\n[{"name":"курица","amount":120,"unit":"г"}]\n```',
    );
    expect(normalizeParsedItems(data)).toEqual([
      { name: "курица", amount: 120, unit: "г" },
    ]);
  });

  it("throws on invalid item", () => {
    expect(() =>
      normalizeParsedItems([{ name: "", amount: 0, unit: "г" }]),
    ).toThrow();
  });
});
