import { NextResponse } from "next/server";
import { errorResponse, readJsonBody } from "@/lib/auth/http";
import { getCurrentUser } from "@/lib/auth/runtime";
import { BrowserSessionFailure, sendBrowserInput, validateBrowserInput } from "@/lib/testing/browser-sessions";

type Props = { params: Promise<{ id: string }> };

const STATUS_BY_CODE: Record<BrowserSessionFailure["code"], number> = {
  invalid_url: 400,
  unknown_profile: 400,
  plan_required: 403,
  concurrency_limit: 429,
  unsafe_target: 400,
  invalid_input: 400,
  launch_failed: 503,
  not_found: 404,
  input_failed: 409,
};

export async function POST(request: Request, { params }: Props) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in to use this browser." }, { status: 401 });
  }

  const { id } = await params;
  const checked = validateBrowserInput(await readJsonBody(request));
  if (!checked.ok) {
    return NextResponse.json({ error: "invalid_input", message: checked.reason }, { status: 400 });
  }

  try {
    await sendBrowserInput(user.id, id, checked.input);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof BrowserSessionFailure) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: STATUS_BY_CODE[error.code] });
    }
    return errorResponse(error);
  }
}
