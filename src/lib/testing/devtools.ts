/**
 * What a live session's page has done, kept for the DevTools panel: every console message and every network request,
 * newest {@link MAX_DEVTOOLS_ENTRIES} of each. This is separate from the bug-capture diagnostics, which keep errors only.
 * The panel is a Pro feature: the log is recorded for every session, but only the Pro-gated route hands it out.
 */

export const MAX_DEVTOOLS_ENTRIES = 200;
const MAX_TEXT_LENGTH = 500;
const MAX_URL_LENGTH = 500;

export type DevtoolsConsoleEntry = {
  /** Increases with every entry, so the panel can tell new entries from ones it has. */
  seq: number;
  /** log, info, warning, error, debug, or "exception" for an uncaught page error. */
  type: string;
  text: string;
  at: number;
  /** Where the page logged it, as Chrome shows it at the right of a message. Null when the browser gives no location. */
  source: DevtoolsSource | null;
};

export type DevtoolsSource = { url: string; line: number };

export type DevtoolsRequest = {
  seq: number;
  method: string;
  url: string;
  resourceType: string;
  /** HTTP status, or null while the request is pending or when it failed before a response. */
  status: number | null;
  /** Why the request failed, when it did. */
  failure: string | null;
  durationMs: number | null;
  /** Bytes transferred (headers and body), known once the request has finished. */
  sizeBytes: number | null;
  at: number;
};

export type DevtoolsLog = {
  /** Bumped on every change, so a poll with the same version can skip the payload. */
  version: number;
  nextSeq: number;
  console: DevtoolsConsoleEntry[];
  requests: DevtoolsRequest[];
};

export type DevtoolsSnapshot = {
  version: number;
  console: DevtoolsConsoleEntry[];
  requests: DevtoolsRequest[];
};

/**
 * The first address-and-line in a stack trace, for an uncaught error that arrives without a location. Chrome frames read
 * "at fn (https://a.com/x.js:12:5)" and WebKit frames "fn@https://a.com/x.js:12:5". Returned with a zero-based line, like
 * the browser's own console locations.
 */
export function sourceFromStack(stack: string): { url: string; lineNumber: number } | null {
  const match = /(https?:\/\/[^\s()]+?):(\d+):\d+/.exec(stack);
  if (!match) return null;
  return { url: match[1], lineNumber: Math.max(0, Number(match[2]) - 1) };
}

export function createDevtoolsLog(): DevtoolsLog {
  return { version: 0, nextSeq: 1, console: [], requests: [] };
}

function trim<T>(list: T[]): void {
  while (list.length > MAX_DEVTOOLS_ENTRIES) list.shift();
}

export function addConsoleEntry(
  log: DevtoolsLog,
  type: string,
  text: string,
  source: { url: string; lineNumber: number } | null = null,
  now = Date.now(),
): void {
  log.console.push({
    seq: log.nextSeq++,
    type,
    text: text.slice(0, MAX_TEXT_LENGTH),
    at: now,
    source: source && source.url ? { url: source.url.slice(0, MAX_URL_LENGTH), line: Math.max(0, Math.trunc(source.lineNumber)) + 1 } : null,
  });
  trim(log.console);
  log.version += 1;
}

/** Starts a request entry and returns it, so the caller can finish or fail the same entry later. */
export function addRequest(
  log: DevtoolsLog,
  request: { method: string; url: string; resourceType: string },
  now = Date.now(),
): DevtoolsRequest {
  const entry: DevtoolsRequest = {
    seq: log.nextSeq++,
    method: request.method,
    url: request.url.slice(0, MAX_URL_LENGTH),
    resourceType: request.resourceType,
    status: null,
    failure: null,
    durationMs: null,
    sizeBytes: null,
    at: now,
  };
  log.requests.push(entry);
  trim(log.requests);
  log.version += 1;
  return entry;
}

export function completeRequest(log: DevtoolsLog, entry: DevtoolsRequest, status: number, now = Date.now()): void {
  entry.status = status;
  entry.durationMs = Math.max(0, now - entry.at);
  log.version += 1;
}

/** Records how many bytes a finished request transferred. Ignores a value that is not a sensible size. */
export function setRequestSize(log: DevtoolsLog, entry: DevtoolsRequest, bytes: number): void {
  if (!Number.isFinite(bytes) || bytes < 0) return;
  entry.sizeBytes = Math.round(bytes);
  log.version += 1;
}

export function failRequest(log: DevtoolsLog, entry: DevtoolsRequest, reason: string, now = Date.now()): void {
  entry.failure = reason.slice(0, MAX_TEXT_LENGTH);
  entry.durationMs = Math.max(0, now - entry.at);
  log.version += 1;
}

/** A copy of the log, or null when nothing has changed since `after` (the version the caller already has). */
export function readDevtools(log: DevtoolsLog, after: number): DevtoolsSnapshot | null {
  if (log.version <= after) return null;
  return {
    version: log.version,
    console: log.console.map((entry) => ({ ...entry })),
    requests: log.requests.map((entry) => ({ ...entry })),
  };
}
