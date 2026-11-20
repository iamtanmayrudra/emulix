import { afterEach, describe, expect, it, vi } from "vitest";
import { DevelopmentMailer } from "../src/lib/auth/mailer";
import { AuthFailure, RESET_TOKEN_TTL_MS, VERIFY_TOKEN_TTL_MS, createAuthService, type Schedule } from "../src/lib/auth/service";
import { MemoryAuthStore } from "../src/lib/auth/store";
import { createEmailService, formatDuration } from "../src/lib/email/email.service";
import { ResendMailer, readEmailConfig, type ResendClient } from "../src/lib/email/resend";
import { EmailDeliveryError, type Mailer, type OutgoingEmail } from "../src/lib/email/types";

const PASSWORD = "correct horse battery";
const APP_URL = "http://test.local";
const KEY = "re_super_secret_key_123";

afterEach(() => vi.restoreAllMocks());

/** A provider that always refuses, like a bad key or an unverified sender. */
class FailingMailer implements Mailer {
  attempts = 0;
  async send(): Promise<never> {
    this.attempts += 1;
    throw new EmailDeliveryError("Resend refused the email: validation_error: The from address is not verified.");
  }
}

function setup(mailer: Mailer = new DevelopmentMailer({ log: false })) {
  let clock = new Date("2026-10-15T10:00:00Z");
  const store = new MemoryAuthStore();
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

function outbox(mailer: Mailer): OutgoingEmail[] {
  return (mailer as DevelopmentMailer).outbox;
}

function tokenIn(email: OutgoingEmail): string {
  const match = /token=([A-Za-z0-9_-]+)/.exec(email.text);
  if (!match) throw new Error("No token in email");
  return match[1];
}

describe("readEmailConfig", () => {
  it("needs both the key and the sender", () => {
    expect(readEmailConfig({ RESEND_API_KEY: KEY, EMAIL_FROM: "Emulix <auth@example.com>" })).toEqual({ apiKey: KEY, from: "Emulix <auth@example.com>" });
    expect(readEmailConfig({ RESEND_API_KEY: "", EMAIL_FROM: "" })).toBeNull();
    expect(readEmailConfig({})).toBeNull();
  });

  it("says so when the key is set without a sender", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(readEmailConfig({ RESEND_API_KEY: KEY })).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("EMAIL_FROM"));
    expect(warn.mock.calls.flat().join(" ")).not.toContain(KEY);
  });
});

describe("ResendMailer", () => {
  const message = { to: "ana@example.com", subject: "Hi", text: "Hello", html: "<p>Hello</p>" };

  it("sends from the configured sender and returns the provider message id", async () => {
    const send = vi.fn().mockResolvedValue({ data: { id: "msg_1" }, error: null });
    const result = await new ResendMailer({ emails: { send } } as ResendClient, "Emulix <auth@example.com>").send(message);
    expect(result).toEqual({ id: "msg_1" });
    expect(send).toHaveBeenCalledWith({ from: "Emulix <auth@example.com>", ...message });
  });

  it("turns a refusal into an EmailDeliveryError", async () => {
    const send = vi.fn().mockResolvedValue({ data: null, error: { name: "validation_error", message: "Sender not verified" } });
    await expect(new ResendMailer({ emails: { send } }, "x@example.com").send(message)).rejects.toThrow(EmailDeliveryError);
  });

  it("turns a network failure into an EmailDeliveryError", async () => {
    const send = vi.fn().mockRejectedValue(new Error("fetch failed"));
    await expect(new ResendMailer({ emails: { send } }, "x@example.com").send(message)).rejects.toThrow(/could not be reached/);
  });
});

describe("email service", () => {
  it("renders an HTML and a plain-text body that both carry the link", async () => {
    const mailer = new DevelopmentMailer({ log: false });
    const store = new MemoryAuthStore();
    const emails = createEmailService({ mailer, log: store, appUrl: APP_URL });
    await emails.sendVerificationEmail({ userId: "u1", email: "ana@example.com", name: "Ana" }, "TOKEN123", VERIFY_TOKEN_TTL_MS);

    const [mail] = mailer.outbox;
    expect(mail.subject).toBe("Verify your Emulix Optimizer account");
    expect(mail.html).toContain("Hello Ana,");
    expect(mail.html).toContain(`${APP_URL}/verify-email?token=TOKEN123`);
    expect(mail.text).toContain(`${APP_URL}/verify-email?token=TOKEN123`);
    expect(mail.text).toContain("expires in 1 hour");
  });

  it("escapes the person's name in the HTML", async () => {
    const mailer = new DevelopmentMailer({ log: false });
    const emails = createEmailService({ mailer, log: new MemoryAuthStore(), appUrl: APP_URL });
    await emails.sendWelcomeEmail({ userId: "u1", email: "ana@example.com", name: "<script>alert(1)</script>" });
    expect(mailer.outbox[0].html).not.toContain("<script>alert(1)</script>");
    expect(mailer.outbox[0].html).toContain("&lt;script&gt;");
  });

  it("logs the attempt with the provider message id and never the link", async () => {
    const store = new MemoryAuthStore();
    const emails = createEmailService({ mailer: new DevelopmentMailer({ log: false }), log: store, appUrl: APP_URL });
    await emails.sendPasswordResetEmail({ userId: "u1", email: "ana@example.com", name: "Ana" }, "SECRETTOKEN", RESET_TOKEN_TTL_MS);

    const [row] = await store.findEmailLogs("u1");
    expect(row).toMatchObject({ type: "PASSWORD_RESET", recipient: "ana@example.com", status: "SENT", providerMessageId: "dev-1", error: null });
    expect(row.sentAt).toBeInstanceOf(Date);
    expect(JSON.stringify(row)).not.toContain("SECRETTOKEN");
  });

  it("marks the log FAILED and throws EmailDeliveryError when the provider refuses", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const store = new MemoryAuthStore();
    const emails = createEmailService({ mailer: new FailingMailer(), log: store, appUrl: APP_URL });
    await expect(emails.sendWelcomeEmail({ userId: "u1", email: "ana@example.com", name: "Ana" })).rejects.toThrow(EmailDeliveryError);

    const [row] = await store.findEmailLogs("u1");
    expect(row.status).toBe("FAILED");
    expect(row.error).toContain("not verified");
    expect(row.sentAt).toBeNull();
  });

  it("wraps an unexpected mailer error so callers see one error type", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const broken: Mailer = { send: async () => Promise.reject(new Error("boom")) };
    const emails = createEmailService({ mailer: broken, log: new MemoryAuthStore(), appUrl: APP_URL });
    await expect(emails.sendWelcomeEmail({ userId: "u1", email: "a@example.com", name: "A" })).rejects.toThrow(EmailDeliveryError);
  });

  it("still sends when the log cannot be written", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const mailer = new DevelopmentMailer({ log: false });
    const brokenLog = { insertEmailLog: async () => Promise.reject(new Error("db down")), updateEmailLog: async () => Promise.reject(new Error("db down")) };
    await createEmailService({ mailer, log: brokenLog, appUrl: APP_URL }).sendWelcomeEmail({ userId: "u1", email: "a@example.com", name: "A" });
    expect(mailer.outbox).toHaveLength(1);
  });

  it("formats durations for the expiry line", () => {
    expect(formatDuration(30 * 60 * 1000)).toBe("30 minutes");
    expect(formatDuration(60 * 60 * 1000)).toBe("1 hour");
    expect(formatDuration(2 * 60 * 60 * 1000)).toBe("2 hours");
  });
});

describe("a site with no public URL configured", () => {
  // Production without APP_URL used to throw while the service was built, so login and sign-up returned 500 for everyone.
  const missing = () => {
    throw new Error("APP_URL is not set.");
  };

  function setupWithoutUrl() {
    const store = new MemoryAuthStore();
    const mailer = new DevelopmentMailer({ log: false });
    return { store, mailer, service: createAuthService({ store, mailer, appUrl: missing }) };
  }

  it("still builds the service, signs people up and lets them sign in", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { service } = setupWithoutUrl();
    await expect(service.signUp({ email: "ana@example.com", name: "Ana", password: PASSWORD }, (task) => void task())).resolves.toBeUndefined();
    await expect(service.login({ email: "ana@example.com", password: PASSWORD })).resolves.toMatchObject({ user: { email: "ana@example.com" } });
  });

  it("still answers validation errors with a 400-style failure, not a crash", async () => {
    const { service } = setupWithoutUrl();
    await expect(service.signUp({ email: "nope", name: "Ana", password: PASSWORD })).rejects.toBeInstanceOf(AuthFailure);
  });

  it("fails only the email, records it, and sends nothing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { store, mailer, service } = setupWithoutUrl();
    await expect(service.signUp({ email: "ana@example.com", name: "Ana", password: PASSWORD })).rejects.toBeInstanceOf(EmailDeliveryError);

    const user = (await store.findUserByEmail("ana@example.com"))!;
    const [row] = await store.findEmailLogs(user.id);
    expect(row).toMatchObject({ type: "VERIFICATION", status: "FAILED" });
    expect(row.error).toContain("APP_URL");
    expect(mailer.outbox).toHaveLength(0);
  });
});

describe("account emails", () => {
  it("expires the verification link after an hour, inside the plan's 30 to 60 minutes", () => {
    expect(VERIFY_TOKEN_TTL_MS).toBe(60 * 60 * 1000);
    expect(RESET_TOKEN_TTL_MS).toBeLessThanOrEqual(30 * 60 * 1000);
  });

  it("only the newest verification link works after a resend", async () => {
    const ctx = setup();
    await ctx.service.signUp({ email: "ana@example.com", name: "Ana", password: PASSWORD });
    const first = tokenIn(outbox(ctx.mailer)[0]);
    const user = (await ctx.store.findUserByEmail("ana@example.com"))!;
    await ctx.service.resendVerification(user.id);
    const second = tokenIn(outbox(ctx.mailer)[1]);

    await expect(ctx.service.verifyEmail(first)).rejects.toMatchObject({ code: "invalid_token" });
    await expect(ctx.service.verifyEmail(second)).resolves.toBeTypeOf("string");
  });

  it("only the newest reset link works after a second request", async () => {
    const ctx = setup();
    await ctx.service.signUp({ email: "ana@example.com", name: "Ana", password: PASSWORD });
    await ctx.service.requestPasswordReset("ana@example.com");
    await ctx.service.requestPasswordReset("ana@example.com");
    const [, firstReset, secondReset] = outbox(ctx.mailer);

    await expect(ctx.service.resetPassword(tokenIn(firstReset), "a brand new passphrase")).rejects.toBeInstanceOf(AuthFailure);
    await expect(ctx.service.resetPassword(tokenIn(secondReset), "a brand new passphrase")).resolves.toBeUndefined();
  });

  it("sends a welcome email the first time the address is verified, and not again", async () => {
    const ctx = setup();
    await ctx.service.signUp({ email: "ana@example.com", name: "Ana", password: PASSWORD });
    const user = (await ctx.store.findUserByEmail("ana@example.com"))!;
    await ctx.service.verifyEmail(tokenIn(outbox(ctx.mailer)[0]));
    expect(outbox(ctx.mailer).map((mail) => mail.subject)).toEqual(["Verify your Emulix Optimizer account", "Welcome to Emulix Optimizer"]);

    // Already verified, so a later link adds no second welcome.
    await ctx.service.resendVerification(user.id);
    expect(outbox(ctx.mailer)).toHaveLength(2);
    expect((await ctx.store.findEmailLogs(user.id)).map((row) => row.type)).toEqual(["WELCOME", "VERIFICATION"]);
  });

  it("sends a security alert when the password is changed", async () => {
    const ctx = setup();
    await ctx.service.signUp({ email: "ana@example.com", name: "Ana", password: PASSWORD });
    await ctx.service.requestPasswordReset("ana@example.com");
    await ctx.service.resetPassword(tokenIn(outbox(ctx.mailer)[1]), "a brand new passphrase");

    const alert = outbox(ctx.mailer).at(-1)!;
    expect(alert.subject).toBe("Security alert for your Emulix Optimizer account");
    expect(alert.text).toContain("Your password was changed");
    expect(alert.text).toContain(`${APP_URL}/forgot-password`);
  });

  it("sends a security alert when the account locks", async () => {
    const ctx = setup();
    await ctx.service.signUp({ email: "ana@example.com", name: "Ana", password: PASSWORD });
    for (let i = 0; i < 10; i += 1) {
      await ctx.service.login({ email: "ana@example.com", password: "wrong wrong wrong" }).catch(() => undefined);
    }
    const alerts = outbox(ctx.mailer).filter((mail) => mail.subject.startsWith("Security alert"));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].text).toContain("locked");
  }, 20000);

  it("defers sending when a schedule is given, so the response does not wait for the provider", async () => {
    const ctx = setup();
    const queued: Array<() => Promise<void>> = [];
    const schedule: Schedule = (task) => queued.push(task);

    await ctx.service.signUp({ email: "ana@example.com", name: "Ana", password: PASSWORD }, schedule);
    expect(outbox(ctx.mailer)).toHaveLength(0);
    expect(queued).toHaveLength(1);
    await queued[0]();
    expect(outbox(ctx.mailer)).toHaveLength(1);
  });

  it("answers sign-up the same way when the provider fails, and records the failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const mailer = new FailingMailer();
    const ctx = setup(mailer);
    const queued: Array<() => Promise<void>> = [];

    await expect(ctx.service.signUp({ email: "ana@example.com", name: "Ana", password: PASSWORD }, (task) => queued.push(task))).resolves.toBeUndefined();
    await expect(queued[0]()).resolves.toBeUndefined();

    const user = (await ctx.store.findUserByEmail("ana@example.com"))!;
    expect(user).toBeTruthy();
    expect((await ctx.store.findEmailLogs(user.id))[0].status).toBe("FAILED");
  });

  it("raises EmailDeliveryError for a direct caller, such as resend-verification", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const ctx = setup(new FailingMailer());
    await ctx.store.insertUser({
      id: "u1", email: "ana@example.com", name: "Ana", passwordHash: "x", emailVerifiedAt: null,
      failedLogins: 0, lockedUntil: null, createdAt: new Date(), lastLoginAt: null,
    });
    await expect(ctx.service.resendVerification("u1")).rejects.toBeInstanceOf(EmailDeliveryError);
  });

  it("does not fail the password reset when the alert email cannot be sent", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const good = new DevelopmentMailer({ log: false });
    const ctx = setup(good);
    await ctx.service.signUp({ email: "ana@example.com", name: "Ana", password: PASSWORD });
    await ctx.service.requestPasswordReset("ana@example.com");
    const token = tokenIn(outbox(good)[1]);

    // The provider goes down just before the reset completes.
    good.send = async () => Promise.reject(new EmailDeliveryError());
    await expect(ctx.service.resetPassword(token, "a brand new passphrase")).resolves.toBeUndefined();
    await expect(ctx.service.login({ email: "ana@example.com", password: "a brand new passphrase" })).resolves.toBeTruthy();
  });
});
