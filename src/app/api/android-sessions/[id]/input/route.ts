import { NextResponse } from "next/server";
import { errorResponse, readJsonBody } from "@/lib/auth/http";
import { getCurrentUser } from "@/lib/auth/runtime";
import { AndroidSessionFailure, sendAndroidInput, validateAndroidInput } from "@/lib/android/sessions";

type Props = { params: Promise<{ id: string }> };

/** A tap, a swipe, a button (back, home, recents) or typed text, for the phone. */
export async function POST(request: Request, { params }: Props) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized", message: "Sign in to use this session." }, { status: 401 });

  const { id } = await params;
  const checked = validateAndroidInput(await readJsonBody(request));
  if (!checked.ok) return NextResponse.json({ error: "invalid_input", message: checked.reason }, { status: 400 });

  try {
    await sendAndroidInput(user.id, id, checked.input);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AndroidSessionFailure) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.code === "not_found" ? 404 : 409 });
    }
    return errorResponse(error);
  }
}
