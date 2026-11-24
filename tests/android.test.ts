import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApkRejected, installFailureMessage, looksLikeZip, parseBadging, type ApkInfo } from "../src/lib/android/apk";
import {
  isAndroidKey,
  keyCommand,
  swipeCommand,
  tapCommand,
  textCommand,
  type AndroidDevice,
  type AndroidRuntime,
  type BootPhase,
} from "../src/lib/android/device";
import { androidSupport, findAndroidTools, forgetAndroidSupport } from "../src/lib/android/sdk";
import {
  ANDROID_IDLE_MS,
  activeAndroidSession,
  closeAndroidSession,
  getAndroidSession,
  getLatestAndroidFrame,
  sendAndroidInput,
  setAndroidRuntime,
  startAndroidSession,
  validateAndroidInput,
} from "../src/lib/android/sessions";
import { dashboardTotals, recentJobs } from "../src/lib/reports/dashboard";

// What `aapt2 dump badging` prints for a small real app (BrowserStack's AddNumber sample), shortened.
const BADGING = `package: name='com.browserstack.addnumber' versionCode='1' versionName='1.0' platformBuildVersionName='6.0-2438415' platformBuildVersionCode='23'
minSdkVersion:'19'
targetSdkVersion:'23'
application-label:'AddNumber'
application-label-af:'AddNumber'
uses-permission: name='android.permission.INTERNET'
uses-permission: name='android.permission.CAMERA'
launchable-activity: name='com.browserstack.addnumber.MainActivity'  label='' icon=''
native-code: 'arm64-v8a' 'armeabi-v7a'
`;

describe("reading an APK", () => {
  it("takes the app's name, version, target, launch screen, permissions and native code from aapt2", () => {
    expect(parseBadging(BADGING)).toEqual({
      packageName: "com.browserstack.addnumber",
      label: "AddNumber",
      versionName: "1.0",
      versionCode: "1",
      minSdk: 19,
      targetSdk: 23,
      launchActivity: "com.browserstack.addnumber.MainActivity",
      nativeCode: ["arm64-v8a", "armeabi-v7a"],
      permissionCount: 2,
    });
  });

  it("reads the older aapt's sdkVersion as the minimum, and has no launch screen for a library", () => {
    const info = parseBadging("package: name='com.example.lib' versionCode='3' versionName='2'\nsdkVersion:'21'\napplication-label:'Lib'\n");
    expect(info.minSdk).toBe(21);
    expect(info.launchActivity).toBeNull();
    expect(info.nativeCode).toEqual([]);
  });

  it("falls back to the package name when the app has no label", () => {
    expect(parseBadging("package: name='com.example.app' versionCode='1' versionName='1'\n").label).toBe("com.example.app");
  });

  it("refuses output with no package, and package names that are not plain ids", () => {
    expect(() => parseBadging("")).toThrow(ApkRejected);
    expect(() => parseBadging("package: versionCode='1'")).toThrow(ApkRejected);
    for (const name of ["com.example.app; rm -rf /", "com.example.app$(x)", "nodots", "1com.example", "com..example", "com.example.app\n"]) {
      expect(() => parseBadging(`package: name='${name}' versionCode='1' versionName='1'`), name).toThrow(ApkRejected);
    }
  });

  it("refuses a launch screen name that holds anything but class-name characters", () => {
    const text = `package: name='com.example.app' versionCode='1' versionName='1'\nlaunchable-activity: name='com.example.Main;reboot'  label=''`;
    expect(() => parseBadging(text)).toThrow(ApkRejected);
    const nested = `package: name='com.example.app' versionCode='1' versionName='1'\nlaunchable-activity: name='com.example.Main$Inner'  label=''`;
    expect(parseBadging(nested).launchActivity).toBe("com.example.Main$Inner");
  });

  it("recognises a zip file by its first bytes", () => {
    expect(looksLikeZip(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]))).toBe(true);
    expect(looksLikeZip(Buffer.from("MZ executable"))).toBe(false);
    expect(looksLikeZip(Buffer.from([0x50, 0x4b]))).toBe(false);
  });

  it("explains the common install failures in plain words", () => {
    expect(installFailureMessage("Failure [INSTALL_FAILED_NO_MATCHING_ABIS: x]")).toMatch(/ARM/);
    expect(installFailureMessage("Failure [INSTALL_FAILED_OLDER_SDK]")).toMatch(/newer version of Android/);
    expect(installFailureMessage("Failure [INSTALL_FAILED_DEPRECATED_SDK_VERSION]")).toMatch(/very old/);
    expect(installFailureMessage("Failure [INSTALL_PARSE_FAILED_NO_CERTIFICATES]")).toMatch(/signed/);
    expect(installFailureMessage("Failure [INSTALL_FAILED_SOMETHING_NEW]")).toBe("The app could not be installed (FAILED_SOMETHING_NEW).");
    expect(installFailureMessage("no code here")).toBe("The app could not be installed.");
  });
});

describe("commands for the phone", () => {
  const size = { width: 720, height: 1600 };

  it("turns positions into whole pixels inside the screen", () => {
    expect(tapCommand(360.4, 800.6, size)).toBe("input tap 360 801");
    expect(tapCommand(-5, 99999, size)).toBe("input tap 0 1599");
    expect(tapCommand(Number.NaN, 10, size)).toBe("input tap 0 10");
  });

  it("limits how long a swipe takes", () => {
    expect(swipeCommand({ x: 10, y: 20 }, { x: 30, y: 40 }, 5, size)).toBe("input swipe 10 20 30 40 50");
    expect(swipeCommand({ x: 10, y: 20 }, { x: 30, y: 40 }, 99999, size)).toBe("input swipe 10 20 30 40 3000");
  });

  it("knows only the named buttons", () => {
    expect(keyCommand("BACK")).toBe("input keyevent 4");
    expect(keyCommand("HOME")).toBe("input keyevent 3");
    expect(keyCommand("RECENTS")).toBe("input keyevent 187");
    expect(isAndroidKey("ENTER")).toBe(true);
    for (const bad of ["POWER", "KEYCODE_POWER", "toString", "__proto__", "", 4, null]) expect(isAndroidKey(bad), String(bad)).toBe(false);
  });

  it("types only plain characters, turns spaces into %s, and drops anything the shell could misread", () => {
    expect(textCommand("hello world")).toBe("input text 'hello%sworld'");
    expect(textCommand("a@b.com 5+5=10!")).toBe("input text 'a@b.com%s5+5=10!'");
    // Quotes, backticks, backslashes and percent signs are left out, so nothing can end the quoted text early.
    expect(textCommand(`it's \`x\` \\ 100%`)).toBe("input text 'its%sx%s%s100'");
    expect(textCommand("$(reboot); echo hi")).toBe("input text '$(reboot);%secho%shi'");
    // Non-printable and non-ASCII characters have no key press, so they are skipped.
    expect(textCommand("héllo\n\t")).toBe("input text 'hllo'");
    expect(textCommand("😀")).toBeNull();
    expect(textCommand("")).toBeNull();
    expect(textCommand("a".repeat(500))).toBe(`input text '${"a".repeat(200)}'`);
  });
});

describe("finding the Android SDK", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "android-sdk-"));
    forgetAndroidSupport();
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const exe = process.platform === "win32" ? ".exe" : "";
  function install(...parts: string[]) {
    const file = path.join(root, ...parts);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, "");
  }

  it("finds adb, the emulator and the newest aapt2 under ANDROID_HOME", () => {
    install("platform-tools", `adb${exe}`);
    install("emulator", `emulator${exe}`);
    install("build-tools", "34.0.0", `aapt2${exe}`);
    install("build-tools", "35.0.0", `aapt2${exe}`);
    install("build-tools", "9.0.0", `aapt2${exe}`);
    const tools = findAndroidTools({ ANDROID_HOME: root });
    expect(tools?.sdk).toBe(root);
    expect(tools?.aapt2).toBe(path.join(root, "build-tools", "35.0.0", `aapt2${exe}`));
  });

  it("returns null when adb or the emulator is missing, and aapt2 is optional", () => {
    install("platform-tools", `adb${exe}`);
    expect(findAndroidTools({ ANDROID_HOME: root, LOCALAPPDATA: root })).toBeNull();
    install("emulator", `emulator${exe}`);
    expect(findAndroidTools({ ANDROID_HOME: root })?.aapt2).toBeNull();
  });

  it("says why Android testing is not available", async () => {
    const off = await androidSupport({ ANDROID_EMULATOR: "off" }, false);
    expect(off.ok).toBe(false);
    const hosted = await androidSupport({ NETLIFY: "true" }, false);
    expect(hosted).toMatchObject({ ok: false });
    expect(!hosted.ok && hosted.reason).toMatch(/not available on this hosted demo/);
    const missing = await androidSupport({ ANDROID_HOME: path.join(root, "nothing"), LOCALAPPDATA: root, HOME: root }, false);
    expect(!missing.ok && missing.reason).toMatch(/SDK was not found/);
  });
});

// ---- Sessions, against a stand-in for the phone ----

type Calls = string[];

function fakeDevice(calls: Calls, options: { installError?: string } = {}): AndroidDevice {
  return {
    serial: "emulator-test",
    width: 720,
    height: 1600,
    screenshot: async () => ({ data: Buffer.from(`frame-${calls.filter((call) => call === "screenshot").length}`), contentType: "image/jpeg" as const }),
    tap: async (x, y) => void calls.push(`tap ${x} ${y}`),
    swipe: async (a, b, c, d, ms) => void calls.push(`swipe ${a} ${b} ${c} ${d} ${ms}`),
    key: async (name) => void calls.push(`key ${name}`),
    text: async (value) => void calls.push(`text ${value}`),
    install: async () => {
      calls.push("install");
      if (options.installError) throw new Error(options.installError);
    },
    launch: async (app) => void calls.push(`launch ${app.packageName}/${app.launchActivity}`),
    close: async () => void calls.push("close"),
  };
}

const INFO: ApkInfo = {
  packageName: "com.example.app",
  label: "Example",
  versionName: "1.2",
  versionCode: "12",
  minSdk: 21,
  targetSdk: 34,
  launchActivity: "com.example.app.Main",
  nativeCode: [],
  permissionCount: 1,
};

function fakeRuntime(calls: Calls, options: { installError?: string; bootDelayMs?: number; supported?: boolean } = {}): AndroidRuntime {
  return {
    support: async () =>
      options.supported === false
        ? { ok: false, reason: "No Android here." }
        : { ok: true, profiles: [{ id: "Emulix_Phone", label: "Emulix Phone" }, { id: "Other_Phone", label: "Other Phone" }] },
    inspect: async () => INFO,
    boot: async (_profile: string, onPhase: (phase: BootPhase) => void) => {
      onPhase("starting");
      onPhase("booting");
      calls.push("boot");
      if (options.bootDelayMs) await new Promise((resolve) => setTimeout(resolve, options.bootDelayMs));
      return fakeDevice(calls, options);
    },
  };
}

let counter = 0;
const newUser = () => `android-user-${++counter}-${Date.now()}`;
let folder: string;

function apkFile(): string {
  const file = path.join(folder, `${Math.random().toString(36).slice(2)}.apk`);
  writeFileSync(file, "PK\x03\x04 fake");
  return file;
}

async function waitFor(check: () => boolean, label: string, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function start(userId: string, extra: Partial<Parameters<typeof startAndroidSession>[0]> = {}) {
  return startAndroidSession({ userId, plan: "pro", profileId: "Emulix_Phone", fileName: "app.apk", file: apkFile(), info: INFO, ...extra });
}

describe("an Android session", () => {
  let calls: Calls;
  beforeEach(() => {
    folder = mkdtempSync(path.join(tmpdir(), "android-apk-"));
    calls = [];
    setAndroidRuntime(fakeRuntime(calls));
  });
  afterEach(() => {
    setAndroidRuntime(null);
    rmSync(folder, { recursive: true, force: true });
  });

  it("starts at once as booting, then installs, opens the app and goes live", async () => {
    const userId = newUser();
    const session = await start(userId);
    expect(session.status).toBe("booting");
    expect(session.app.label).toBe("Example");
    expect(session.viewport).toBeNull();
    await waitFor(() => getAndroidSession(userId, session.id)?.status === "live", "live");
    expect(calls.slice(0, 3)).toEqual(["boot", "install", "launch com.example.app/com.example.app.Main"]);
    expect(getAndroidSession(userId, session.id)?.viewport).toEqual({ width: 720, height: 1600 });
    await closeAndroidSession(userId, session.id);
  });

  it("serves screenshots, newest first, and nothing when there is nothing newer", async () => {
    const userId = newUser();
    const session = await start(userId);
    await waitFor(() => getAndroidSession(userId, session.id)?.status === "live", "live");
    const first = getLatestAndroidFrame(userId, session.id, 0);
    expect(first).not.toBe("gone");
    const seq = first !== "gone" && first.frame ? first.frame.seq : 0;
    expect(seq).toBeGreaterThan(0);
    expect(getLatestAndroidFrame(userId, session.id, 1_000_000)).toEqual({ frame: null });
    await closeAndroidSession(userId, session.id);
  });

  it("applies taps, swipes, buttons and text to the phone in the order they arrive, in screen pixels", async () => {
    const userId = newUser();
    const session = await start(userId);
    await waitFor(() => getAndroidSession(userId, session.id)?.status === "live", "live");
    await Promise.all([
      sendAndroidInput(userId, session.id, { type: "tap", x: 0.5, y: 0.25 }),
      sendAndroidInput(userId, session.id, { type: "swipe", fromX: 0, fromY: 1, toX: 1, toY: 0, durationMs: 300 }),
      sendAndroidInput(userId, session.id, { type: "key", key: "BACK" }),
      sendAndroidInput(userId, session.id, { type: "text", text: "hi" }),
    ]);
    expect(calls.filter((call) => /^(tap|swipe|key|text)/.test(call))).toEqual(["tap 360 400", "swipe 0 1600 720 0 300", "key BACK", "text hi"]);
    await closeAndroidSession(userId, session.id);
  });

  it("refuses input for a session that is not live, or that belongs to someone else", async () => {
    const userId = newUser();
    const other = newUser();
    setAndroidRuntime(fakeRuntime(calls, { bootDelayMs: 200 }));
    const session = await start(userId);
    await expect(sendAndroidInput(userId, session.id, { type: "tap", x: 0.5, y: 0.5 })).rejects.toMatchObject({ code: "not_found" });
    await waitFor(() => getAndroidSession(userId, session.id)?.status === "live", "live");
    await expect(sendAndroidInput(other, session.id, { type: "tap", x: 0.5, y: 0.5 })).rejects.toMatchObject({ code: "not_found" });
    expect(getAndroidSession(other, session.id)).toBeNull();
    expect(getLatestAndroidFrame(other, session.id, 0)).toBe("gone");
    await closeAndroidSession(userId, session.id);
  });

  it("shuts the phone down and deletes the uploaded file when stopped", async () => {
    const userId = newUser();
    const file = apkFile();
    const session = await start(userId, { file });
    await waitFor(() => getAndroidSession(userId, session.id)?.status === "live", "live");
    expect(existsSync(file)).toBe(true);
    expect(await closeAndroidSession(userId, session.id)).toBe(true);
    await waitFor(() => calls.includes("close") && !existsSync(file), "cleanup");
    expect(getAndroidSession(userId, session.id)?.status).toBe("closed");
    expect(getLatestAndroidFrame(userId, session.id, 0)).toBe("gone");
    expect(await closeAndroidSession(newUser(), session.id)).toBe(false);
  });

  it("closes a phone that finishes starting after the tester already cancelled", async () => {
    const userId = newUser();
    setAndroidRuntime(fakeRuntime(calls, { bootDelayMs: 100 }));
    const file = apkFile();
    const session = await start(userId, { file });
    await closeAndroidSession(userId, session.id);
    await waitFor(() => calls.includes("close"), "late close");
    expect(calls).not.toContain("install");
    await waitFor(() => !existsSync(file), "file deleted");
  });

  it("reports an install failure in plain words, closes the phone and deletes the file", async () => {
    const userId = newUser();
    setAndroidRuntime(fakeRuntime(calls, { installError: "This app only includes code for ARM phones." }));
    const file = apkFile();
    const session = await start(userId, { file });
    await waitFor(() => getAndroidSession(userId, session.id)?.status === "failed", "failed");
    expect(getAndroidSession(userId, session.id)?.error).toBe("This app only includes code for ARM phones.");
    await waitFor(() => calls.includes("close") && !existsSync(file), "cleanup");
    expect(calls).not.toContain("launch com.example.app/com.example.app.Main");
    expect(activeAndroidSession(userId)).toBeNull();
  });

  it("limits a Free account to one phone at a time and refuses an unknown device", async () => {
    const userId = newUser();
    const first = await start(userId, { plan: "free" });
    const file = apkFile();
    await expect(start(userId, { plan: "free", file })).rejects.toMatchObject({ code: "concurrency_limit" });
    // A refused upload does not leave its file behind.
    expect(existsSync(file)).toBe(false);
    const bad = apkFile();
    await expect(start(newUser(), { profileId: "No_Such_Phone", file: bad })).rejects.toMatchObject({ code: "unknown_profile" });
    expect(existsSync(bad)).toBe(false);
    await closeAndroidSession(userId, first.id);
  });

  it("refuses when Android testing is not available on this server", async () => {
    setAndroidRuntime(fakeRuntime(calls, { supported: false }));
    const file = apkFile();
    await expect(start(newUser(), { file })).rejects.toMatchObject({ code: "unavailable", message: "No Android here." });
    expect(existsSync(file)).toBe(false);
  });

  it("shows the running session to the person who owns it, so a reloaded page can pick it up", async () => {
    const userId = newUser();
    expect(activeAndroidSession(userId)).toBeNull();
    const session = await start(userId);
    expect(activeAndroidSession(userId)?.id).toBe(session.id);
    expect(activeAndroidSession(newUser())).toBeNull();
    await closeAndroidSession(userId, session.id);
    expect(activeAndroidSession(userId)).toBeNull();
  });

  it("is recorded in the user's jobs as an APK test, and counts towards the month's APK tests", async () => {
    const userId = newUser();
    const session = await start(userId, { fileName: "shop.apk" });
    await waitFor(() => getAndroidSession(userId, session.id)?.status === "live", "live");
    expect(recentJobs(userId)[0]).toMatchObject({ type: "apk", target: "shop.apk", status: "running" });
    expect(dashboardTotals(userId).apkUploadsThisPeriod).toBe(1);
    expect(dashboardTotals(userId).auditsThisPeriod).toBe(0);
    await closeAndroidSession(userId, session.id);
    expect(recentJobs(userId)[0].status).toBe("completed");
  });

  it("is recorded as failed when the app would not install", async () => {
    const userId = newUser();
    setAndroidRuntime(fakeRuntime(calls, { installError: "nope" }));
    const session = await start(userId);
    await waitFor(() => getAndroidSession(userId, session.id)?.status === "failed", "failed");
    expect(recentJobs(userId)[0]).toMatchObject({ type: "apk", status: "failed" });
    // A test that never started does not use up one of the month's APK tests.
    expect(dashboardTotals(userId).apkUploadsThisPeriod).toBe(0);
  });

  it("stops a session left idle", () => {
    expect(ANDROID_IDLE_MS).toBe(5 * 60_000);
  });
});

describe("what the phone accepts", () => {
  it("accepts a tap, a swipe, a named button and short text", () => {
    expect(validateAndroidInput({ type: "tap", x: 0.1, y: 0.9 }).ok).toBe(true);
    expect(validateAndroidInput({ type: "swipe", fromX: 0, fromY: 0, toX: 1, toY: 1, durationMs: 250 }).ok).toBe(true);
    expect(validateAndroidInput({ type: "key", key: "HOME" }).ok).toBe(true);
    expect(validateAndroidInput({ type: "text", text: "hello" }).ok).toBe(true);
  });

  it("refuses positions off the screen, long or empty text, other buttons and other actions", () => {
    expect(validateAndroidInput({ type: "tap", x: 1.1, y: 0.5 }).ok).toBe(false);
    expect(validateAndroidInput({ type: "tap", x: "0.5", y: 0.5 }).ok).toBe(false);
    expect(validateAndroidInput({ type: "swipe", fromX: 0, fromY: 0, toX: 1, toY: 1, durationMs: 9000 }).ok).toBe(false);
    expect(validateAndroidInput({ type: "swipe", fromX: 0, fromY: 0, toX: 2, toY: 1, durationMs: 100 }).ok).toBe(false);
    expect(validateAndroidInput({ type: "text", text: "" }).ok).toBe(false);
    expect(validateAndroidInput({ type: "text", text: "a".repeat(201) }).ok).toBe(false);
    expect(validateAndroidInput({ type: "key", key: "POWER" }).ok).toBe(false);
    expect(validateAndroidInput({ type: "shell", command: "reboot" }).ok).toBe(false);
    expect(validateAndroidInput(null).ok).toBe(false);
  });
});
