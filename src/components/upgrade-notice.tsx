import Link from "next/link";

type Props = {
  title: string;
  message: string;
  onDismiss: () => void;
};

/**
 * In-app notice for actions that need a paid plan. It stays until dismissed,
 * so the user can read it and still reach the plans page.
 */
export function UpgradeNotice({ title, message, onDismiss }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-sm rounded-lg border border-pro/40 bg-surface p-4 text-foreground shadow-lg md:inset-x-auto md:right-6 md:bottom-6"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] bg-pro/15 text-pro"
        >
          ★
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-sm text-muted">{message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/checkout"
              className="rounded-[3px] bg-gradient-to-r from-brand-blue to-brand-fuchsia px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Upgrade to Pro
            </Link>
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-[3px] border border-border px-3 py-1.5 text-sm font-medium hover:border-accent"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="shrink-0 rounded-[3px] px-1.5 text-lg leading-none text-muted hover:text-foreground"
        >
          ×
        </button>
      </div>
    </div>
  );
}
