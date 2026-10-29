import type { ReactNode } from "react";
import { DeviceFrame } from "@/components/device-lab/device-frame";
import { DeviceScreen } from "@/components/device-lab/device-screen";
import type { Device } from "@/lib/device-lab/devices";

/** Largest screen edge in CSS pixels. Larger viewports scale down, keeping their aspect ratio. */
const MAX_SCREEN_EDGE = 560;

type Props = {
  device: Device;
  /** Viewport size shown on screen, already adjusted for orientation. */
  width: number;
  height: number;
  landscape: boolean;
  onToggleOrientation: () => void;
  restricted: boolean;
  screenshotSrc: string | null;
  screenshotAlt: string;
  children?: ReactNode;
};

export function DevicePreview({
  device,
  width,
  height,
  landscape,
  onToggleOrientation,
  restricted,
  screenshotSrc,
  screenshotAlt,
  children,
}: Props) {
  const scale = Math.min(1, MAX_SCREEN_EDGE / width, MAX_SCREEN_EDGE / height);
  const screenWidth = Math.round(width * scale);
  const screenHeight = Math.round(height * scale);
  const canRotate = device.category === "phone" || device.category === "tablet";

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="flex w-full flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">
          {device.manufacturer} · {device.osVersion}
        </p>
        {canRotate && (
          <button
            type="button"
            aria-pressed={landscape}
            onClick={onToggleOrientation}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
          >
            Orientation: {landscape ? "landscape" : "portrait"}
          </button>
        )}
      </div>

      <div className={`max-w-full overflow-auto transition-opacity ${restricted ? "opacity-50" : ""}`}>
        <DeviceFrame category={device.category} landscape={landscape && canRotate}>
          <DeviceScreen
            width={screenWidth}
            height={screenHeight}
            screenshotSrc={screenshotSrc}
            screenshotAlt={screenshotAlt}
          >
            {children}
          </DeviceScreen>
        </DeviceFrame>
      </div>
    </div>
  );
}
