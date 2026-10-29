import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { PlanProvider } from "@/components/plan-context";
import { getCurrentUser } from "@/lib/auth/runtime";
import { planForStatus } from "@/lib/entitlements";
import { EMAIL_VERIFICATION_REQUIRED } from "@/lib/auth/policy";

/** Requires a signed-in, verified user. Enforced on the server, not in the browser. */
export async function RequireSession({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (EMAIL_VERIFICATION_REQUIRED && !user.emailVerifiedAt) redirect("/verify-email");

  const subscription = user.subscription ?? "free";
  return (
    <PlanProvider value={{ plan: planForStatus(subscription), subscription }}>
      <AppShell userName={user.name}>{children}</AppShell>
    </PlanProvider>
  );
}
