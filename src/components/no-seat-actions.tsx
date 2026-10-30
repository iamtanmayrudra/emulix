"use client";

import { useState } from "react";
import { SignOutButton } from "@/components/sign-out-button";

/** The only two things a member without a seat can do: ask for a reset link for their own password, or sign out. */
export function NoSeatActions({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function sendReset() {
    setState("sending");
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setState(response.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={sendReset}
          disabled={state === "sending" || state === "sent"}
          className="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold transition hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
        >
          {state === "sending" ? "Sending…" : state === "sent" ? "Link sent" : "Email me a link to change my password"}
        </button>
        <SignOutButton className="border border-border text-foreground hover:bg-background" />
      </div>
      <p role="status" aria-live="polite" className={`min-h-5 text-xs font-medium ${state === "error" ? "text-danger" : "text-success"}`}>
        {state === "sent" ? "Check your inbox for the link." : state === "error" ? "The link could not be sent. Try again in a few minutes." : ""}
      </p>
    </div>
  );
}
