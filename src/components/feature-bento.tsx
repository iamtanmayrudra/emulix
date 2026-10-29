import type { ReactNode } from "react";

type Feature = {
  title: string;
  body: string;
  /** Grid span on medium screens and up, out of 6 columns. */
  span: string;
  icon: ReactNode;
  /** Gradient for the icon tile. */
  tint: string;
  art: ReactNode;
};

const ICON_PROPS = {
  viewBox: "0 0 24 24",
  className: "h-5 w-5",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

/** Phone, tablet and laptop silhouettes with their viewport sizes. Decorative. */
function DevicesArt() {
  const screen = "bg-gradient-to-br from-brand-blue via-brand-violet to-brand-fuchsia";
  return (
    <div className="flex h-full items-end justify-center gap-5 rounded-2xl bg-gradient-to-br from-brand-blue/10 via-brand-violet/10 to-brand-fuchsia/15 px-4 pb-4 pt-6">
      <div className="flex flex-col items-center gap-1.5">
        <div className="h-24 w-12 rounded-xl border-[3px] border-slate-800 bg-white p-1 shadow-lg transition duration-500 group-hover:-translate-y-1.5 dark:border-slate-200">
          <div className={`h-full rounded-md ${screen}`} />
        </div>
        <span className="text-[10px] font-medium text-muted">390 × 844</span>
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <div className="h-28 w-20 rounded-xl border-[3px] border-slate-800 bg-white p-1 shadow-lg transition delay-75 duration-500 group-hover:-translate-y-2.5 dark:border-slate-200">
          <div className={`h-full rounded-md ${screen}`} />
        </div>
        <span className="text-[10px] font-medium text-muted">820 × 1180</span>
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex flex-col items-center transition delay-150 duration-500 group-hover:-translate-y-1.5">
          <div className="h-20 w-32 rounded-t-lg border-[3px] border-slate-800 bg-white p-1 shadow-lg dark:border-slate-200">
            <div className={`h-full rounded-sm ${screen}`} />
          </div>
          <div className="h-1.5 w-36 rounded-b-md bg-slate-800 dark:bg-slate-200" />
        </div>
        <span className="text-[10px] font-medium text-muted">1366 × 768</span>
      </div>
    </div>
  );
}

/** Console lines of the kind a run records. The lines are an illustration, not output from a real page. */
function EvidenceArt() {
  const lines = [
    { mark: "●", tone: "text-emerald-400", text: "200  GET /app.js" },
    { mark: "▲", tone: "text-amber-300", text: "Deprecated API call" },
    { mark: "✕", tone: "text-rose-400", text: "Image failed to load" },
  ];
  return (
    <div className="h-full rounded-2xl bg-slate-900 p-4 font-mono text-[11px] leading-6 text-slate-300 shadow-inner">
      <div className="mb-2 flex gap-1.5" aria-hidden="true">
        <span className="h-2 w-2 rounded-full bg-rose-400" />
        <span className="h-2 w-2 rounded-full bg-amber-300" />
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
      </div>
      {lines.map((line) => (
        <p key={line.text} className="flex gap-2">
          <span className={line.tone}>{line.mark}</span>
          {line.text}
        </p>
      ))}
    </div>
  );
}

/** Checks applied to an uploaded package. Decorative. */
function ApkArt() {
  const checks = ["File type is .apk", "Size within the plan limit"];
  return (
    <div className="space-y-2 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/15 p-4">
      {checks.map((check) => (
        <div key={check} className="flex items-center gap-2.5 rounded-xl bg-surface px-3 py-2 text-xs font-medium shadow-sm">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          {check}
        </div>
      ))}
      <div className="h-1.5 overflow-hidden rounded-full bg-emerald-500/20">
        <div className="h-full w-3/5 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-700 group-hover:w-full" />
      </div>
    </div>
  );
}

/** A list of kept runs. The runs are an illustration. */
function ReportsArt() {
  const runs = [
    { name: "iPhone SE", when: "Today", width: "w-4/5" },
    { name: "iPad Air", when: "Yesterday", width: "w-3/5" },
    { name: "Desktop 1280", when: "Mon", width: "w-2/3" },
  ];
  return (
    <div className="space-y-2 rounded-2xl bg-gradient-to-br from-violet-500/10 via-fuchsia-500/10 to-pink-500/15 p-4">
      {runs.map((run) => (
        <div key={run.name} className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2 shadow-sm">
          <span className="w-24 shrink-0 text-xs font-semibold">{run.name}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-violet-500/15">
            <div className={`h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500 ${run.width}`} />
          </div>
          <span className="hidden text-[10px] text-muted sm:inline">{run.when}</span>
          <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">Done</span>
        </div>
      ))}
    </div>
  );
}

const FEATURES: Feature[] = [
  {
    title: "Device previews",
    body: "Load a page in a real browser at common phone, tablet, and desktop sizes.",
    span: "md:col-span-4",
    tint: "from-brand-blue to-brand-violet",
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
        <path d="M11 18.5h2" />
      </svg>
    ),
    art: <DevicesArt />,
  },
  {
    title: "Browser evidence",
    body: "Screenshots, console errors, and failed requests in one place.",
    span: "md:col-span-2",
    tint: "from-amber-500 to-rose-500",
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 9h18M8 14l2.5 2.5L16 12" />
      </svg>
    ),
    art: <EvidenceArt />,
  },
  {
    title: "Android APK checks",
    body: "Upload a build and check its file type and size. Running APKs arrives in a later phase.",
    span: "md:col-span-2",
    tint: "from-emerald-500 to-teal-600",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
      </svg>
    ),
    art: <ApkArt />,
  },
  {
    title: "Saved reports",
    body: "Every run keeps its status, device, and results, so you can come back to it.",
    span: "md:col-span-4",
    tint: "from-violet-500 to-pink-500",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M6 3h9l4 4v14H6z" />
        <path d="M9 13h6M9 17h4" />
      </svg>
    ),
    art: <ReportsArt />,
  },
];

/** Bento grid of the product's features, each with a small illustration. */
export function FeatureBento() {
  return (
    <section id="features" aria-labelledby="features-heading" className="relative mx-auto max-w-5xl scroll-mt-16 px-5 pb-16 pt-24">
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-10 -z-10 h-64 w-[80%] -translate-x-1/2 rounded-full bg-gradient-to-r from-brand-blue/15 via-violet-400/15 to-fuchsia-400/15 blur-3xl" />
      <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-accent">Features</p>
      <h2 id="features-heading" className="mt-2 text-center text-3xl font-bold tracking-tight md:text-4xl">
        What you can do
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-center text-sm text-muted">
        Everything a check needs, from the first load to the report you keep.
      </p>
      <ul className="mt-12 grid gap-5 md:grid-cols-6">
        {FEATURES.map((feature) => (
          <li
            key={feature.title}
            className={`group flex flex-col overflow-hidden rounded-3xl border border-border bg-surface p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl ${feature.span}`}
          >
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg ${feature.tint}`}>
              {feature.icon}
            </span>
            <h3 className="mt-5 text-lg font-bold">{feature.title}</h3>
            <p className="mt-2 text-sm text-muted">{feature.body}</p>
            <div aria-hidden="true" className="mt-6 flex-1">
              {feature.art}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
