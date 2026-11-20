import { Suspense } from "react";
import type { ReactNode } from "react";
import { RequireSession } from "@/components/auth/require-session";
import { SimplePageSkeleton } from "@/components/skeleton";

/**
 * Everything under this layout needs a signed-in user, so entering it has to read the session cookie and may redirect to
 * sign-in. That cannot be part of the static shell, so instant-navigation validation is switched off for this layout only.
 * Pages below it are still validated when moving between them.
 */
export const instant = false;

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
          <SimplePageSkeleton label="Loading" rows={5} />
        </div>
      }
    >
      <RequireSession>{children}</RequireSession>
    </Suspense>
  );
}
