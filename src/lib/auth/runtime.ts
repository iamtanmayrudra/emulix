import { cookies } from "next/headers";
import { connection } from "next/server";
import { getAuthStore } from "./store";
import { getMailer } from "./mailer";
import { createAuthService } from "./service";
import type { UserRecord } from "./store";

import { SESSION_COOKIE } from "./policy";

export { SESSION_COOKIE };

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

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
