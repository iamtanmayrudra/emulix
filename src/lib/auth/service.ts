import { randomUUID } from "node:crypto";
import { generateToken, hashToken } from "./tokens";
import { hashPassword, passwordPolicyError, verifyPassword } from "./password";
import type { AuthStore, SessionRecord, UserRecord } from "./store";
import type { Mailer } from "./mailer";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const VERIFY_TOKEN_TTL_MS = 24 * HOUR;
export const RESET_TOKEN_TTL_MS = 30 * MINUTE;
/** Sessions end after 14 days idle or 30 days total, whichever comes first. */
export const SESSION_IDLE_MS = 14 * DAY;
export const SESSION_ABSOLUTE_MS = 30 * DAY;
export const LOCKOUT_THRESHOLD = 10;
export const LOCKOUT_MS = 15 * MINUTE;

export type AuthErrorCode =
  | "invalid_input"
  | "weak_password"
  | "invalid_credentials"
  | "account_locked"
  | "invalid_token";

/** Errors that are safe to show to the user. Routes map the code to an HTTP status. */
export class AuthFailure extends Error {
  constructor(
    readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export type AuthDeps = {
  store: AuthStore;
  mailer: Mailer;
  appUrl: string;
  now?: () => Date;
};

export type LoginResult = { sessionToken: string; user: UserRecord };

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

let dummyHashPromise: Promise<string> | null = null;

/** Used to spend the same hashing time when an email is unknown, so login timing does not reveal accounts. */
function dummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword(generateToken());
  return dummyHashPromise;
}

export function createAuthService(deps: AuthDeps) {
  const { store, mailer, appUrl } = deps;
  const now = deps.now ?? (() => new Date());

  async function sendVerification(user: UserRecord, at: Date) {
    const token = generateToken();
    await store.insertToken({
      tokenHash: hashToken(token),
      userId: user.id,
      purpose: "verify_email",
      expiresAt: new Date(at.getTime() + VERIFY_TOKEN_TTL_MS),
      usedAt: null,
    });
    await mailer.send({
      to: user.email,
      subject: "Verify your Emulix email",
      text: `Confirm your email to start testing:\n\n${appUrl}/verify-email?token=${token}\n\nThis link expires in 24 hours.`,
    });
  }

  async function createSession(userId: string, at: Date): Promise<string> {
    const token = generateToken();
    const session: SessionRecord = {
      tokenHash: hashToken(token),
      userId,
      createdAt: at,
      lastSeenAt: at,
      revokedAt: null,
    };
    await store.insertSession(session);
    return token;
  }

  return {
    /**
     * Creates an unverified account. Returns the same result for an existing email, so sign-up
     * cannot be used to discover which emails have accounts.
     */
    async signUp(input: { email: string; name: string; password: string }): Promise<void> {
      const email = normalizeEmail(input.email);
      const name = input.name.trim();
      if (!isValidEmail(email)) throw new AuthFailure("invalid_input", "Enter a valid email address.");
      if (name.length < 1 || name.length > 80) {
        throw new AuthFailure("invalid_input", "Enter a name between 1 and 80 characters.");
      }
      const problem = passwordPolicyError(input.password);
      if (problem) throw new AuthFailure("weak_password", problem);

      const at = now();
      const existing = await store.findUserByEmail(email);
      // Hash in both branches so response timing does not reveal whether the account exists.
      const passwordHash = await hashPassword(input.password);
      if (existing) return;

      const user: UserRecord = {
        id: randomUUID(),
        email,
        name,
        passwordHash,
        emailVerifiedAt: null,
        failedLogins: 0,
        lockedUntil: null,
        createdAt: at,
        lastLoginAt: null,
      };
      await store.insertUser(user);
      await sendVerification(user, at);
    },

    /** Sends a new verification link to a signed-in, unverified user. */
    async resendVerification(userId: string): Promise<void> {
      const user = await store.findUserById(userId);
      if (!user || user.emailVerifiedAt) return;
      await sendVerification(user, now());
    },

    /** Confirms the email and signs the user in. Returns a session token. */
    async verifyEmail(token: string): Promise<string> {
      const at = now();
      const record = await store.consumeToken(hashToken(token), "verify_email", at);
      if (!record) throw new AuthFailure("invalid_token", "This link is invalid or has expired.");
      await store.updateUser(record.userId, { emailVerifiedAt: at });
      return createSession(record.userId, at);
    },

    async login(input: { email: string; password: string }): Promise<LoginResult> {
      const at = now();
      const email = normalizeEmail(input.email);
      const user = await store.findUserByEmail(email);

      if (!user) {
        await verifyPassword(input.password, await dummyHash());
        throw new AuthFailure("invalid_credentials", "Email or password is incorrect.");
      }

      if (user.lockedUntil && user.lockedUntil > at) {
        throw new AuthFailure(
          "account_locked",
          "Too many failed attempts. Try again in 15 minutes, or reset your password.",
        );
      }

      const ok = await verifyPassword(input.password, user.passwordHash);
      if (!ok) {
        const failedLogins = user.failedLogins + 1;
        const locked = failedLogins >= LOCKOUT_THRESHOLD;
        await store.updateUser(user.id, {
          failedLogins: locked ? 0 : failedLogins,
          lockedUntil: locked ? new Date(at.getTime() + LOCKOUT_MS) : null,
        });
        throw new AuthFailure("invalid_credentials", "Email or password is incorrect.");
      }

      await store.updateUser(user.id, { failedLogins: 0, lockedUntil: null, lastLoginAt: at });
      const sessionToken = await createSession(user.id, at);
      return { sessionToken, user: { ...user, failedLogins: 0, lockedUntil: null, lastLoginAt: at } };
    },

    /** Returns the signed-in user for a session token, or null if the session is missing, revoked, or expired. */
    async getSessionUser(sessionToken: string | undefined): Promise<UserRecord | null> {
      if (!sessionToken) return null;
      const at = now();
      const session = await store.findSession(hashToken(sessionToken));
      if (!session || session.revokedAt) return null;
      if (at.getTime() - session.createdAt.getTime() > SESSION_ABSOLUTE_MS) return null;
      if (at.getTime() - session.lastSeenAt.getTime() > SESSION_IDLE_MS) return null;

      const user = await store.findUserById(session.userId);
      if (!user) return null;
      await store.touchSession(session.tokenHash, at);
      return user;
    },

    async logout(sessionToken: string | undefined): Promise<void> {
      if (!sessionToken) return;
      await store.revokeSession(hashToken(sessionToken), now());
    },

    /** Always resolves the same way, whether or not the email has an account. */
    async requestPasswordReset(email: string): Promise<void> {
      const at = now();
      const user = await store.findUserByEmail(normalizeEmail(email));
      if (!user) return;

      const token = generateToken();
      await store.insertToken({
        tokenHash: hashToken(token),
        userId: user.id,
        purpose: "reset_password",
        expiresAt: new Date(at.getTime() + RESET_TOKEN_TTL_MS),
        usedAt: null,
      });
      await mailer.send({
        to: user.email,
        subject: "Reset your Emulix password",
        text: `Reset your password:\n\n${appUrl}/reset-password?token=${token}\n\nThis link expires in 30 minutes. If you did not ask for this, ignore this email.`,
      });
    },

    /** Sets a new password, signs out every other session, and marks the email as verified. */
    async resetPassword(token: string, password: string): Promise<void> {
      const problem = passwordPolicyError(password);
      if (problem) throw new AuthFailure("weak_password", problem);

      const at = now();
      const record = await store.consumeToken(hashToken(token), "reset_password", at);
      if (!record) throw new AuthFailure("invalid_token", "This link is invalid or has expired.");

      await store.updateUser(record.userId, {
        passwordHash: await hashPassword(password),
        failedLogins: 0,
        lockedUntil: null,
        emailVerifiedAt: at,
      });
      await store.revokeUserSessions(record.userId, at);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
