import { devSeedUsers } from "./dev-seed";
import type { BillingRecord } from "@/lib/billing/checkout";
import type { SubscriptionStatus } from "@/lib/mock-data";

/**
 * Storage for accounts, sessions, and one-time tokens.
 *
 * Development uses the in-memory implementation below. Data is lost on restart and is not shared
 * between server instances. Replace it with the chosen database (plan decision 8) before any
 * deployment. The service layer only talks to this interface.
 */

export type UserRecord = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  emailVerifiedAt: Date | null;
  failedLogins: number;
  lockedUntil: Date | null;
  createdAt: Date;
  lastLoginAt: Date | null;
  /** Missing means free. Billing (Phase 4) will own this field. */
  subscription?: SubscriptionStatus;
  /** The last Pro order. Missing for free accounts, and for the development admin, which is Pro without an order. */
  billing?: BillingRecord;
};

export type SessionRecord = {
  tokenHash: string;
  userId: string;
  createdAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
};

export type TokenPurpose = "verify_email" | "reset_password";

export type TokenRecord = {
  tokenHash: string;
  userId: string;
  purpose: TokenPurpose;
  expiresAt: Date;
  usedAt: Date | null;
};

export interface AuthStore {
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  insertUser(user: UserRecord): Promise<void>;
  updateUser(id: string, patch: Partial<UserRecord>): Promise<void>;
  /** Moves an account to a new email address. Returns false when another account already uses it. */
  reassignEmail(id: string, email: string): Promise<boolean>;

  insertToken(token: TokenRecord): Promise<void>;
  /** Marks a matching, unused, unexpired token as used and returns it. Returns null otherwise. */
  consumeToken(tokenHash: string, purpose: TokenPurpose, now: Date): Promise<TokenRecord | null>;

  insertSession(session: SessionRecord): Promise<void>;
  findSession(tokenHash: string): Promise<SessionRecord | null>;
  touchSession(tokenHash: string, at: Date): Promise<void>;
  revokeSession(tokenHash: string, at: Date): Promise<void>;
  revokeUserSessions(userId: string, at: Date): Promise<void>;
}

export class MemoryAuthStore implements AuthStore {
  private users = new Map<string, UserRecord>();
  private usersByEmail = new Map<string, string>();
  private tokens = new Map<string, TokenRecord>();
  private sessions = new Map<string, SessionRecord>();

  /** Seed users are loaded synchronously so the store is ready before the first request. */
  constructor(seedUsers: UserRecord[] = []) {
    for (const user of seedUsers) {
      this.users.set(user.id, { ...user });
      this.usersByEmail.set(user.email, user.id);
    }
  }

  async findUserByEmail(email: string) {
    const id = this.usersByEmail.get(email);
    return id ? (this.users.get(id) ?? null) : null;
  }

  async findUserById(id: string) {
    return this.users.get(id) ?? null;
  }

  async insertUser(user: UserRecord) {
    this.users.set(user.id, { ...user });
    this.usersByEmail.set(user.email, user.id);
  }

  async updateUser(id: string, patch: Partial<UserRecord>) {
    const current = this.users.get(id);
    if (current) this.users.set(id, { ...current, ...patch });
  }

  async reassignEmail(id: string, email: string) {
    const current = this.users.get(id);
    if (!current) return false;
    const holder = this.usersByEmail.get(email);
    if (holder && holder !== id) return false;
    this.usersByEmail.delete(current.email);
    this.usersByEmail.set(email, id);
    this.users.set(id, { ...current, email });
    return true;
  }

  async insertToken(token: TokenRecord) {
    this.tokens.set(token.tokenHash, { ...token });
  }

  async consumeToken(tokenHash: string, purpose: TokenPurpose, now: Date) {
    const token = this.tokens.get(tokenHash);
    if (!token || token.purpose !== purpose || token.usedAt || token.expiresAt <= now) {
      return null;
    }
    token.usedAt = now;
    return { ...token };
  }

  async insertSession(session: SessionRecord) {
    this.sessions.set(session.tokenHash, { ...session });
  }

  async findSession(tokenHash: string) {
    const session = this.sessions.get(tokenHash);
    return session ? { ...session } : null;
  }

  async touchSession(tokenHash: string, at: Date) {
    const session = this.sessions.get(tokenHash);
    if (session) session.lastSeenAt = at;
  }

  async revokeSession(tokenHash: string, at: Date) {
    const session = this.sessions.get(tokenHash);
    if (session && !session.revokedAt) session.revokedAt = at;
  }

  async revokeUserSessions(userId: string, at: Date) {
    for (const session of this.sessions.values()) {
      if (session.userId === userId && !session.revokedAt) session.revokedAt = at;
    }
  }
}

const globalForAuth = globalThis as typeof globalThis & { __emulixAuthStore?: AuthStore };

/** One store per server process. Kept on globalThis so hot reloads in development do not reset it. */
export function getAuthStore(): AuthStore {
  globalForAuth.__emulixAuthStore ??= new MemoryAuthStore(devSeedUsers());
  return globalForAuth.__emulixAuthStore;
}
