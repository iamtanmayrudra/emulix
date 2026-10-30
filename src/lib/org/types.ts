/** Organization records. See docs/SUPER_ADMIN.md, section 8. */

export type OrgRole = "super_admin" | "member";

/** Deactivated members cannot sign in. Removed members are deleted from the organization altogether. */
export type MembershipStatus = "active" | "deactivated";

export type Organization = {
  id: string;
  name: string;
  /** A lapsed organization drops to the Free plan. Accounts and seat choices are kept. */
  planStatus: "active" | "lapsed";
  /** How many members can use the platform at the same time. */
  seatLimit: number;
  createdAt: Date;
};

export type Membership = {
  userId: string;
  orgId: string;
  role: OrgRole;
  status: MembershipStatus;
  /** A seat lets a member use the platform. Super admins never hold one. */
  seated: boolean;
  invitedBy: string | null;
  createdAt: Date;
};

export type Invitation = {
  id: string;
  orgId: string;
  email: string;
  name: string;
  role: OrgRole;
  tokenHash: string;
  invitedBy: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
};

export type ActivityResult = "ok" | "denied" | "refused";

export type ActivityEntry = {
  id: string;
  orgId: string;
  at: Date;
  actorId: string;
  actorName: string;
  action: string;
  targetId: string | null;
  targetName: string | null;
  result: ActivityResult;
  detail: string | null;
};

/** What the server knows about a user's place in an organization. */
export type Access =
  | { kind: "individual" }
  | { kind: "super_admin"; orgId: string }
  | { kind: "seated"; orgId: string; orgActive: boolean }
  | { kind: "no_seat"; orgId: string }
  | { kind: "deactivated"; orgId: string };

/** A member as the Users screen shows them. */
export type MemberRow = {
  id: string;
  name: string;
  email: string;
  role: OrgRole;
  status: MembershipStatus;
  seated: boolean;
  lastLoginAt: string | null;
};

export type InvitationRow = {
  id: string;
  name: string;
  email: string;
  role: OrgRole;
  expiresAt: string;
};

export type MemberList = {
  org: { name: string; seatLimit: number; seatsUsed: number };
  members: MemberRow[];
  invitations: InvitationRow[];
};
