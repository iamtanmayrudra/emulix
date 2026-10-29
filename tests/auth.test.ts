import { describe, expect, it } from "vitest";
import { DevelopmentMailer } from "../src/lib/auth/mailer";
import {
  DEV_ADMIN_USERNAME,
  DEV_ADMIN_PASSWORD,
  devSeedUsers,
} from "../src/lib/auth/dev-seed";
import { hashPassword, passwordPolicyError, verifyPassword } from "../src/lib/auth/password";
import {
  AuthFailure,
  LOCKOUT_THRESHOLD,
  LOCKOUT_MS,
  RESET_TOKEN_TTL_MS,
  SESSION_IDLE_MS,
  VERIFY_TOKEN_TTL_MS,
  createAuthService,
} from "../src/lib/auth/service";
import { MemoryAuthStore } from "../src/lib/auth/store";
import { hashToken } from "../src/lib/auth/tokens";

const PASSWORD = "correct horse battery";
const NEW_PASSWORD = "a brand new passphrase";
const APP_URL = "http://test.local";

function setup() {
  let clock = new Date("2026-10-15T10:00:00Z");
  const store = new MemoryAuthStore();
  const mailer = new DevelopmentMailer({ log: false });
  const service = createAuthService({ store, mailer, appUrl: APP_URL, now: () => clock });
  return {
    store,
    mailer,
    service,
    advance(ms: number) {
      clock = new Date(clock.getTime() + ms);
    },
  };
}

/** Pulls the token out of the last email sent. */
function lastToken(mailer: DevelopmentMailer): string {
  const text = mailer.outbox[mailer.outbox.length - 1].text;
  const match = text.match(/token=([A-Za-z0-9_-]+)/);
  if (!match) throw new Error("No token in email");
  return match[1];
}

async function signUpAndVerify(ctx: ReturnType<typeof setup>, email = "ana@example.com") {
  await ctx.service.signUp({ email, name: "Ana", password: PASSWORD });
  const sessionToken = await ctx.service.verifyEmail(lastToken(ctx.mailer));
  return sessionToken;
}

describe("password policy", () => {
  it("rejects passwords shorter than 12 characters", () => {
    expect(passwordPolicyError("short")).toMatch(/at least 12/);
  });

  it("rejects whitespace-only passwords", () => {
    expect(passwordPolicyError(" ".repeat(14))).toMatch(/only spaces/);
  });

  it("accepts a valid passphrase", () => {
    expect(passwordPolicyError(PASSWORD)).toBeNull();
  });
});

describe("password hashing", () => {
  it("verifies the right password and rejects the wrong one", async () => {
    const stored = await hashPassword(PASSWORD);
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(stored).not.toContain(PASSWORD);
    expect(await verifyPassword(PASSWORD, stored)).toBe(true);
    expect(await verifyPassword("wrong password here", stored)).toBe(false);
  });

  it("rejects malformed stored values", async () => {
    expect(await verifyPassword(PASSWORD, "not-a-hash")).toBe(false);
  });
});

describe("token hashing", () => {
  it("stores a digest, not the raw token", () => {
    expect(hashToken("abc")).not.toBe("abc");
    expect(hashToken("abc")).toBe(hashToken("abc"));
  });
});

describe("sign-up and email verification", () => {
  it("creates an unverified account and sends a verification link", async () => {
    const ctx = setup();
    await ctx.service.signUp({ email: " Ana@Example.com ", name: "Ana", password: PASSWORD });

    const user = await ctx.store.findUserByEmail("ana@example.com");
    expect(user).not.toBeNull();
    expect(user?.emailVerifiedAt).toBeNull();
    expect(user?.passwordHash).not.toContain(PASSWORD);
    expect(ctx.mailer.outbox).toHaveLength(1);
    expect(ctx.mailer.outbox[0].text).toContain(`${APP_URL}/verify-email?token=`);
  });

  it("returns the same result for an existing email and sends nothing new", async () => {
    const ctx = setup();
    await ctx.service.signUp({ email: "ana@example.com", name: "Ana", password: PASSWORD });
    await expect(
      ctx.service.signUp({ email: "ana@example.com", name: "Someone", password: NEW_PASSWORD }),
    ).resolves.toBeUndefined();
    expect(ctx.mailer.outbox).toHaveLength(1);
    const user = await ctx.store.findUserByEmail("ana@example.com");
    expect(user?.name).toBe("Ana");
  });

  it("rejects an invalid email and a weak password", async () => {
    const ctx = setup();
    await expect(
      ctx.service.signUp({ email: "not-an-email", name: "Ana", password: PASSWORD }),
    ).rejects.toMatchObject({ code: "invalid_input" });
    await expect(
      ctx.service.signUp({ email: "ana@example.com", name: "Ana", password: "short" }),
    ).rejects.toMatchObject({ code: "weak_password" });
  });

  it("verifies the email, signs the user in, and makes the token single use", async () => {
    const ctx = setup();
    await ctx.service.signUp({ email: "ana@example.com", name: "Ana", password: PASSWORD });
    const token = lastToken(ctx.mailer);

    const sessionToken = await ctx.service.verifyEmail(token);
    expect(sessionToken).toBeTruthy();
    expect((await ctx.store.findUserByEmail("ana@example.com"))?.emailVerifiedAt).not.toBeNull();
    await expect(ctx.service.verifyEmail(token)).rejects.toBeInstanceOf(AuthFailure);
  });

  it("rejects a verification link after it expires", async () => {
    const ctx = setup();
    await ctx.service.signUp({ email: "ana@example.com", name: "Ana", password: PASSWORD });
    const token = lastToken(ctx.mailer);
    ctx.advance(VERIFY_TOKEN_TTL_MS + 1);
    await expect(ctx.service.verifyEmail(token)).rejects.toMatchObject({ code: "invalid_token" });
  });
});

describe("login and lockout", () => {
  it("lets an unverified user sign in (the app then asks them to verify)", async () => {
    const ctx = setup();
    await ctx.service.signUp({ email: "ana@example.com", name: "Ana", password: PASSWORD });
    const result = await ctx.service.login({ email: "ana@example.com", password: PASSWORD });
    expect(result.user.emailVerifiedAt).toBeNull();
  });

  it("gives the same error for a wrong password and an unknown email", async () => {
    const ctx = setup();
    await signUpAndVerify(ctx);
    const wrongPassword = await ctx.service
      .login({ email: "ana@example.com", password: "wrong password here" })
      .catch((e: AuthFailure) => e);
    const unknownEmail = await ctx.service
      .login({ email: "nobody@example.com", password: "wrong password here" })
      .catch((e: AuthFailure) => e);
    expect(wrongPassword).toMatchObject({ code: "invalid_credentials" });
    expect(unknownEmail).toMatchObject({ code: "invalid_credentials" });
    expect((wrongPassword as Error).message).toBe((unknownEmail as Error).message);
  });

  it("locks the account after repeated failures and unlocks after the lock period", async () => {
    const ctx = setup();
    await signUpAndVerify(ctx);

    for (let i = 0; i < LOCKOUT_THRESHOLD; i++) {
      await expect(
        ctx.service.login({ email: "ana@example.com", password: "wrong password here" }),
      ).rejects.toMatchObject({ code: "invalid_credentials" });
    }

    await expect(
      ctx.service.login({ email: "ana@example.com", password: PASSWORD }),
    ).rejects.toMatchObject({ code: "account_locked" });

    ctx.advance(LOCKOUT_MS + 1);
    const result = await ctx.service.login({ email: "ana@example.com", password: PASSWORD });
    expect(result.sessionToken).toBeTruthy();
  });
});

describe("sessions", () => {
  it("returns the user for a valid session and nothing after logout", async () => {
    const ctx = setup();
    const sessionToken = await signUpAndVerify(ctx);
    expect((await ctx.service.getSessionUser(sessionToken))?.email).toBe("ana@example.com");

    await ctx.service.logout(sessionToken);
    expect(await ctx.service.getSessionUser(sessionToken)).toBeNull();
  });

  it("ends a session after 14 idle days, but keeps it alive while in use", async () => {
    const ctx = setup();
    const sessionToken = await signUpAndVerify(ctx);

    ctx.advance(SESSION_IDLE_MS - 1000);
    expect(await ctx.service.getSessionUser(sessionToken)).not.toBeNull();
    ctx.advance(SESSION_IDLE_MS - 1000);
    expect(await ctx.service.getSessionUser(sessionToken)).not.toBeNull();
    ctx.advance(SESSION_IDLE_MS + 1000);
    expect(await ctx.service.getSessionUser(sessionToken)).toBeNull();
  });

  it("ends a session after 30 days even if it stays active", async () => {
    const ctx = setup();
    const sessionToken = await signUpAndVerify(ctx);

    for (let day = 0; day < 4; day++) {
      ctx.advance(10 * 24 * 60 * 60 * 1000 - 1000);
      await ctx.service.getSessionUser(sessionToken);
    }
    expect(await ctx.service.getSessionUser(sessionToken)).toBeNull();
  });
});

describe("development admin account", () => {
  it("is seeded as a verified account that signs in with admin / admin", async () => {
    const store = new MemoryAuthStore(devSeedUsers());
    const service = createAuthService({ store, mailer: new DevelopmentMailer({ log: false }), appUrl: APP_URL });

    const result = await service.login({ email: DEV_ADMIN_USERNAME, password: DEV_ADMIN_PASSWORD });
    expect(result.user.emailVerifiedAt).not.toBeNull();
    expect(await service.getSessionUser(result.sessionToken)).not.toBeNull();
  });

  it("is not seeded in production", () => {
    const env = process.env as Record<string, string | undefined>;
    const original = env.NODE_ENV;
    env.NODE_ENV = "production";
    try {
      expect(devSeedUsers()).toEqual([]);
    } finally {
      env.NODE_ENV = original;
    }
  });
});

describe("password reset", () => {
  it("does nothing visible for an unknown email", async () => {
    const ctx = setup();
    await expect(ctx.service.requestPasswordReset("nobody@example.com")).resolves.toBeUndefined();
    expect(ctx.mailer.outbox).toHaveLength(0);
  });

  it("resets the password once, signs out other sessions, and rejects the old password", async () => {
    const ctx = setup();
    const otherSession = await signUpAndVerify(ctx);
    const current = (await ctx.service.login({ email: "ana@example.com", password: PASSWORD })).sessionToken;

    await ctx.service.requestPasswordReset("ana@example.com");
    const token = lastToken(ctx.mailer);
    await ctx.service.resetPassword(token, NEW_PASSWORD);

    await expect(
      ctx.service.login({ email: "ana@example.com", password: PASSWORD }),
    ).rejects.toMatchObject({ code: "invalid_credentials" });
    expect(
      (await ctx.service.login({ email: "ana@example.com", password: NEW_PASSWORD })).user.email,
    ).toBe("ana@example.com");
    expect(await ctx.service.getSessionUser(otherSession)).toBeNull();
    expect(await ctx.service.getSessionUser(current)).toBeNull();
    await expect(ctx.service.resetPassword(token, NEW_PASSWORD)).rejects.toMatchObject({
      code: "invalid_token",
    });
  });

  it("rejects a reset link after it expires", async () => {
    const ctx = setup();
    await signUpAndVerify(ctx);
    await ctx.service.requestPasswordReset("ana@example.com");
    const token = lastToken(ctx.mailer);
    ctx.advance(RESET_TOKEN_TTL_MS + 1);
    await expect(ctx.service.resetPassword(token, NEW_PASSWORD)).rejects.toMatchObject({
      code: "invalid_token",
    });
  });

  it("does not accept a verification token as a reset token", async () => {
    const ctx = setup();
    await ctx.service.signUp({ email: "ana@example.com", name: "Ana", password: PASSWORD });
    const verifyToken = lastToken(ctx.mailer);
    await expect(ctx.service.resetPassword(verifyToken, NEW_PASSWORD)).rejects.toMatchObject({
      code: "invalid_token",
    });
  });
});
