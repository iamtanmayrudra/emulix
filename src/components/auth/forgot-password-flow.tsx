"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthMirrorUpdate } from "@/components/auth/auth-mirror";
import { AuthForm } from "@/components/auth/auth-form";
import { ResetSteps } from "@/components/auth/reset-steps";

const ENDPOINT = "/api/auth/forgot-password";
const RESEND_AFTER_SECONDS = 60;

/** Webmail for the common providers, so the next step is one click away. Only the provider's own address is opened. */
const PROVIDERS = [
  { match: /^(gmail|googlemail)\.com$/, name: "Gmail", href: "https://mail.google.com/" },
  { match: /^(outlook|hotmail|live|msn)\.[a-z.]+$/, name: "Outlook", href: "https://outlook.live.com/mail/" },
  { match: /^(yahoo\.[a-z.]+|ymail\.com)$/, name: "Yahoo Mail", href: "https://mail.yahoo.com/" },
  { match: /^(icloud|me|mac)\.com$/, name: "iCloud Mail", href: "https://www.icloud.com/mail" },
  { match: /^(proton\.me|protonmail\.com|pm\.me)$/, name: "Proton Mail", href: "https://mail.proton.me/" },
];

function providerFor(email: string) {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return PROVIDERS.find((provider) => provider.match.test(domain)) ?? null;
}

/** a•••@gmail.com: enough to recognise the address, without showing all of it on screen. */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local.slice(0, 1)}•••@${domain}`;
}

type Resend = { state: "idle" | "sending" | "sent" | "error"; message?: string };

/** Step 2: the email is on its way. Open the inbox, resend after a short wait, or fix a typo. */
function CheckInbox({ email, onChangeEmail }: { email: string; onChangeEmail: () => void }) {
  const provider = providerFor(email);
  const [cooldown, setCooldown] = useState(RESEND_AFTER_SECONDS);
  const [resend, setResend] = useState<Resend>({ state: "idle" });

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function resendEmail() {
    setResend({ state: "sending" });
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        setResend({ state: "error", message: result.message ?? "Could not send it again. Try in a few minutes." });
        return;
      }
      setResend({ state: "sent" });
      setCooldown(RESEND_AFTER_SECONDS);
    } catch {
      setResend({ state: "error", message: "Network error. Check your connection and try again." });
    }
  }

  return (
    <div className="space-y-5">
      <ResetSteps current={2} />

      <div className="flex flex-col items-center gap-3 text-center">
        <span aria-hidden="true" className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-blue via-brand-violet to-brand-fuchsia text-white shadow-lg shadow-brand-violet/30">
          <span className="dash-glow absolute inset-0 rounded-2xl bg-white/20" />
          <svg viewBox="0 0 24 24" className="relative h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2.5" />
            <path d="M3.5 7l8.5 6 8.5-6" />
          </svg>
        </span>
        <div>
          <h2 className="text-xl font-bold tracking-tight">Check your inbox</h2>
          <p className="mt-1 text-sm text-muted">
            If <strong className="font-semibold text-foreground">{maskEmail(email)}</strong> has an account, a reset link is on its way.
          </p>
        </div>
      </div>

      {provider ? (
        <a
          href={provider.href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-blue via-brand-violet to-brand-fuchsia px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-violet/25 transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Open {provider.name}
          <span className="sr-only">(opens in a new tab)</span>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 17L17 7M8 7h9v9" />
          </svg>
        </a>
      ) : (
        <p className="rounded-xl border border-border bg-background px-4 py-3 text-center text-sm text-muted">Open your email app and look for a message from Emulix.</p>
      )}

      <ul className="space-y-1.5 rounded-xl border border-border bg-background px-4 py-3 text-xs text-muted">
        <li className="flex gap-2">
          <span aria-hidden="true" className="text-success">✓</span>
          The link works for 30 minutes.
        </li>
        <li className="flex gap-2">
          <span aria-hidden="true" className="text-success">✓</span>
          Not there? Look in spam or promotions.
        </li>
        <li className="flex gap-2">
          <span aria-hidden="true" className="text-success">✓</span>
          Resetting also unlocks your account and signs you out on other devices.
        </li>
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-sm">
        <button type="button" onClick={onChangeEmail} className="font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent">
          Use a different email
        </button>
        <button
          type="button"
          onClick={resendEmail}
          disabled={cooldown > 0 || resend.state === "sending"}
          className="font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
        >
          {resend.state === "sending" ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend the email"}
        </button>
      </div>

      <p role="status" aria-live="polite" className={`min-h-5 text-center text-xs font-medium ${resend.state === "error" ? "text-danger" : "text-success"}`}>
        {resend.state === "sent" ? "Sent again. Check your inbox." : resend.state === "error" ? resend.message : ""}
      </p>

      <p className="text-center text-sm">
        <Link href="/login" className="font-medium text-accent">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

/** Forgot password as a short guided path: enter the email, check the inbox, then choose a new password. */
export function ForgotPasswordFlow() {
  const [email, setEmail] = useState<string | null>(null);
  const mirror = useAuthMirrorUpdate();

  if (email) {
    return (
      <CheckInbox
        email={email}
        onChangeEmail={() => {
          setEmail(null);
          mirror({ status: "idle" });
        }}
      />
    );
  }

  return (
    <div>
      <ResetSteps current={1} />
      <AuthForm
        endpoint={ENDPOINT}
        submitLabel="Email me a reset link"
        fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email" }]}
        onSuccess={(submitted) => setEmail(submitted.email.trim())}
        notice={<p>We will email you a link that works for 30 minutes. No security questions, no waiting for support.</p>}
        footer={
          <Link href="/login" className="font-medium text-accent">
            Back to sign in
          </Link>
        }
      />
    </div>
  );
}
