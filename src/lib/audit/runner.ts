import { createServer } from "node:net";
import { chromium, type Browser } from "playwright";
import { parseTargetUrl, resolvesToPublicAddress } from "@/lib/testing/url-guard";
import { startPublicOnlyProxy } from "./public-proxy";
import { summarizeReport, type AuditResult, type FormFactor, type LighthouseReport } from "./summary";

export const AUDIT_CATEGORIES = ["performance", "accessibility", "best-practices", "seo"];

export class AuditFailure extends Error {
  constructor(
    readonly code: "invalid_url" | "unsafe_target" | "concurrency_limit" | "audit_failed",
    message: string,
  ) {
    super(message);
  }
}

/** Picks a free local port for the browser's debugging endpoint that Lighthouse connects to. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

/**
 * Runs a Lighthouse audit in the Playwright Chromium, with all of the browser's traffic going through the
 * public-only proxy. Takes around 15 to 60 seconds depending on the page.
 */
export async function runLighthouseAudit(input: { url: string; formFactor: FormFactor }): Promise<AuditResult> {
  const parsed = parseTargetUrl(input.url);
  if (!parsed.ok) throw new AuditFailure("invalid_url", parsed.reason);
  if (!(await resolvesToPublicAddress(parsed.url.hostname))) {
    throw new AuditFailure("unsafe_target", "That address does not resolve to a public server.");
  }

  const fetchedAt = new Date();
  const proxy = await startPublicOnlyProxy();
  let browser: Browser | null = null;
  try {
    const port = await freePort();
    browser = await chromium.launch({
      headless: true,
      args: [`--remote-debugging-port=${port}`],
      proxy: { server: proxy.url },
    });

    const lighthouse = (await import("lighthouse")).default;
    const run = await lighthouse(parsed.url.toString(), {
      port,
      output: "json",
      logLevel: "error",
      onlyCategories: AUDIT_CATEGORIES,
      ...(input.formFactor === "desktop" ? { preset: "desktop" } : {}),
    });

    if (!run) throw new Error("Lighthouse returned no report");
    return summarizeReport(run.lhr as unknown as LighthouseReport, {
      requestedUrl: parsed.url.toString(),
      formFactor: input.formFactor,
      fetchedAt,
    });
  } catch (error) {
    console.error("[audit] lighthouse run failed", error);
    throw new AuditFailure("audit_failed", "The audit could not finish. Check the address and try again.");
  } finally {
    await browser?.close().catch(() => undefined);
    await proxy.close();
  }
}
