import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { PrismaPGlite } from "pglite-prisma-adapter";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../src/generated/prisma/client";
import { DevelopmentMailer } from "../src/lib/auth/mailer";
import { PrismaAuthStore } from "../src/lib/auth/prisma-store";
import { createAuthService } from "../src/lib/auth/service";
import { MemoryAuthStore, type AuthStore, type UserRecord } from "../src/lib/auth/store";
import type { EmailLogRecord } from "../src/lib/email/types";

/**
 * Runs the same cases against the in-memory store and the Prisma store, so the database one cannot drift from the one
 * the rest of the tests use. The database is PGlite (real Postgres, in this process) with the project's own migration.
 */

const T0 = new Date("2026-10-15T10:00:00.000Z");
const later = (ms: number) => new Date(T0.getTime() + ms);

function user(id: string, email: string, extra: Partial<UserRecord> = {}): UserRecord {
  return {
    id,
    email,
    name: "Ana",
    passwordHash: "hash",
    emailVerifiedAt: null,
    failedLogins: 0,
    lockedUntil: null,
    createdAt: T0,
    lastLoginAt: null,
    ...extra,
  };
}

let pg: PGlite;
let prisma: PrismaClient;

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(readFileSync("prisma/migrations/20261120000000_init/migration.sql", "utf8"));
  prisma = new PrismaClient({ adapter: new PrismaPGlite(pg) });
});

afterAll(async () => {
  await prisma.$disconnect();
  await pg.close();
});

async function resetDatabase() {
  await prisma.emailLog.deleteMany();
  await prisma.token.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
}

const implementations: { name: string; make: () => Promise<AuthStore> }[] = [
  { name: "MemoryAuthStore", make: async () => new MemoryAuthStore() },
  {
    name: "PrismaAuthStore (Postgres)",
    make: async () => {
      await resetDatabase();
      return new PrismaAuthStore(prisma);
    },
  },
];

describe.each(implementations)("$name", ({ make }) => {
  it("stores a user and finds it by id and by email", async () => {
    const store = await make();
    await store.insertUser(user("u1", "ana@example.com"));
    expect(await store.findUserByEmail("ana@example.com")).toEqual(user("u1", "ana@example.com"));
    expect((await store.findUserById("u1"))?.email).toBe("ana@example.com");
    expect(await store.findUserByEmail("nobody@example.com")).toBeNull();
    expect(await store.findUserById("nope")).toBeNull();
  });

  it("updates only the fields in the patch, and can clear a date", async () => {
    const store = await make();
    await store.insertUser(user("u1", "ana@example.com", { lockedUntil: later(1000), failedLogins: 5 }));
    await store.updateUser("u1", { failedLogins: 0, lockedUntil: null, lastLoginAt: later(5) });
    const found = await store.findUserById("u1");
    expect(found?.failedLogins).toBe(0);
    expect(found?.lockedUntil).toBeNull();
    expect(found?.lastLoginAt).toEqual(later(5));
    expect(found?.name).toBe("Ana");
    await expect(store.updateUser("missing", { name: "x" })).resolves.toBeUndefined();
  });

  it("keeps the subscription and the order, with dates, across a round trip", async () => {
    const store = await make();
    await store.insertUser(user("u1", "ana@example.com"));
    const order = {
      orderId: "EMX-1234ABCD",
      plan: "pro" as const,
      cycle: "monthly" as const,
      amountCents: 1900,
      currency: "USD",
      paidAt: T0,
      renewsAt: later(30 * 24 * 3600 * 1000),
      card: { brand: "visa" as const, last4: "4242" },
    };
    await store.updateUser("u1", { subscription: "active", billing: order });
    const found = await store.findUserById("u1");
    expect(found?.subscription).toBe("active");
    expect(found?.billing).toEqual(order);
    expect((await store.findUserById("u1"))?.billing?.paidAt).toBeInstanceOf(Date);
    // A free account has neither field at all, as in the memory store.
    await store.insertUser(user("u2", "bo@example.com"));
    const free = await store.findUserById("u2");
    expect(free && "subscription" in free).toBe(false);
    expect(free && "billing" in free).toBe(false);
  });

  it("moves an account to a new email, and refuses an address another account holds", async () => {
    const store = await make();
    await store.insertUser(user("u1", "ana@example.com"));
    await store.insertUser(user("u2", "bo@example.com"));
    expect(await store.reassignEmail("u1", "bo@example.com")).toBe(false);
    expect((await store.findUserById("u1"))?.email).toBe("ana@example.com");
    expect(await store.reassignEmail("u1", "ana2@example.com")).toBe(true);
    expect(await store.findUserByEmail("ana@example.com")).toBeNull();
    expect((await store.findUserByEmail("ana2@example.com"))?.id).toBe("u1");
    expect(await store.reassignEmail("u1", "ana2@example.com")).toBe(true);
    expect(await store.reassignEmail("ghost", "ghost@example.com")).toBe(false);
  });

  it("uses a token once, only for its purpose, and not after it expires", async () => {
    const store = await make();
    await store.insertUser(user("u1", "ana@example.com"));
    await store.insertToken({ tokenHash: "t1", userId: "u1", purpose: "verify_email", expiresAt: later(1000), usedAt: null });
    expect(await store.consumeToken("t1", "reset_password", T0)).toBeNull();
    expect(await store.consumeToken("t1", "verify_email", later(1000))).toBeNull();
    const used = await store.consumeToken("t1", "verify_email", later(10));
    expect(used?.userId).toBe("u1");
    expect(used?.usedAt).toEqual(later(10));
    expect(await store.consumeToken("t1", "verify_email", later(20))).toBeNull();
    expect(await store.consumeToken("unknown", "verify_email", T0)).toBeNull();
  });

  it("lets only one of two simultaneous requests use the same link", async () => {
    const store = await make();
    await store.insertUser(user("u1", "ana@example.com"));
    await store.insertToken({ tokenHash: "t1", userId: "u1", purpose: "reset_password", expiresAt: later(1000), usedAt: null });
    const results = await Promise.all([store.consumeToken("t1", "reset_password", T0), store.consumeToken("t1", "reset_password", T0)]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("retires every unused token of one kind for a user", async () => {
    const store = await make();
    await store.insertUser(user("u1", "ana@example.com"));
    await store.insertToken({ tokenHash: "v1", userId: "u1", purpose: "verify_email", expiresAt: later(1000), usedAt: null });
    await store.insertToken({ tokenHash: "r1", userId: "u1", purpose: "reset_password", expiresAt: later(1000), usedAt: null });
    await store.invalidateUserTokens("u1", "verify_email", T0);
    expect(await store.consumeToken("v1", "verify_email", T0)).toBeNull();
    expect(await store.consumeToken("r1", "reset_password", T0)).not.toBeNull();
  });

  it("finds, touches and revokes sessions", async () => {
    const store = await make();
    await store.insertUser(user("u1", "ana@example.com"));
    await store.insertSession({ tokenHash: "s1", userId: "u1", createdAt: T0, lastSeenAt: T0, revokedAt: null });
    await store.insertSession({ tokenHash: "s2", userId: "u1", createdAt: T0, lastSeenAt: T0, revokedAt: null });
    expect(await store.findSession("s1")).toEqual({ tokenHash: "s1", userId: "u1", createdAt: T0, lastSeenAt: T0, revokedAt: null });
    expect(await store.findSession("nope")).toBeNull();
    await store.touchSession("s1", later(60));
    expect((await store.findSession("s1"))?.lastSeenAt).toEqual(later(60));
    await store.revokeSession("s1", later(70));
    await store.revokeSession("s1", later(80));
    expect((await store.findSession("s1"))?.revokedAt).toEqual(later(70));
    await store.revokeUserSessions("u1", later(90));
    expect((await store.findSession("s1"))?.revokedAt).toEqual(later(70));
    expect((await store.findSession("s2"))?.revokedAt).toEqual(later(90));
  });

  it("logs emails, updates a row, and lists a user's rows newest first", async () => {
    const store = await make();
    await store.insertUser(user("u1", "ana@example.com"));
    const row = (id: string, at: number): EmailLogRecord => ({
      id,
      userId: "u1",
      type: "VERIFICATION",
      recipient: "ana@example.com",
      providerMessageId: null,
      status: "QUEUED",
      error: null,
      sentAt: null,
      createdAt: later(at),
    });
    await store.insertEmailLog(row("e1", 1));
    await store.insertEmailLog(row("e2", 2));
    await store.updateEmailLog("e1", { status: "SENT", providerMessageId: "msg_1", sentAt: later(3) });
    await store.updateEmailLog("e2", { status: "FAILED", error: "Provider refused" });
    const logs = await store.findEmailLogs("u1");
    expect(logs.map((entry) => entry.id)).toEqual(["e2", "e1"]);
    expect(logs[1]).toMatchObject({ status: "SENT", providerMessageId: "msg_1", sentAt: later(3) });
    expect(logs[0]).toMatchObject({ status: "FAILED", error: "Provider refused" });
    expect(await store.findEmailLogs("someone-else")).toEqual([]);
  });

  it("signs up, signs out, and signs in again through the auth service", async () => {
    const store = await make();
    const mailer = new DevelopmentMailer({ log: false });
    const service = createAuthService({ store, mailer, appUrl: "http://test.local", now: () => T0 });
    await service.signUp({ email: "ana@example.com", name: "Ana", password: "correct horse battery" });
    const session = await service.login({ email: "ana@example.com", password: "correct horse battery" });
    expect(session.user.email).toBe("ana@example.com");
    expect((await service.getSessionUser(session.sessionToken))?.email).toBe("ana@example.com");
    await service.logout(session.sessionToken);
    expect(await service.getSessionUser(session.sessionToken)).toBeNull();
    // A second server instance built on the same storage sees the same account.
    const other = createAuthService({ store, mailer, appUrl: "http://test.local", now: () => T0 });
    const again = await other.login({ email: "ana@example.com", password: "correct horse battery" });
    expect(again.user.id).toBe(session.user.id);
  });
});
