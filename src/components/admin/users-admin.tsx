"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { MemberList, MemberRow } from "@/lib/org/types";

type Dialog =
  | { type: "password"; title: string; body: string; confirmLabel: string; danger?: boolean; run: (password: string) => Promise<string | null> }
  | { type: "edit"; member: MemberRow }
  | { type: "move"; from: MemberRow };

type Result = { ok: boolean; message?: string };

/** A fixed format keeps the server and browser output identical. */
function formatWhen(iso: string | null): string {
  return iso ? `${iso.slice(0, 16).replace("T", " ")} UTC` : "Never";
}

const MENU_WIDTH = 240;
const MENU_ITEM_HEIGHT = 36;

const INPUT =
  "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm transition hover:border-muted/60 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/15";
const BUTTON_PRIMARY =
  "rounded-xl bg-gradient-to-r from-brand-blue to-brand-violet px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60";
const BUTTON_SECONDARY =
  "rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold transition hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60";

async function request(method: string, url: string, body?: unknown): Promise<Result> {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await response.json().catch(() => ({}))) as { message?: string };
    return { ok: response.ok, message: json.message };
  } catch {
    return { ok: false, message: "Network error. Check your connection and try again." };
  }
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onKeyDown={(event) => event.key === "Escape" && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-2xl">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function PasswordDialog({ dialog, onClose }: { dialog: Extract<Dialog, { type: "password" }>; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const problem = await dialog.run(password);
    if (problem) {
      setError(problem);
      setPending(false);
    } else {
      onClose();
    }
  }

  return (
    <Modal title={dialog.title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted">{dialog.body}</p>
        <div>
          <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium">Your password</label>
          <input id="confirm-password" type="password" autoComplete="current-password" autoFocus required value={password} onChange={(event) => setPassword(event.target.value)} className={INPUT} />
        </div>
        {error && <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={BUTTON_SECONDARY}>Cancel</button>
          <button type="submit" disabled={pending || password.length === 0} className={dialog.danger ? "rounded-xl bg-danger px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60" : BUTTON_PRIMARY}>
            {pending ? "Working…" : dialog.confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditDialog({ member, onSaved, onClose }: { member: MemberRow; onSaved: (message: string) => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState(member.name);
  const [email, setEmail] = useState(member.email);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await request("PATCH", `/api/org/members/${member.id}`, { name, email });
    if (!result.ok) {
      setError(result.message ?? "That could not be saved.");
      setPending(false);
      return;
    }
    await onSaved("Saved.");
    onClose();
  }

  return (
    <Modal title="Edit member" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="edit-name" className="mb-1.5 block text-sm font-medium">Name</label>
          <input id="edit-name" required autoFocus value={name} onChange={(event) => setName(event.target.value)} className={INPUT} />
        </div>
        <div>
          <label htmlFor="edit-email" className="mb-1.5 block text-sm font-medium">Email</label>
          <input id="edit-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className={INPUT} />
          <p className="mt-1.5 text-xs text-muted">A new email address has to be confirmed again by the member.</p>
        </div>
        {error && <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={BUTTON_SECONDARY}>Cancel</button>
          <button type="submit" disabled={pending} className={BUTTON_PRIMARY}>{pending ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </Modal>
  );
}

function MoveDialog({ from, candidates, onMoved, onClose }: { from: MemberRow; candidates: MemberRow[]; onMoved: (message: string) => Promise<void>; onClose: () => void }) {
  const [toId, setToId] = useState(candidates[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await request("POST", "/api/org/seats/swap", { fromId: from.id, toId });
    if (!result.ok) {
      setError(result.message ?? "The seat could not be moved.");
      setPending(false);
      return;
    }
    await onMoved("Seat moved.");
    onClose();
  }

  return (
    <Modal title={`Move ${from.name}'s seat`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted">The seat moves in one step, so the organization never has more seats in use than it should.</p>
        <fieldset className="space-y-2">
          <legend className="sr-only">Give the seat to</legend>
          {candidates.map((candidate) => (
            <label key={candidate.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${toId === candidate.id ? "border-accent bg-accent/5" : "border-border"}`}>
              <input type="radio" name="move-to" value={candidate.id} checked={toId === candidate.id} onChange={() => setToId(candidate.id)} className="accent-[var(--accent)]" />
              <span>
                <span className="block font-medium">{candidate.name}</span>
                <span className="block text-xs text-muted">{candidate.email}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {error && <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={BUTTON_SECONDARY}>Cancel</button>
          <button type="submit" disabled={pending || !toId} className={BUTTON_PRIMARY}>{pending ? "Moving…" : "Move seat"}</button>
        </div>
      </form>
    </Modal>
  );
}

function StatusChip({ member }: { member: MemberRow }) {
  return member.status === "deactivated" ? (
    <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">Deactivated</span>
  ) : (
    <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">Active</span>
  );
}

/**
 * The super admin's Users screen (docs/SUPER_ADMIN.md, section 9): seats, invitations and account actions.
 * Every button calls an endpoint that checks the role again on the server.
 */
export function UsersAdmin({ initial, selfId }: { initial: MemberList; selfId: string }) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  /** The open row menu. It floats above the card, so the table's scrolling area never clips it. */
  const [menu, setMenu] = useState<{ id: string; top: number; left: number } | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteAdmin, setInviteAdmin] = useState(false);
  const [inviting, setInviting] = useState(false);

  const { org } = data;
  const unseated = data.members.filter((member) => member.role === "member" && member.status === "active" && !member.seated);

  async function reload() {
    try {
      const response = await fetch("/api/org/members", { cache: "no-store" });
      if (response.ok) setData((await response.json()) as MemberList);
    } catch {
      // The next action refreshes the list again.
    }
  }

  async function perform(id: string | null, method: string, url: string, body: unknown, success: string) {
    setBusyId(id);
    setError(null);
    setNotice(null);
    const result = await request(method, url, body);
    if (result.ok) setNotice(success);
    else setError(result.message ?? "That did not work. Try again.");
    await reload();
    setBusyId(null);
  }

  async function savedFromDialog(message: string) {
    setNotice(message);
    setError(null);
    await reload();
  }

  /** Runs an action behind a password prompt. Returns the problem to show in the prompt, or null when it worked. */
  function confirmed(method: string, url: string, body: Record<string, unknown>, success: string) {
    return async (password: string) => {
      const result = await request(method, url, { ...body, password });
      if (!result.ok) return result.message ?? "That did not work. Try again.";
      setNotice(success);
      setError(null);
      await reload();
      return null;
    };
  }

  async function submitInvite(event: FormEvent) {
    event.preventDefault();
    if (inviteAdmin) {
      setDialog({
        type: "password",
        title: "Invite a super admin",
        body: "A super admin controls every account in the organization. Confirm with your password to send this invitation.",
        confirmLabel: "Send invitation",
        run: async (password) => {
          const result = await request("POST", "/api/org/members/invite", { name: inviteName, email: inviteEmail, role: "super_admin", password });
          if (!result.ok) return result.message ?? "The invitation could not be sent.";
          setNotice(`Invitation sent to ${inviteEmail}.`);
          setInviteName("");
          setInviteEmail("");
          setInviteAdmin(false);
          await reload();
          return null;
        },
      });
      return;
    }
    setInviting(true);
    setError(null);
    setNotice(null);
    const result = await request("POST", "/api/org/members/invite", { name: inviteName, email: inviteEmail });
    if (result.ok) {
      setNotice(`Invitation sent to ${inviteEmail}.`);
      setInviteName("");
      setInviteEmail("");
      await reload();
    } else {
      setError(result.message ?? "The invitation could not be sent.");
    }
    setInviting(false);
  }

  // The menu is placed from the button's position, so scrolling or resizing closes it instead of leaving it behind.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menu]);

  function openMenu(member: MemberRow, button: HTMLElement) {
    if (menu?.id === member.id) {
      setMenu(null);
      return;
    }
    const rect = button.getBoundingClientRect();
    const height = menuItems(member).length * MENU_ITEM_HEIGHT + 8;
    const room = window.innerHeight - rect.bottom;
    // Open below the button, or above it when there is not enough room underneath.
    const top = room >= height + 8 ? rect.bottom + 4 : Math.max(8, rect.top - height - 4);
    const left = Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
    setMenu({ id: member.id, top, left });
  }

  function menuItems(member: MemberRow): { label: string; danger?: boolean; run: () => void }[] {
    const base = `/api/org/members/${member.id}`;
    const items: { label: string; danger?: boolean; run: () => void }[] = [
      { label: "Edit name or email", run: () => setDialog({ type: "edit", member }) },
      { label: "Send password reset link", run: () => void perform(member.id, "POST", `${base}/reset-password`, {}, `Reset link sent to ${member.email}.`) },
      { label: "Unlock account", run: () => void perform(member.id, "POST", `${base}/unlock`, {}, "Account unlocked.") },
      {
        label: "Sign out everywhere",
        run: () => setDialog({ type: "password", title: `Sign ${member.name} out everywhere`, body: "Every session of this member ends at once.", confirmLabel: "Sign out", run: confirmed("POST", `${base}/sign-out`, {}, "Signed out everywhere.") }),
      },
    ];
    if (member.role === "member" && member.status === "active" && member.seated && unseated.length > 0) {
      items.push({ label: "Move seat to another member", run: () => setDialog({ type: "move", from: member }) });
    }
    items.push(
      member.role === "member"
        ? { label: "Make super admin", run: () => setDialog({ type: "password", title: `Make ${member.name} a super admin`, body: "A super admin controls every account but uses no seat. Their seat, if any, is freed.", confirmLabel: "Make super admin", run: confirmed("POST", `${base}/role`, { role: "super_admin" }, `${member.name} is now a super admin.`) }) }
        : { label: "Make a regular member", run: () => setDialog({ type: "password", title: `Make ${member.name} a regular member`, body: "They lose the ability to control accounts. They will need a seat to use the platform.", confirmLabel: "Make member", run: confirmed("POST", `${base}/role`, { role: "member" }, `${member.name} is now a member.`) }) },
    );
    items.push(
      member.status === "active"
        ? { label: "Deactivate", danger: true, run: () => void perform(member.id, "POST", `${base}/deactivate`, {}, `${member.name} was deactivated.`) }
        : { label: "Reactivate", run: () => void perform(member.id, "POST", `${base}/reactivate`, {}, `${member.name} was reactivated without a seat.`) },
      { label: "Remove from organization", danger: true, run: () => setDialog({ type: "password", title: `Remove ${member.name}`, body: "They leave the organization and keep a plain Free account. This cannot be undone from here.", confirmLabel: "Remove", danger: true, run: confirmed("DELETE", base, {}, `${member.name} was removed.`) }) },
    );
    return items;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">{org.name}</p>
          <h1 className="text-3xl font-semibold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-muted">Control who has an account and who holds a seat. Members see only their own work.</p>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-border/70 bg-gradient-to-r from-brand-blue/10 to-brand-violet/10 px-4 py-3 shadow-sm">
          <span aria-hidden="true" className="flex gap-1.5">
            {Array.from({ length: org.seatLimit }, (_, index) => (
              <span key={index} className={`h-4 w-4 rounded-full border-2 ${index < org.seatsUsed ? "border-transparent bg-gradient-to-br from-brand-blue to-brand-violet" : "border-border bg-surface"}`} />
            ))}
          </span>
          <span>
            <span className="block text-lg font-bold leading-tight" aria-live="polite">{org.seatsUsed} of {org.seatLimit} seats used</span>
            <span className="block text-xs text-muted">Super admins do not use a seat.</span>
          </span>
        </div>
      </header>

      {(error || notice) && (
        <p role={error ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm font-medium ${error ? "border-danger/40 bg-danger/10 text-danger" : "border-success/40 bg-success/10 text-success"}`}>
          {error ?? notice}
        </p>
      )}

      <section aria-labelledby="invite-heading" className="rounded-2xl border border-border/70 bg-surface p-5 shadow-sm">
        <h2 id="invite-heading" className="text-lg font-semibold tracking-tight">Invite someone</h2>
        <form onSubmit={submitInvite} className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div>
            <label htmlFor="invite-name" className="mb-1.5 block text-sm font-medium">Name</label>
            <input id="invite-name" required value={inviteName} onChange={(event) => setInviteName(event.target.value)} className={INPUT} />
          </div>
          <div>
            <label htmlFor="invite-email" className="mb-1.5 block text-sm font-medium">Email</label>
            <input id="invite-email" type="email" required value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} className={INPUT} />
          </div>
          <button type="submit" disabled={inviting} className={BUTTON_PRIMARY}>{inviting ? "Sending…" : "Send invitation"}</button>
          <label className="flex items-center gap-2 text-sm md:col-span-3">
            <input type="checkbox" checked={inviteAdmin} onChange={(event) => setInviteAdmin(event.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
            Invite as a super admin <span className="text-xs text-muted">(asks for your password)</span>
          </label>
        </form>
        <p className="mt-3 text-xs text-muted">The person gets an email, chooses their own password, and joins without a seat. You decide who gets one.</p>
      </section>

      <section aria-labelledby="members-heading" className="rounded-2xl border border-border/70 bg-surface shadow-sm">
        <h2 id="members-heading" className="px-5 pt-5 text-lg font-semibold tracking-tight">Members</h2>
        <div className="relative overflow-x-auto p-2 md:p-3">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">Member</th>
                <th scope="col" className="px-3 py-2 font-semibold">Role</th>
                <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                <th scope="col" className="px-3 py-2 font-semibold">Seat</th>
                <th scope="col" className="px-3 py-2 font-semibold">Last sign-in</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.members.map((member) => {
                const self = member.id === selfId;
                const canSeat = member.role === "member" && member.status === "active";
                return (
                  <tr key={member.id} className={busyId === member.id ? "opacity-60" : undefined}>
                    <td className="px-3 py-3">
                      <span className="block font-medium">{member.name}{self && <span className="ml-1.5 text-xs font-normal text-muted">(you)</span>}</span>
                      <span className="block text-xs text-muted">{member.email}</span>
                    </td>
                    <td className="px-3 py-3">
                      {member.role === "super_admin" ? (
                        <span className="rounded-full bg-brand-violet/15 px-2 py-0.5 text-xs font-semibold text-accent">Super admin</span>
                      ) : (
                        <span className="text-muted">Member</span>
                      )}
                    </td>
                    <td className="px-3 py-3"><StatusChip member={member} /></td>
                    <td className="px-3 py-3">
                      {canSeat ? (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={member.seated}
                          aria-label={`Seat for ${member.name}`}
                          disabled={busyId === member.id}
                          onClick={() => void perform(member.id, "PATCH", `/api/org/members/${member.id}/seat`, { seated: !member.seated }, member.seated ? `${member.name} no longer has a seat.` : `${member.name} has a seat.`)}
                          className={`relative h-6 w-11 rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60 ${member.seated ? "bg-gradient-to-r from-brand-blue to-brand-violet" : "bg-border"}`}
                        >
                          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${member.seated ? "left-[1.375rem]" : "left-0.5"}`} />
                        </button>
                      ) : (
                        <span className="text-xs text-muted">{member.role === "super_admin" ? "Not needed" : "None"}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted">{formatWhen(member.lastLoginAt)}</td>
                    <td className="relative px-3 py-3 text-right">
                      {self ? (
                        <span className="text-xs text-muted">You</span>
                      ) : (
                        <>
                          <button type="button" aria-haspopup="menu" aria-expanded={menu?.id === member.id} onClick={(event) => openMenu(member, event.currentTarget)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent">
                            Manage
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {data.invitations.length > 0 && (
        <section aria-labelledby="invitations-heading" className="rounded-2xl border border-border/70 bg-surface p-5 shadow-sm">
          <h2 id="invitations-heading" className="text-lg font-semibold tracking-tight">Waiting to join</h2>
          <ul className="mt-3 divide-y divide-border">
            {data.invitations.map((invitation) => (
              <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span>
                  <span className="block font-medium">{invitation.name}{invitation.role === "super_admin" && <span className="ml-2 rounded-full bg-brand-violet/15 px-2 py-0.5 text-xs font-semibold text-accent">Super admin</span>}</span>
                  <span className="block text-xs text-muted">{invitation.email} · link works until {formatWhen(invitation.expiresAt)}</span>
                </span>
                <button type="button" onClick={() => void perform(null, "DELETE", `/api/org/invitations/${invitation.id}`, undefined, `Cancelled the invitation for ${invitation.email}.`)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-danger hover:text-danger">
                  Cancel invitation
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {menu && data.members.some((member) => member.id === menu.id) && (
        <>
          <button type="button" aria-label="Close menu" className="fixed inset-0 z-30 cursor-default" onClick={() => setMenu(null)} />
          <ul role="menu" style={{ top: menu.top, left: menu.left, width: MENU_WIDTH }} className="fixed z-40 overflow-hidden rounded-xl border border-border bg-surface py-1 text-left shadow-xl">
            {menuItems(data.members.find((member) => member.id === menu.id)!).map((item) => (
              <li key={item.label} role="none">
                <button type="button" role="menuitem" onClick={() => { setMenu(null); item.run(); }} className={`w-full px-4 py-2 text-left text-sm hover:bg-background ${item.danger ? "text-danger" : ""}`}>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {dialog?.type === "password" && <PasswordDialog dialog={dialog} onClose={() => setDialog(null)} />}
      {dialog?.type === "edit" && <EditDialog member={dialog.member} onSaved={savedFromDialog} onClose={() => setDialog(null)} />}
      {dialog?.type === "move" && <MoveDialog from={dialog.from} candidates={unseated} onMoved={savedFromDialog} onClose={() => setDialog(null)} />}
    </div>
  );
}
