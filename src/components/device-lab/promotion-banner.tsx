import { CodeIcon } from "@/components/device-lab/icons";

type Props = {
  title: string;
  message: string;
  ctaLabel: string;
  onCta: () => void;
};

/** Configurable banner. Its CTA runs a real demo action in this page, not an external offer. */
export function PromotionBanner({ title, message, ctaLabel, onCta }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-violet/20 bg-gradient-to-r from-brand-blue/10 via-brand-violet/10 to-brand-fuchsia/10 px-4 py-3">
      <p className="flex min-w-0 items-center gap-2 text-sm">
        <CodeIcon className="h-5 w-5 shrink-0 text-accent" />
        <span>
          <strong className="font-semibold">{title}</strong> {message}
        </span>
      </p>
      <button
        type="button"
        onClick={onCta}
        className="shrink-0 rounded-md bg-gradient-to-r from-brand-blue to-brand-violet px-4 py-1.5 text-sm font-semibold text-white shadow-sm shadow-brand-violet/30 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-accent"
      >
        {ctaLabel} →
      </button>
    </div>
  );
}
