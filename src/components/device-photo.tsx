import Image from "next/image";
import type { ReactNode } from "react";
import { findDevice } from "@/lib/device-lab/devices";

/** Real device photos, from the device registry. Each has a measured screen area for placing content. */
export const SHOWCASE_IDS = ["iphone-se", "ipad-air"] as const;
export type ShowcaseId = (typeof SHOWCASE_IDS)[number];

/** Sample values for the illustrations. They are not measurements. */
export const RESULT_METRICS = [
  ["HTTP status", "200 OK"],
  ["Load time", "1.84 s"],
  ["Requests", "42"],
  ["Viewport", "390 × 844"],
];

export type ScreenVariant = "result" | "sizes" | "report";

/** What is drawn on the device screen. Every variant is an illustration with sample values. */
export function ScreenContent({ variant }: { variant: ScreenVariant }) {
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-white to-slate-100 p-3 text-slate-900">
      <div className="flex items-center justify-between gap-1">
        <span className="whitespace-nowrap text-[11px] font-semibold">
          {variant === "report" ? "Saved report" : "Run complete"}
        </span>
        <span className="whitespace-nowrap rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
          200 OK
        </span>
      </div>
      <div className="mt-2 h-[38%] rounded-lg bg-gradient-to-br from-brand-blue via-brand-violet to-brand-fuchsia" />
      {variant === "result" && (
        <>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {RESULT_METRICS.map(([label, value]) => (
              <div key={label} className="rounded-md bg-white px-2 py-1.5 shadow-sm">
                <p className="text-[8px] text-slate-500">{label}</p>
                <p className="text-[10px] font-semibold">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-2 rounded-md bg-emerald-50 px-2 py-1.5 text-[9px] text-emerald-800">No console errors</div>
        </>
      )}
      {variant === "sizes" && (
        <>
          <div className="mt-2 flex gap-1.5">
            {["Portrait", "Landscape"].map((orientation) => (
              <span key={orientation} className="rounded-md bg-white px-2 py-1 text-[9px] font-medium shadow-sm">
                {orientation}
              </span>
            ))}
          </div>
          <div className="mt-2 rounded-md bg-emerald-50 px-2 py-1.5 text-[9px] text-emerald-800">Sample layout</div>
        </>
      )}
      {variant === "report" && (
        <ul className="mt-2 space-y-1.5 text-[9px]">
          {["Console errors: none", "Failed requests: 0", "Kept for later review"].map((line) => (
            <li key={line} className="rounded-md bg-white px-2 py-1.5 shadow-sm">
              {line}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A real device photo with content placed on its measured screen area. The frame is decorative. */
export function DevicePhoto({
  id,
  height,
  variant = "result",
  children,
}: {
  id: ShowcaseId;
  height: number;
  variant?: ScreenVariant;
  /** Replaces the built-in screen content. */
  children?: ReactNode;
}) {
  const device = findDevice(id);
  if (!device?.frameImage || !device.frameScreen) return null;
  const screen = device.frameScreen;
  const width = height / screen.aspect;
  return (
    <div className="relative" style={{ width, height }}>
      <Image src={device.frameImage} alt="" aria-hidden="true" fill unoptimized sizes={`${Math.round(width)}px`} className="object-contain" />
      <div
        className="absolute overflow-hidden rounded-[4%]"
        style={{
          left: `${screen.x * 100}%`,
          top: `${screen.y * 100}%`,
          width: `${screen.width * 100}%`,
          height: `${screen.height * 100}%`,
        }}
      >
        {children ?? <ScreenContent variant={variant} />}
      </div>
    </div>
  );
}
