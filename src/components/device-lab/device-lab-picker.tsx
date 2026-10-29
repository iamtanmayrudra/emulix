"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AccessRequestPanel } from "@/components/device-lab/access-request-panel";
import { DeviceDetail } from "@/components/device-lab/device-detail";
import type { AppScreen } from "@/components/device-lab/device-picture";
import { DeviceGrid } from "@/components/device-lab/device-grid";
import { DeviceSearch } from "@/components/device-lab/device-search";
import { DeviceSidebar, type DeviceView } from "@/components/device-lab/device-sidebar";
import { ChevronRightIcon } from "@/components/device-lab/icons";
import {
  DEVICES,
  IOS_FAMILY_LABELS,
  PLATFORM_LABELS,
  PLATFORM_ORDER,
  deviceMatchesQuery,
  findDevice,
  osVersionsFor,
  type Device,
  type DevicePlatform,
} from "@/lib/device-lab/devices";
import { canSelectProfile } from "@/lib/entitlements";
import type { Plan } from "@/lib/mock-data";

const MAX_RECENT = 5;

type IosFamily = "phone" | "tablet";

type Props = {
  selectedId: string;
  plan: Plan;
  /** The address from the URL bar, shown inside the device picture. */
  url: string;
  /** Live browser session for the selected device, when it is running. */
  pageContent?: ReactNode;
  /** After a test starts, show only the device and its list. */
  focused?: boolean;
  onSelect: (device: Device) => void;
};

/**
 * Sidebar, search, and device list for the workspace. It owns the browsing state (category, iOS family,
 * OS version, search, favorites, recents). The parent owns the selected device.
 */
export function DeviceLabPicker({ selectedId, plan, url, pageContent, focused = false, onSelect }: Props) {
  const [view, setView] = useState<DeviceView>(() => findDevice(selectedId)?.platform ?? "ios");
  const [family, setFamily] = useState<IosFamily | null>(null);
  const [osVersion, setOsVersion] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [screen, setScreen] = useState<AppScreen>("home");
  const searchRef = useRef<HTMLInputElement>(null);
  // A live browser session opens Chrome on the device, so the page is visible straight away.
  const live = pageContent !== undefined;
  const [wasLive, setWasLive] = useState(live);
  if (live !== wasLive) {
    setWasLive(live);
    if (live) setScreen("chrome");
  }

  // "/" focuses search, as in the reference design, unless the user is already typing somewhere.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      event.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const favorites = DEVICES.filter((device) => favoriteIds.includes(device.id));
  const recents = recentIds
    .map((id) => findDevice(id))
    .filter((device): device is Device => device !== undefined);

  const iosDevices = DEVICES.filter((device) => device.platform === "ios");
  const iosFamilyCount = (value: IosFamily) => iosDevices.filter((device) => device.category === value).length;

  const platformCounts = Object.fromEntries(
    PLATFORM_ORDER.map((platform) => [platform, DEVICES.filter((device) => device.platform === platform).length]),
  ) as Record<DevicePlatform, number>;

  // iOS shows the two family rows until the user picks iPhone or iPad, or starts a search.
  const showFamilyRows = view === "ios" && family === null && query.trim() === "";
  // A platform in the sidebar opens the device column directly, unless favourites, recents or a filter are in use.
  const platformView = view === "ios" || view === "android" || view === "desktop" ? view : undefined;
  const showColumn = platformView !== undefined && query.trim() === "" && osVersion === null;

  const inView =
    view === "favorites"
      ? favorites
      : view === "recent"
        ? recents
        : view === "ios"
          ? family
            ? iosDevices.filter((device) => device.category === family)
            : iosDevices
          : DEVICES.filter((device) => device.platform === view);
  const visible = inView.filter(
    (device) => (osVersion === null || device.osVersion === osVersion) && deviceMatchesQuery(device, query),
  );

  const selected = findDevice(selectedId);
  const selectedRestricted = selected !== undefined && !canSelectProfile(plan, selected);
  const firstFree = DEVICES.find((device) => canSelectProfile(plan, device));

  function changeView(next: DeviceView) {
    setView(next);
    setOsVersion(null);
    setFamily(null);
    setDetailOpen(false);
  }

  function select(device: Device) {
    onSelect(device);
    setRecentIds((ids) => [device.id, ...ids.filter((id) => id !== device.id)].slice(0, MAX_RECENT));
  }

  // Clicking a device opens its detail screen.
  function open(device: Device) {
    select(device);
    setDetailOpen(true);
  }

  function toggleFavorite(id: string) {
    setFavoriteIds((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]));
  }

  const emptyMessage =
    query || osVersion
      ? "No devices match these filters. Clear the search or choose another OS version."
      : view === "favorites"
        ? "No favorites yet. Use the star on a device to save it here."
        : view === "recent"
          ? "No recent devices. Devices you select appear here."
          : "No devices in this category.";

  let title: string;
  if (view === "favorites") title = "Favorites";
  else if (view === "recent") title = "Recent tests";
  else if (view === "ios") title = family ? `${IOS_FAMILY_LABELS[family]} models` : "iOS devices";
  else title = `${PLATFORM_LABELS[view]} devices`;

  if (focused && selected) {
    return (
      <section aria-label="Selected device" className="p-4">
        <DeviceDetail
          devices={DEVICES}
          selected={selected}
          favoriteIds={favoriteIds}
          plan={plan}
          url={url}
          screen={screen}
          onScreenChange={setScreen}
          onSelectDevice={select}
          onToggleFavorite={toggleFavorite}
          pageContent={pageContent}
        />
      </section>
    );
  }

  return (
    <div className="flex flex-col md:flex-row">
      <aside className="space-y-3 border-b border-border p-3 md:w-56 md:shrink-0 md:border-b-0 md:border-r">
        <DeviceSearch value={query} onChange={setQuery} inputRef={searchRef} />
        <DeviceSidebar
          view={view}
          onViewChange={changeView}
          favoriteCount={favorites.length}
          recentCount={recents.length}
          totalCount={DEVICES.length}
          platformCounts={platformCounts}
          osVersions={view === "favorites" || view === "recent" ? [] : osVersionsFor(view)}
          osVersion={osVersion}
          onOsVersionChange={setOsVersion}
        />
      </aside>

      <section aria-labelledby="device-list-heading" className="min-w-0 flex-1 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {((view === "ios" && family) || detailOpen) && (
              <button
                type="button"
                // From a device screen, back returns to the device list. From a list, back returns to the iOS rows.
                onClick={() => (detailOpen ? setDetailOpen(false) : setFamily(null))}
                className="shrink-0 rounded-[3px] px-2 py-1 text-xs font-medium text-accent hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent"
              >
                ← Back
              </button>
            )}
            <h3 id="device-list-heading" className="truncate text-sm font-medium">
              {title}{" "}
              {!showFamilyRows && <span className="text-muted">({inView.length})</span>}
            </h3>
          </div>
          <span className="shrink-0 text-xs text-muted">Demo inventory</span>
        </div>

        <div className="relative">
          <div className={selectedRestricted ? "pointer-events-none opacity-30 blur-[1px]" : ""} aria-hidden={selectedRestricted || undefined}>
            {(detailOpen || showColumn) && selected && !showFamilyRows ? (
              <DeviceDetail
                devices={DEVICES}
                selected={selected}
                favoriteIds={favoriteIds}
                plan={plan}
                url={url}
                screen={screen}
                onScreenChange={setScreen}
                pageContent={pageContent}
                onSelectDevice={select}
                onToggleFavorite={toggleFavorite}
                platformView={platformView}
              />
            ) : showFamilyRows ? (
              <ul aria-label="iOS device families" className="space-y-2">
                {(["phone", "tablet"] as IosFamily[]).map((value) => (
                  <li key={value}>
                    <button
                      type="button"
                      onClick={() => setFamily(value)}
                      className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-background px-4 py-3 text-left hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      <span>
                        <span className="block text-sm font-semibold">{IOS_FAMILY_LABELS[value]}</span>
                        <span className="block text-xs text-muted">
                          {iosFamilyCount(value)} models · latest iOS
                        </span>
                      </span>
                      <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <DeviceGrid
                devices={visible}
                selectedId={selectedId}
                favoriteIds={favoriteIds}
                plan={plan}
                onSelect={open}
                onToggleFavorite={toggleFavorite}
                emptyMessage={emptyMessage}
              />
            )}
          </div>

          {selected && selectedRestricted && (
            <div className="absolute inset-0 flex items-start justify-center pt-8">
              <AccessRequestPanel
                key={selected.id}
                device={selected}
                onDismiss={() => firstFree && select(firstFree)}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
