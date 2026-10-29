"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Avatar } from "./avatar";
import { PlanBadge } from "./plan-badge";
import type { Plan, SubscriptionStatus } from "@/lib/mock-data";

type Props = {
  userName: string;
  plan: Plan;
  subscription: SubscriptionStatus;
  signingOut: boolean;
  onSignOut: () => void;
};

const ICON_BUTTON =
  "flex h-9 w-9 items-center justify-center rounded-[3px] text-white/85 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";

const TEXT_LINK =
  "flex h-9 items-center gap-2 rounded-[3px] px-2.5 text-sm text-white/85 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-accent";

/**
 * Right side of the top bar: team, pricing, help, notifications, search, and the profile menu.
 * Features that are not built yet are shown disabled, so nothing pretends to work.
 */
export function HeaderActions({ userName, plan, subscription, signingOut, onSignOut }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // Close open menus on Escape or a click outside them.
  useEffect(() => {
    if (!menuOpen && !bellOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
        setBellOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setBellOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen, bellOpen]);

  return (
    <div ref={containerRef} className="flex shrink-0 items-center gap-1">
      <button type="button" disabled title="Team invites are not built yet" className={TEXT_LINK}>
        <IconUserPlus />
        <span className="hidden xl:inline">Invite team</span>
      </button>

      <Link href="/pricing" className={TEXT_LINK}>
        <IconTag />
        <span className="hidden xl:inline">Plans and pricing</span>
      </Link>

      <button type="button" disabled title="Help center is not built yet" aria-label="Help" className={ICON_BUTTON}>
        <IconHelp />
      </button>

      <div className="relative">
        <button
          type="button"
          aria-label="Notifications"
          aria-expanded={bellOpen}
          aria-controls="notifications-panel"
          onClick={() => {
            setBellOpen((open) => !open);
            setMenuOpen(false);
          }}
          className={ICON_BUTTON}
        >
          <IconBell />
        </button>
        {bellOpen && (
          <div
            id="notifications-panel"
            role="region"
            aria-label="Notifications"
            className="absolute right-0 top-11 z-30 w-64 rounded-lg border border-border bg-surface p-4 text-sm text-foreground shadow-lg"
          >
            <p className="font-semibold">Notifications</p>
            <p className="mt-1 text-muted">No notifications yet.</p>
          </div>
        )}
      </div>

      <button type="button" disabled title="Search is not built yet" aria-label="Search" className={ICON_BUTTON}>
        <IconSearch />
      </button>

      <div className="relative ml-1">
        <button
          type="button"
          aria-label="Profile settings"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => {
            setMenuOpen((open) => !open);
            setBellOpen(false);
          }}
          className="rounded-full focus-visible:outline-2 focus-visible:outline-accent"
        >
          <Avatar name={userName} status={subscription} size={32} />
        </button>

        {menuOpen && (
          <div
            id={menuId}
            role="menu"
            aria-label="Profile"
            className="absolute right-0 top-11 z-30 w-60 overflow-hidden rounded-lg border border-border bg-surface text-sm text-foreground shadow-lg"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{userName}</p>
                <p className="text-xs text-muted">Signed in</p>
              </div>
              <PlanBadge plan={plan} />
            </div>
            <MenuLink href="/profile" label="Profile settings" icon={<IconUser />} onSelect={() => setMenuOpen(false)} />
            <MenuLink href="/pricing" label="Plans and pricing" icon={<IconTag />} onSelect={() => setMenuOpen(false)} />
            <div className="border-t border-border">
              <button
                type="button"
                role="menuitem"
                disabled={signingOut}
                onClick={onSignOut}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-danger hover:bg-danger/10 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
              >
                <IconSignOut />
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MenuLink({
  href,
  label,
  icon,
  onSelect,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onSelect}
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-background focus-visible:outline-2 focus-visible:outline-accent"
    >
      {icon}
      {label}
    </Link>
  );
}

/* Icons: 18px, stroke style, decorative (labels carry the meaning). */
function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

function IconUserPlus() {
  return (
    <Svg>
      <circle cx="9.5" cy="8" r="3.5" />
      <path d="M3 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6" />
    </Svg>
  );
}

function IconTag() {
  return (
    <Svg>
      <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" />
      <circle cx="7.5" cy="7.5" r="1.25" />
    </Svg>
  );
}

function IconHelp() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01" />
    </Svg>
  );
}

function IconBell() {
  return (
    <Svg>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </Svg>
  );
}

function IconSearch() {
  return (
    <Svg>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </Svg>
  );
}

function IconUser() {
  return (
    <Svg>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </Svg>
  );
}

function IconSignOut() {
  return (
    <Svg>
      <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" />
      <path d="M16 8l4 4-4 4M20 12H9" />
    </Svg>
  );
}
