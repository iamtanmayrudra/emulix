import { cookies } from "next/headers";
import { after, connection } from "next/server";
import { getAuthStore } from "./store";
import { getMailer } from "./mailer";
import { createAuthService, type Schedule } from "./service";
import type { UserRecord } from "./store";

import { SESSION_COOKIE } from "./policy";

export { SESSION_COOKIE };

/**
 * The public base URL that links in emails point to. APP_URL is the server-side name. NEXT_PUBLIC_APP_URL is still read
 * so older setups keep working. In production one of them is required, because a link to localhost is never right.
 */
export function appUrl(): string {
  const configured = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") throw new Error("APP_URL is not set. Emailed links need the public address of the site.");
  return "http://localhost:3000";
}

/** Sends email after the response is out, so how long a request takes never shows whether an account exists. */
export const afterResponse: Schedule = (task) => after(task);

/** Builds the auth service on top of the process-wide store and mailer. */
export function getAuthService() {
  return createAuthService({ store: getAuthStore(), mailer: getMailer(), appUrl: appUrl() });
}

export function sessionCookieOptions(expires?: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    ...(expires ? { expires } : {}),
  };
}

/** The signed-in user for the current request, or null. Safe to call from server components and route handlers. */
export async function getCurrentUser(): Promise<UserRecord | null> {
  // Session expiry depends on the current time, so this must run per request, never at build time.
  await connection();
  const jar = await cookies();
  return getAuthService().getSessionUser(jar.get(SESSION_COOKIE)?.value);
}

/** Best-effort client address for rate limiting. Behind a proxy, the proxy must set x-forwarded-for. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0].trim() || "unknown";
}
