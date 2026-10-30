import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { planForStatus } from "@/lib/entitlements";
import { DEVICE_PROFILES, type DeviceProfile, type Plan, type SubscriptionStatus } from "@/lib/mock-data";
import { JOB_TIMEOUT_MS, runWebsiteTest, screenshotDirectory, type RunResult } from "./runner";
import { parseTargetUrl, resolvesToPublicAddress } from "./url-guard";

export type TestJobStatus = "queued" | "running" | "completed" | "failed" | "timed_out";

export type TestJob = {
  id: string;
  userId: string;
  url: string;
  profileId: string;
  profileName: string;
  landscape: boolean;
  status: TestJobStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  result: RunResult | null;
  error: string | null;
};

/** Public view: never exposes server file paths. */
export type PublicTestJob = Omit<TestJob, "userId" | "result"> & {
  result: (Omit<RunResult, "screenshotPath"> & { hasScreenshot: boolean }) | null;
};

/** Maximum unfinished runs per user. Pro allows more, within fair use. */
export const MAX_ACTIVE_JOBS: Record<Plan, number> = { free: 1, pro: 5 };
const MAX_JOBS_KEPT_PER_USER = 50;

const globalForJobs = globalThis as typeof globalThis & { __emulixTestJobs?: Map<string, TestJob> };

function jobs(): Map<string, TestJob> {
  globalForJobs.__emulixTestJobs ??= new Map();
  return globalForJobs.__emulixTestJobs;
}

/**
 * Plan for a user's stored subscription. Missing means free. Billing (Phase 4) will fill the subscription in.
 */
export function planForUser(subscription?: SubscriptionStatus): Plan {
  return planForStatus(subscription ?? "free");
}

export class JobFailure extends Error {
  constructor(
    readonly code: "invalid_url" | "unknown_profile" | "plan_required" | "concurrency_limit" | "unsafe_target",
    message: string,
  ) {
    super(message);
  }
}

export function toPublicJob(job: TestJob): PublicTestJob {
  const { userId: _userId, result, ...rest } = job;
  void _userId;
  return {
    ...rest,
    result: result
      ? (() => {
          const { screenshotPath: _path, ...publicResult } = result;
          void _path;
          return { ...publicResult, hasScreenshot: true };
        })()
      : null,
  };
}

export async function createTestJob(input: {
  userId: string;
  url: string;
  profileId: string;
  landscape: boolean;
  plan?: Plan;
}): Promise<TestJob> {
  const plan = input.plan ?? planForUser();

  const parsed = parseTargetUrl(input.url);
  if (!parsed.ok) throw new JobFailure("invalid_url", parsed.reason);

  const profile: DeviceProfile | undefined = DEVICE_PROFILES.find((p) => p.id === input.profileId);
  if (!profile) throw new JobFailure("unknown_profile", "Choose a device profile from the list.");
  if (profile.minPlan === "pro" && plan !== "pro") {
    throw new JobFailure("plan_required", `${profile.name} is available on Pro.`);
  }

  const active = userJobs(input.userId).filter((job) => job.status === "queued" || job.status === "running");
  if (active.length >= MAX_ACTIVE_JOBS[plan]) {
    throw new JobFailure(
      "concurrency_limit",
      `You can run ${MAX_ACTIVE_JOBS[plan]} test at a time on your plan. Wait for the current run to finish.`,
    );
  }

  if (!(await resolvesToPublicAddress(parsed.url.hostname))) {
    throw new JobFailure("unsafe_target", "That address does not resolve to a public server.");
  }

  const job: TestJob = {
    id: randomUUID(),
    userId: input.userId,
    url: parsed.url.toString(),
    profileId: profile.id,
    profileName: profile.name,
    landscape: input.landscape,
    status: "queued",
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    result: null,
    error: null,
  };
  jobs().set(job.id, job);
  pruneOldJobs(input.userId);
  return job;
}

/** Runs the job in the background. Updates status when finished. Never throws. */
export function startTestJob(job: TestJob): void {
  const profile = DEVICE_PROFILES.find((p) => p.id === job.profileId);
  if (!profile) return;

  job.status = "running";
  job.startedAt = new Date().toISOString();

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("timed_out")), JOB_TIMEOUT_MS).unref();
  });

  Promise.race([
    runWebsiteTest({
      jobId: job.id,
      url: job.url,
      profile,
      landscape: job.landscape,
      screenshotDir: screenshotDirectory(),
    }),
    timeout,
  ])
    .then((result) => {
      job.result = result;
      job.status = "completed";
    })
    .catch((error: unknown) => {
      const timedOut = error instanceof Error && error.message === "timed_out";
      job.status = timedOut ? "timed_out" : "failed";
      job.error = timedOut
        ? "The page took too long to finish. Try again, or test a faster page."
        : error instanceof Error
          ? error.message
          : "The test could not run.";
    })
    .finally(() => {
      job.finishedAt = new Date().toISOString();
    });
}

export function userJobs(userId: string): TestJob[] {
  return [...jobs().values()]
    .filter((job) => job.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getUserJob(userId: string, jobId: string): TestJob | null {
  const job = jobs().get(jobId);
  return job && job.userId === userId ? job : null;
}

/** Removes a finished run, and its screenshot, from the user's history. A running test stays until it ends. */
export function deleteUserJob(userId: string, jobId: string): boolean {
  const job = getUserJob(userId, jobId);
  if (!job || job.status === "queued" || job.status === "running") return false;
  jobs().delete(jobId);
  if (job.result) void unlink(job.result.screenshotPath).catch(() => undefined);
  return true;
}

/** Drops the oldest finished runs (and their screenshots) beyond the per-user limit. */
function pruneOldJobs(userId: string) {
  const list = userJobs(userId);
  for (const old of list.slice(MAX_JOBS_KEPT_PER_USER)) {
    if (old.status === "queued" || old.status === "running") continue;
    jobs().delete(old.id);
    if (old.result) void unlink(old.result.screenshotPath).catch(() => undefined);
  }
}
