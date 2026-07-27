import { createHmac, timingSafeEqual } from "crypto";
import type { TelegramWebAppUser } from "./types";

export function verifyInitData(initData: string, botToken: string): boolean {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return false;

    const pairs: string[] = [];
    for (const [key, value] of params.entries()) {
      if (key === "hash") continue;
      pairs.push(`${key}=${value}`);
    }
    pairs.sort();
    const dataCheckString = pairs.join("\n");
    const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
    const computed = createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    const a = Buffer.from(computed, "hex");
    const b = Buffer.from(hash, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function parseInitDataUser(initData: string): TelegramWebAppUser | null {
  try {
    const params = new URLSearchParams(initData);
    const raw = params.get("user");
    if (!raw) return null;
    const user = JSON.parse(raw) as TelegramWebAppUser;
    if (typeof user.id !== "number") return null;
    return {
      id: user.id,
      first_name: user.first_name,
      username: user.username,
    };
  } catch {
    return null;
  }
}

export function verifyWebhookSecret(
  headerValue: string | null,
  expected: string,
): boolean {
  if (!headerValue || !expected) return false;
  const a = Buffer.from(headerValue);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
