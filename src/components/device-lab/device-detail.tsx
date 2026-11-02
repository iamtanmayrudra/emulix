"use client";

import Link from "next/link";
import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { DevicePicture, type AppScreen } from "@/components/device-lab/device-picture";
import { browsersFor } from "@/components/device-lab/device-card";
import {
  ChevronRightIcon,
  CodeIcon,
  GaugeIcon,
  GlobeIcon,
  GridIcon,
  PhoneIcon,
  ReportIcon,
  SearchIcon,
  SwitchIcon,
} from "@/components/device-lab/icons";
import { PLATFORM_LABELS, type Device } from "@/lib/device-lab/devices";
import type { Plan } from "@/lib/mock-data";

const ZOOM_MIN = 0.6;
const ZOOM_MAX = 1.6;
const ZOOM_STEP = 0.2;

type Props = {
  selected: Device;
  plan: Plan;
  url: string;
  screen: AppScreen;
  onScreenChange: (screen: AppScreen) => void;
  /** Opens the device switcher over this screen. */
  onOpenDevices: () => void;
  /** The session action at the bottom of the menu: start the test, or stop it. */
  action?: ReactNode;
  pageContent?: ReactNode;
};

type MenuItemProps = {
  icon: typeof SearchIcon;
  label: string;
  /** Tools that are not built yet are listed, dimmed and marked, so the menu keeps its full shape. */
  soon?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children?: ReactNode;
};

function MenuItem({ icon: Icon, label, soon = false, disabled = false, onClick, children }: MenuItemProps) {
  const content = (
    <>
      <Icon className="h-5 w-5 shrink-0 text-accent" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {soon && <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted">Soon</span>}
    </>
  );
  return (
    <li>
      <div className="px-3 py-1.5">
        {/* A row with no action of its own, such as Zoom, is a label for the controls beneath it. */}
        {onClick || soon ? (
          <button
            type="button"
            disabled={soon || disabled}
            onClick={onClick}
            className="flex w-full items-center gap-3 rounded-[3px] py-1 text-left text-sm enabled:hover:text-accent disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent"
          >
            {content}
          </button>
        ) : (
          <div className="flex w-full items-center gap-3 py-1 text-sm">{content}</div>
        )}
        {children}
      </div>
    </li>
  );
}

function browserLabel(device: Device): string {
  if (device.platform === "ios") return "Safari, Chrome";
  if (device.osVersion.startsWith("Safari")) return "Safari";
  return "Chrome";
}

/** "26" reads as "v26". Labels such as "Safari 26" or "Version TBD" stay as they are. */
function versionLabel(osVersion: string): string {
  return /^\d/.test(osVersion) ? `v${osVersion}` : osVersion;
}

/**
 * A USB-C charging lead. The connector sits in the device's bottom port, and the cable hangs down with a natural sag.
 */
function ChargerCable() {
  return (
    // The connector overlaps the bottom edge, so it reads as seated in the port. -26px cancels the figure's gap
    // (12px) and sinks the top 14px of the connector into the device. z-10 keeps it in front of the frame.
    <div aria-hidden="true" className="cable-plug relative z-10 -mt-[26px] flex flex-col items-center">
      <svg viewBox="0 0 56 150" width="56" height="150" className="overflow-visible">
        {/* Cable, with a sag and a highlight along one side */}
        <path d="M28 20 C28 52 42 64 38 92 S24 126 28 150" fill="none" stroke="#1d1d22" strokeWidth="5" strokeLinecap="round" />
        <path d="M26 24 C26 52 40 64 36 92 S22 126 26 146" fill="none" stroke="#4b4b55" strokeWidth="1" strokeLinecap="round" />
        {/* Strain relief, where the cable meets the connector */}
        <rect x="23" y="15" width="10" height="9" rx="3" fill="#2a2a31" />
        {/* USB-C connector: a rounded shell, the metal opening, and the tongue inside */}
        <rect x="14" y="0" width="28" height="17" rx="5" fill="#2b2b33" stroke="#55555f" strokeWidth="1" />
        <rect x="19" y="4" width="18" height="9" rx="3" fill="#b9bec8" />
        <rect x="23" y="6.5" width="10" height="4" rx="1.5" fill="#1b1b20" />
      </svg>
    </div>
  );
}

/**
 * Screen for one device, laid out as a live session: a tool menu on the left, the device in the middle, and what the user
 * is testing on at the right. On iOS, Chrome and Safari open from the device's own home screen.
 */
export function DeviceDetail({ selected, plan, url, screen, onScreenChange, onOpenDevices, action, pageContent }: Props) {
  const [zoom, setZoom] = useState(1);
  const [collapsed, setCollapsed] = useState(false);
  // The menu can be dragged by its header. The offset is kept from the drag start, so it moves smoothly.
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ pointerX: number; pointerY: number; startX: number; startY: number } | null>(null);
  // Phones and tablets charge from a cable. It shows until a live browser takes over the device.
  const hasCable = (selected.category === "phone" || selected.category === "tablet") && !pageContent;

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerX: event.clientX, pointerY: event.clientY, startX: offset.x, startY: offset.y };
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start) return;
    setOffset({ x: start.startX + event.clientX - start.pointerX, y: start.startY + event.clientY - start.pointerY });
  }

  function endDrag() {
    drag.current = null;
  }
  const zoomStep = (delta: number) => setZoom((value) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((value + delta) * 10) / 10)));
  const zoomButton = "h-7 w-7 rounded-[3px] border border-border bg-surface font-semibold hover:border-accent disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent";

  return (
    // The menu floats at the top left and the device sits in the middle of the page, with its details to the right.
    <div className="relative flex min-h-full flex-col gap-6 pb-6 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:gap-10 lg:pb-0">
      <aside
        aria-label="Session menu"
        className={`z-10 w-full self-start overflow-hidden bg-surface shadow-lg lg:absolute lg:left-0 lg:top-0 lg:rounded-br-md ${collapsed ? "lg:w-24" : "lg:w-60"}`}
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      >
        {/* Drag this bar to move the menu. Double-click it to put the menu back where it started. */}
        <div
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={() => setOffset({ x: 0, y: 0 })}
          title="Drag to move the menu"
          className="flex cursor-grab touch-none select-none items-center justify-between px-3 py-1.5 text-muted active:cursor-grabbing"
        >
          <span aria-hidden="true" className="text-lg leading-none">
            ≡
          </span>
          <button
            type="button"
            aria-label={collapsed ? "Expand menu" : "Collapse menu"}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((value) => !value)}
            className="rounded-[3px] px-1 text-base leading-none hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
          >
            {collapsed ? "↦" : "↤"}
          </button>
        </div>
        {!collapsed && (
          <>
        <ul className="py-1">
          <MenuItem icon={SwitchIcon} label="Switch browser">
            {/* Safari and Chrome on iPhone and iPad. Other devices have one browser, so the choice is shown but fixed. */}
            <div role="group" aria-label="Browser" className="mt-1 flex gap-1 pl-8">
              {browsersFor(selected).map((browser) => {
                const active = (screen === "safari" || screen === "chrome" ? screen : browsersFor(selected)[0]) === browser;
                return (
                  <button
                    key={browser}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onScreenChange(browser)}
                    className={`rounded-[3px] border px-2.5 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-accent ${
                      active ? "border-accent bg-accent/15 text-accent" : "border-border bg-surface text-muted hover:border-accent"
                    }`}
                  >
                    {browser === "safari" ? "Safari" : "Chrome"}
                  </button>
                );
              })}
            </div>
          </MenuItem>
          <MenuItem icon={GlobeIcon} label="Local testing" soon />
          <MenuItem icon={SearchIcon} label="Zoom">
            <div role="group" aria-label="Zoom" className="mt-1 flex items-center gap-1 pl-8">
              <button type="button" aria-label="Zoom out" disabled={zoom <= ZOOM_MIN} onClick={() => zoomStep(-ZOOM_STEP)} className={zoomButton}>
                −
              </button>
              <span className="w-12 text-center text-xs font-medium tabular-nums" aria-live="polite">
                {Math.round(zoom * 100)}%
              </span>
              <button type="button" aria-label="Zoom in" disabled={zoom >= ZOOM_MAX} onClick={() => zoomStep(ZOOM_STEP)} className={zoomButton}>
                +
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                className="ml-1 h-7 rounded-[3px] border border-border bg-surface px-2 text-xs font-medium hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
              >
                Reset
              </button>
            </div>
          </MenuItem>
          <MenuItem icon={ReportIcon} label="Capture a bug" soon />
          <MenuItem icon={CodeIcon} label="DevTools" soon />
          <MenuItem icon={PhoneIcon} label="Show home screen" disabled={selected.platform !== "ios" || screen === "home"} onClick={() => onScreenChange("home")} />
          <MenuItem icon={GridIcon} label="Rotate device" soon />
          <MenuItem icon={GaugeIcon} label="Throttle network" soon />
        </ul>
        <button
          type="button"
          onClick={onOpenDevices}
          aria-label={`${selected.name}. Choose another device`}
          className="flex w-full items-center gap-3 border-t border-border bg-background px-3 py-2.5 text-left text-sm hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
        >
          <PhoneIcon className="h-5 w-5 shrink-0 text-accent" />
          <span className="min-w-0 flex-1 truncate font-medium">{selected.name}</span>
          <span className="shrink-0 text-xs text-muted">{versionLabel(selected.osVersion)}</span>
          <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />
        </button>
        {action && <div className="border-t border-border">{action}</div>}
          </>
        )}
      </aside>

      <div className="flex min-w-0 flex-col items-center py-4 lg:col-start-2">
        {/* Before the test starts, the device is on charge: the lead slides up and seats in its port. */}
        <DevicePicture
          device={selected}
          screen={screen}
          url={url}
          onScreenChange={onScreenChange}
          pageContent={pageContent}
          zoom={zoom}
          cable={hasCable ? <ChargerCable /> : undefined}
        />
      </div>

      <aside aria-label="Device information" className="mx-4 text-sm lg:col-start-3 lg:mx-0 lg:max-w-[16rem] lg:justify-self-start lg:text-center">
        <p className="text-lg font-semibold leading-snug">You are testing on a real device</p>
        <dl className="mt-4 space-y-2 border-y border-neutral-400/70 py-3 text-left text-xs">
          {[
            ["Device", selected.name],
            ["Platform", PLATFORM_LABELS[selected.platform]],
            ["Version", selected.osVersion],
            ["Screen", `${selected.width} × ${selected.height}`],
            ["Browser", browserLabel(selected)],
          ].map(([term, value]) => (
            <div key={term} className="flex justify-between gap-3">
              <dt className="text-muted">{term}</dt>
              <dd className="text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-left text-[11px] text-muted">Demo inventory.</p>
        {plan === "free" && (
          <Link
            href="/pricing"
            className="mt-4 inline-block rounded-[3px] border border-neutral-500 px-4 py-1.5 text-sm font-medium hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
          >
            Buy a plan
          </Link>
        )}
      </aside>
    </div>
  );
}
