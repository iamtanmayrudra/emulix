import type { ReactNode } from "react";
import { DeviceFrame } from "@/components/device-lab/device-frame";
import { AddressBar, NavButton } from "@/components/device-lab/browser-controls";

type ScreenProps = {
  /** Screen size in CSS pixels, already scaled to fit the page. */
  width: number;
  height: number;
  url: string;
  /** Live browser session for this device, shown in the page area. */
  pageContent?: ReactNode;
  /** Corner radius in pixels. A photo frame clips the screen itself, so it passes 0. */
  radius?: number;
};

type Props = Omit<ScreenProps, "radius"> & { category: "desktop" | "laptop" };

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * A browser window as it looks on a desktop or laptop: tab strip, a toolbar with working back, forward, reload
 * and address field, and the page. It is used inside the drawn hardware and inside supplied photo frames.
 */
export function DesktopScreen({ width, height, url, pageContent, radius = 0 }: ScreenProps) {
  return (
    <div className="flex flex-col overflow-hidden bg-white text-neutral-800" style={{ width, height, borderRadius: radius }}>
      {/* Tab strip */}
      <div className="flex shrink-0 items-end gap-1 bg-neutral-200 px-2 pt-1.5">
        <div className="flex min-w-0 max-w-[45%] items-center gap-2 rounded-t-lg bg-white px-3 py-1.5 text-[11px]">
          <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-sm bg-gradient-to-br from-sky-500 to-fuchsia-500" />
          <span className="truncate">{hostOf(url)}</span>
          <span aria-hidden="true" className="ml-auto shrink-0 text-neutral-400">×</span>
        </div>
        <span aria-hidden="true" className="mb-1 flex h-5 w-5 items-center justify-center rounded-full text-sm text-neutral-500">+</span>
      </div>

      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-1 border-b border-neutral-200 bg-white px-2 py-1.5">
        <NavButton action="back" size={13} className="h-6 w-6" />
        <NavButton action="forward" size={13} className="h-6 w-6" />
        <NavButton action="reload" size={13} className="h-6 w-6" />
        <AddressBar
          url={url}
          className="mx-1 flex min-w-0 flex-1 items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-[11px] focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500"
          inputClassName="truncate"
          leading={
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-neutral-500">
              <rect x="5" y="11" width="14" height="9" rx="2.5" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
          }
        />
        <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center text-neutral-500">⋮</span>
      </div>

      {/* Page */}
      <div className="relative min-h-0 flex-1 bg-neutral-50">
        {pageContent ?? (
          <div role="status" className="flex h-full flex-col items-center justify-center gap-1 p-4 text-center text-xs text-neutral-500">
            <p className="font-semibold text-neutral-800">{hostOf(url)}</p>
            <p>Start a test to open this page.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** A desktop or laptop screen with the browser window, drawn inside generic hardware. */
export function DesktopDevice({ category, width, height, url, pageContent }: Props) {
  return (
    <DeviceFrame category={category} landscape={false}>
      <DesktopScreen width={width} height={height} url={url} pageContent={pageContent} radius={6} />
    </DeviceFrame>
  );
}
