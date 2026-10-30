import type { Membership, Organization } from "@/lib/org/types";
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


/**
 * A demo organization for trying the Organization plan (docs/SUPER_ADMIN.md). Each login's password is the login itself.
 *   superadmin  the super admin. Controls accounts, uses no seat and cannot run tests
 *   alice, bob, carol  members with a seat (3 of 4 seats used)
 *   dave, erin  members without a seat, so the fifth seat can be refused
 */
export const DEV_ORG_ID = "dev-org";
export const DEV_ORG_SEAT_LIMIT = 4;
const DEV_ORG_PEOPLE = [
  { login: "superadmin", name: "Sam Super Admin", role: "super_admin" as const, seated: false, hash: "scrypt$16384$8$1$67c28868c76222287d9f530b7a3fbcff$30ed05058cd28a4efda10129df51846db3376a1f71386c82fe7d3ec76ae86a9e63a48040863410c8af0496bf151660707b3e60362ff2bd70f961bab522c7453a" },
  { login: "alice", name: "Alice Member", role: "member" as const, seated: true, hash: "scrypt$16384$8$1$e63a0482accbdc2dcdfa1ef60e915c52$4e3f1b5f1c550d9832ae0b1021788743246133f66fc8f15619ccc1d63241cf4613db7e9653e06f1a3c7ac89db391deea59b6b47a208e1b48f1c4e83c32ffde4f" },
  { login: "bob", name: "Bob Member", role: "member" as const, seated: true, hash: "scrypt$16384$8$1$bbd83fae52e5b4ff372513be7c356c47$2090eb6fb938d03efe3ac8f5d3d97cd805d1f82b92622769adbf44ce16e2b27f78bed0a0a0c57946f2320e7a1a55c955d387ceeb466e0b743dba47f63a51829a" },
  { login: "carol", name: "Carol Member", role: "member" as const, seated: true, hash: "scrypt$16384$8$1$85b5018d8729f6a321e6020b9a377299$5dd0480ac8972a4a3b2a7566f722a6593ea98aa59f4b1ff0e357acf962a1e31f07da7b2b34c1adcc445fd31036f8a06cc22e2e1931650575e616c18c006840e9" },
  { login: "dave", name: "Dave Member", role: "member" as const, seated: false, hash: "scrypt$16384$8$1$5791271eb6db0611bab5048b751c202a$4bb53ed7560f3bf190669da769e46b0821767d6332332658377c9761c9a2436b47bbcd890c3284371e208866c78e3a87f29f1d9c4105e0d16830a9b1d952a8ff" },
  { login: "erin", name: "Erin Member", role: "member" as const, seated: false, hash: "scrypt$16384$8$1$a37205bae50e8ebddf46bfd772409865$e20dfe16d0d763b6b4d60c52db17568e72330b354bdb8fcfd50a56244abdc35008e8c1c869e481f40a8dbd3eafdca1503b084b5ba66bb6101c6ae909c0f7299e" },
];

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
    ...DEV_ORG_PEOPLE.map(
      (person): UserRecord => ({
        id: `dev-${person.login}`,
        email: person.login,
        name: person.name,
        passwordHash: person.hash,
        emailVerifiedAt: now,
        failedLogins: 0,
        lockedUntil: null,
        createdAt: now,
        lastLoginAt: null,
      }),
    ),
  ];
}

/** The demo organization and its memberships. Never created in production. */
export function devOrgSeed(now: Date = new Date()): { orgs: Organization[]; memberships: Membership[] } {
  if (process.env.NODE_ENV === "production") return { orgs: [], memberships: [] };
  return {
    orgs: [{ id: DEV_ORG_ID, name: "Acme Labs (demo)", planStatus: "active", seatLimit: DEV_ORG_SEAT_LIMIT, createdAt: now }],
    memberships: DEV_ORG_PEOPLE.map((person) => ({
      userId: `dev-${person.login}`,
      orgId: DEV_ORG_ID,
      role: person.role,
      status: "active" as const,
      seated: person.seated,
      invitedBy: null,
      createdAt: now,
    })),
  };
}
