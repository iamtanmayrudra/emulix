"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { SignOutButton } from "@/components/sign-out-button";
import { SiteFooter } from "@/components/site-footer";

const NAV = [
  { href: "/admin/users", label: "Users" },
  { href: "/admin/activity", label: "Activity" },
];

/**
 * The super admin's workspace. It has only account control: the member list, seats and the activity log. There is no
 * link to tests, audits or reports, because the role cannot open them.
 */
export function AdminShell({ userName, orgName, children }: { userName: string; orgName: string; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 bg-chrome text-chrome-foreground">
        <div className="flex items-center gap-2 px-4 sm:gap-4 md:gap-6 md:px-6">
          <Link href="/admin/users" aria-label="Emulix admin" className="flex h-14 shrink-0 items-center gap-2.5">
            <Logo size={26} />
            <span className="hidden rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider sm:inline">Admin</span>
          </Link>
          <nav aria-label="Admin" className="relative flex min-w-0 flex-1 gap-1 self-stretch overflow-x-auto">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex shrink-0 items-center border-b-[3px] px-2.5 text-sm sm:px-3 transition-colors hover:text-white ${active ? "border-accent font-semibold text-white" : "border-transparent text-white/80"}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex shrink-0 items-center gap-1 py-2 text-sm sm:gap-3">
            <span className="hidden text-right leading-tight sm:block">
              <span className="block font-medium">{userName}</span>
              <span className="block text-xs text-white/70">{orgName}</span>
            </span>
            <SignOutButton />
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
