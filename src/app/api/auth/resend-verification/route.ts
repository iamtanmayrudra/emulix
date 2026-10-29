import { NextResponse } from "next/server";
import { getAuthService, getCurrentUser } from "@/lib/auth/runtime";
import { errorResponse, rateLimited } from "@/lib/auth/http";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "unauthorized", message: "Sign in to resend the verification email." },
        { status: 401 },
      );
    }

    const limited = rateLimited(`resend:${user.id}`, 5, 60 * 60 * 1000);
    if (limited) return limited;

    await getAuthService().resendVerification(user.id);
    return NextResponse.json({ ok: true, message: "If your email is not verified yet, a new link is on its way." });
  } catch (error) {
    return errorResponse(error);
  }
}
