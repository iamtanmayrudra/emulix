import { NextResponse } from "next/server";
import { afterResponse, clientIp, getAuthService } from "@/lib/auth/runtime";
import { errorResponse, rateLimited, readJsonBody, stringField } from "@/lib/auth/http";
import { normalizeEmail } from "@/lib/auth/service";

export async function POST(request: Request) {
  const limited = rateLimited(`forgot:${clientIp(request)}`, 5, 15 * 60 * 1000);
  if (limited) return limited;

  try {
    const body = await readJsonBody(request);
    const email = stringField(body, "email");

    // Per address too, so one person's inbox cannot be flooded from many IPs. The key is the text submitted, whether or
    // not an account exists, so the limit says nothing about accounts.
    const limitedEmail = rateLimited(`forgot-email:${normalizeEmail(email)}`, 3, 15 * 60 * 1000);
    if (limitedEmail) return limitedEmail;

    // The email is sent after the response, so a slow or failing provider never shows whether the account exists.
    await getAuthService().requestPasswordReset(email, afterResponse);
    return NextResponse.json({
      ok: true,
      message: "If an account exists for that email, a reset link has been sent.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
