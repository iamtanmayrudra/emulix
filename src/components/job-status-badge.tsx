import type { JobStatus } from "@/lib/mock-data";

const STATUS_STYLES: Record<JobStatus, { label: string; className: string }> = {
  created: { label: "Created", className: "text-muted bg-border" },
  entitlement_checked: { label: "Checked", className: "text-muted bg-border" },
  queued: { label: "Queued", className: "text-accent bg-accent/10" },
  starting: { label: "Starting", className: "text-accent bg-accent/10" },
  running: { label: "Running", className: "text-accent bg-accent/10" },
  collecting_results: { label: "Collecting", className: "text-accent bg-accent/10" },
  completed: { label: "Completed", className: "text-success bg-success/10" },
  failed: { label: "Failed", className: "text-danger bg-danger/10" },
  cancelled: { label: "Cancelled", className: "text-muted bg-border" },
  timed_out: { label: "Timed out", className: "text-danger bg-danger/10" },
  rejected: { label: "Rejected", className: "text-danger bg-danger/10" },
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${style.className}`}>
      {style.label}
    </span>
  );
}
