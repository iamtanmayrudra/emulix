import { randomUUID } from "node:crypto";
import type { Mailer } from "../auth/mailer";
import { hashPassword, passwordPolicyError, verifyPassword } from "../auth/password";
import { isValidEmail, normalizeEmail } from "../auth/service";
import type { AuthStore, UserRecord } from "../auth/store";
import { generateToken, hashToken } from "../auth/tokens";
import type { MemoryOrgStore } from "./store";
import type { Access, ActivityEntry, ActivityResult, Membership, MemberList, MemberRow, OrgRole } from "./types";

const DAY = 24 * 60 * 60 * 1000;
export const INVITATION_TTL_MS = 7 * DAY;

export type OrgErrorCode = "forbidden" | "not_found" | "seat_limit" | "invalid_input" | "conflict" | "last_super_admin" | "reauth_required";

/** Errors that are safe to show to the person who caused them. Routes map the code to an HTTP status. */
export class OrgFailure extends Error {
  constructor(
    readonly code: OrgErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export type OrgDeps = {
  orgStore: MemoryOrgStore;
  authStore: AuthStore;
  mailer: Mailer;
  appUrl: string;
  /** The parts of the auth service the super admin may trigger. Neither exposes a password. */
  auth: {
    requestPasswordReset(email: string): Promise<void>;
    resendVerification(userId: string): Promise<void>;
  };
  now?: () => Date;
};

export const OUTSIDE_ROLE_MESSAGE = "This is outside what a super admin can do.";

/**
 * Everything the super admin can do, and nothing else (docs/SUPER_ADMIN.md, section 5). Each action first checks that the
 * caller is an active super admin, and that the target belongs to the same organization.
 */
export function createOrgService({ orgStore, authStore, mailer, appUrl, auth, now = () => new Date() }: OrgDeps) {
  async function nameOf(userId: string | null): Promise<string | null> {
    if (!userId) return null;
    return (await authStore.findUserById(userId))?.name ?? null;
  }

  async function log(orgId: string, actor: UserRecord, action: string, target: string | null, result: ActivityResult, detail: string | null = null) {
    const entry: ActivityEntry = {
      id: randomUUID(),
      orgId,
      at: now(),
      actorId: actor.id,
      actorName: actor.name,
      action,
      targetId: target,
      targetName: await nameOf(target),
      result,
      detail,
    };
    orgStore.appendActivity(entry);
  }

  /** The caller must be an active super admin. Anyone else is refused, and the attempt is logged when they belong to an organization. */
  async function adminOf(actor: UserRecord, action: string): Promise<Membership> {
    const membership = orgStore.getMembership(actor.id);
    if (!membership || membership.role !== "super_admin" || membership.status !== "active") {
      if (membership) await log(membership.orgId, actor, action, null, "denied", "Not a super admin");
      throw new OrgFailure("forbidden", "Only a super admin can do that.");
    }
    return membership;
  }

  /** A member of the caller's own organization. Anything else looks like it does not exist. */
  function targetIn(admin: Membership, id: string): Membership {
    const target = orgStore.getMembership(id);
    if (!target || target.orgId !== admin.orgId) throw new OrgFailure("not_found", "That member was not found.");
    return target;
  }

  /** Sensitive actions need the caller's password again. */
  async function confirmPassword(actor: UserRecord, password: unknown) {
    if (typeof password !== "string" || password.length === 0) {
      throw new OrgFailure("reauth_required", "Enter your password to confirm.");
    }
    if (!(await verifyPassword(password, actor.passwordHash))) {
      throw new OrgFailure("reauth_required", "That password is not correct.");
    }
  }

  async function refuse(admin: Membership, actor: UserRecord, action: string, target: string | null, failure: OrgFailure): Promise<never> {
    await log(admin.orgId, actor, action, target, "refused", failure.message);
    throw failure;
  }

  function lastSuperAdminFailure() {
    return new OrgFailure("last_super_admin", "An organization needs at least one super admin. Add another one first.");
  }

  function validName(value: unknown): string {
    const name = typeof value === "string" ? value.trim() : "";
    if (name.length < 1 || name.length > 80) throw new OrgFailure("invalid_input", "Enter a name between 1 and 80 characters.");
    return name;
  }

  function validEmail(value: unknown): string {
    const email = typeof value === "string" ? normalizeEmail(value) : "";
    if (!isValidEmail(email)) throw new OrgFailure("invalid_input", "Enter a valid email address.");
    return email;
  }

  return {
    /** What a user may do in the platform, from their place in an organization. */
    getAccess(userId: string): Access {
      const membership = orgStore.getMembership(userId);
      if (!membership) return { kind: "individual" };
      if (membership.status === "deactivated") return { kind: "deactivated", orgId: membership.orgId };
      if (membership.role === "super_admin") return { kind: "super_admin", orgId: membership.orgId };
      if (!membership.seated) return { kind: "no_seat", orgId: membership.orgId };
      return { kind: "seated", orgId: membership.orgId, orgActive: orgStore.getOrg(membership.orgId)?.planStatus === "active" };
    },

    /** Records a refused attempt by a user who belongs to an organization, for example a super admin reaching for member data. */
    async recordDenied(actor: UserRecord, action: string, detail: string) {
      const membership = orgStore.getMembership(actor.id);
      if (membership) await log(membership.orgId, actor, action, null, "denied", detail);
    },

    async listMembers(actor: UserRecord): Promise<MemberList> {
      const admin = await adminOf(actor, "list_members");
      const org = orgStore.getOrg(admin.orgId);
      if (!org) throw new OrgFailure("not_found", "Organization not found.");

      const members: MemberRow[] = [];
      for (const membership of orgStore.listMemberships(admin.orgId)) {
        const user = await authStore.findUserById(membership.userId);
        if (!user) continue;
        members.push({
          id: user.id,
          name: user.name,
          email: user.email,
          role: membership.role,
          status: membership.status,
          seated: membership.seated,
          lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
        });
      }
      members.sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "super_admin" ? -1 : 1));

      const at = now();
      const invitations = orgStore
        .listInvitations(admin.orgId)
        .filter((invitation) => !invitation.usedAt && invitation.expiresAt > at)
        .map((invitation) => ({ id: invitation.id, name: invitation.name, email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt.toISOString() }));

      return { org: { name: org.name, seatLimit: org.seatLimit, seatsUsed: orgStore.seatsUsed(admin.orgId) }, members, invitations };
    },

    async invite(actor: UserRecord, input: { name: unknown; email: unknown; role?: unknown; password?: unknown }): Promise<void> {
      const admin = await adminOf(actor, "invite");
      const role: OrgRole = input.role === "super_admin" ? "super_admin" : "member";
      if (role === "super_admin") await confirmPassword(actor, input.password);
      const name = validName(input.name);
      const email = validEmail(input.email);

      const existing = await authStore.findUserByEmail(email);
      if (existing) {
        const membership = orgStore.getMembership(existing.id);
        if (membership?.orgId === admin.orgId) {
          throw new OrgFailure("conflict", "That person is already in your organization.");
        }
        // The account belongs elsewhere. The response is the same as for any other invitation, so it does not reveal that.
        await log(admin.orgId, actor, "invite", null, "ok", `Invitation requested for ${email}`);
        return;
      }

      // A new invitation to the same address replaces the old one.
      for (const old of orgStore.listInvitations(admin.orgId)) {
        if (old.email === email && !old.usedAt) orgStore.deleteInvitation(old.id);
      }

      const token = generateToken();
      const at = now();
      orgStore.putInvitation({
        id: randomUUID(),
        orgId: admin.orgId,
        email,
        name,
        role,
        tokenHash: hashToken(token),
        invitedBy: actor.id,
        createdAt: at,
        expiresAt: new Date(at.getTime() + INVITATION_TTL_MS),
        usedAt: null,
      });
      const orgName = orgStore.getOrg(admin.orgId)?.name ?? "your organization";
      await mailer.send({
        to: email,
        subject: `You have been invited to ${orgName} on Emulix`,
        text: `${actor.name} invited you to join ${orgName} on Emulix.\n\nChoose your password:\n\n${appUrl}/invite?token=${token}\n\nThis link works once and expires in 7 days.`,
      });
      await log(admin.orgId, actor, "invite", null, "ok", `Invitation requested for ${email}`);
    },

    async cancelInvitation(actor: UserRecord, invitationId: string): Promise<void> {
      const admin = await adminOf(actor, "cancel_invitation");
      const invitation = orgStore.getInvitation(invitationId);
      if (!invitation || invitation.orgId !== admin.orgId) throw new OrgFailure("not_found", "That invitation was not found.");
      orgStore.deleteInvitation(invitationId);
      await log(admin.orgId, actor, "cancel_invitation", null, "ok", `Cancelled the invitation for ${invitation.email}`);
    },

    /** The invited person opens the link and chooses a password. They join without a seat. */
    async acceptInvite(token: string, password: string): Promise<void> {
      const invitation = orgStore.findInvitationByTokenHash(hashToken(token));
      const at = now();
      if (!invitation || invitation.usedAt || invitation.expiresAt <= at) {
        throw new OrgFailure("invalid_input", "This invitation is invalid or has expired.");
      }
      const problem = passwordPolicyError(password);
      if (problem) throw new OrgFailure("invalid_input", problem);
      if (await authStore.findUserByEmail(invitation.email)) {
        throw new OrgFailure("invalid_input", "This invitation is invalid or has expired.");
      }

      const user: UserRecord = {
        id: randomUUID(),
        email: invitation.email,
        name: invitation.name,
        passwordHash: await hashPassword(password),
        // Opening the link sent to this address is proof of ownership.
        emailVerifiedAt: at,
        failedLogins: 0,
        lockedUntil: null,
        createdAt: at,
        lastLoginAt: null,
      };
      await authStore.insertUser(user);
      orgStore.putMembership({ userId: user.id, orgId: invitation.orgId, role: invitation.role, status: "active", seated: false, invitedBy: invitation.invitedBy, createdAt: at });
      orgStore.putInvitation({ ...invitation, usedAt: at });
      await log(invitation.orgId, user, "member_joined", user.id, "ok", `Accepted the invitation as ${invitation.role === "super_admin" ? "a super admin" : "a member"}`);
    },

    /** Gives a seat to an unseated member, or takes it away. The count and the change happen together, so the limit holds. */
    async setSeat(actor: UserRecord, memberId: string, seated: boolean): Promise<void> {
      const admin = await adminOf(actor, seated ? "seat_give" : "seat_take");
      const target = targetIn(admin, memberId);
      if (target.role !== "member") throw new OrgFailure("invalid_input", "Super admins do not use a seat.");
      if (target.status !== "active") throw new OrgFailure("conflict", "Reactivate this member first.");
      if (target.seated === seated) return;

      if (seated) {
        const org = orgStore.getOrg(admin.orgId);
        if (!org) throw new OrgFailure("not_found", "Organization not found.");
        if (orgStore.seatsUsed(admin.orgId) >= org.seatLimit) {
          await refuse(admin, actor, "seat_give", memberId, new OrgFailure("seat_limit", `All ${org.seatLimit} seats are in use. Take a seat from a member first.`));
        }
      }
      orgStore.putMembership({ ...target, seated });
      await log(admin.orgId, actor, seated ? "seat_give" : "seat_take", memberId, "ok");
    },

    /** Moves a seat from one member to another in one step, so the count never goes above the limit. */
    async swapSeat(actor: UserRecord, fromId: string, toId: string): Promise<void> {
      const admin = await adminOf(actor, "seat_swap");
      const from = targetIn(admin, fromId);
      const to = targetIn(admin, toId);
      if (from.role !== "member" || to.role !== "member" || !from.seated || to.seated || to.status !== "active") {
        throw new OrgFailure("invalid_input", "Choose a member with a seat and an active member without one.");
      }
      orgStore.putMembership({ ...from, seated: false });
      orgStore.putMembership({ ...to, seated: true });
      await log(admin.orgId, actor, "seat_swap", toId, "ok", `Seat moved from ${await nameOf(fromId)}`);
    },

    async deactivate(actor: UserRecord, memberId: string): Promise<void> {
      const admin = await adminOf(actor, "deactivate");
      const target = targetIn(admin, memberId);
      if (target.status === "deactivated") return;
      if (target.role === "super_admin" && orgStore.activeSuperAdmins(admin.orgId) <= 1) {
        await refuse(admin, actor, "deactivate", memberId, lastSuperAdminFailure());
      }
      orgStore.putMembership({ ...target, status: "deactivated", seated: false });
      await authStore.revokeUserSessions(memberId, now());
      await log(admin.orgId, actor, "deactivate", memberId, "ok");
    },

    async reactivate(actor: UserRecord, memberId: string): Promise<void> {
      const admin = await adminOf(actor, "reactivate");
      const target = targetIn(admin, memberId);
      if (target.status === "active") return;
      orgStore.putMembership({ ...target, status: "active", seated: false });
      await log(admin.orgId, actor, "reactivate", memberId, "ok");
    },

    /** Takes the account out of the organization. The person keeps a plain Free account. */
    async remove(actor: UserRecord, memberId: string, password: unknown): Promise<void> {
      const admin = await adminOf(actor, "member_remove");
      await confirmPassword(actor, password);
      const target = targetIn(admin, memberId);
      if (target.role === "super_admin" && target.status === "active" && orgStore.activeSuperAdmins(admin.orgId) <= 1) {
        await refuse(admin, actor, "member_remove", memberId, lastSuperAdminFailure());
      }
      const name = await nameOf(memberId);
      orgStore.deleteMembership(memberId);
      await authStore.revokeUserSessions(memberId, now());
      await log(admin.orgId, actor, "member_remove", memberId, "ok", `Removed ${name ?? "a member"} from the organization`);
    },

    /** Emails a reset link. The super admin never sees or sets the password. */
    async sendReset(actor: UserRecord, memberId: string): Promise<void> {
      const admin = await adminOf(actor, "reset_link");
      targetIn(admin, memberId);
      const user = await authStore.findUserById(memberId);
      if (!user) throw new OrgFailure("not_found", "That member was not found.");
      await auth.requestPasswordReset(user.email);
      await log(admin.orgId, actor, "reset_link", memberId, "ok");
    },

    async unlock(actor: UserRecord, memberId: string): Promise<void> {
      const admin = await adminOf(actor, "unlock");
      targetIn(admin, memberId);
      await authStore.updateUser(memberId, { failedLogins: 0, lockedUntil: null });
      await log(admin.orgId, actor, "unlock", memberId, "ok");
    },

    async signOutEverywhere(actor: UserRecord, memberId: string, password: unknown): Promise<void> {
      const admin = await adminOf(actor, "sign_out");
      await confirmPassword(actor, password);
      targetIn(admin, memberId);
      await authStore.revokeUserSessions(memberId, now());
      await log(admin.orgId, actor, "sign_out", memberId, "ok");
    },

    /** Fixes a display name or an email address. A new email address needs confirming again. */
    async updateMember(actor: UserRecord, memberId: string, input: { name?: unknown; email?: unknown }): Promise<void> {
      const admin = await adminOf(actor, "member_update");
      targetIn(admin, memberId);
      const user = await authStore.findUserById(memberId);
      if (!user) throw new OrgFailure("not_found", "That member was not found.");

      const details: string[] = [];
      if (input.name !== undefined) {
        const name = validName(input.name);
        if (name !== user.name) {
          await authStore.updateUser(memberId, { name });
          details.push("name");
        }
      }
      if (input.email !== undefined) {
        const email = validEmail(input.email);
        if (email !== user.email) {
          if (!(await authStore.reassignEmail(memberId, email))) throw new OrgFailure("conflict", "That email address is already in use.");
          await authStore.updateUser(memberId, { emailVerifiedAt: null });
          await auth.resendVerification(memberId);
          details.push("email");
        }
      }
      await log(admin.orgId, actor, "member_update", memberId, "ok", details.length ? `Changed the ${details.join(" and ")}` : "No changes");
    },

    /** Adds or removes the super admin role. Super admins hold no seat, so a promoted member gives theirs up. */
    async setRole(actor: UserRecord, memberId: string, role: OrgRole, password: unknown): Promise<void> {
      const admin = await adminOf(actor, "role_change");
      await confirmPassword(actor, password);
      const target = targetIn(admin, memberId);
      if (target.role === role) return;
      if (role === "member" && target.status === "active" && orgStore.activeSuperAdmins(admin.orgId) <= 1) {
        await refuse(admin, actor, "role_change", memberId, lastSuperAdminFailure());
      }
      orgStore.putMembership({ ...target, role, seated: false });
      await log(admin.orgId, actor, "role_change", memberId, "ok", role === "super_admin" ? "Made a super admin" : "Made a member");
    },

    async listActivity(actor: UserRecord) {
      const admin = await adminOf(actor, "list_activity");
      return orgStore.listActivity(admin.orgId).map((entry) => ({ ...entry, at: entry.at.toISOString() }));
    },

    /** Summary for the admin header. */
    async orgName(actor: UserRecord): Promise<string> {
      const admin = await adminOf(actor, "view_org");
      return orgStore.getOrg(admin.orgId)?.name ?? "Organization";
    },
  };
}

export type OrgService = ReturnType<typeof createOrgService>;
