import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import {
  parseInitDataUser,
  verifyInitData,
  verifyWebhookSecret,
} from "@/lib/telegram";

function buildInitData(user: object, botToken: string): string {
  const userJson = JSON.stringify(user);
  const params = new URLSearchParams();
  params.set("user", userJson);
  params.set("auth_date", "1700000000");
  params.set("query_id", "AAEAAAE");

  const filtered: string[] = [];
  for (const [k, v] of params.entries()) {
    if (k !== "hash") filtered.push(`${k}=${v}`);
  }
  filtered.sort();
  const dataCheckString = filtered.join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");
  params.set("hash", hash);
  return params.toString();
}

describe("verifyInitData", () => {
  const token = "123456:ABC-DEF";

  it("accepts valid initData", () => {
    const initData = buildInitData(
      { id: 42, first_name: "Maksim", username: "m" },
      token,
    );
    expect(verifyInitData(initData, token)).toBe(true);
  });

  it("rejects tampered initData", () => {
    const initData = buildInitData({ id: 42, first_name: "Maksim" }, token);
    expect(verifyInitData(initData + "x", token)).toBe(false);
  });

  it("rejects wrong bot token", () => {
    const initData = buildInitData({ id: 42 }, token);
    expect(verifyInitData(initData, "wrong")).toBe(false);
  });
});

describe("parseInitDataUser", () => {
  it("returns user id from valid initData", () => {
    const token = "123456:ABC-DEF";
    const initData = buildInitData(
      { id: 99, first_name: "A", username: "u" },
      token,
    );
    expect(verifyInitData(initData, token)).toBe(true);
    expect(parseInitDataUser(initData)).toEqual({
      id: 99,
      first_name: "A",
      username: "u",
    });
  });
});

describe("verifyWebhookSecret", () => {
  it("matches expected secret", () => {
    expect(verifyWebhookSecret("s3cret", "s3cret")).toBe(true);
    expect(verifyWebhookSecret("nope", "s3cret")).toBe(false);
    expect(verifyWebhookSecret(null, "s3cret")).toBe(false);
  });
});
