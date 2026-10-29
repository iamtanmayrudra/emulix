import type { Plan } from "@/lib/mock-data";

export function PlanBadge({ plan }: { plan: Plan }) {
  if (plan === "pro") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-pro/15 px-2 py-0.5 text-xs font-semibold text-pro">
        <span aria-hidden="true">★</span> Pro
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-border px-2 py-0.5 text-xs font-semibold text-muted">
      Free
    </span>
  );
}
