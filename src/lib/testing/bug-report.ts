import type { ConsoleEntry, FailedRequest, HttpErrorEntry } from "./runner";

/**
 * Evidence taken from a live browser session at the moment a tester spots a bug. It holds no tester notes: the title and
 * description are added in the browser and only appear in the downloaded report.
 */
export type BugCapture = {
  capturedAt: string;
  pageUrl: string;
  pageTitle: string;
  device: { name: string; viewport: { width: number; height: number }; landscape: boolean; engine: string };
  userAgent: string;
  /** Console errors and warnings, newest last. */
  consoleMessages: ConsoleEntry[];
  /** Uncaught exceptions thrown by the page. */
  pageErrors: string[];
  failedRequests: FailedRequest[];
  httpErrors: HttpErrorEntry[];
  /** PNG of the page, as a data URL. */
  screenshot: string;
};

export const MAX_BUG_TITLE_LENGTH = 120;
export const MAX_BUG_DESCRIPTION_LENGTH = 2_000;

/** Page text can contain a code fence; swap it so the log block in the report cannot be closed early. */
function fenced(lines: string[]): string {
  return ["```", ...lines.map((line) => line.replaceAll("```", "'''")), "```"].join("\n");
}

function section(heading: string, lines: string[]): string {
  return lines.length > 0 ? `## ${heading} (${lines.length})\n\n${fenced(lines)}\n` : `## ${heading}\n\nNone recorded.\n`;
}

/** A Markdown bug report that can be pasted into an issue tracker. The screenshot is saved as a separate file. */
export function buildBugReport(capture: BugCapture, title: string, description: string, screenshotFile?: string): string {
  const heading = title.trim().slice(0, MAX_BUG_TITLE_LENGTH) || `Bug on ${capture.device.name}`;
  const notes = description.trim().slice(0, MAX_BUG_DESCRIPTION_LENGTH);
  const { device } = capture;
  const parts = [
    `# ${heading}`,
    notes ? `${notes}\n` : "_No description._\n",
    "## Environment\n",
    [
      `- **Device:** ${device.name}`,
      `- **Engine:** ${device.engine}`,
      `- **Viewport:** ${device.viewport.width} × ${device.viewport.height}${device.landscape ? " (landscape)" : ""}`,
      `- **Page:** ${capture.pageUrl}`,
      `- **Page title:** ${capture.pageTitle || "(none)"}`,
      `- **Captured:** ${capture.capturedAt}`,
      `- **User agent:** ${capture.userAgent || "(unknown)"}`,
    ].join("\n") + "\n",
    screenshotFile ? `## Screenshot\n\n![Screenshot](${screenshotFile})\n` : "",
    section(
      "Console errors and warnings",
      capture.consoleMessages.map((entry) => `[${entry.type}] ${entry.text}`),
    ),
    section("Uncaught page errors", capture.pageErrors),
    section(
      "Failed requests",
      capture.failedRequests.map((entry) => `${entry.url} (${entry.reason})`),
    ),
    section(
      "HTTP errors",
      capture.httpErrors.map((entry) => `${entry.status} ${entry.url}`),
    ),
  ];
  return parts.filter(Boolean).join("\n");
}

/** A safe file name stem such as `bug-iphone-15-20261112-0930`. */
export function bugFileStem(capture: BugCapture): string {
  const slug = capture.device.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const stamp = capture.capturedAt.slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
  return `bug-${slug || "device"}-${stamp}`;
}
