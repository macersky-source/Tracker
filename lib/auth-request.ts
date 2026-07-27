import { parseInitDataUser, verifyInitData } from "./telegram";
import { upsertTelegramUser } from "./users";
import type { UserRow } from "./types";

export async function requireUserFromRequest(
  request: Request,
): Promise<UserRow> {
  const initData = request.headers.get("x-telegram-init-data");
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!initData || !botToken) {
    throw new AuthError("Missing init data or bot token");
  }
  if (!verifyInitData(initData, botToken)) {
    throw new AuthError("Invalid init data");
  }
  const tgUser = parseInitDataUser(initData);
  if (!tgUser) throw new AuthError("Missing user in init data");
  return upsertTelegramUser({
    telegram_id: tgUser.id,
    username: tgUser.username,
    first_name: tgUser.first_name,
  });
}

export class AuthError extends Error {
  status = 401;
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
