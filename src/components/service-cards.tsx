import Link from "next/link";
import type { ReactNode } from "react";

type Service = {
  href: string;
  title: string;
  body: string;
  cta: string;
  /** Gradient behind the illustration. */
  tint: string;
  /** Accent used for the label and the call to action. */
  accent: string;
  tag: string;
  art: ReactNode;
};

/** Browser window and phone, for website testing. Decorative. */
function WebsiteArt() {
  return (
    <div className="relative h-full w-full">
      <div className="absolute left-6 top-8 w-[62%] overflow-hidden rounded-xl bg-white shadow-xl shadow-black/20 transition duration-500 group-hover:-translate-y-1">
        <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-100 px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-rose-400" />
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="ml-2 h-3 flex-1 rounded-full bg-white" />
        </div>
        <div className="space-y-2 p-3">
          <div className="h-12 rounded-lg bg-gradient-to-r from-brand-blue to-brand-violet" />
          <div className="h-2 w-3/4 rounded-full bg-slate-200" />
          <div className="h-2 w-1/2 rounded-full bg-slate-200" />
        </div>
      </div>
      <div className="absolute bottom-5 right-7 h-32 w-[74px] rounded-[1.1rem] border-[3px] border-slate-900 bg-white p-1.5 shadow-xl shadow-black/30 transition duration-500 group-hover:translate-y-1">
        <div className="h-9 rounded-md bg-gradient-to-br from-brand-violet to-brand-fuchsia" />
        <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-200" />
        <div className="mt-1 h-1.5 w-2/3 rounded-full bg-slate-200" />
        <div className="mt-1 h-1.5 w-4/5 rounded-full bg-slate-200" />
      </div>
    </div>
  );
}

/** App package arriving in a drop zone, for APK testing. Decorative. */
function ApkArt() {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <div className="absolute inset-x-8 inset-y-7 rounded-2xl border-2 border-dashed border-white/60" />
      <div className="relative flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-xl shadow-black/20 transition duration-500 group-hover:-translate-y-1">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
          </svg>
        </span>
        <div>
          <p className="text-xs font-semibold text-slate-900">your-app.apk</p>
          <div className="mt-1.5 h-1.5 w-28 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500" />
          </div>
          <p className="mt-1 text-[10px] text-slate-500">Type and size check</p>
        </div>
      </div>
    </div>
  );
}

function Ring({ value, label, color }: { value: number; label: string; color: string }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden="true">
        <circle cx="32" cy="32" r={radius} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * circumference} ${circumference}`}
        />
      </svg>
      <span className="text-[10px] font-semibold text-white/90">{label}</span>
    </div>
  );
}

/** Score rings, for optimization audits. The values are an illustration, not a measurement. */
function OptimizeArt() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3">
      <div className="flex items-end gap-5 rounded-2xl bg-white/15 px-5 py-4 shadow-xl shadow-black/15 backdrop-blur transition duration-500 group-hover:-translate-y-1">
        <Ring value={92} label="Speed" color="#ffffff" />
        <Ring value={78} label="Access" color="#fde68a" />
        <Ring value={85} label="SEO" color="#fecdd3" />
      </div>
      <p className="text-[10px] font-medium text-white/80">Sample scores</p>
    </div>
  );
}

const SERVICES: Service[] = [
  {
    href: "/test",
    title: "Website testing",
    body: "Open a page in a real browser at phone, tablet and desktop sizes, and watch how it behaves on each.",
    cta: "Start a website test",
    tint: "from-brand-blue via-brand-violet to-brand-deep",
    accent: "text-brand-violet dark:text-[#b6a2fa]",
    tag: "Browser",
    art: <WebsiteArt />,
  },
  {
    href: "/apk",
    title: "APK testing",
    body: "Upload an Android build and check its file type and size. Running APKs arrives in a later phase.",
    cta: "Check an APK",
    tint: "from-emerald-500 via-teal-600 to-cyan-700",
    accent: "text-emerald-600 dark:text-emerald-300",
    tag: "Android",
    art: <ApkArt />,
  },
  {
    href: "/optimize",
    title: "Optimization audits",
    body: "Run a Lighthouse audit for performance, accessibility, SEO and best practices. No account needed.",
    cta: "Run an audit",
    tint: "from-amber-500 via-orange-500 to-rose-600",
    accent: "text-orange-600 dark:text-orange-300",
    tag: "Lighthouse",
    art: <OptimizeArt />,
  },
];

/** Three services, one card each, overlapping the bottom of the hero. */
export function ServiceCards() {
  return (
    <section aria-labelledby="services-heading" className="relative z-10 mx-auto -mt-16 max-w-5xl px-5 md:-mt-20">
      <h2 id="services-heading" className="sr-only">
        Services
      </h2>
      <ul className="grid gap-5 md:grid-cols-3">
        {SERVICES.map((service) => (
          <li key={service.href}>
            <Link
              href={service.href}
              className="group flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-xl shadow-black/10 transition duration-300 hover:-translate-y-1.5 hover:shadow-2xl focus-visible:outline-2 focus-visible:outline-accent"
            >
              <div className={`relative h-52 overflow-hidden bg-gradient-to-br ${service.tint}`}>
                <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
                <div aria-hidden="true" className="pointer-events-none absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-black/20 blur-2xl" />
                <span className="absolute left-4 top-4 z-10 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white backdrop-blur">
                  {service.tag}
                </span>
                <div aria-hidden="true" className="relative h-full">
                  {service.art}
                </div>
              </div>
              <div className="flex flex-1 flex-col p-6">
                <h3 className="text-lg font-bold">{service.title}</h3>
                <p className="mt-2 flex-1 text-sm text-muted">{service.body}</p>
                <span className={`mt-5 inline-flex items-center gap-1.5 text-sm font-semibold ${service.accent}`}>
                  {service.cta}
                  <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
