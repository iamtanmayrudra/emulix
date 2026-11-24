import { execFile, spawn, type ChildProcess, type ChildProcessByStdio } from "node:child_process";
import type { Readable, Writable } from "node:stream";
import { promisify } from "node:util";
import { androidSupport, type AndroidTools } from "./sdk";
import { inspectApk, installFailureMessage, type ApkInfo } from "./apk";
import {
  keyCommand,
  swipeCommand,
  tapCommand,
  textCommand,
  type AndroidDevice,
  type AndroidKey,
  type AndroidRuntime,
  type BootPhase,
  type Frame,
} from "./device";

const run = promisify(execFile);

/**
 * How long the emulator gets to finish starting. A cold start takes two to four minutes on a machine with little free
 * memory, so the default allows seven. ANDROID_BOOT_TIMEOUT_SECONDS changes it.
 */
function bootTimeoutMs(env: Record<string, string | undefined>): number {
  const seconds = Number(env.ANDROID_BOOT_TIMEOUT_SECONDS);
  return Number.isFinite(seconds) && seconds >= 30 ? seconds * 1000 : 420_000;
}

/** The phone is shown this many pixels wide. A smaller screen is lighter for the emulator and for the pictures sent back. */
const STREAM_WIDTH = 720;
const FIRST_CONSOLE_PORT = 5556;
const LAST_CONSOLE_PORT = 5584;
const MAX_LOG_BYTES = 16 * 1024;

/** The console ports this server has handed out, so two sessions starting together never pick the same one. */
const portsInUse = new Set<number>();

async function adb(tools: AndroidTools, serial: string | null, args: string[], timeout = 30_000): Promise<string> {
  const { stdout } = await run(tools.adb, serial ? ["-s", serial, ...args] : args, { timeout, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  return stdout;
}

/** Console ports the user's own emulators already hold. They are never touched. */
async function portsHeldByAdb(tools: AndroidTools): Promise<Set<number>> {
  const held = new Set<number>();
  try {
    for (const match of (await adb(tools, null, ["devices"], 15_000)).matchAll(/emulator-(\d+)/g)) held.add(Number(match[1]));
  } catch {
    // If adb cannot say, the emulator itself refuses a port that is taken.
  }
  return held;
}

async function pickConsolePort(tools: AndroidTools): Promise<number> {
  const held = await portsHeldByAdb(tools);
  for (let port = FIRST_CONSOLE_PORT; port <= LAST_CONSOLE_PORT; port += 2) {
    if (!held.has(port) && !portsInUse.has(port)) {
      portsInUse.add(port);
      return port;
    }
  }
  throw new Error("Every emulator slot on this server is in use. Try again in a minute.");
}

/** A readable reason for an emulator that stopped before it was ready, from what it printed. */
function startFailure(log: string): string {
  if (/Not enough space to create userdata partition/i.test(log)) {
    return "This server does not have enough free disk space to start the Android emulator (it needs about 7.5 GB free).";
  }
  if (/already running|locked|multiinstance/i.test(log)) return "That Android device is already in use. Try again in a minute.";
  if (/hypervisor|haxm|whpx|kvm/i.test(log) && /not (installed|available|found|supported)|unavailable/i.test(log)) {
    return "This server cannot accelerate the Android emulator (virtualization is off or missing).";
  }
  return "The Android emulator could not start.";
}

/** The screen size from `wm size`: the override when one is set, otherwise the physical size. */
export function parseScreenSize(output: string): { width: number; height: number } | null {
  const line = output.match(/Override size:\s*(\d+)x(\d+)/) ?? output.match(/Physical size:\s*(\d+)x(\d+)/) ?? output.match(/(\d+)x(\d+)/);
  return line ? { width: Number(line[1]), height: Number(line[2]) } : null;
}

/** Makes the phone's screen STREAM_WIDTH pixels wide, with the same shape and the same apparent size, if it is wider. */
async function shrinkScreen(tools: AndroidTools, serial: string): Promise<void> {
  try {
    const size = parseScreenSize((await adb(tools, serial, ["shell", "wm", "size"], 10_000)).replace(/Override size:.*\r?\n?/, ""));
    const density = Number((await adb(tools, serial, ["shell", "wm", "density"], 10_000)).match(/Physical density:\s*(\d+)/)?.[1]);
    if (!size || size.width <= STREAM_WIDTH || !Number.isFinite(density)) return;
    const height = Math.round((size.height * STREAM_WIDTH) / size.width);
    const scaledDensity = Math.round((density * STREAM_WIDTH) / size.width);
    await adb(tools, serial, ["shell", `wm size ${STREAM_WIDTH}x${height}; wm density ${scaledDensity}`], 15_000);
    // The screen redraws at the new size. Give it a moment before the first picture.
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  } catch {
    // The phone still works at its own size, just heavier.
  }
}

/** A shell on the phone that stays open, so each tap does not pay for starting a new adb process. */
class PhoneShell {
  private readonly proc: ChildProcessByStdio<Writable, Readable, null>;
  private output = "";
  private counter = 0;
  private waiting = new Map<string, () => void>();
  private ended = false;

  constructor(tools: AndroidTools, serial: string) {
    this.proc = spawn(tools.adb, ["-s", serial, "shell"], { stdio: ["pipe", "pipe", "ignore"], windowsHide: true });
    this.proc.stdout.on("data", (chunk: Buffer) => {
      this.output += chunk.toString("utf8");
      for (const [marker, done] of this.waiting) {
        if (this.output.includes(marker)) {
          this.waiting.delete(marker);
          done();
        }
      }
      // Only the end can still hold a marker that has not fully arrived.
      if (this.output.length > 4096) this.output = this.output.slice(-1024);
    });
    this.proc.on("exit", () => {
      this.ended = true;
      for (const done of this.waiting.values()) done();
      this.waiting.clear();
    });
  }

  /** Runs one command and resolves when the phone has finished it. */
  run(command: string, timeoutMs = 10_000): Promise<void> {
    if (this.ended) return Promise.reject(new Error("The phone shell has closed."));
    const marker = `__EMX_${++this.counter}__`;
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiting.delete(marker);
        reject(new Error("The phone did not answer."));
      }, timeoutMs);
      this.waiting.set(marker, () => {
        clearTimeout(timer);
        resolve();
      });
      this.proc.stdin.write(`${command}\necho ${marker}\n`);
    });
  }

  close() {
    this.ended = true;
    try {
      this.proc.stdin.end();
      this.proc.kill();
    } catch {
      // Already gone.
    }
  }
}

/** Ends the emulator, and anything it started. On Windows a plain kill leaves the child process behind. */
async function killEmulator(tools: AndroidTools, serial: string, proc: ChildProcess): Promise<void> {
  await adb(tools, serial, ["emu", "kill"], 8_000).catch(() => undefined);
  if (proc.exitCode === null && proc.pid) {
    if (process.platform === "win32") {
      await run("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { windowsHide: true }).catch(() => undefined);
    } else {
      proc.kill("SIGKILL");
    }
  }
}

async function toJpeg(png: Buffer): Promise<Frame> {
  try {
    const sharp = (await import("sharp")).default;
    return { data: await sharp(png).jpeg({ quality: 70 }).toBuffer(), contentType: "image/jpeg" };
  } catch {
    return { data: png, contentType: "image/png" };
  }
}

class EmulatorDevice implements AndroidDevice {
  constructor(
    private readonly tools: AndroidTools,
    private readonly proc: ChildProcess,
    private readonly shell: PhoneShell,
    private readonly port: number,
    readonly serial: string,
    readonly width: number,
    readonly height: number,
  ) {}

  async screenshot(): Promise<Frame> {
    const { stdout } = await run(this.tools.adb, ["-s", this.serial, "exec-out", "screencap", "-p"], {
      encoding: "buffer",
      timeout: 15_000,
      windowsHide: true,
      maxBuffer: 32 * 1024 * 1024,
    });
    // A PNG starts with these bytes. Anything else means the phone gave an error message instead of a picture.
    if (stdout.length < 8 || stdout[0] !== 0x89 || stdout[1] !== 0x50) throw new Error("The screen could not be read.");
    return toJpeg(stdout);
  }

  tap(x: number, y: number) {
    return this.shell.run(tapCommand(x, y, this));
  }

  swipe(fromX: number, fromY: number, toX: number, toY: number, durationMs: number) {
    return this.shell.run(swipeCommand({ x: fromX, y: fromY }, { x: toX, y: toY }, durationMs, this));
  }

  key(name: AndroidKey) {
    return this.shell.run(keyCommand(name));
  }

  async text(value: string) {
    const command = textCommand(value);
    if (command) await this.shell.run(command);
  }

  async install(file: string) {
    const attempt = async (extra: string[]) => {
      try {
        const { stdout, stderr } = await run(this.tools.adb, ["-s", this.serial, "install", "-r", "-t", ...extra, file], {
          timeout: 180_000,
          windowsHide: true,
        });
        return { ok: /Success/.test(stdout), output: `${stdout}${stderr}` };
      } catch (error) {
        const failure = error as { stdout?: string; stderr?: string };
        return { ok: false, output: `${failure.stdout ?? ""}${failure.stderr ?? ""}` };
      }
    };
    let result = await attempt([]);
    // Android 14 and newer refuse apps built for Android 6 or older. This switch lets a tester try them anyway.
    if (!result.ok && result.output.includes("INSTALL_FAILED_DEPRECATED_SDK_VERSION")) {
      result = await attempt(["--bypass-low-target-sdk-block"]);
    }
    if (!result.ok) throw new Error(installFailureMessage(result.output));
  }

  async launch(app: Pick<ApkInfo, "packageName" | "launchActivity">) {
    // Both names were checked against strict patterns when the APK was read. They are quoted for the phone's shell too.
    const command = app.launchActivity
      ? `am start -n '${app.packageName}/${app.launchActivity}'`
      : `monkey -p ${app.packageName} -c android.intent.category.LAUNCHER 1`;
    await this.shell.run(command, 20_000);
  }

  async close() {
    this.shell.close();
    await killEmulator(this.tools, this.serial, this.proc);
    portsInUse.delete(this.port);
  }
}

/** The real runtime: it starts emulators from the Android SDK on this machine. */
export function createAndroidRuntime(env: Record<string, string | undefined> = process.env): AndroidRuntime {
  return {
    async support() {
      const support = await androidSupport(env);
      if (!support.ok) return support;
      return { ok: true, profiles: support.avds.map((name) => ({ id: name, label: name.replace(/_/g, " ") })) };
    },

    async inspect(file) {
      const support = await androidSupport(env);
      if (!support.ok) throw new Error(support.reason);
      if (!support.tools.aapt2) throw new Error("The Android build tools (aapt2) are needed to read APK files.");
      return inspectApk(support.tools.aapt2, file);
    },

    async boot(profileId, onPhase: (phase: BootPhase) => void) {
      const support = await androidSupport(env, false);
      if (!support.ok) throw new Error(support.reason);
      if (!support.avds.includes(profileId)) throw new Error("That Android device is not available.");
      const { tools } = support;

      const port = await pickConsolePort(tools);
      const serial = `emulator-${port}`;
      onPhase("starting");

      const proc = spawn(
        tools.emulator,
        [
          "-avd", profileId,
          "-port", String(port),
          // A read-only run starts from a clean copy every time and lets several run at once. Nothing is kept afterwards.
          "-read-only",
          "-no-window",
          "-no-audio",
          "-no-boot-anim",
          "-no-snapshot-save",
          "-gpu", "swiftshader_indirect",
          "-netdelay", "none",
          "-netspeed", "full",
        ],
        { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
      );
      let log = "";
      const collect = (chunk: Buffer) => {
        if (log.length < MAX_LOG_BYTES) log += chunk.toString("utf8");
      };
      proc.stdout?.on("data", collect);
      proc.stderr?.on("data", collect);
      let exited = false;
      proc.on("exit", () => {
        exited = true;
      });

      const fail = async (message: string): Promise<never> => {
        await killEmulator(tools, serial, proc);
        portsInUse.delete(port);
        throw new Error(message);
      };

      onPhase("booting");
      const deadline = Date.now() + bootTimeoutMs(env);
      let booted = false;
      while (Date.now() < deadline) {
        if (exited) return fail(startFailure(log));
        try {
          if ((await adb(tools, serial, ["shell", "getprop", "sys.boot_completed"], 10_000)).trim() === "1") {
            booted = true;
            break;
          }
        } catch {
          // The emulator is not on adb yet.
        }
        await new Promise((resolve) => setTimeout(resolve, 2_000));
      }
      if (!booted) return fail("The Android emulator took too long to start.");

      // No animations, a screen that never turns off, and no "not responding" pop-ups, which appear on a busy host and
      // would cover the app. What the tester sees is the app.
      await adb(
        tools,
        serial,
        [
          "shell",
          "settings put global window_animation_scale 0; settings put global transition_animation_scale 0; settings put global animator_duration_scale 0; settings put global hide_error_dialogs 1; settings put system screen_off_timeout 2147483647; svc power stayon true; input keyevent 82",
        ],
        20_000,
      ).catch(() => undefined);

      await shrinkScreen(tools, serial);
      const size = parseScreenSize(await adb(tools, serial, ["shell", "wm", "size"], 10_000).catch(() => ""));
      if (!size) return fail("The emulator screen size could not be read.");

      return new EmulatorDevice(tools, proc, new PhoneShell(tools, serial), port, serial, size.width, size.height);
    },
  };
}
