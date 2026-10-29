import Link from "next/link";
import { DeviceCarousel } from "@/components/device-carousel";
import { FeatureBento } from "@/components/feature-bento";
import { DevicePhoto, SHOWCASE_IDS } from "@/components/device-photo";
import { Logo } from "@/components/logo";
import { ReportShowcase } from "@/components/report-showcase";
import { ServiceCards } from "@/components/service-cards";
import { DEVICE_PROFILES } from "@/lib/mock-data";

/** The sizes shown on the landing page. The full list lives in the app. */
const LANDING_PROFILE_IDS = [
  "iphone-14",
  "pixel-7",
  "desktop-1280",
  "iphone-se",
  "galaxy-s23",
  "ipad-air",
  "galaxy-tab-s9",
  "laptop-1366",
  "desktop-1440",
];

const STEPS = [
  {
    title: "Enter a page address",
    body: "Paste any public https address. Local and private addresses are refused.",
  },
  {
    title: "Choose a device",
    body: "Pick a phone, tablet, or desktop size. Pro unlocks the full device list.",
  },
  {
    title: "Read the results",
    body: "See the screenshot, load time, console errors, and failed requests for that run.",
  },
];

const PLAN_FEATURES = {
  free: ["3 device profiles", "Basic previews and reports", "A limited number of audits each period"],
  pro: ["Full device library", "Higher quotas and advanced reports", "APK testing when available"],
};

const FAQS = [
  {
    q: "Is the preview a real device?",
    a: "No. Website previews use an emulated viewport in a real browser. Physical devices arrive in later phases, and every run says which kind it is.",
  },
  {
    q: "Do I need a card to start?",
    a: "No. The Free plan needs only a verified email. Payment is taken only when you upgrade to Pro.",
  },
  {
    q: "Can I test Android apps?",
    a: "Uploads are checked for file type and size today. Running APKs needs Android infrastructure, planned for a later phase.",
  },
];

/** The dark brand gradient used by the hero and the closing banner. It stays dark in both themes. */
const BRAND_GRADIENT = "bg-gradient-to-br from-brand-ink via-brand-deep to-brand-plum";

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className="mt-0.5 shrink-0 text-success">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

/** Hero device: a swipeable stack of real device photos. */
export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-chrome text-chrome-foreground">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3">
          <Link href="/" aria-label="Emulix home">
            <Logo size={26} />
          </Link>
          <nav aria-label="Main" className="flex items-center gap-1 text-sm">
            <Link href="/pricing" className="whitespace-nowrap rounded-[3px] px-3 py-1.5 text-white/80 hover:bg-white/10 hover:text-white">
              Pricing
            </Link>
            <Link href="/login" className="whitespace-nowrap rounded-[3px] px-3 py-1.5 text-white/80 hover:bg-white/10 hover:text-white">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="ml-2 whitespace-nowrap rounded-[3px] bg-accent px-3.5 py-1.5 font-semibold text-accent-foreground hover:opacity-90"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className={`relative overflow-hidden text-white ${BRAND_GRADIENT}`}>
          <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-10 h-80 w-80 rounded-full bg-brand-blue/30 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-fuchsia-500/30 blur-3xl" />
          <div className="relative mx-auto grid max-w-5xl items-center gap-12 px-5 py-20 md:grid-cols-2 md:py-28">
            <div className="text-center md:text-left">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Cross-device checks in one place
              </p>
              <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight md:text-5xl">
                Check how your site and app look on{" "}
                <span className="bg-gradient-to-r from-sky-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
                  every device.
                </span>
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-base text-white/75 md:mx-0 md:text-lg">
                Load pages at phone, tablet, and desktop sizes, collect browser errors, and keep a report of each run.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3 md:justify-start">
                <Link
                  href="/signup"
                  className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:shadow-xl"
                >
                  Get started free
                </Link>
                <Link
                  href="/dashboard"
                  className="rounded-full border border-white/25 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
                >
                  Open the prototype
                </Link>
              </div>
              <p className="mt-4 text-xs text-white/60">No card needed. Free plan requires a verified email.</p>
            </div>
            <DeviceCarousel />
          </div>
        </section>

        <ServiceCards />

        <FeatureBento />

        {/* Device sizes */}
        <section aria-labelledby="sizes-heading" className="mx-auto max-w-5xl px-5 py-16">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Viewports</p>
            <h2 id="sizes-heading" className="mt-2 text-3xl font-bold tracking-tight">
              Sizes you can test
            </h2>
            <p className="mt-2 text-sm text-muted">Real device photos. Each size is the viewport the prototype uses for it.</p>
          </div>
          <ul className="mt-10 flex flex-wrap items-end justify-center gap-x-12 gap-y-10">
            {SHOWCASE_IDS.map((id) => {
              const profile = DEVICE_PROFILES.find((item) => item.id === id);
              if (!profile) return null;
              return (
                <li key={id} className="flex flex-col items-center text-center">
                  <DevicePhoto id={id} height={300} variant="sizes" />
                  <p className="mt-4 text-sm font-semibold">{profile.name}</p>
                  <p className="text-xs text-muted">
                    {profile.width} × {profile.height}
                    {profile.minPlan === "pro" && <span className="ml-1 font-semibold text-pro">Pro</span>}
                  </p>
                </li>
              );
            })}
          </ul>
          <ul aria-label="More sizes" className="mt-12 flex flex-wrap justify-center gap-2">
            {DEVICE_PROFILES.filter(
              (profile) => LANDING_PROFILE_IDS.includes(profile.id) && !SHOWCASE_IDS.some((id) => id === profile.id),
            ).map((profile) => (
              <li
                key={profile.id}
                className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted shadow-sm"
              >
                <span className="font-medium text-foreground">{profile.name}</span> · {profile.width} × {profile.height}
                {profile.minPlan === "pro" && <span className="ml-1.5 font-semibold text-pro">Pro</span>}
              </li>
            ))}
          </ul>
        </section>

        {/* How it works */}
        <section id="how-it-works" aria-labelledby="how-heading" className="scroll-mt-16 bg-surface">
          <div className="mx-auto max-w-5xl px-5 py-20">
            <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-accent">How it works</p>
            <h2 id="how-heading" className="mt-2 text-center text-3xl font-bold tracking-tight">
              Three steps to your first result
            </h2>
            <ol className="mt-12 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="rounded-2xl border border-border bg-background p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-brand-blue to-brand-fuchsia text-base font-bold text-white shadow-lg shadow-fuchsia-500/20">
                    {index + 1}
                  </span>
                  <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm text-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <ReportShowcase />

        {/* Plans */}
        <section id="plans" aria-labelledby="plans-heading" className="mx-auto max-w-3xl scroll-mt-16 px-5 py-16">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-accent">Plans</p>
          <h2 id="plans-heading" className="mt-2 text-center text-3xl font-bold tracking-tight">
            Pick how far you want to go
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <div className="flex flex-col rounded-2xl border border-border bg-surface p-7 shadow-sm">
              <h3 className="text-lg font-semibold">Free</h3>
              <p className="mt-1 text-sm text-muted">For trying the workflow.</p>
              <ul className="mt-5 flex-1 space-y-3 text-sm">
                {PLAN_FEATURES.free.map((item) => (
                  <li key={item} className="flex gap-2">
                    <CheckIcon />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="mt-7 rounded-full border border-border px-4 py-2.5 text-center text-sm font-semibold transition hover:border-accent hover:text-accent"
              >
                Start free
              </Link>
            </div>
            <div className="relative flex flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-500 p-[1.5px] shadow-xl shadow-fuchsia-500/20">
              <div className="flex flex-1 flex-col rounded-[calc(1rem-1px)] bg-surface p-7">
                <span className="absolute right-5 top-5 rounded-full bg-gradient-to-r from-violet-600 to-pink-500 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                  Most powerful
                </span>
                <h3 className="text-lg font-semibold text-pro">Pro</h3>
                <p className="mt-1 text-sm text-muted">For teams testing many devices.</p>
                <ul className="mt-5 flex-1 space-y-3 text-sm">
                  {PLAN_FEATURES.pro.map((item) => (
                    <li key={item} className="flex gap-2">
                      <CheckIcon />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/checkout"
                  className="mt-7 rounded-full bg-gradient-to-r from-violet-600 to-pink-500 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  Choose Pro
                </Link>
                <p className="mt-2 text-center text-xs text-muted">Pricing is not set yet.</p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" aria-labelledby="faq-heading" className="mx-auto max-w-2xl scroll-mt-16 px-5 pb-16">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-accent">FAQ</p>
          <h2 id="faq-heading" className="mt-2 text-center text-3xl font-bold tracking-tight">
            Questions
          </h2>
          <div className="mt-10 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
            {FAQS.map((item) => (
              <details key={item.q} className="group px-6 py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {item.q}
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-accent transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm text-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Closing call to action */}
        <section className="px-5 pb-20">
          <div className={`relative mx-auto flex max-w-4xl flex-col items-center gap-5 overflow-hidden rounded-3xl px-6 py-14 text-center text-white shadow-2xl ${BRAND_GRADIENT}`}>
            <div aria-hidden="true" className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-brand-blue/30 blur-3xl" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-fuchsia-500/30 blur-3xl" />
            <h2 className="relative text-3xl font-bold tracking-tight">Run your first check today.</h2>
            <p className="relative max-w-md text-sm text-white/75">Create a free account, then open the prototype and start a website run.</p>
            <Link
              href="/signup"
              className="relative rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              Create a free account
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-6 text-xs text-muted">
          <Logo size={20} />
          <nav aria-label="Footer" className="flex gap-4">
            <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
            <Link href="/login" className="hover:text-foreground">Sign in</Link>
            <Link href="/signup" className="hover:text-foreground">Sign up</Link>
          </nav>
          <p>Prototype with mock data. Not for production use.</p>
        </div>
      </footer>
    </div>
  );
}
