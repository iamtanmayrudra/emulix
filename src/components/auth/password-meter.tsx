import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password-policy";

/** Client-side hint only. The server applies the real policy in passwordPolicyError. */
export function scorePassword(value: string): number {
  let score = 0;
  if (value.length >= PASSWORD_MIN_LENGTH) score += 1;
  if (value.length >= 16) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9\s]/.test(value)) score += 1;
  return score;
}

const LEVELS = [
  { label: "Weak", color: "bg-danger", text: "text-danger" },
  { label: "Weak", color: "bg-danger", text: "text-danger" },
  { label: "Fair", color: "bg-warning", text: "text-warning" },
  { label: "Fair", color: "bg-warning", text: "text-warning" },
  { label: "Good", color: "bg-accent", text: "text-accent" },
  { label: "Strong", color: "bg-success", text: "text-success" },
];

/** Tips shown as a checklist. They guide the user; only the length rule is enforced when typing. */
const TIPS: { label: string; met: (value: string) => boolean }[] = [
  { label: `${PASSWORD_MIN_LENGTH}+ characters`, met: (value) => value.length >= PASSWORD_MIN_LENGTH },
  { label: "Upper and lower case", met: (value) => /[a-z]/.test(value) && /[A-Z]/.test(value) },
  { label: "A number", met: (value) => /\d/.test(value) },
  { label: "A symbol", met: (value) => /[^A-Za-z0-9\s]/.test(value) },
];

type Props = { value: string };

export function PasswordMeter({ value }: Props) {
  if (!value) return null;
  const score = scorePassword(value);
  const level = LEVELS[score];

  return (
    <div className="mt-3 space-y-2.5 rounded-xl border border-border bg-background p-3" aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((segment) => (
            <span
              key={segment}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${segment <= score ? level.color : "bg-border"}`}
            />
          ))}
        </div>
        <span className={`w-14 text-right text-xs font-semibold ${level.text}`}>{level.label}</span>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {TIPS.map((tip) => {
          const met = tip.met(value);
          return (
            <li key={tip.label} className={`flex items-center gap-1.5 text-xs ${met ? "text-success" : "text-muted"}`}>
              <span
                aria-hidden="true"
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  met ? "border-success bg-success text-white" : "border-border"
                }`}
              >
                {met && (
                  <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                )}
              </span>
              <span className="sr-only">{met ? "Met: " : "Not met: "}</span>
              {tip.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
