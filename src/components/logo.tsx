import { useId } from "react";

type LogoMarkProps = {
  size?: number;
};

/**
 * Emulix mark: an "E" built from three bars of different widths, for the desktop, tablet and phone viewports
 * the product tests. The short middle bar ends in an amber dot, a live signal and the light of a lighthouse.
 * Keep it in step with scripts/build-brand-assets.mjs, which draws the same mark for icons and social cards.
 */
export function LogoMark({ size = 32 }: LogoMarkProps) {
  // Each mark needs its own gradient ids. Shared ids break when the first copy on the page is hidden.
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false" className="shrink-0">
      <defs>
        <linearGradient id={`${id}-bg`} x1="6" y1="2" x2="58" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2f7bf5" />
          <stop offset="0.55" stopColor="#6b3df0" />
          <stop offset="1" stopColor="#c026d3" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="0.88" cy="0.92" r="0.75">
          <stop offset="0" stopColor="#ff7ab8" stopOpacity="0.6" />
          <stop offset="1" stopColor="#ff7ab8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.3" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-glyph`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d9e2ff" />
        </linearGradient>
        <radialGradient id={`${id}-spark`} cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#fff6bd" />
          <stop offset="1" stopColor="#fbbf24" />
        </radialGradient>
        <clipPath id={`${id}-tile`}>
          <rect width="64" height="64" rx="16" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-tile)`}>
        <rect width="64" height="64" fill={`url(#${id}-bg)`} />
        <rect width="64" height="64" fill={`url(#${id}-glow)`} />
        <rect width="64" height="34" fill={`url(#${id}-sheen)`} />
      </g>
      <rect x="0.5" y="0.5" width="63" height="63" rx="15.5" fill="none" stroke="#fff" strokeOpacity="0.22" />
      <g fill="#1a0e5e" fillOpacity="0.3" transform="translate(0 1.6)">
        <rect x="15" y="14" width="8" height="36" rx="4" />
        <rect x="15" y="14" width="30" height="8" rx="4" />
        <rect x="15" y="28" width="21" height="8" rx="4" />
        <rect x="15" y="42" width="30" height="8" rx="4" />
      </g>
      <g fill={`url(#${id}-glyph)`}>
        <rect x="15" y="14" width="8" height="36" rx="4" />
        <rect x="15" y="14" width="30" height="8" rx="4" />
        <rect x="15" y="28" width="21" height="8" rx="4" />
        <rect x="15" y="42" width="30" height="8" rx="4" />
      </g>
      <circle cx="44.5" cy="32" r="6.6" fill="#fbbf24" fillOpacity="0.24" />
      <circle cx="44.5" cy="32" r="3.7" fill={`url(#${id}-spark)`} />
    </svg>
  );
}

/** Mark plus wordmark. "Emul" inherits the current text colour, and "ix" carries the brand gradient. */
export function Logo({ size = 28 }: LogoMarkProps) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="text-[1.2em] font-bold leading-none tracking-tight">
        Emul<span className="bg-gradient-to-br from-brand-blue to-brand-fuchsia bg-clip-text text-transparent">ix</span>
      </span>
    </span>
  );
}
