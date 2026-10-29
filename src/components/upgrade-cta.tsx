import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/runtime";

const BUTTON =
  "block rounded-2xl bg-gradient-to-r from-brand-blue via-brand-violet to-brand-fuchsia px-5 py-3.5 text-center text-sm font-bold text-white shadow-lg shadow-brand-violet/25 transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** Sends each visitor to the right place: sign in first if needed, straight to checkout if signed in, or billing if already Pro. */
async function UpgradeCtaContent() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <>
        <Link href="/login?next=/checkout" className={BUTTON}>
          Upgrade to Pro
        </Link>
        <p className="mt-3 text-center text-xs text-muted">
          New here?{" "}
          <Link href="/signup" className="font-medium text-accent hover:underline">
            Create a free account
          </Link>{" "}
          first.
        </p>
      </>
    );
  }

  if (user.subscription === "active") {
    return (
      <Link href="/profile" className="block rounded-2xl border border-pro/40 bg-pro/10 px-5 py-3.5 text-center text-sm font-bold text-pro">
        You&rsquo;re on Pro. See billing details
      </Link>
    );
  }

  return (
    <Link href="/checkout" className={BUTTON}>
      Upgrade to Pro
    </Link>
  );
}

/** The signed-in user is read inside Suspense, so the rest of the pricing page stays static. */
export function UpgradeCta() {
  return (
    <Suspense
      fallback={
        <Link href="/checkout" className={BUTTON}>
          Upgrade to Pro
        </Link>
      }
    >
      <UpgradeCtaContent />
    </Suspense>
  );
}
