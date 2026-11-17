import { describe, expect, it } from "vitest";
import {
  MAX_DEVTOOLS_ENTRIES,
  addConsoleEntry,
  addRequest,
  completeRequest,
  createDevtoolsLog,
  failRequest,
  readDevtools,
} from "../src/lib/testing/devtools";

describe("devtools log", () => {
  it("starts empty and reports nothing new", () => {
    expect(readDevtools(createDevtoolsLog(), 0)).toBeNull();
  });

  it("records console entries in order with rising sequence numbers", () => {
    const log = createDevtoolsLog();
    addConsoleEntry(log, "log", "hello");
    addConsoleEntry(log, "error", "boom");
    const snapshot = readDevtools(log, 0);
    expect(snapshot?.console.map((entry) => [entry.seq, entry.type, entry.text])).toEqual([
      [1, "log", "hello"],
      [2, "error", "boom"],
    ]);
  });

  it("returns null when the caller already has the current version, and a snapshot after a change", () => {
    const log = createDevtoolsLog();
    addConsoleEntry(log, "log", "a");
    const first = readDevtools(log, 0);
    expect(first).not.toBeNull();
    expect(readDevtools(log, first!.version)).toBeNull();
    addConsoleEntry(log, "log", "b");
    expect(readDevtools(log, first!.version)?.console).toHaveLength(2);
  });

  it("tracks a request from start to response", () => {
    const log = createDevtoolsLog();
    const entry = addRequest(log, { method: "GET", url: "https://example.com/a.js", resourceType: "script" }, 1_000);
    expect(entry.status).toBeNull();
    completeRequest(log, entry, 200, 1_250);
    expect(readDevtools(log, 0)?.requests[0]).toMatchObject({ status: 200, failure: null, durationMs: 250 });
  });

  it("tracks a failed request", () => {
    const log = createDevtoolsLog();
    const entry = addRequest(log, { method: "GET", url: "https://example.com/x", resourceType: "fetch" }, 0);
    failRequest(log, entry, "net::ERR_CONNECTION_REFUSED", 40);
    expect(readDevtools(log, 0)?.requests[0]).toMatchObject({ status: null, failure: "net::ERR_CONNECTION_REFUSED", durationMs: 40 });
  });

  it("keeps only the newest entries of each kind", () => {
    const log = createDevtoolsLog();
    for (let i = 0; i < MAX_DEVTOOLS_ENTRIES + 10; i++) {
      addConsoleEntry(log, "log", `line ${i}`);
      addRequest(log, { method: "GET", url: `https://example.com/${i}`, resourceType: "fetch" });
    }
    const snapshot = readDevtools(log, 0)!;
    expect(snapshot.console).toHaveLength(MAX_DEVTOOLS_ENTRIES);
    expect(snapshot.requests).toHaveLength(MAX_DEVTOOLS_ENTRIES);
    expect(snapshot.console.at(-1)?.text).toBe(`line ${MAX_DEVTOOLS_ENTRIES + 9}`);
  });

  it("truncates very long text and addresses", () => {
    const log = createDevtoolsLog();
    addConsoleEntry(log, "log", "x".repeat(5_000));
    addRequest(log, { method: "GET", url: `https://example.com/${"y".repeat(5_000)}`, resourceType: "fetch" });
    const snapshot = readDevtools(log, 0)!;
    expect(snapshot.console[0].text).toHaveLength(500);
    expect(snapshot.requests[0].url).toHaveLength(500);
  });

  it("hands out copies, so a snapshot does not change when the page keeps going", () => {
    const log = createDevtoolsLog();
    const entry = addRequest(log, { method: "GET", url: "https://example.com/", resourceType: "document" });
    const snapshot = readDevtools(log, 0)!;
    completeRequest(log, entry, 200);
    expect(snapshot.requests[0].status).toBeNull();
  });
});
