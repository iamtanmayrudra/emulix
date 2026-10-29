import type { ReactNode } from "react";
import { RESULT_METRICS } from "@/components/device-photo";

const SVG_PROPS = {
  viewBox: "0 0 24 24",
  className: "h-4 w-4",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

/** One icon per metric label, in the same order as RESULT_METRICS. */
const METRIC_ICONS: Record<string, ReactNode> = {
  "HTTP status": (
    <svg {...SVG_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l3 3 5-6" />
    </svg>
  ),
  "Load time": (
    <svg {...SVG_PROPS}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2M9 2.5h6" />
    </svg>
  ),
  Requests: (
    <svg {...SVG_PROPS}>
      <path d="M7 4v13M3.5 13.5L7 17l3.5-3.5M17 20V7M13.5 10.5L17 7l3.5 3.5" />
    </svg>
  ),
  Viewport: (
    <svg {...SVG_PROPS}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M8 19v2M16 19v2" />
    </svg>
  ),
};

const METRIC_TINTS = [
  "from-emerald-500 to-teal-500",
  "from-brand-blue to-brand-violet",
  "from-violet-500 to-fuchsia-500",
  "from-amber-500 to-rose-500",
];

const KEPT_WITH_EACH_RUN = [
  "Status, load time, and request count",
  "The page title and the final address",
  "Every console error and failed request",
  "A screenshot, so you can see what loaded",
];

function Check() {
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-white">
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </span>
  );
}

function FloatingChip({ className, children }: { className: string; children: ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className={`absolute z-20 hidden items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold shadow-xl sm:flex ${className}`}
    >
      {children}
    </div>
  );
}

/** A report card drawn with sample values. It illustrates the product and is not a real run. */
function ReportCard() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div aria-hidden="true" className="pointer-events-none absolute -inset-8 rounded-full bg-gradient-to-br from-brand-violet/25 via-brand-fuchsia/20 to-brand-blue/20 blur-3xl" />
      <div aria-hidden="true" className="absolute inset-0 translate-x-4 translate-y-4 rotate-3 rounded-3xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 opacity-90 shadow-xl" />

      <div className="relative rounded-3xl border border-border bg-surface p-5 shadow-2xl shadow-black/10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">Completed</span>
        </div>

        <p className="mt-4 text-sm font-semibold">Report · iPhone SE</p>
        <p className="text-xs text-muted">https://example.com/ · 390 × 844</p>

        <div className="mt-4 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-blue via-brand-violet to-brand-fuchsia p-4">
          <div className="h-3 w-1/3 rounded-full bg-white/80" />
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="h-10 rounded-lg bg-white/30" />
            <div className="h-10 rounded-lg bg-white/30" />
            <div className="h-10 rounded-lg bg-white/30" />
          </div>
          <div className="mt-3 h-2 w-2/3 rounded-full bg-white/50" />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3">
          {RESULT_METRICS.map(([label, value], index) => (
            <div key={label} className="flex items-center gap-3 rounded-2xl border border-border bg-background px-3 py-2.5">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white ${METRIC_TINTS[index % METRIC_TINTS.length]}`}>
                {METRIC_ICONS[label]}
              </span>
              <div className="min-w-0">
                <dt className="text-[11px] text-muted">{label}</dt>
                <dd className="text-sm font-bold">{value}</dd>
              </div>
            </div>
          ))}
        </dl>

        <div className="mt-3 flex items-center justify-between rounded-2xl border border-success/30 bg-success/10 px-4 py-2.5 text-xs">
          <span className="text-muted">Console errors</span>
          <span className="font-semibold text-success">None recorded</span>
        </div>
        <p className="mt-3 text-[11px] text-muted">Sample values for layout only.</p>
      </div>

      <FloatingChip className="-left-6 -top-4 -rotate-6">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />0 failed requests
      </FloatingChip>
      <FloatingChip className="-bottom-4 -right-6 rotate-3">
        <span className="h-2 w-2 rounded-full bg-violet-500" />
        Screenshot saved
      </FloatingChip>
    </div>
  );
}

/** Landing section about what a run keeps: a checklist beside a layered report card. */
export function ReportShowcase() {
  return (
    <section aria-labelledby="results-heading" className="relative mx-auto max-w-5xl overflow-x-clip px-5 py-24">
      <div className="grid items-center gap-14 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Reports</p>
          <h2 id="results-heading" className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
            Every run ends with a{" "}
            <span className="bg-gradient-to-r from-violet-500 to-pink-500 bg-clip-text text-transparent">clear summary</span>
          </h2>
          <p className="mt-4 text-sm text-muted">
            Metrics, the page title, the final address, and every console error or failed request are kept with the run,
            so you can return to it later.
          </p>
          <ul className="mt-7 space-y-3 text-sm">
            {KEPT_WITH_EACH_RUN.map((item) => (
              <li key={item} className="flex gap-3">
                <Check />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <ReportCard />
      </div>
    </section>
  );
}
