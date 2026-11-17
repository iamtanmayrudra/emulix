import { NextResponse } from "next/server";
import { errorResponse, rateLimited } from "@/lib/auth/http";
import { getCurrentUser } from "@/lib/auth/runtime";
import { PLAN_LIMITS, type Plan } from "@/lib/mock-data";
import { effectiveSubscription, platformGate } from "@/lib/org/runtime";
import { planForUser } from "@/lib/testing/jobs";
import { AI_STATUS_BY_CODE, AiFailure } from "./errors";
import { getAiUsage } from "./quota";
import type { AiErrorBody } from "./types";

/** Model calls cost money, so each user is also limited to this many requests an hour, whatever their allowance. */
const MAX_AI_REQUESTS_PER_HOUR = 60;

const NO_STORE = { "Cache-Control": "private, no-store" };

function errorBody(status: number, body: AiErrorBody): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/**
 * The checks every AI route starts with, in order: signed in, platform access, monthly allowance left, hourly rate limit.
 * Returns the caller, or the response to send. The allowance is only checked here and is spent later, when the model is
 * called, so a request that is rate limited or served from the cache costs nothing.
 */
export async function gateAi(endpoint: string): Promise<{ userId: string; plan: Plan } | NextResponse> {
  const user = await getCurrentUser();
  if (!user) return errorBody(401, { error: "unauthorized", message: "Sign in to use AI features." });

  const blocked = await platformGate(user, endpoint);
  if (blocked) return blocked;

  const plan = planForUser(effectiveSubscription(user));
  const { used, limit } = getAiUsage(user.id, plan);
  if (used >= limit) {
    return plan === "free"
      ? errorBody(429, {
          error: "quota_exceeded",
          message: `You have used all ${limit} free AI requests this month. Upgrade to Pro for ${PLAN_LIMITS.pro.aiCreditsPerPeriod} a month.`,
          upgradeUrl: "/checkout",
        })
      : errorBody(429, { error: "quota_exceeded", message: `You have used all ${limit} AI requests this month. The allowance resets next month.` });
  }

  const limited = rateLimited(`ai:${user.id}`, MAX_AI_REQUESTS_PER_HOUR, 60 * 60 * 1000);
  if (limited) return limited;

  return { userId: user.id, plan };
}

export function aiErrorResponse(error: unknown): NextResponse {
  if (error instanceof AiFailure) {
    return errorBody(AI_STATUS_BY_CODE[error.code], { error: error.code, message: error.message });
  }
  return errorResponse(error);
}

export function aiJson(body: unknown): NextResponse {
  return NextResponse.json(body, { headers: NO_STORE });
}
