import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/runtime";
import { closeBrowserSession, getUserBrowserSession } from "@/lib/testing/browser-sessions";

type Props = { params: Promise<{ id: string }> };

const NOT_FOUND = { error: "not_found", message: "That browser session was not found." };

export async function GET(_request: Request, { params }: Props) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in to view this browser." }, { status: 401 });
  }
  const { id } = await params;
  const session = getUserBrowserSession(user.id, id);
  if (!session) return NextResponse.json(NOT_FOUND, { status: 404 });
  return NextResponse.json({ session });
}

export async function DELETE(_request: Request, { params }: Props) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in to close this browser." }, { status: 401 });
  }
  const { id } = await params;
  const closed = await closeBrowserSession(user.id, id);
  if (!closed) return NextResponse.json(NOT_FOUND, { status: 404 });
  return NextResponse.json({ closed: true });
}
