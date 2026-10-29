import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser, type ConsoleMessage, type Request } from "playwright";
import type { DeviceProfile } from "@/lib/mock-data";
import { guardPublicRequests } from "./route-guard";
import { parseTargetUrl } from "./url-guard";

export const NAVIGATION_TIMEOUT_MS = 30_000;
export const JOB_TIMEOUT_MS = 60_000;
const MAX_ITEMS = 25;

export type ConsoleEntry = { type: string; text: string };
export type FailedRequest = { url: string; reason: string };
export type HttpErrorEntry = { url: string; status: number };

export type RunResult = {
  finalUrl: string;
  /** HTTP status of the main document, or null if the browser received no response. */
  status: number | null;
  title: string;
  loadTimeMs: number;
  viewport: { width: number; height: number };
  deviceScaleFactor: number;
  isMobile: boolean;
  consoleErrors: ConsoleEntry[];
  failedRequests: FailedRequest[];
  httpErrors: HttpErrorEntry[];
  requestCount: number;
  screenshotPath: string;
};

export type RunInput = {
  jobId: string;
  url: string;
  profile: DeviceProfile;
  landscape: boolean;
  screenshotDir: string;
};

export function screenshotDirectory(): string {
  return path.join(process.cwd(), ".artifacts", "screenshots");
}

function viewportFor(profile: DeviceProfile, landscape: boolean) {
  const width = landscape ? profile.height : profile.width;
  const height = landscape ? profile.width : profile.height;
  return { width, height };
}

/** Runs one real headless Chromium visit with the device's viewport and touch settings. */
export async function runWebsiteTest(input: RunInput): Promise<RunResult> {
  const parsed = parseTargetUrl(input.url);
  if (!parsed.ok) throw new Error(parsed.reason);

  const viewport = viewportFor(input.profile, input.landscape);
  const isMobile = input.profile.kind !== "desktop";
  const deviceScaleFactor = isMobile ? 2 : 1;

  await mkdir(input.screenshotDir, { recursive: true });
  const screenshotPath = path.join(input.screenshotDir, `${input.jobId}.png`);

  const consoleErrors: ConsoleEntry[] = [];
  const failedRequests: FailedRequest[] = [];
  const httpErrors: HttpErrorEntry[] = [];
  let requestCount = 0;

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] });
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor,
      isMobile,
      hasTouch: isMobile,
      acceptDownloads: false,
      serviceWorkers: "block",
    });

    await guardPublicRequests(context, (requestUrl) => {
      if (failedRequests.length < MAX_ITEMS) {
        failedRequests.push({ url: requestUrl, reason: "Blocked: non-public address" });
      }
    });

    const page = await context.newPage();
    page.on("console", (message: ConsoleMessage) => {
      if ((message.type() === "error" || message.type() === "warning") && consoleErrors.length < MAX_ITEMS) {
        consoleErrors.push({ type: message.type(), text: message.text().slice(0, 500) });
      }
    });
    page.on("requestfailed", (request: Request) => {
      if (failedRequests.length < MAX_ITEMS && !request.failure()?.errorText.includes("blockedbyclient")) {
        failedRequests.push({ url: request.url(), reason: request.failure()?.errorText ?? "failed" });
      }
    });
    page.on("request", () => {
      requestCount += 1;
    });
    page.on("response", (response) => {
      if (response.status() >= 400 && httpErrors.length < MAX_ITEMS) {
        httpErrors.push({ url: response.url(), status: response.status() });
      }
    });

    const started = Date.now();
    const response = await page.goto(parsed.url.toString(), {
      waitUntil: "load",
      timeout: NAVIGATION_TIMEOUT_MS,
    });
    const loadTimeMs = Date.now() - started;

    const title = (await page.title()).slice(0, 200);
    await page.screenshot({ path: screenshotPath, type: "png" });

    return {
      finalUrl: page.url(),
      status: response?.status() ?? null,
      title,
      loadTimeMs,
      viewport,
      deviceScaleFactor,
      isMobile,
      consoleErrors,
      failedRequests,
      httpErrors,
      requestCount,
      screenshotPath,
    };
  } finally {
    await browser?.close();
  }
}
