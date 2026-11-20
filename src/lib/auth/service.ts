import { randomUUID } from "node:crypto";
import { generateToken, hashToken } from "./tokens";
import { hashPassword, passwordPolicyError, verifyPassword } from "./password";
import type { AuthStore, SessionRecord, UserRecord } from "./store";
import type { Mailer } from "./mailer";
import { createEmailService } from "../email/email.service";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** The email plan asks for 30 to 60 minutes for verification and 15 to 30 for reset (docs/EMAIL_SERVICE.md). */
export const VERIFY_TOKEN_TTL_MS = HOUR;
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

/**
 * Lets a route run email delivery after the response has gone out, for example with Next's after(). Without it the
 * email is sent before the call returns. Deferring keeps the response time the same whether or not an account exists.
 */
export type Schedule = (task: () => Promise<void>) => void;

/**
 * Runs a delivery task. A required email lets its failure reach the caller. An optional one (welcome, security alert)
 * never fails the action it follows. Failures are already logged by the email service.
 */
async function dispatch(task: () => Promise<void>, options: { schedule?: Schedule; required: boolean }) {
  if (options.schedule) {
    options.schedule(() => task().catch(() => undefined));
    return;
  }
  if (options.required) return task();
  await task().catch(() => undefined);
}

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
  const emails = createEmailService({ mailer, log: store, appUrl, now });
  const recipient = (user: UserRecord) => ({ userId: user.id, email: user.email, name: user.name });

  /** Issues a fresh link and retires older ones, so only the newest email works. Throws EmailDeliveryError if it cannot send. */
  async function sendVerification(user: UserRecord, at: Date) {
    await store.invalidateUserTokens(user.id, "verify_email", at);
    const token = generateToken();
    await store.insertToken({
      tokenHash: hashToken(token),
      userId: user.id,
      purpose: "verify_email",
      expiresAt: new Date(at.getTime() + VERIFY_TOKEN_TTL_MS),
      usedAt: null,
    });
    await emails.sendVerificationEmail(recipient(user), token, VERIFY_TOKEN_TTL_MS);
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
    async signUp(input: { email: string; name: string; password: string }, schedule?: Schedule): Promise<void> {
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
      await dispatch(() => sendVerification(user, at), { schedule, required: true });
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
      const user = await store.findUserById(record.userId);
      const firstTime = user !== null && user.emailVerifiedAt === null;
      await store.updateUser(record.userId, { emailVerifiedAt: at });
      if (user && firstTime) await dispatch(() => emails.sendWelcomeEmail(recipient(user)), { required: false });
      return createSession(record.userId, at);
    },

    async login(input: { email: string; password: string }, schedule?: Schedule): Promise<LoginResult> {
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
        if (locked) {
          await dispatch(() => emails.sendSecurityAlertEmail(recipient(user), "Your account was locked for 15 minutes after repeated failed sign-in attempts."), { schedule, required: false });
        }
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
    async requestPasswordReset(email: string, schedule?: Schedule): Promise<void> {
      const at = now();
      const user = await store.findUserByEmail(normalizeEmail(email));
      if (!user) return;

      await store.invalidateUserTokens(user.id, "reset_password", at);
      const token = generateToken();
      await store.insertToken({
        tokenHash: hashToken(token),
        userId: user.id,
        purpose: "reset_password",
        expiresAt: new Date(at.getTime() + RESET_TOKEN_TTL_MS),
        usedAt: null,
      });
      await dispatch(() => emails.sendPasswordResetEmail(recipient(user), token, RESET_TOKEN_TTL_MS), { schedule, required: true });
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

      const user = await store.findUserById(record.userId);
      if (user) await dispatch(() => emails.sendSecurityAlertEmail(recipient(user), "Your password was changed and every other session was signed out."), { required: false });
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
