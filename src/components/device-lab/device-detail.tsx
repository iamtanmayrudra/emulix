"use client";

import { useState, type ReactNode } from "react";
import { DeviceCard } from "@/components/device-lab/device-card";
import { DevicePicture, type AppScreen } from "@/components/device-lab/device-picture";
import { canSelectProfile } from "@/lib/entitlements";
import { PLATFORM_LABELS, PLATFORM_ORDER, type Device, type DeviceCategory, type DevicePlatform } from "@/lib/device-lab/devices";
import type { Plan } from "@/lib/mock-data";

const ZOOM_MIN = 0.6;
const ZOOM_MAX = 1.6;
const ZOOM_STEP = 0.2;

/** Order and labels of the groups inside a platform's list. */
const CATEGORY_ORDER: { category: DeviceCategory; label: string }[] = [
  { category: "phone", label: "Phones" },
  { category: "tablet", label: "Tablets" },
  { category: "laptop", label: "Laptops" },
  { category: "desktop", label: "Desktops" },
];

type Props = {
  /** Every device, shown on the left for switching. It can be switched across platforms, for example Android to iPhone. */
  devices: Device[];
  selected: Device;
  favoriteIds: string[];
  plan: Plan;
  url: string;
  screen: AppScreen;
  onScreenChange: (screen: AppScreen) => void;
  onSelectDevice: (device: Device) => void;
  onToggleFavorite: (id: string) => void;
  pageContent?: ReactNode;
  /** The platform the user picked in the sidebar. The list opens on it. */
  platformView?: DevicePlatform;
};

/**
 * Detail screen for one device: device options in a column on the left, the device picture on the right.
 * On iOS, Chrome and Safari open from the device's own home screen.
 */
export function DeviceDetail({
  devices,
  selected,
  favoriteIds,
  plan,
  url,
  screen,
  onScreenChange,
  onSelectDevice,
  onToggleFavorite,
  pageContent,
  platformView,
}: Props) {
  const [zoom, setZoom] = useState(1);
  // The platform tab follows the sidebar choice or the selected device, unless the user opens another tab here.
  const [chosenPlatform, setChosenPlatform] = useState<DevicePlatform | null>(null);
  const source = `${platformView ?? ""}|${selected.platform}`;
  const [lastSource, setLastSource] = useState(source);
  if (source !== lastSource) {
    setLastSource(source);
    setChosenPlatform(null);
  }
  const platform = chosenPlatform ?? platformView ?? selected.platform;
  const inPlatform = devices.filter((device) => device.platform === platform);
  const groups = CATEGORY_ORDER.map(({ category, label }) => ({
    label,
    items: inPlatform.filter((device) => device.category === category),
  })).filter((group) => group.items.length > 0);
  const zoomStep = (delta: number) => setZoom((value) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((value + delta) * 10) / 10)));

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="lg:w-56 lg:shrink-0">
        <p className="mb-2 text-xs font-medium text-muted">Switch device</p>
        <div role="group" aria-label="Platform" className="mb-2 grid grid-cols-3 gap-1 rounded-lg border border-border bg-background p-1 text-xs font-semibold">
          {PLATFORM_ORDER.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={platform === value}
              onClick={() => setChosenPlatform(value)}
              className={`rounded-md px-2 py-1.5 transition focus-visible:outline-2 focus-visible:outline-accent ${
                platform === value ? "bg-surface text-accent shadow-sm" : "text-muted hover:text-foreground"
              }`}
            >
              {PLATFORM_LABELS[value]}
            </button>
          ))}
        </div>
        <ul aria-label="Device options" className="max-h-[400px] space-y-1 overflow-y-auto pr-1">
          {groups.map((group) => (
            <li key={group.label} className="space-y-1">
              {groups.length > 1 && (
                <p className="px-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{group.label}</p>
              )}
              <ul className="space-y-1">
                {group.items.map((device) => (
                  <li key={device.id}>
                    <DeviceCard
                      device={device}
                      selected={device.id === selected.id}
                      favorite={favoriteIds.includes(device.id)}
                      restricted={!canSelectProfile(plan, device)}
                      onSelect={() => onSelectDevice(device)}
                      onToggleFavorite={() => onToggleFavorite(device.id)}
                    />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div role="group" aria-label="Zoom" className="flex items-center justify-end gap-1 text-sm">
          <button
            type="button"
            aria-label="Zoom out"
            disabled={zoom <= ZOOM_MIN}
            onClick={() => zoomStep(-ZOOM_STEP)}
            className="h-8 w-8 rounded-md border border-border bg-surface font-semibold hover:border-accent disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent"
          >
            −
          </button>
          <span className="w-14 text-center text-xs font-medium tabular-nums" aria-live="polite">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            aria-label="Zoom in"
            disabled={zoom >= ZOOM_MAX}
            onClick={() => zoomStep(ZOOM_STEP)}
            className="h-8 w-8 rounded-md border border-border bg-surface font-semibold hover:border-accent disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="ml-1 h-8 rounded-md border border-border bg-surface px-2 text-xs font-medium hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
          >
            Reset
          </button>
        </div>

        {/* m-auto centres the device without clipping its top edge, so the panel can scroll to every part. */}
        <div className="flex min-h-[460px] min-w-0 flex-1 overflow-auto rounded-lg bg-background p-6">
          <div className="m-auto">
            <DevicePicture
              device={selected}
              screen={screen}
              url={url}
              onScreenChange={onScreenChange}
              pageContent={pageContent}
              zoom={zoom}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
