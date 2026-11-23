import { afterEach, describe, expect, it, vi } from "vitest";
import { createAuditJob, startAuditJob } from "../src/lib/audit/jobs";
import { PAGESPEED_TIMEOUT_MS, runPageSpeedAudit } from "../src/lib/audit/pagespeed";
import { AuditFailure } from "../src/lib/audit/runner";
import type { LighthouseReport } from "../src/lib/audit/summary";
import { hasLocalBrowser } from "../src/lib/testing/environment";

const lighthouseResult: LighthouseReport = {
  finalDisplayedUrl: "https://example.com/",
  categories: {
    performance: { id: "performance", title: "Performance", score: 0.72 },
    accessibility: { id: "accessibility", title: "Accessibility", score: 0.91 },
    "best-practices": { id: "best-practices", title: "Best Practices", score: 1 },
    seo: { id: "seo", title: "SEO", score: 0.85 },
  },
  audits: {
    "largest-contentful-paint": { id: "largest-contentful-paint", title: "LCP", description: "", score: 0.4, scoreDisplayMode: "numeric", displayValue: "4.1 s" },
  },
};

function respond(status: number, body: unknown): typeof fetch {
  return (async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })) as typeof fetch;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("hasLocalBrowser", () => {
  it("is true on a normal server and false on Netlify, Lambda and Vercel", () => {
    expect(hasLocalBrowser({})).toBe(true);
    expect(hasLocalBrowser({ NETLIFY: "true" })).toBe(false);
    expect(hasLocalBrowser({ AWS_LAMBDA_FUNCTION_NAME: "fn" })).toBe(false);
    expect(hasLocalBrowser({ VERCEL: "1" })).toBe(false);
  });

  it("can be forced either way with LIVE_BROWSER", () => {
    expect(hasLocalBrowser({ NETLIFY: "true", LIVE_BROWSER: "on" })).toBe(true);
    expect(hasLocalBrowser({ LIVE_BROWSER: "off" })).toBe(false);
  });
});

describe("runPageSpeedAudit", () => {
  const input = { url: "https://example.com/", formFactor: "mobile" as const };

  it("asks for the four categories, sends the key, and summarises the Lighthouse report", async () => {
    const fetchImpl = vi.fn(respond(200, { lighthouseResult }));
    const result = await runPageSpeedAudit(input, { apiKey: "k-123", fetchImpl });
    const url = new URL(String(fetchImpl.mock.calls[0][0]));
    expect(url.searchParams.get("url")).toBe("https://example.com/");
    expect(url.searchParams.get("strategy")).toBe("mobile");
    expect(url.searchParams.getAll("category")).toEqual(["performance", "accessibility", "best-practices", "seo"]);
    expect(url.searchParams.get("key")).toBe("k-123");
    expect(result.scores.map((score) => [score.id, score.value])).toEqual([
      ["performance", 72],
      ["accessibility", 91],
      ["best-practices", 100],
      ["seo", 85],
    ]);
  });

  it("uses the desktop strategy, and reads the key from PAGESPEED_API_KEY", async () => {
    vi.stubEnv("PAGESPEED_API_KEY", "env-key");
    const fetchImpl = vi.fn(respond(200, { lighthouseResult }));
    await runPageSpeedAudit({ ...input, formFactor: "desktop" }, { fetchImpl });
    const url = new URL(String(fetchImpl.mock.calls[0][0]));
    expect(url.searchParams.get("strategy")).toBe("desktop");
    expect(url.searchParams.get("key")).toBe("env-key");
  });

  it("does not call Google at all without a key, and says the site is not set up", async () => {
    vi.stubEnv("PAGESPEED_API_KEY", "");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchImpl = vi.fn(respond(200, { lighthouseResult }));
    await expect(runPageSpeedAudit(input, { fetchImpl })).rejects.toThrow("Audits are not set up on this site yet. Ask the site owner to finish the setup.");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("explains a busy service, a page it cannot audit, and any other refusal", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const keyed = (fetchImpl: typeof fetch) => ({ apiKey: "k", fetchImpl });
    await expect(runPageSpeedAudit(input, keyed(respond(429, { error: { message: "quota" } })))).rejects.toThrow(/busy/);
    await expect(runPageSpeedAudit(input, keyed(respond(400, { error: { message: "bad" } })))).rejects.toThrow(/could not be audited/);
    await expect(runPageSpeedAudit(input, keyed(respond(500, {})))).rejects.toThrow(/could not finish/);
    await expect(runPageSpeedAudit(input, keyed(respond(200, {})))).rejects.toBeInstanceOf(AuditFailure);
  });

  it("reports a network failure and a timeout without leaking details", async () => {
    const down = (async () => {
      throw new TypeError("fetch failed: ECONNRESET 10.0.0.1");
    }) as typeof fetch;
    await expect(runPageSpeedAudit(input, { apiKey: "k", fetchImpl: down })).rejects.toThrow("The audit service could not be reached. Try again.");
    const slow = (async () => {
      throw Object.assign(new Error("aborted"), { name: "TimeoutError" });
    }) as typeof fetch;
    await expect(runPageSpeedAudit(input, { apiKey: "k", fetchImpl: slow })).rejects.toThrow(/took too long/);
  });

  it("gives up before a typical serverless limit", () => {
    expect(PAGESPEED_TIMEOUT_MS).toBeLessThan(26_000);
  });
});

describe("an audit job on a host without a browser", () => {
  it("finishes inside startAuditJob using PageSpeed Insights, with no browser launched", async () => {
    vi.stubEnv("NETLIFY", "true");
    vi.stubEnv("LIVE_BROWSER", "");
    vi.stubEnv("PAGESPEED_API_KEY", "env-key");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(respond(200, { lighthouseResult }));
    const job = await createAuditJob({ owner: "user:serverless-1", url: "https://example.com/", formFactor: "mobile" });
    await startAuditJob(job);
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(job.status).toBe("completed");
    expect(job.result?.scores).toHaveLength(4);
    expect(job.finishedAt).not.toBeNull();
  });

  it("records a failed job with a readable message when the service refuses", async () => {
    vi.stubEnv("NETLIFY", "true");
    vi.stubEnv("PAGESPEED_API_KEY", "env-key");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(globalThis, "fetch").mockImplementation(respond(429, { error: { message: "quota" } }));
    const job = await createAuditJob({ owner: "user:serverless-2", url: "https://example.com/", formFactor: "desktop" });
    await startAuditJob(job);
    expect(job.status).toBe("failed");
    expect(job.error).toMatch(/busy/);
  });
});
