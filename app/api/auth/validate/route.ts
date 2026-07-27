import { NextResponse } from "next/server";
import { AuthError, requireUserFromRequest } from "@/lib/auth-request";

export async function POST(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    return NextResponse.json({ user });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
