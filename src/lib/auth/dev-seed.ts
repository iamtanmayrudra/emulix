import type { UserRecord } from "./store";

/**
 * Development-only test account. It is never created when NODE_ENV is production.
 * Sign in with the login "admin" and the password "admin". The login is stored as-is, so it is not a real email.
 * The password hash is precomputed with the same scrypt settings as password.ts.
 * The password is "admin" and does not meet the sign-up policy, so the account is seeded here, not created through sign-up.
 */
export const DEV_ADMIN_USERNAME = "admin";
export const DEV_ADMIN_PASSWORD = "admin";
/** A second development account on the Free plan, for trying the upgrade. Login "free", password "free". */
export const DEV_FREE_USERNAME = "free";
export const DEV_FREE_PASSWORD = "free";
const DEV_FREE_PASSWORD_HASH =
  "scrypt$16384$8$1$ca5fdd184e1b30e485891ea06935b720$ccef64c791f1313a9ff567e4a5b75ead7842e3669390a03ceda4926d5a2b8a0c1b2bb132249b41225c4f26fb7fd8bd8bc44a457f3c7911293318289ff5a4cdc2";
const DEV_ADMIN_PASSWORD_HASH =
  "scrypt$16384$8$1$918d99ba46ccc5acc28c189ccaf7ca2a$51c4743c3d317e59ff3908fe593c7133482a853837b651fd5c31ddcceee95281e148a44f552bfdb241fa24d89888a37089a5f8c354eae6cf6c53e874f0659270";

export function devSeedUsers(now: Date = new Date()): UserRecord[] {
  if (process.env.NODE_ENV === "production") return [];
  return [
    {
      id: "dev-admin",
      email: DEV_ADMIN_USERNAME,
      name: "Admin",
      passwordHash: DEV_ADMIN_PASSWORD_HASH,
      emailVerifiedAt: now,
      failedLogins: 0,
      lockedUntil: null,
      createdAt: now,
      lastLoginAt: null,
      // Development only: the seeded admin has Pro so Pro devices can be tested. Never set in production.
      subscription: "active",
    },
    {
      id: "dev-free",
      email: DEV_FREE_USERNAME,
      name: "Free User",
      passwordHash: DEV_FREE_PASSWORD_HASH,
      emailVerifiedAt: now,
      failedLogins: 0,
      lockedUntil: null,
      createdAt: now,
      lastLoginAt: null,
    },
  ];
}
