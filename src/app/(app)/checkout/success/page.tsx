import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { PrintButton } from "@/components/print-button";
import { LoadingRegion, Skeleton } from "@/components/skeleton";
import { getCurrentUser } from "@/lib/auth/runtime";
import { CARD_BRAND_LABELS } from "@/lib/billing/card";
import { CYCLE_LABELS, PRO_FEATURES, formatMoney } from "@/lib/billing/plans";
import { DEVICES } from "@/lib/device-lab/devices";

const DATE = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" });

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

async function SuccessContent() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Only accounts with Pro belong here. Anyone else is sent to the plans.
  if (user.subscription !== "active") redirect("/pricing");
  const order = user.billing;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section aria-labelledby="success-heading" className="dash-rise relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-ink via-brand-deep to-brand-violet p-8 text-center text-white shadow-xl print:bg-none print:text-foreground print:shadow-none">
        <div aria-hidden="true" className="dash-glow absolute -left-10 -top-16 h-56 w-56 rounded-full bg-brand-blue/40 blur-3xl print:hidden" />
        <div aria-hidden="true" className="dash-glow absolute -bottom-20 -right-10 h-60 w-60 rounded-full bg-brand-fuchsia/40 blur-3xl print:hidden" />
        <div className="relative">
          <span aria-hidden="true" className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400 text-white shadow-lg shadow-emerald-500/40 ring-8 ring-white/10">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          <h1 id="success-heading" className="mt-5 text-3xl font-semibold tracking-tight md:text-4xl">
            You&rsquo;re on Pro, {user.name.split(" ")[0]}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/80 print:text-muted md:text-base">
            Payment received. Every Pro device and limit is unlocked now. There is nothing else to set up.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3 print:hidden">
            <Link
              href="/test"
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-brand-ink shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Start testing a site
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
            <Link href="/optimize" className="inline-flex items-center rounded-full bg-white/10 px-6 py-3 text-sm font-semibold ring-1 ring-white/30 transition hover:bg-white/20">
              Run an audit
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-[1.1fr_1fr]">
        <section aria-labelledby="receipt-heading" className="rounded-2xl border border-border/70 bg-surface p-5 shadow-sm md:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 id="receipt-heading" className="text-lg font-semibold tracking-tight">Receipt</h2>
            <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-bold text-success">Paid</span>
          </div>
          {order ? (
            <dl className="mt-3 divide-y divide-border">
              <Row label="Order number"><span className="font-mono">{order.orderId}</span></Row>
              <Row label="Plan">Emulix Pro, {CYCLE_LABELS[order.cycle].name.toLowerCase()}</Row>
              <Row label="Amount paid">{formatMoney(order.amountCents, order.currency)}</Row>
              <Row label="Paid on">{DATE.format(order.paidAt)}</Row>
              <Row label="Renews on">{DATE.format(order.renewsAt)}</Row>
              <Row label="Payment method">
                {order.card ? `${CARD_BRAND_LABELS[order.card.brand]} ending ${order.card.last4}` : "Test card"}
              </Row>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted">This account has Pro without an order, as development accounts do.</p>
          )}
          <p className="mt-4 rounded-xl bg-background px-3 py-2 text-xs text-muted">
            Test mode receipt. No money was charged. You can find it again under Profile and billing.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 print:hidden">
            <PrintButton />
            <Link href="/profile" className="inline-flex items-center rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold transition hover:border-accent hover:text-accent">
              Billing details
            </Link>
          </div>
        </section>

        <section aria-labelledby="unlocked-heading" className="rounded-2xl border border-border/70 bg-gradient-to-br from-brand-blue/10 via-brand-violet/10 to-brand-fuchsia/10 p-5 shadow-sm md:p-6 print:hidden">
          <h2 id="unlocked-heading" className="text-lg font-semibold tracking-tight">What&rsquo;s unlocked</h2>
          <p className="mt-1 text-sm text-muted">{DEVICES.length} devices are ready for you.</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            {PRO_FEATURES.map((feature) => (
              <li key={feature} className="flex gap-2.5">
                <span aria-hidden="true" className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success/15 text-[10px] font-bold text-success">✓</span>
                {feature}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function SuccessSkeleton() {
  return (
    <LoadingRegion label="Confirming your upgrade" className="mx-auto max-w-3xl space-y-6">
      <Skeleton className="h-64 w-full rounded-3xl" />
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    </LoadingRegion>
  );
}

/** The signed-in user is read inside Suspense, so the page shell does not wait on it. */
export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<SuccessSkeleton />}>
      <SuccessContent />
    </Suspense>
  );
}
