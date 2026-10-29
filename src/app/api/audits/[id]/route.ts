import { NextResponse } from "next/server";
import { getOwnedAuditJob } from "@/lib/audit/jobs";
import { auditOwner } from "@/lib/audit/owner";

type Props = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Props) {
  const { owner } = await auditOwner(request);
  const { id } = await params;
  const job = getOwnedAuditJob(owner, id);
  if (!job) {
    return NextResponse.json({ error: "not_found", message: "That audit was not found." }, { status: 404 });
  }
  return NextResponse.json({ job });
}
