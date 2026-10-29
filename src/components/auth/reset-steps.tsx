const STEPS = ["Your email", "Check inbox", "New password"];

/** Shows where someone is in the reset: finished steps get a tick, the current one is highlighted. */
export function ResetSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol aria-label="Password reset steps" className="mb-6 flex items-start">
      {STEPS.map((label, index) => {
        const step = index + 1;
        const done = step < current;
        const active = step === current;
        return (
          <li key={label} aria-current={active ? "step" : undefined} className="relative flex flex-1 flex-col items-center gap-1.5 text-center">
            {index > 0 && (
              <span
                aria-hidden="true"
                className={`absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2 rounded-full ${step <= current ? "bg-gradient-to-r from-brand-blue to-brand-violet" : "bg-border"}`}
              />
            )}
            <span
              className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition ${
                done
                  ? "bg-success text-white"
                  : active
                    ? "bg-gradient-to-br from-brand-blue to-brand-violet text-white shadow-md shadow-brand-violet/30 ring-4 ring-accent/15"
                    : "border border-border bg-surface text-muted"
              }`}
            >
              {done ? (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              ) : (
                step
              )}
            </span>
            <span className={`text-xs font-medium ${active ? "text-foreground" : "text-muted"}`}>
              {label}
              <span className="sr-only">{done ? " (done)" : active ? " (current step)" : ""}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
