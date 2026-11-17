import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/auth/http";
import { aiErrorResponse, aiJson, gateAi } from "@/lib/ai/route";
import { explainIssue } from "@/lib/ai/service";

/** Explains one console message or network request from the DevTools panel in plain language. */
export async function POST(request: Request) {
  const gate = await gateAi("POST /api/ai/explain");
  if (gate instanceof NextResponse) return gate;

  try {
    return aiJson(await explainIssue(gate.userId, gate.plan, await readJsonBody(request)));
  } catch (error) {
    return aiErrorResponse(error);
  }
}
