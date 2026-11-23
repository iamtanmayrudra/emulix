import { Suspense, type ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth/runtime";

/**
 * Shows one thing to a signed-in visitor and another to everyone else, on pages that are otherwise static.
 *
 * Reading the session cookie cannot be part of the static page, so it sits behind Suspense. The `signedOut` version is
 * what the static page and the loading state show, so a visitor who is not signed in sees no change or flicker. A
 * signed-in visitor sees the page swap to `signedIn` as soon as the session has been read. Nothing here changes or
 * clears the session: visiting a public page never signs anyone out.
 */
export function AuthSwitch({ signedIn, signedOut }: { signedIn: ReactNode; signedOut: ReactNode }) {
  return (
    <Suspense fallback={signedOut}>
      <Resolved signedIn={signedIn} signedOut={signedOut} />
    </Suspense>
  );
}

async function Resolved({ signedIn, signedOut }: { signedIn: ReactNode; signedOut: ReactNode }) {
  const user = await getCurrentUser();
  return user ? signedIn : signedOut;
}
