import { Suspense } from "react";
import { SimplePageSkeleton } from "@/components/skeleton";
import { getCurrentUser } from "@/lib/auth/runtime";
import { getOrgService } from "@/lib/org/runtime";

const ACTION_LABELS: Record<string, string> = {
  invite: "Invited someone",
  cancel_invitation: "Cancelled an invitation",
  member_joined: "Joined the organization",
  seat_give: "Gave a seat",
  seat_take: "Took a seat",
  seat_swap: "Moved a seat",
  deactivate: "Deactivated",
  reactivate: "Reactivated",
  member_remove: "Removed",
  reset_link: "Sent a password reset link",
  unlock: "Unlocked an account",
  sign_out: "Signed out everywhere",
  member_update: "Edited a member",
  role_change: "Changed a role",
  platform_access: "Tried to use the platform",
  list_members: "Viewed the member list",
  list_activity: "Viewed the activity log",
  view_org: "Viewed the organization",
};

const RESULT_STYLE = {
  ok: "bg-success/10 text-success",
  refused: "bg-warning/10 text-warning",
  denied: "bg-danger/10 text-danger",
} as const;

const RESULT_LABEL = { ok: "Done", refused: "Refused", denied: "Denied" } as const;

async function ActivityContent() {
  const user = await getCurrentUser();
  const entries = await getOrgService().listActivity(user!);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Activity</h1>
        <p className="mt-1 text-sm text-muted">Every account action in your organization: who did it, to whom, and when. Entries cannot be edited.</p>
      </header>

      {entries.length === 0 ? (
        <p className="rounded-2xl border border-border/70 bg-surface p-5 text-sm text-muted shadow-sm">Nothing has happened yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/70 bg-surface shadow-sm">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">When</th>
                <th scope="col" className="px-4 py-3 font-semibold">Who</th>
                <th scope="col" className="px-4 py-3 font-semibold">Action</th>
                <th scope="col" className="px-4 py-3 font-semibold">Member</th>
                <th scope="col" className="px-4 py-3 font-semibold">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{entry.at.slice(0, 19).replace("T", " ")} UTC</td>
                  <td className="px-4 py-3 font-medium">{entry.actorName}</td>
                  <td className="px-4 py-3">
                    {ACTION_LABELS[entry.action] ?? entry.action}
                    {entry.detail && <span className="block text-xs text-muted">{entry.detail}</span>}
                  </td>
                  <td className="px-4 py-3">{entry.targetName ?? <span className="text-muted">None</span>}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${RESULT_STYLE[entry.result]}`}>{RESULT_LABEL[entry.result]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminActivityPage() {
  return (
    <Suspense fallback={<SimplePageSkeleton label="Loading activity" rows={6} />}>
      <ActivityContent />
    </Suspense>
  );
}
