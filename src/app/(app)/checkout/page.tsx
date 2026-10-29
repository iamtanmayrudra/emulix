"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { LogoMark } from "@/components/logo";
import { usePlan } from "@/components/plan-context";
import {
  CARD_BRAND_LABELS,
  DECLINED_TEST_CARD,
  TEST_CARD_NUMBER,
  detectCardBrand,
  digitsOnly,
  formatCardNumber,
  formatExpiry,
  isDeclinedTestCard,
  isValidCardNumber,
  isValidCvv,
  isValidExpiry,
} from "@/lib/billing/card";
import {
  BILLING_CYCLES,
  CYCLE_LABELS,
  PRO_FEATURES,
  formatMoney,
  perMonthCents,
  priceCents,
  yearlySavingsPercent,
  type BillingCycle,
} from "@/lib/billing/plans";

type FieldName = "card" | "name" | "expiry" | "cvv" | "terms";
type Errors = Partial<Record<FieldName, string>>;
type ApiResponse = { message?: string };

const INPUT =
  "w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm transition hover:border-muted/60 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/15 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/15";

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`step-${number}`} className="rounded-2xl border border-border/70 bg-surface p-5 shadow-sm md:p-6">
      <h2 id={`step-${number}`} className="flex items-center gap-3 text-lg font-semibold tracking-tight">
        <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-blue to-brand-violet text-sm font-bold text-white">
          {number}
        </span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-xs font-medium text-danger">
      {message}
    </p>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const { plan } = usePlan();
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [card, setCard] = useState("");
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (plan === "pro") {
    return (
      <section className="mx-auto max-w-md space-y-4 rounded-2xl border border-pro/40 bg-surface p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold">You already have Pro</h1>
        <p className="text-sm text-muted">Your account includes the full device library and higher limits.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/test" className="rounded-xl bg-gradient-to-r from-brand-blue to-brand-violet px-4 py-2 text-sm font-semibold text-white shadow">
            Start testing
          </Link>
          <Link href="/profile" className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:border-accent">
            Billing details
          </Link>
        </div>
      </section>
    );
  }

  const brand = detectCardBrand(card);
  const total = priceCents(cycle);

  function fillTestCard(number: string) {
    setCard(formatCardNumber(number));
    setExpiry("12/34");
    setCvv("123");
    if (!name.trim()) setName("Test Customer");
    setErrors({});
    setServerError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);

    // Card details are checked here. Only the brand and last four digits are sent, for the receipt.
    const next: Errors = {};
    if (!isValidCardNumber(card)) next.card = "Enter a valid card number.";
    if (!name.trim()) next.name = "Enter the name on the card.";
    if (!isValidExpiry(expiry)) next.expiry = "Use a month and year that have not passed, as MM/YY.";
    if (!isValidCvv(cvv)) next.cvv = "Enter the 3 or 4 digit security code.";
    if (!terms) next.terms = "Agree to the terms to continue.";
    setErrors(next);
    const firstInvalid = (["card", "name", "expiry", "cvv", "terms"] as FieldName[]).find((field) => next[field]);
    if (firstInvalid) {
      document.getElementById(`co-${firstInvalid}`)?.focus();
      return;
    }

    if (isDeclinedTestCard(card)) {
      setServerError("Your card was declined. Try a different card.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/billing/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro", cycle, card: { brand, last4: digitsOnly(card).slice(-4) } }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as ApiResponse;
        setServerError(result.message ?? "The payment could not be completed. Try again.");
        return;
      }
      router.push("/checkout/success");
      router.refresh();
    } catch {
      setServerError("Network error. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-pro">Upgrade</p>
        <h1 className="text-3xl font-semibold tracking-tight">Get Emulix Pro</h1>
        <p className="text-sm text-muted">Pick how you pay, add a card, and Pro starts straight away.</p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Order summary comes first on phones, so the price is the first thing seen. */}
        <aside aria-labelledby="summary-heading" className="order-1 overflow-hidden rounded-2xl border border-border/70 bg-surface shadow-sm lg:sticky lg:top-24 lg:order-2">
          <div className="relative overflow-hidden bg-gradient-to-br from-brand-ink via-brand-deep to-brand-violet p-5 text-white">
            <div aria-hidden="true" className="dash-glow absolute -right-10 -top-12 h-40 w-40 rounded-full bg-brand-fuchsia/40 blur-3xl" />
            <div className="relative flex items-center gap-3">
              <LogoMark size={40} />
              <div>
                <h2 id="summary-heading" className="text-lg font-semibold">Emulix Pro</h2>
                <p className="text-xs text-white/75">For teams testing across many devices</p>
              </div>
            </div>
            <p className="relative mt-5 flex items-baseline gap-1.5">
              <span className="text-4xl font-bold tracking-tight">{formatMoney(perMonthCents(cycle))}</span>
              <span className="text-sm text-white/75">/ month</span>
            </p>
            {cycle === "yearly" && <p className="relative mt-1 text-xs text-white/75">Billed {formatMoney(total)} once a year</p>}
          </div>

          <div className="space-y-4 p-5">
            <ul className="space-y-2 text-sm">
              {PRO_FEATURES.map((feature) => (
                <li key={feature} className="flex gap-2.5">
                  <span aria-hidden="true" className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success/15 text-[10px] font-bold text-success">✓</span>
                  {feature}
                </li>
              ))}
            </ul>

            <dl className="space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Pro, {CYCLE_LABELS[cycle].name.toLowerCase()}</dt>
                <dd>{formatMoney(total)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-border pt-3 text-base font-semibold">
                <dt>Total due today</dt>
                <dd>{formatMoney(total)}</dd>
              </div>
            </dl>
            <p className="text-xs text-muted">
              Renews {CYCLE_LABELS[cycle].renews}. You can review your plan any time under Profile and billing.
            </p>
          </div>
        </aside>

        <form onSubmit={handleSubmit} noValidate className="order-2 space-y-5 lg:order-1">
          <Step number={1} title="Choose how you pay">
            <div role="radiogroup" aria-label="Billing period" className="grid gap-3 sm:grid-cols-2">
              {BILLING_CYCLES.map((value) => {
                const selected = cycle === value;
                return (
                  <label
                    key={value}
                    className={`relative flex cursor-pointer flex-col gap-1 rounded-xl border p-4 transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-accent/20 ${
                      selected ? "border-accent bg-accent/5 shadow-sm ring-1 ring-accent" : "border-border hover:border-muted/60"
                    }`}
                  >
                    <input type="radio" name="cycle" value={value} checked={selected} onChange={() => setCycle(value)} className="sr-only" />
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{CYCLE_LABELS[value].name}</span>
                      {value === "yearly" && (
                        <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-bold text-success">Save {yearlySavingsPercent()}%</span>
                      )}
                    </span>
                    <span className="text-2xl font-bold tracking-tight">
                      {formatMoney(perMonthCents(value))}
                      <span className="text-sm font-medium text-muted"> / month</span>
                    </span>
                    <span className="text-xs text-muted">
                      {value === "yearly" ? `Billed ${formatMoney(priceCents(value))} a year` : "Billed every month"}
                    </span>
                  </label>
                );
              })}
            </div>
          </Step>

          <Step number={2} title="Payment details">
            <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-xs">
              <span className="font-semibold text-warning">Test mode</span>
              <span className="text-muted">No real charge. Try a test card:</span>
              <button type="button" onClick={() => fillTestCard(TEST_CARD_NUMBER)} className="rounded-full border border-border bg-surface px-2.5 py-1 font-semibold hover:border-accent hover:text-accent">
                Use a card that works
              </button>
              <button type="button" onClick={() => fillTestCard(DECLINED_TEST_CARD)} className="rounded-full border border-border bg-surface px-2.5 py-1 font-semibold hover:border-accent hover:text-accent">
                Use a card that is declined
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="co-card" className="mb-1.5 block text-sm font-medium">Card number</label>
                <div className="relative">
                  <input
                    id="co-card"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    placeholder="1234 1234 1234 1234"
                    value={card}
                    onChange={(event) => setCard(formatCardNumber(event.target.value))}
                    aria-invalid={errors.card ? true : undefined}
                    aria-describedby={errors.card ? "co-card-error" : undefined}
                    className={`${INPUT} pr-28`}
                  />
                  <span aria-hidden="true" className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-0.5 text-[11px] font-bold ${brand === "card" ? "text-muted" : "bg-accent/10 text-accent"}`}>
                    {brand === "card" ? "" : CARD_BRAND_LABELS[brand]}
                  </span>
                </div>
                <FieldError id="co-card-error" message={errors.card} />
              </div>

              <div>
                <label htmlFor="co-name" className="mb-1.5 block text-sm font-medium">Name on card</label>
                <input
                  id="co-name"
                  autoComplete="cc-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  aria-invalid={errors.name ? true : undefined}
                  aria-describedby={errors.name ? "co-name-error" : undefined}
                  className={INPUT}
                />
                <FieldError id="co-name-error" message={errors.name} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="co-expiry" className="mb-1.5 block text-sm font-medium">Expiry</label>
                  <input
                    id="co-expiry"
                    inputMode="numeric"
                    autoComplete="cc-exp"
                    placeholder="MM/YY"
                    value={expiry}
                    onChange={(event) => setExpiry(formatExpiry(event.target.value))}
                    aria-invalid={errors.expiry ? true : undefined}
                    aria-describedby={errors.expiry ? "co-expiry-error" : undefined}
                    className={INPUT}
                  />
                  <FieldError id="co-expiry-error" message={errors.expiry} />
                </div>
                <div>
                  <label htmlFor="co-cvv" className="mb-1.5 block text-sm font-medium">Security code</label>
                  <input
                    id="co-cvv"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    placeholder="123"
                    maxLength={4}
                    value={cvv}
                    onChange={(event) => setCvv(event.target.value.replace(/\D/g, "").slice(0, 4))}
                    aria-invalid={errors.cvv ? true : undefined}
                    aria-describedby={errors.cvv ? "co-cvv-error" : undefined}
                    className={INPUT}
                  />
                  <FieldError id="co-cvv-error" message={errors.cvv} />
                </div>
              </div>
            </div>

            <p className="mt-4 flex items-start gap-2 text-xs text-muted">
              <svg viewBox="0 0 24 24" className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="5" y="11" width="14" height="9" rx="2.5" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
              The card number, expiry and code stay in this browser. Only the card type and last four digits are sent, to print on your receipt.
            </p>
          </Step>

          <div className="space-y-4 rounded-2xl border border-border/70 bg-surface p-5 shadow-sm md:p-6">
            <div>
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  id="co-terms"
                  type="checkbox"
                  checked={terms}
                  onChange={(event) => setTerms(event.target.checked)}
                  aria-invalid={errors.terms ? true : undefined}
                  aria-describedby={errors.terms ? "co-terms-error" : undefined}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                />
                <span>
                  I agree to the{" "}
                  <Link href="/terms" target="_blank" className="font-medium text-accent hover:underline">terms of use</Link>{" "}
                  and the{" "}
                  <Link href="/privacy" target="_blank" className="font-medium text-accent hover:underline">privacy notice</Link>.
                </span>
              </label>
              <FieldError id="co-terms-error" message={errors.terms} />
            </div>

            {serverError && (
              <p role="alert" className="flex items-start gap-2.5 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
                <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7.5v5M12 16h.01" />
                </svg>
                {serverError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-brand-blue via-brand-violet to-brand-fuchsia px-5 py-4 text-base font-bold text-white shadow-lg shadow-brand-violet/25 transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:translate-y-0 disabled:opacity-70"
            >
              {submitting ? (
                <>
                  <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" />
                  Processing payment…
                </>
              ) : (
                <>Pay {formatMoney(total)} and start Pro</>
              )}
            </button>
            <p className="text-center text-xs text-muted">Test mode checkout. Nothing is charged and no card is stored.</p>
          </div>
        </form>
      </div>
    </div>
  );
}
