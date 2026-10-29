import { Suspense } from "react";
import type { ReactNode } from "react";
import { RequireSession } from "@/components/auth/require-session";
import { SimplePageSkeleton } from "@/components/skeleton";

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
