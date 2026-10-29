import { NextResponse } from "next/server";
import { getAuthService } from "@/lib/auth/runtime";
import { errorResponse, readJsonBody, stringField } from "@/lib/auth/http";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    await getAuthService().resetPassword(stringField(body, "token"), stringField(body, "password"));
    return NextResponse.json({ ok: true, message: "Password updated. Sign in with your new password." });
  } catch (error) {
    return errorResponse(error);
  }
}
