import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/auth/http";
import { orgCaller } from "@/lib/org/api";
import { getOrgService, orgErrorResponse } from "@/lib/org/runtime";

/** Invites someone to the organization. The person chooses their own password from the emailed link. */
export async function POST(request: Request) {
  const { user, response } = await orgCaller();
  if (response) return response;
  try {
    const body = await readJsonBody(request);
    await getOrgService().invite(user, { name: body.name, email: body.email, role: body.role, password: body.password });
    return NextResponse.json({ ok: true, message: "Invitation sent." });
  } catch (error) {
    return orgErrorResponse(error);
  }
}
