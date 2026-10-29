/**
 * Pro plan pricing and what it includes. Shared by the pricing page, the checkout and the receipt.
 *
 * PREVIEW PRICES: the real prices are an open decision (plan decision 4). These numbers only make the
 * checkout complete in test mode. Change them here and every screen follows.
 */

import { PLAN_LIMITS } from "@/lib/mock-data";

export type BillingCycle = "monthly" | "yearly";

export const BILLING_CYCLES: BillingCycle[] = ["monthly", "yearly"];

export const PRO_PRICING = {
  currency: "USD",
  monthlyCents: 1900,
  yearlyCents: 15200,
} as const;

export const CYCLE_LABELS: Record<BillingCycle, { name: string; per: string; renews: string }> = {
  monthly: { name: "Monthly", per: "month", renews: "every month" },
  yearly: { name: "Yearly", per: "year", renews: "every year" },
};

export const PRO_FEATURES = [
  "Every device in the library, including Mac Safari 15 to 26",
  "Up to 5 live browsers at once",
  `${PLAN_LIMITS.pro.auditsPerPeriod} audits a period, with the fix guide for every finding`,
  "APK testing when it ships",
  "Advanced screenshots, logs and reports",
];

export function priceCents(cycle: BillingCycle): number {
  return cycle === "yearly" ? PRO_PRICING.yearlyCents : PRO_PRICING.monthlyCents;
}

/** What each month costs on a cycle, so yearly can be compared with monthly. */
export function perMonthCents(cycle: BillingCycle): number {
  return cycle === "yearly" ? Math.round(PRO_PRICING.yearlyCents / 12) : PRO_PRICING.monthlyCents;
}

/** How much cheaper yearly is than twelve monthly payments, as a whole percent. */
export function yearlySavingsPercent(): number {
  return Math.round((1 - PRO_PRICING.yearlyCents / (PRO_PRICING.monthlyCents * 12)) * 100);
}

/** A fixed locale keeps the server and browser output identical. */
export function formatMoney(cents: number, currency: string = PRO_PRICING.currency): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

/** The date a payment made on `from` renews. A month from 31 January is the end of February, not March. */
export function addCycle(from: Date, cycle: BillingCycle): Date {
  const next = new Date(from);
  const day = next.getDate();
  next.setDate(1);
  if (cycle === "yearly") next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return next;
}
