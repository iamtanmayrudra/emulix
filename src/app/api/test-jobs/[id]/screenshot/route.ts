import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/runtime";
import { getUserJob } from "@/lib/testing/jobs";

type Props = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Props) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in to view screenshots." }, { status: 401 });
  }

  const { id } = await params;
  const job = getUserJob(user.id, id);
  if (!job?.result) {
    return NextResponse.json({ error: "not_found", message: "No screenshot for that test." }, { status: 404 });
  }

  try {
    const image = await readFile(job.result.screenshotPath);
    return new NextResponse(new Uint8Array(image), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "not_found", message: "The screenshot is no longer available." }, { status: 404 });
  }
}
