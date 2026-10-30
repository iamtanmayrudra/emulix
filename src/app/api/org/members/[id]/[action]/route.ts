import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/auth/http";
import { orgCaller } from "@/lib/org/api";
import { getOrgService, orgErrorResponse } from "@/lib/org/runtime";
import { OrgFailure } from "@/lib/org/service";

type Context = { params: Promise<{ id: string; action: string }> };

/** The account actions a super admin has on one member. Each one is checked and logged in the service. */
async function run(request: Request, { params }: Context, forcedAction?: string) {
  const { user, response } = await orgCaller();
  if (response) return response;
  try {
    const { id, action: routeAction } = await params;
    const action = forcedAction ?? routeAction;
    const body = await readJsonBody(request);
    const org = getOrgService();
    switch (action) {
      case "seat":
        await org.setSeat(user, id, body.seated === true);
        break;
      case "deactivate":
        await org.deactivate(user, id);
        break;
      case "reactivate":
        await org.reactivate(user, id);
        break;
      case "reset-password":
        await org.sendReset(user, id);
        break;
      case "unlock":
        await org.unlock(user, id);
        break;
      case "sign-out":
        await org.signOutEverywhere(user, id, body.password);
        break;
      case "role":
        if (body.role !== "super_admin" && body.role !== "member") throw new OrgFailure("invalid_input", "Choose a role.");
        await org.setRole(user, id, body.role, body.password);
        break;
      default:
        throw new OrgFailure("not_found", "That action does not exist.");
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return orgErrorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  return run(request, context);
}

/** PATCH /api/org/members/:id/seat gives or takes a seat. */
export async function PATCH(request: Request, context: Context) {
  return run(request, context, "seat");
}
