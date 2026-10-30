"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const INPUT =
  "mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm transition hover:border-muted/60 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/15";

type Result = { ok: true; message: string } | { ok: false; message: string };

/** Edits the signed-in person's name and email. A new email needs the current password, and is confirmed again. */
export function ProfileEditor({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [nameValue, setNameValue] = useState(name);
  const [emailValue, setEmailValue] = useState(email);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const emailChanged = emailValue.trim().toLowerCase() !== email.toLowerCase();
  const nameChanged = nameValue.trim() !== name;

  function startEditing() {
    setNameValue(name);
    setEmailValue(email);
    setPassword("");
    setResult(null);
    setEditing(true);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setResult(null);
    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameValue, email: emailValue, password }),
      });
      const json = (await response.json().catch(() => ({}))) as { message?: string; verificationSent?: boolean };
      if (!response.ok) {
        setResult({ ok: false, message: json.message ?? "Your changes could not be saved." });
        return;
      }
      const message = json.verificationSent
        ? "Saved. We sent a confirmation link to your new email address."
        : nameChanged
          ? "Saved."
          : "No changes to save.";
      setResult({ ok: true, message });
      setPassword("");
      setEditing(false);
      router.refresh();
    } catch {
      setResult({ ok: false, message: "Network error. Check your connection and try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="edit-profile-heading" className="rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="edit-profile-heading" className="text-base font-semibold">
          Edit profile
        </h2>
        {!editing && (
          <button type="button" onClick={startEditing} className="rounded-xl border border-border px-3.5 py-2 text-sm font-semibold transition hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent">
            Edit
          </button>
        )}
      </div>

      {result && (
        <p role={result.ok ? "status" : "alert"} className={`mt-4 rounded-xl border px-4 py-3 text-sm font-medium ${result.ok ? "border-success/40 bg-success/10 text-success" : "border-danger/40 bg-danger/10 text-danger"}`}>
          {result.message}
        </p>
      )}

      {editing ? (
        <form onSubmit={save} noValidate className="mt-4 space-y-4">
          <div>
            <label htmlFor="profile-name" className="text-sm font-medium">Full name</label>
            <input id="profile-name" required maxLength={80} autoComplete="name" value={nameValue} onChange={(event) => setNameValue(event.target.value)} className={INPUT} />
          </div>
          <div>
            <label htmlFor="profile-email" className="text-sm font-medium">Email</label>
            <input id="profile-email" type="email" autoComplete="email" value={emailValue} onChange={(event) => setEmailValue(event.target.value)} className={INPUT} />
            {emailChanged && <p className="mt-1.5 text-xs text-muted">Changing your email needs your current password, and the new address must be confirmed.</p>}
          </div>
          {emailChanged && (
            <div>
              <label htmlFor="profile-password" className="text-sm font-medium">Current password</label>
              <input id="profile-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className={INPUT} />
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" onClick={() => setEditing(false)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold transition hover:border-accent">
              Cancel
            </button>
            <button type="submit" disabled={pending || (!nameChanged && !emailChanged)} className="rounded-xl bg-gradient-to-r from-brand-blue to-brand-violet px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60">
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-2 text-sm text-muted">Change your name or the email address you sign in with.</p>
      )}
    </section>
  );
}
