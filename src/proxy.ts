import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/policy";

/**
 * Sends signed-out visitors to sign-in before any page starts rendering. The check only looks for the session
 * cookie. Each page still validates the session on the server, so a stale cookie is still refused there.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/dashboard/:path*", "/test/:path*", "/apk/:path*", "/reports/:path*", "/profile/:path*", "/checkout/:path*", "/admin/:path*", "/no-seat"],
};
