"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AccessRequestPanel } from "@/components/device-lab/access-request-panel";
import { DeviceDetail } from "@/components/device-lab/device-detail";
import type { AppScreen } from "@/components/device-lab/device-picture";
import { DeviceGrid } from "@/components/device-lab/device-grid";
import { DeviceSearch } from "@/components/device-lab/device-search";
import { DeviceSidebar, type DeviceView } from "@/components/device-lab/device-sidebar";
import {
  DEVICES,
  PLATFORM_LABELS,
  PLATFORM_ORDER,
  deviceMatchesQuery,
  findDevice,
  osVersionsFor,
  type Device,
  type DeviceCategory,
  type DevicePlatform,
} from "@/lib/device-lab/devices";
import { canSelectProfile } from "@/lib/entitlements";
import type { Plan } from "@/lib/mock-data";

const MAX_RECENT = 5;

/** Names of the categories in each platform's column. On iOS they read as iPhone and iPad. */
const CATEGORY_LABELS: Record<DevicePlatform, Partial<Record<DeviceCategory, string>>> = {
  ios: { phone: "iPhone", tablet: "iPad" },
  android: { phone: "Phones", tablet: "Tablets" },
  desktop: { laptop: "Laptops", desktop: "Desktops" },
};
const CATEGORY_ORDER: DeviceCategory[] = ["phone", "tablet", "laptop", "desktop"];

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
  /** Told when a device screen opens or closes, so the page can switch to its full-width session layout. */
  onDeviceOpenChange?: (open: boolean) => void;
  /** Start or stop control for the session menu. */
  sessionAction?: ReactNode;
};

/**
 * Sidebar, search, and device list for the workspace. It owns the browsing state (category, category column,
 * OS version, search, favorites, recents). The parent owns the selected device.
 * A platform opens as a list: a category column beside device columns. Clicking a device opens its screen.
 * On a device screen, the device switcher opens as an overlay over the screen.
 */
export function DeviceLabPicker({ selectedId, plan, url, pageContent, focused = false, onSelect, onDeviceOpenChange, sessionAction }: Props) {
  const [view, setView] = useState<DeviceView>(() => findDevice(selectedId)?.platform ?? "ios");
  const [category, setCategory] = useState<DeviceCategory | null>(null);
  const [osVersion, setOsVersion] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
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

  // Escape closes the device switcher overlay.
  useEffect(() => {
    if (!switcherOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSwitcherOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [switcherOpen]);

  const favorites = DEVICES.filter((device) => favoriteIds.includes(device.id));
  const recents = recentIds
    .map((id) => findDevice(id))
    .filter((device): device is Device => device !== undefined);

  const platformCounts = Object.fromEntries(
    PLATFORM_ORDER.map((platform) => [platform, DEVICES.filter((device) => device.platform === platform).length]),
  ) as Record<DevicePlatform, number>;

  // The category column lists the platform's categories. Searching covers every device on the platform, so it hides the column.
  const platformView = view === "ios" || view === "android" || view === "desktop" ? view : undefined;
  const categories =
    platformView && query.trim() === ""
      ? CATEGORY_ORDER.flatMap((value) => {
          const label = CATEGORY_LABELS[platformView][value];
          const count = DEVICES.filter((device) => device.platform === platformView && device.category === value).length;
          return label && count > 0 ? [{ category: value, label, count }] : [];
        })
      : [];
  // The first category opens by default, as in the reference layout.
  const activeCategory = categories.find((item) => item.category === category)?.category ?? categories[0]?.category ?? null;

  const base =
    view === "favorites"
      ? favorites
      : view === "recent"
        ? recents
        : DEVICES.filter((device) => device.platform === view);
  const inView = activeCategory ? base.filter((device) => device.category === activeCategory) : base;
  const visible = inView.filter(
    (device) => (osVersion === null || device.osVersion === osVersion) && deviceMatchesQuery(device, query),
  );

  const selected = findDevice(selectedId);
  const selectedRestricted = selected !== undefined && !canSelectProfile(plan, selected);
  const firstFree = DEVICES.find((device) => canSelectProfile(plan, device));

  function updateDetail(open: boolean) {
    setDetailOpen(open);
    onDeviceOpenChange?.(open);
  }

  function changeView(next: DeviceView) {
    setView(next);
    setOsVersion(null);
    setCategory(null);
    updateDetail(false);
  }

  // Inside the switcher, the platform changes without leaving the device screen.
  function choosePlatform(next: DevicePlatform) {
    setView(next);
    setOsVersion(null);
    setCategory(null);
  }

  function select(device: Device) {
    onSelect(device);
    setRecentIds((ids) => [device.id, ...ids.filter((id) => id !== device.id)].slice(0, MAX_RECENT));
  }

  // Clicking a device opens its detail screen. From the switcher, it also closes the overlay.
  function open(device: Device) {
    select(device);
    updateDetail(true);
    setSwitcherOpen(false);
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
  else title = `${PLATFORM_LABELS[view]} devices`;

  // The category column and the device columns. Used by the list page and by the switcher overlay.
  const listBody = (
    <div className="flex flex-col gap-4 lg:flex-row">
      {categories.length > 0 && (
        <ul aria-label="Device types" className="flex flex-wrap gap-1 lg:w-40 lg:shrink-0 lg:flex-col">
          {categories.map((item) => {
            const active = item.category === activeCategory;
            return (
              <li key={item.category}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategory(item.category)}
                  className={`flex w-full items-center gap-2 rounded-[3px] px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                    active ? "bg-accent/15 font-semibold text-accent" : "hover:bg-background"
                  }`}
                >
                  <span>{item.label}</span>
                  <span className="ml-auto text-xs text-muted">{item.count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="min-w-0 flex-1">
        <DeviceGrid
          devices={visible}
          selectedId={selectedId}
          favoriteIds={favoriteIds}
          plan={plan}
          onSelect={open}
          onToggleFavorite={toggleFavorite}
          emptyMessage={emptyMessage}
          singleColumn={view === "desktop"}
        />
      </div>
    </div>
  );

  // A device screen is a session page of its own: the menu, the device and its details, with no list around them.
  if ((focused || detailOpen || live) && selected) {
    const blocked = selectedRestricted && !focused;
    return (
      <section aria-label="Selected device" className="relative min-h-full">
        <div className={blocked ? "pointer-events-none opacity-30 blur-[1px]" : ""} aria-hidden={blocked || undefined}>
          <DeviceDetail
            selected={selected}
            plan={plan}
            url={url}
            screen={screen}
            onScreenChange={setScreen}
            pageContent={pageContent}
            onOpenDevices={() => setSwitcherOpen(true)}
            action={sessionAction}
          />
        </div>
        {blocked && (
          <div className="absolute inset-0 flex items-start justify-center pt-8">
            <AccessRequestPanel key={selected.id} device={selected} onDismiss={() => firstFree && select(firstFree)} />
          </div>
        )}

        {switcherOpen && (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-neutral-900/50 p-4"
            onClick={(event) => {
              if (event.target === event.currentTarget) setSwitcherOpen(false);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Choose a device"
              className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-surface shadow-2xl"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div role="group" aria-label="Platform" className="flex gap-1">
                  {PLATFORM_ORDER.map((platform) => (
                    <button
                      key={platform}
                      type="button"
                      aria-pressed={view === platform}
                      onClick={() => choosePlatform(platform)}
                      className={`rounded-[3px] px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-accent ${
                        view === platform ? "bg-accent/15 text-accent" : "text-muted hover:text-foreground"
                      }`}
                    >
                      {PLATFORM_LABELS[platform]}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setSwitcherOpen(false)}
                  className="rounded-[3px] px-2 py-1 text-sm font-medium text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
                >
                  Close
                </button>
              </div>
              <div className="overflow-auto p-4">
                <h2 className="mb-3 text-sm font-medium">
                  {title} <span className="text-muted">({inView.length})</span>
                </h2>
                {listBody}
              </div>
            </div>
          </div>
        )}
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
            <h3 id="device-list-heading" className="truncate text-sm font-medium">
              {title} <span className="text-muted">({inView.length})</span>
            </h3>
          </div>
          <span className="shrink-0 text-xs text-muted">Demo inventory</span>
        </div>

        <div className="relative">
          <div className={selectedRestricted ? "pointer-events-none opacity-30 blur-[1px]" : ""} aria-hidden={selectedRestricted || undefined}>
            {listBody}
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
