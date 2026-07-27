import { NextResponse } from "next/server";
import { tgSendMessage } from "@/lib/bot";
import { listEntries, sumMacros } from "@/lib/diary";
import { verifyWebhookSecret } from "@/lib/telegram";
import { upsertTelegramUser } from "@/lib/users";

type TgUpdate = {
  message?: {
    text?: string;
    chat: { id: number };
    from?: { id: number; first_name?: string; username?: string };
  };
};

export async function POST(request: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  const header = request.headers.get("x-telegram-bot-api-secret-token");
  if (!verifyWebhookSecret(header, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const update = (await request.json()) as TgUpdate;
  const message = update.message;
  if (!message?.text || !message.from) {
    return NextResponse.json({ ok: true });
  }

  const chatId = message.chat.id;
  const text = message.text.trim();
  const webAppUrl = process.env.TELEGRAM_WEBAPP_URL;

  try {
    if (text.startsWith("/start")) {
      await tgSendMessage(
        chatId,
        "Привет! Я трекер калорий. Открой мини-апку, чтобы вести дневник.",
        webAppUrl
          ? {
              inline_keyboard: [
                [{ text: "Открыть трекер", web_app: { url: webAppUrl } }],
              ],
            }
          : undefined,
      );
    } else if (text.startsWith("/today")) {
      const user = await upsertTelegramUser({
        telegram_id: message.from.id,
        username: message.from.username,
        first_name: message.from.first_name,
      });
      const date = new Date().toISOString().slice(0, 10);
      const entries = await listEntries(user.id, date);
      const totals = sumMacros(entries);
      await tgSendMessage(
        chatId,
        `Сегодня: ${Math.round(totals.calories)} / ${user.daily_calories} ккал\nБ ${Math.round(totals.protein)} · Ж ${Math.round(totals.fat)} · У ${Math.round(totals.carbs)}\nЗаписей: ${entries.length}`,
      );
    } else {
      await tgSendMessage(
        chatId,
        "Открой мини-апку кнопкой ниже или командой /start. Быстрый ввод текстом — через вкладку «Текст» в апке.",
        webAppUrl
          ? {
              inline_keyboard: [
                [{ text: "Открыть трекер", web_app: { url: webAppUrl } }],
              ],
            }
          : undefined,
      );
    }
  } catch (e) {
    console.error(e);
  }

  return NextResponse.json({ ok: true });
}
