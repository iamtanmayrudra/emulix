import { NextResponse } from "next/server";
import { readJsonBody, stringField } from "@/lib/auth/http";
import { orgCaller } from "@/lib/org/api";
import { getOrgService, orgErrorResponse } from "@/lib/org/runtime";

/** Moves a seat from one member to another in one step. */
export async function POST(request: Request) {
  const { user, response } = await orgCaller();
  if (response) return response;
  try {
    const body = await readJsonBody(request);
    await getOrgService().swapSeat(user, stringField(body, "fromId"), stringField(body, "toId"));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return orgErrorResponse(error);
  }
}
