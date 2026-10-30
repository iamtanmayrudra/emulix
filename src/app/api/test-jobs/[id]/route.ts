import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/runtime";
import { platformGate } from "@/lib/org/runtime";
import { getUserJob, toPublicJob } from "@/lib/testing/jobs";

type Props = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Props) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in to view tests." }, { status: 401 });
  }

  const blocked = await platformGate(user, "GET /api/test-jobs/:id");
  if (blocked) return blocked;

  const { id } = await params;
  const job = getUserJob(user.id, id);
  if (!job) {
    return NextResponse.json({ error: "not_found", message: "That test was not found." }, { status: 404 });
  }
  return NextResponse.json({ job: toPublicJob(job) });
}
