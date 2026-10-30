import { NextResponse } from "next/server";
import { devOrgSeed } from "../auth/dev-seed";
import { getMailer } from "../auth/mailer";
import { appUrl, getAuthService } from "../auth/runtime";
import { getAuthStore, type UserRecord } from "../auth/store";
import type { SubscriptionStatus } from "../mock-data";
import { OUTSIDE_ROLE_MESSAGE, OrgFailure, createOrgService, type OrgErrorCode, type OrgService } from "./service";
import { MemoryOrgStore } from "./store";
import type { Access } from "./types";

const globalForOrg = globalThis as typeof globalThis & { __emulixOrgStore?: MemoryOrgStore };

/** One store per server process. Kept on globalThis so hot reloads in development do not reset it. */
export function getOrgStore(): MemoryOrgStore {
  if (!globalForOrg.__emulixOrgStore) {
    const store = new MemoryOrgStore();
    store.seed(devOrgSeed());
    globalForOrg.__emulixOrgStore = store;
  }
  return globalForOrg.__emulixOrgStore;
}

export function getOrgService(): OrgService {
  const auth = getAuthService();
  return createOrgService({
    orgStore: getOrgStore(),
    authStore: getAuthStore(),
    mailer: getMailer(),
    appUrl: appUrl(),
    auth: { requestPasswordReset: auth.requestPasswordReset, resendVerification: auth.resendVerification },
  });
}

/** Where a user stands: on their own, a super admin, a member with or without a seat, or deactivated. */
export function getUserAccess(userId: string): Access {
  return getOrgService().getAccess(userId);
}

/**
 * The subscription that counts for a user. A member with a seat in an active organization has Pro through it.
 * Everyone else has their own subscription.
 */
export function effectiveSubscription(user: UserRecord, access: Access = getUserAccess(user.id)): SubscriptionStatus {
  if (access.kind === "seated") return access.orgActive ? "active" : "free";
  return user.subscription ?? "free";
}

export const ORG_ERROR_STATUS: Record<OrgErrorCode, number> = {
  forbidden: 403,
  not_found: 404,
  seat_limit: 409,
  invalid_input: 400,
  conflict: 409,
  last_super_admin: 409,
  reauth_required: 401,
};

export function orgErrorResponse(error: unknown): NextResponse {
  if (error instanceof OrgFailure) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: ORG_ERROR_STATUS[error.code] });
  }
  console.error("[org] unexpected error", error);
  return NextResponse.json({ error: "server_error", message: "Something went wrong. Try again." }, { status: 500 });
}

/**
 * Guards a request that uses the platform itself: tests, results and billing. Returns the response to send when the
 * user may not, or null when they may.
 *  - A super admin controls accounts only, so the platform is refused and the attempt is logged.
 *  - A member without a seat cannot use it.
 *  - A deactivated member cannot use it.
 */
export async function platformGate(user: UserRecord, detail: string): Promise<NextResponse | null> {
  const access = getUserAccess(user.id);
  switch (access.kind) {
    case "super_admin":
      await getOrgService().recordDenied(user, "platform_access", detail);
      return NextResponse.json({ error: "forbidden", message: OUTSIDE_ROLE_MESSAGE }, { status: 403 });
    case "no_seat":
      return NextResponse.json({ error: "no_seat", message: "You don't have a seat. Ask your super admin to give you one." }, { status: 403 });
    case "deactivated":
      return NextResponse.json({ error: "deactivated", message: "This account has been deactivated." }, { status: 403 });
    default:
      return null;
  }
}
