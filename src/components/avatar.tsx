import { planForStatus } from "@/lib/entitlements";
import type { SubscriptionStatus } from "@/lib/mock-data";

type Props = {
  name: string;
  status: SubscriptionStatus;
  size?: number;
};

/** Pro users get an animated ring derived from subscription status, never a client setting. */
export function Avatar({ name, status, size = 40 }: Props) {
  const isPro = planForStatus(status) === "pro";
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <span
      role="img"
      aria-label={`${name}, ${isPro ? "Pro" : "Free"} plan`}
      className={`inline-flex shrink-0 rounded-full p-[2px] ${isPro ? "pro-ring" : "bg-border"}`}
      style={{ width: size, height: size }}
    >
      <span
        aria-hidden="true"
        className="flex h-full w-full items-center justify-center rounded-full bg-surface text-xs font-semibold text-foreground"
      >
        {initials}
      </span>
    </span>
  );
}
