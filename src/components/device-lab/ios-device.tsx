"use client";

import type { CSSProperties, ReactNode } from "react";
import { NavButton } from "@/components/device-lab/browser-controls";
import type { DeviceCategory } from "@/lib/device-lab/devices";

/** What the screen shows: the home screen, or one browser opened as an app. */
export type AppScreen = "home" | "chrome" | "safari";

type AppDef = {
  id: "safari" | "chrome" | "settings" | "photos" | "camera" | "mail" | "messages" | "maps" | "calendar" | "notes" | "clock" | "weather" | "store" | "music" | "files" | "health" | "wallet" | "reminders";
  name: string;
  /** Tailwind classes for the icon background. */
  bg: string;
  /** Tailwind text colour for the glyph. */
  fg: string;
  glyph: string;
};

/** Generic icons drawn for the demo. They are not the official app artwork. */
const APPS: AppDef[] = [
  { id: "safari", name: "Safari", bg: "bg-gradient-to-b from-sky-300 to-blue-600", fg: "text-white", glyph: "◎" },
  { id: "chrome", name: "Chrome", bg: "bg-white", fg: "text-blue-500", glyph: "◉" },
  { id: "settings", name: "Settings", bg: "bg-neutral-500", fg: "text-white", glyph: "⚙" },
  { id: "photos", name: "Photos", bg: "bg-gradient-to-br from-amber-200 via-rose-300 to-sky-400", fg: "text-white", glyph: "❀" },
  { id: "camera", name: "Camera", bg: "bg-neutral-700", fg: "text-white", glyph: "◉" },
  { id: "mail", name: "Mail", bg: "bg-blue-500", fg: "text-white", glyph: "✉" },
  { id: "messages", name: "Messages", bg: "bg-green-500", fg: "text-white", glyph: "✎" },
  { id: "maps", name: "Maps", bg: "bg-emerald-500", fg: "text-white", glyph: "◈" },
  { id: "calendar", name: "Calendar", bg: "bg-white", fg: "text-red-500", glyph: "▦" },
  { id: "notes", name: "Notes", bg: "bg-yellow-300", fg: "text-neutral-700", glyph: "▤" },
  { id: "clock", name: "Clock", bg: "bg-neutral-900", fg: "text-white", glyph: "◷" },
  { id: "weather", name: "Weather", bg: "bg-sky-400", fg: "text-white", glyph: "☀" },
  { id: "store", name: "App Store", bg: "bg-sky-500", fg: "text-white", glyph: "A" },
  { id: "music", name: "Music", bg: "bg-rose-500", fg: "text-white", glyph: "♫" },
  { id: "files", name: "Files", bg: "bg-blue-400", fg: "text-white", glyph: "▥" },
  { id: "health", name: "Health", bg: "bg-pink-400", fg: "text-white", glyph: "♥" },
  { id: "wallet", name: "Wallet", bg: "bg-neutral-800", fg: "text-white", glyph: "▣" },
  { id: "reminders", name: "Reminders", bg: "bg-white", fg: "text-neutral-700", glyph: "•" },
];

const DOCK: AppDef[] = [
  { id: "messages", name: "Phone", bg: "bg-green-500", fg: "text-white", glyph: "✆" },
  { id: "music", name: "Music", bg: "bg-rose-500", fg: "text-white", glyph: "♫" },
  { id: "files", name: "Files", bg: "bg-blue-400", fg: "text-white", glyph: "▥" },
  { id: "camera", name: "Camera", bg: "bg-neutral-700", fg: "text-white", glyph: "◉" },
];

type Props = {
  category: DeviceCategory;
  /** Screen size in CSS pixels, already scaled to fit the page. */
  width: number;
  height: number;
  screen: AppScreen;
  url: string;
  onScreenChange: (screen: AppScreen) => void;
  /** Live browser session for this device, shown inside the browser app. */
  pageContent?: ReactNode;
};

/** Pixel size helper, so every part of the device scales with the screen. */
function px(value: number): string {
  return `${Math.round(value * 10) / 10}px`;
}

/**
 * A drawn iOS device: titanium-style bezel, rounded screen, side buttons, Dynamic Island (phones),
 * status bar, home screen with app icons and dock, and the browser opened as an app.
 */
export function IosDevice({ category, width, height, screen, url, onScreenChange, pageContent }: Props) {
  const isTablet = category === "tablet";
  const bezel = isTablet ? width * 0.032 : width * 0.05;
  const radius = isTablet ? width * 0.075 : width * 0.155;
  const sideButton = (style: CSSProperties) => (
    <span aria-hidden="true" className="absolute rounded-sm bg-gradient-to-b from-neutral-300 to-neutral-500" style={style} />
  );

  return (
    <div
      className="relative shrink-0 bg-gradient-to-b from-neutral-300 via-neutral-500 to-neutral-400 shadow-2xl ring-1 ring-black/40"
      style={{ padding: px(bezel), borderRadius: px(radius + bezel) }}
    >
      {!isTablet && (
        <>
          {sideButton({ left: px(-3), top: px(height * 0.19), width: px(3), height: px(height * 0.05) })}
          {sideButton({ left: px(-3), top: px(height * 0.28), width: px(3), height: px(height * 0.09) })}
          {sideButton({ left: px(-3), top: px(height * 0.39), width: px(3), height: px(height * 0.09) })}
          {sideButton({ right: px(-3), top: px(height * 0.3), width: px(3), height: px(height * 0.12) })}
        </>
      )}

      <div className="relative overflow-hidden bg-black" style={{ width: px(width), height: px(height), borderRadius: px(radius) }}>
        <IosScreen
          width={width}
          height={height}
          isTablet={isTablet}
          screen={screen}
          url={url}
          onScreenChange={onScreenChange}
          pageContent={pageContent}
        />
        {/* Hardware cutout */}
        {isTablet ? (
          <span aria-hidden="true" className="absolute left-1/2 top-[1.4%] z-20 -translate-x-1/2 rounded-full bg-neutral-800" style={{ width: px(width * 0.012), height: px(width * 0.012) }} />
        ) : (
          <span
            aria-hidden="true"
            className="absolute left-1/2 z-20 -translate-x-1/2 rounded-full bg-black"
            style={{ top: px(height * 0.012), width: px(width * 0.31), height: px(width * 0.09) }}
          />
        )}

      </div>
    </div>
  );
}

/**
 * The content of an iOS screen: wallpaper or browser page, status bar, home screen or browser app, and the
 * home indicator. It fills its parent, so it can sit inside a drawn device or on top of a licensed frame.
 */
export function IosScreen({ width, height, isTablet, screen, url, onScreenChange, pageContent }: ScreenProps) {
  const onDark = screen === "home";
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {onDark ? (
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-violet-500 to-fuchsia-400" />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-white" />
      )}

      <StatusBar width={width} height={height} isTablet={isTablet} onDark={onDark} />

      {screen === "home" ? (
        <HomeScreen width={width} height={height} isTablet={isTablet} onOpen={onScreenChange} />
      ) : (
        <BrowserApp kind={screen} url={url} width={width} height={height} isTablet={isTablet} pageContent={pageContent} />
      )}

      {/* Home indicator: leaves the app and returns to the home screen */}
      <button
        type="button"
        aria-label="Go to home screen"
        disabled={screen === "home"}
        onClick={() => onScreenChange("home")}
        className={`absolute left-1/2 z-30 -translate-x-1/2 rounded-full disabled:cursor-default ${onDark ? "bg-white/85" : "bg-black/80"}`}
        style={{ bottom: px(height * 0.012), width: px(width * 0.35), height: px(Math.max(6, width * 0.02)) }}
      />
    </div>
  );
}

type ScreenProps = {
  width: number;
  height: number;
  isTablet: boolean;
  screen: AppScreen;
  url: string;
  onScreenChange: (screen: AppScreen) => void;
  /** Live browser session for this device, shown inside the browser app. */
  pageContent?: ReactNode;
};

function StatusBar({ width, height, isTablet, onDark }: { width: number; height: number; isTablet: boolean; onDark: boolean }) {
  const text = onDark ? "text-white" : "text-black";
  return (
    <div
      className={`absolute inset-x-0 top-0 z-10 flex items-center justify-between font-semibold ${text}`}
      style={{
        height: px(height * (isTablet ? 0.045 : 0.06)),
        paddingLeft: px(width * (isTablet ? 0.05 : 0.09)),
        paddingRight: px(width * (isTablet ? 0.05 : 0.09)),
        fontSize: px(width * 0.042),
      }}
    >
      <span>9:41</span>
      <span className="flex items-center" style={{ gap: px(width * 0.02) }}>
        <span aria-hidden="true" className="flex items-end" style={{ gap: px(width * 0.008) }}>
          {[0.4, 0.6, 0.8, 1].map((level) => (
            <span key={level} className="rounded-sm bg-current" style={{ width: px(width * 0.012), height: px(width * 0.04 * level) }} />
          ))}
        </span>
        <span aria-hidden="true" className="flex items-center" style={{ gap: px(width * 0.006) }}>
          <span className="rounded-[2px] border border-current" style={{ width: px(width * 0.075), height: px(width * 0.036), padding: px(width * 0.003) }}>
            <span className="block h-full w-[80%] rounded-[1px] bg-current" />
          </span>
        </span>
      </span>
    </div>
  );
}

function AppIcon({ app, size, dot, onOpen }: { app: AppDef; size: number; dot?: boolean; onOpen?: () => void }) {
  const body = (
    <div className="flex flex-col items-center" style={{ gap: px(size * 0.1), width: px(size * 1.25) }}>
      <div
        aria-hidden="true"
        className={`flex items-center justify-center rounded-[22%] shadow-md ${app.bg} ${app.fg}`}
        style={{ width: px(size), height: px(size), fontSize: px(size * 0.5), lineHeight: 1 }}
      >
        {app.glyph}
      </div>
      <span className="max-w-full truncate text-center text-white" style={{ fontSize: px(size * 0.2) }}>
        {app.name}
      </span>
      <span aria-hidden="true" className={`rounded-full ${dot ? "bg-white" : "bg-transparent"}`} style={{ width: px(size * 0.06), height: px(size * 0.06) }} />
    </div>
  );
  if (!onOpen) return body;
  return (
    <button type="button" onClick={onOpen} aria-label={`Open ${app.name}`} className="rounded-[22%] focus-visible:outline-2 focus-visible:outline-white">
      {body}
    </button>
  );
}

/** Safari and Chrome can be opened from the home screen. Other icons are decorative. */
function isBrowserApp(app: AppDef): app is AppDef & { id: "safari" | "chrome" } {
  return app.id === "safari" || app.id === "chrome";
}

function HomeScreen({
  width,
  height,
  isTablet,
  onOpen,
}: {
  width: number;
  height: number;
  isTablet: boolean;
  onOpen: (screen: AppScreen) => void;
}) {
  const columns = isTablet ? 6 : 4;
  const count = isTablet ? 18 : 16;
  const iconSize = width * (isTablet ? 0.105 : 0.165);
  const apps = APPS.slice(0, count);

  return (
    <div className="absolute inset-0 z-0 flex flex-col" style={{ paddingTop: px(height * (isTablet ? 0.1 : 0.13)) }}>
      <div
        className="grid justify-items-center"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          rowGap: px(height * 0.025),
          paddingLeft: px(width * 0.06),
          paddingRight: px(width * 0.06),
        }}
      >
        {apps.map((app) => (
          <AppIcon
            key={app.id + app.name}
            app={app}
            size={iconSize}
            onOpen={isBrowserApp(app) ? () => onOpen(app.id) : undefined}
          />
        ))}
      </div>

      <div
        className="absolute left-1/2 flex -translate-x-1/2 items-center justify-around rounded-[24%] bg-white/25 backdrop-blur"
        style={{
          bottom: px(height * 0.035),
          width: px(width * 0.88),
          height: px(iconSize * 1.2),
          paddingLeft: px(width * 0.03),
          paddingRight: px(width * 0.03),
        }}
      >
        {DOCK.map((app) => (
          <AppIcon key={app.name} app={app} size={iconSize * 0.84} />
        ))}
      </div>
    </div>
  );
}

function BrowserApp({
  kind,
  url,
  width,
  height,
  isTablet,
  pageContent,
}: {
  kind: "chrome" | "safari";
  url: string;
  width: number;
  height: number;
  isTablet: boolean;
  pageContent?: ReactNode;
}) {
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  })();
  const topPad = height * (isTablet ? 0.075 : 0.1);
  const small = { fontSize: px(width * 0.036) };

  return (
    <div className="absolute inset-0 z-0 flex flex-col text-black" style={{ paddingTop: px(topPad) }}>
      {kind === "safari" ? (
        <div className="flex items-center justify-center px-3 py-1 text-neutral-500" style={small}>
          <span className="rounded-full bg-neutral-100 px-3 py-1 font-medium text-neutral-800">{host}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 border-b border-neutral-200 px-3 py-2" style={small}>
          <span className="flex min-w-0 flex-1 items-center gap-1 rounded-full bg-neutral-100 px-3 py-1.5 text-neutral-700">
            <span aria-hidden="true">🔒</span>
            <span className="truncate">{host}</span>
          </span>
          <span className="rounded-md border border-neutral-400 px-1.5">1</span>
        </div>
      )}

      {pageContent ? (
        // The bottom toolbar overlays the screen, so the page stops above it and its links stay clickable.
        <div className="relative min-h-0 flex-1 overflow-hidden" style={{ marginBottom: px(height * 0.13) }}>
          {pageContent}
          {kind === "safari" && (
            <p className="pointer-events-none absolute inset-x-0 top-0 bg-white/90 px-2 py-0.5 text-center text-neutral-500" style={{ fontSize: px(width * 0.028) }}>
              Safari is not rendered here. This is a live Chromium session.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 p-4 text-center text-neutral-500" style={small}>
          <p className="font-semibold text-neutral-800">{host}</p>
          <p>Start a test to open this page.</p>
          <p style={{ fontSize: px(width * 0.03) }}>The page runs in a live headless Chromium session on the server.</p>
        </div>
      )}

      {kind === "safari" ? (
        <div className="absolute inset-x-3 flex items-center justify-between rounded-full bg-neutral-100 px-4 py-2 text-neutral-700" style={{ bottom: px(height * 0.05), ...small }}>
          <span>aA</span>
          <span className="truncate px-2">{host}</span>
          <NavButton action="reload" size={Math.round(width * 0.045)} className="h-6 w-6" />
        </div>
      ) : (
        <div className="absolute inset-x-0 flex justify-around border-t border-neutral-200 bg-white py-2 text-neutral-600" style={{ bottom: 0, paddingBottom: px(height * 0.035), ...small }}>
          <NavButton action="back" size={Math.round(width * 0.05)} className="h-7 w-7" />
          <NavButton action="forward" size={Math.round(width * 0.05)} className="h-7 w-7" />
          <NavButton action="reload" size={Math.round(width * 0.05)} className="h-7 w-7" />
          <span aria-hidden="true">⋮</span>
        </div>
      )}
    </div>
  );
}
