import { NextResponse } from "next/server";
import { afterResponse, clientIp, getAuthService } from "@/lib/auth/runtime";
import { errorResponse, rateLimited, readJsonBody, stringField } from "@/lib/auth/http";

export async function POST(request: Request) {
  const limited = rateLimited(`signup:${clientIp(request)}`, 10, 60 * 60 * 1000);
  if (limited) return limited;

  try {
    const body = await readJsonBody(request);
    // The verification email goes out after the response. A failure is logged and the person can ask for a new link,
    // which keeps this answer the same for new and existing addresses.
    await getAuthService().signUp(
      {
        email: stringField(body, "email"),
        name: stringField(body, "name"),
        password: stringField(body, "password"),
      },
      afterResponse,
    );
    return NextResponse.json({
      ok: true,
      message: "Check your email for a link to verify your account.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
