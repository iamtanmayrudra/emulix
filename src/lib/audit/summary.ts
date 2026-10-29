import { solutionFor, type Solution } from "./solutions";

export type FormFactor = "mobile" | "desktop";
export type Tone = "good" | "fair" | "poor";
export type Priority = "High" | "Medium" | "Low";

export type Finding = {
  /** The Lighthouse audit id, for example "color-contrast". */
  id: string;
  priority: Priority;
  title: string;
  detail: string;
  /** The category the audit belongs to, when the report says. */
  category: string | null;
  /** What Lighthouse measured, for example "Potential savings of 120 KiB". */
  impact: string | null;
  /** The first few elements or files that failed, as text. */
  evidence: string[];
  /** The Lighthouse guide for this audit. Always an https link. */
  docsUrl: string | null;
  solution: Solution;
};

export type AuditResult = {
  requestedUrl: string;
  finalUrl: string;
  formFactor: FormFactor;
  fetchedAt: string;
  scores: { id: string; label: string; value: number }[];
  vitals: { id: string; label: string; value: string; tone: Tone }[];
  findings: Finding[];
};

/** The subset of a Lighthouse result (LHR) that the summary reads. */
export type LighthouseReport = {
  finalDisplayedUrl?: string;
  finalUrl?: string;
  categories: Record<string, { id: string; title: string; score: number | null; auditRefs?: { id: string }[] }>;
  audits: Record<
    string,
    {
      id: string;
      title: string;
      description: string;
      score: number | null;
      scoreDisplayMode: string;
      displayValue?: string;
      details?: { items?: unknown[] };
    }
  >;
  categoryGroups?: unknown;
};

const CATEGORY_LABELS: Record<string, string> = {
  performance: "Performance",
  accessibility: "Accessibility",
  "best-practices": "Best practices",
  seo: "SEO",
};

const VITAL_AUDITS = [
  { id: "lcp", audit: "largest-contentful-paint", label: "LCP" },
  { id: "cls", audit: "cumulative-layout-shift", label: "CLS" },
  { id: "tbt", audit: "total-blocking-time", label: "TBT" },
] as const;

/** Lighthouse audits are scored 0 to 1. Below 0.5 is poor, below 0.9 needs work. */
function toneFor(score: number): Tone {
  if (score >= 0.9) return "good";
  if (score >= 0.5) return "fair";
  return "poor";
}

/** Lighthouse descriptions use markdown links. Keep the link text only, and drop the "Learn more" sentence. */
function plainText(description: string): string {
  return description
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s*Learn more about[^.]*\.?$/, "")
    .trim();
}

/** The first https link in a Lighthouse description. Lighthouse writes its guides as markdown links. */
function docsLink(description: string): string | null {
  const match = description.match(/\]\((https:\/\/[^)\s]+)\)/);
  if (!match) return null;
  try {
    const url = new URL(match[1]);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

const MAX_EVIDENCE = 3;
const MAX_EVIDENCE_LENGTH = 140;

/** One failing element or file from an audit's details, as a short line of text. */
function describeItem(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null) return null;
  const item = raw as Record<string, unknown>;
  const node = typeof item.node === "object" && item.node !== null ? (item.node as Record<string, unknown>) : {};
  const source = typeof item.source === "object" && item.source !== null ? (item.source as Record<string, unknown>) : {};
  // Link audits report the link's text and address, for example "click here" pointing at /pricing.
  const linkText = typeof item.text === "string" ? item.text.replace(/\s+/g, " ").trim() : "";
  const linkHref = typeof item.href === "string" ? item.href.trim() : "";
  const link = linkHref ? (linkText ? `"${linkText}" → ${linkHref}` : linkHref) : undefined;
  const text = [node.snippet, node.selector, item.url, source.url, link, item.label, item.groupLabel, item.name].find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
  if (!text) return null;
  let line = text.replace(/\s+/g, " ").trim();
  if (line.length > MAX_EVIDENCE_LENGTH) line = `${line.slice(0, MAX_EVIDENCE_LENGTH - 1)}…`;
  if (typeof item.wastedBytes === "number" && item.wastedBytes >= 1024) line += ` · about ${Math.round(item.wastedBytes / 1024)} KiB`;
  else if (typeof item.wastedMs === "number" && item.wastedMs >= 1) line += ` · about ${Math.round(item.wastedMs)} ms`;
  return line;
}

function evidenceFor(items: unknown[] | undefined): string[] {
  const lines: string[] = [];
  for (const raw of items ?? []) {
    if (lines.length >= MAX_EVIDENCE) break;
    const line = describeItem(raw);
    if (line && !lines.includes(line)) lines.push(line);
  }
  return lines;
}

export function summarizeReport(
  report: LighthouseReport,
  input: { requestedUrl: string; formFactor: FormFactor; fetchedAt: Date },
): AuditResult {
  const scores = Object.keys(CATEGORY_LABELS).flatMap((id) => {
    const category = report.categories[id];
    if (!category || category.score === null) return [];
    return [{ id, label: CATEGORY_LABELS[id], value: Math.round(category.score * 100) }];
  });

  const vitals = VITAL_AUDITS.flatMap(({ id, audit, label }) => {
    const entry = report.audits[audit];
    if (!entry || entry.score === null) return [];
    return [{ id, label, value: entry.displayValue ?? "n/a", tone: toneFor(entry.score) }];
  });

  // Failing audits from the scored categories, worst first. Informational audits have no score to fail.
  const findings = Object.values(report.audits)
    .filter((audit) => audit.score !== null && audit.score < 0.9 && audit.scoreDisplayMode !== "informative" && audit.scoreDisplayMode !== "manual")
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
    .slice(0, 8)
    .map((audit) => {
      const score = audit.score ?? 0;
      const priority: Priority = score < 0.5 ? "High" : score < 0.9 ? "Medium" : "Low";
      const category = Object.keys(CATEGORY_LABELS).find((id) => report.categories[id]?.auditRefs?.some((ref) => ref.id === audit.id)) ?? null;
      return {
        id: audit.id,
        priority,
        title: audit.title,
        detail: plainText(audit.description),
        category,
        impact: audit.displayValue?.trim() || null,
        evidence: evidenceFor(audit.details?.items),
        docsUrl: docsLink(audit.description),
        solution: solutionFor(audit.id, category),
      };
    });

  return {
    requestedUrl: input.requestedUrl,
    finalUrl: report.finalDisplayedUrl ?? report.finalUrl ?? input.requestedUrl,
    formFactor: input.formFactor,
    fetchedAt: input.fetchedAt.toISOString(),
    scores,
    vitals,
    findings,
  };
}
