import type { Plan } from "@/lib/mock-data";
import { cacheGet, cacheKey, cacheSet } from "./cache";
import { parseBugEvidence, parseExplainTarget } from "./evidence";
import { PROMPT_VERSION, buildBugDraftRequest, buildExplainRequest, readBugDraft, readExplanation } from "./prompts";
import { getAiProvider } from "./provider";
import { getAiUsage, withCredit } from "./quota";
import type { BugDraft, BugDraftResponse, ExplainResponse, IssueExplanation } from "./types";

/**
 * The AI features. Each one validates and redacts its input, serves a repeat from the cache for free, and otherwise spends
 * one credit on a model call. The credit is refunded when the call fails. Plan and sign-in are checked before these run.
 */

/** `body` is the request JSON: `{ capture, fresh? }`. `fresh` skips the cache, so a regenerate gives a new answer. */
export async function draftBug(userId: string, plan: Plan, body: Record<string, unknown>): Promise<BugDraftResponse> {
  const evidence = parseBugEvidence(body.capture);
  const key = cacheKey(userId, "bug-draft", PROMPT_VERSION, evidence);
  if (body.fresh !== true) {
    const hit = cacheGet<BugDraft>(key);
    if (hit) return { draft: hit, usage: getAiUsage(userId, plan), cached: true };
  }

  // A missing API key is reported before a credit is taken.
  const provider = getAiProvider();
  const request = buildBugDraftRequest(evidence);
  const { result, usage } = await withCredit(userId, plan, async () => readBugDraft(await provider.complete(request)));
  cacheSet(key, result);
  return { draft: result, usage, cached: false };
}

/** `body` is the request JSON: `{ target, fresh? }`. */
export async function explainIssue(userId: string, plan: Plan, body: Record<string, unknown>): Promise<ExplainResponse> {
  const target = parseExplainTarget(body.target);
  const key = cacheKey(userId, "explain", PROMPT_VERSION, target);
  if (body.fresh !== true) {
    const hit = cacheGet<IssueExplanation>(key);
    if (hit) return { explanation: hit, usage: getAiUsage(userId, plan), cached: true };
  }

  const provider = getAiProvider();
  const request = buildExplainRequest(target);
  const { result, usage } = await withCredit(userId, plan, async () => readExplanation(await provider.complete(request)));
  cacheSet(key, result);
  return { explanation: result, usage, cached: false };
}
