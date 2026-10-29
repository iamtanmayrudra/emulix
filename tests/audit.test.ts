import http from "node:http";
import { describe, expect, it } from "vitest";
import { startPublicOnlyProxy } from "../src/lib/audit/public-proxy";
import { summarizeReport, type LighthouseReport } from "../src/lib/audit/summary";
import { runLighthouseAudit } from "../src/lib/audit/runner";

const report: LighthouseReport = {
  finalDisplayedUrl: "https://example.com/",
  categories: {
    performance: { id: "performance", title: "Performance", score: 0.72 },
    accessibility: { id: "accessibility", title: "Accessibility", score: 0.91 },
    "best-practices": { id: "best-practices", title: "Best Practices", score: null },
    seo: { id: "seo", title: "SEO", score: 0.85 },
  },
  audits: {
    "largest-contentful-paint": { id: "largest-contentful-paint", title: "LCP", description: "", score: 0.4, scoreDisplayMode: "numeric", displayValue: "4.1 s" },
    "cumulative-layout-shift": { id: "cumulative-layout-shift", title: "CLS", description: "", score: 1, scoreDisplayMode: "numeric", displayValue: "0" },
    "total-blocking-time": { id: "total-blocking-time", title: "TBT", description: "", score: 0.7, scoreDisplayMode: "numeric", displayValue: "180 ms" },
    "meta-description": { id: "meta-description", title: "Missing meta description", description: "Add one. [Learn more](https://web.dev/x).", score: 0, scoreDisplayMode: "binary" },
    "render-blocking": { id: "render-blocking", title: "Render-blocking CSS", description: "Defer it.", score: 0.8, scoreDisplayMode: "numeric" },
    "server-info": { id: "server-info", title: "Info only", description: "", score: null, scoreDisplayMode: "informative" },
  },
};

describe("summarizeReport", () => {
  const result = summarizeReport(report, { requestedUrl: "https://example.com/", formFactor: "mobile", fetchedAt: new Date("2026-10-28T00:00:00Z") });

  it("keeps the scored categories, skipping unscored ones", () => {
    expect(result.scores).toEqual([
      { id: "performance", label: "Performance", value: 72 },
      { id: "accessibility", label: "Accessibility", value: 91 },
      { id: "seo", label: "SEO", value: 85 },
    ]);
  });

  it("maps Lighthouse scores to vital tones", () => {
    expect(result.vitals).toEqual([
      { id: "lcp", label: "LCP", value: "4.1 s", tone: "poor" },
      { id: "cls", label: "CLS", value: "0", tone: "good" },
      { id: "tbt", label: "TBT", value: "180 ms", tone: "fair" },
    ]);
  });

  it("lists failing audits worst first, with links stripped from the detail", () => {
    expect(result.findings.map((f) => [f.priority, f.title])).toEqual([
      ["High", "Missing meta description"],
      ["High", "LCP"],
      ["Medium", "TBT"],
      ["Medium", "Render-blocking CSS"],
    ]);
    expect(result.findings[0].detail).toBe("Add one. Learn more.");
    expect(summarizeReport({ ...report, audits: { x: { id: "x", title: "T", description: "One main. Learn more about landmarks.", score: 0, scoreDisplayMode: "binary" } } }, { requestedUrl: "u", formFactor: "mobile", fetchedAt: new Date() }).findings[0].detail).toBe("One main.");
  });
});

describe("findings with solutions", () => {
  const fixtures: LighthouseReport = {
    categories: {
      accessibility: { id: "accessibility", title: "Accessibility", score: 0.5, auditRefs: [{ id: "color-contrast" }, { id: "landmark-one-main" }] },
      performance: { id: "performance", title: "Performance", score: 0.5, auditRefs: [{ id: "uses-long-cache-ttl" }, { id: "some-new-audit" }, { id: "cache-insight" }] },
    },
    audits: {
      "color-contrast": {
        id: "color-contrast",
        title: "Low contrast",
        description: "Text needs contrast. [Learn more about contrast](https://dequeuniversity.com/rules/axe/color-contrast).",
        score: 0,
        scoreDisplayMode: "binary",
        displayValue: "3 elements",
        details: {
          items: [
            { node: { snippet: '<p class="muted">Hello</p>', selector: "p.muted" } },
            { node: { snippet: '<p class="muted">Hello</p>' } },
            { node: { selector: "footer > a" } },
            { node: { selector: "extra" } },
          ],
        },
      },
      "uses-long-cache-ttl": {
        id: "uses-long-cache-ttl",
        title: "Cache lifetimes",
        description: "Cache it. [Learn more](javascript:alert(1)).",
        score: 0.4,
        scoreDisplayMode: "numeric",
        details: { items: [{ url: "https://example.com/app.js", wastedBytes: 20480 }, "not an object", { nothing: true }] },
      },
      "link-text": {
        id: "link-text",
        title: "Links do not have descriptive text",
        description: "",
        score: 0,
        scoreDisplayMode: "binary",
        details: { items: [{ href: "https://example.com/pricing", text: " Click   here " }, { href: "https://example.com/about", text: "" }] },
      },
      "some-new-audit": { id: "some-new-audit", title: "Something new", description: "", score: 0.2, scoreDisplayMode: "numeric" },
      "cache-insight": { id: "cache-insight", title: "Cache insight", description: "", score: 0.3, scoreDisplayMode: "numeric" },
    },
  };
  const result = summarizeReport(fixtures, { requestedUrl: "https://example.com/", formFactor: "mobile", fetchedAt: new Date("2026-10-28T00:00:00Z") });
  const byId = (id: string) => result.findings.find((finding) => finding.id === id)!;

  it("attaches the specific fix for a known audit, with the category and impact", () => {
    const finding = byId("color-contrast");
    expect(finding.category).toBe("accessibility");
    expect(finding.impact).toBe("3 elements");
    expect(finding.solution.steps.length).toBeGreaterThan(1);
    expect(finding.solution.example?.language).toBe("css");
  });

  it("takes the guide link from the Lighthouse description, and only if it is https", () => {
    expect(byId("color-contrast").docsUrl).toBe("https://dequeuniversity.com/rules/axe/color-contrast");
    expect(byId("uses-long-cache-ttl").docsUrl).toBeNull();
  });

  it("lists up to three distinct failing items and ignores items it cannot read", () => {
    expect(byId("color-contrast").evidence).toEqual(['<p class="muted">Hello</p>', "footer > a", "extra"]);
    expect(byId("uses-long-cache-ttl").evidence).toEqual(["https://example.com/app.js · about 20 KiB"]);
  });

  it("shows a link's text with where it points", () => {
    expect(byId("link-text").evidence).toEqual(['"Click here" → https://example.com/pricing', "https://example.com/about"]);
  });

  it("falls back to the category's advice, then to a generic one, for audits it has no entry for", () => {
    expect(byId("some-new-audit").solution.summary).toMatch(/biggest files/);
    expect(summarizeReport({ categories: {}, audits: { x: { id: "x", title: "X", description: "", score: 0, scoreDisplayMode: "binary" } } }, { requestedUrl: "u", formFactor: "mobile", fetchedAt: new Date() }).findings[0].solution.steps).toHaveLength(3);
  });

  it("shares a fix between an audit and its insight", () => {
    expect(byId("cache-insight").solution).toBe(byId("uses-long-cache-ttl").solution);
  });
});

describe("startPublicOnlyProxy", () => {
  it("refuses plain requests to private addresses", async () => {
    const proxy = await startPublicOnlyProxy();
    try {
      const status = await new Promise<number>((resolve, reject) => {
        const req = http.get({ host: "127.0.0.1", port: Number(new URL(proxy.url).port), path: "http://10.0.0.1/", headers: { host: "10.0.0.1" } }, (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        });
        req.on("error", reject);
      });
      expect(status).toBe(403);
    } finally {
      await proxy.close();
    }
  });
});

describe("runLighthouseAudit input checks", () => {
  it("refuses private targets before starting a browser", async () => {
    await expect(runLighthouseAudit({ url: "http://localhost/", formFactor: "mobile" })).rejects.toThrow("Local addresses cannot be tested.");
  });
});

const live = process.env.LIVE_TEST === "1";
describe.runIf(live)("live Lighthouse audit", () => {
  it("scores a public page in the Playwright Chromium", async () => {
    const result = await runLighthouseAudit({ url: "https://example.com/", formFactor: "mobile" });
    expect(result.scores.length).toBeGreaterThanOrEqual(3);
    expect(result.vitals.map((v) => v.id)).toEqual(["lcp", "cls", "tbt"]);
    expect(result.formFactor).toBe("mobile");
  }, 180_000);
});
