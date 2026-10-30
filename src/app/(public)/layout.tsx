import { Suspense } from "react";
import type { ReactNode } from "react";
import { RequireSession } from "@/components/auth/require-session";
import { PublicShell } from "@/components/public-shell";
import { getCurrentUser } from "@/lib/auth/runtime";
import { getUserAccess } from "@/lib/org/runtime";
import { PublicPageSkeleton } from "@/components/skeleton";

/** Pages that work without an account. Signed-in users get the full app shell, and everyone else gets the public header. */
async function PublicArea({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  // Only people who use the platform get the app header. A super admin or a member without a seat sees the public one.
  if (user && ["individual", "seated"].includes(getUserAccess(user.id).kind)) return <RequireSession>{children}</RequireSession>;
  return <PublicShell>{children}</PublicShell>;
}

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
          <PublicPageSkeleton label="Loading" />
        </div>
      }
    >
      <PublicArea>{children}</PublicArea>
    </Suspense>
  );
}
