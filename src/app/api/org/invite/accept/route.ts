import { NextResponse } from "next/server";
import { clientIp } from "@/lib/auth/runtime";
import { rateLimited, readJsonBody, stringField } from "@/lib/auth/http";
import { getOrgService, orgErrorResponse } from "@/lib/org/runtime";

/** The invited person chooses a password and joins. They start without a seat. */
export async function POST(request: Request) {
  const limited = rateLimited(`invite:${clientIp(request)}`, 10, 15 * 60 * 1000);
  if (limited) return limited;
  try {
    const body = await readJsonBody(request);
    await getOrgService().acceptInvite(stringField(body, "token"), stringField(body, "password"));
    return NextResponse.json({ ok: true, message: "Your account is ready." });
  } catch (error) {
    return orgErrorResponse(error);
  }
}
