import Link from "next/link";
import type { ReactNode } from "react";
import { AuthMirrorProvider } from "@/components/auth/auth-mirror";
import { AuthShowcase } from "@/components/auth/auth-showcase";
import { Logo } from "@/components/logo";

export type AuthIcon = "signin" | "signup" | "mail" | "key" | "alert";

type Props = {
  title: string;
  subtitle?: string;
  /** Icon in the badge above the title. */
  icon?: AuthIcon;
  children?: ReactNode;
};

const ICON_PATHS: Record<AuthIcon, ReactNode> = {
  signin: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  signup: (
    <>
      <circle cx="9.5" cy="8" r="3.5" />
      <path d="M3 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3.5 7l8.5 6 8.5-6" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l9-9M16 7l3 3M14 9l2 2" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5M12 16h.01" />
    </>
  ),
};

const TRUST = ["Salted password hashes", "HTTP-only session cookies"];

/** Split screen on wide displays: a brand panel on the left and the task on the right. On phones the panel becomes a slim top bar. */
export function AuthCard({ title, subtitle, icon = "signin", children }: Props) {
  return (
    <AuthMirrorProvider>
      <div className="grid min-h-screen bg-background text-foreground lg:grid-cols-[1.05fr_1fr]">
        <AuthShowcase />

        <div className="relative flex min-h-screen flex-col overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-70 [background-image:radial-gradient(rgba(100,116,139,0.22)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-28 -top-28 h-96 w-96 rounded-full bg-brand-blue/25 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 -left-20 h-96 w-96 rounded-full bg-fuchsia-400/25 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute right-10 top-1/2 h-56 w-56 rounded-full bg-violet-400/15 blur-3xl" />

          <header className="relative flex items-center justify-between bg-gradient-to-r from-brand-ink to-brand-plum px-5 py-3 text-white lg:bg-none lg:px-10 lg:py-6 lg:text-foreground">
            <Link href="/" aria-label="Emulix home" className="inline-flex lg:hidden">
              <Logo size={26} />
            </Link>
            <Link href="/" className="hidden items-center gap-1.5 text-sm text-muted hover:text-foreground lg:inline-flex">
              <span aria-hidden="true">←</span> Back to home
            </Link>
            <Link href="/pricing" className="text-sm text-white/80 hover:text-white lg:text-muted lg:hover:text-foreground">
              Pricing
            </Link>
          </header>

          <main className="relative flex flex-1 items-center justify-center px-5 py-10">
            <section className="w-full max-w-md">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-blue via-brand-violet to-brand-fuchsia text-white shadow-lg shadow-indigo-500/30 ring-8 ring-accent/10">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                    {ICON_PATHS[icon]}
                  </svg>
                </span>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
                  {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
                </div>
              </div>

              <div className="gradient-border mt-7 rounded-3xl bg-surface p-6 shadow-2xl shadow-brand-violet/10 md:p-8">
                {children}
              </div>

              <ul aria-label="Security by default" className="mt-6 flex flex-wrap justify-center gap-2 lg:hidden">
                {TRUST.map((item) => (
                  <li key={item} className="flex items-center gap-1.5 rounded-full border border-border bg-surface/80 px-3 py-1.5 text-xs text-muted backdrop-blur">
                    <span aria-hidden="true" className="text-success">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          </main>

          <footer className="relative px-5 py-5 text-center text-xs text-muted">
            Prototype with mock data. Not for production use.
          </footer>
        </div>
      </div>
    </AuthMirrorProvider>
  );
}
