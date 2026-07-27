import { NextResponse } from "next/server";
import { AuthError, requireUserFromRequest } from "@/lib/auth-request";
import { searchFoods } from "@/lib/fatsecret";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    if (!checkRateLimit(`${user.telegram_id}:search`, 60)) {
      return NextResponse.json({ error: "Rate limit" }, { status: 429 });
    }
    const q = new URL(request.url).searchParams.get("q")?.trim();
    if (!q) {
      return NextResponse.json({ error: "q required" }, { status: 400 });
    }
    const foods = await searchFoods(q);
    return NextResponse.json({ foods });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error(e);
    const message =
      e instanceof Error && e.message
        ? e.message
        : "База продуктов временно недоступна";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
