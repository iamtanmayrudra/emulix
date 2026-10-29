import type { BrowserType } from "playwright";
import type { DeviceProfile } from "@/lib/mock-data";

/**
 * Browser engine for a device's live session. "webkit" is the WebKit build bundled with the current Playwright.
 * The older ones come from Playwright releases that bundled those WebKit builds (see package.json), so Safari
 * compatibility can be checked against the engine of that version.
 */
export type BrowserEngine = NonNullable<DeviceProfile["engine"]>;
export type WebkitEngine = Exclude<BrowserEngine, "chromium">;

export function isWebkit(engine: BrowserEngine): engine is WebkitEngine {
  return engine !== "chromium";
}

/** The launcher for a WebKit engine. Chromium is launched by browser-sessions.ts with its own options. */
export async function webkitLauncher(engine: WebkitEngine): Promise<BrowserType> {
  switch (engine) {
    case "webkit":
      return (await import("playwright")).webkit;
    case "webkit-18":
      return (await import("playwright-webkit-18")).webkit as unknown as BrowserType;
    case "webkit-17":
      return (await import("playwright-webkit-17")).webkit as unknown as BrowserType;
    case "webkit-16":
      return (await import("playwright-webkit-16")).webkit as unknown as BrowserType;
    case "webkit-15":
      return (await import("playwright-webkit-15")).webkit as unknown as BrowserType;
  }
}
