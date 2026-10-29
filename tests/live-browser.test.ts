import { describe, expect, it } from "vitest";
import { closeBrowserSession, getLatestFrame, sendBrowserInput, startBrowserSession } from "../src/lib/testing/browser-sessions";

/**
 * Live browser session against a public site. Needs internet access and Playwright's Chromium.
 * Skipped unless LIVE_TEST=1, so the default test run stays offline and fast.
 */
const live = process.env.LIVE_TEST === "1";
const userId = "live-browser-test";

async function waitForFrame(id: string, after = 0, timeoutMs = 20_000): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const latest = getLatestFrame(userId, id, after);
    if (latest === "gone") throw new Error("session ended");
    if (latest.frame) return latest.frame.seq;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("no frame arrived");
}

describe.runIf(live)("live browser session", () => {
  it("streams frames and applies input from a public page", async () => {
    const session = await startBrowserSession({
      userId,
      url: "https://example.com/",
      profileId: "iphone-14",
      landscape: false,
      plan: "free",
    });
    try {
      expect(session.viewport).toEqual({ width: 390, height: 844 });
      const first = await waitForFrame(session.id);
      await sendBrowserInput(userId, session.id, { type: "wheel", x: 0.5, y: 0.5, deltaY: 200 });
      await waitForFrame(session.id, first);
      await sendBrowserInput(userId, session.id, { type: "click", x: 0.5, y: 0.5 });
    } finally {
      await closeBrowserSession(userId, session.id);
    }
  }, 90_000);
});
