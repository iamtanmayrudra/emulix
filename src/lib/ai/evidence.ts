import { AiFailure } from "./errors";
import { redactText, redactUrl } from "./redact";
import type { ExplainTarget } from "./types";

/**
 * Turns what the browser sends into the evidence the model sees. The browser is not trusted: every field is checked,
 * capped and redacted here, and anything unexpected is dropped or refused.
 */

const MAX_ITEMS = 50;
const MAX_TEXT = 500;
const MAX_TITLE = 200;
/** Base64 length. About 3 MB of image, under the provider's 5 MB limit. */
const MAX_IMAGE_BASE64 = 4_000_000;

export type BugEvidence = {
  device: { name: string; viewport: { width: number; height: number }; landscape: boolean; engine: string };
  page: { url: string; title: string };
  consoleMessages: { type: string; text: string }[];
  pageErrors: string[];
  failedRequests: { url: string; reason: string }[];
  httpErrors: { url: string; status: number }[];
  screenshot?: { mediaType: "image/png" | "image/jpeg"; data: string };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function list(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.slice(-MAX_ITEMS).filter(isRecord) : [];
}

function dimension(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(10_000, Math.max(0, Math.round(value))) : 0;
}

function httpStatus(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;
}

function readScreenshot(value: unknown): BugEvidence["screenshot"] {
  if (typeof value !== "string" || value.length > MAX_IMAGE_BASE64 + 40) return undefined;
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match || match[2].length > MAX_IMAGE_BASE64) return undefined;
  return { mediaType: match[1] === "png" ? "image/png" : "image/jpeg", data: match[2] };
}

/** `capture` is the bug capture the browser holds. A screenshot that is missing, malformed or too large is left out. */
export function parseBugEvidence(capture: unknown): BugEvidence {
  if (!isRecord(capture) || !isRecord(capture.device) || typeof capture.device.name !== "string" || !capture.device.name) {
    throw new AiFailure("invalid_input", "Capture a bug first, then draft the report.");
  }
  const device = capture.device;
  const viewport = isRecord(device.viewport) ? device.viewport : {};
  return {
    device: {
      name: text(device.name, 80),
      viewport: { width: dimension(viewport.width), height: dimension(viewport.height) },
      landscape: device.landscape === true,
      engine: text(device.engine, 20),
    },
    page: { url: redactUrl(text(capture.pageUrl, 2_000)), title: redactText(text(capture.pageTitle, MAX_TITLE)) },
    consoleMessages: list(capture.consoleMessages).map((entry) => ({ type: text(entry.type, 20), text: redactText(text(entry.text, MAX_TEXT)) })),
    pageErrors: (Array.isArray(capture.pageErrors) ? capture.pageErrors.slice(-MAX_ITEMS) : [])
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => redactText(entry.slice(0, MAX_TEXT))),
    failedRequests: list(capture.failedRequests).map((entry) => ({ url: redactUrl(text(entry.url, 2_000)), reason: text(entry.reason, 100) })),
    httpErrors: list(capture.httpErrors).map((entry) => ({ url: redactUrl(text(entry.url, 2_000)), status: httpStatus(entry.status) ?? 0 })),
    screenshot: readScreenshot(capture.screenshot),
  };
}

/** `target` is the console message or request the tester asked about. */
export function parseExplainTarget(target: unknown): ExplainTarget {
  if (isRecord(target) && target.kind === "console") {
    const body = redactText(text(target.text, MAX_TEXT));
    if (!body) throw new AiFailure("invalid_input", "Choose a console message to explain.");
    return { kind: "console", type: text(target.type, 20), text: body };
  }
  if (isRecord(target) && target.kind === "network") {
    const url = redactUrl(text(target.url, 2_000));
    if (!url) throw new AiFailure("invalid_input", "Choose a request to explain.");
    return {
      kind: "network",
      method: text(target.method, 10).toUpperCase(),
      url,
      resourceType: text(target.resourceType, 30),
      status: httpStatus(target.status),
      failure: target.failure === null || target.failure === undefined ? null : redactText(text(target.failure, 200)),
    };
  }
  throw new AiFailure("invalid_input", "Choose something to explain.");
}
