import { describe, expect, it } from "vitest";
import { bugFileStem, buildBugReport, type BugCapture } from "../src/lib/testing/bug-report";

function capture(overrides: Partial<BugCapture> = {}): BugCapture {
  return {
    capturedAt: "2026-11-12T09:30:45.123Z",
    pageUrl: "https://example.com/cart",
    pageTitle: "Cart",
    device: { name: "iPhone 15 Pro", viewport: { width: 393, height: 852 }, landscape: false, engine: "webkit" },
    userAgent: "Mozilla/5.0 (iPhone)",
    consoleMessages: [{ type: "error", text: "Uncaught TypeError: x is undefined" }],
    pageErrors: [],
    failedRequests: [{ url: "https://example.com/api/cart", reason: "net::ERR_CONNECTION_RESET" }],
    httpErrors: [{ url: "https://example.com/missing.png", status: 404 }],
    screenshot: "data:image/png;base64,AAAA",
    ...overrides,
  };
}

describe("buildBugReport", () => {
  it("includes the tester's notes, the environment and the evidence", () => {
    const report = buildBugReport(capture(), "Checkout button does nothing", "Tap Pay and nothing happens.", "bug.png");
    expect(report).toContain("# Checkout button does nothing");
    expect(report).toContain("Tap Pay and nothing happens.");
    expect(report).toContain("- **Device:** iPhone 15 Pro");
    expect(report).toContain("393 × 852");
    expect(report).toContain("https://example.com/cart");
    expect(report).toContain("![Screenshot](bug.png)");
    expect(report).toContain("[error] Uncaught TypeError: x is undefined");
    expect(report).toContain("https://example.com/api/cart (net::ERR_CONNECTION_RESET)");
    expect(report).toContain("404 https://example.com/missing.png");
  });

  it("falls back to a device title and marks empty sections", () => {
    const report = buildBugReport(capture({ consoleMessages: [] }), "  ", "");
    expect(report).toContain("# Bug on iPhone 15 Pro");
    expect(report).toContain("_No description._");
    expect(report).toContain("## Console errors and warnings\n\nNone recorded.");
    expect(report).not.toContain("## Screenshot");
  });

  it("cannot be broken out of its log blocks by page text", () => {
    const report = buildBugReport(capture({ pageErrors: ["boom ``` # injected heading"] }), "t", "d");
    expect(report).not.toMatch(/boom ```/);
    expect(report).toContain("boom ''' # injected heading");
  });

  it("limits the title and description length", () => {
    const report = buildBugReport(capture(), "t".repeat(500), "d".repeat(5_000));
    expect(report.match(/t{121}/)).toBeNull();
    expect(report.match(/d{2001}/)).toBeNull();
  });
});

describe("bugFileStem", () => {
  it("builds a file-safe name from the device and time", () => {
    expect(bugFileStem(capture())).toBe("bug-iphone-15-pro-20261112-0930");
  });

  it("copes with a device name that has no usable characters", () => {
    expect(bugFileStem(capture({ device: { name: "###", viewport: { width: 1, height: 1 }, landscape: false, engine: "chromium" } }))).toBe(
      "bug-device-20261112-0930",
    );
  });
});
