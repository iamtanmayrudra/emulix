import { NextResponse } from "next/server";
import { errorResponse, rateLimited } from "@/lib/auth/http";
import { getCurrentUser } from "@/lib/auth/runtime";
import { platformGate } from "@/lib/org/runtime";
import { BrowserSessionFailure, captureBug } from "@/lib/testing/browser-sessions";

type Props = { params: Promise<{ id: string }> };

/** Each capture renders a full-resolution screenshot, so it is limited more tightly than ordinary input. */
const MAX_CAPTURES_PER_HOUR = 120;

/** Captures the live page: a screenshot plus the console, error and network evidence the session has gathered. */
export async function POST(_request: Request, { params }: Props) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in to capture a bug." }, { status: 401 });
  }

  const blocked = await platformGate(user, "POST /api/browser-sessions/:id/bug");
  if (blocked) return blocked;

  const limited = rateLimited(`bug-capture:${user.id}`, MAX_CAPTURES_PER_HOUR, 60 * 60 * 1000);
  if (limited) return limited;

  const { id } = await params;
  try {
    const capture = await captureBug(user.id, id);
    return NextResponse.json({ capture }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof BrowserSessionFailure) {
      const status = error.code === "not_found" ? 404 : 409;
      return NextResponse.json({ error: error.code, message: error.message }, { status });
    }
    return errorResponse(error);
  }
}
