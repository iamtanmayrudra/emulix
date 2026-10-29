import { NextResponse } from "next/server";
import { clientIp, getAuthService } from "@/lib/auth/runtime";
import { errorResponse, rateLimited, readJsonBody, stringField } from "@/lib/auth/http";

export async function POST(request: Request) {
  const limited = rateLimited(`forgot:${clientIp(request)}`, 5, 15 * 60 * 1000);
  if (limited) return limited;

  try {
    const body = await readJsonBody(request);
    await getAuthService().requestPasswordReset(stringField(body, "email"));
    return NextResponse.json({
      ok: true,
      message: "If an account exists for that email, a reset link has been sent.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
