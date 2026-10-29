"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Logo } from "./logo";
import { HeaderActions } from "./header-actions";
import { SiteFooter } from "./site-footer";
import { usePlan } from "@/components/plan-context";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/test", label: "Website testing" },
  { href: "/apk", label: "APK testing" },
  { href: "/optimize", label: "Optimization" },
  { href: "/reports", label: "Reports" },
  { href: "/profile", label: "Profile & billing" },
];

/**
 * Dark top bar with horizontal navigation, a light content area, and a user menu on the right.
 * The name comes from the signed-in session. The plan still comes from mock data until billing exists (Phase 4).
 */
export function AppShell({ children, userName }: { children: ReactNode; userName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const { plan, subscription } = usePlan();

  async function signOut() {
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/login");
    router.refresh();
  }

  // The website test page is a full-viewport workspace: the header stays, and the content fills what is left.
  const workspace = pathname === "/test";

  return (
    <div className={workspace ? "flex h-screen flex-col overflow-hidden" : "flex min-h-screen flex-col"}>
      <header className="sticky top-0 z-40 bg-chrome text-chrome-foreground">
        <div className="flex items-center gap-6 px-4 md:px-6">
          <Link href="/dashboard" aria-label="Emulix dashboard" className="flex h-14 shrink-0 items-center">
            <Logo size={26} />
          </Link>
          <nav aria-label="Main" className="flex min-w-0 flex-1 gap-1 overflow-x-auto self-stretch">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex shrink-0 items-center border-b-[3px] px-3 text-sm transition-colors hover:text-white ${
                    active
                      ? "border-accent font-semibold text-white"
                      : "border-transparent text-white/80"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <HeaderActions
            userName={userName}
            plan={plan}
            subscription={subscription}
            signingOut={signingOut}
            onSignOut={signOut}
          />
        </div>
      </header>
      {workspace ? (
        <main className="flex min-h-0 flex-1">
          <div className="flex min-h-0 w-full flex-1">{children}</div>
        </main>
      ) : (
        <>
          <main className="flex-1 px-4 py-6 md:px-6 md:py-8">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
          <SiteFooter />
        </>
      )}
    </div>
  );
}
