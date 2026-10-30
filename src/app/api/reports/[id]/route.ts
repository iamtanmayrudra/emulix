import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/runtime";
import { platformGate } from "@/lib/org/runtime";
import { removeReport } from "@/lib/reports";

/** Removes one finished report from the user's history. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in to manage your reports." }, { status: 401 });
  }
  const blocked = await platformGate(user, "DELETE /api/reports/:id");
  if (blocked) return blocked;

  const { id } = await params;
  if (!removeReport(user.id, decodeURIComponent(id))) {
    return NextResponse.json({ error: "not_found", message: "That report was not found, or it is still running." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
