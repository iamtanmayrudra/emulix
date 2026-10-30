import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/auth/http";
import { orgCaller } from "@/lib/org/api";
import { getOrgService, orgErrorResponse } from "@/lib/org/runtime";

type Context = { params: Promise<{ id: string }> };

/** Fixes a member's name or email address. */
export async function PATCH(request: Request, { params }: Context) {
  const { user, response } = await orgCaller();
  if (response) return response;
  try {
    const { id } = await params;
    const body = await readJsonBody(request);
    await getOrgService().updateMember(user, id, { name: body.name, email: body.email });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return orgErrorResponse(error);
  }
}

/** Removes a member from the organization. Needs the super admin's password. */
export async function DELETE(request: Request, { params }: Context) {
  const { user, response } = await orgCaller();
  if (response) return response;
  try {
    const { id } = await params;
    const body = await readJsonBody(request);
    await getOrgService().remove(user, id, body.password);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return orgErrorResponse(error);
  }
}
