import { randomUUID } from "node:crypto";
import type { Browser, BrowserContext, CDPSession, Page, Request } from "playwright";
import { DEVICE_PROFILES, type DeviceProfile, type Plan } from "@/lib/mock-data";
import type { BugCapture } from "./bug-report";
import { NAVIGATION_TIMEOUT_MS, type ConsoleEntry, type FailedRequest, type HttpErrorEntry } from "./runner";
import {
  addConsoleEntry,
  addRequest,
  completeRequest,
  createDevtoolsLog,
  failRequest,
  readDevtools,
  setRequestSize,
  sourceFromStack,
  type DevtoolsLog,
  type DevtoolsRequest,
  type DevtoolsSnapshot,
} from "./devtools";
import { guardPublicRequests } from "./route-guard";
import { isWebkit, webkitLauncher } from "./webkit-engines";
import { recordSessionEnd, recordSessionStart } from "@/lib/reports/history";
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
/** Each kind of page evidence keeps the newest entries only, so a noisy page cannot grow a session without limit. */
const MAX_DIAGNOSTICS = 50;
const BUG_SCREENSHOT_TIMEOUT_MS = 10_000;
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
  // Named actions, so the device cannot send arbitrary chords. The server turns them into the key combination for its OS.
  "ShiftTab",
  "SelectAll",
  "Undo",
  "Redo",
]);

/** The key combination for each named action. The modifier is Meta on a Mac and Control everywhere else. */
function chord(key: string): string {
  const modifier = process.platform === "darwin" ? "Meta" : "Control";
  switch (key) {
    case "ShiftTab":
      return "Shift+Tab";
    case "SelectAll":
      return `${modifier}+A`;
    case "Undo":
      return `${modifier}+Z`;
    case "Redo":
      return `${modifier}+Shift+Z`;
    default:
      return key;
  }
}

/** The longest text a paste may carry. */
const MAX_PASTE_LENGTH = 2_000;
/** The longest value a date, time or colour picker can produce is far shorter than this. */
const MAX_VALUE_LENGTH = 40;

/**
 * Chromium and WebKit open a drop-down, date or colour picker in a native window that a headless browser never draws,
 * and then keep the keyboard for it. So the page ignores the press that would open one. The device shows its own list or
 * picker instead (see PageControl), and the choice is written to the element.
 */
const NATIVE_POPUP_GUARD = `
  (() => {
    const pickerTypes = new Set(["date", "time", "datetime-local", "month", "week", "color"]);
    addEventListener("mousedown", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const select = target.closest("select");
      if (select && !select.multiple && !(select.size > 1)) return event.preventDefault();
      const input = target.closest("input");
      if (input && pickerTypes.has(input.type)) event.preventDefault();
    }, true);
  })();
`;

const PICKER_INPUT_TYPES = ["date", "time", "datetime-local", "month", "week", "color"] as const;
type PickerInputType = (typeof PICKER_INPUT_TYPES)[number];

/** A control under the pointer that needs a picker of the device's own, because the browser's cannot be seen. */
export type PageControl =
  | {
      kind: "select";
      /** Where the control sits in the viewport, as 0 to 1 of its width and height. */
      rect: { x: number; y: number; width: number; height: number };
      options: { label: string; selected: boolean; disabled: boolean }[];
    }
  | {
      kind: "value";
      rect: { x: number; y: number; width: number; height: number };
      inputType: PickerInputType;
      value: string;
      min: string;
      max: string;
      step: string;
    };

/** What an input returns. A press that ends on a drop-down or picker also returns that control. */
export type InputResult = { control?: PageControl };

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
  | { type: "down"; x: number; y: number; clickCount: number }
  | { type: "up"; x: number; y: number; clickCount: number }
  | { type: "move"; x: number; y: number }
  | { type: "wheel"; x: number; y: number; deltaY: number }
  | { type: "text"; text: string }
  | { type: "paste"; text: string }
  | { type: "select"; x: number; y: number; index: number }
  | { type: "setValue"; x: number; y: number; value: string }
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
      | "input_failed"
      | "capture_failed",
    message: string,
  ) {
    super(message);
  }
}

/** What the page has reported since the session began. Read when the tester captures a bug. */
type Diagnostics = {
  consoleMessages: ConsoleEntry[];
  pageErrors: string[];
  failedRequests: FailedRequest[];
  httpErrors: HttpErrorEntry[];
};

function emptyDiagnostics(): Diagnostics {
  return { consoleMessages: [], pageErrors: [], failedRequests: [], httpErrors: [] };
}

function remember<T>(list: T[], entry: T): void {
  list.push(entry);
  if (list.length > MAX_DIAGNOSTICS) list.shift();
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
  diagnostics: Diagnostics;
  /** Everything the page logged and requested, for the Pro DevTools panel. */
  devtools: DevtoolsLog;
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
        ? await (await import("playwright")).chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] })
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
    await context.addInitScript({ content: NATIVE_POPUP_GUARD });
    const diagnostics = emptyDiagnostics();
    await guardPublicRequests(context, (blockedUrl) =>
      remember(diagnostics.failedRequests, { url: blockedUrl, reason: "Blocked: non-public address" }),
    );

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
      diagnostics,
      devtools: createDevtoolsLog(),
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
    recordSessionStart({ id: session.id, userId: session.userId, url: session.requestedUrl, profileName: profile.name, startedAt: new Date(session.createdAt).toISOString() });
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
  const { diagnostics, devtools } = session;
  // The DevTools panel shows every request, so each one is tracked from start to finish.
  const tracked = new WeakMap<Request, DevtoolsRequest>();
  page.on("request", (request) => {
    tracked.set(request, addRequest(devtools, { method: request.method(), url: request.url(), resourceType: request.resourceType() }));
  });
  page.on("console", (message) => {
    // Chrome reports line numbers from zero, and the panel shows them from one, as Chrome does.
    addConsoleEntry(devtools, message.type(), message.text(), message.location());
    if (message.type() === "error" || message.type() === "warning") {
      remember(diagnostics.consoleMessages, { type: message.type(), text: message.text().slice(0, 500) });
    }
  });
  page.on("pageerror", (error) => {
    const detail = String(error.stack ?? error.message ?? error);
    addConsoleEntry(devtools, "exception", detail, sourceFromStack(detail));
    remember(diagnostics.pageErrors, detail.slice(0, 1_000));
  });
  page.on("requestfinished", (request) => {
    const entry = tracked.get(request);
    if (!entry) return;
    // Sizes are best effort: an engine may not report them, and the page may close first.
    void request
      .sizes()
      .then((sizes) => setRequestSize(devtools, entry, sizes.responseBodySize + sizes.responseHeadersSize))
      .catch(() => undefined);
  });
  page.on("requestfailed", (request) => {
    const reason = request.failure()?.errorText ?? "failed";
    const entry = tracked.get(request);
    if (entry) failRequest(devtools, entry, reason);
    // Requests the guard blocked are already recorded by the guard.
    if (!reason.includes("blockedbyclient")) remember(diagnostics.failedRequests, { url: request.url(), reason });
  });
  page.on("response", (response) => {
    const entry = tracked.get(response.request());
    if (entry) completeRequest(devtools, entry, response.status());
    if (response.status() >= 400) remember(diagnostics.httpErrors, { url: response.url(), status: response.status() });
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

/**
 * The page's console and network log for the DevTools panel. Returns null when nothing changed since `after`, the version
 * the caller already has. Plan checks belong to the caller; throws "not_found" once the session has ended.
 */
export function getDevtools(userId: string, id: string, after: number): DevtoolsSnapshot | null {
  const session = ownedSession(userId, id);
  if (!session || session.status !== "live") {
    throw new BrowserSessionFailure("not_found", "That browser session has ended.");
  }
  // Reading the log counts as activity, so an open panel keeps its session from timing out as idle.
  session.lastActivityAt = Date.now();
  return readDevtools(session.devtools, after);
}

/**
 * Freezes the moment a tester spots a bug: a full-resolution screenshot of the page as it is now, plus the errors the page
 * has reported so far. Throws "not_found" once the session has ended and "capture_failed" if the page cannot be captured.
 */
export async function captureBug(userId: string, id: string): Promise<BugCapture> {
  const session = ownedSession(userId, id);
  if (!session || session.status !== "live") {
    throw new BrowserSessionFailure("not_found", "That browser session has ended.");
  }
  session.lastActivityAt = Date.now();
  const { page, diagnostics } = session;

  let image: Buffer;
  try {
    image = await page.screenshot({ type: "png", timeout: BUG_SCREENSHOT_TIMEOUT_MS });
  } catch {
    throw new BrowserSessionFailure("capture_failed", "The page could not be captured. Try again in a moment.");
  }
  // The page may be mid-navigation; the user agent is a nice-to-have, not a reason to lose the capture.
  const userAgent = await page.evaluate(() => navigator.userAgent).catch(() => "");

  return {
    capturedAt: new Date().toISOString(),
    pageUrl: page.url(),
    pageTitle: session.title,
    device: {
      name: session.profile.name,
      viewport: session.viewport,
      landscape: session.landscape,
      engine: session.profile.engine ?? "chromium",
    },
    userAgent,
    consoleMessages: [...diagnostics.consoleMessages],
    pageErrors: [...diagnostics.pageErrors],
    failedRequests: [...diagnostics.failedRequests],
    httpErrors: [...diagnostics.httpErrors],
    screenshot: `data:image/png;base64,${image.toString("base64")}`,
  };
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
    case "down":
    case "up": {
      const { x, y, clickCount } = body;
      if (!isUnitInterval(x) || !isUnitInterval(y)) return { ok: false, reason: "Position is outside the page." };
      const count = clickCount === undefined ? 1 : clickCount;
      if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > 3) {
        return { ok: false, reason: "Click count must be 1, 2 or 3." };
      }
      return { ok: true, input: { type: body.type, x, y, clickCount: count } };
    }
    case "move": {
      const { x, y } = body;
      if (!isUnitInterval(x) || !isUnitInterval(y)) return { ok: false, reason: "Position is outside the page." };
      return { ok: true, input: { type: "move", x, y } };
    }
    case "text": {
      if (typeof body.text !== "string" || body.text.length === 0 || body.text.length > MAX_TEXT_LENGTH) {
        return { ok: false, reason: "Text must be between 1 and 500 characters." };
      }
      return { ok: true, input: { type: "text", text: body.text } };
    }
    case "paste": {
      if (typeof body.text !== "string" || body.text.length === 0 || body.text.length > MAX_PASTE_LENGTH) {
        return { ok: false, reason: `Pasted text must be between 1 and ${MAX_PASTE_LENGTH} characters.` };
      }
      return { ok: true, input: { type: "paste", text: body.text } };
    }
    case "select": {
      const { x, y, index } = body;
      if (!isUnitInterval(x) || !isUnitInterval(y)) return { ok: false, reason: "Position is outside the page." };
      if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index > 5_000) {
        return { ok: false, reason: "Choose one of the listed options." };
      }
      return { ok: true, input: { type: "select", x, y, index } };
    }
    case "setValue": {
      const { x, y, value } = body;
      if (!isUnitInterval(x) || !isUnitInterval(y)) return { ok: false, reason: "Position is outside the page." };
      if (typeof value !== "string" || value.length > MAX_VALUE_LENGTH) return { ok: false, reason: "That value is not valid." };
      return { ok: true, input: { type: "setValue", x, y, value } };
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
export function sendBrowserInput(userId: string, id: string, input: BrowserInput): Promise<InputResult> {
  const session = ownedSession(userId, id);
  if (!session || session.status !== "live") {
    return Promise.reject(new BrowserSessionFailure("not_found", "That browser session has ended."));
  }
  session.lastActivityAt = Date.now();
  const run = session.queue.then(() => apply(session, input));
  session.queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run.catch(() => {
    throw new BrowserSessionFailure("input_failed", "The page did not respond to that action.");
  });
}

async function apply(session: LiveSession, input: BrowserInput): Promise<InputResult> {
  const { page, viewport } = session;
  const px = (value: number) => value * viewport.width;
  const py = (value: number) => value * viewport.height;
  switch (input.type) {
    case "click":
      await page.mouse.click(px(input.x), py(input.y));
      return {};
    case "down":
      await page.mouse.move(px(input.x), py(input.y));
      await page.mouse.down({ clickCount: input.clickCount });
      return {};
    case "up": {
      await page.mouse.move(px(input.x), py(input.y));
      await page.mouse.up({ clickCount: input.clickCount });
      // A press that ends on a drop-down or a date or colour field cannot be seen in the picture. Describe it, so the
      // device can show its own list or picker.
      const control = await controlAt(page, px(input.x), py(input.y), viewport);
      return control ? { control } : {};
    }
    case "move":
      await page.mouse.move(px(input.x), py(input.y));
      return {};
    case "wheel":
      await page.mouse.move(px(input.x), py(input.y));
      await page.mouse.wheel(0, input.deltaY);
      return {};
    case "text":
      await page.keyboard.type(input.text);
      return {};
    case "paste":
      // Inserts the text into the focused field in one step, as a paste does. The page still gets its input events.
      await page.keyboard.insertText(input.text);
      return {};
    case "key":
      await page.keyboard.press(chord(input.key));
      return {};
    case "select": {
      const done = await page.evaluate(
        ({ x, y, index }) => {
          const select = document.elementFromPoint(x, y)?.closest("select");
          if (!select || select.disabled || index >= select.options.length || select.options[index].disabled) return false;
          select.selectedIndex = index;
          select.dispatchEvent(new Event("input", { bubbles: true }));
          select.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        },
        { x: px(input.x), y: py(input.y), index: input.index },
      );
      if (!done) throw new Error("No drop-down at that position");
      return {};
    }
    case "setValue": {
      const done = await page.evaluate(
        ({ x, y, value }) => {
          const field = document.elementFromPoint(x, y)?.closest("input");
          if (!field || field.disabled || field.readOnly) return false;
          // The setter on the prototype, so frameworks that watch the value see the change.
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(field, value);
          field.dispatchEvent(new Event("input", { bubbles: true }));
          field.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        },
        { x: px(input.x), y: py(input.y), value: input.value },
      );
      if (!done) throw new Error("No field at that position");
      return {};
    }
    case "navigate": {
      const parsed = parseTargetUrl(input.url);
      if (!parsed.ok) throw new Error(parsed.reason);
      session.requestedUrl = parsed.url.toString();
      void page.goto(parsed.url.toString(), { waitUntil: "load", timeout: NAVIGATION_TIMEOUT_MS }).catch(() => undefined);
      return {};
    }
    case "back":
      void page.goBack({ waitUntil: "load", timeout: NAVIGATION_TIMEOUT_MS }).catch(() => undefined);
      return {};
    case "forward":
      void page.goForward({ waitUntil: "load", timeout: NAVIGATION_TIMEOUT_MS }).catch(() => undefined);
      return {};
    case "reload":
      void page.reload({ waitUntil: "load", timeout: NAVIGATION_TIMEOUT_MS }).catch(() => undefined);
      return {};
  }
}

/**
 * Describes the drop-down, or the date, time or colour field, at a point in the page, or null when there is none.
 * The page runs this itself, so it sees the real element. Only plain numbers go in, and only data comes out.
 */
async function controlAt(page: Page, x: number, y: number, viewport: { width: number; height: number }): Promise<PageControl | null> {
  const found = await page
    .evaluate(
      ({ x, y, pickerTypes }) => {
        const hit = document.elementFromPoint(x, y);
        if (!hit) return null;
        const box = (element: Element) => {
          const r = element.getBoundingClientRect();
          return { x: r.left, y: r.top, width: r.width, height: r.height };
        };
        const select = hit.closest("select");
        if (select && !select.disabled && !select.multiple && !(select.size > 1)) {
          return {
            kind: "select" as const,
            rect: box(select),
            options: [...select.options].map((option) => ({
              label: (option.label || option.text || "").slice(0, 120),
              selected: option.selected,
              disabled: option.disabled || (option.parentElement instanceof HTMLOptGroupElement && option.parentElement.disabled),
            })),
          };
        }
        const field = hit.closest("input");
        if (field && !field.disabled && !field.readOnly && pickerTypes.includes(field.type)) {
          return {
            kind: "value" as const,
            rect: box(field),
            inputType: field.type,
            value: field.value,
            min: field.min,
            max: field.max,
            step: field.step,
          };
        }
        return null;
      },
      { x, y, pickerTypes: [...PICKER_INPUT_TYPES] as string[] },
    )
    .catch(() => null);
  if (!found) return null;

  const rect = {
    x: found.rect.x / viewport.width,
    y: found.rect.y / viewport.height,
    width: found.rect.width / viewport.width,
    height: found.rect.height / viewport.height,
  };
  if (found.kind === "select") {
    // A list this long is not a list a person can use on a phone. The first part is enough to pick from.
    return { kind: "select", rect, options: found.options.slice(0, 500) };
  }
  return {
    kind: "value",
    rect,
    inputType: found.inputType as PickerInputType,
    value: found.value.slice(0, MAX_VALUE_LENGTH),
    min: found.min.slice(0, MAX_VALUE_LENGTH),
    max: found.max.slice(0, MAX_VALUE_LENGTH),
    step: found.step.slice(0, MAX_VALUE_LENGTH),
  };
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
  recordSessionEnd(session.id, session.currentUrl, session.title);
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
