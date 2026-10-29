import type { ReactNode } from "react";

/** Shown on every screen that renders mock data, so prototype content is never mistaken for live results. */
export function MockNotice({ children }: { children?: ReactNode }) {
  return (
    <div
      role="note"
      className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted"
    >
      <strong className="font-semibold text-foreground">Mock data.</strong>{" "}
      {children ?? "This screen is not connected to a backend, browser worker, or emulator."}
    </div>
  );
}

/** Labels any preview or result that is not a real browser or device run. */
export function SimulationLabel({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted">
      {children}
    </span>
  );
}
