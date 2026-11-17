import type { DevtoolsConsoleEntry, DevtoolsRequest } from "./devtools";

/** Pure helpers for the DevTools panel: Chrome's units, its console levels and its network type filters. */

/** Chrome shows milliseconds under a second and seconds above, such as "180 ms" and "3.04 s". */
export function formatDuration(ms: number | null): string {
  if (ms === null) return "";
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
}

/** Chrome uses decimal units: "512 B", "1.2 kB", "3.4 MB". */
export function formatSize(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(bytes < 10_000 ? 1 : 0)} kB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

export type ConsoleLevel = "error" | "warning" | "info" | "log" | "verbose";

export const CONSOLE_LEVELS: { id: ConsoleLevel; label: string }[] = [
  { id: "error", label: "Errors" },
  { id: "warning", label: "Warnings" },
  { id: "info", label: "Info" },
  { id: "log", label: "Logs" },
  { id: "verbose", label: "Verbose" },
];

/** Chrome's "Default levels": everything except Verbose. */
export const DEFAULT_CONSOLE_LEVELS: ConsoleLevel[] = ["error", "warning", "info", "log"];

export function consoleLevel(type: string): ConsoleLevel {
  switch (type) {
    case "error":
    case "exception":
    case "assert":
      return "error";
    case "warning":
    case "warn":
      return "warning";
    case "info":
      return "info";
    case "debug":
      return "verbose";
    default:
      return "log";
  }
}

export function consoleMatches(entry: DevtoolsConsoleEntry, levels: ConsoleLevel[], filter: string): boolean {
  if (!levels.includes(consoleLevel(entry.type))) return false;
  const needle = filter.trim().toLowerCase();
  if (!needle) return true;
  return entry.text.toLowerCase().includes(needle) || (entry.source?.url.toLowerCase().includes(needle) ?? false);
}

/** The file name Chrome shows at the right of a console message: "main.js:12". */
export function sourceLabel(source: DevtoolsConsoleEntry["source"]): string {
  if (!source) return "";
  const name = lastSegment(source.url) || source.url;
  return `${name}:${source.line}`;
}

export type NetworkFilter = "all" | "fetch" | "js" | "css" | "img" | "media" | "font" | "doc" | "ws" | "wasm" | "manifest" | "other";

export const NETWORK_FILTERS: { id: NetworkFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "fetch", label: "Fetch/XHR" },
  { id: "js", label: "JS" },
  { id: "css", label: "CSS" },
  { id: "img", label: "Img" },
  { id: "media", label: "Media" },
  { id: "font", label: "Font" },
  { id: "doc", label: "Doc" },
  { id: "ws", label: "WS" },
  { id: "wasm", label: "Wasm" },
  { id: "manifest", label: "Manifest" },
  { id: "other", label: "Other" },
];

const FILTER_BY_RESOURCE_TYPE: Record<string, NetworkFilter> = {
  fetch: "fetch",
  xhr: "fetch",
  script: "js",
  stylesheet: "css",
  image: "img",
  media: "media",
  font: "font",
  document: "doc",
  websocket: "ws",
  manifest: "manifest",
};

export function networkFilterFor(request: Pick<DevtoolsRequest, "resourceType" | "url">): NetworkFilter {
  if (/\.wasm(\?|$)/i.test(request.url)) return "wasm";
  return FILTER_BY_RESOURCE_TYPE[request.resourceType] ?? "other";
}

export function networkMatches(request: DevtoolsRequest, filter: NetworkFilter, text: string): boolean {
  if (filter !== "all" && networkFilterFor(request) !== filter) return false;
  const needle = text.trim().toLowerCase();
  return !needle || request.url.toLowerCase().includes(needle);
}

function lastSegment(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return decodeURIComponent(parts.at(-1) ?? "") || parsed.host;
  } catch {
    return url;
  }
}

/** The "Name" column: the last part of the path, or the host for the page itself. */
export function requestName(url: string): string {
  return lastSegment(url) || url;
}

/** What follows the name in a Chrome tooltip and details pane: the address without the name's own segment. */
export function requestOrigin(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

const STATUS_TEXT: Record<number, string> = {
  200: "OK",
  201: "Created",
  202: "Accepted",
  204: "No Content",
  206: "Partial Content",
  301: "Moved Permanently",
  302: "Found",
  303: "See Other",
  304: "Not Modified",
  307: "Temporary Redirect",
  308: "Permanent Redirect",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  408: "Request Timeout",
  409: "Conflict",
  410: "Gone",
  429: "Too Many Requests",
  500: "Internal Server Error",
  501: "Not Implemented",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
};

/** "404 Not Found", as the details pane shows it. A code without a well-known name is shown on its own. */
export function statusLine(status: number): string {
  const text = STATUS_TEXT[status];
  return text ? `${status} ${text}` : String(status);
}

export type StatusCell = { label: string; failed: boolean };

/** The "Status" column: the code, "(failed)" for a request that never got an answer, "(pending)" while it is in flight. */
export function statusCell(request: Pick<DevtoolsRequest, "status" | "failure">): StatusCell {
  if (request.failure) return { label: "(failed)", failed: true };
  if (request.status === null) return { label: "(pending)", failed: false };
  return { label: String(request.status), failed: request.status >= 400 };
}

export type NetworkSummary = { count: number; transferredBytes: number; finishMs: number | null };

/** The status bar at the foot of the Network tab: "12 requests | 340 kB transferred | Finish: 3.04 s". */
export function summarizeRequests(requests: DevtoolsRequest[]): NetworkSummary {
  if (requests.length === 0) return { count: 0, transferredBytes: 0, finishMs: null };
  const start = Math.min(...requests.map((request) => request.at));
  const end = Math.max(...requests.map((request) => request.at + (request.durationMs ?? 0)));
  return {
    count: requests.length,
    transferredBytes: requests.reduce((total, request) => total + (request.sizeBytes ?? 0), 0),
    finishMs: end - start,
  };
}

/** Where a request's bar sits in the waterfall, as percentages of the whole capture. */
export function waterfallBar(request: DevtoolsRequest, requests: DevtoolsRequest[]): { left: number; width: number } {
  const start = Math.min(...requests.map((item) => item.at));
  const end = Math.max(...requests.map((item) => item.at + (item.durationMs ?? 0)), start + 1);
  const span = end - start;
  const left = ((request.at - start) / span) * 100;
  const width = Math.max(0.5, (((request.durationMs ?? span - (request.at - start)) / span) * 100));
  return { left: Math.min(left, 99.5), width: Math.min(width, 100 - Math.min(left, 99.5)) };
}
