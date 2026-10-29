import { randomBytes } from "node:crypto";
import { CARD_BRAND_LABELS, type CardBrand } from "./card";
import { BILLING_CYCLES, PRO_PRICING, addCycle, priceCents, type BillingCycle } from "./plans";

/** What the receipt shows about the card. The full number never leaves the browser. */
export type CardSummary = { brand: CardBrand; last4: string };

export type BillingRecord = {
  orderId: string;
  plan: "pro";
  cycle: BillingCycle;
  amountCents: number;
  currency: string;
  paidAt: Date;
  renewsAt: Date;
  card: CardSummary | null;
};

/** The same record with dates as text, as it travels in JSON. */
export type PublicOrder = Omit<BillingRecord, "paidAt" | "renewsAt"> & { paidAt: string; renewsAt: string };

export type CheckoutInput = { cycle: BillingCycle; card: CardSummary | null };

export function newOrderId(): string {
  return `EMX-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/** Checks the request body. Only the plan, the billing cycle and a card label are accepted. */
export function parseCheckoutInput(body: unknown): { ok: true; input: CheckoutInput } | { ok: false; message: string } {
  if (typeof body !== "object" || body === null) return { ok: false, message: "Choose a billing period." };
  const { plan, cycle, card } = body as Record<string, unknown>;
  if (plan !== undefined && plan !== "pro") return { ok: false, message: "That plan is not available." };
  if (typeof cycle !== "string" || !BILLING_CYCLES.includes(cycle as BillingCycle)) {
    return { ok: false, message: "Choose monthly or yearly billing." };
  }

  let summary: CardSummary | null = null;
  if (card !== undefined && card !== null) {
    const { brand, last4 } = card as Record<string, unknown>;
    const knownBrand = typeof brand === "string" && Object.keys(CARD_BRAND_LABELS).includes(brand);
    if (!knownBrand || typeof last4 !== "string" || !/^\d{4}$/.test(last4)) {
      return { ok: false, message: "The card summary is not valid." };
    }
    summary = { brand: brand as CardBrand, last4 };
  }
  return { ok: true, input: { cycle: cycle as BillingCycle, card: summary } };
}

export function createOrder(input: CheckoutInput, now: Date = new Date(), orderId: string = newOrderId()): BillingRecord {
  return {
    orderId,
    plan: "pro",
    cycle: input.cycle,
    amountCents: priceCents(input.cycle),
    currency: PRO_PRICING.currency,
    paidAt: now,
    renewsAt: addCycle(now, input.cycle),
    card: input.card,
  };
}

export function publicOrder(record: BillingRecord): PublicOrder {
  return { ...record, paidAt: record.paidAt.toISOString(), renewsAt: record.renewsAt.toISOString() };
}
