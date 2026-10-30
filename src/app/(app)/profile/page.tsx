import { Suspense } from "react";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { MockNotice } from "@/components/mock-notice";
import { PlanBadge } from "@/components/plan-badge";
import { ProfileEditor } from "@/components/profile-editor";
import { ProfileSkeleton } from "@/components/skeleton";
import { UsageMeter } from "@/components/usage-meter";
import { getCurrentUser } from "@/lib/auth/runtime";
import { CARD_BRAND_LABELS } from "@/lib/billing/card";
import { CYCLE_LABELS, formatMoney } from "@/lib/billing/plans";
import { planForStatus } from "@/lib/entitlements";
import { effectiveSubscription, getOrgStore, getUserAccess } from "@/lib/org/runtime";
import { MOCK_USAGE, PLAN_LIMITS } from "@/lib/mock-data";

const RENEWAL_DATE = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" });
const STAMP_DATE = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

const ACCESS_LABEL = {
  individual: "Personal account",
  super_admin: "Super admin",
  seated: "Member with a seat",
  no_seat: "Member without a seat",
  deactivated: "Deactivated",
} as const;

async function ProfilePageContent() {
  const user = await getCurrentUser();
  const subscription = user ? effectiveSubscription(user) : "free";
  const inOrganization = user ? getUserAccess(user.id).kind === "seated" : false;
  const plan = planForStatus(subscription);
  const limits = PLAN_LIMITS[plan];
  const access = user ? getUserAccess(user.id) : { kind: "individual" as const };
  const orgName = "orgId" in access ? (getOrgStore().getOrg(access.orgId)?.name ?? null) : null;
  const name = user?.name ?? "Signed-out visitor";
  const email = user?.email ?? "";

  return (
    <div className="space-y-8">
      <MockNotice>Usage figures and security settings are placeholders. Billing runs in test mode.</MockNotice>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Profile and billing</h1>
      </header>

      <section aria-labelledby="account-heading" className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface p-5">
        <Avatar name={name} status={subscription} size={72} />
        <div className="min-w-0 flex-1">
          <h2 id="account-heading" className="text-lg font-semibold">
            {name}
          </h2>
          <p className="truncate text-sm text-muted">{email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <PlanBadge plan={plan} />
            <span className="text-muted">Subscription status: {subscription}</span>
            {user?.emailVerifiedAt ? (
              <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">Email verified</span>
            ) : (
              <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">Email not verified</span>
            )}
          </div>
        </div>
      </section>

      {user && <ProfileEditor name={user.name} email={user.email} />}

      {user && (
        <section aria-labelledby="details-heading" className="rounded-lg border border-border bg-surface p-5">
          <h2 id="details-heading" className="text-base font-semibold">
            Account details
          </h2>
          <dl className="mt-4 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted">Full name</dt>
              <dd className="mt-1 font-medium">{user.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted">Email</dt>
              <dd className="mt-1 break-all font-medium">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted">Member since</dt>
              <dd className="mt-1 font-medium">{STAMP_DATE.format(user.createdAt)} UTC</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted">Last sign-in</dt>
              <dd className="mt-1 font-medium">{user.lastLoginAt ? `${STAMP_DATE.format(user.lastLoginAt)} UTC` : "This is your first sign-in"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted">Account type</dt>
              <dd className="mt-1 font-medium">{ACCESS_LABEL[access.kind]}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted">Account ID</dt>
              <dd className="mt-1 break-all font-mono text-xs text-muted">{user.id}</dd>
            </div>
          </dl>
        </section>
      )}

      {orgName && (
        <section aria-labelledby="org-heading" className="rounded-lg border border-border bg-surface p-5">
          <h2 id="org-heading" className="text-base font-semibold">
            Organization
          </h2>
          <p className="mt-2 text-sm text-muted">
            You belong to <span className="font-medium text-foreground">{orgName}</span> as{" "}
            <span className="font-medium text-foreground">{access.kind === "super_admin" ? "a super admin" : "a member"}</span>.
            {access.kind === "seated" && " You hold a seat, so you can use the platform."}
            {access.kind === "no_seat" && " You do not hold a seat yet. Ask your super admin for one."}
          </p>
        </section>
      )}

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
        {inOrganization ? (
          <p className="text-sm text-muted">Your plan comes from your organization, which includes Pro for every member with a seat. There is nothing to buy.</p>
        ) : plan === "pro" ? (
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
          {inOrganization ? null : plan === "free" ? (
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
