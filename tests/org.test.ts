import { describe, expect, it, vi } from "vitest";
import { DevelopmentMailer } from "../src/lib/auth/mailer";
import { hashPassword } from "../src/lib/auth/password";
import { MemoryAuthStore, type UserRecord } from "../src/lib/auth/store";
import { hashToken } from "../src/lib/auth/tokens";
import { effectiveSubscription } from "../src/lib/org/runtime";
import { OrgFailure, createOrgService } from "../src/lib/org/service";
import { MemoryOrgStore } from "../src/lib/org/store";

const PASSWORD = "correct-horse-battery";
const SEATS = 4;

type Setup = Awaited<ReturnType<typeof setup>>;

async function setup() {
  const authStore = new MemoryAuthStore();
  const orgStore = new MemoryOrgStore();
  const mailer = new DevelopmentMailer({ log: false });
  const auth = { requestPasswordReset: vi.fn(async () => undefined), resendVerification: vi.fn(async () => undefined) };
  let clock = new Date("2026-10-30T10:00:00Z");
  const service = createOrgService({ orgStore, authStore, mailer, appUrl: "http://localhost:3000", auth, now: () => clock });
  const passwordHash = await hashPassword(PASSWORD);

  async function addUser(id: string, overrides: Partial<UserRecord> = {}): Promise<UserRecord> {
    const user: UserRecord = {
      id,
      email: `${id}@example.com`,
      name: `User ${id}`,
      passwordHash,
      emailVerifiedAt: new Date(),
      failedLogins: 0,
      lockedUntil: null,
      createdAt: new Date(),
      lastLoginAt: null,
      ...overrides,
    };
    await authStore.insertUser(user);
    return user;
  }

  async function addMember(id: string, orgId: string, opts: { role?: "super_admin" | "member"; seated?: boolean; status?: "active" | "deactivated" } = {}) {
    const user = await addUser(id);
    orgStore.putMembership({ userId: id, orgId, role: opts.role ?? "member", status: opts.status ?? "active", seated: opts.seated ?? false, invitedBy: null, createdAt: new Date() });
    return user;
  }

  orgStore.insertOrg({ id: "org1", name: "Acme", planStatus: "active", seatLimit: SEATS, createdAt: new Date() });
  orgStore.insertOrg({ id: "org2", name: "Other", planStatus: "active", seatLimit: SEATS, createdAt: new Date() });
  const admin = await addMember("admin", "org1", { role: "super_admin" });
  const members: UserRecord[] = [];
  for (let index = 1; index <= 6; index += 1) members.push(await addMember(`m${index}`, "org1"));
  const outsider = await addMember("outsider", "org2");

  return { authStore, orgStore, mailer, auth, service, admin, members, outsider, addUser, addMember, setClock: (date: Date) => (clock = date) };
}

async function expectFailure(promise: Promise<unknown>, code: OrgFailure["code"]) {
  await expect(promise).rejects.toMatchObject({ code });
}

describe("seats: 4 at a time", () => {
  it("never seats more than 4 members, even when requests arrive together", async () => {
    const { service, admin, members, orgStore } = await setup();
    const results = await Promise.allSettled(members.map((member) => service.setSeat(admin, member.id, true)));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(SEATS);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(members.length - SEATS);
    expect(orgStore.seatsUsed("org1")).toBe(SEATS);
  });

  it("refuses a fifth seat, leaves everything unchanged, and logs the attempt", async () => {
    const { service, admin, members, orgStore } = await setup();
    for (const member of members.slice(0, SEATS)) await service.setSeat(admin, member.id, true);
    await expectFailure(service.setSeat(admin, members[4].id, true), "seat_limit");
    expect(orgStore.getMembership(members[4].id)?.seated).toBe(false);
    expect(orgStore.seatsUsed("org1")).toBe(SEATS);
    const log = await service.listActivity(admin);
    expect(log[0]).toMatchObject({ action: "seat_give", result: "refused", targetId: members[4].id });
    expect(log[0].detail).toMatch(/All 4 seats are in use/);
  });

  it("moves a seat in one step, so the count stays at the limit", async () => {
    const { service, admin, members, orgStore } = await setup();
    for (const member of members.slice(0, SEATS)) await service.setSeat(admin, member.id, true);
    await service.swapSeat(admin, members[0].id, members[4].id);
    expect(orgStore.getMembership(members[0].id)?.seated).toBe(false);
    expect(orgStore.getMembership(members[4].id)?.seated).toBe(true);
    expect(orgStore.seatsUsed("org1")).toBe(SEATS);
  });

  it("refuses a swap that does not make sense", async () => {
    const { service, admin, members } = await setup();
    await service.setSeat(admin, members[0].id, true);
    await expectFailure(service.swapSeat(admin, members[1].id, members[2].id), "invalid_input");
    await expectFailure(service.swapSeat(admin, members[0].id, members[0].id), "invalid_input");
  });

  it("gives super admins no seat, and no seat to a deactivated member", async () => {
    const { service, admin, members } = await setup();
    await expectFailure(service.setSeat(admin, admin.id, true), "invalid_input");
    await service.deactivate(admin, members[0].id);
    await expectFailure(service.setSeat(admin, members[0].id, true), "conflict");
  });
});

describe("what each person can do", () => {
  it("describes access for every kind of account", async () => {
    const { service, admin, members, outsider, addUser, orgStore } = await setup();
    await service.setSeat(admin, members[0].id, true);
    await service.deactivate(admin, members[1].id);
    const solo = await addUser("solo");
    expect(service.getAccess(solo.id)).toEqual({ kind: "individual" });
    expect(service.getAccess(admin.id)).toEqual({ kind: "super_admin", orgId: "org1" });
    expect(service.getAccess(members[0].id)).toEqual({ kind: "seated", orgId: "org1", orgActive: true });
    expect(service.getAccess(members[2].id)).toEqual({ kind: "no_seat", orgId: "org1" });
    expect(service.getAccess(members[1].id)).toEqual({ kind: "deactivated", orgId: "org1" });
    orgStore.updateOrg("org2", { planStatus: "lapsed" });
    orgStore.putMembership({ ...orgStore.getMembership(outsider.id)!, seated: true });
    expect(service.getAccess(outsider.id)).toEqual({ kind: "seated", orgId: "org2", orgActive: false });
  });

  it("gives a seated member Pro through the organization, and Free when it lapses", async () => {
    const { service, admin, members } = await setup();
    await service.setSeat(admin, members[0].id, true);
    const seated = service.getAccess(members[0].id);
    expect(effectiveSubscription(members[0], seated)).toBe("active");
    expect(effectiveSubscription(members[0], { kind: "seated", orgId: "org1", orgActive: false })).toBe("free");
    expect(effectiveSubscription(members[2], service.getAccess(members[2].id))).toBe("free");
    expect(effectiveSubscription({ ...members[2], subscription: "active" }, { kind: "individual" })).toBe("active");
  });

  it("refuses every account action from someone who is not a super admin, and logs it", async () => {
    const { service, admin, members } = await setup();
    await expectFailure(service.listMembers(members[0]), "forbidden");
    await expectFailure(service.setSeat(members[0], members[1].id, true), "forbidden");
    await expectFailure(service.deactivate(members[0], members[1].id), "forbidden");
    const log = await service.listActivity(admin);
    expect(log.filter((entry) => entry.result === "denied").length).toBeGreaterThanOrEqual(3);
    expect(log.find((entry) => entry.actorId === members[0].id)).toBeTruthy();
  });

  it("logs a super admin who reaches for the platform", async () => {
    const { service, admin } = await setup();
    await service.recordDenied(admin, "platform_access", "POST /api/test-jobs");
    const log = await service.listActivity(admin);
    expect(log[0]).toMatchObject({ action: "platform_access", result: "denied", actorId: admin.id, detail: "POST /api/test-jobs" });
  });

  it("never reaches into another organization", async () => {
    const { service, admin, outsider } = await setup();
    await expectFailure(service.setSeat(admin, outsider.id, true), "not_found");
    await expectFailure(service.deactivate(admin, outsider.id), "not_found");
    await expectFailure(service.sendReset(admin, outsider.id), "not_found");
    await expectFailure(service.updateMember(admin, outsider.id, { name: "X" }), "not_found");
    await expectFailure(service.remove(admin, outsider.id, PASSWORD), "not_found");
    const list = await service.listMembers(admin);
    expect(list.members.map((member) => member.id)).not.toContain(outsider.id);
  });
});

describe("deactivating, reactivating and removing", () => {
  async function withSession(context: Setup, userId: string) {
    await context.authStore.insertSession({ tokenHash: `session-${userId}`, userId, createdAt: new Date(), lastSeenAt: new Date(), revokedAt: null });
  }

  it("ends every session and frees the seat in the same step", async () => {
    const context = await setup();
    const { service, admin, members, authStore, orgStore } = context;
    await service.setSeat(admin, members[0].id, true);
    await withSession(context, members[0].id);
    await service.deactivate(admin, members[0].id);
    expect((await authStore.findSession(`session-${members[0].id}`))?.revokedAt).not.toBeNull();
    expect(orgStore.getMembership(members[0].id)).toMatchObject({ status: "deactivated", seated: false });
    expect(orgStore.seatsUsed("org1")).toBe(0);
  });

  it("brings a deactivated member back without a seat", async () => {
    const { service, admin, members, orgStore } = await setup();
    await service.setSeat(admin, members[0].id, true);
    await service.deactivate(admin, members[0].id);
    await service.reactivate(admin, members[0].id);
    expect(orgStore.getMembership(members[0].id)).toMatchObject({ status: "active", seated: false });
  });

  it("removes a member from the organization and leaves a plain account", async () => {
    const context = await setup();
    const { service, admin, members, authStore } = context;
    await service.setSeat(admin, members[0].id, true);
    await withSession(context, members[0].id);
    await service.remove(admin, members[0].id, PASSWORD);
    expect(service.getAccess(members[0].id)).toEqual({ kind: "individual" });
    expect(await authStore.findUserById(members[0].id)).not.toBeNull();
    expect((await authStore.findSession(`session-${members[0].id}`))?.revokedAt).not.toBeNull();
  });
});

describe("the last super admin", () => {
  it("cannot be deactivated, removed or demoted", async () => {
    const { service, admin } = await setup();
    await expectFailure(service.deactivate(admin, admin.id), "last_super_admin");
    await expectFailure(service.remove(admin, admin.id, PASSWORD), "last_super_admin");
    await expectFailure(service.setRole(admin, admin.id, "member", PASSWORD), "last_super_admin");
    expect(service.getAccess(admin.id).kind).toBe("super_admin");
  });

  it("can step aside once another super admin exists", async () => {
    const { service, admin, members } = await setup();
    await service.setSeat(admin, members[0].id, true);
    await service.setRole(admin, members[0].id, "super_admin", PASSWORD);
    expect(service.getAccess(members[0].id).kind).toBe("super_admin");
    await service.setRole(members[0], admin.id, "member", PASSWORD);
    expect(service.getAccess(admin.id).kind).toBe("no_seat");
  });

  it("takes the seat from a member who becomes a super admin", async () => {
    const { service, admin, members, orgStore } = await setup();
    await service.setSeat(admin, members[0].id, true);
    await service.setRole(admin, members[0].id, "super_admin", PASSWORD);
    expect(orgStore.seatsUsed("org1")).toBe(0);
  });
});

describe("confirming with a password", () => {
  it("is needed for the sensitive actions, and the wrong password is refused", async () => {
    const { service, admin, members } = await setup();
    await expectFailure(service.remove(admin, members[0].id, undefined), "reauth_required");
    await expectFailure(service.remove(admin, members[0].id, "wrong-password-here"), "reauth_required");
    await expectFailure(service.signOutEverywhere(admin, members[0].id, ""), "reauth_required");
    await expectFailure(service.setRole(admin, members[0].id, "super_admin", "nope"), "reauth_required");
    await expectFailure(service.invite(admin, { name: "New Admin", email: "newadmin@example.com", role: "super_admin" }), "reauth_required");
    expect(service.getAccess(members[0].id).kind).not.toBe("individual");
  });

  it("is not needed for everyday actions", async () => {
    const { service, admin, members } = await setup();
    await service.setSeat(admin, members[0].id, true);
    await service.deactivate(admin, members[1].id);
    await service.unlock(admin, members[2].id);
  });
});

describe("inviting members", () => {
  async function inviteAndToken(context: Setup, email = "new.person@example.com") {
    await context.service.invite(context.admin, { name: "New Person", email });
    const mail = context.mailer.outbox.at(-1)!;
    return { mail, token: /token=([A-Za-z0-9_-]+)/.exec(mail.text)![1] };
  }

  it("emails a single-use link, and the person joins without a seat", async () => {
    const context = await setup();
    const { mail, token } = await inviteAndToken(context);
    expect(mail.to).toBe("new.person@example.com");
    expect(mail.text).toContain("/invite?token=");
    expect((await context.service.listMembers(context.admin)).invitations).toHaveLength(1);

    await context.service.acceptInvite(token, PASSWORD);
    const user = await context.authStore.findUserByEmail("new.person@example.com");
    expect(user?.emailVerifiedAt).not.toBeNull();
    expect(context.service.getAccess(user!.id)).toEqual({ kind: "no_seat", orgId: "org1" });
    expect((await context.service.listMembers(context.admin)).invitations).toHaveLength(0);
    await expectFailure(context.service.acceptInvite(token, PASSWORD), "invalid_input");
  });

  it("refuses an expired link, a weak password and an unknown token", async () => {
    const context = await setup();
    const { token } = await inviteAndToken(context);
    await expectFailure(context.service.acceptInvite(token, "short"), "invalid_input");
    await expectFailure(context.service.acceptInvite("not-a-token", PASSWORD), "invalid_input");
    context.setClock(new Date("2026-11-30T10:00:00Z"));
    await expectFailure(context.service.acceptInvite(token, PASSWORD), "invalid_input");
  });

  it("replaces an earlier invitation to the same address, and can cancel one", async () => {
    const context = await setup();
    const first = await inviteAndToken(context);
    const second = await inviteAndToken(context);
    await expectFailure(context.service.acceptInvite(first.token, PASSWORD), "invalid_input");
    const { invitations } = await context.service.listMembers(context.admin);
    expect(invitations).toHaveLength(1);
    await context.service.cancelInvitation(context.admin, invitations[0].id);
    await expectFailure(context.service.acceptInvite(second.token, PASSWORD), "invalid_input");
  });

  it("answers the same way for an address that has an account elsewhere, without sending anything", async () => {
    const context = await setup();
    const before = context.mailer.outbox.length;
    await expect(context.service.invite(context.admin, { name: "Other Org", email: context.outsider.email })).resolves.toBeUndefined();
    expect(context.mailer.outbox.length).toBe(before);
    expect((await context.service.listMembers(context.admin)).invitations).toHaveLength(0);
    await expectFailure(context.service.invite(context.admin, { name: "Dup", email: context.members[0].email }), "conflict");
  });

  it("checks the name and the address", async () => {
    const { service, admin } = await setup();
    await expectFailure(service.invite(admin, { name: "", email: "a@example.com" }), "invalid_input");
    await expectFailure(service.invite(admin, { name: "Ok", email: "not-an-email" }), "invalid_input");
  });
});

describe("helping with accounts", () => {
  it("sends a reset link to the member and never touches the password", async () => {
    const { service, admin, members, auth, authStore } = await setup();
    const before = (await authStore.findUserById(members[0].id))!.passwordHash;
    await service.sendReset(admin, members[0].id);
    expect(auth.requestPasswordReset).toHaveBeenCalledWith(members[0].email);
    expect((await authStore.findUserById(members[0].id))!.passwordHash).toBe(before);
  });

  it("clears a lockout", async () => {
    const { service, admin, members, authStore } = await setup();
    await authStore.updateUser(members[0].id, { failedLogins: 9, lockedUntil: new Date(Date.now() + 600000) });
    await service.unlock(admin, members[0].id);
    expect(await authStore.findUserById(members[0].id)).toMatchObject({ failedLogins: 0, lockedUntil: null });
  });

  it("fixes a name, and a new email address needs confirming again", async () => {
    const { service, admin, members, authStore, auth } = await setup();
    await service.updateMember(admin, members[0].id, { name: "Better Name" });
    expect((await authStore.findUserById(members[0].id))?.name).toBe("Better Name");
    await service.updateMember(admin, members[0].id, { email: "Renamed@Example.com" });
    const user = await authStore.findUserByEmail("renamed@example.com");
    expect(user).toMatchObject({ id: members[0].id, emailVerifiedAt: null });
    expect(await authStore.findUserByEmail(members[0].email)).toBeNull();
    expect(auth.resendVerification).toHaveBeenCalledWith(members[0].id);
    await expectFailure(service.updateMember(admin, members[0].id, { email: members[1].email }), "conflict");
  });
});

describe("the activity log", () => {
  it("records who did what to whom, newest first", async () => {
    const { service, admin, members } = await setup();
    await service.setSeat(admin, members[0].id, true);
    await service.deactivate(admin, members[0].id);
    const log = await service.listActivity(admin);
    expect(log.map((entry) => entry.action)).toEqual(["deactivate", "seat_give"]);
    expect(log[0]).toMatchObject({ actorId: admin.id, actorName: admin.name, targetId: members[0].id, targetName: members[0].name, result: "ok" });
    expect(new Date(log[0].at).toString()).not.toBe("Invalid Date");
  });

  it("keeps each organization's log to itself", async () => {
    const { service, admin, outsider } = await setup();
    await service.recordDenied(outsider, "platform_access", "other organization");
    const log = await service.listActivity(admin);
    expect(log.find((entry) => entry.actorId === outsider.id)).toBeUndefined();
  });

  it("uses hashed invitation tokens, never the token itself", async () => {
    const { service, admin, orgStore, mailer } = await setup();
    await service.invite(admin, { name: "Hash Check", email: "hash@example.com" });
    const token = /token=([A-Za-z0-9_-]+)/.exec(mailer.outbox.at(-1)!.text)![1];
    const stored = orgStore.listInvitations("org1")[0];
    expect(stored.tokenHash).toBe(hashToken(token));
    expect(JSON.stringify(stored)).not.toContain(token);
  });
});

describe("the organization plan lapsing", () => {
  it("keeps accounts and seat choices", async () => {
    const { service, admin, members, orgStore } = await setup();
    await service.setSeat(admin, members[0].id, true);
    orgStore.updateOrg("org1", { planStatus: "lapsed" });
    expect(service.getAccess(members[0].id)).toEqual({ kind: "seated", orgId: "org1", orgActive: false });
    orgStore.updateOrg("org1", { planStatus: "active" });
    expect(service.getAccess(members[0].id)).toEqual({ kind: "seated", orgId: "org1", orgActive: true });
  });
});
