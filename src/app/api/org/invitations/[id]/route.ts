import { NextResponse } from "next/server";
import { orgCaller } from "@/lib/org/api";
import { getOrgService, orgErrorResponse } from "@/lib/org/runtime";

/** Cancels a pending invitation. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await orgCaller();
  if (response) return response;
  try {
    const { id } = await params;
    await getOrgService().cancelInvitation(user, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return orgErrorResponse(error);
  }
}
