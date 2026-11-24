import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/runtime";
import { getLatestAndroidFrame } from "@/lib/android/sessions";

type Props = { params: Promise<{ id: string }> };

/** The newest picture of the phone's screen, if it is newer than ?after. 204 when nothing changed, 404 once the session ends. */
export async function GET(request: Request, { params }: Props) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized", message: "Sign in to view this session." }, { status: 401 });

  const { id } = await params;
  const after = Number(new URL(request.url).searchParams.get("after") ?? "0");
  const latest = getLatestAndroidFrame(user.id, id, Number.isFinite(after) ? after : 0);
  if (latest === "gone") {
    return NextResponse.json({ error: "not_found", message: "That Android session has ended." }, { status: 404 });
  }
  if (!latest.frame) return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });

  return new NextResponse(new Uint8Array(latest.frame.data), {
    headers: { "Cache-Control": "no-store", "Content-Type": latest.frame.contentType, "X-Frame-Seq": String(latest.frame.seq) },
  });
}
