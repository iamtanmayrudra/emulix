import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createAndroidRuntime } from "../src/lib/android/runtime";
import { androidSupport } from "../src/lib/android/sdk";

/**
 * Starts a real Android emulator, installs a real APK, looks at the screen and taps it.
 *
 * Skipped unless ANDROID_LIVE_TEST=1 and ANDROID_APK points at an APK file, because it needs the Android SDK, an AVD,
 * about 7.5 GB of free disk and a few minutes. Run it with:
 *
 *   $env:ANDROID_LIVE_TEST = "1"; $env:ANDROID_APK = "C:\path\to\app.apk"; npx vitest run tests/android-live.test.ts
 */
const apk = process.env.ANDROID_APK ?? "";
const enabled = process.env.ANDROID_LIVE_TEST === "1" && existsSync(apk);

describe.runIf(enabled)("a real Android emulator", () => {
  it("boots, installs the app, opens it, shows its screen and takes a tap", async () => {
    const support = await androidSupport(process.env, false);
    expect(support.ok, support.ok ? "" : support.reason).toBe(true);
    if (!support.ok) return;

    const runtime = createAndroidRuntime();
    const info = await runtime.inspect(apk);
    expect(info.launchActivity).not.toBeNull();

    const device = await runtime.boot(support.avds[0], () => undefined);
    try {
      expect(device.width).toBeGreaterThan(100);
      await device.install(apk);
      await device.launch(info);
      await new Promise((resolve) => setTimeout(resolve, 3_000));

      const frame = await device.screenshot();
      expect(frame.data.length).toBeGreaterThan(1_000);
      expect(["image/jpeg", "image/png"]).toContain(frame.contentType);

      await device.tap(device.width / 2, device.height / 2);
      await device.key("BACK");
      const after = await device.screenshot();
      expect(after.data.length).toBeGreaterThan(1_000);
    } finally {
      await device.close();
    }
  }, 600_000);
});
