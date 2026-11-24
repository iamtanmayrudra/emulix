"use client";

import { useMemo, useState } from "react";
import { BrowserControlsContext, type BrowserControls } from "@/components/device-lab/browser-controls";
import { DeviceGrid } from "@/components/device-lab/device-grid";
import { DevicePicture, type AppScreen } from "@/components/device-lab/device-picture";
import { PlusIcon } from "@/components/device-lab/icons";
import { LiveBrowser } from "@/components/device-lab/live-browser";
import { LoadingRegion, Skeleton } from "@/components/skeleton";
import { PLATFORM_LABELS, PLATFORM_ORDER, DEVICES, type Device, type DevicePlatform } from "@/lib/device-lab/devices";
import type { Plan } from "@/lib/mock-data";
import type { PublicBrowserSession } from "@/lib/testing/browser-sessions";

/** A page can be tested on two devices at once: the one that is open, and one more added with the plus button. */
export const MAX_OPEN_DEVICES = 2;

/** "26" reads as "v26". Labels such as "Safari 26" stay as they are. */
function versionLabel(osVersion: string): string {
  return /^\d/.test(osVersion) ? `v${osVersion}` : osVersion;
}

type AddDeviceButtonProps = {
  /** Disabled until the first device has a live page to copy. */
  disabled: boolean;
  onClick: () => void;
};

/**
 * The plus beside the first device. Pressing it opens the device list for the second device.
 * It is a plain ash-grey disc, a shade darker than the page behind it, so it sits quietly in the background.
 */
export function AddDeviceButton({ disabled, onClick }: AddDeviceButtonProps) {
  const label = disabled ? "Add a second device (start the test first)" : "Add a second device";
  return (
    <div className="flex flex-col items-center gap-2 self-center">
      <button
        type="button"
        aria-label={label}
        title={label}
        disabled={disabled}
        onClick={onClick}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-black/15 text-neutral-600 transition enabled:hover:bg-black/14 enabled:hover:text-neutral-800 enabled:active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-neutral-500"
      >
        <PlusIcon className="h-6 w-6" />
      </button>
      <span className="text-xs font-medium text-muted">Add device</span>
    </div>
  );
}

type SecondDeviceProps = {
  device: Device;
  /** Null while the browser opens. */
  session: PublicBrowserSession | null;
  onClose: () => void;
};

/**
 * The second device: its own live browser, with its own address bar and back, forward and reload.
 * Bug capture and DevTools belong to the first device, so they are off here.
 */
export function SecondDevice({ device, session, onClose }: SecondDeviceProps) {
  const [screen, setScreen] = useState<AppScreen>("chrome");
  const [pageUrl, setPageUrl] = useState(session?.requestedUrl ?? "");
  const sessionId = session?.id ?? null;

  const controls = useMemo<BrowserControls>(() => {
    function send(body: Record<string, unknown>) {
      if (!sessionId) return;
      void fetch(`/api/browser-sessions/${sessionId}/input`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => undefined);
    }
    return {
      live: sessionId !== null,
      navigate: (address) => send({ type: "navigate", url: address }),
      back: () => send({ type: "back" }),
      forward: () => send({ type: "forward" }),
      reload: () => send({ type: "reload" }),
      captureBug: () => undefined,
      capturingBug: false,
      devtoolsOn: false,
      toggleDevtools: () => undefined,
      devtoolsAllowed: false,
    };
  }, [sessionId]);

  return (
    <section aria-label={`Second device: ${device.name}`} className="flex min-w-0 flex-col items-center gap-3">
      <div className="flex w-full max-w-xs items-center justify-between gap-3 rounded-md bg-surface px-3 py-1.5 text-xs shadow-sm">
        <span className="min-w-0 truncate">
          <span className="font-semibold">{device.name}</span> <span className="text-muted">{versionLabel(device.osVersion)}</span>
        </span>
        <button
          type="button"
          aria-label={`Close ${device.name}`}
          onClick={onClose}
          className="shrink-0 rounded-[3px] px-1.5 text-base leading-none text-muted hover:text-danger focus-visible:outline-2 focus-visible:outline-accent"
        >
          ×
        </button>
      </div>
      <BrowserControlsContext.Provider value={controls}>
        <DevicePicture
          device={device}
          screen={screen}
          url={pageUrl || session?.requestedUrl || ""}
          onScreenChange={setScreen}
          pageContent={
            session ? (
              <LiveBrowser key={session.id} sessionId={session.id} label={session.requestedUrl} onPageUrl={setPageUrl} />
            ) : (
              <LoadingRegion label={`Opening a browser on ${device.name}`} className="flex h-full flex-col gap-3 bg-white p-4">
                <p className="text-center text-xs text-neutral-500">Opening a browser on {device.name}…</p>
                <Skeleton className="h-3 w-1/3 bg-neutral-200" />
                <Skeleton className="h-16 w-full bg-neutral-200" />
                <Skeleton className="h-3 w-5/6 bg-neutral-200" />
              </LoadingRegion>
            )
          }
        />
      </BrowserControlsContext.Provider>
    </section>
  );
}

type ChooserProps = {
  plan: Plan;
  onChoose: (device: Device) => void;
  onClose: () => void;
};

/** A dialog listing the devices, for picking the second one. */
export function DeviceChooserDialog({ plan, onChoose, onClose }: ChooserProps) {
  const [platform, setPlatform] = useState<DevicePlatform>("ios");
  const devices = DEVICES.filter((device) => device.platform === platform);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-neutral-900/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose a second device"
        className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-surface shadow-2xl"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div role="group" aria-label="Platform" className="flex gap-1">
            {PLATFORM_ORDER.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={platform === item}
                onClick={() => setPlatform(item)}
                className={`rounded-[3px] px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-accent ${
                  platform === item ? "bg-accent/15 text-accent" : "text-muted hover:text-foreground"
                }`}
              >
                {PLATFORM_LABELS[item]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[3px] px-2 py-1 text-sm font-medium text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
          >
            Close
          </button>
        </div>
        <div className="overflow-auto p-4">
          <h2 className="mb-3 text-sm font-medium">
            Choose the second device <span className="text-muted">({devices.length})</span>
          </h2>
          <DeviceGrid
            devices={devices}
            selectedId=""
            favoriteIds={[]}
            plan={plan}
            onSelect={onChoose}
            onToggleFavorite={() => undefined}
            emptyMessage="No devices on this platform."
            singleColumn={platform === "desktop"}
          />
        </div>
      </div>
    </div>
  );
}
