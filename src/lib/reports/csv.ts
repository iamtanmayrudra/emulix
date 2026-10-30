import type { ReportEntry } from "./index";

const COLUMNS = [
  "Report ID",
  "Type",
  "Target",
  "Device",
  "Status",
  "Started (UTC)",
  "Duration (seconds)",
  "Overall score",
  "Performance",
  "Accessibility",
  "Best practices",
  "SEO",
  "Findings",
];

/**
 * One CSV cell. Quotes are doubled. A cell that starts with =, +, - or @ would be run as a formula by a spreadsheet,
 * and the target address comes from the user, so those cells get a leading apostrophe.
 */
export function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function reportsToCsv(entries: ReportEntry[]): string {
  const rows = entries.map((entry) => {
    const score = (id: string) => entry.audit?.scores.find((item) => item.id === id)?.value ?? "";
    return [
      entry.id,
      entry.kind,
      entry.target,
      entry.device,
      entry.status,
      entry.startedAt,
      entry.durationMs === null ? "" : Math.round(entry.durationMs / 1000),
      entry.audit?.overall ?? "",
      score("performance"),
      score("accessibility"),
      score("best-practices"),
      score("seo"),
      entry.audit?.findings.length ?? "",
    ].map(csvCell);
  });
  return [COLUMNS.map(csvCell), ...rows].map((row) => row.join(",")).join("\r\n") + "\r\n";
}
