import { NextResponse } from "next/server";
import { AuthError, requireUserFromRequest } from "@/lib/auth-request";
import { deleteEntry } from "@/lib/diary";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUserFromRequest(request);
    const { id } = await context.params;
    const ok = await deleteEntry(user.id, id);
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
