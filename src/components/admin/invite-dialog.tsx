"use client";

import { useState, type FormEvent } from "react";

/** Sent on the window after an invitation goes out, so an open member list can refresh itself. */
export const INVITED_EVENT = "emulix:invited";

const INPUT =
  "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground transition hover:border-muted/60 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/15";
const BUTTON_PRIMARY =
  "rounded-xl bg-gradient-to-r from-brand-blue to-brand-violet px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60";
const BUTTON_SECONDARY =
  "rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60";

/**
 * The "Invite team" dialog for a super admin. It calls the same endpoint as the Users screen, which checks the role and,
 * for a super admin invitation, the password again on the server.
 */
export function InviteDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [admin, setAdmin] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/org/members/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(admin ? { name, email, role: "super_admin", password } : { name, email }),
      });
      const json = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        setError(json.message ?? "The invitation could not be sent.");
        return;
      }
      setSentTo(email);
      window.dispatchEvent(new CustomEvent(INVITED_EVENT, { detail: { email } }));
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  function inviteAnother() {
    setSentTo(null);
    setName("");
    setEmail("");
    setAdmin(false);
    setPassword("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onKeyDown={(event) => event.key === "Escape" && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="invite-dialog-title" className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-surface p-6 text-foreground shadow-2xl">
        <h2 id="invite-dialog-title" className="text-lg font-semibold tracking-tight">Invite team</h2>

        {sentTo ? (
          <div className="space-y-4">
            <p role="status" className="rounded-xl border border-success/40 bg-success/10 px-3 py-2 text-sm font-medium text-success">
              Invitation sent to {sentTo}.
            </p>
            <p className="text-sm text-muted">They choose their own password from the emailed link and join without a seat. You decide who gets one.</p>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={inviteAnother} className={BUTTON_SECONDARY}>Invite another</button>
              <button type="button" onClick={onClose} autoFocus className={BUTTON_PRIMARY}>Done</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="team-invite-name" className="mb-1.5 block text-sm font-medium">Name</label>
              <input id="team-invite-name" required autoFocus autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} className={INPUT} />
            </div>
            <div>
              <label htmlFor="team-invite-email" className="mb-1.5 block text-sm font-medium">Email</label>
              <input id="team-invite-email" type="email" required autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} className={INPUT} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={admin} onChange={(event) => setAdmin(event.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
              Invite as a super admin <span className="text-xs text-muted">(asks for your password)</span>
            </label>
            {admin && (
              <div>
                <label htmlFor="team-invite-password" className="mb-1.5 block text-sm font-medium">Your password</label>
                <input id="team-invite-password" type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className={INPUT} />
                <p className="mt-1.5 text-xs text-muted">A super admin controls every account in the organization.</p>
              </div>
            )}
            {error && <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{error}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={onClose} className={BUTTON_SECONDARY}>Cancel</button>
              <button type="submit" disabled={pending} className={BUTTON_PRIMARY}>{pending ? "Sending…" : "Send invitation"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
