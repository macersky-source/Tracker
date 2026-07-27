import { NextResponse } from "next/server";
import { AuthError, requireUserFromRequest } from "@/lib/auth-request";
import { updateUserGoals } from "@/lib/users";

export async function GET(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    return NextResponse.json({
      goals: {
        daily_calories: user.daily_calories,
        daily_protein: user.daily_protein,
        daily_fat: user.daily_fat,
        daily_carbs: user.daily_carbs,
      },
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    const body = (await request.json()) as Partial<{
      daily_calories: number;
      daily_protein: number;
      daily_fat: number;
      daily_carbs: number;
    }>;
    const goals: Partial<{
      daily_calories: number;
      daily_protein: number;
      daily_fat: number;
      daily_carbs: number;
    }> = {};
    for (const key of [
      "daily_calories",
      "daily_protein",
      "daily_fat",
      "daily_carbs",
    ] as const) {
      if (body[key] != null) {
        const n = Number(body[key]);
        if (!Number.isFinite(n) || n <= 0) {
          return NextResponse.json(
            { error: `${key} must be a positive number` },
            { status: 400 },
          );
        }
        goals[key] = Math.round(n);
      }
    }
    if (Object.keys(goals).length === 0) {
      return NextResponse.json({ error: "No goals provided" }, { status: 400 });
    }
    const updated = await updateUserGoals(user.telegram_id, goals);
    return NextResponse.json({
      goals: {
        daily_calories: updated.daily_calories,
        daily_protein: updated.daily_protein,
        daily_fat: updated.daily_fat,
        daily_carbs: updated.daily_carbs,
      },
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
