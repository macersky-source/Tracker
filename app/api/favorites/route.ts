import { NextResponse } from "next/server";
import { AuthError, requireUserFromRequest } from "@/lib/auth-request";
import { addFavorite, listFavorites } from "@/lib/favorites";

export async function GET(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    const favorites = await listFavorites(user.id);
    return NextResponse.json({ favorites });
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
      food_name?: string;
      fatsecret_id?: string;
      default_serving?: Record<string, unknown>;
    };
    if (!body.food_name) {
      return NextResponse.json({ error: "food_name required" }, { status: 400 });
    }
    const favorite = await addFavorite({
      user_id: user.id,
      food_name: body.food_name,
      fatsecret_id: body.fatsecret_id,
      default_serving: body.default_serving,
    });
    return NextResponse.json({ favorite }, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
