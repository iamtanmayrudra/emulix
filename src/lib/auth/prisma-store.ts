import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { BillingRecord } from "@/lib/billing/checkout";
import type { SubscriptionStatus } from "@/lib/mock-data";
import type { EmailLogRecord, EmailStatus, EmailType } from "@/lib/email/types";
import type { AuthStore, SessionRecord, TokenPurpose, TokenRecord, UserRecord } from "./store";

/**
 * The AuthStore for a real database (Postgres, through Prisma). It must behave exactly like MemoryAuthStore:
 * tests/auth-store.test.ts runs the same cases against both.
 */

type UserRow = Prisma.UserGetPayload<object>;
type SessionRow = Prisma.SessionGetPayload<object>;
type TokenRow = Prisma.TokenGetPayload<object>;
type EmailLogRow = Prisma.EmailLogGetPayload<object>;

/** Billing is stored as JSON, where dates become text. This is the shape on disk. */
type StoredBilling = Omit<BillingRecord, "paidAt" | "renewsAt"> & { paidAt: string; renewsAt: string };

function billingToJson(billing: BillingRecord): Prisma.InputJsonValue {
  const stored: StoredBilling = { ...billing, paidAt: billing.paidAt.toISOString(), renewsAt: billing.renewsAt.toISOString() };
  return stored as unknown as Prisma.InputJsonValue;
}

function billingFromJson(value: Prisma.JsonValue | null): BillingRecord | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const stored = value as unknown as StoredBilling;
  return { ...stored, paidAt: new Date(stored.paidAt), renewsAt: new Date(stored.renewsAt) };
}

function toUser(row: UserRow): UserRecord {
  const user: UserRecord = {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.passwordHash,
    emailVerifiedAt: row.emailVerifiedAt,
    failedLogins: row.failedLogins,
    lockedUntil: row.lockedUntil,
    createdAt: row.createdAt,
    lastLoginAt: row.lastLoginAt,
  };
  if (row.subscription) user.subscription = row.subscription as SubscriptionStatus;
  const billing = billingFromJson(row.billing);
  if (billing) user.billing = billing;
  return user;
}

function toSession(row: SessionRow): SessionRecord {
  return { tokenHash: row.tokenHash, userId: row.userId, createdAt: row.createdAt, lastSeenAt: row.lastSeenAt, revokedAt: row.revokedAt };
}

function toToken(row: TokenRow): TokenRecord {
  return { tokenHash: row.tokenHash, userId: row.userId, purpose: row.purpose as TokenPurpose, expiresAt: row.expiresAt, usedAt: row.usedAt };
}

function toEmailLog(row: EmailLogRow): EmailLogRecord {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type as EmailType,
    recipient: row.recipient,
    providerMessageId: row.providerMessageId,
    status: row.status as EmailStatus,
    error: row.error,
    sentAt: row.sentAt,
    createdAt: row.createdAt,
  };
}

/** The update data for a partial user. Fields left out stay as they are. */
function userPatch(patch: Partial<UserRecord>): Prisma.UserUpdateManyMutationInput {
  const data: Prisma.UserUpdateManyMutationInput = {};
  if (patch.email !== undefined) data.email = patch.email;
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.passwordHash !== undefined) data.passwordHash = patch.passwordHash;
  if (patch.emailVerifiedAt !== undefined) data.emailVerifiedAt = patch.emailVerifiedAt;
  if (patch.failedLogins !== undefined) data.failedLogins = patch.failedLogins;
  if (patch.lockedUntil !== undefined) data.lockedUntil = patch.lockedUntil;
  if (patch.createdAt !== undefined) data.createdAt = patch.createdAt;
  if (patch.lastLoginAt !== undefined) data.lastLoginAt = patch.lastLoginAt;
  if (patch.subscription !== undefined) data.subscription = patch.subscription;
  if (patch.billing !== undefined) data.billing = billingToJson(patch.billing);
  return data;
}

export class PrismaAuthStore implements AuthStore {
  constructor(private readonly db: PrismaClient) {}

  async findUserByEmail(email: string) {
    const row = await this.db.user.findUnique({ where: { email } });
    return row ? toUser(row) : null;
  }

  async findUserById(id: string) {
    const row = await this.db.user.findUnique({ where: { id } });
    return row ? toUser(row) : null;
  }

  async insertUser(user: UserRecord) {
    await this.db.user.create({
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        passwordHash: user.passwordHash,
        emailVerifiedAt: user.emailVerifiedAt,
        failedLogins: user.failedLogins,
        lockedUntil: user.lockedUntil,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        subscription: user.subscription ?? null,
        ...(user.billing ? { billing: billingToJson(user.billing) } : {}),
      },
    });
  }

  async updateUser(id: string, patch: Partial<UserRecord>) {
    // updateMany, because updating a user that does not exist is a no-op here, as in the memory store.
    await this.db.user.updateMany({ where: { id }, data: userPatch(patch) });
  }

  async reassignEmail(id: string, email: string) {
    // The unique index decides who wins when two requests race for the same address.
    const holder = await this.db.user.findUnique({ where: { email }, select: { id: true } });
    if (holder && holder.id !== id) return false;
    try {
      const { count } = await this.db.user.updateMany({ where: { id }, data: { email } });
      return count === 1;
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") return false;
      throw error;
    }
  }

  async insertToken(token: TokenRecord) {
    await this.db.token.create({ data: { ...token } });
  }

  async consumeToken(tokenHash: string, purpose: TokenPurpose, now: Date) {
    // One conditional UPDATE, so two requests with the same link cannot both succeed.
    const { count } = await this.db.token.updateMany({
      where: { tokenHash, purpose, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (count !== 1) return null;
    const row = await this.db.token.findUnique({ where: { tokenHash } });
    return row ? toToken(row) : null;
  }

  async invalidateUserTokens(userId: string, purpose: TokenPurpose, at: Date) {
    await this.db.token.updateMany({ where: { userId, purpose, usedAt: null }, data: { usedAt: at } });
  }

  async insertEmailLog(record: EmailLogRecord) {
    await this.db.emailLog.create({ data: { ...record } });
  }

  async updateEmailLog(id: string, patch: Partial<EmailLogRecord>) {
    const data = { ...patch };
    delete data.id;
    await this.db.emailLog.updateMany({ where: { id }, data });
  }

  async findEmailLogs(userId: string) {
    const rows = await this.db.emailLog.findMany({ where: { userId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
    return rows.map(toEmailLog);
  }

  async insertSession(session: SessionRecord) {
    await this.db.session.create({ data: { ...session } });
  }

  async findSession(tokenHash: string) {
    const row = await this.db.session.findUnique({ where: { tokenHash } });
    return row ? toSession(row) : null;
  }

  async touchSession(tokenHash: string, at: Date) {
    await this.db.session.updateMany({ where: { tokenHash }, data: { lastSeenAt: at } });
  }

  async revokeSession(tokenHash: string, at: Date) {
    await this.db.session.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: at } });
  }

  async revokeUserSessions(userId: string, at: Date) {
    await this.db.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: at } });
  }
}
