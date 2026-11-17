/** Types shared by the AI routes and the components that call them. Nothing here imports server code. */

export type BugSeverity = "low" | "medium" | "high" | "critical";

/** A drafted bug report. The tester reviews and edits it before saving. */
export type BugDraft = {
  title: string;
  severity: BugSeverity;
  /** Markdown. */
  description: string;
};

/** A plain-language reading of one console message or network request. */
export type IssueExplanation = {
  summary: string;
  likelyCause: string;
  fix: string;
};

/** What to explain. Console entries and requests come from the DevTools panel. */
export type ExplainTarget =
  | { kind: "console"; type: string; text: string }
  | { kind: "network"; method: string; url: string; resourceType: string; status: number | null; failure: string | null };

export type AiUsage = { used: number; limit: number };

export type BugDraftResponse = { draft: BugDraft; usage: AiUsage; cached: boolean };
export type ExplainResponse = { explanation: IssueExplanation; usage: AiUsage; cached: boolean };

/** Error body shared by every AI route. `upgradeUrl` is set only when upgrading would help. */
export type AiErrorBody = { error: string; message: string; upgradeUrl?: string };
