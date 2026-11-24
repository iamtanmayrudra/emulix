import type { ApkInfo } from "./apk";

/** One picture of the phone's screen. */
export type Frame = { data: Buffer; contentType: "image/jpeg" | "image/png" };

/** A running Android emulator that the app can look at and touch. */
export interface AndroidDevice {
  readonly serial: string;
  /** The screen size in pixels. Taps are given as 0 to 1 of this. */
  readonly width: number;
  readonly height: number;
  screenshot(): Promise<Frame>;
  tap(x: number, y: number): Promise<void>;
  swipe(fromX: number, fromY: number, toX: number, toY: number, durationMs: number): Promise<void>;
  key(name: AndroidKey): Promise<void>;
  text(value: string): Promise<void>;
  /** Installs the app. Rejects with a message that is safe to show. */
  install(file: string): Promise<void>;
  launch(app: Pick<ApkInfo, "packageName" | "launchActivity">): Promise<void>;
  close(): Promise<void>;
}

export type AndroidProfile = { id: string; label: string };

export type BootPhase = "starting" | "booting";

/** Everything a session needs from the machine. The real one drives the Android SDK. Tests use a stand-in. */
export interface AndroidRuntime {
  support(): Promise<{ ok: true; profiles: AndroidProfile[] } | { ok: false; reason: string }>;
  inspect(file: string): Promise<ApkInfo>;
  boot(profileId: string, onPhase: (phase: BootPhase) => void): Promise<AndroidDevice>;
}

/** The buttons a person can press on the phone. */
export const ANDROID_KEYS = {
  BACK: 4,
  HOME: 3,
  RECENTS: 187,
  ENTER: 66,
  DELETE: 67,
  FORWARD_DELETE: 112,
  TAB: 61,
  ESCAPE: 111,
  UP: 19,
  DOWN: 20,
  LEFT: 21,
  RIGHT: 22,
  PAGE_UP: 92,
  PAGE_DOWN: 93,
} as const;

export type AndroidKey = keyof typeof ANDROID_KEYS;

export function isAndroidKey(value: unknown): value is AndroidKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ANDROID_KEYS, value);
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Whole pixels inside the screen. */
function pixel(value: number, size: number): number {
  // A value that is not a number would otherwise reach the phone as the word NaN.
  if (!Number.isFinite(value)) return 0;
  return clamp(Math.round(value), 0, Math.max(0, size - 1));
}

/** The shell command for a tap. Only whole numbers are put in. */
export function tapCommand(x: number, y: number, size: { width: number; height: number }): string {
  return `input tap ${pixel(x, size.width)} ${pixel(y, size.height)}`;
}

/** The shell command for a swipe, which is also how a drag, a scroll and a long press are made. */
export function swipeCommand(
  from: { x: number; y: number },
  to: { x: number; y: number },
  durationMs: number,
  size: { width: number; height: number },
): string {
  const ms = clamp(Math.round(durationMs), 50, 3000);
  return `input swipe ${pixel(from.x, size.width)} ${pixel(from.y, size.height)} ${pixel(to.x, size.width)} ${pixel(to.y, size.height)} ${ms}`;
}

export function keyCommand(name: AndroidKey): string {
  return `input keyevent ${ANDROID_KEYS[name]}`;
}

/** The longest text one command may type. */
export const MAX_TYPED_TEXT = 200;

/**
 * Makes text safe to type into the phone with `input text`. Only plain printable characters are kept, because the shell
 * and the phone's text tool both treat many other characters in their own ways. A space becomes %s, which is how that
 * tool writes one. Returns null when nothing typeable is left.
 */
export function textCommand(value: string): string | null {
  const kept = [...value.slice(0, MAX_TYPED_TEXT)]
    .filter((char) => char >= " " && char <= "~" && char !== "'" && char !== "%" && char !== "\\" && char !== "`")
    .map((char) => (char === " " ? "%s" : char))
    .join("");
  return kept ? `input text '${kept}'` : null;
}
