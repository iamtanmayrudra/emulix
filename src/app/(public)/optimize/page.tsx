"use client";

import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import type { AuditResult, FormFactor } from "@/lib/audit/summary";

/** Icons are 24-unit outlines drawn in white on a gradient tile. */
const ICONS = {
  gauge: <path d="M4 15a8 8 0 1 1 16 0M12 15l4-4M8 19h8" />,
  accessibility: (
    <>
      <circle cx="12" cy="5" r="1.5" />
      <path d="M6 9h12M12 9v5l-3 5M12 14l3 5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5" />
    </>
  ),
  shield: <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3zM9 12l2 2 4-4" />,
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="M21 16l-5-5-8 8" />
    </>
  ),
  pointer: <path d="M6 3l12 7-5 1.5L11 17l-5-14z" />,
  layout: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="5" rx="1" />
      <rect x="3" y="13" width="18" height="8" rx="1" />
    </>
  ),
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />,
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
} satisfies Record<string, ReactNode>;

type IconName = keyof typeof ICONS;

/** Soft background tints for the score tiles. Low opacity, so they read in light and dark themes. */
const SCORE_TINTS: Record<string, string> = {
  performance: "from-amber-400/15 to-rose-400/5",
  accessibility: "from-violet-400/15 to-fuchsia-400/5",
  "best-practices": "from-emerald-400/15 to-teal-400/5",
  seo: "from-brand-blue/15 to-brand-violet/5",
};

const VITAL_ICONS: Record<string, IconName> = { lcp: "image", cls: "layout", tbt: "pointer" };

const TONE_CLASS = {
  good: { text: "text-success", bar: "bg-success", pill: "bg-success/10 text-success", label: "Good" },
  fair: { text: "text-warning", bar: "bg-warning", pill: "bg-warning/10 text-warning", label: "Needs work" },
  poor: { text: "text-danger", bar: "bg-danger", pill: "bg-danger/10 text-danger", label: "Poor" },
} as const;

type Tone = keyof typeof TONE_CLASS;

/** Scores are 0 to 100. 90 and up is good, 50 to 89 needs work, below 50 is poor. */
function scoreTone(value: number): Tone {
  if (value >= 90) return "good";
  if (value >= 50) return "fair";
  return "poor";
}

/** A letter for the overall score, so the headline reads at a glance. */
function grade(value: number): string {
  if (value >= 90) return "A";
  if (value >= 75) return "B";
  if (value >= 60) return "C";
  if (value >= 40) return "D";
  return "F";
}

const PRIORITY_CLASS: Record<AuditResult["findings"][number]["priority"], { pill: string; edge: string }> = {
  High: { pill: "bg-danger/10 text-danger", edge: "before:bg-danger" },
  Medium: { pill: "bg-warning/10 text-warning", edge: "before:bg-warning" },
  Low: { pill: "bg-accent/10 text-accent", edge: "before:bg-accent" },
};

const POLL_INTERVAL_MS = 2000;
const ACTIVE = new Set(["queued", "running"]);

type JobView = {
  id: string;
  url: string;
  formFactor: FormFactor;
  status: "queued" | "running" | "completed" | "failed" | "timed_out";
  result: AuditResult | null;
  error: string | null;
};

type ApiError = { message?: string };

/** What an audit covers, shown before the first run. */
const CHECKS: { icon: IconName; title: string; text: string; gradient: string }[] = [
  { icon: "gauge", title: "Performance", text: "Load speed, layout shifts and main-thread blocking, measured in a real browser.", gradient: "from-amber-400 to-rose-500" },
  { icon: "accessibility", title: "Accessibility", text: "Contrast, labels, names and structure that assistive technology relies on.", gradient: "from-violet-400 to-fuchsia-600" },
  { icon: "search", title: "SEO", text: "Titles, descriptions, links and crawlability that search engines read.", gradient: "from-brand-blue to-sky-500" },
  { icon: "shield", title: "Best practices", text: "HTTPS, console errors, deprecated APIs and other safety checks.", gradient: "from-emerald-400 to-teal-600" },
];

const STEPS = [
  { icon: "link", title: "Paste a public address", text: "Any public http or https page. No sign-in needed." },
  { icon: "bolt", title: "The beam sweeps it", text: "A real Chromium loads the page and measures it, usually in 15 to 60 seconds." },
  { icon: "list", title: "Fix what matters first", text: "Scores, Core Web Vitals and findings ranked by priority." },
] satisfies { icon: IconName; title: string; text: string }[];

/** Labels only: the values in the sample report are illustrative, and the card says so. */
const SAMPLE_REPORT = [
  { label: "Performance", value: 92 },
  { label: "Accessibility", value: 78 },
  { label: "Best practices", value: 88 },
  { label: "SEO", value: 70 },
];

const RUN_STAGES = ["Loading the page", "Measuring speed", "Checking accessibility", "Scoring SEO"];

const STARS = Array.from({ length: 30 }, (_, index) => ({
  left: `${(index * 37 + 11) % 100}%`,
  top: `${(index * 53 + 7) % 62}%`,
  size: 1 + (index % 3),
  delay: `${(index % 7) * 0.5}s`,
}));

function delay(ms: number): CSSProperties {
  return { "--d": `${ms}ms` } as CSSProperties;
}

function GradientIcon({ name, gradient, size = "h-11 w-11" }: { name: IconName; gradient: string; size?: string }) {
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg ${size} ${gradient}`}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {ICONS[name]}
      </svg>
    </span>
  );
}

function SectionHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="text-lg font-semibold tracking-tight">
      {children}
    </h2>
  );
}

/** A circular score. The ring is decorative; the number and the meter role carry the value. */
function ScoreRing({ value, label, tone, size = "h-28 w-28", numberClass = "text-3xl", delayMs = 0 }: { value: number; label: string; tone: Tone; size?: string; numberClass?: string; delayMs?: number }) {
  return (
    <div role="meter" aria-label={`${label} score`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} className={`relative shrink-0 ${size}`}>
      <svg viewBox="0 0 100 100" className={`h-full w-full -rotate-90 ${TONE_CLASS[tone].text}`} aria-hidden="true">
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border)" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="currentColor"
          strokeWidth="9"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${value > 0 ? Math.max(value, 2) : 0} 100`}
          className="ring-draw"
          style={delay(delayMs)}
        />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center font-semibold tabular-nums ${numberClass} ${TONE_CLASS[tone].text}`}>{value}</span>
    </div>
  );
}

/** A radar chart of the scores: one axis per score, with rings at 25, 50, 75 and 100. */
function Radar({ items, label }: { items: { label: string; value: number }[]; label: string }) {
  const count = items.length;
  const cx = 160;
  const cy = 112;
  const radius = 68;
  const angle = (index: number) => -Math.PI / 2 + (index * 2 * Math.PI) / count;
  const point = (index: number, value: number) => {
    const r = (radius * value) / 100;
    return `${(cx + r * Math.cos(angle(index))).toFixed(1)},${(cy + r * Math.sin(angle(index))).toFixed(1)}`;
  };
  const ring = (level: number) => items.map((_, index) => point(index, level)).join(" ");

  return (
    <svg viewBox="0 0 320 224" role="img" aria-label={label} className="h-full w-full">
      <defs>
        <linearGradient id="radar-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#d946ef" stopOpacity="0.45" />
        </linearGradient>
      </defs>
      {[25, 50, 75, 100].map((level) => (
        <polygon key={level} points={ring(level)} fill="none" stroke="var(--border)" strokeWidth="1" />
      ))}
      {items.map((_, index) => {
        const [x, y] = point(index, 100).split(",");
        return <line key={index} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--border)" strokeWidth="1" />;
      })}
      <polygon
        points={items.map((item, index) => point(index, item.value)).join(" ")}
        fill="url(#radar-fill)"
        stroke="#d946ef"
        strokeWidth="2"
        strokeLinejoin="round"
        className="radar-in"
      />
      {items.map((item, index) => {
        const [x, y] = point(index, item.value).split(",");
        return <circle key={item.label} cx={x} cy={y} r="3.5" fill="#fff" stroke="#d946ef" strokeWidth="2" />;
      })}
      {items.map((item, index) => {
        const cos = Math.cos(angle(index));
        const sin = Math.sin(angle(index));
        const x = cx + (radius + 14) * cos;
        const y = cy + (radius + 14) * sin + 3;
        return (
          <text key={item.label} x={x} y={y} textAnchor={cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle"} className="fill-muted text-[10px] font-medium">
            {item.label}
          </text>
        );
      })}
    </svg>
  );
}

/** The lighthouse for the hero. Its beam is a conic gradient that turns around the lantern. */
function Lighthouse() {
  return (
    <div aria-hidden="true" className="relative h-[260px] w-[140px]">
      <span
        className="beam-spin absolute left-1/2 top-[28%] h-[620px] w-[620px] [mask-image:radial-gradient(circle,#000_4%,transparent_66%)]"
        style={{
          transform: "translate(-50%, -50%)",
          background:
            "conic-gradient(from 0deg, rgba(254,240,138,0.4) 0deg, rgba(254,240,138,0) 30deg, transparent 180deg, rgba(254,240,138,0.4) 180deg, rgba(254,240,138,0) 210deg, transparent 360deg)",
        }}
      />
      <svg viewBox="0 0 140 260" className="relative h-full w-full drop-shadow-2xl">
        <defs>
          <radialGradient id="lantern-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fffbeb" />
            <stop offset="100%" stopColor="#fbbf24" />
          </radialGradient>
        </defs>
        <path d="M6 260 Q28 222 70 226 Q112 222 134 260Z" fill="#141b3a" />
        <polygon points="52,228 88,228 80,90 60,90" fill="#f1f5f9" />
        <polygon points="53.6,200 86.4,200 84.6,170 55.4,170" fill="#ef4444" />
        <polygon points="57.1,140 82.9,140 81.2,110 58.8,110" fill="#ef4444" />
        <rect x="64" y="205" width="12" height="18" rx="6" fill="#1e293b" />
        <rect x="54" y="84" width="32" height="7" rx="1.5" fill="#cbd5e1" />
        <rect x="62" y="62" width="16" height="22" rx="2" fill="url(#lantern-glow)" />
        <path d="M70 62v22M62 73h16" stroke="#92400e" strokeWidth="1" />
        <polygon points="58,62 82,62 70,46" fill="#ef4444" />
        <circle cx="70" cy="43.5" r="2.5" fill="#fecaca" />
      </svg>
    </div>
  );
}

const CARD = "rounded-2xl border border-border/70 bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md";

type Finding = AuditResult["findings"][number];

/** Copies text to the clipboard and says so. If the browser blocks the clipboard, nothing happens. */
function CopyButton({ text, label, small = false }: { text: string; label: string; small?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can be refused, for example on an insecure page. The text stays selectable.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface font-semibold transition hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent ${
        small ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15V6a2 2 0 0 1 2-2h9" />
      </svg>
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </button>
  );
}

/** Every finding and its fix as a Markdown checklist, to paste into an issue tracker or a message. */
function fixListMarkdown(result: AuditResult): string {
  const lines = [`# Fixes for ${result.finalUrl}`, `Audited on ${result.formFactor}, ${new Date(result.fetchedAt).toLocaleString()}`, ""];
  for (const finding of result.findings) {
    lines.push(`## [${finding.priority}] ${finding.title}`);
    if (finding.detail) lines.push(finding.detail);
    if (finding.evidence.length > 0) lines.push("", "Found on:", ...finding.evidence.map((item) => `- ${item}`));
    lines.push("", finding.solution.summary, ...finding.solution.steps.map((step, index) => `${index + 1}. ${step}`));
    if (finding.solution.example) lines.push("", "```" + finding.solution.example.language, finding.solution.example.code, "```");
    if (finding.docsUrl) lines.push("", `Guide: ${finding.docsUrl}`);
    lines.push("");
  }
  return lines.join("\n");
}

/** One finding: the problem, where it was found, and what to change, with a code example and the guide. */
function FindingCard({ finding, index }: { finding: Finding; index: number }) {
  const { solution } = finding;
  return (
    <li
      style={delay(index * 40)}
      className={`dash-rise relative overflow-hidden rounded-xl border border-border/70 bg-surface shadow-sm transition before:absolute before:inset-y-0 before:left-0 before:w-1 hover:shadow-md ${PRIORITY_CLASS[finding.priority].edge}`}
    >
      <details open={index === 0} className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2.5 px-4 py-2.5 pl-5 [&::-webkit-details-marker]:hidden">
          <span className={`inline-flex w-[4.25rem] shrink-0 justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${PRIORITY_CLASS[finding.priority].pill}`}>
            {finding.priority}
          </span>
          <span className="min-w-0 flex-1 text-sm font-medium leading-snug sm:truncate">{finding.title}</span>
          {finding.impact && <span className="hidden rounded-full bg-background px-2 py-0.5 text-[11px] font-medium text-muted sm:inline">{finding.impact}</span>}
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted transition group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </summary>

        <div className="grid gap-4 border-t border-border/70 bg-gradient-to-br from-emerald-400/5 via-transparent to-sky-400/5 p-4 pl-5 lg:grid-cols-2">
          <div className="min-w-0 space-y-3">
            {finding.detail && <p className="text-sm text-muted">{finding.detail}</p>}
            {finding.evidence.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Found on</p>
                <ul className="mt-1.5 space-y-1">
                  {finding.evidence.map((item) => (
                    <li key={item} className="break-all rounded-md bg-background px-2.5 py-1 font-mono text-[11px]">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {solution.example && (
              <div className="overflow-hidden rounded-lg border border-border/70">
                <div className="flex items-center justify-between gap-2 bg-background px-2.5 py-1">
                  <span className="font-mono text-[11px] uppercase text-muted">Example · {solution.example.language}</span>
                  <CopyButton text={solution.example.code} label="Copy" small />
                </div>
                <pre className="max-h-44 overflow-auto bg-[#0b1220] p-3 text-[11px] leading-relaxed text-slate-100">
                  <code>{solution.example.code}</code>
                </pre>
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-3">
            <div className="rounded-lg border border-emerald-500/25 bg-gradient-to-br from-emerald-400/10 to-sky-400/5 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-success">
                <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full bg-success/15">
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                How to fix
              </p>
              <p className="mt-1.5 text-sm">{solution.summary}</p>
              <ol className="mt-2 space-y-1.5 text-sm">
                {solution.steps.map((step, stepIndex) => (
                  <li key={step} className="flex gap-2.5">
                    <span aria-hidden="true" className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success text-[10px] font-bold text-white">
                      {stepIndex + 1}
                    </span>
                    <span className="min-w-0">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
            {finding.docsUrl && (
              <a
                href={finding.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent"
              >
                Read the full guide
                <span className="sr-only">(opens in a new tab)</span>
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M7 17L17 7M8 7h9v9" />
                </svg>
              </a>
            )}
          </div>
        </div>
      </details>
    </li>
  );
}

export default function OptimizePage() {
  const [url, setUrl] = useState("https://");
  const [formFactor, setFormFactor] = useState<FormFactor>("mobile");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [job, setJob] = useState<JobView | null>(null);

  // Check on a running audit until it finishes.
  useEffect(() => {
    if (!job || !ACTIVE.has(job.status)) return;
    const id = job.id;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/audits/${id}`);
        if (!response.ok) return;
        const data = (await response.json()) as { job: JobView };
        setJob(data.job);
      } catch {
        // A network blip is retried on the next check.
      }
    }, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [job]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      new URL(url.trim());
    } catch {
      setUrlError("Enter a full address, including https://.");
      return;
    }
    setUrlError(null);
    setFormError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), formFactor }),
      });
      const data = (await response.json().catch(() => ({}))) as ApiError & { job?: JobView };
      if (!response.ok || !data.job) {
        setFormError(data.message ?? "The audit could not start. Try again.");
        return;
      }
      setJob(data.job);
    } catch {
      setFormError("Network error. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const running = job !== null && ACTIVE.has(job.status);
  const result = job?.status === "completed" ? job.result : null;
  const overall = result && result.scores.length > 0 ? Math.round(result.scores.reduce((sum, score) => sum + score.value, 0) / result.scores.length) : null;

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <section
        aria-labelledby="optimize-heading"
        className="dash-rise relative overflow-clip rounded-3xl bg-gradient-to-b from-[#040816] via-[#0b1741] to-[#2a1250] p-6 text-white shadow-xl md:p-10"
      >
        {/* Night sky */}
        <div aria-hidden="true" className="absolute inset-0">
          {STARS.map((star, index) => (
            <span
              key={index}
              className="twinkle absolute rounded-full bg-white"
              style={{ left: star.left, top: star.top, width: star.size, height: star.size, ["--d" as string]: star.delay }}
            />
          ))}
        </div>
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-rose-500/35 via-amber-400/10 to-transparent" />
        <div aria-hidden="true" className="dash-glow absolute -right-10 top-10 h-72 w-72 rounded-full bg-violet-500/30 blur-3xl" />

        {/* Sea */}
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-14 overflow-hidden">
          <div className="wave-drift flex w-[200%]">
            {[0, 1].map((tile) => (
              <svg key={tile} viewBox="0 0 1200 60" preserveAspectRatio="none" className="h-14 w-1/2">
                <path d="M0 28 Q150 0 300 28 T600 28 T900 28 T1200 28 V60 H0Z" fill="#0a1236" fillOpacity="0.85" />
              </svg>
            ))}
          </div>
        </div>

        <div className="relative grid items-center gap-8 pb-8 lg:grid-cols-[1fr_auto]">
          <div className="min-w-0 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/20 backdrop-blur">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                Powered by Lighthouse
              </p>
              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium text-white/80 ring-1 ring-white/25">Lab run</span>
            </div>
            <h1 id="optimize-heading" className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
              Shine a light on{" "}
              <span className="bg-gradient-to-r from-amber-200 via-rose-300 to-fuchsia-300 bg-clip-text text-transparent">your page</span>
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-white/80 md:text-base">
              The Optimization studio audits any public page for performance, accessibility, SEO and best practices, then ranks what to fix first.
            </p>

            <form onSubmit={handleSubmit} noValidate aria-label="Run an audit" className="mt-6 space-y-3 rounded-2xl bg-white/10 p-3 ring-1 ring-white/25 backdrop-blur md:p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="text-xs font-semibold text-white/85">Page address</span>
                  <input
                    type="url"
                    inputMode="url"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    aria-invalid={urlError ? true : undefined}
                    aria-describedby={urlError ? "audit-url-error" : "audit-url-help"}
                    className="rounded-xl border border-white/25 bg-black/30 px-3.5 py-2.5 text-sm text-white placeholder:text-white/50 focus-visible:outline-2 focus-visible:outline-white"
                  />
                </label>
                <div role="group" aria-label="Device" className="flex rounded-xl border border-white/25 bg-black/30 p-1 text-sm">
                  {(["mobile", "desktop"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={formFactor === value}
                      onClick={() => setFormFactor(value)}
                      className={`rounded-lg px-3.5 py-1.5 font-semibold capitalize transition ${
                        formFactor === value ? "bg-white text-[#1b1240] shadow-sm" : "text-white/75 hover:text-white"
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={submitting || running}
                  className="rounded-xl bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400 px-6 py-2.5 text-sm font-semibold text-[#2a0f35] shadow-lg shadow-amber-500/20 transition hover:-translate-y-0.5 hover:shadow-xl disabled:translate-y-0 disabled:opacity-60"
                >
                  {submitting ? "Starting…" : running ? "Running…" : "Run audit"}
                </button>
              </div>
              <p id="audit-url-help" className="text-xs text-white/70">
                Public http or https addresses only. Local and private addresses are refused.
              </p>
              {urlError && (
                <p id="audit-url-error" role="alert" className="text-sm font-semibold text-amber-200">
                  {urlError}
                </p>
              )}
              {formError && (
                <p role="alert" className="text-sm font-semibold text-amber-200">
                  {formError}
                </p>
              )}
            </form>
          </div>

          <div className="hidden justify-self-center pr-6 lg:block">
            <Lighthouse />
          </div>
        </div>
      </section>

      {running && (
        <section role="status" aria-label="Audit running" className={`${CARD} dash-rise grid items-center gap-6 md:grid-cols-[auto_1fr]`}>
          <div aria-hidden="true" className="relative mx-auto w-52 overflow-hidden rounded-xl border border-border bg-background shadow-inner">
            <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-rose-400" />
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="ml-2 h-2 flex-1 rounded-full bg-border" />
            </div>
            <div className="relative space-y-2 p-3">
              <span className="block h-10 rounded-md bg-gradient-to-r from-border to-transparent" />
              <span className="block h-2 w-5/6 rounded-full bg-border" />
              <span className="block h-2 w-2/3 rounded-full bg-border" />
              <span className="block h-2 w-3/4 rounded-full bg-border" />
              <span className="block h-8 rounded-md bg-border/70" />
              <span className="scan-line absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_14px_3px_rgba(251,191,36,0.6)]" />
            </div>
          </div>
          <div className="min-w-0 space-y-4">
            <div>
              <p className="text-lg font-semibold">The beam is sweeping your page</p>
              <p className="truncate text-sm text-muted">
                {job.url}. This usually takes 15 to 60 seconds.
              </p>
            </div>
            <ul className="flex flex-wrap gap-2">
              {RUN_STAGES.map((stage, index) => (
                <li key={stage} className="stage-pulse inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent" style={{ ["--d" as string]: `${index * 0.45}s` }}>
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
                  {stage}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {job && (job.status === "failed" || job.status === "timed_out") && (
        <p role="alert" className="rounded-2xl border border-danger/30 bg-danger/5 p-5 text-sm text-danger">
          {job.error ?? "The audit could not finish."}
        </p>
      )}

      {!job && (
        <>
          <section aria-labelledby="checks-heading" className="grid items-stretch gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-4">
              <SectionHeading id="checks-heading">What an audit covers</SectionHeading>
              <ul className="space-y-3">
                {CHECKS.map((check, index) => (
                  <li key={check.title} style={delay(120 + index * 70)} className={`${CARD} dash-rise group relative flex items-center gap-4 overflow-hidden py-4`}>
                    <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${check.gradient}`} />
                    <GradientIcon name={check.icon} gradient={check.gradient} size="h-12 w-12" />
                    <div className="min-w-0">
                      <h3 className="font-semibold">{check.title}</h3>
                      <p className="text-sm text-muted">{check.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <figure style={delay(300)} className="dash-rise relative flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-surface to-background p-5 shadow-sm">
              <span aria-hidden="true" className="dash-glow absolute -right-10 -top-10 h-40 w-40 rounded-full bg-fuchsia-500/20 blur-3xl" />
              <figcaption className="relative flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">Sample report</span>
                <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted">Example numbers</span>
              </figcaption>
              <div className="relative mx-auto my-2 aspect-[320/224] w-full max-w-sm">
                <Radar items={SAMPLE_REPORT} label="Sample radar chart of four example scores" />
              </div>
              <p className="relative text-center text-xs text-muted">Your real scores draw on this chart after an audit.</p>
            </figure>
          </section>

          <section aria-labelledby="steps-heading" className="space-y-4">
            <SectionHeading id="steps-heading">How it works</SectionHeading>
            <ol className="relative grid gap-4 md:grid-cols-3">
              <span aria-hidden="true" className="absolute left-[16%] right-[16%] top-11 hidden border-t-2 border-dashed border-border md:block" />
              {STEPS.map((step, index) => (
                <li key={step.title} style={delay(400 + index * 80)} className={`${CARD} dash-rise relative flex flex-col items-center gap-3 text-center`}>
                  <span className="relative">
                    <GradientIcon name={step.icon} gradient="from-amber-400 via-rose-500 to-fuchsia-600" size="h-12 w-12" />
                    <span aria-hidden="true" className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-[11px] font-bold text-background">
                      {index + 1}
                    </span>
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-semibold">{step.title}</h3>
                    <p className="mt-1 text-sm text-muted">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}

      {result && (
        <>
          <section aria-label="Summary" className="dash-rise relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-amber-400/10 via-rose-400/10 to-violet-400/10 p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              {overall !== null && (
                <div className="relative shrink-0">
                  <ScoreRing value={overall} label="Overall" tone={scoreTone(overall)} size="h-[4.5rem] w-[4.5rem]" numberClass="text-2xl" />
                  <span
                    aria-label={`Grade ${grade(overall)}`}
                    className={`absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface text-sm font-bold text-white shadow ${TONE_CLASS[scoreTone(overall)].bar}`}
                  >
                    {grade(overall)}
                  </span>
                </div>
              )}
              <div className="min-w-0 flex-1 basis-56">
                <p className="text-xs text-muted">Overall result for</p>
                <p className="truncate text-lg font-semibold">{result.finalUrl}</p>
                <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 font-semibold capitalize text-accent">{result.formFactor}</span>
                  <span className="rounded-full bg-background/80 px-2 py-0.5 font-medium">
                    {result.findings.length} {result.findings.length === 1 ? "finding" : "findings"}
                    {result.findings.some((finding) => finding.priority === "High") && ` · ${result.findings.filter((finding) => finding.priority === "High").length} high`}
                  </span>
                  <span>Measured {new Date(result.fetchedAt).toLocaleString()}</span>
                </p>
              </div>
              <div className="mx-auto hidden aspect-[320/224] w-56 shrink-0 sm:block">
                <Radar
                  items={result.scores.map((score) => ({ label: score.label, value: score.value }))}
                  label={`Radar chart: ${result.scores.map((score) => `${score.label} ${score.value}`).join(", ")}`}
                />
              </div>
            </div>
          </section>

          <section aria-labelledby="scores-heading" className="space-y-3">
            <SectionHeading id="scores-heading">Scores</SectionHeading>
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {result.scores.map((score, index) => {
                const tone = TONE_CLASS[scoreTone(score.value)];
                return (
                  <li
                    key={score.id}
                    style={delay(index * 70)}
                    className={`dash-rise flex items-center gap-3 rounded-2xl border border-border/70 bg-gradient-to-br p-3 shadow-sm ${SCORE_TINTS[score.id] ?? "from-sky-400/15 to-blue-400/5"}`}
                  >
                    <ScoreRing value={score.value} label={score.label} tone={scoreTone(score.value)} size="h-14 w-14" numberClass="text-base" delayMs={index * 120} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-tight">{score.label}</p>
                      <span className={`mt-1 inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${tone.pill}`}>{tone.label}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-labelledby="vitals-heading" className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <SectionHeading id="vitals-heading">Core Web Vitals (lab)</SectionHeading>
              <p className="text-xs text-muted">TBT stands in for INP, which needs real user interactions to measure.</p>
            </div>
            <ul className="grid gap-3 md:grid-cols-3">
              {result.vitals.map((vital, index) => {
                const tone = TONE_CLASS[vital.tone];
                return (
                  <li
                    key={vital.id}
                    style={delay(index * 70)}
                    className="dash-rise relative flex items-center gap-3 overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-sky-400/10 to-violet-400/5 p-3 pb-4 shadow-sm"
                  >
                    <GradientIcon name={VITAL_ICONS[vital.id] ?? "gauge"} gradient="from-amber-400 via-rose-500 to-fuchsia-600" size="h-9 w-9" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-muted">{vital.label}</p>
                      <p className={`text-xl font-semibold leading-tight tabular-nums ${tone.text}`}>{vital.value}</p>
                    </div>
                    <span className={`self-start whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${tone.pill}`}>{tone.label}</span>
                    <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-border/60">
                      <div className={`h-full ${tone.bar}`} style={{ width: vital.tone === "good" ? "100%" : vital.tone === "fair" ? "60%" : "25%" }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-labelledby="findings-heading" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionHeading id="findings-heading">Prioritized findings and how to fix them</SectionHeading>
              {result.findings.length > 0 && <CopyButton text={fixListMarkdown(result)} label="Copy all fixes" />}
            </div>
            {result.findings.length === 0 ? (
              <p className="rounded-2xl border border-border/70 bg-surface p-5 text-sm text-muted shadow-sm">
                No failing checks in the categories above.
              </p>
            ) : (
              <>
                <ul className="space-y-2">
                  {result.findings.map((finding, index) => (
                    <FindingCard key={finding.id} finding={finding} index={index} />
                  ))}
                </ul>
                <p className="text-xs text-muted">Fixes are guidance. Change one thing at a time and run the audit again to confirm the score moved.</p>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
