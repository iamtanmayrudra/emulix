import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/runtime";
import { getLatestFrame } from "@/lib/testing/browser-sessions";

type Props = { params: Promise<{ id: string }> };

/**
 * The newest JPEG frame, if it is newer than ?after. Returns 204 when nothing changed and 404 once the session ends.
 */
export async function GET(request: Request, { params }: Props) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in to view this browser." }, { status: 401 });
  }

  const { id } = await params;
  const after = Number(new URL(request.url).searchParams.get("after") ?? "0");
  const frame = getLatestFrame(user.id, id, Number.isFinite(after) ? after : 0);
  if (frame === "gone") {
    return NextResponse.json({ error: "not_found", message: "That browser session has ended." }, { status: 404 });
  }
  const headers = { "Cache-Control": "no-store", "X-Page-Url": encodeURIComponent(frame.pageUrl) };
  if (!frame.frame) return new NextResponse(null, { status: 204, headers });

  return new NextResponse(new Uint8Array(frame.frame.data), {
    headers: { ...headers, "Content-Type": "image/jpeg", "X-Frame-Seq": String(frame.frame.seq) },
  });
}
