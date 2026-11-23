import { AuditFailure } from "./runner";
import { summarizeReport, type AuditResult, type FormFactor, type LighthouseReport } from "./summary";

/**
 * Runs the same Lighthouse audit through Google's PageSpeed Insights service, for hosts that cannot run a browser
 * (see src/lib/testing/environment.ts). The service returns a full Lighthouse report, so the rest of the app reads it
 * exactly like a local run.
 *
 * PAGESPEED_API_KEY is optional but recommended: without a key Google gives a small shared quota that is often used up.
 * It is server-only. The page being audited must be reachable from the internet, which the URL guard already requires.
 */
const ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"];

/** Stays under a typical serverless function limit, so a slow audit ends with a message and not a crashed request. */
export const PAGESPEED_TIMEOUT_MS = 24_000;

type PageSpeedResponse = { lighthouseResult?: unknown; error?: { code?: number; message?: string } };

export async function runPageSpeedAudit(
  input: { url: string; formFactor: FormFactor },
  options: { apiKey?: string; fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<AuditResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiKey = options.apiKey ?? process.env.PAGESPEED_API_KEY?.trim();

  const params = new URLSearchParams({ url: input.url, strategy: input.formFactor === "desktop" ? "desktop" : "mobile" });
  for (const category of CATEGORIES) params.append("category", category);
  if (apiKey) params.set("key", apiKey);

  const fetchedAt = new Date();
  let response: Response;
  try {
    response = await fetchImpl(`${ENDPOINT}?${params}`, { signal: AbortSignal.timeout(options.timeoutMs ?? PAGESPEED_TIMEOUT_MS) });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new AuditFailure(
      "audit_failed",
      timedOut ? "The audit took too long. Try again, or test a faster page." : "The audit service could not be reached. Try again.",
    );
  }

  const body = (await response.json().catch(() => ({}))) as PageSpeedResponse;
  if (!response.ok || !body.lighthouseResult) {
    console.error("[audit] pagespeed failed", response.status, body.error?.message);
    if (response.status === 429) {
      throw new AuditFailure("audit_failed", "The audit service is busy. Try again in a minute.");
    }
    if (response.status === 400) {
      throw new AuditFailure("audit_failed", "That page could not be audited. Check the address is public and loads.");
    }
    throw new AuditFailure("audit_failed", "The audit could not finish. Check the address and try again.");
  }

  return summarizeReport(body.lighthouseResult as LighthouseReport, {
    requestedUrl: input.url,
    formFactor: input.formFactor,
    fetchedAt,
  });
}
