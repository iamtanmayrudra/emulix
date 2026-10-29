import type { ReactNode } from "react";
import type { DeviceCategory } from "@/lib/device-lab/devices";

/**
 * Generic CSS hardware frames, one per device category. These are not hardware renders of a specific model.
 * Model-specific frame images are not licensed or bundled yet, so none are used here.
 */
const BEZEL: Record<DeviceCategory, string> = {
  phone: "rounded-[2.4rem] p-3.5",
  tablet: "rounded-[1.4rem] p-3",
  laptop: "rounded-t-2xl p-2 pt-3.5",
  desktop: "rounded-xl p-2 pb-5",
};

type Props = {
  category: DeviceCategory;
  landscape: boolean;
  children: ReactNode;
};

export function DeviceFrame({ category, landscape, children }: Props) {
  const showNotch = category === "phone" && !landscape;

  return (
    <div className="flex flex-col items-center">
      <div
        className={`relative border border-neutral-600 bg-gradient-to-b from-neutral-800 to-neutral-950 shadow-2xl ring-1 ring-black/50 ${BEZEL[category]}`}
      >
        {showNotch && (
          <span aria-hidden="true" className="absolute left-1/2 top-1.5 h-1.5 w-16 -translate-x-1/2 rounded-full bg-neutral-700" />
        )}
        {category === "laptop" && (
          <span aria-hidden="true" className="absolute left-1/2 top-1 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-neutral-600 ring-1 ring-neutral-500" />
        )}
        {category === "desktop" && (
          <span aria-hidden="true" className="absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-neutral-600" />
        )}
        {children}
      </div>
      {category === "laptop" && (
        <div aria-hidden="true" className="relative h-3.5 w-[calc(100%+3rem)] rounded-b-[1.4rem] bg-gradient-to-b from-neutral-300 via-neutral-400 to-neutral-500 shadow-xl">
          <span className="absolute left-1/2 top-0 h-1.5 w-24 -translate-x-1/2 rounded-b-xl bg-neutral-500/70" />
        </div>
      )}
      {category === "desktop" && (
        <>
          <div aria-hidden="true" className="h-10 w-7 bg-gradient-to-r from-neutral-500 via-neutral-300 to-neutral-500" />
          <div aria-hidden="true" className="h-2 w-28 rounded-full bg-gradient-to-b from-neutral-300 to-neutral-500 shadow-lg" />
        </>
      )}
    </div>
  );
}
