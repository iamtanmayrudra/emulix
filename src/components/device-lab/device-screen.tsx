"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";

type Props = {
  width: number;
  height: number;
  screenshotSrc: string | null;
  screenshotAlt: string;
  /** Shown when there is no screenshot, for example while a run is queued or running. */
  children?: ReactNode;
};

export function DeviceScreen({ width, height, screenshotSrc, screenshotAlt, children }: Props) {
  // Remember which source failed, so a new run's screenshot gets a fresh attempt.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = screenshotSrc !== null && failedSrc === screenshotSrc;

  return (
    <div className="relative overflow-hidden bg-background" style={{ width, height }}>
      {screenshotSrc && !failed ? (
        <Image
          src={screenshotSrc}
          alt={screenshotAlt}
          width={width}
          height={height}
          unoptimized
          onError={() => setFailedSrc(screenshotSrc)}
          className="h-full w-full object-contain"
        />
      ) : (
        <div role="status" className="flex h-full w-full items-center justify-center p-4 text-center text-sm text-muted">
          {failed ? "Screenshot could not be loaded." : children}
        </div>
      )}
    </div>
  );
}
