import { Suspense } from "react";
import type { ReactNode } from "react";
import { RequireSession } from "@/components/auth/require-session";
import { SimplePageSkeleton } from "@/components/skeleton";

/**
 * Everything under this layout needs a signed-in user, so entering it has to read the session cookie and may redirect to
 * sign-in. That cannot be part of the static shell, so instant-navigation validation is switched off for this layout.
 * A layout's setting does not cover its pages, which are validated unless they opt out too. When the session cookie is
 * stale (expired, revoked, or the server restarted), the redirect above stops that validation and Next logs "Could not
 * validate `instant`". Every page.tsx below therefore exports `instant = false` as well. Do the same for a new page here.
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
