import { NextResponse } from "next/server";
import { rateLimited, readJsonBody, stringField } from "@/lib/auth/http";
import { createAuditJob, startAuditJob } from "@/lib/audit/jobs";
import { auditOwner } from "@/lib/audit/owner";
import { AuditFailure } from "@/lib/audit/runner";
import type { FormFactor } from "@/lib/audit/summary";

const HOUR_MS = 60 * 60 * 1000;
/** Signed-in users get more audits per hour than anonymous visitors. */
const HOURLY_LIMIT = { signedIn: 20, anonymous: 5 };

const STATUS_BY_CODE: Record<AuditFailure["code"], number> = {
  invalid_url: 400,
  unsafe_target: 400,
  concurrency_limit: 429,
  audit_failed: 500,
};

export async function POST(request: Request) {
  const { owner, signedIn } = await auditOwner(request);

  const limited = rateLimited(`audits:${owner}`, signedIn ? HOURLY_LIMIT.signedIn : HOURLY_LIMIT.anonymous, HOUR_MS);
  if (limited) return limited;

  const body = await readJsonBody(request);
  const formFactor: FormFactor = body.formFactor === "desktop" ? "desktop" : "mobile";
  try {
    const job = await createAuditJob({ owner, url: stringField(body, "url"), formFactor });
    startAuditJob(job);
    return NextResponse.json({ job }, { status: 202 });
  } catch (error) {
    if (error instanceof AuditFailure) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: STATUS_BY_CODE[error.code] });
    }
    throw error;
  }
}
