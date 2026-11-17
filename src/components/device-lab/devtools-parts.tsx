"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { AiErrorBody, ExplainTarget, IssueExplanation } from "@/lib/ai/types";

/** Small pieces shared by the DevTools tabs: Chrome-style icons, toolbar controls and the AI explanation card. */

export type ExplainState = { status: "loading" } | { status: "done"; explanation: IssueExplanation } | { status: "error"; error: AiErrorBody };

/** What the tabs need to offer "Understand this error". The shell owns the state so it survives a tab switch. */
export type ExplainControls = {
  states: Record<number, ExplainState>;
  explain: (seq: number, target: ExplainTarget) => void;
  hide: (seq: number) => void;
};

export const toolbarClass = "flex h-7 shrink-0 items-center gap-1 border-b border-[var(--dt-border)] bg-[var(--dt-toolbar)] px-1.5";

type IconProps = { className?: string };

const svgProps = {
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

/** The "clear console" glyph: a circle with a slash. */
export function ClearIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...svgProps} className={className}>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M4.1 4.1l7.8 7.8" />
    </svg>
  );
}

export function FilterIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...svgProps} className={className}>
      <path d="M2.5 3.5h11l-4.2 5v4l-2.6-1.4V8.5z" />
    </svg>
  );
}

export function CloseIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...svgProps} className={className}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function ErrorIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-label="Error" role="img">
      <circle cx="8" cy="8" r="6.5" fill="var(--dt-error-text)" />
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="var(--dt-error-bg)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function WarningIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-label="Warning" role="img">
      <path d="M8 1.8l6.6 11.4H1.4z" fill="var(--dt-warning-icon)" stroke="var(--dt-warning-icon)" strokeWidth="1" strokeLinejoin="round" />
      <path d="M8 6.2v3.4M8 11v.1" stroke="var(--dt-warning-bg)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function InfoIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-label="Info" role="img">
      <circle cx="8" cy="8" r="6.5" fill="var(--dt-info)" />
      <path d="M8 7.2v4M8 4.8v.1" stroke="var(--dt-bg)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function SparkleIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M6.5 1.5l1.3 3.7 3.7 1.3-3.7 1.3-1.3 3.7-1.3-3.7L1.5 6.5l3.7-1.3zM12.2 9.4l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z" />
    </svg>
  );
}

/** The small triangle Chrome uses to open and close a message or a section. */
export function Disclosure({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 8 8" className={`h-2 w-2 shrink-0 text-[var(--dt-text-2)] transition-transform ${open ? "rotate-90" : ""}`} fill="currentColor" aria-hidden="true">
      <path d="M2 1l4 3-4 3z" />
    </svg>
  );
}

type ToolbarButtonProps = { label: string; onClick: () => void; disabled?: boolean; children: ReactNode };

/** An icon button in a DevTools toolbar. */
export function ToolbarButton({ label, onClick, disabled, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] text-[var(--dt-text-2)] hover:bg-[var(--dt-hover)] hover:text-[var(--dt-text)] focus-visible:outline-2 focus-visible:outline-[var(--dt-accent)] disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

export function ToolbarDivider() {
  return <span aria-hidden="true" className="mx-0.5 h-4 w-px shrink-0 bg-[var(--dt-border)]" />;
}

type FilterInputProps = { value: string; onChange: (value: string) => void; label: string };

/** The "Filter" box in a DevTools toolbar. */
export function FilterInput({ value, onChange, label }: FilterInputProps) {
  return (
    <label className="flex h-5 w-44 min-w-0 items-center gap-1 rounded-[3px] border border-transparent bg-[var(--dt-bg)] px-1 text-[var(--dt-text-2)] focus-within:border-[var(--dt-accent)]">
      <FilterIcon className="h-3 w-3 shrink-0" />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Filter"
        aria-label={label}
        spellCheck={false}
        className="min-w-0 flex-1 bg-transparent text-xs text-[var(--dt-text)] outline-none placeholder:text-[var(--dt-text-2)]"
      />
    </label>
  );
}

/** The "Understand this error" button, as in Chrome: a sparkle and a short label. */
export function ExplainButton({
  label,
  state,
  onClick,
  revealOnHover = false,
}: {
  label: string;
  state: ExplainState | undefined;
  onClick: () => void;
  /** Console rows show it on hover or focus, as Chrome does. */
  revealOnHover?: boolean;
}) {
  const loading = state?.status === "loading";
  const reveal = revealOnHover && !loading ? "opacity-0 group-hover:opacity-100 focus-visible:opacity-100" : "";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`flex h-[18px] shrink-0 items-center gap-1 rounded-full border border-[var(--dt-border)] bg-[var(--dt-bg)] px-2 font-sans text-[11px] text-[var(--dt-accent)] hover:bg-[var(--dt-hover)] focus-visible:outline-2 focus-visible:outline-[var(--dt-accent)] disabled:opacity-70 ${reveal}`}
    >
      <SparkleIcon className="h-3 w-3" />
      {loading ? "Thinking…" : label}
    </button>
  );
}

/** The model's reading of one entry. It is labelled as AI-generated because it can be wrong. */
export function Insight({ state, onHide }: { state: ExplainState | undefined; onHide: () => void }) {
  if (!state || state.status === "loading") return null;
  return (
    <div className="my-1 rounded-[3px] border border-[var(--dt-border)] bg-[var(--dt-bg)] p-2 font-sans text-xs text-[var(--dt-text)]">
      {state.status === "error" ? (
        <p role="alert" className="font-medium text-[var(--dt-error-text)]">
          {state.error.message}{" "}
          {state.error.upgradeUrl && (
            <Link href={state.error.upgradeUrl} className="underline">
              Upgrade to Pro
            </Link>
          )}
        </p>
      ) : (
        <dl className="space-y-1">
          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--dt-text-2)]">
            <SparkleIcon className="h-3 w-3" /> AI-generated. Check it against the evidence.
          </p>
          <div>
            <dt className="inline font-semibold">What it means: </dt>
            <dd className="inline">{state.explanation.summary}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">Likely cause: </dt>
            <dd className="inline">{state.explanation.likelyCause}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">What to try: </dt>
            <dd className="inline">{state.explanation.fix}</dd>
          </div>
        </dl>
      )}
      <button type="button" onClick={onHide} className="mt-1.5 text-[var(--dt-text-2)] underline hover:text-[var(--dt-text)]">
        Hide
      </button>
    </div>
  );
}
