import type { ActivityEntry, Invitation, Membership, Organization } from "./types";

/**
 * Storage for organizations, memberships, invitations and the activity log.
 *
 * Development uses the in-memory store below. Data is lost on restart. Replace it with the chosen database
 * (plan decision 8) before any deployment. Every method here is synchronous inside the process, which is what makes
 * the seat checks atomic: a count and a change happen with nothing else running in between. A database version must
 * do the same in one transaction.
 */
export class MemoryOrgStore {
  private orgs = new Map<string, Organization>();
  /** One membership per user. */
  private memberships = new Map<string, Membership>();
  private invitations = new Map<string, Invitation>();
  private activity: ActivityEntry[] = [];

  seed(input: { orgs: Organization[]; memberships: Membership[] }) {
    for (const org of input.orgs) this.orgs.set(org.id, { ...org });
    for (const membership of input.memberships) this.memberships.set(membership.userId, { ...membership });
  }

  getOrg(id: string): Organization | null {
    const org = this.orgs.get(id);
    return org ? { ...org } : null;
  }

  insertOrg(org: Organization) {
    this.orgs.set(org.id, { ...org });
  }

  updateOrg(id: string, patch: Partial<Organization>) {
    const current = this.orgs.get(id);
    if (current) this.orgs.set(id, { ...current, ...patch });
  }

  getMembership(userId: string): Membership | null {
    const membership = this.memberships.get(userId);
    return membership ? { ...membership } : null;
  }

  listMemberships(orgId: string): Membership[] {
    return [...this.memberships.values()].filter((membership) => membership.orgId === orgId).map((membership) => ({ ...membership }));
  }

  putMembership(membership: Membership) {
    this.memberships.set(membership.userId, { ...membership });
  }

  deleteMembership(userId: string) {
    this.memberships.delete(userId);
  }

  seatsUsed(orgId: string): number {
    let count = 0;
    for (const membership of this.memberships.values()) {
      if (membership.orgId === orgId && membership.role === "member" && membership.status === "active" && membership.seated) count += 1;
    }
    return count;
  }

  activeSuperAdmins(orgId: string): number {
    let count = 0;
    for (const membership of this.memberships.values()) {
      if (membership.orgId === orgId && membership.role === "super_admin" && membership.status === "active") count += 1;
    }
    return count;
  }

  putInvitation(invitation: Invitation) {
    this.invitations.set(invitation.id, { ...invitation });
  }

  findInvitationByTokenHash(tokenHash: string): Invitation | null {
    for (const invitation of this.invitations.values()) {
      if (invitation.tokenHash === tokenHash) return { ...invitation };
    }
    return null;
  }

  getInvitation(id: string): Invitation | null {
    const invitation = this.invitations.get(id);
    return invitation ? { ...invitation } : null;
  }

  listInvitations(orgId: string): Invitation[] {
    return [...this.invitations.values()].filter((invitation) => invitation.orgId === orgId).map((invitation) => ({ ...invitation }));
  }

  deleteInvitation(id: string) {
    this.invitations.delete(id);
  }

  /** Entries are only ever added. There is no way to edit or remove one. */
  appendActivity(entry: ActivityEntry) {
    this.activity.push({ ...entry });
  }

  listActivity(orgId: string, limit = 200): ActivityEntry[] {
    return this.activity
      .filter((entry) => entry.orgId === orgId)
      .slice(-limit)
      .reverse()
      .map((entry) => ({ ...entry }));
  }
}
