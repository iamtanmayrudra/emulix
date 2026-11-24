import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/runtime";
import { closeAndroidSession, getAndroidSession } from "@/lib/android/sessions";

type Props = { params: Promise<{ id: string }> };

const NOT_FOUND = { error: "not_found", message: "That Android session was not found." };

/** The session's state, which the page polls while the emulator starts. */
export async function GET(_request: Request, { params }: Props) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized", message: "Sign in to view this session." }, { status: 401 });
  const { id } = await params;
  const session = getAndroidSession(user.id, id);
  if (!session) return NextResponse.json(NOT_FOUND, { status: 404 });
  return NextResponse.json({ session }, { headers: { "Cache-Control": "no-store" } });
}

/** Stops the session and its emulator, at any point, including while the emulator is still starting. */
export async function DELETE(_request: Request, { params }: Props) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized", message: "Sign in to stop this session." }, { status: 401 });
  const { id } = await params;
  if (!(await closeAndroidSession(user.id, id))) return NextResponse.json(NOT_FOUND, { status: 404 });
  return NextResponse.json({ closed: true });
}
