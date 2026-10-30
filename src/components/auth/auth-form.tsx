"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { useAuthMirrorUpdate } from "@/components/auth/auth-mirror";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { PasswordMeter } from "@/components/auth/password-meter";

export type AuthField = {
  name: string;
  label: string;
  type: "text" | "email" | "password";
  autoComplete?: string;
  minLength?: number;
  help?: string;
  /** Shows a strength hint under the field. Use for new passwords only. */
  meter?: boolean;
};

type Props = {
  endpoint: string;
  fields: AuthField[];
  submitLabel: string;
  /** Sent with every request, for example a reset token from the URL. */
  hidden?: Record<string, string>;
  /** When set, a successful submit navigates here. Otherwise the server message is shown. */
  successHref?: string;
  /** Called with the submitted values after the server accepts them. The form then stays quiet, so the caller can show the next step. */
  onSuccess?: (submitted: Record<string, string>) => void;
  /** Shown above the button, for example a note about what happens next. */
  notice?: ReactNode;
  footer?: ReactNode;
};

type ApiResponse = { message?: string; redirectTo?: string };

/** A loose shape check, used only to show a tick. The server decides what is a valid address. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const ICON_PROPS = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: "false",
} as const;

/** Eye when the password is hidden (click to show), eye with a slash when it is visible (click to hide). */
function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg {...ICON_PROPS}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M3 3l18 18" />}
    </svg>
  );
}

/** Leading icon for a field: an envelope for email, a padlock for passwords, a person for anything else. */
function FieldIcon({ type }: { type: AuthField["type"] }) {
  return (
    <svg
      {...ICON_PROPS}
      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted transition-colors peer-focus-visible:text-accent"
    >
      {type === "email" ? (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="M3.5 7l8.5 6 8.5-6" />
        </>
      ) : type === "password" ? (
        <>
          <rect x="5" y="11" width="14" height="9" rx="2.5" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </>
      ) : (
        <>
          <circle cx="12" cy="8.5" r="3.5" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </>
      )}
    </svg>
  );
}

/** Label that sits inside the field and floats up once the field is focused or filled. */
const FLOATING_LABEL =
  "pointer-events-none absolute left-11 top-1/2 -translate-y-1/2 text-sm text-muted transition-all duration-200 " +
  "peer-focus:top-3 peer-focus:translate-y-0 peer-focus:text-[11px] peer-focus:font-semibold peer-focus:text-accent " +
  "peer-[:not(:placeholder-shown)]:top-3 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-[11px] " +
  "peer-autofill:top-3 peer-autofill:translate-y-0 peer-autofill:text-[11px]";

export function AuthForm({ endpoint, fields, submitLabel, hidden, successHref, onSuccess, notice, footer }: Props) {
  const router = useRouter();
  const formId = useId();
  const mirror = useAuthMirrorUpdate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [capsLock, setCapsLock] = useState<Record<string, boolean>>({});
  /** True after the server rejects a submit, until the user edits a field. Marks the fields red. */
  const [rejected, setRejected] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setError(null);
    setMessage(null);
    mirror({ status: "pending" });

    const data = new FormData(form);
    const body: Record<string, string> = { ...hidden };
    for (const field of fields) {
      body[field.name] = String(data.get(field.name) ?? "");
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json().catch(() => ({}))) as ApiResponse;

      if (!response.ok) {
        setError(result.message ?? "Something went wrong. Try again.");
        setRejected(true);
        mirror({ status: "error" });
        return;
      }
      mirror({ status: "success" });
      if (onSuccess) {
        onSuccess(body);
        return;
      }
      if (successHref) {
        // Let the devices finish unlocking before the page changes.
        await new Promise((resolve) => setTimeout(resolve, 700));
        // The server can choose a different place, for example for a super admin. Only a path on this site is followed.
        const target = typeof result.redirectTo === "string" && result.redirectTo.startsWith("/") && !result.redirectTo.startsWith("//") ? result.redirectTo : successHref;
        router.push(target);
        router.refresh();
        return;
      }
      setMessage(result.message ?? "Done.");
      form.reset();
      setValues({});
      mirror({ name: "", email: "", secretLength: 0 });
    } catch {
      setError("Network error. Check your connection and try again.");
      mirror({ status: "error" });
    } finally {
      setPending(false);
    }
  }

  function trackCapsLock(name: string, event: KeyboardEvent<HTMLInputElement>) {
    setCapsLock((current) => ({ ...current, [name]: event.getModifierState("CapsLock") }));
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {fields.map((field, index) => {
        const id = `${formId}-${field.name}`;
        const helpId = `${id}-help`;
        const capsId = `${id}-caps`;
        const isPassword = field.type === "password";
        const shown = revealed[field.name] ?? false;
        const value = values[field.name] ?? "";
        const looksValid = field.type === "email" && EMAIL_SHAPE.test(value);
        const describedBy = [field.help ? helpId : null, capsLock[field.name] ? capsId : null].filter(Boolean).join(" ");

        return (
          <div key={field.name}>
            <div className="relative">
              <input
                id={id}
                name={field.name}
                type={isPassword && shown ? "text" : field.type}
                autoComplete={field.autoComplete}
                minLength={field.minLength}
                required
                autoFocus={index === 0}
                placeholder=" "
                onChange={(event) => {
                  const next = event.target.value;
                  setValues((current) => ({ ...current, [field.name]: next }));
                  setRejected(false);
                  // The stage only learns the password's length, never its value.
                  mirror({
                    status: "idle",
                    ...(isPassword ? { secretLength: next.length } : field.type === "email" ? { email: next } : { name: next }),
                  });
                }}
                onKeyDown={isPassword ? (event) => trackCapsLock(field.name, event) : undefined}
                onKeyUp={isPassword ? (event) => trackCapsLock(field.name, event) : undefined}
                onBlur={isPassword ? () => setCapsLock((current) => ({ ...current, [field.name]: false })) : undefined}
                aria-invalid={rejected || undefined}
                aria-describedby={describedBy || undefined}
                className={`peer h-14 w-full rounded-xl border bg-background pb-1 pl-11 pt-5 text-sm transition focus-visible:outline-none focus-visible:ring-4 ${
                  isPassword || looksValid ? "pr-12" : "pr-3"
                } ${
                  rejected
                    ? "border-danger focus-visible:border-danger focus-visible:ring-danger/15"
                    : "border-border hover:border-muted/60 focus-visible:border-accent focus-visible:ring-accent/15"
                }`}
              />
              <FieldIcon type={field.type} />
              <label htmlFor={id} className={FLOATING_LABEL}>
                {field.label}
              </label>

              {isPassword && (
                <button
                  type="button"
                  aria-pressed={shown}
                  aria-label={shown ? `Hide ${field.label.toLowerCase()}` : `Show ${field.label.toLowerCase()}`}
                  onClick={() => setRevealed((current) => ({ ...current, [field.name]: !shown }))}
                  className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition hover:bg-surface hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <EyeIcon off={shown} />
                </button>
              )}
              {looksValid && !rejected && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-success text-white"
                >
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </span>
              )}
            </div>

            {capsLock[field.name] && (
              <p id={capsId} role="status" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-warning">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 4l8 9h-5v4H9v-4H4zM9 20h6" />
                </svg>
                Caps Lock is on
              </p>
            )}
            {field.meter && <PasswordMeter value={value} />}
            {field.help && (
              <p id={helpId} className="mt-1.5 text-xs text-muted">
                {field.help}
              </p>
            )}
          </div>
        );
      })}

      {error && (
        <p role="alert" className="flex items-start gap-2.5 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
          <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.5v5M12 16h.01" />
          </svg>
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="flex items-start gap-2.5 rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
          <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12.5l3 3 5-6" />
          </svg>
          {message}
        </p>
      )}

      {notice && <div className="text-xs text-muted">{notice}</div>}

      <AuthSubmitButton pending={pending} label={submitLabel} successLabel={successHref ? "Welcome in" : "Done"} />

      {footer && <div className="border-t border-border pt-5 text-sm">{footer}</div>}
    </form>
  );
}
