import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/** What the app needs to know about an uploaded APK. */
export type ApkInfo = {
  /** The app's package id, such as com.example.app. It is checked against a strict pattern before it is used anywhere. */
  packageName: string;
  label: string;
  versionName: string;
  versionCode: string;
  minSdk: number | null;
  targetSdk: number | null;
  /** The screen the app opens on. Null for an APK with no launcher screen. */
  launchActivity: string | null;
  /** CPU types the app carries native code for. Empty when it is plain Java or Kotlin, which runs everywhere. */
  nativeCode: string[];
  permissionCount: number;
};

export class ApkRejected extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApkRejected";
  }
}

/** A package id: dot-separated parts that start with a letter. The only form that is ever put in a command. */
const PACKAGE_PATTERN = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/;
/** A class name, as used in an activity: letters, digits, dots, dollar signs and underscores. */
const ACTIVITY_PATTERN = /^[A-Za-z0-9_.$]+$/;

/** A zip file starts with these four bytes, and an APK is a zip file. */
export function looksLikeZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

/** The value of key='...' on a line of aapt2 output. */
function quoted(line: string, key: string): string | null {
  const match = line.match(new RegExp(`${key}='([^']*)'`));
  return match ? match[1] : null;
}

/** Turns the text from `aapt2 dump badging` into ApkInfo. Throws ApkRejected when the file is not a usable app. */
export function parseBadging(text: string): ApkInfo {
  const lines = text.split(/\r?\n/);
  const packageLine = lines.find((line) => line.startsWith("package:"));
  const packageName = packageLine ? quoted(packageLine, "name") : null;
  if (!packageName || !PACKAGE_PATTERN.test(packageName)) {
    throw new ApkRejected("This file is not a valid Android app.");
  }

  const launchLine = lines.find((line) => line.startsWith("launchable-activity:"));
  const launchActivity = launchLine ? quoted(launchLine, "name") : null;
  if (launchActivity !== null && !ACTIVITY_PATTERN.test(launchActivity)) {
    throw new ApkRejected("This app has a screen name that cannot be opened.");
  }

  const number = (prefix: string): number | null => {
    const line = lines.find((entry) => entry.startsWith(`${prefix}:`));
    const value = line ? Number(line.match(/'(\d+)'/)?.[1]) : Number.NaN;
    return Number.isFinite(value) ? value : null;
  };

  const nativeLine = lines.find((line) => line.startsWith("native-code:"));
  const nativeCode = nativeLine ? [...nativeLine.matchAll(/'([^']+)'/g)].map((match) => match[1]) : [];

  const labelLine = lines.find((line) => line.startsWith("application-label:"));
  const label = (labelLine ? labelLine.match(/'([^']*)'/)?.[1] : null) || packageName;

  return {
    packageName,
    label: label.slice(0, 80),
    versionName: (packageLine ? quoted(packageLine, "versionName") : null) ?? "",
    versionCode: (packageLine ? quoted(packageLine, "versionCode") : null) ?? "",
    // aapt2 writes minSdkVersion. The older aapt wrote sdkVersion.
    minSdk: number("minSdkVersion") ?? number("sdkVersion"),
    targetSdk: number("targetSdkVersion"),
    launchActivity,
    nativeCode,
    permissionCount: lines.filter((line) => line.startsWith("uses-permission:")).length,
  };
}

/** Reads an APK file with aapt2. Throws ApkRejected when it is not an app, and a plain Error when aapt2 itself cannot run. */
export async function inspectApk(aapt2: string, file: string): Promise<ApkInfo> {
  let stdout: string;
  try {
    ({ stdout } = await run(aapt2, ["dump", "badging", file], { timeout: 30_000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 }));
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr ?? "";
    // aapt2 exits with an error for a file that is not an APK. A missing program or a timeout is something else.
    if (stderr.includes("error:") || stderr.includes("failed")) throw new ApkRejected("This file is not a valid Android app.");
    throw new Error("The APK could not be read.");
  }
  return parseBadging(stdout);
}

/** A friendly reason for the most common install failures. Other failures keep a short, safe summary. */
export function installFailureMessage(output: string): string {
  const code = output.match(/INSTALL_[A-Z_]+/)?.[0] ?? "";
  switch (code) {
    case "INSTALL_FAILED_NO_MATCHING_ABIS":
      return "This app only includes code for ARM phones, and the emulator is an Intel one that cannot run it.";
    case "INSTALL_FAILED_OLDER_SDK":
      return "This app needs a newer version of Android than the emulator has.";
    case "INSTALL_FAILED_DEPRECATED_SDK_VERSION":
      return "This app was built for a very old version of Android, which this emulator will not install.";
    case "INSTALL_PARSE_FAILED_NO_CERTIFICATES":
    case "INSTALL_PARSE_FAILED_UNEXPECTED_EXCEPTION":
    case "INSTALL_PARSE_FAILED_NOT_APK":
      return "This file is not a valid, signed Android app.";
    case "INSTALL_FAILED_INSUFFICIENT_STORAGE":
      return "The emulator ran out of storage while installing the app.";
    case "INSTALL_FAILED_MISSING_SHARED_LIBRARY":
      return "This app needs a system library the emulator does not have.";
    case "":
      return "The app could not be installed.";
    default:
      return `The app could not be installed (${code.replace("INSTALL_", "")}).`;
  }
}
