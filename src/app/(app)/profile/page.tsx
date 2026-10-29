import { Suspense } from "react";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { MockNotice } from "@/components/mock-notice";
import { PlanBadge } from "@/components/plan-badge";
import { ProfileSkeleton } from "@/components/skeleton";
import { UsageMeter } from "@/components/usage-meter";
import { getCurrentUser } from "@/lib/auth/runtime";
import { CARD_BRAND_LABELS } from "@/lib/billing/card";
import { CYCLE_LABELS, formatMoney } from "@/lib/billing/plans";
import { planForStatus } from "@/lib/entitlements";
import { MOCK_USAGE, MOCK_USER, PLAN_LIMITS } from "@/lib/mock-data";

const RENEWAL_DATE = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" });

async function ProfilePageContent() {
  const user = await getCurrentUser();
  const subscription = user?.subscription ?? "free";
  const plan = planForStatus(subscription);
  const limits = PLAN_LIMITS[plan];

  return (
    <div className="space-y-8">
      <MockNotice>Usage figures and security settings are placeholders. Billing runs in test mode.</MockNotice>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Profile and billing</h1>
      </header>

      <section aria-labelledby="account-heading" className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface p-5">
        <Avatar name={MOCK_USER.name} status={subscription} size={72} />
        <div className="min-w-0 flex-1">
          <h2 id="account-heading" className="text-lg font-semibold">
            {MOCK_USER.name}
          </h2>
          <p className="truncate text-sm text-muted">{MOCK_USER.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <PlanBadge plan={plan} />
            <span className="text-muted">Subscription status: {subscription}</span>
          </div>
        </div>
      </section>

      <section aria-labelledby="usage-heading" className="space-y-5 rounded-lg border border-border bg-surface p-5">
        <h2 id="usage-heading" className="text-base font-semibold">
          Usage this period
        </h2>
        <UsageMeter label="Audits" used={MOCK_USAGE.auditsUsed} limit={limits.auditsPerPeriod} />
        <UsageMeter label="APK uploads" used={MOCK_USAGE.apkUploadsUsed} limit={limits.apkUploadsPerPeriod} />
      </section>

      <section aria-labelledby="billing-heading" className="space-y-4 rounded-lg border border-border bg-surface p-5">
        <h2 id="billing-heading" className="text-base font-semibold">
          Billing
        </h2>
        {plan === "pro" ? (
          user?.billing ? (
            <dl className="divide-y divide-border text-sm">
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-muted">Plan</dt>
                <dd className="font-medium">Emulix Pro, {CYCLE_LABELS[user.billing.cycle].name.toLowerCase()}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-muted">Price</dt>
                <dd className="font-medium">
                  {formatMoney(user.billing.amountCents, user.billing.currency)} / {CYCLE_LABELS[user.billing.cycle].per}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-muted">Renews on</dt>
                <dd className="font-medium">{RENEWAL_DATE.format(user.billing.renewsAt)}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-muted">Payment method</dt>
                <dd className="font-medium">
                  {user.billing.card ? `${CARD_BRAND_LABELS[user.billing.card.brand]} ending ${user.billing.card.last4}` : "Test card"}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted">This account has Pro without an order, as development accounts do.</p>
          )
        ) : (
          <p className="text-sm text-muted">
            You are on the Free plan. Pro unlocks every device, higher limits and more audits, and it starts straight away.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {plan === "free" ? (
            <Link
              href="/checkout"
              className="rounded-xl bg-gradient-to-r from-brand-blue via-brand-violet to-brand-fuchsia px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-brand-violet/25 transition hover:-translate-y-0.5"
            >
              Upgrade to Pro
            </Link>
          ) : user?.billing ? (
            <Link href="/checkout/success" className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:border-accent">
              View receipt
            </Link>
          ) : null}
          <Link href="/pricing" className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:border-accent">
            Compare plans
          </Link>
        </div>
        <p className="text-xs text-muted">
          Test mode: no real payments. Changing or cancelling a plan arrives when the payment provider is connected.
        </p>
      </section>
    </div>
  );
}

/** The per-request user is read inside Suspense, so the navigation is not blocked on it. */
export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfilePageContent />
    </Suspense>
  );
}
