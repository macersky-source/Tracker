import { describe, expect, it } from "vitest";
import { checkRateLimit, _resetRateLimitsForTests } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  it("allows up to limit then blocks", () => {
    _resetRateLimitsForTests();
    expect(checkRateLimit("u1:search", 2)).toBe(true);
    expect(checkRateLimit("u1:search", 2)).toBe(true);
    expect(checkRateLimit("u1:search", 2)).toBe(false);
  });
});
