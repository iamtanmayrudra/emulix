import { describe, expect, it, vi } from "vitest";
import { updateOwnProfile } from "../src/lib/auth/profile";
import { hashPassword } from "../src/lib/auth/password";
import { AuthFailure } from "../src/lib/auth/service";
import { MemoryAuthStore, type UserRecord } from "../src/lib/auth/store";

async function setup() {
  const store = new MemoryAuthStore();
  const passwordHash = await hashPassword("current-password-1");
  const user: UserRecord = {
    id: "u1",
    email: "ana@example.com",
    name: "Ana",
    passwordHash,
    emailVerifiedAt: new Date("2026-01-01T00:00:00Z"),
    failedLogins: 0,
    lockedUntil: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    lastLoginAt: null,
  };
  await store.insertUser(user);
  await store.insertUser({ ...user, id: "u2", email: "taken@example.com", name: "Other" });
  const resendVerification = vi.fn(async () => undefined);
  return { store, user, resendVerification, deps: () => ({ store, resendVerification }) };
}

async function expectFailure(promise: Promise<unknown>, message: RegExp) {
  await expect(promise).rejects.toBeInstanceOf(AuthFailure);
  await expect(promise).rejects.toThrow(message);
}

describe("editing your own profile", () => {
  it("changes the name without needing a password, and sends no email", async () => {
    const { user, store, deps, resendVerification } = await setup();
    const updated = await updateOwnProfile(deps(), user, { name: "  Ana Maria  " });
    expect(updated.name).toBe("Ana Maria");
    expect((await store.findUserById("u1"))?.name).toBe("Ana Maria");
    expect(resendVerification).not.toHaveBeenCalled();
    expect(updated.emailVerifiedAt).not.toBeNull();
  });

  it("refuses an empty or very long name", async () => {
    const { user, deps } = await setup();
    await expectFailure(updateOwnProfile(deps(), user, { name: "   " }), /between 1 and 80/);
    await expectFailure(updateOwnProfile(deps(), user, { name: "x".repeat(81) }), /between 1 and 80/);
  });

  it("needs the current password to change the email", async () => {
    const { user, deps, store } = await setup();
    await expectFailure(updateOwnProfile(deps(), user, { email: "ana.new@example.com" }), /current password/);
    await expectFailure(updateOwnProfile(deps(), user, { email: "ana.new@example.com", password: "wrong-password-1" }), /not correct/);
    expect((await store.findUserById("u1"))?.email).toBe("ana@example.com");
  });

  it("moves the email, unverifies it and sends a new confirmation", async () => {
    const { user, deps, store, resendVerification } = await setup();
    const updated = await updateOwnProfile(deps(), user, { email: "  ANA.New@Example.com ", password: "current-password-1" });
    expect(updated.email).toBe("ana.new@example.com");
    expect(await store.findUserByEmail("ana@example.com")).toBeNull();
    expect((await store.findUserByEmail("ana.new@example.com"))?.id).toBe("u1");
    expect(updated.emailVerifiedAt).toBeNull();
    expect(resendVerification).toHaveBeenCalledWith("u1");
  });

  it("refuses an address that another account already uses", async () => {
    const { user, deps, resendVerification } = await setup();
    await expectFailure(updateOwnProfile(deps(), user, { email: "taken@example.com", password: "current-password-1" }), /already in use/);
    expect(resendVerification).not.toHaveBeenCalled();
  });

  it("refuses a malformed email, and an unchanged email needs no password", async () => {
    const { user, deps } = await setup();
    await expectFailure(updateOwnProfile(deps(), user, { email: "not-an-email" }), /valid email/);
    const same = await updateOwnProfile(deps(), user, { email: "ANA@example.com" });
    expect(same.email).toBe("ana@example.com");
  });
});

describe("accounts whose sign-in is not an email address", () => {
  it("still lets the name change when the email is sent back unchanged", async () => {
    const store = new MemoryAuthStore();
    const user: UserRecord = {
      id: "dev-free", email: "free", name: "Free User", passwordHash: await hashPassword("free-password-1"),
      emailVerifiedAt: new Date(), failedLogins: 0, lockedUntil: null, createdAt: new Date(), lastLoginAt: null,
    };
    await store.insertUser(user);
    const updated = await updateOwnProfile({ store, resendVerification: vi.fn(async () => undefined) }, user, { name: "Renamed", email: "free" });
    expect(updated).toMatchObject({ name: "Renamed", email: "free" });
  });
});
