import Link from "next/link";
import { Logo } from "@/components/logo";
import { MockNotice } from "@/components/mock-notice";
import { SiteFooter } from "@/components/site-footer";
import { UpgradeCta } from "@/components/upgrade-cta";
import { PRO_FEATURES, PRO_PRICING, formatMoney, perMonthCents, yearlySavingsPercent } from "@/lib/billing/plans";
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

      <main className="mx-auto max-w-5xl space-y-8 px-4 pb-16 pt-8">
        <MockNotice>Prices are preview prices for test mode. Final pricing is an open decision. Nothing is charged.</MockNotice>

        <header>
          <h1 className="text-3xl font-semibold tracking-tight">Plans</h1>
          <p className="mt-2 max-w-xl text-muted">
            Start free. Upgrade when you need every device and higher limits. It takes about a minute.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
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
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
