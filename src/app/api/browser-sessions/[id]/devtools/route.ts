import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/auth/http";
import { getCurrentUser } from "@/lib/auth/runtime";
import { effectiveSubscription } from "@/lib/org/runtime";
import { BrowserSessionFailure, getDevtools } from "@/lib/testing/browser-sessions";
import { planForUser } from "@/lib/testing/jobs";

type Props = { params: Promise<{ id: string }> };

/**
 * The live page's console and network log. DevTools is a Pro feature, so the plan is checked here on every request:
 * the panel in the browser only decides what to show. Returns `{ unchanged: true }` when nothing is new since ?after.
 */
export async function GET(request: Request, { params }: Props) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in to use DevTools." }, { status: 401 });
  }

  if (planForUser(effectiveSubscription(user)) !== "pro") {
    return NextResponse.json(
      { error: "plan_required", message: "DevTools is available on Pro. Upgrade to inspect the page's console and network.", upgradeUrl: "/checkout" },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const { id } = await params;
  const after = Number(new URL(request.url).searchParams.get("after") ?? "0");
  try {
    const snapshot = getDevtools(user.id, id, Number.isFinite(after) ? after : 0);
    return NextResponse.json(snapshot ?? { unchanged: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof BrowserSessionFailure) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.code === "not_found" ? 404 : 409 });
    }
    return errorResponse(error);
  }
}
