import { NextResponse } from "next/server";
import { SESSION_COOKIE, getAuthService, sessionCookieOptions } from "@/lib/auth/runtime";
import { errorResponse, readJsonBody, stringField } from "@/lib/auth/http";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const sessionToken = await getAuthService().verifyEmail(stringField(body, "token"));

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions());
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
