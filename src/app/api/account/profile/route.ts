import { NextResponse } from "next/server";
import { errorResponse, rateLimited, readJsonBody } from "@/lib/auth/http";
import { getAuthService, getCurrentUser } from "@/lib/auth/runtime";
import { getAuthStore } from "@/lib/auth/store";
import { updateOwnProfile } from "@/lib/auth/profile";

/** Changes the signed-in person's own name or email. Any signed-in account may do this, including a super admin or a member without a seat. */
export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in to edit your profile." }, { status: 401 });
  }
  const limited = rateLimited(`profile:${user.id}`, 20, 15 * 60 * 1000);
  if (limited) return limited;

  try {
    const body = await readJsonBody(request);
    const auth = getAuthService();
    const updated = await updateOwnProfile(
      { store: getAuthStore(), resendVerification: auth.resendVerification },
      user,
      { name: body.name, email: body.email, password: body.password },
    );
    return NextResponse.json({ ok: true, name: updated.name, email: updated.email, verificationSent: updated.email !== user.email });
  } catch (error) {
    return errorResponse(error);
  }
}
