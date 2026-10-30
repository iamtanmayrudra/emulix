import { NextResponse } from "next/server";
import { orgCaller } from "@/lib/org/api";
import { getOrgService, orgErrorResponse } from "@/lib/org/runtime";

/** The organization's account activity log. Super admins only. */
export async function GET() {
  const { user, response } = await orgCaller();
  if (response) return response;
  try {
    return NextResponse.json({ entries: await getOrgService().listActivity(user) });
  } catch (error) {
    return orgErrorResponse(error);
  }
}
