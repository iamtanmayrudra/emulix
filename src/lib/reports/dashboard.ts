import type { JobStatus, TestJob } from "@/lib/mock-data";
import { listReports, type ReportEntry } from "./index";

/**
 * What the dashboard shows about the signed-in user's own work. It reads the same record as the Reports page, so the two
 * always agree. The example rows that the Reports page shows to someone with no history are never used here: a new account
 * sees an empty dashboard, not made-up jobs.
 */

/** The same format as the Reports page, so a job reads the same in both places. */
function formatWhen(iso: string): string {
  return `${iso.slice(0, 16).replace("T", " ")} UTC`;
}

function ownEntries(userId: string): ReportEntry[] {
  return listReports(userId).filter((entry) => !entry.sample);
}

/** The newest jobs, as the dashboard's timeline draws them. */
export function recentJobs(userId: string, limit = 4): TestJob[] {
  return ownEntries(userId)
    .slice(0, limit)
    .map((entry) => ({
      id: entry.id,
      type: entry.kind,
      target: entry.target,
      profile: entry.device,
      status: entry.status satisfies JobStatus,
      startedAt: formatWhen(entry.startedAt),
    }));
}

export type DashboardTotals = {
  /** Every job the user has run: website tests, live sessions and audits. */
  total: number;
  completed: number;
  /** Whole percent of jobs that completed. Zero when there are none. */
  successRate: number;
  /** Audits started in the current calendar month (UTC), which is the period the plan limits count. */
  auditsThisPeriod: number;
  /** APK tests started in the current calendar month (UTC). */
  apkUploadsThisPeriod: number;
};

export function dashboardTotals(userId: string, now: Date = new Date()): DashboardTotals {
  const entries = ownEntries(userId);
  const completed = entries.filter((entry) => entry.status === "completed").length;
  const month = now.toISOString().slice(0, 7);
  return {
    total: entries.length,
    completed,
    successRate: entries.length > 0 ? Math.round((completed / entries.length) * 100) : 0,
    auditsThisPeriod: entries.filter((entry) => entry.kind === "audit" && entry.startedAt.slice(0, 7) === month).length,
    // A test that could not start (the app would not install, or the server had no room) does not use up a test.
    apkUploadsThisPeriod: entries.filter((entry) => entry.kind === "apk" && entry.status !== "failed" && entry.startedAt.slice(0, 7) === month).length,
  };
}
