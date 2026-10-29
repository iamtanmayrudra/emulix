import type { DeviceProfile, Plan, SubscriptionStatus } from "./mock-data";

/**
 * Client-side preview only. These checks only shape the UI.
 * The server must re-check every entitlement on every protected request (plan section 4).
 */
export function planForStatus(status: SubscriptionStatus): Plan {
  return status === "active" || status === "trialing" ? "pro" : "free";
}

export function canSelectProfile(plan: Plan, profile: Pick<DeviceProfile, "minPlan">): boolean {
  return profile.minPlan === "free" || plan === "pro";
}
