"use client";

import { createContext, useContext, useState, type CSSProperties, type ReactNode } from "react";

/** What a device's browser chrome can do. Without a live session every action is a no-op and the controls are disabled. */
export type BrowserControls = {
  live: boolean;
  navigate: (url: string) => void;
  back: () => void;
  forward: () => void;
  reload: () => void;
};

const NO_CONTROLS: BrowserControls = {
  live: false,
  navigate: () => undefined,
  back: () => undefined,
  forward: () => undefined,
  reload: () => undefined,
};

export const BrowserControlsContext = createContext<BrowserControls>(NO_CONTROLS);

export function useBrowserControls(): BrowserControls {
  return useContext(BrowserControlsContext);
}

/** Adds https:// when the user types a bare address such as example.com. */
export function normalizeAddress(value: string): string {
  const trimmed = value.trim();
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

type AddressBarProps = {
  /** The address of the page that is open. */
  url: string;
  className?: string;
  inputClassName?: string;
  leading?: ReactNode;
  /** Sets the text size, which the input inherits. Devices scale their text to the screen. */
  style?: CSSProperties;
};

/**
 * Address field for a device's browser. While a live session runs it can be edited, and Enter opens the address.
 * Otherwise it only shows the address.
 */
export function AddressBar({ url, className = "", inputClassName = "", leading, style }: AddressBarProps) {
  const controls = useBrowserControls();
  // null means "follow the page's address"; a string is what the user has typed.
  const [draft, setDraft] = useState<string | null>(null);

  // Not a <form>: devices sit inside the page's own form, and a nested form would also submit that outer one.
  function open(input: HTMLInputElement) {
    if (controls.live && draft && draft.trim()) controls.navigate(normalizeAddress(draft));
    setDraft(null);
    input.blur();
  }

  return (
    <div className={className} style={style}>
      {leading}
      <input
        name="address"
        aria-label="Address"
        value={draft ?? url}
        readOnly={!controls.live}
        spellCheck={false}
        autoComplete="off"
        onChange={(event) => setDraft(event.target.value)}
        onFocus={(event) => event.currentTarget.select()}
        onBlur={() => setDraft(null)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            open(event.currentTarget);
          } else if (event.key === "Escape") {
            setDraft(null);
            event.currentTarget.blur();
          }
        }}
        className={`min-w-0 flex-1 bg-transparent outline-none [font-size:inherit] ${inputClassName}`}
      />
    </div>
  );
}

type NavButtonProps = {
  action: "back" | "forward" | "reload";
  className?: string;
  size?: number;
};

const NAV_PATHS = {
  back: "M15 5l-7 7 7 7",
  forward: "M9 5l7 7-7 7",
  reload: "M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5",
} as const;

const NAV_LABELS = { back: "Back", forward: "Forward", reload: "Reload" } as const;

/** Back, forward or reload. Disabled until a live session is running. */
export function NavButton({ action, className = "", size = 14 }: NavButtonProps) {
  const controls = useBrowserControls();
  return (
    <button
      type="button"
      aria-label={NAV_LABELS[action]}
      disabled={!controls.live}
      onClick={controls[action]}
      className={`flex shrink-0 items-center justify-center rounded-full transition enabled:hover:bg-black/10 enabled:active:scale-90 disabled:opacity-40 ${className}`}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={NAV_PATHS[action]} />
      </svg>
    </button>
  );
}
