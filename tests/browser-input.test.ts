import { describe, expect, it } from "vitest";
import { validateBrowserInput } from "../src/lib/testing/browser-sessions";

/** What the live browser accepts from a device. Anything else is refused before it reaches the page. */
describe("validateBrowserInput", () => {
  it("accepts a press and a release with a click count, defaulting to a single click", () => {
    expect(validateBrowserInput({ type: "down", x: 0.5, y: 0.25, clickCount: 2 })).toEqual({
      ok: true,
      input: { type: "down", x: 0.5, y: 0.25, clickCount: 2 },
    });
    expect(validateBrowserInput({ type: "up", x: 0, y: 1 })).toEqual({ ok: true, input: { type: "up", x: 0, y: 1, clickCount: 1 } });
  });

  it("refuses a click count outside 1 to 3, and positions outside the page", () => {
    for (const clickCount of [0, 4, 1.5, "2", null]) {
      expect(validateBrowserInput({ type: "down", x: 0.5, y: 0.5, clickCount }).ok).toBe(false);
    }
    expect(validateBrowserInput({ type: "down", x: 1.2, y: 0.5, clickCount: 1 }).ok).toBe(false);
    expect(validateBrowserInput({ type: "up", x: 0.5, y: -0.1, clickCount: 1 }).ok).toBe(false);
    expect(validateBrowserInput({ type: "move", x: Number.NaN, y: 0.5 }).ok).toBe(false);
  });

  it("accepts a hover or drag move", () => {
    expect(validateBrowserInput({ type: "move", x: 0.1, y: 0.9 })).toEqual({ ok: true, input: { type: "move", x: 0.1, y: 0.9 } });
  });

  it("accepts a paste of up to 2000 characters, and refuses an empty or longer one", () => {
    expect(validateBrowserInput({ type: "paste", text: "a".repeat(2000) }).ok).toBe(true);
    expect(validateBrowserInput({ type: "paste", text: "a".repeat(2001) }).ok).toBe(false);
    expect(validateBrowserInput({ type: "paste", text: "" }).ok).toBe(false);
    expect(validateBrowserInput({ type: "paste", text: 5 }).ok).toBe(false);
  });

  it("keeps typed text to 500 characters, as before", () => {
    expect(validateBrowserInput({ type: "text", text: "a".repeat(500) }).ok).toBe(true);
    expect(validateBrowserInput({ type: "text", text: "a".repeat(501) }).ok).toBe(false);
  });

  it("accepts a drop-down choice by option number", () => {
    expect(validateBrowserInput({ type: "select", x: 0.5, y: 0.5, index: 3 })).toEqual({
      ok: true,
      input: { type: "select", x: 0.5, y: 0.5, index: 3 },
    });
    for (const index of [-1, 1.5, "1", 5001, undefined]) {
      expect(validateBrowserInput({ type: "select", x: 0.5, y: 0.5, index }).ok).toBe(false);
    }
  });

  it("accepts a short value for a date, time or colour field, and refuses a long or non-text one", () => {
    expect(validateBrowserInput({ type: "setValue", x: 0.5, y: 0.5, value: "2026-12-25" }).ok).toBe(true);
    expect(validateBrowserInput({ type: "setValue", x: 0.5, y: 0.5, value: "#ff0000" }).ok).toBe(true);
    expect(validateBrowserInput({ type: "setValue", x: 0.5, y: 0.5, value: "" }).ok).toBe(true);
    expect(validateBrowserInput({ type: "setValue", x: 0.5, y: 0.5, value: "x".repeat(41) }).ok).toBe(false);
    expect(validateBrowserInput({ type: "setValue", x: 0.5, y: 0.5, value: 12 }).ok).toBe(false);
  });

  it("accepts the named keys for shift-tab, select all, undo and redo, and still refuses raw chords", () => {
    for (const key of ["ShiftTab", "SelectAll", "Undo", "Redo", "Enter", "Tab", "ArrowDown"]) {
      expect(validateBrowserInput({ type: "key", key }).ok, key).toBe(true);
    }
    for (const key of ["Control+A", "Control+Alt+Delete", "Meta+Q", "F5", "a"]) {
      expect(validateBrowserInput({ type: "key", key }).ok, key).toBe(false);
    }
  });

  it("still accepts the older click action and refuses unknown ones", () => {
    expect(validateBrowserInput({ type: "click", x: 0.5, y: 0.5 }).ok).toBe(true);
    expect(validateBrowserInput({ type: "evaluate", code: "alert(1)" }).ok).toBe(false);
    expect(validateBrowserInput(null).ok).toBe(false);
  });
});
