import { Suspense } from "react";
import Link from "next/link";
import { ActionCard, DashboardHero, DeviceMix, JobTimeline, StatTile, UsageRing } from "@/components/dashboard-parts";
import {
  AndroidIcon,
  AppleIcon,
  ChevronRightIcon,
  DesktopIcon,
  GaugeIcon,
  GlobeIcon,
  PhoneIcon,
  ReportIcon,
} from "@/components/device-lab/icons";
import { MockNotice } from "@/components/mock-notice";
import { DashboardSkeleton } from "@/components/skeleton";
import { getCurrentUser } from "@/lib/auth/runtime";
import { DEVICES } from "@/lib/device-lab/devices";
import { canSelectProfile, planForStatus } from "@/lib/entitlements";
import { effectiveSubscription } from "@/lib/org/runtime";
import { PLAN_LIMITS } from "@/lib/mock-data";
import { dashboardTotals, recentJobs } from "@/lib/reports/dashboard";

const ACTIONS = [
  {
    href: "/test",
    title: "Test a URL",
    text: "Open any public page in a live browser on a phone, tablet or Mac.",
    gradient: "bg-gradient-to-br from-brand-blue to-brand-violet",
    icon: <GlobeIcon className="h-6 w-6" />,
  },
  {
    href: "/apk",
    title: "Upload an APK",
    text: "Check how an Android build looks and behaves on a device.",
    gradient: "bg-gradient-to-br from-emerald-400 to-teal-600",
    icon: <PhoneIcon className="h-6 w-6" />,
  },
  {
    href: "/optimize",
    title: "Run an audit",
    text: "Get a Lighthouse report on speed, accessibility and SEO.",
    gradient: "bg-gradient-to-br from-amber-400 to-rose-500",
    icon: <GaugeIcon className="h-6 w-6" />,
  },
];

async function DashboardPageContent() {
  const user = await getCurrentUser();
  const subscription = user ? effectiveSubscription(user) : "free";
  const plan = planForStatus(subscription);
  const limits = PLAN_LIMITS[plan];
  // The signed-in user's own jobs, from the same record as the Reports page. Nothing here is a sample.
  const jobs = user ? recentJobs(user.id) : [];
  const totals = user
    ? dashboardTotals(user.id)
    : { total: 0, completed: 0, successRate: 0, auditsThisPeriod: 0 };
  const unlocked = DEVICES.filter((device) => canSelectProfile(plan, device)).length;
  const locked = DEVICES.length - unlocked;
  const auditsLeft = Math.max(0, limits.auditsPerPeriod - totals.auditsThisPeriod);
  const countOf = (platform: "ios" | "android" | "desktop") => DEVICES.filter((device) => device.platform === platform).length;

  const stats = [
    { label: "Tests run", value: String(totals.total), hint: "Website, audit and APK jobs", gradient: "bg-gradient-to-br from-brand-blue to-brand-violet", icon: <GlobeIcon className="h-5 w-5" /> },
    { label: "Completed", value: String(totals.completed), hint: totals.total > 0 ? `${totals.successRate}% finished without errors` : "Run a test to see results here", gradient: "bg-gradient-to-br from-emerald-400 to-teal-600", icon: <ReportIcon className="h-5 w-5" /> },
    { label: "Devices ready", value: `${unlocked}/${DEVICES.length}`, hint: locked > 0 ? `${locked} more with Pro` : "Every device unlocked", gradient: "bg-gradient-to-br from-violet-400 to-fuchsia-600", icon: <PhoneIcon className="h-5 w-5" /> },
    { label: "Audits left", value: String(auditsLeft), hint: `of ${limits.auditsPerPeriod} this period`, gradient: "bg-gradient-to-br from-amber-400 to-rose-500", icon: <GaugeIcon className="h-5 w-5" /> },
  ];

  return (
    <div className="space-y-8">
      <DashboardHero name={user?.name ?? "there"} plan={plan} deviceCount={DEVICES.length} unlocked={unlocked} />

      <section aria-label="At a glance" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <StatTile key={stat.label} {...stat} index={index} />
        ))}
      </section>

      <section aria-labelledby="quick-actions" className="space-y-4">
        <h2 id="quick-actions" className="text-lg font-semibold tracking-tight">
          Jump in
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {ACTIONS.map((action, index) => (
            <ActionCard key={action.href} {...action} index={index} />
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section aria-labelledby="recent-jobs" className="min-w-0 rounded-2xl border border-border bg-surface p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 id="recent-jobs" className="text-lg font-semibold tracking-tight">
              Recent jobs
            </h2>
            <Link href="/reports" className="inline-flex items-center gap-1 text-sm font-semibold text-accent">
              View all
              <ChevronRightIcon className="h-4 w-4" />
            </Link>
          </div>
          {jobs.length > 0 ? (
            <JobTimeline jobs={jobs} />
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-border p-6 text-center">
              <p className="text-sm font-medium">No jobs yet</p>
              <p className="mt-1 text-sm text-muted">Tests and audits you run appear here.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Link href="/test" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90">
                  Test a URL
                </Link>
                <Link href="/optimize" className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent">
                  Run an audit
                </Link>
              </div>
            </div>
          )}
        </section>

        <div className="min-w-0 space-y-6">
          <section aria-labelledby="usage" className="space-y-5 rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <h2 id="usage" className="text-lg font-semibold tracking-tight">
              Usage this period
            </h2>
            <UsageRing label="Audits" used={totals.auditsThisPeriod} limit={limits.auditsPerPeriod} from="#38bdf8" to="#6b3df0" />
            <UsageRing label="APK uploads" used={0} limit={limits.apkUploadsPerPeriod} from="#34d399" to="#0d9488" />
          </section>

          <section aria-labelledby="coverage" className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <h2 id="coverage" className="mb-4 text-lg font-semibold tracking-tight">
              Device coverage
            </h2>
            <DeviceMix
              items={[
                { label: "iOS", count: countOf("ios"), gradient: "bg-gradient-to-r from-slate-400 to-slate-600", icon: <AppleIcon className="h-4 w-4" /> },
                { label: "Android", count: countOf("android"), gradient: "bg-gradient-to-r from-emerald-400 to-green-600", icon: <AndroidIcon className="h-4 w-4" /> },
                { label: "Desktop", count: countOf("desktop"), gradient: "bg-gradient-to-r from-brand-blue to-brand-violet", icon: <DesktopIcon className="h-4 w-4" /> },
              ]}
            />
          </section>
        </div>
      </div>

      {plan === "free" && (
        <Link
          href="/checkout"
          className="dash-rise group relative flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-2xl bg-gradient-to-r from-brand-blue via-brand-violet to-brand-fuchsia p-5 text-white shadow-lg transition hover:shadow-xl"
        >
          <span aria-hidden="true" className="dash-glow absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/25 blur-2xl" />
          <span className="relative">
            <span className="block text-lg font-semibold">Unlock {locked} more devices with Pro</span>
            <span className="block text-sm text-white/80">Every Mac Safari version, the latest iPhones, and more audits and uploads.</span>
          </span>
          <span className="relative inline-flex items-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-semibold text-fuchsia-700 transition group-hover:-translate-y-0.5">
            Upgrade to Pro
            <ChevronRightIcon className="h-4 w-4" />
          </span>
        </Link>
      )}

      <MockNotice>Jobs and usage on this screen are sample data until the backend is connected.</MockNotice>
    </div>
  );
}

/** The per-request user is read inside Suspense, so the navigation is not blocked on it. */
export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardPageContent />
    </Suspense>
  );
}

/** Signed-in only: the layout reads the session and may redirect, so this page cannot be validated as instant. See the layout. */
export const instant = false;
