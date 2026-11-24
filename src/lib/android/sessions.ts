import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import type { Plan } from "@/lib/mock-data";
import { recordSessionEnd, recordSessionStart } from "@/lib/reports/history";
import type { ApkInfo } from "./apk";
import { isAndroidKey, type AndroidDevice, type AndroidKey, type AndroidRuntime, type Frame } from "./device";
import { createAndroidRuntime } from "./runtime";

/** Each emulator needs about 2.5 GB of memory, so a person gets few at once, and the server gets fewer still. */
export const MAX_ACTIVE_ANDROID_SESSIONS: Record<Plan, number> = { free: 1, pro: 2 };
const MAX_TOTAL_SESSIONS = Number(process.env.ANDROID_MAX_SESSIONS) > 0 ? Number(process.env.ANDROID_MAX_SESSIONS) : 2;
export const ANDROID_IDLE_MS = 5 * 60_000;
export const ANDROID_MAX_MS = 20 * 60_000;
const FRAME_INTERVAL_MS = 300;
/** A finished session stays readable for a short while, so a page that polls late still sees why it ended. */
const KEEP_FINISHED_MS = 2 * 60_000;

export type AndroidSessionStatus = "booting" | "installing" | "starting" | "live" | "failed" | "closed";

export type PublicAndroidSession = {
  id: string;
  status: AndroidSessionStatus;
  /** What is happening now, in plain words, for a progress line. */
  message: string;
  profileId: string;
  fileName: string;
  app: Pick<ApkInfo, "packageName" | "label" | "versionName" | "versionCode" | "minSdk" | "targetSdk" | "permissionCount">;
  /** The phone's screen size. Null until the emulator is up. */
  viewport: { width: number; height: number } | null;
  createdAt: string;
  error: string | null;
};

export class AndroidSessionFailure extends Error {
  constructor(
    readonly code: "unavailable" | "concurrency_limit" | "not_found" | "invalid_input" | "input_failed" | "unknown_profile",
    message: string,
  ) {
    super(message);
    this.name = "AndroidSessionFailure";
  }
}

type Session = {
  id: string;
  userId: string;
  profileId: string;
  fileName: string;
  /** The uploaded APK on disk. Deleted when the session ends. */
  file: string;
  info: ApkInfo;
  status: AndroidSessionStatus;
  message: string;
  error: string | null;
  createdAt: number;
  lastActivityAt: number;
  endedAt: number | null;
  device: AndroidDevice | null;
  frame: (Frame & { seq: number }) | null;
  frameSeq: number;
  capturing: boolean;
  frameTimer: ReturnType<typeof setInterval> | null;
  queue: Promise<unknown>;
};

type Store = { sessions: Map<string, Session>; sweeper: ReturnType<typeof setInterval> | null; runtime: AndroidRuntime | null };
const globalForAndroid = globalThis as typeof globalThis & { __emulixAndroid?: Store };

function store(): Store {
  globalForAndroid.__emulixAndroid ??= { sessions: new Map(), sweeper: null, runtime: null };
  return globalForAndroid.__emulixAndroid;
}

function runtime(): AndroidRuntime {
  const state = store();
  state.runtime ??= createAndroidRuntime();
  return state.runtime;
}

/** Lets a test run sessions against a stand-in for the Android SDK. Pass null to go back to the real one. */
export function setAndroidRuntime(next: AndroidRuntime | null): void {
  store().runtime = next;
}

/** Reads what Android testing can do on this server, for the page and the upload route. */
export function androidRuntime(): AndroidRuntime {
  return runtime();
}

function isActive(session: Session): boolean {
  return session.status === "booting" || session.status === "installing" || session.status === "starting" || session.status === "live";
}

function toPublic(session: Session): PublicAndroidSession {
  const { packageName, label, versionName, versionCode, minSdk, targetSdk, permissionCount } = session.info;
  return {
    id: session.id,
    status: session.status,
    message: session.message,
    profileId: session.profileId,
    fileName: session.fileName,
    app: { packageName, label, versionName, versionCode, minSdk, targetSdk, permissionCount },
    viewport: session.device ? { width: session.device.width, height: session.device.height } : null,
    createdAt: new Date(session.createdAt).toISOString(),
    error: session.error,
  };
}

function owned(userId: string, id: string): Session | null {
  const session = store().sessions.get(id);
  return session && session.userId === userId ? session : null;
}

/** Stops the screen capture, shuts the emulator down and removes the uploaded file. Safe to call more than once. */
async function release(session: Session): Promise<void> {
  if (session.frameTimer) clearInterval(session.frameTimer);
  session.frameTimer = null;
  const device = session.device;
  session.device = null;
  await Promise.allSettled([device?.close(), unlink(session.file)]);
}

function finish(session: Session, status: "failed" | "closed", error: string | null = null): void {
  if (!isActive(session)) return;
  session.status = status;
  session.error = error;
  session.endedAt = Date.now();
  session.message = status === "closed" ? "The session has ended." : (error ?? "The session failed.");
  recordSessionEnd(session.id, session.fileName, session.info.label, status === "failed");
  void release(session);
}

function ensureSweeper(): void {
  const state = store();
  if (state.sweeper) return;
  state.sweeper = setInterval(() => {
    const now = Date.now();
    for (const session of state.sessions.values()) {
      if (isActive(session)) {
        if (now - session.lastActivityAt > ANDROID_IDLE_MS || now - session.createdAt > ANDROID_MAX_MS) finish(session, "closed");
      } else if (session.endedAt && now - session.endedAt > KEEP_FINISHED_MS) {
        state.sessions.delete(session.id);
      }
    }
  }, 15_000);
  state.sweeper.unref();
}

async function captureFrame(session: Session): Promise<void> {
  if (session.capturing || session.status !== "live" || !session.device) return;
  session.capturing = true;
  try {
    const frame = await session.device.screenshot();
    if (session.status === "live") session.frame = { ...frame, seq: ++session.frameSeq };
  } catch {
    // One missed picture is not a reason to end the session. The next one will try again.
  } finally {
    session.capturing = false;
  }
}

/** Boots the emulator, installs the app and opens it. Runs in the background and records its progress on the session. */
async function bringUp(session: Session): Promise<void> {
  try {
    const device = await runtime().boot(session.profileId, (phase) => {
      if (isActive(session)) session.message = phase === "starting" ? "Starting the Android emulator…" : "Android is starting up…";
    });
    if (!isActive(session)) {
      // The tester cancelled while the emulator was still starting.
      await device.close();
      return;
    }
    session.device = device;

    session.status = "installing";
    session.message = `Installing ${session.info.label}…`;
    await device.install(session.file);
    if (!isActive(session)) return;

    session.status = "starting";
    session.message = `Opening ${session.info.label}…`;
    await device.launch(session.info);
    if (!isActive(session)) return;

    session.status = "live";
    session.message = "Running";
    await captureFrame(session);
    session.frameTimer = setInterval(() => void captureFrame(session), FRAME_INTERVAL_MS);
    session.frameTimer.unref();
  } catch (error) {
    // Messages from the runtime are written to be shown. Anything unexpected gets a general one.
    const message = error instanceof Error && error.message ? error.message : "The Android session could not start.";
    finish(session, "failed", message);
  }
}

/**
 * Starts testing an uploaded APK. It returns at once with the session in its "booting" state, and the emulator comes up in
 * the background. The caller has already checked the file; the app's details come from reading it.
 */
export async function startAndroidSession(input: {
  userId: string;
  plan: Plan;
  profileId: string;
  fileName: string;
  /** The APK on disk. The session deletes it when it ends, or right away if it cannot start. */
  file: string;
  info: ApkInfo;
}): Promise<PublicAndroidSession> {
  const state = store();
  const fail = async (failure: AndroidSessionFailure): Promise<never> => {
    await unlink(input.file).catch(() => undefined);
    throw failure;
  };

  const support = await runtime().support();
  if (!support.ok) return fail(new AndroidSessionFailure("unavailable", support.reason));
  if (!support.profiles.some((profile) => profile.id === input.profileId)) {
    return fail(new AndroidSessionFailure("unknown_profile", "Choose one of the listed Android devices."));
  }

  const active = [...state.sessions.values()].filter(isActive);
  if (active.filter((session) => session.userId === input.userId).length >= MAX_ACTIVE_ANDROID_SESSIONS[input.plan]) {
    return fail(
      new AndroidSessionFailure(
        "concurrency_limit",
        `You can run ${MAX_ACTIVE_ANDROID_SESSIONS[input.plan]} Android device at a time on your plan. Stop the running one first.`,
      ),
    );
  }
  if (active.length >= MAX_TOTAL_SESSIONS) {
    return fail(new AndroidSessionFailure("concurrency_limit", "The Android devices are all busy. Try again in a few minutes."));
  }

  const now = Date.now();
  const session: Session = {
    id: randomUUID(),
    userId: input.userId,
    profileId: input.profileId,
    fileName: input.fileName,
    file: input.file,
    info: input.info,
    status: "booting",
    message: "Starting the Android emulator…",
    error: null,
    createdAt: now,
    lastActivityAt: now,
    endedAt: null,
    device: null,
    frame: null,
    frameSeq: 0,
    capturing: false,
    frameTimer: null,
    queue: Promise.resolve(),
  };
  state.sessions.set(session.id, session);
  recordSessionStart({
    id: session.id,
    userId: session.userId,
    url: input.fileName,
    profileName: input.profileId.replace(/_/g, " "),
    startedAt: new Date(now).toISOString(),
    kind: "apk",
  });
  ensureSweeper();
  void bringUp(session);
  return toPublic(session);
}

/** The session as the page shows it, or null once it is gone. */
export function getAndroidSession(userId: string, id: string): PublicAndroidSession | null {
  const session = owned(userId, id);
  if (!session) return null;
  // A page that is watching a booting session keeps it from being taken for an idle one.
  if (isActive(session)) session.lastActivityAt = Date.now();
  return toPublic(session);
}

/** The person's running session, if they have one, so a page that was reloaded can pick it up again. */
export function activeAndroidSession(userId: string): PublicAndroidSession | null {
  const found = [...store().sessions.values()].find((session) => session.userId === userId && isActive(session));
  return found ? toPublic(found) : null;
}

/** The newest picture, when it is newer than `after`. "gone" when the session has ended. */
export function getLatestAndroidFrame(userId: string, id: string, after: number): "gone" | { frame: (Frame & { seq: number }) | null } {
  const session = owned(userId, id);
  if (!session || session.status === "closed" || session.status === "failed") return "gone";
  session.lastActivityAt = Date.now();
  const frame = session.frame && session.frame.seq > after ? session.frame : null;
  return { frame };
}

export type AndroidInput =
  | { type: "tap"; x: number; y: number }
  | { type: "swipe"; fromX: number; fromY: number; toX: number; toY: number; durationMs: number }
  | { type: "key"; key: AndroidKey }
  | { type: "text"; text: string };

const unit = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;

export function validateAndroidInput(value: unknown): { ok: true; input: AndroidInput } | { ok: false; reason: string } {
  if (typeof value !== "object" || value === null) return { ok: false, reason: "Send an action." };
  const body = value as Record<string, unknown>;
  switch (body.type) {
    case "tap":
      if (!unit(body.x) || !unit(body.y)) return { ok: false, reason: "That position is outside the screen." };
      return { ok: true, input: { type: "tap", x: body.x, y: body.y } };
    case "swipe": {
      const { fromX, fromY, toX, toY, durationMs } = body;
      if (!unit(fromX) || !unit(fromY) || !unit(toX) || !unit(toY)) return { ok: false, reason: "That position is outside the screen." };
      if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs < 0 || durationMs > 5000) {
        return { ok: false, reason: "That swipe is not valid." };
      }
      return { ok: true, input: { type: "swipe", fromX, fromY, toX, toY, durationMs } };
    }
    case "key":
      return isAndroidKey(body.key) ? { ok: true, input: { type: "key", key: body.key } } : { ok: false, reason: "That button is not supported." };
    case "text":
      return typeof body.text === "string" && body.text.length > 0 && body.text.length <= 200
        ? { ok: true, input: { type: "text", text: body.text } }
        : { ok: false, reason: "Text must be between 1 and 200 characters." };
    default:
      return { ok: false, reason: "That action is not supported." };
  }
}

/** Applies one input. Inputs run in the order they arrive. */
export function sendAndroidInput(userId: string, id: string, input: AndroidInput): Promise<void> {
  const session = owned(userId, id);
  if (!session || session.status !== "live" || !session.device) {
    return Promise.reject(new AndroidSessionFailure("not_found", "That Android session is not running."));
  }
  session.lastActivityAt = Date.now();
  const device = session.device;
  const px = (value: number, size: number) => value * size;
  const run = session.queue.then(() => {
    switch (input.type) {
      case "tap":
        return device.tap(px(input.x, device.width), px(input.y, device.height));
      case "swipe":
        return device.swipe(
          px(input.fromX, device.width),
          px(input.fromY, device.height),
          px(input.toX, device.width),
          px(input.toY, device.height),
          input.durationMs,
        );
      case "key":
        return device.key(input.key);
      case "text":
        return device.text(input.text);
    }
  });
  session.queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run.catch(() => {
    throw new AndroidSessionFailure("input_failed", "The phone did not respond to that.");
  });
}

/** Ends the session and its emulator. Returns false when the person has no such session. */
export async function closeAndroidSession(userId: string, id: string): Promise<boolean> {
  const session = owned(userId, id);
  if (!session) return false;
  finish(session, "closed");
  return true;
}
