import { describe, expect, it } from "vitest";
import { validateBrowserInput } from "../src/lib/testing/browser-sessions";

describe("validateBrowserInput", () => {
  it.each([
    [{ type: "click", x: 0.5, y: 0.25 }],
    [{ type: "wheel", x: 0, y: 1, deltaY: -120 }],
    [{ type: "text", text: "a" }],
    [{ type: "key", key: "Enter" }],
    [{ type: "navigate", url: "https://example.com/" }],
    [{ type: "back" }],
    [{ type: "forward" }],
    [{ type: "reload" }],
  ])("accepts %j", (value) => {
    expect(validateBrowserInput(value).ok).toBe(true);
  });

  it.each([
    [null],
    [{ type: "eval", code: "1" }],
    [{ type: "click", x: 1.5, y: 0 }],
    [{ type: "click", x: "0.5", y: 0 }],
    [{ type: "wheel", x: 0, y: 0, deltaY: 99999 }],
    [{ type: "text", text: "" }],
    [{ type: "text", text: "x".repeat(501) }],
    [{ type: "key", key: "Control" }],
    [{ type: "navigate", url: "x".repeat(3000) }],
  ])("rejects %j", (value) => {
    expect(validateBrowserInput(value).ok).toBe(false);
  });
});
