"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Ends the session and returns to sign-in. */
export function SignOutButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60 ${className}`}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
