import { NextResponse } from "next/server";
import { SESSION_COOKIE, clientIp, getAuthService, sessionCookieOptions } from "@/lib/auth/runtime";
import { errorResponse, rateLimited, readJsonBody, stringField } from "@/lib/auth/http";

export async function POST(request: Request) {
  const limited = rateLimited(`login:${clientIp(request)}`, 30, 15 * 60 * 1000);
  if (limited) return limited;

  try {
    const body = await readJsonBody(request);
    const { sessionToken, user } = await getAuthService().login({
      email: stringField(body, "email"),
      password: stringField(body, "password"),
    });

    const response = NextResponse.json({ ok: true, emailVerified: user.emailVerifiedAt !== null });
    response.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions());
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
