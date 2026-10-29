import { existsSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEVICE_PROFILES } from "../src/lib/mock-data";
import { runWebsiteTest } from "../src/lib/testing/runner";

/**
 * Real browser run against a public site. Needs internet access and Playwright's Chromium.
 * Skipped unless LIVE_TEST=1, so the default test run stays offline and fast.
 */
const live = process.env.LIVE_TEST === "1";

describe.runIf(live)("live browser run", () => {
  it("loads a public page in headless Chromium and records evidence", async () => {
    const profile = DEVICE_PROFILES.find((p) => p.id === "iphone-14");
    if (!profile) throw new Error("iphone-14 profile missing");

    const dir = path.join(os.tmpdir(), "emulix-live-test");
    const result = await runWebsiteTest({
      jobId: `live-${Date.now()}`,
      url: "https://example.com/",
      profile,
      landscape: false,
      screenshotDir: dir,
    });

    expect(result.status).toBe(200);
    expect(result.title.length).toBeGreaterThan(0);
    expect(result.viewport).toEqual({ width: profile.width, height: profile.height });
    expect(result.isMobile).toBe(true);
    expect(result.loadTimeMs).toBeGreaterThan(0);
    expect(existsSync(result.screenshotPath)).toBe(true);
    expect(statSync(result.screenshotPath).size).toBeGreaterThan(1000);
  }, 90_000);
});
