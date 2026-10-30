import { deleteOwnedAuditJob, listOwnedAuditJobs } from "@/lib/audit/jobs";
import { MOCK_JOBS } from "@/lib/mock-data";
import { deleteUserJob, userJobs } from "@/lib/testing/jobs";
import { deleteSession, listSessions } from "./history";

export type ReportKind = "website" | "audit" | "apk";
export type ReportStatus = "running" | "completed" | "failed" | "timed_out" | "rejected";

export type ReportFinding = { priority: "High" | "Medium" | "Low"; title: string; detail: string; summary: string; steps: string[] };

export type ReportEntry = {
  /** "audit:<id>", "live:<id>" or "test:<id>". Sample rows start with "sample:". */
  id: string;
  kind: ReportKind;
  /** True for the example rows shown to someone who has not run anything yet. */
  sample: boolean;
  target: string;
  device: string;
  status: ReportStatus;
  startedAt: string;
  durationMs: number | null;
  finalUrl: string | null;
  title: string | null;
  audit: {
    overall: number;
    scores: { id: string; label: string; value: number }[];
    vitals: { id: string; label: string; value: string; tone: "good" | "fair" | "poor" }[];
    findings: ReportFinding[];
  } | null;
  test: { httpStatus: number | null; loadTimeMs: number; consoleErrors: number; failedRequests: number } | null;
  error: string | null;
};

/** A queued job has not finished yet, so it reads as running. */
function reportStatus(status: "queued" | "running" | "completed" | "failed" | "timed_out"): ReportStatus {
  return status === "queued" ? "running" : status;
}

function duration(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
}

/** Everything the signed-in user has run, newest first. Someone with no history sees clearly marked examples. */
export function listReports(userId: string): ReportEntry[] {
  const entries: ReportEntry[] = [];

  for (const job of listOwnedAuditJobs(`user:${userId}`)) {
    const result = job.result;
    const scores = result?.scores ?? [];
    entries.push({
      id: `audit:${job.id}`,
      kind: "audit",
      sample: false,
      target: job.url,
      device: `${job.formFactor === "mobile" ? "Mobile" : "Desktop"}, Lighthouse`,
      status: reportStatus(job.status),
      startedAt: job.createdAt,
      durationMs: duration(job.createdAt, job.finishedAt),
      finalUrl: result?.finalUrl ?? null,
      title: null,
      audit: result
        ? {
            overall: scores.length ? Math.round(scores.reduce((sum, score) => sum + score.value, 0) / scores.length) : 0,
            scores,
            vitals: result.vitals,
            findings: result.findings.map((finding) => ({
              priority: finding.priority,
              title: finding.title,
              detail: finding.detail,
              summary: finding.solution.summary,
              steps: finding.solution.steps,
            })),
          }
        : null,
      test: null,
      error: job.error,
    });
  }

  for (const job of userJobs(userId)) {
    entries.push({
      id: `test:${job.id}`,
      kind: "website",
      sample: false,
      target: job.url,
      device: job.profileName,
      status: reportStatus(job.status),
      startedAt: job.createdAt,
      durationMs: duration(job.startedAt ?? job.createdAt, job.finishedAt),
      finalUrl: job.result?.finalUrl ?? null,
      title: job.result?.title ?? null,
      audit: null,
      test: job.result
        ? {
            httpStatus: job.result.status,
            loadTimeMs: job.result.loadTimeMs,
            consoleErrors: job.result.consoleErrors.length,
            failedRequests: job.result.failedRequests.length + job.result.httpErrors.length,
          }
        : null,
      error: job.error,
    });
  }

  for (const session of listSessions(userId)) {
    entries.push({
      id: `live:${session.id}`,
      kind: "website",
      sample: false,
      target: session.url,
      device: session.profileName,
      // A session still open is running. One that has ended finished normally.
      status: session.endedAt ? "completed" : "running",
      startedAt: session.startedAt,
      durationMs: duration(session.startedAt, session.endedAt),
      finalUrl: session.finalUrl,
      title: session.title,
      audit: null,
      test: null,
      error: null,
    });
  }

  entries.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return entries.length > 0 ? entries : sampleReports();
}

/** The fixed example rows. They are labelled as samples everywhere they appear. */
export function sampleReports(): ReportEntry[] {
  return MOCK_JOBS.map((job) => ({
    id: `sample:${job.id}`,
    kind: job.type,
    sample: true,
    target: job.target,
    device: job.profile,
    status: job.status === "completed" ? "completed" : job.status === "rejected" ? "rejected" : job.status === "timed_out" ? "timed_out" : "failed",
    startedAt: `${job.startedAt.replace(" ", "T")}:00.000Z`,
    durationMs: null,
    finalUrl: null,
    title: null,
    audit: null,
    test: null,
    error: null,
  }));
}

/** Removes one finished report from the user's history. Returns false when it is not theirs, is running, or does not exist. */
export function removeReport(userId: string, id: string): boolean {
  const [source, ...rest] = id.split(":");
  const key = rest.join(":");
  if (source === "audit") return deleteOwnedAuditJob(`user:${userId}`, key);
  if (source === "test") return deleteUserJob(userId, key);
  if (source === "live") return deleteSession(userId, key);
  return false;
}

/** Clears the user's finished reports. Running ones stay. Returns how many were removed. */
export function clearReports(userId: string): number {
  let removed = 0;
  for (const entry of listReports(userId)) {
    if (!entry.sample && removeReport(userId, entry.id)) removed += 1;
  }
  return removed;
}
