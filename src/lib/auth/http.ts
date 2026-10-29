import { NextResponse } from "next/server";
import { getRateLimiter } from "./rate-limit";
import { AuthFailure, type AuthErrorCode } from "./service";

const STATUS_BY_CODE: Record<AuthErrorCode, number> = {
  invalid_input: 400,
  weak_password: 400,
  invalid_token: 400,
  invalid_credentials: 401,
  account_locked: 429,
};

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function stringField(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === "string" ? value : "";
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof AuthFailure) {
    return NextResponse.json(
      { error: error.code, message: error.message },
      { status: STATUS_BY_CODE[error.code] },
    );
  }
  console.error("[auth] unexpected error", error);
  return NextResponse.json(
    { error: "server_error", message: "Something went wrong. Try again." },
    { status: 500 },
  );
}

/** Returns a 429 response when the key is over its limit; null when the request may continue. */
export function rateLimited(key: string, limit: number, windowMs: number): NextResponse | null {
  if (getRateLimiter().consume(key, limit, windowMs)) return null;
  return NextResponse.json(
    { error: "rate_limited", message: "Too many requests. Wait a few minutes and try again." },
    { status: 429 },
  );
}
