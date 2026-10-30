import { NextResponse } from "next/server";
import { orgCaller } from "@/lib/org/api";
import { getOrgService, orgErrorResponse } from "@/lib/org/runtime";

/** The organization's members and pending invitations. Super admins only. */
export async function GET() {
  const { user, response } = await orgCaller();
  if (response) return response;
  try {
    return NextResponse.json(await getOrgService().listMembers(user));
  } catch (error) {
    return orgErrorResponse(error);
  }
}
