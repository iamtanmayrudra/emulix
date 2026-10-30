import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/runtime";
import { platformGate } from "@/lib/org/runtime";
import { clearReports, listReports } from "@/lib/reports";

async function caller(detail: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { response: NextResponse.json({ error: "unauthorized", message: "Sign in to see your reports." }, { status: 401 }) };
  }
  // Reports are a member's own work. A super admin, or a member without a seat, cannot read them.
  const blocked = await platformGate(user, detail);
  if (blocked) return { response: blocked };
  return { user };
}

/** The signed-in user's reports, newest first. */
export async function GET() {
  const result = await caller("GET /api/reports");
  if (result.response) return result.response;
  return NextResponse.json({ entries: listReports(result.user.id) }, { headers: { "Cache-Control": "private, no-store" } });
}

/** Clears the user's finished reports. */
export async function DELETE() {
  const result = await caller("DELETE /api/reports");
  if (result.response) return result.response;
  return NextResponse.json({ ok: true, removed: clearReports(result.user.id) });
}
