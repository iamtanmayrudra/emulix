import Link from "next/link";
import { Logo } from "@/components/logo";
import { MockNotice } from "@/components/mock-notice";
import { SiteFooter } from "@/components/site-footer";
import { UpgradeCta } from "@/components/upgrade-cta";
import { ORG_FEATURES, ORG_SEAT_LIMIT, PRO_FEATURES, PRO_PRICING, formatMoney, perMonthCents, yearlySavingsPercent } from "@/lib/billing/plans";
import { PLAN_LIMITS } from "@/lib/mock-data";

const FREE_FEATURES = [
  "3 device profiles",
  "1 live browser at a time",
  `${PLAN_LIMITS.free.auditsPerPeriod} audits per period, with the fix guide for every finding`,
  `${PLAN_LIMITS.free.apkUploadsPerPeriod} APK uploads per period (subject to availability)`,
  "Basic history and usage meter",
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 flex items-center justify-between bg-chrome px-4 py-3 text-chrome-foreground md:px-6">
        <Link href="/" aria-label="Emulix home">
          <Logo size={28} />
        </Link>
        <Link href="/dashboard" className="text-sm font-medium hover:text-accent">
          Open prototype
        </Link>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 pb-16 pt-8">
        <MockNotice>Prices are preview prices for test mode. Final pricing is an open decision. Nothing is charged.</MockNotice>

        <header>
          <h1 className="text-3xl font-semibold tracking-tight">Plans</h1>
          <p className="mt-2 max-w-xl text-muted">
            Start free. Upgrade when you need every device and higher limits, or set up an organization to control who on your team uses Emulix.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <section aria-labelledby="free-plan" className="flex flex-col rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <h2 id="free-plan" className="text-lg font-semibold">Free</h2>
            <p className="mt-1 text-sm text-muted">For trying the workflow.</p>
            <p className="mt-4 text-4xl font-bold tracking-tight">
              {formatMoney(0)}
              <span className="text-base font-medium text-muted"> / month</span>
            </p>
            <ul className="mt-5 flex-1 space-y-2 text-sm">
              {FREE_FEATURES.map((feature) => (
                <li key={feature}>✓ {feature}</li>
              ))}
            </ul>
            <Link href="/signup" className="mt-6 rounded-2xl border border-border px-5 py-3.5 text-center text-sm font-semibold transition hover:border-accent hover:text-accent">
              Start free
            </Link>
          </section>

          <section aria-labelledby="pro-plan" className="relative flex flex-col overflow-hidden rounded-2xl border-2 border-pro bg-surface p-6 shadow-lg shadow-brand-violet/10">
            <span className="absolute right-4 top-4 rounded-full bg-gradient-to-r from-brand-violet to-brand-fuchsia px-3 py-1 text-xs font-bold text-white">
              Most popular
            </span>
            <h2 id="pro-plan" className="text-lg font-semibold text-pro">Pro</h2>
            <p className="mt-1 text-sm text-muted">For teams testing across many devices.</p>
            <p className="mt-4 text-4xl font-bold tracking-tight">
              {formatMoney(PRO_PRICING.monthlyCents)}
              <span className="text-base font-medium text-muted"> / month</span>
            </p>
            <p className="mt-1 text-sm text-muted">
              Or {formatMoney(perMonthCents("yearly"))} / month billed {formatMoney(PRO_PRICING.yearlyCents)} yearly.{" "}
              <span className="font-semibold text-success">Save {yearlySavingsPercent()}%</span>
            </p>
            <ul className="mt-5 flex-1 space-y-2 text-sm">
              {PRO_FEATURES.map((feature) => (
                <li key={feature}>✓ {feature}</li>
              ))}
            </ul>
            <div className="mt-6">
              <UpgradeCta />
            </div>
          </section>

          <section aria-labelledby="org-plan" className="relative flex flex-col overflow-hidden rounded-2xl border border-brand-blue/50 bg-surface p-6 shadow-sm">
            <span className="absolute right-4 top-4 rounded-full bg-brand-blue/15 px-3 py-1 text-xs font-bold text-accent">For teams</span>
            <h2 id="org-plan" className="text-lg font-semibold text-accent">Organization</h2>
            <p className="mt-1 text-sm text-muted">For companies that want control over who uses the platform.</p>
            <p className="mt-4 text-2xl font-bold tracking-tight">Pricing to be announced</p>

            <div className="mt-4 flex items-center gap-3 rounded-xl bg-gradient-to-r from-brand-blue/10 to-brand-violet/10 px-3 py-2.5">
              <span aria-hidden="true" className="flex -space-x-2">
                {Array.from({ length: ORG_SEAT_LIMIT }, (_, index) => (
                  <span key={index} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-gradient-to-br from-brand-blue to-brand-violet text-white">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="8.5" r="3.5" />
                      <path d="M5 20a7 7 0 0 1 14 0" />
                    </svg>
                  </span>
                ))}
              </span>
              <span className="text-sm font-semibold">{ORG_SEAT_LIMIT} seats at a time</span>
            </div>

            <ul className="mt-5 flex-1 space-y-2 text-sm">
              {ORG_FEATURES.map((feature) => (
                <li key={feature}>✓ {feature}</li>
              ))}
            </ul>
            <button
              type="button"
              disabled
              aria-describedby="org-note"
              className="mt-6 cursor-not-allowed rounded-2xl border border-border px-5 py-3.5 text-center text-sm font-semibold text-muted"
            >
              Coming soon
            </button>
            <p id="org-note" className="mt-3 text-center text-xs text-muted">
              Organization accounts and the super admin console are being designed.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
