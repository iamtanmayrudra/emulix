import { NextResponse } from "next/server";
import { readJsonBody, rateLimited } from "@/lib/auth/http";
import { getCurrentUser } from "@/lib/auth/runtime";
import { EMAIL_VERIFICATION_REQUIRED } from "@/lib/auth/policy";
import { getAuthStore } from "@/lib/auth/store";
import { createOrder, parseCheckoutInput, publicOrder } from "@/lib/billing/checkout";

/**
 * Test-mode upgrade to Pro. The browser checks the card and sends only the billing period and the card's brand and
 * last four digits for the receipt. No money moves. The payment provider replaces this route in Phase 4.
 * Calling it again for an account that already has an order returns that order, so a double click never charges twice.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in to upgrade." }, { status: 401 });
  }
  if (EMAIL_VERIFICATION_REQUIRED && !user.emailVerifiedAt) {
    return NextResponse.json(
      { error: "not_verified", message: "Verify your email before upgrading." },
      { status: 403 },
    );
  }

  const limited = rateLimited(`upgrade:${user.id}`, 10, 15 * 60 * 1000);
  if (limited) return limited;

  const parsed = parseCheckoutInput(await readJsonBody(request));
  if (!parsed.ok) {
    return NextResponse.json({ error: "invalid_input", message: parsed.message }, { status: 400 });
  }

  if (user.subscription === "active") {
    if (user.billing) return NextResponse.json({ ok: true, alreadyPro: true, order: publicOrder(user.billing) });
    return NextResponse.json({ error: "already_pro", message: "Your account already has Pro." }, { status: 409 });
  }

  const order = createOrder(parsed.input);
  await getAuthStore().updateUser(user.id, { subscription: "active", billing: order });
  return NextResponse.json({ ok: true, order: publicOrder(order) });
}
