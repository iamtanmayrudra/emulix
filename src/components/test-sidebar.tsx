"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import {
  DesktopIcon,
  GaugeIcon,
  GlobeIcon,
  GridIcon,
  PhoneIcon,
  ReportIcon,
  UserIcon,
} from "@/components/device-lab/icons";

type Item = { label: string; href: string; icon: ComponentType<{ className?: string }> };

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: "Testing",
    items: [
      { label: "Website testing", href: "/test", icon: DesktopIcon },
      { label: "APK testing", href: "/apk", icon: PhoneIcon },
    ],
  },
  {
    title: "Management & Optimization",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: GridIcon },
      { label: "Optimization", href: "/optimize", icon: GaugeIcon },
      { label: "Reports", href: "/reports", icon: ReportIcon },
    ],
  },
];

const ACCOUNT: Item = { label: "Profile & billing", href: "/profile", icon: UserIcon };

/**
 * Icon-only rail on the left. It widens on hover or keyboard focus to show labels next to the icons.
 * It overlays the workspace instead of pushing it, so the layout does not move.
 */
export function TestSidebar() {
  const pathname = usePathname();

  return (
    <aside aria-label="Testing navigation" className="group absolute inset-y-0 left-0 z-20 w-14">
      <div className="absolute inset-y-0 left-0 flex w-14 flex-col overflow-hidden border-r border-border bg-surface shadow-sm transition-[width] duration-200 group-focus-within:w-60 group-hover:w-60">
        {/* Web and App sit in one row. Collapsed, only the website icon shows; hover or focus reveals the App option. */}
        <div role="group" aria-label="Test type" className="flex gap-1 p-2">
          <TypeLink href="/test" label="Web" icon={GlobeIcon} active={pathname === "/test"} />
          <div className="hidden min-w-0 flex-1 group-focus-within:flex group-hover:flex">
            <TypeLink href="/apk" label="App" icon={PhoneIcon} active={pathname === "/apk"} />
          </div>
        </div>

        <nav aria-label="Sections" className="flex-1 overflow-y-auto overflow-x-hidden pb-2">
          {SECTIONS.map((section) => (
            <div key={section.title} className="mt-3">
              <h2 className="whitespace-nowrap px-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                {section.title}
              </h2>
              <ul>
                {section.items.map((item) => (
                  <SidebarLink key={item.href + item.label} item={item} active={pathname === item.href} />
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-border p-2">
          <SidebarLink item={ACCOUNT} active={pathname === ACCOUNT.href} />
        </div>
      </div>
    </aside>
  );
}

function TypeLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      className={`flex h-9 min-w-0 flex-1 items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors group-hover:justify-start group-hover:px-3 group-focus-within:justify-start group-focus-within:px-3 focus-visible:outline-2 focus-visible:outline-accent ${
        active ? "bg-accent text-accent-foreground" : "text-muted hover:bg-background hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="hidden whitespace-nowrap group-focus-within:inline group-hover:inline">{label}</span>
    </Link>
  );
}

function SidebarLink({ item, active }: { item: Item; active: boolean }) {
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`mx-2 flex h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
          active
            ? "bg-accent/10 font-semibold text-accent"
            : "text-foreground hover:bg-background"
        }`}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="whitespace-nowrap opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {item.label}
        </span>
      </Link>
    </li>
  );
}
