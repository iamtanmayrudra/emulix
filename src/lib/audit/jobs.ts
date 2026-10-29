import { randomUUID } from "node:crypto";
import { parseTargetUrl, resolvesToPublicAddress } from "@/lib/testing/url-guard";
import { AuditFailure, runLighthouseAudit } from "./runner";
import type { AuditResult, FormFactor } from "./summary";

export type AuditJobStatus = "queued" | "running" | "completed" | "failed" | "timed_out";

export type AuditJob = {
  id: string;
  /** Who started the audit: "user:<id>" when signed in, or "anon:<ip>" without an account. */
  owner: string;
  url: string;
  formFactor: FormFactor;
  status: AuditJobStatus;
  createdAt: string;
  finishedAt: string | null;
  result: AuditResult | null;
  error: string | null;
};

/** Lighthouse usually finishes in under a minute. Longer runs are stopped and reported as timed out. */
export const AUDIT_TIMEOUT_MS = 3 * 60_000;
/** One audit at a time per caller, so the browser is not run in parallel. */
const MAX_ACTIVE_PER_OWNER = 1;
/** Across all callers, so a crowd of anonymous visitors cannot exhaust the server. */
const MAX_ACTIVE_TOTAL = 2;

const globalForAudits = globalThis as typeof globalThis & { __emulixAuditJobs?: Map<string, AuditJob> };

function jobs(): Map<string, AuditJob> {
  globalForAudits.__emulixAuditJobs ??= new Map();
  return globalForAudits.__emulixAuditJobs;
}

export async function createAuditJob(input: { owner: string; url: string; formFactor: FormFactor }): Promise<AuditJob> {
  const parsed = parseTargetUrl(input.url);
  if (!parsed.ok) throw new AuditFailure("invalid_url", parsed.reason);
  if (!(await resolvesToPublicAddress(parsed.url.hostname))) {
    throw new AuditFailure("unsafe_target", "That address does not resolve to a public server.");
  }

  const active = [...jobs().values()].filter((job) => job.status === "queued" || job.status === "running");
  const ownActive = active.filter((job) => job.owner === input.owner);
  if (ownActive.length >= MAX_ACTIVE_PER_OWNER) {
    throw new AuditFailure("concurrency_limit", "An audit is already running. Wait for it to finish.");
  }
  if (active.length >= MAX_ACTIVE_TOTAL) {
    throw new AuditFailure("concurrency_limit", "The audit service is busy. Try again in a minute.");
  }

  const job: AuditJob = {
    id: randomUUID(),
    owner: input.owner,
    url: parsed.url.toString(),
    formFactor: input.formFactor,
    status: "queued",
    createdAt: new Date().toISOString(),
    finishedAt: null,
    result: null,
    error: null,
  };
  jobs().set(job.id, job);
  return job;
}

/** Runs the audit in the background and records the outcome on the job. Never throws. */
export function startAuditJob(job: AuditJob): void {
  job.status = "running";

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("timed_out")), AUDIT_TIMEOUT_MS).unref();
  });

  Promise.race([runLighthouseAudit({ url: job.url, formFactor: job.formFactor }), timeout])
    .then((result) => {
      job.result = result;
      job.status = "completed";
    })
    .catch((error: unknown) => {
      if (error instanceof Error && error.message === "timed_out") {
        job.status = "timed_out";
        job.error = "The audit took too long. Try again, or test a faster page.";
      } else {
        job.status = "failed";
        job.error = error instanceof AuditFailure ? error.message : "The audit could not finish.";
      }
    })
    .finally(() => {
      job.finishedAt = new Date().toISOString();
    });
}

export function getOwnedAuditJob(owner: string, id: string): AuditJob | null {
  const job = jobs().get(id);
  return job && job.owner === owner ? job : null;
}
