import { NextResponse } from "next/server";
import { AuthError, requireUserFromRequest } from "@/lib/auth-request";
import { getFood } from "@/lib/fatsecret";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUserFromRequest(request);
    if (!checkRateLimit(`${user.telegram_id}:search`, 60)) {
      return NextResponse.json({ error: "Rate limit" }, { status: 429 });
    }
    const { id } = await context.params;
    const food = await getFood(id);
    return NextResponse.json({ food });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json(
      { error: "База продуктов временно недоступна" },
      { status: 502 },
    );
  }
}
