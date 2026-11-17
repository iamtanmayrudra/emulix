import { describe, expect, it } from "vitest";
import { addConsoleEntry, addRequest, completeRequest, createDevtoolsLog, readDevtools, setRequestSize, sourceFromStack } from "../src/lib/testing/devtools";
import {
  DEFAULT_CONSOLE_LEVELS,
  consoleLevel,
  consoleMatches,
  formatDuration,
  formatSize,
  networkFilterFor,
  networkMatches,
  requestName,
  sourceLabel,
  statusCell,
  statusLine,
  summarizeRequests,
  waterfallBar,
} from "../src/lib/testing/devtools-format";

function request(overrides: Partial<ReturnType<typeof addRequest>> = {}) {
  const log = createDevtoolsLog();
  const entry = addRequest(log, { method: "GET", url: "https://example.com/app/main.js", resourceType: "script" }, 1_000);
  Object.assign(entry, overrides);
  return entry;
}

describe("formatDuration", () => {
  it.each([
    [null, ""],
    [85, "85 ms"],
    [999.4, "999 ms"],
    [1000, "1.00 s"],
    [3039, "3.04 s"],
  ])("formats %s as %j", (input, expected) => {
    expect(formatDuration(input)).toBe(expected);
  });
});

describe("formatSize", () => {
  it.each([
    [null, ""],
    [0, "0 B"],
    [512, "512 B"],
    [1200, "1.2 kB"],
    [48_500, "49 kB"],
    [3_400_000, "3.4 MB"],
  ])("formats %s as %j", (input, expected) => {
    expect(formatSize(input)).toBe(expected);
  });
});

describe("console levels", () => {
  it.each([
    ["error", "error"],
    ["exception", "error"],
    ["warning", "warning"],
    ["info", "info"],
    ["log", "log"],
    ["trace", "log"],
    ["debug", "verbose"],
  ])("maps %s to %s", (type, level) => {
    expect(consoleLevel(type)).toBe(level);
  });

  it("hides Verbose by default, like Chrome", () => {
    expect(DEFAULT_CONSOLE_LEVELS).not.toContain("verbose");
  });

  it("filters by level and by text in the message or the source", () => {
    const log = createDevtoolsLog();
    addConsoleEntry(log, "error", "Failed to fetch cart", { url: "https://a.com/cart.js", lineNumber: 4 });
    addConsoleEntry(log, "debug", "tick");
    const [error, debug] = readDevtools(log, 0)!.console;
    expect(consoleMatches(error, DEFAULT_CONSOLE_LEVELS, "")).toBe(true);
    expect(consoleMatches(debug, DEFAULT_CONSOLE_LEVELS, "")).toBe(false);
    expect(consoleMatches(debug, ["verbose"], "")).toBe(true);
    expect(consoleMatches(error, DEFAULT_CONSOLE_LEVELS, "CART")).toBe(true);
    expect(consoleMatches(error, DEFAULT_CONSOLE_LEVELS, "cart.js")).toBe(true);
    expect(consoleMatches(error, DEFAULT_CONSOLE_LEVELS, "checkout")).toBe(false);
  });
});

describe("console sources", () => {
  it("shows the file name and a one-based line, as Chrome does", () => {
    const log = createDevtoolsLog();
    addConsoleEntry(log, "log", "hi", { url: "https://a.com/static/app.js?v=3", lineNumber: 11 });
    const [entry] = readDevtools(log, 0)!.console;
    expect(entry.source).toEqual({ url: "https://a.com/static/app.js?v=3", line: 12 });
    expect(sourceLabel(entry.source)).toBe("app.js:12");
  });

  it("has no source when the browser gives none", () => {
    const log = createDevtoolsLog();
    addConsoleEntry(log, "log", "hi", { url: "", lineNumber: 0 });
    addConsoleEntry(log, "log", "hi");
    expect(readDevtools(log, 0)!.console.map((entry) => entry.source)).toEqual([null, null]);
    expect(sourceLabel(null)).toBe("");
  });

  it("finds the location in Chrome and WebKit stack traces", () => {
    expect(sourceFromStack("TypeError: x\n    at render (https://a.com/bundle.js:30:12)\n    at https://a.com/other.js:1:1")).toEqual({
      url: "https://a.com/bundle.js",
      lineNumber: 29,
    });
    expect(sourceFromStack("render@https://a.com/bundle.js:7:3")).toEqual({ url: "https://a.com/bundle.js", lineNumber: 6 });
    expect(sourceFromStack("no frames here")).toBeNull();
  });
});

describe("network", () => {
  it("names a request by the last part of its path, or its host", () => {
    expect(requestName("https://example.com/app/main.js?x=1")).toBe("main.js");
    expect(requestName("https://example.com/")).toBe("example.com");
  });

  it.each([
    ["fetch", "https://a.com/api", "fetch"],
    ["xhr", "https://a.com/api", "fetch"],
    ["script", "https://a.com/a.js", "js"],
    ["stylesheet", "https://a.com/a.css", "css"],
    ["image", "https://a.com/a.png", "img"],
    ["document", "https://a.com/", "doc"],
    ["other", "https://a.com/mod.wasm?v=1", "wasm"],
    ["eventsource", "https://a.com/stream", "other"],
  ])("sorts a %s request for %s into %s", (resourceType, url, filter) => {
    expect(networkFilterFor({ resourceType, url })).toBe(filter);
  });

  it("filters by type and by text", () => {
    const script = request();
    const image = request({ resourceType: "image", url: "https://example.com/logo.png" });
    expect(networkMatches(script, "js", "")).toBe(true);
    expect(networkMatches(image, "js", "")).toBe(false);
    expect(networkMatches(image, "all", "LOGO")).toBe(true);
    expect(networkMatches(image, "all", "banner")).toBe(false);
  });

  it("describes status codes as Chrome does", () => {
    expect(statusLine(404)).toBe("404 Not Found");
    expect(statusLine(299)).toBe("299");
    expect(statusCell({ status: 200, failure: null })).toEqual({ label: "200", failed: false });
    expect(statusCell({ status: 500, failure: null })).toEqual({ label: "500", failed: true });
    expect(statusCell({ status: null, failure: "net::ERR_FAILED" })).toEqual({ label: "(failed)", failed: true });
    expect(statusCell({ status: null, failure: null })).toEqual({ label: "(pending)", failed: false });
  });

  it("records the transferred size once a request finishes", () => {
    const log = createDevtoolsLog();
    const entry = addRequest(log, { method: "GET", url: "https://a.com/", resourceType: "document" }, 0);
    completeRequest(log, entry, 200, 50);
    expect(entry.sizeBytes).toBeNull();
    setRequestSize(log, entry, 1234.6);
    setRequestSize(log, entry, -5);
    setRequestSize(log, entry, Number.NaN);
    expect(readDevtools(log, 0)!.requests[0].sizeBytes).toBe(1235);
  });

  it("summarises the capture for the status bar", () => {
    const first = request({ at: 1_000, durationMs: 200, sizeBytes: 1_000 });
    const second = request({ at: 1_500, durationMs: 2_000, sizeBytes: 2_500 });
    expect(summarizeRequests([first, second])).toEqual({ count: 2, transferredBytes: 3_500, finishMs: 2_500 });
    expect(summarizeRequests([])).toEqual({ count: 0, transferredBytes: 0, finishMs: null });
  });

  it("places waterfall bars inside the capture", () => {
    const first = request({ at: 1_000, durationMs: 500 });
    const second = request({ at: 1_500, durationMs: 500 });
    const all = [first, second];
    expect(waterfallBar(first, all)).toEqual({ left: 0, width: 50 });
    expect(waterfallBar(second, all)).toEqual({ left: 50, width: 50 });
    const pending = request({ at: 1_500, durationMs: null });
    const bar = waterfallBar(pending, [first, pending]);
    expect(bar.left + bar.width).toBeLessThanOrEqual(100);
  });
});
