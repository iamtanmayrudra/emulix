import { NextResponse } from "next/server";
import { rateLimited } from "../auth/http";
import { getCurrentUser } from "../auth/runtime";
import type { UserRecord } from "../auth/store";

/** The signed-in user for an organization endpoint, or the response to send. Calls are rate limited per person. */
export async function orgCaller(): Promise<{ user: UserRecord; response?: undefined } | { user?: undefined; response: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) {
    return { response: NextResponse.json({ error: "unauthorized", message: "Sign in to continue." }, { status: 401 }) };
  }
  const limited = rateLimited(`org:${user.id}`, 120, 15 * 60 * 1000);
  if (limited) return { response: limited };
  return { user };
}
