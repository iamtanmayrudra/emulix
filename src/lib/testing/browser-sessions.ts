import { randomUUID } from "node:crypto";
import { chromium, type Browser, type BrowserContext, type CDPSession, type Page } from "playwright";
import { DEVICE_PROFILES, type DeviceProfile, type Plan } from "@/lib/mock-data";
import { NAVIGATION_TIMEOUT_MS } from "./runner";
import { guardPublicRequests } from "./route-guard";
import { isWebkit, webkitLauncher } from "./webkit-engines";
import { MAX_URL_LENGTH, parseTargetUrl, resolvesToPublicAddress } from "./url-guard";

/**
 * A live headless browser session per device: Chromium for most devices, WebKit for Safari. The server streams
 * JPEG frames of the page and forwards clicks, scrolling, typing and navigation from the device screen back to it.
 */

export const MAX_ACTIVE_SESSIONS: Record<Plan, number> = { free: 1, pro: 5 };
/** Closed after this long with no input or frame requests. */
export const SESSION_IDLE_MS = 3 * 60_000;
/** Closed after this long in total, whatever the activity. */
export const SESSION_MAX_MS = 15 * 60_000;
const SWEEP_INTERVAL_MS = 15_000;
/** WebKit has no screencast protocol, so its frames are screenshots taken at this interval. */
const WEBKIT_FRAME_INTERVAL_MS = 250;
const JPEG_QUALITY = 70;
const MAX_TEXT_LENGTH = 500;
const MAX_WHEEL_DELTA = 5_000;
/** Keys the device may send. Anything else is refused, so the page cannot be driven with arbitrary chords. */
const ALLOWED_KEYS = new Set([
  "Enter",
  "Backspace",
  "Delete",
  "Tab",
  "Escape",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

export type BrowserSessionStatus = "live" | "closed";

export type PublicBrowserSession = {
  id: string;
  profileId: string;
  profileName: string;
  landscape: boolean;
  /** The address the session was started with. */
  requestedUrl: string;
  /** The address the page is on now, after any clicks or redirects. */
  currentUrl: string;
  title: string;
  viewport: { width: number; height: number };
  status: BrowserSessionStatus;
  createdAt: string;
};

export type BrowserInput =
  | { type: "click"; x: number; y: number }
  | { type: "wheel"; x: number; y: number; deltaY: number }
  | { type: "text"; text: string }
  | { type: "key"; key: string }
  | { type: "navigate"; url: string }
  | { type: "back" }
  | { type: "forward" }
  | { type: "reload" };

export class BrowserSessionFailure extends Error {
  constructor(
    readonly code:
      | "invalid_url"
      | "unknown_profile"
      | "plan_required"
      | "concurrency_limit"
      | "unsafe_target"
      | "invalid_input"
      | "launch_failed"
      | "not_found"
      | "input_failed",
    message: string,
  ) {
    super(message);
  }
}

type LiveSession = {
  id: string;
  userId: string;
  profile: DeviceProfile;
  landscape: boolean;
  requestedUrl: string;
  currentUrl: string;
  title: string;
  viewport: { width: number; height: number };
  status: BrowserSessionStatus;
  createdAt: number;
  lastActivityAt: number;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  frame: Buffer | null;
  frameSeq: number;
  /** Input is applied one action at a time, in the order it arrived. */
  queue: Promise<void>;
  sweeper: ReturnType<typeof setInterval> | null;
  /** WebKit only: takes a screenshot per tick. */
  frameTimer: ReturnType<typeof setInterval> | null;
  capturing: boolean;
};

const globalForSessions = globalThis as typeof globalThis & { __emulixBrowserSessions?: Map<string, LiveSession> };
/** Sessions that are still starting, counted against the user's limit before the browser is ready. */
const starting = new Map<string, number>();

function sessions(): Map<string, LiveSession> {
  globalForSessions.__emulixBrowserSessions ??= new Map();
  return globalForSessions.__emulixBrowserSessions;
}

function viewportFor(profile: DeviceProfile, landscape: boolean) {
  return landscape
    ? { width: profile.height, height: profile.width }
    : { width: profile.width, height: profile.height };
}

function activeCount(userId: string): number {
  let count = starting.get(userId) ?? 0;
  for (const session of sessions().values()) {
    if (session.userId === userId && session.status === "live") count += 1;
  }
  return count;
}

export async function startBrowserSession(input: {
  userId: string;
  url: string;
  profileId: string;
  landscape: boolean;
  plan: Plan;
}): Promise<PublicBrowserSession> {
  const parsed = parseTargetUrl(input.url);
  if (!parsed.ok) throw new BrowserSessionFailure("invalid_url", parsed.reason);

  const profile = DEVICE_PROFILES.find((item) => item.id === input.profileId);
  if (!profile) throw new BrowserSessionFailure("unknown_profile", "Choose a device profile from the list.");
  if (profile.minPlan === "pro" && input.plan !== "pro") {
    throw new BrowserSessionFailure("plan_required", `${profile.name} is available on Pro.`);
  }

  if (activeCount(input.userId) >= MAX_ACTIVE_SESSIONS[input.plan]) {
    throw new BrowserSessionFailure(
      "concurrency_limit",
      `You can run ${MAX_ACTIVE_SESSIONS[input.plan]} live browser at a time on your plan. Close one first.`,
    );
  }

  if (!(await resolvesToPublicAddress(parsed.url.hostname))) {
    throw new BrowserSessionFailure("unsafe_target", "That address does not resolve to a public server.");
  }

  // Reserve the slot before launching, so parallel requests cannot exceed the limit.
  starting.set(input.userId, (starting.get(input.userId) ?? 0) + 1);
  const viewport = viewportFor(profile, input.landscape);
  const isMobile = profile.kind !== "desktop";
  const engine = profile.engine ?? "chromium";
  let browser: Browser | null = null;
  try {
    browser =
      engine === "chromium"
        ? await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] })
        : await (await webkitLauncher(engine)).launch({ headless: true });
    const context = await browser.newContext({
      viewport,
      // One device pixel per CSS pixel keeps the stream light; the frame matches the viewport exactly.
      deviceScaleFactor: 1,
      isMobile,
      hasTouch: isMobile,
      acceptDownloads: false,
      serviceWorkers: "block",
    });
    await guardPublicRequests(context, () => undefined);

    const page = await context.newPage();
    const session: LiveSession = {
      id: randomUUID(),
      userId: input.userId,
      profile,
      landscape: input.landscape,
      requestedUrl: parsed.url.toString(),
      currentUrl: parsed.url.toString(),
      title: "",
      viewport,
      status: "live",
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      browser,
      context,
      page,
      frame: null,
      frameSeq: 0,
      queue: Promise.resolve(),
      sweeper: null,
      frameTimer: null,
      capturing: false,
    };
    await attachPage(session, page);
    if (engine !== "chromium") {
      session.frameTimer = setInterval(() => void captureFrame(session), WEBKIT_FRAME_INTERVAL_MS);
      session.frameTimer.unref();
    }
    // Pages opened by the site (for example target="_blank") become the active page.
    context.on("page", (next) => {
      if (session.status === "live" && next !== session.page) void attachPage(session, next);
    });
    browser.on("disconnected", () => closeLocal(session));

    sessions().set(session.id, session);
    session.sweeper = setInterval(() => sweep(session), SWEEP_INTERVAL_MS);
    session.sweeper.unref();

    // Loading continues in the background; the device screen shows frames as they arrive.
    void page.goto(session.requestedUrl, { waitUntil: "load", timeout: NAVIGATION_TIMEOUT_MS }).catch(() => undefined);

    return toPublic(session);
  } catch (error) {
    await browser?.close().catch(() => undefined);
    if (error instanceof BrowserSessionFailure) throw error;
    console.error("[browser-sessions] launch failed", error);
    throw new BrowserSessionFailure("launch_failed", "The browser could not start. Try again.");
  } finally {
    const remaining = (starting.get(input.userId) ?? 1) - 1;
    if (remaining > 0) starting.set(input.userId, remaining);
    else starting.delete(input.userId);
  }
}

/** WebKit frame: one screenshot of the active page. Skipped while the previous one is still in progress. */
async function captureFrame(session: LiveSession): Promise<void> {
  if (session.capturing || session.status !== "live") return;
  session.capturing = true;
  try {
    session.frame = await session.page.screenshot({ type: "jpeg", quality: JPEG_QUALITY, timeout: 5_000 });
    session.frameSeq += 1;
  } catch {
    // The page may be navigating or closing; the next tick tries again.
  } finally {
    session.capturing = false;
  }
}

/** Streams the page's frames and keeps the active page current when the site opens a new tab. */
async function attachPage(session: LiveSession, page: Page): Promise<void> {
  session.page = page;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) session.currentUrl = page.url();
  });
  page.on("load", () => {
    void page
      .title()
      .then((title) => {
        session.title = title.slice(0, 200);
      })
      .catch(() => undefined);
  });
  page.on("close", () => {
    if (session.page !== page || session.status !== "live") return;
    const fallback = session.context.pages().at(-1);
    if (fallback) void attachPage(session, fallback);
  });

  // WebKit has no CDP screencast; its frames come from captureFrame instead.
  if (isWebkit(session.profile.engine ?? "chromium")) return;
  const cdp: CDPSession = await session.context.newCDPSession(page);
  cdp.on("Page.screencastFrame", (frame: { data: string; sessionId: number }) => {
    if (session.page !== page) return;
    session.frame = Buffer.from(frame.data, "base64");
    session.frameSeq += 1;
    void cdp.send("Page.screencastFrameAck", { sessionId: frame.sessionId }).catch(() => undefined);
  });
  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: JPEG_QUALITY,
    maxWidth: session.viewport.width,
    maxHeight: session.viewport.height,
    everyNthFrame: 1,
  });
}

export function getUserBrowserSession(userId: string, id: string): PublicBrowserSession | null {
  const session = ownedSession(userId, id);
  return session ? toPublic(session) : null;
}

/**
 * The page's current address, and the newest frame when it is newer than `after` (null when nothing changed).
 * Returns "gone" once the session has ended.
 */
export function getLatestFrame(
  userId: string,
  id: string,
  after: number,
): { pageUrl: string; frame: { seq: number; data: Buffer } | null } | "gone" {
  const session = ownedSession(userId, id);
  if (!session || session.status !== "live") return "gone";
  session.lastActivityAt = Date.now();
  const frame = session.frame && session.frameSeq > after ? { seq: session.frameSeq, data: session.frame } : null;
  return { pageUrl: session.currentUrl, frame };
}

export function validateBrowserInput(value: unknown): { ok: true; input: BrowserInput } | { ok: false; reason: string } {
  if (typeof value !== "object" || value === null) return { ok: false, reason: "Send an action." };
  const body = value as Record<string, unknown>;

  switch (body.type) {
    case "click":
    case "wheel": {
      const { x, y } = body;
      if (!isUnitInterval(x) || !isUnitInterval(y)) return { ok: false, reason: "Position is outside the page." };
      if (body.type === "click") return { ok: true, input: { type: "click", x, y } };
      const deltaY = body.deltaY;
      if (typeof deltaY !== "number" || !Number.isFinite(deltaY) || Math.abs(deltaY) > MAX_WHEEL_DELTA) {
        return { ok: false, reason: "Scroll amount is out of range." };
      }
      return { ok: true, input: { type: "wheel", x, y, deltaY } };
    }
    case "text": {
      if (typeof body.text !== "string" || body.text.length === 0 || body.text.length > MAX_TEXT_LENGTH) {
        return { ok: false, reason: "Text must be between 1 and 500 characters." };
      }
      return { ok: true, input: { type: "text", text: body.text } };
    }
    case "key": {
      if (typeof body.key !== "string" || !ALLOWED_KEYS.has(body.key)) return { ok: false, reason: "That key is not supported." };
      return { ok: true, input: { type: "key", key: body.key } };
    }
    case "navigate": {
      if (typeof body.url !== "string" || body.url.length > MAX_URL_LENGTH) return { ok: false, reason: "Enter a full address." };
      return { ok: true, input: { type: "navigate", url: body.url } };
    }
    case "back":
    case "forward":
    case "reload":
      return { ok: true, input: { type: body.type } };
    default:
      return { ok: false, reason: "That action is not supported." };
  }
}

function isUnitInterval(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

/** Applies one input. Actions run in arrival order, and the call resolves once the page has handled it. */
export function sendBrowserInput(userId: string, id: string, input: BrowserInput): Promise<void> {
  const session = ownedSession(userId, id);
  if (!session || session.status !== "live") {
    return Promise.reject(new BrowserSessionFailure("not_found", "That browser session has ended."));
  }
  session.lastActivityAt = Date.now();
  const run = session.queue.then(() => apply(session, input));
  session.queue = run.catch(() => undefined);
  return run.catch(() => {
    throw new BrowserSessionFailure("input_failed", "The page did not respond to that action.");
  });
}

async function apply(session: LiveSession, input: BrowserInput): Promise<void> {
  const { page, viewport } = session;
  switch (input.type) {
    case "click":
      await page.mouse.click(input.x * viewport.width, input.y * viewport.height);
      return;
    case "wheel":
      await page.mouse.move(input.x * viewport.width, input.y * viewport.height);
      await page.mouse.wheel(0, input.deltaY);
      return;
    case "text":
      await page.keyboard.type(input.text);
      return;
    case "key":
      await page.keyboard.press(input.key);
      return;
    case "navigate": {
      const parsed = parseTargetUrl(input.url);
      if (!parsed.ok) throw new Error(parsed.reason);
      session.requestedUrl = parsed.url.toString();
      void page.goto(parsed.url.toString(), { waitUntil: "load", timeout: NAVIGATION_TIMEOUT_MS }).catch(() => undefined);
      return;
    }
    case "back":
      void page.goBack({ waitUntil: "load", timeout: NAVIGATION_TIMEOUT_MS }).catch(() => undefined);
      return;
    case "forward":
      void page.goForward({ waitUntil: "load", timeout: NAVIGATION_TIMEOUT_MS }).catch(() => undefined);
      return;
    case "reload":
      void page.reload({ waitUntil: "load", timeout: NAVIGATION_TIMEOUT_MS }).catch(() => undefined);
      return;
  }
}

export async function closeBrowserSession(userId: string, id: string): Promise<boolean> {
  const session = ownedSession(userId, id);
  if (!session) return false;
  await closeLocal(session);
  return true;
}

function ownedSession(userId: string, id: string): LiveSession | null {
  const session = sessions().get(id);
  return session && session.userId === userId ? session : null;
}

function sweep(session: LiveSession) {
  const now = Date.now();
  if (now - session.lastActivityAt > SESSION_IDLE_MS || now - session.createdAt > SESSION_MAX_MS) {
    void closeLocal(session);
  }
}

async function closeLocal(session: LiveSession): Promise<void> {
  if (session.status === "closed") return;
  session.status = "closed";
  if (session.sweeper) clearInterval(session.sweeper);
  if (session.frameTimer) clearInterval(session.frameTimer);
  sessions().delete(session.id);
  await session.browser.close().catch(() => undefined);
}

function toPublic(session: LiveSession): PublicBrowserSession {
  return {
    id: session.id,
    profileId: session.profile.id,
    profileName: session.profile.name,
    landscape: session.landscape,
    requestedUrl: session.requestedUrl,
    currentUrl: session.currentUrl,
    title: session.title,
    viewport: session.viewport,
    status: session.status,
    createdAt: new Date(session.createdAt).toISOString(),
  };
}
