import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, getAuthService, sessionCookieOptions } from "@/lib/auth/runtime";
import { errorResponse } from "@/lib/auth/http";

export async function POST() {
  try {
    const jar = await cookies();
    await getAuthService().logout(jar.get(SESSION_COOKIE)?.value);

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(new Date(0)));
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
