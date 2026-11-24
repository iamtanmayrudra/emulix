import { describe, expect, it } from "vitest";
import { createAuditJob } from "../src/lib/audit/jobs";
import { dashboardTotals, recentJobs } from "../src/lib/reports/dashboard";
import { recordSessionEnd, recordSessionStart } from "../src/lib/reports/history";

/** The dashboard shows the signed-in user's own jobs, from the same record as the Reports page. Never the example rows. */
let counter = 0;
const newUser = () => `dashboard-user-${++counter}`;

function session(userId: string, id: string, startedAt: string, ended = true) {
  recordSessionStart({ id, userId, url: `https://example.com/${id}`, profileName: "iPhone 14", startedAt });
  if (ended) recordSessionEnd(id, `https://example.com/${id}`, "Title");
}

describe("recent jobs on the dashboard", () => {
  it("is empty for someone who has run nothing, instead of showing example rows", () => {
    const userId = newUser();
    expect(recentJobs(userId)).toEqual([]);
    expect(dashboardTotals(userId)).toEqual({ total: 0, completed: 0, successRate: 0, auditsThisPeriod: 0 });
  });

  it("lists a live session with its address, device and time, in the Reports page format", () => {
    const userId = newUser();
    session(userId, `${userId}-a`, "2026-11-24T10:05:30.000Z");
    expect(recentJobs(userId)).toEqual([
      {
        id: `live:${userId}-a`,
        type: "website",
        target: `https://example.com/${userId}-a`,
        profile: "iPhone 14",
        status: "completed",
        startedAt: "2026-11-24 10:05 UTC",
      },
    ]);
  });

  it("shows a session that is still open as running", () => {
    const userId = newUser();
    session(userId, `${userId}-open`, "2026-11-24T10:05:00.000Z", false);
    expect(recentJobs(userId)[0].status).toBe("running");
  });

  it("puts the newest first, keeps the newest four, and mixes sessions with audits", async () => {
    const userId = newUser();
    for (let hour = 1; hour <= 5; hour += 1) session(userId, `${userId}-${hour}`, `2026-11-20T0${hour}:00:00.000Z`);
    const audit = await createAuditJob({ owner: `user:${userId}`, url: "https://93.184.216.34/", formFactor: "mobile" });
    // An audit is dated when it was created, which is now, so it is the newest.
    const jobs = recentJobs(userId);
    expect(jobs).toHaveLength(4);
    expect(jobs[0]).toMatchObject({ id: `audit:${audit.id}`, type: "audit", status: "running", profile: "Mobile, Lighthouse" });
    expect(jobs.slice(1).map((job) => job.id)).toEqual([`live:${userId}-5`, `live:${userId}-4`, `live:${userId}-3`]);
  });

  it("keeps each user's jobs to themselves", () => {
    const a = newUser();
    const b = newUser();
    session(a, `${a}-1`, "2026-11-24T10:00:00.000Z");
    expect(recentJobs(a)).toHaveLength(1);
    expect(recentJobs(b)).toEqual([]);
  });
});

describe("dashboard totals", () => {
  it("counts every job, the completed ones, and the success rate", async () => {
    const userId = newUser();
    session(userId, `${userId}-1`, "2026-11-10T10:00:00.000Z");
    session(userId, `${userId}-2`, "2026-11-11T10:00:00.000Z");
    session(userId, `${userId}-3`, "2026-11-12T10:00:00.000Z", false);
    const audit = await createAuditJob({ owner: `user:${userId}`, url: "https://93.184.216.34/", formFactor: "desktop" });
    audit.status = "failed";
    const totals = dashboardTotals(userId);
    expect(totals.total).toBe(4);
    expect(totals.completed).toBe(2);
    expect(totals.successRate).toBe(50);
  });

  it("counts only audits from the current month towards the plan's audit limit", async () => {
    const userId = newUser();
    await createAuditJob({ owner: `user:${userId}`, url: "https://93.184.216.34/", formFactor: "mobile" });
    const now = new Date();
    expect(dashboardTotals(userId, now).auditsThisPeriod).toBe(1);
    // The same audit is not in a later month.
    const later = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1));
    expect(dashboardTotals(userId, later).auditsThisPeriod).toBe(0);
  });

  it("does not count website sessions as audits", () => {
    const userId = newUser();
    session(userId, `${userId}-1`, new Date().toISOString());
    expect(dashboardTotals(userId).auditsThisPeriod).toBe(0);
  });
});
