import { describe, expect, it } from "vitest";
import { createAuditJob } from "../src/lib/audit/jobs";
import type { AuditResult } from "../src/lib/audit/summary";
import { clearReports, listReports, removeReport } from "../src/lib/reports";
import { csvCell, reportsToCsv } from "../src/lib/reports/csv";
import { recordSessionEnd, recordSessionStart } from "../src/lib/reports/history";
import { createTestJob } from "../src/lib/testing/jobs";

let counter = 0;
const newUser = () => `reports-user-${(counter += 1)}-${Math.random().toString(36).slice(2, 8)}`;

const RESULT: AuditResult = {
  requestedUrl: "https://8.8.8.8/",
  finalUrl: "https://8.8.8.8/",
  formFactor: "mobile",
  fetchedAt: "2026-10-30T10:00:00.000Z",
  scores: [
    { id: "performance", label: "Performance", value: 90 },
    { id: "accessibility", label: "Accessibility", value: 80 },
    { id: "best-practices", label: "Best practices", value: 100 },
    { id: "seo", label: "SEO", value: 70 },
  ],
  vitals: [{ id: "lcp", label: "LCP", value: "1.2 s", tone: "good" }],
  findings: [
    {
      id: "meta-description",
      priority: "High",
      title: "Missing meta description",
      detail: "Add one.",
      category: "seo",
      impact: null,
      evidence: [],
      docsUrl: null,
      solution: { summary: "Control the snippet.", steps: ["Add a description tag."] },
    },
  ],
};

async function addAudit(userId: string, patch: Partial<{ status: "queued" | "running" | "completed" | "failed"; result: AuditResult | null }> = {}) {
  const job = await createAuditJob({ owner: `user:${userId}`, url: "https://8.8.8.8/", formFactor: "mobile" });
  job.status = patch.status ?? "completed";
  job.result = patch.result === undefined ? RESULT : patch.result;
  job.finishedAt = job.status === "queued" || job.status === "running" ? null : new Date(new Date(job.createdAt).getTime() + 42_000).toISOString();
  return job;
}

describe("listing reports", () => {
  it("merges audits, test runs and live sessions, newest first", async () => {
    const userId = newUser();
    const audit = await addAudit(userId);
    const test = await createTestJob({ userId, url: "https://8.8.8.8/", profileId: "pixel-7", landscape: false, plan: "free" });
    test.status = "completed";
    recordSessionStart({ id: `s-${userId}`, userId, url: "https://8.8.8.8/", profileName: "iPhone 14", startedAt: "2099-01-01T00:00:00.000Z" });

    const entries = listReports(userId);
    expect(entries.map((entry) => entry.id.split(":")[0])).toEqual(expect.arrayContaining(["live", "audit", "test"]));
    expect(entries[0].id).toBe(`live:s-${userId}`);
    expect(entries.every((entry) => !entry.sample)).toBe(true);
    expect(entries.map((entry) => entry.id)).toContain(`audit:${audit.id}`);
  });

  it("summarises an audit: overall score, scores, findings with their fix, and how long it took", async () => {
    const userId = newUser();
    await addAudit(userId);
    const [entry] = listReports(userId);
    expect(entry).toMatchObject({ kind: "audit", status: "completed", durationMs: 42_000, device: "Mobile, Lighthouse" });
    expect(entry.audit?.overall).toBe(85);
    expect(entry.audit?.findings[0]).toMatchObject({ title: "Missing meta description", steps: ["Add a description tag."] });
  });

  it("shows a queued audit as running, with no result yet", async () => {
    const userId = newUser();
    const job = await addAudit(userId, { status: "queued", result: null });
    expect(listReports(userId)[0]).toMatchObject({ status: "running", audit: null, durationMs: null });
    job.status = "failed"; // frees the audit service for the other tests
  });

  it("shows a live session as running until it ends, then as completed with its length", () => {
    const userId = newUser();
    recordSessionStart({ id: `live-${userId}`, userId, url: "https://8.8.8.8/", profileName: "Pixel 7", startedAt: new Date(Date.now() - 5000).toISOString() });
    expect(listReports(userId)[0]).toMatchObject({ status: "running", device: "Pixel 7", durationMs: null });
    recordSessionEnd(`live-${userId}`, "https://8.8.8.8/pricing", "Pricing");
    const [ended] = listReports(userId);
    expect(ended).toMatchObject({ status: "completed", finalUrl: "https://8.8.8.8/pricing", title: "Pricing" });
    expect(ended.durationMs).toBeGreaterThanOrEqual(5000);
  });

  it("keeps each user's reports to themselves", async () => {
    const mine = newUser();
    const theirs = newUser();
    await addAudit(mine);
    await addAudit(theirs);
    expect(listReports(mine)).toHaveLength(1);
    expect(listReports(theirs)).toHaveLength(1);
    expect(listReports(mine)[0].id).not.toBe(listReports(theirs)[0].id);
  });

  it("shows clearly marked examples to someone with no history", () => {
    const entries = listReports(newUser());
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((entry) => entry.sample && entry.id.startsWith("sample:"))).toBe(true);
  });
});

describe("removing reports", () => {
  it("removes a finished report, and only the owner can", async () => {
    const owner = newUser();
    const other = newUser();
    const job = await addAudit(owner);
    expect(removeReport(other, `audit:${job.id}`)).toBe(false);
    expect(removeReport(owner, `audit:${job.id}`)).toBe(true);
    expect(removeReport(owner, `audit:${job.id}`)).toBe(false);
  });

  it("keeps a report that is still running", async () => {
    const userId = newUser();
    const job = await addAudit(userId, { status: "running", result: null });
    expect(removeReport(userId, `audit:${job.id}`)).toBe(false);
    expect(listReports(userId)).toHaveLength(1);
    job.status = "failed"; // frees the audit service for the other tests
  });

  it("will not remove an example row or an unknown id", () => {
    const userId = newUser();
    expect(removeReport(userId, "sample:job_1042")).toBe(false);
    expect(removeReport(userId, "nonsense")).toBe(false);
    expect(removeReport(userId, "audit:")).toBe(false);
  });

  it("clears finished reports and leaves running ones", async () => {
    const userId = newUser();
    await addAudit(userId);
    await addAudit(userId, { status: "failed", result: null });
    recordSessionStart({ id: `c-${userId}`, userId, url: "https://8.8.8.8/", profileName: "Pixel 7", startedAt: new Date().toISOString() });
    recordSessionEnd(`c-${userId}`, "https://8.8.8.8/", "");
    // The active audit limit allows only one running audit per owner, so use a live session for the running one.
    recordSessionStart({ id: `r-${userId}`, userId, url: "https://8.8.8.8/", profileName: "Pixel 7", startedAt: new Date().toISOString() });
    expect(clearReports(userId)).toBe(3);
    const left = listReports(userId);
    expect(left).toHaveLength(1);
    expect(left[0]).toMatchObject({ id: `live:r-${userId}`, status: "running" });
  });
});

describe("CSV export", () => {
  it("escapes quotes, commas and line breaks", () => {
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell(null)).toBe("");
    expect(csvCell(0)).toBe("0");
  });

  it("stops a cell from running as a spreadsheet formula", () => {
    for (const dangerous of ["=1+1", "+SUM(A1)", "-2+3", "@cmd", "\t=1"]) {
      expect(csvCell(dangerous).replace(/^"/, "").startsWith("'")).toBe(true);
    }
    expect(csvCell("https://example.com")).toBe("https://example.com");
  });

  it("writes a header and one row per report, with the audit scores", async () => {
    const userId = newUser();
    await addAudit(userId);
    const csv = reportsToCsv(listReports(userId));
    const [header, row] = csv.trim().split("\r\n");
    expect(header).toBe("Report ID,Type,Target,Device,Status,Started (UTC),Duration (seconds),Overall score,Performance,Accessibility,Best practices,SEO,Findings");
    expect(row).toContain("audit,https://8.8.8.8/,\"Mobile, Lighthouse\",completed");
    expect(row.endsWith(",42,85,90,80,100,70,1")).toBe(true);
  });
});
