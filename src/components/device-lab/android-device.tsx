import type { CSSProperties, ReactNode } from "react";
import { AddressBar, NavButton } from "@/components/device-lab/browser-controls";

type ScreenProps = {
  category: "phone" | "tablet";
  /** Screen size in CSS pixels, already scaled to fit the page. */
  width: number;
  height: number;
  url: string;
  /** Live browser session for this device, shown in the page area. */
  pageContent?: ReactNode;
  /** Corner radius in pixels. A photo frame clips the screen itself, so it passes 0. */
  radius?: number;
  /** The drawn hardware has a punch-hole camera. A photo frame already shows the real one. */
  showCamera?: boolean;
};

type Props = Omit<ScreenProps, "radius" | "showCamera">;

function px(value: number): string {
  return `${Math.round(value * 10) / 10}px`;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * What an Android device's screen shows: the system status bar, the Chrome toolbar with a working address field,
 * the page, and the gesture bar. It is used inside the drawn hardware and inside supplied photo frames.
 */
export function AndroidScreen({ category, width, height, url, pageContent, radius = 0, showCamera = true }: ScreenProps) {
  const isTablet = category === "tablet";
  const statusHeight = Math.max(14, height * 0.034);
  const text = { fontSize: px(Math.max(8, width * (isTablet ? 0.022 : 0.034))) };

  return (
    <div
      className="relative flex flex-col overflow-hidden bg-white text-neutral-900"
      style={{ width: px(width), height: px(height), borderRadius: px(radius) }}
    >
      {/* Status bar */}
      <div className="relative z-10 flex shrink-0 items-center justify-between bg-white" style={{ height: px(statusHeight), paddingInline: px(width * 0.07), ...text }}>
        <span className="font-medium">9:41</span>
        <span aria-hidden="true" className="flex items-center gap-1 text-neutral-700">
          <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor"><path d="M2 20h20L22 4z" opacity=".9" /></svg>
          <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M3 9a14 14 0 0 1 18 0M6 13a9 9 0 0 1 12 0M9.5 17a4 4 0 0 1 5 0" /></svg>
          <span className="h-[0.8em] w-[1.5em] rounded-[2px] bg-neutral-700" />
        </span>
      </div>

      {/* Chrome toolbar */}
      <div className="flex shrink-0 items-center gap-1.5 bg-white" style={{ paddingInline: px(width * 0.03), paddingBlock: px(height * 0.008) }}>
        {isTablet && (
          <>
            <NavButton action="back" size={Math.max(12, width * 0.03)} className="h-7 w-7 text-neutral-700" />
            <NavButton action="forward" size={Math.max(12, width * 0.03)} className="h-7 w-7 text-neutral-700" />
            <NavButton action="reload" size={Math.max(12, width * 0.03)} className="h-7 w-7 text-neutral-700" />
          </>
        )}
        <AddressBar
          url={url}
          style={text}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1.5 text-neutral-800 focus-within:ring-2 focus-within:ring-blue-500"
          inputClassName="truncate"
          leading={
            <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-neutral-500" style={text}>
              <rect x="5" y="11" width="14" height="9" rx="2.5" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
          }
        />
        <span aria-hidden="true" className="flex shrink-0 items-center justify-center rounded-md border-2 border-neutral-600 font-bold" style={{ width: px(width * 0.06), height: px(width * 0.06), fontSize: px(Math.max(7, width * 0.03)) }}>
          1
        </span>
        {!isTablet && (
          <NavButton action="reload" size={Math.max(12, width * 0.05)} className="h-7 w-7 text-neutral-700" />
        )}
      </div>
      <div aria-hidden="true" className="h-px shrink-0 bg-neutral-200" />

      {/* Page */}
      <div className="relative min-h-0 flex-1 bg-neutral-50">
        {pageContent ?? (
          <div role="status" className="flex h-full flex-col items-center justify-center gap-1 p-4 text-center text-neutral-500" style={text}>
            <p className="font-semibold text-neutral-800">{hostOf(url)}</p>
            <p>Start a test to open this page.</p>
          </div>
        )}
      </div>

      {/* Gesture bar */}
      <div aria-hidden="true" className="flex shrink-0 items-center justify-center bg-white" style={{ height: px(Math.max(12, height * 0.035)) }}>
        <span className="rounded-full bg-neutral-800" style={{ width: px(width * 0.32), height: px(Math.max(3, height * 0.006)) }} />
      </div>

      {/* Punch-hole camera */}
      {showCamera && (
        <span
          aria-hidden="true"
          className="absolute z-20 rounded-full bg-black ring-2 ring-neutral-800"
          style={
            isTablet
              ? { left: "50%", top: px(statusHeight * 0.3), width: px(width * 0.012), height: px(width * 0.012), transform: "translateX(-50%)" }
              : { left: "50%", top: px(statusHeight * 0.28), width: px(width * 0.04), height: px(width * 0.04), transform: "translateX(-50%)" }
          }
        />
      )}
    </div>
  );
}

/** A drawn Android device: dark aluminium body with side keys around the screen above. */
export function AndroidDevice({ category, width, height, url, pageContent }: Props) {
  const isTablet = category === "tablet";
  const bezel = isTablet ? width * 0.03 : width * 0.038;
  const radius = isTablet ? width * 0.045 : width * 0.12;
  const key = (style: CSSProperties) => (
    <span aria-hidden="true" className="absolute rounded-sm bg-gradient-to-b from-neutral-500 to-neutral-700" style={style} />
  );

  return (
    <div
      className="relative shrink-0 bg-gradient-to-b from-[#2a2d36] via-[#14161c] to-[#0c0d11] shadow-2xl ring-1 ring-black/60"
      style={{ padding: px(bezel), borderRadius: px(radius + bezel) }}
    >
      {isTablet
        ? key({ right: px(-3), top: px(height * 0.14), width: px(3), height: px(height * 0.07) })
        : (
          <>
            {key({ right: px(-3), top: px(height * 0.2), width: px(3), height: px(height * 0.06) })}
            {key({ right: px(-3), top: px(height * 0.3), width: px(3), height: px(height * 0.1) })}
          </>
        )}
      <AndroidScreen category={category} width={width} height={height} url={url} pageContent={pageContent} radius={radius} />
    </div>
  );
}
