"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Props = { token?: string };

type ApiResponse = { message?: string };

/** Confirms the token once on mount, then either continues to the app or explains the problem. */
export function VerifyEmailStatus({ token }: Props) {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(Boolean(token));

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        if (response.ok) {
          router.push("/dashboard");
          router.refresh();
          return;
        }
        const result = (await response.json().catch(() => ({}))) as ApiResponse;
        setError(result.message ?? "This link is invalid or has expired.");
      })
      .catch(() => setError("Network error. Check your connection and try again."))
      .finally(() => setVerifying(false));
  }, [token, router]);

  async function resend() {
    setError(null);
    setResent(null);
    const response = await fetch("/api/auth/resend-verification", { method: "POST" });
    const result = (await response.json().catch(() => ({}))) as ApiResponse;
    if (response.ok) setResent(result.message ?? "Check your email.");
    else setError(result.message ?? "Could not send a new link. Sign in and try again.");
  }

  if (verifying) {
    return <p className="text-sm text-muted">Confirming your email…</p>;
  }

  return (
    <div className="space-y-4 text-sm">
      {token ? (
        <p role="alert" className="font-medium text-danger">
          {error}
        </p>
      ) : (
        <>
          <p className="text-muted">
            We sent a verification link to your email. Open it on this device to finish setting up your account.
          </p>
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-blue to-brand-violet text-white shadow-lg shadow-brand-violet/25">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
              <rect x="3" y="5" width="18" height="14" rx="2.5" />
              <path d="M3.5 7l8.5 6 8.5-6" />
            </svg>
          </span>
          <ol className="space-y-2.5 rounded-2xl border border-border bg-background p-4">
            {["Open the email from Emulix", "Select the verification link", "You will be taken to your dashboard"].map(
              (step, index) => (
                <li key={step} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-blue to-brand-fuchsia text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ),
            )}
          </ol>
          <p className="text-xs text-muted">The link expires in 24 hours. Check your spam folder if you cannot find it.</p>
        </>
      )}
      {resent && (
        <p role="status" className="text-success">
          {resent}
        </p>
      )}
      <button
        type="button"
        onClick={resend}
        className="w-full rounded-xl border border-border bg-surface px-4 py-3 font-semibold transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md"
      >
        Send a new verification link
      </button>
    </div>
  );
}
