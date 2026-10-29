"use client";

import { useEffect, useState, type ReactNode } from "react";

type ThemeMode = "system" | "light" | "dark";

const NEXT_MODE: Record<ThemeMode, ThemeMode> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<ThemeMode, string> = { system: "System", light: "Light", dark: "Dark" };
const STORAGE_KEY = "emulix-theme";

const ICON: Record<ThemeMode, ReactNode> = {
  system: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  ),
  light: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  ),
  dark: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
};

function applyTheme(mode: ThemeMode) {
  if (mode === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = mode;
  }
}

/** Floating button that cycles the colour theme. The choice is remembered in this browser only. */
export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("system");

  useEffect(() => {
    let saved: ThemeMode = "system";
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      if (value === "light" || value === "dark" || value === "system") saved = value;
    } catch {
      // Storage can be blocked. Fall back to following the system theme.
    }
    setMode(saved);
    applyTheme(saved);
  }, []);

  function handleClick() {
    const next = NEXT_MODE[mode];
    setMode(next);
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore. The theme still changes for this page view.
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`Theme: ${LABEL[mode]}. Switch to ${LABEL[NEXT_MODE[mode]]}`}
      aria-label={`Theme: ${LABEL[mode]}. Switch to ${LABEL[NEXT_MODE[mode]]}`}
      className="fixed bottom-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-foreground shadow-md hover:opacity-90 focus-visible:outline-2 focus-visible:outline-accent"
    >
      {ICON[mode]}
    </button>
  );
}
