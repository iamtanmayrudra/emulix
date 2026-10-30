import { NextResponse } from "next/server";
import { SESSION_COOKIE, clientIp, getAuthService, sessionCookieOptions } from "@/lib/auth/runtime";
import { errorResponse, rateLimited, readJsonBody, stringField } from "@/lib/auth/http";
import { getUserAccess } from "@/lib/org/runtime";

export async function POST(request: Request) {
  const limited = rateLimited(`login:${clientIp(request)}`, 30, 15 * 60 * 1000);
  if (limited) return limited;

  try {
    const body = await readJsonBody(request);
    const { sessionToken, user } = await getAuthService().login({
      email: stringField(body, "email"),
      password: stringField(body, "password"),
    });

    // A deactivated member cannot sign in, even with the right password.
    const access = getUserAccess(user.id);
    if (access.kind === "deactivated") {
      await getAuthService().logout(sessionToken);
      return NextResponse.json(
        { error: "deactivated", message: "This account has been deactivated. Ask your super admin." },
        { status: 403 },
      );
    }

    // Super admins and members without a seat each have one place to go, so they are sent there directly.
    const redirectTo = access.kind === "super_admin" ? "/admin/users" : access.kind === "no_seat" ? "/no-seat" : undefined;
    const response = NextResponse.json({ ok: true, emailVerified: user.emailVerifiedAt !== null, redirectTo });
    response.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions());
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
