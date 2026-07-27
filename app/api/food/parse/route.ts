import { NextResponse } from "next/server";
import { AuthError, requireUserFromRequest } from "@/lib/auth-request";
import { matchParsedFoods } from "@/lib/match-foods";
import { parseMealText } from "@/lib/openai-parse";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    if (!checkRateLimit(`${user.telegram_id}:parse`, 30)) {
      return NextResponse.json({ error: "Rate limit" }, { status: 429 });
    }
    const body = (await request.json()) as { text?: string };
    const text = body.text?.trim() ?? "";
    if (!text) {
      return NextResponse.json({ error: "text required" }, { status: 400 });
    }
    const parsed = await parseMealText(text);
    const items = await matchParsedFoods(parsed);
    return NextResponse.json({ items });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error(e);
    const message =
      e instanceof Error && e.message
        ? e.message
        : "Не удалось разобрать, уточните описание";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
