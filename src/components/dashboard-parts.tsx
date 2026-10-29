import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import {
  AndroidIcon,
  AppleIcon,
  ChevronRightIcon,
  DesktopIcon,
  GaugeIcon,
  GlobeIcon,
  PhoneIcon,
} from "@/components/device-lab/icons";
import { JobStatusBadge } from "@/components/job-status-badge";
import type { JobType, TestJob } from "@/lib/mock-data";

/** Staggers the rise-in of a block. */
function delay(ms: number): CSSProperties {
  return { "--d": `${ms}ms` } as CSSProperties;
}

/** A rounded tile with a gradient behind a white icon. */
function IconTile({ gradient, children, size = "h-11 w-11" }: { gradient: string; children: ReactNode; size?: string }) {
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-xl text-white shadow-lg ${size} ${gradient}`}>
      {children}
    </span>
  );
}

type HeroProps = { name: string; plan: "free" | "pro"; deviceCount: number; unlocked: number };

const ORBIT_CHIPS = [
  { icon: <AppleIcon className="h-5 w-5" />, pos: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2", tone: "from-slate-200 to-slate-400 text-slate-900" },
  { icon: <AndroidIcon className="h-5 w-5" />, pos: "bottom-[14%] right-[2%]", tone: "from-emerald-300 to-emerald-500 text-emerald-950" },
  { icon: <DesktopIcon className="h-5 w-5" />, pos: "bottom-[14%] left-[2%]", tone: "from-sky-300 to-blue-500 text-blue-950" },
];

/** Dark gradient banner: greeting and primary actions on the left, orbiting platform chips around a device on the right. */
export function DashboardHero({ name, plan, deviceCount, unlocked }: HeroProps) {
  return (
    <section
      aria-labelledby="dashboard-heading"
      className="dash-rise relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-ink via-brand-deep to-brand-violet p-6 text-white shadow-xl md:p-10"
    >
      <div aria-hidden="true" className="dash-glow absolute -left-16 -top-24 h-72 w-72 rounded-full bg-rose-500/40 blur-3xl" />
      <div aria-hidden="true" className="dash-glow absolute -bottom-28 right-10 h-80 w-80 rounded-full bg-brand-blue/40 blur-3xl" />
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:36px_36px] [mask-image:radial-gradient(ellipse_at_70%_40%,black,transparent_70%)]"
      />

      <div className="relative grid items-center gap-8 md:grid-cols-[1fr_auto]">
        <div className="max-w-xl">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/20 backdrop-blur">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Device lab · {plan === "pro" ? "Pro plan" : "Free plan"}
          </p>
          <h1 id="dashboard-heading" className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
            Welcome back,{" "}
            <span className="bg-gradient-to-r from-amber-200 via-rose-200 to-sky-200 bg-clip-text text-transparent">{name}</span>
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/75 md:text-base">
            {unlocked} of {deviceCount} real browsers and devices are ready for you. Open a live page on a phone, tablet or Mac, and see
            exactly what your visitors see.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/test"
              className="group inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-brand-ink shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              Test a URL
              <ChevronRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/optimize"
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold ring-1 ring-white/30 backdrop-blur transition hover:bg-white/20"
            >
              Run an audit
            </Link>
          </div>
        </div>

        {/* Orbit art: decorative */}
        <div aria-hidden="true" className="relative mx-auto hidden h-60 w-60 md:block">
          <div className="absolute inset-3 rounded-full border border-dashed border-white/25" />
          <div className="absolute inset-12 rounded-full border border-white/10" />
          <div className="dash-orbit absolute inset-0">
            {ORBIT_CHIPS.map((chip, index) => (
              <span key={index} className={`absolute ${chip.pos}`}>
                <span className={`dash-orbit-rev flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg ring-1 ring-white/40 ${chip.tone}`}>
                  {chip.icon}
                </span>
              </span>
            ))}
          </div>
          {/* Centre device */}
          <div className="absolute left-1/2 top-1/2 h-36 w-[4.5rem] -translate-x-1/2 -translate-y-1/2 rounded-[1.1rem] bg-gradient-to-b from-slate-200 to-slate-500 p-[3px] shadow-2xl">
            <div className="flex h-full w-full flex-col gap-1.5 rounded-[0.95rem] bg-gradient-to-b from-brand-deep to-brand-ink p-2">
              <span className="mx-auto h-1.5 w-6 rounded-full bg-black/60" />
              <span className="h-10 rounded-md bg-gradient-to-br from-rose-400 to-amber-300" />
              <span className="h-1.5 w-3/4 rounded bg-white/40" />
              <span className="h-1.5 w-1/2 rounded bg-white/25" />
              <span className="mt-auto h-5 rounded bg-brand-blue/70" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

type StatProps = { label: string; value: string; hint: string; gradient: string; icon: ReactNode; index: number };

export function StatTile({ label, value, hint, gradient, icon, index }: StatProps) {
  return (
    <div
      style={delay(120 + index * 70)}
      className="dash-rise group relative overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <span aria-hidden="true" className={`absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-20 blur-xl transition group-hover:opacity-40 ${gradient}`} />
      <div className="relative flex items-center gap-3">
        <IconTile gradient={gradient}>{icon}</IconTile>
        <div className="min-w-0">
          <p className="text-2xl font-semibold leading-none tracking-tight tabular-nums">{value}</p>
          <p className="mt-1 truncate text-xs font-medium">{label}</p>
        </div>
      </div>
      <p className="relative mt-3 text-xs text-muted">{hint}</p>
    </div>
  );
}

type ActionProps = { href: string; title: string; text: string; gradient: string; icon: ReactNode; index: number };

export function ActionCard({ href, title, text, gradient, icon, index }: ActionProps) {
  return (
    <Link
      href={href}
      style={delay(380 + index * 80)}
      className="dash-rise group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:-translate-y-1 hover:border-transparent hover:shadow-xl"
    >
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 ${gradient}`} />
      <span aria-hidden="true" className={`absolute -bottom-10 -right-10 h-32 w-32 rounded-full opacity-0 blur-2xl transition group-hover:opacity-30 ${gradient}`} />
      <IconTile gradient={gradient} size="h-12 w-12">
        {icon}
      </IconTile>
      <div className="relative">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted">{text}</p>
      </div>
      <span className="relative mt-auto inline-flex items-center gap-1 text-sm font-semibold text-accent">
        Open
        <ChevronRightIcon className="h-4 w-4 transition group-hover:translate-x-1" />
      </span>
    </Link>
  );
}

const JOB_TYPES: Record<JobType, { label: string; gradient: string; icon: ReactNode }> = {
  website: { label: "Website test", gradient: "bg-gradient-to-br from-brand-blue to-brand-violet", icon: <GlobeIcon className="h-4 w-4" /> },
  audit: { label: "Audit", gradient: "bg-gradient-to-br from-amber-400 to-rose-500", icon: <GaugeIcon className="h-4 w-4" /> },
  apk: { label: "APK test", gradient: "bg-gradient-to-br from-emerald-400 to-teal-600", icon: <PhoneIcon className="h-4 w-4" /> },
};

/** Recent jobs on a vertical timeline, each with a coloured type marker. */
export function JobTimeline({ jobs }: { jobs: TestJob[] }) {
  return (
    <ol className="relative mt-5 space-y-1 before:absolute before:bottom-3 before:left-[1.625rem] before:top-3 before:w-px before:bg-gradient-to-b before:from-accent before:via-border before:to-transparent">
      {jobs.map((job) => {
        const type = JOB_TYPES[job.type];
        return (
          <li key={job.id} className="relative flex items-center gap-4 rounded-xl p-2 transition hover:bg-background">
            <IconTile gradient={type.gradient} size="h-9 w-9 ring-4 ring-surface">
              {type.icon}
            </IconTile>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{job.target}</p>
              <p className="truncate text-xs text-muted">
                {type.label} · {job.profile} · {job.startedAt}
              </p>
            </div>
            <JobStatusBadge status={job.status} />
          </li>
        );
      })}
    </ol>
  );
}

/** A circular gauge. The ring is decorative; the progressbar role carries the value. */
export function UsageRing({ label, used, limit, from, to }: { label: string; used: number; limit: number; from: string; to: string }) {
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const id = `ring-${label.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <div className="flex items-center gap-4">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
        className="relative h-20 w-20 shrink-0"
      >
        <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90" aria-hidden="true">
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={from} />
              <stop offset="100%" stopColor={to} />
            </linearGradient>
          </defs>
          <circle cx="40" cy="40" r="32" fill="none" stroke="var(--border)" strokeWidth="9" />
          <circle
            cx="40"
            cy="40"
            r="32"
            fill="none"
            stroke={`url(#${id})`}
            strokeWidth="9"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${percent > 0 ? Math.max(percent, 2) : 0} 100`}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums">{percent}%</span>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted">
          {used} of {limit} used
        </p>
      </div>
    </div>
  );
}

type Mix = { label: string; count: number; gradient: string; icon: ReactNode };

/** How the device library splits across platforms, as a segmented bar with a legend. */
export function DeviceMix({ items }: { items: Mix[] }) {
  const total = items.reduce((sum, item) => sum + item.count, 0) || 1;
  return (
    <div>
      <div className="flex h-3 w-full gap-1 overflow-hidden rounded-full" role="img" aria-label={items.map((item) => `${item.label} ${item.count}`).join(", ")}>
        {items.map((item) => (
          <span key={item.label} className={`${item.gradient} first:rounded-l-full last:rounded-r-full`} style={{ width: `${(item.count / total) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-3 gap-3">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2">
            <IconTile gradient={item.gradient} size="h-8 w-8">
              {item.icon}
            </IconTile>
            <span className="min-w-0">
              <span className="block text-base font-semibold leading-none tabular-nums">{item.count}</span>
              <span className="block truncate text-xs text-muted">{item.label}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
