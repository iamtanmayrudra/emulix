"use client";

import Link from "next/link";
import { useState } from "react";
import type { Device } from "@/lib/device-lab/devices";

type Props = {
  device: Device;
  /** Switches the selection back to a device the current plan includes. */
  onDismiss: () => void;
};

/** Shown over the list when the selected device needs a higher plan. The request is simulated; no backend exists yet. */
export function AccessRequestPanel({ device, onDismiss }: Props) {
  const [requested, setRequested] = useState(false);

  return (
    <section
      aria-labelledby="access-heading"
      className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 text-center text-sm shadow-lg"
    >
      <h3 id="access-heading" className="font-semibold">
        {device.name} is included in Pro
      </h3>
      <p className="mt-1 text-muted">Your current plan does not include this device. Pro unlocks the full device list.</p>

      <button
        type="button"
        disabled={requested}
        onClick={() => setRequested(true)}
        className="mt-4 rounded-md bg-success px-4 py-2 font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-80"
      >
        {requested ? "Request Sent" : "Request Access"}
      </button>
      {requested && <p className="mt-2 text-xs text-muted">Demo only: no request was sent.</p>}

      <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-xs">
        <Link href="/checkout" className="font-semibold text-pro hover:underline">
          Upgrade to Pro
        </Link>
        <button type="button" onClick={onDismiss} className="font-medium text-accent hover:underline">
          Choose a free device
        </button>
      </div>
    </section>
  );
}
