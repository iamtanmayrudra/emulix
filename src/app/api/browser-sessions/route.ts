import { NextResponse } from "next/server";
import { errorResponse, rateLimited, readJsonBody, stringField } from "@/lib/auth/http";
import { getCurrentUser } from "@/lib/auth/runtime";
import { effectiveSubscription, platformGate } from "@/lib/org/runtime";
import { BrowserSessionFailure, startBrowserSession } from "@/lib/testing/browser-sessions";
import { planForUser } from "@/lib/testing/jobs";

/** Picking a device opens a browser on it, so browsing a dozen devices should not hit the limit. */
const MAX_LAUNCHES_PER_HOUR = 90;

const STATUS_BY_CODE: Record<BrowserSessionFailure["code"], number> = {
  invalid_url: 400,
  unknown_profile: 400,
  plan_required: 403,
  concurrency_limit: 429,
  unsafe_target: 400,
  invalid_input: 400,
  launch_failed: 503,
  not_found: 404,
  input_failed: 409,
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in to open a browser." }, { status: 401 });
  }

  // A super admin controls accounts only, and a member without a seat cannot use the platform. New browsers are refused.
  const blocked = await platformGate(user, "POST /api/browser-sessions");
  if (blocked) return blocked;

  const limited = rateLimited(`browser-sessions:${user.id}`, MAX_LAUNCHES_PER_HOUR, 60 * 60 * 1000);
  if (limited) return limited;

  try {
    const body = await readJsonBody(request);
    const session = await startBrowserSession({
      userId: user.id,
      url: stringField(body, "url"),
      profileId: stringField(body, "profileId"),
      landscape: body.landscape === true,
      plan: planForUser(effectiveSubscription(user)),
    });
    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    if (error instanceof BrowserSessionFailure) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: STATUS_BY_CODE[error.code] });
    }
    return errorResponse(error);
  }
}
