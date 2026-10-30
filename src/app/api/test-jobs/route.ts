import { NextResponse } from "next/server";
import { errorResponse, rateLimited, readJsonBody, stringField } from "@/lib/auth/http";
import { getCurrentUser } from "@/lib/auth/runtime";
import { effectiveSubscription, platformGate } from "@/lib/org/runtime";
import { JobFailure, createTestJob, planForUser, startTestJob, toPublicJob, userJobs } from "@/lib/testing/jobs";

const STATUS_BY_CODE: Record<JobFailure["code"], number> = {
  invalid_url: 400,
  unknown_profile: 400,
  plan_required: 403,
  concurrency_limit: 429,
  unsafe_target: 400,
};

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, response: NextResponse.json({ error: "unauthorized", message: "Sign in to run tests." }, { status: 401 }) };
  }
  const blocked = await platformGate(user, "/api/test-jobs");
  if (blocked) return { user: null, response: blocked };
  return { user, response: null };
}

export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;
  return NextResponse.json({ jobs: userJobs(user!.id).slice(0, 20).map(toPublicJob) });
}

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  const limited = rateLimited(`test-jobs:${user!.id}`, 20, 60 * 60 * 1000);
  if (limited) return limited;

  try {
    const body = await readJsonBody(request);
    const job = await createTestJob({
      userId: user!.id,
      url: stringField(body, "url"),
      profileId: stringField(body, "profileId"),
      landscape: body.landscape === true,
      plan: planForUser(effectiveSubscription(user!)),
    });
    startTestJob(job);
    return NextResponse.json({ job: toPublicJob(job) }, { status: 202 });
  } catch (error) {
    if (error instanceof JobFailure) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: STATUS_BY_CODE[error.code] },
      );
    }
    return errorResponse(error);
  }
}
