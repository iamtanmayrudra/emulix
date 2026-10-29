"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SiteFooter } from "./site-footer";
import type { ReactNode } from "react";
import { Logo } from "./logo";

/** Open without an account. */
const PUBLIC_ITEMS = [
  { href: "/optimize", label: "Optimization" },
  { href: "/pricing", label: "Plans and pricing" },
];

/** Need an account. They are listed so visitors see what is available, and they lead to sign-in. */
const LOCKED_ITEMS = [
  { href: "/test", label: "Website testing" },
  { href: "/apk", label: "APK testing" },
  { href: "/reports", label: "Reports" },
];

/**
 * Top bar for pages that work without an account. The navigation links to public pages only.
 * Sign-in and account creation sit on the right, so the app's own pages stay behind login.
 */
export function PublicShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 bg-chrome text-chrome-foreground">
        <div className="flex items-center gap-6 px-4 md:px-6">
          <Link href="/" aria-label="Emulix home" className="flex h-14 shrink-0 items-center">
            <Logo size={26} />
          </Link>
          <nav aria-label="Main" className="relative flex min-w-0 flex-1 gap-1 overflow-x-auto self-stretch">
            {PUBLIC_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex shrink-0 items-center border-b-[3px] px-3 text-sm transition-colors hover:text-white ${
                    active ? "border-accent font-semibold text-white" : "border-transparent text-white/80"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            {LOCKED_ITEMS.map((item) => (
              <Link
                key={item.href}
                href="/login"
                title="Sign in to use this"
                className="flex shrink-0 items-center gap-1.5 border-b-[3px] border-transparent px-3 text-sm text-white/55 transition-colors hover:text-white"
              >
                {item.label}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
                <span className="sr-only">(sign in required)</span>
              </Link>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-2 py-2">
            <Link
              href="/login"
              className="rounded-[3px] px-3 py-1.5 text-sm text-white/85 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-accent"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-accent"
            >
              Create account
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1 px-4 py-6 md:px-6 md:py-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
