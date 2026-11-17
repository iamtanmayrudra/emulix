import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/auth/http";
import { aiErrorResponse, aiJson, gateAi } from "@/lib/ai/route";
import { draftBug } from "@/lib/ai/service";

/**
 * Drafts a bug report from a capture the tester holds in the browser: a title, a severity and a description. The
 * capture is sent in the request because the server keeps no copy of it (docs/AI_FEATURES.md, section 3.4).
 */
export async function POST(request: Request) {
  const gate = await gateAi("POST /api/ai/bug-draft");
  if (gate instanceof NextResponse) return gate;

  try {
    return aiJson(await draftBug(gate.userId, gate.plan, await readJsonBody(request)));
  } catch (error) {
    return aiErrorResponse(error);
  }
}
