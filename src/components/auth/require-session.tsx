import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { PlanProvider } from "@/components/plan-context";
import { getCurrentUser } from "@/lib/auth/runtime";
import { planForStatus } from "@/lib/entitlements";
import { EMAIL_VERIFICATION_REQUIRED } from "@/lib/auth/policy";
import { effectiveSubscription, getUserAccess } from "@/lib/org/runtime";

/** Requires a signed-in, verified user. Enforced on the server, not in the browser. */
export async function RequireSession({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (EMAIL_VERIFICATION_REQUIRED && !user.emailVerifiedAt) redirect("/verify-email");

  // Where a person belongs depends on their place in an organization.
  const access = getUserAccess(user.id);
  if (access.kind === "deactivated") redirect("/login");
  if (access.kind === "super_admin") redirect("/admin/users");
  if (access.kind === "no_seat") redirect("/no-seat");

  const subscription = effectiveSubscription(user, access);
  return (
    <PlanProvider value={{ plan: planForStatus(subscription), subscription }}>
      <AppShell userName={user.name}>{children}</AppShell>
    </PlanProvider>
  );
}
