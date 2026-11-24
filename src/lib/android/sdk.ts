import { execFile } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { isServerlessHost } from "@/lib/testing/environment";

const run = promisify(execFile);

/** The Android SDK programs the app uses. aapt2 reads an APK's details, and is optional. */
export type AndroidTools = {
  sdk: string;
  adb: string;
  emulator: string;
  aapt2: string | null;
};

const EXE = process.platform === "win32" ? ".exe" : "";

/** Where Android Studio puts the SDK, when ANDROID_HOME and ANDROID_SDK_ROOT are not set. */
function defaultSdkFolders(env: Record<string, string | undefined>): string[] {
  const home = homedir();
  if (process.platform === "win32") return [path.join(env.LOCALAPPDATA ?? path.join(home, "AppData", "Local"), "Android", "Sdk")];
  if (process.platform === "darwin") return [path.join(home, "Library", "Android", "sdk")];
  return [path.join(home, "Android", "Sdk"), path.join(home, "Android", "sdk")];
}

/** The newest build-tools folder that holds aapt2. */
function findAapt2(sdk: string): string | null {
  const root = path.join(sdk, "build-tools");
  if (!existsSync(root)) return null;
  const versions = readdirSync(root).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  for (const version of versions) {
    const candidate = path.join(root, version, `aapt2${EXE}`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** Finds the SDK, or returns null when adb or the emulator is missing. */
export function findAndroidTools(env: Record<string, string | undefined> = process.env): AndroidTools | null {
  const candidates = [env.ANDROID_HOME, env.ANDROID_SDK_ROOT, ...defaultSdkFolders(env)].filter((value): value is string => Boolean(value));
  for (const sdk of candidates) {
    const adb = path.join(sdk, "platform-tools", `adb${EXE}`);
    const emulator = path.join(sdk, "emulator", `emulator${EXE}`);
    if (existsSync(adb) && existsSync(emulator)) return { sdk, adb, emulator, aapt2: findAapt2(sdk) };
  }
  return null;
}

/** The names of the Android Virtual Devices that can be started. */
export async function listAvds(tools: AndroidTools): Promise<string[]> {
  try {
    const { stdout } = await run(tools.emulator, ["-list-avds"], { timeout: 20_000, windowsHide: true });
    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      // The emulator prints "INFO | ..." lines to the same output on some versions. Real names have no spaces or bars.
      .filter((line) => /^[A-Za-z0-9._-]+$/.test(line));
  } catch {
    return [];
  }
}

export type AndroidSupport =
  | { ok: true; tools: AndroidTools; avds: string[] }
  | { ok: false; reason: string };

/** Why Android testing is or is not available on this server. The answer is kept for a minute, since it never changes quickly. */
let cached: { at: number; value: AndroidSupport } | null = null;
const CACHE_MS = 60_000;

export async function androidSupport(env: Record<string, string | undefined> = process.env, useCache = true): Promise<AndroidSupport> {
  if (useCache && cached && Date.now() - cached.at < CACHE_MS) return cached.value;

  let value: AndroidSupport;
  if (env.ANDROID_EMULATOR?.trim().toLowerCase() === "off") {
    value = { ok: false, reason: "Android testing is switched off on this server." };
  } else if (isServerlessHost(env) && env.ANDROID_EMULATOR?.trim().toLowerCase() !== "on") {
    value = { ok: false, reason: "APK testing needs a server that can run an Android emulator. It is not available on this hosted demo." };
  } else {
    const tools = findAndroidTools(env);
    if (!tools) {
      value = { ok: false, reason: "The Android SDK was not found on this server. Install Android Studio, or set ANDROID_HOME." };
    } else {
      const avds = await listAvds(tools);
      value =
        avds.length > 0
          ? { ok: true, tools, avds }
          : { ok: false, reason: "No Android device is set up on this server. Create one in Android Studio (Device Manager)." };
    }
  }
  if (useCache) cached = { at: Date.now(), value };
  return value;
}

/** For tests, and after the settings change. */
export function forgetAndroidSupport(): void {
  cached = null;
}
