import { NextResponse } from "next/server";
import { AuthError, requireUserFromRequest } from "@/lib/auth-request";
import { createEntry, listEntries, sumMacros } from "@/lib/diary";
import type { EntrySource, MealType } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    const url = new URL(request.url);
    const date =
      url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
    const entries = await listEntries(user.id, date);
    return NextResponse.json({
      date,
      entries,
      totals: sumMacros(entries),
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

export async function POST(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    const body = (await request.json()) as {
      entry_date?: string;
      meal_type?: MealType;
      food_name?: string;
      calories?: number;
      protein?: number;
      fat?: number;
      carbs?: number;
      serving_amount?: number;
      serving_unit?: string;
      source?: EntrySource;
      fatsecret_id?: string;
      raw_input?: string;
    };
    if (!body.food_name || body.calories == null || !body.source) {
      return NextResponse.json(
        { error: "food_name, calories, source required" },
        { status: 400 },
      );
    }
    const entry = await createEntry({
      user_id: user.id,
      entry_date: body.entry_date ?? new Date().toISOString().slice(0, 10),
      meal_type: body.meal_type,
      food_name: body.food_name,
      calories: Number(body.calories),
      protein: body.protein,
      fat: body.fat,
      carbs: body.carbs,
      serving_amount: body.serving_amount,
      serving_unit: body.serving_unit,
      source: body.source,
      fatsecret_id: body.fatsecret_id,
      raw_input: body.raw_input,
    });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 503 });
  }
}
