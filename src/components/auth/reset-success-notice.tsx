"use client";

import { useSearchParams } from "next/navigation";

/** Shown on the sign-in page after a password reset sends people back here. */
export function ResetSuccessNotice() {
  const params = useSearchParams();
  if (params.get("reset") !== "1") return null;
  return (
    <p role="status" className="mb-4 flex items-start gap-2.5 rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm font-medium text-success">
      <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12.5l3 3 5-6" />
      </svg>
      Password updated. Sign in with your new password.
    </p>
  );
}
