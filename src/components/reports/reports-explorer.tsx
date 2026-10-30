"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { GaugeIcon, GlobeIcon, PhoneIcon } from "@/components/device-lab/icons";
import { reportsToCsv } from "@/lib/reports/csv";
import type { ReportEntry, ReportKind, ReportStatus } from "@/lib/reports";

type KindFilter = "all" | ReportKind;
type StatusFilter = "all" | "completed" | "running" | "attention";
type SortKey = "startedAt" | "kind" | "target" | "status" | "durationMs";
type Confirm = { title: string; body: string; label: string; run: () => Promise<void> } | null;

const PAGE_SIZE = 10;
const DAY_MS = 24 * 60 * 60 * 1000;
const POLL_MS = 5000;

const KIND_LABEL: Record<ReportKind, string> = { website: "Website test", audit: "Audit", apk: "APK test" };
const KIND_ICON: Record<ReportKind, ReactNode> = {
  website: <GlobeIcon className="h-4 w-4" />,
  audit: <GaugeIcon className="h-4 w-4" />,
  apk: <PhoneIcon className="h-4 w-4" />,
};
const KIND_GRADIENT: Record<ReportKind, string> = {
  website: "from-brand-blue to-brand-violet",
  audit: "from-amber-400 to-rose-500",
  apk: "from-emerald-400 to-teal-600",
};

const STATUS_STYLE: Record<ReportStatus, { label: string; className: string }> = {
  running: { label: "Running", className: "bg-accent/10 text-accent" },
  completed: { label: "Completed", className: "bg-success/10 text-success" },
  failed: { label: "Failed", className: "bg-danger/10 text-danger" },
  timed_out: { label: "Timed out", className: "bg-danger/10 text-danger" },
  rejected: { label: "Rejected", className: "bg-danger/10 text-danger" },
};

const PRIORITY_STYLE = { High: "bg-danger/10 text-danger", Medium: "bg-warning/10 text-warning", Low: "bg-accent/10 text-accent" } as const;
const TONE = { good: "text-success", fair: "text-warning", poor: "text-danger" } as const;

const INPUT =
  "rounded-xl border border-border bg-background px-3 py-2 text-sm transition hover:border-muted/60 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/15";
const BUTTON =
  "rounded-xl border border-border bg-surface px-3.5 py-2 text-sm font-semibold transition hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50";

/** A fixed format keeps the server and browser output identical. */
function formatWhen(iso: string): string {
  return `${iso.slice(0, 16).replace("T", " ")} UTC`;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "None";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes} min ${seconds % 60} s` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

function scoreTone(value: number): keyof typeof TONE {
  return value >= 90 ? "good" : value >= 50 ? "fair" : "poor";
}

function isAttention(status: ReportStatus) {
  return status === "failed" || status === "timed_out" || status === "rejected";
}

function StatusChip({ status }: { status: ReportStatus }) {
  const style = STATUS_STYLE[status];
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${style.className}`}>{style.label}</span>;
}

function KindIcon({ kind, size = "h-8 w-8" }: { kind: ReportKind; size?: string }) {
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow ${size} ${KIND_GRADIENT[kind]}`}>
      {KIND_ICON[kind]}
    </span>
  );
}

function Stat({ label, value, hint, gradient }: { label: string; value: string; hint: string; gradient: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-surface p-4 shadow-sm">
      <span aria-hidden="true" className={`absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br opacity-20 blur-xl ${gradient}`} />
      <p className="relative text-xs font-medium text-muted">{label}</p>
      <p className="relative mt-1 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="relative mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onKeyDown={(event) => event.key === "Escape" && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-2xl">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function download(filename: string, type: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function Detail({ entry, onClose, onRemove }: { entry: ReportEntry; onClose: () => void; onRemove: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // The clipboard can be blocked. The address stays selectable on screen.
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onKeyDown={(event) => event.key === "Escape" && onClose()}>
      <button type="button" aria-label="Close report" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label="Report details" className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-border bg-surface shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start gap-3 border-b border-border bg-surface/95 p-5 backdrop-blur">
          <KindIcon kind={entry.kind} size="h-10 w-10" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">{KIND_LABEL[entry.kind]}{entry.sample && " · Example"}</p>
            <h2 className="break-all text-lg font-semibold leading-snug">{entry.target}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              {entry.device}
              <StatusChip status={entry.status} />
            </p>
          </div>
          <button type="button" autoFocus onClick={onClose} aria-label="Close" className="rounded-lg border border-border px-2.5 py-1 text-lg leading-none text-muted hover:text-foreground">
            ×
          </button>
        </header>

        <div className="space-y-6 p-5">
          {entry.sample && (
            <p role="note" className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
              This is an example row. Run a test or an audit and your own reports, with scores and fixes, appear here.
            </p>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div><dt className="text-xs text-muted">Started</dt><dd className="font-medium">{formatWhen(entry.startedAt)}</dd></div>
            <div><dt className="text-xs text-muted">Duration</dt><dd className="font-medium">{formatDuration(entry.durationMs)}</dd></div>
            <div className="col-span-2"><dt className="text-xs text-muted">Report ID</dt><dd className="break-all font-mono text-xs">{entry.id}</dd></div>
            {entry.finalUrl && entry.finalUrl !== entry.target && (
              <div className="col-span-2"><dt className="text-xs text-muted">Ended on</dt><dd className="break-all font-medium">{entry.finalUrl}</dd></div>
            )}
            {entry.title && <div className="col-span-2"><dt className="text-xs text-muted">Page title</dt><dd className="font-medium">{entry.title}</dd></div>}
          </dl>

          {entry.error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{entry.error}</p>}

          {entry.audit && (
            <>
              <section aria-labelledby="scores-h">
                <h3 id="scores-h" className="text-sm font-semibold uppercase tracking-wider text-muted">Scores</h3>
                <div className="mt-3 flex items-center gap-4 rounded-xl bg-gradient-to-r from-brand-blue/10 to-brand-violet/10 p-4">
                  <p className={`text-4xl font-bold tabular-nums ${TONE[scoreTone(entry.audit.overall)]}`}>{entry.audit.overall}</p>
                  <p className="text-sm text-muted">Overall, the average of the four scores below.</p>
                </div>
                <ul className="mt-3 grid grid-cols-2 gap-3">
                  {entry.audit.scores.map((score) => (
                    <li key={score.id} className="rounded-xl border border-border/70 p-3">
                      <p className="flex items-baseline justify-between text-sm">
                        <span className="font-medium">{score.label}</span>
                        <span className={`font-bold tabular-nums ${TONE[scoreTone(score.value)]}`}>{score.value}</span>
                      </p>
                      <div role="meter" aria-label={`${score.label} score`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={score.value} className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                        <div className={`h-full rounded-full ${score.value >= 90 ? "bg-success" : score.value >= 50 ? "bg-warning" : "bg-danger"}`} style={{ width: `${score.value}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              {entry.audit.vitals.length > 0 && (
                <section aria-labelledby="vitals-h">
                  <h3 id="vitals-h" className="text-sm font-semibold uppercase tracking-wider text-muted">Core Web Vitals</h3>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {entry.audit.vitals.map((vital) => (
                      <li key={vital.id} className="rounded-full border border-border/70 px-3 py-1 text-sm">
                        <span className="text-muted">{vital.label}</span> <span className={`font-semibold ${TONE[vital.tone]}`}>{vital.value}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section aria-labelledby="findings-h">
                <h3 id="findings-h" className="text-sm font-semibold uppercase tracking-wider text-muted">Findings and fixes ({entry.audit.findings.length})</h3>
                {entry.audit.findings.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">No failing checks.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {entry.audit.findings.map((finding) => (
                      <li key={finding.title} className="rounded-xl border border-border/70">
                        <details className="group">
                          <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
                            <span className={`w-16 shrink-0 rounded-full px-2 py-0.5 text-center text-[11px] font-semibold ${PRIORITY_STYLE[finding.priority]}`}>{finding.priority}</span>
                            <span className="min-w-0 flex-1 text-sm font-medium">{finding.title}</span>
                            <span aria-hidden="true" className="text-muted transition group-open:rotate-180">▾</span>
                          </summary>
                          <div className="space-y-2 border-t border-border/70 px-3 py-3 text-sm">
                            {finding.detail && <p className="text-muted">{finding.detail}</p>}
                            <p className="font-semibold text-success">How to fix</p>
                            <p>{finding.summary}</p>
                            <ol className="list-decimal space-y-1 pl-5">
                              {finding.steps.map((step) => <li key={step}>{step}</li>)}
                            </ol>
                          </div>
                        </details>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}

          {entry.test && (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-border/70 p-3"><dt className="text-xs text-muted">HTTP status</dt><dd className="text-lg font-semibold">{entry.test.httpStatus ?? "None"}</dd></div>
              <div className="rounded-xl border border-border/70 p-3"><dt className="text-xs text-muted">Load time</dt><dd className="text-lg font-semibold">{entry.test.loadTimeMs} ms</dd></div>
              <div className="rounded-xl border border-border/70 p-3"><dt className="text-xs text-muted">Console errors</dt><dd className="text-lg font-semibold">{entry.test.consoleErrors}</dd></div>
              <div className="rounded-xl border border-border/70 p-3"><dt className="text-xs text-muted">Failed requests</dt><dd className="text-lg font-semibold">{entry.test.failedRequests}</dd></div>
            </dl>
          )}

          {!entry.audit && !entry.test && !entry.sample && entry.kind === "website" && (
            <p className="rounded-xl bg-background px-4 py-3 text-sm text-muted">
              A live browser session on {entry.device}. {entry.status === "running" ? "It is still open." : "It has ended."}
            </p>
          )}

          <div className="flex flex-wrap gap-3 border-t border-border pt-4">
            <button type="button" onClick={() => void copy(entry.target)} className={BUTTON}>{copied ? "Copied" : "Copy address"}</button>
            {!entry.sample && (
              <Link href={entry.kind === "audit" ? "/optimize" : "/test"} className={BUTTON}>
                {entry.kind === "audit" ? "Run another audit" : "Test again"}
              </Link>
            )}
            {!entry.sample && (
              <button type="button" onClick={onRemove} disabled={entry.status === "running"} title={entry.status === "running" ? "A running report cannot be removed" : undefined} className="rounded-xl border border-danger/40 px-3.5 py-2 text-sm font-semibold text-danger transition hover:bg-danger/10 disabled:opacity-50">
                Remove
              </button>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

type SortState = { key: SortKey; dir: "asc" | "desc" };

function SortHeader({ label, sortKey, sort, onSort, className = "" }: { label: string; sortKey: SortKey; sort: SortState; onSort: (key: SortKey) => void; className?: string }) {
  const active = sort.key === sortKey;
  return (
    <th scope="col" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={`px-4 py-3 font-medium ${className}`}>
      <button type="button" onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1 hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">
        {label}
        <span aria-hidden="true" className={active ? "text-accent" : "opacity-30"}>{active && sort.dir === "asc" ? "▲" : "▼"}</span>
      </button>
    </th>
  );
}

/**
 * The Reports page: summary, search and filters, sortable and paged results, a detail panel for each run, and export.
 * It lists the signed-in user's own audits, website tests and live browser sessions.
 */
export function ReportsExplorer({ initial }: { initial: ReportEntry[] }) {
  const [entries, setEntries] = useState(initial);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  // The cutoff is set when a period is chosen, so the page never reads the clock while rendering.
  const [period, setPeriod] = useState(0);
  const [cutoff, setCutoff] = useState<number | null>(null);
  const [sort, setSort] = useState<SortState>({ key: "startedAt", dir: "desc" });
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const isSample = entries.length > 0 && entries.every((entry) => entry.sample);
  const hasRunning = entries.some((entry) => entry.status === "running");

  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/reports", { cache: "no-store" });
      if (response.ok) setEntries(((await response.json()) as { entries: ReportEntry[] }).entries);
    } catch {
      // The next refresh tries again.
    }
    setRefreshing(false);
  }, []);

  // While something is still running, check again every few seconds.
  useEffect(() => {
    if (!hasRunning) return;
    const timer = setTimeout(() => void reload(), POLL_MS);
    return () => clearTimeout(timer);
  }, [hasRunning, entries, reload]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (kind !== "all" && entry.kind !== kind) return false;
      if (status === "completed" && entry.status !== "completed") return false;
      if (status === "running" && entry.status !== "running") return false;
      if (status === "attention" && !isAttention(entry.status)) return false;
      if (cutoff !== null && new Date(entry.startedAt).getTime() < cutoff) return false;
      if (needle && !`${entry.target} ${entry.device} ${entry.title ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [entries, query, kind, status, cutoff]);

  const sorted = useMemo(() => {
    const direction = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const left = a[sort.key];
      const right = b[sort.key];
      if (left === right) return b.startedAt.localeCompare(a.startedAt);
      if (left === null) return 1;
      if (right === null) return -1;
      return (left < right ? -1 : 1) * direction;
    });
  }, [filtered, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const open = entries.find((entry) => entry.id === openId) ?? null;
  const filtering = query !== "" || kind !== "all" || status !== "all" || cutoff !== null;

  const stats = useMemo(() => {
    const done = entries.filter((entry) => entry.status === "completed").length;
    const audits = entries.filter((entry) => entry.audit);
    const average = audits.length ? Math.round(audits.reduce((sum, entry) => sum + (entry.audit?.overall ?? 0), 0) / audits.length) : null;
    return {
      total: entries.length,
      done,
      attention: entries.filter((entry) => isAttention(entry.status)).length,
      average,
      audits: audits.length,
      last: entries[0]?.startedAt ?? null,
    };
  }, [entries]);

  function changeSort(key: SortKey) {
    setSort((current) => (current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "startedAt" || key === "durationMs" ? "desc" : "asc" }));
    setPage(1);
  }

  function clearFilters() {
    setQuery("");
    setKind("all");
    setStatus("all");
    setPeriod(0);
    setCutoff(null);
    setPage(1);
  }

  function choosePeriod(days: number) {
    setPeriod(days);
    setCutoff(days === 0 ? null : Date.now() - days * DAY_MS);
    setPage(1);
  }

  function exportAs(format: "csv" | "json") {
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "csv") download(`emulix-reports-${stamp}.csv`, "text/csv;charset=utf-8", reportsToCsv(sorted));
    else download(`emulix-reports-${stamp}.json`, "application/json", JSON.stringify(sorted, null, 2));
    setMessage(`Exported ${sorted.length} ${sorted.length === 1 ? "report" : "reports"}.`);
    setError(null);
  }

  function askRemove(entry: ReportEntry) {
    setConfirm({
      title: "Remove this report?",
      body: `${KIND_LABEL[entry.kind]} for ${entry.target}. It is removed from your history only. You can run it again any time.`,
      label: "Remove",
      run: async () => {
        const response = await fetch(`/api/reports/${encodeURIComponent(entry.id)}`, { method: "DELETE" });
        if (!response.ok) {
          const json = (await response.json().catch(() => ({}))) as { message?: string };
          setError(json.message ?? "That report could not be removed.");
          return;
        }
        setOpenId(null);
        setMessage("Report removed.");
        setError(null);
        await reload();
      },
    });
  }

  function askClear() {
    setConfirm({
      title: "Clear all your reports?",
      body: "Every finished audit, test and browser session is removed from your history. Anything still running stays.",
      label: "Clear history",
      run: async () => {
        const response = await fetch("/api/reports", { method: "DELETE" });
        const json = (await response.json().catch(() => ({}))) as { removed?: number; message?: string };
        if (!response.ok) {
          setError(json.message ?? "History could not be cleared.");
          return;
        }
        setMessage(`Cleared ${json.removed ?? 0} ${json.removed === 1 ? "report" : "reports"}.`);
        setError(null);
        await reload();
      },
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Reports and history</h1>
          <p className="mt-1 text-sm text-muted">Every audit, website test and live browser session you have run. Open one for its scores and fixes.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void reload()} disabled={refreshing} className={BUTTON}>{refreshing ? "Refreshing…" : "Refresh"}</button>
          <button type="button" onClick={() => exportAs("csv")} disabled={sorted.length === 0} className={BUTTON}>Export CSV</button>
          <button type="button" onClick={() => exportAs("json")} disabled={sorted.length === 0} className={BUTTON}>Export JSON</button>
          <button type="button" onClick={askClear} disabled={isSample} className="rounded-xl border border-danger/40 px-3.5 py-2 text-sm font-semibold text-danger transition hover:bg-danger/10 disabled:opacity-50">Clear history</button>
        </div>
      </header>

      {isSample && (
        <section aria-label="Example data" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning/30 bg-warning/5 px-5 py-4">
          <p className="text-sm text-warning"><strong className="font-semibold">Example data.</strong> You have not run anything yet, so these rows are examples. Your own reports replace them as soon as you run one.</p>
          <div className="flex gap-2">
            <Link href="/optimize" className={BUTTON}>Run an audit</Link>
            <Link href="/test" className={BUTTON}>Test a site</Link>
          </div>
        </section>
      )}

      <section aria-label="Summary" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total runs" value={String(stats.total)} hint={stats.last ? `Latest ${formatWhen(stats.last)}` : "Nothing yet"} gradient="from-brand-blue to-brand-violet" />
        <Stat label="Completed" value={String(stats.done)} hint={stats.total ? `${Math.round((stats.done / stats.total) * 100)}% finished` : "No runs yet"} gradient="from-emerald-400 to-teal-600" />
        <Stat label="Need attention" value={String(stats.attention)} hint={stats.attention ? "Failed or timed out" : "Nothing failed"} gradient="from-rose-400 to-red-600" />
        <Stat label="Average audit score" value={stats.average === null ? "None" : String(stats.average)} hint={stats.audits ? `Across ${stats.audits} ${stats.audits === 1 ? "audit" : "audits"}` : "Run an audit to see it"} gradient="from-amber-400 to-rose-500" />
      </section>

      {(message || error) && (
        <p role={error ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm font-medium ${error ? "border-danger/40 bg-danger/10 text-danger" : "border-success/40 bg-success/10 text-success"}`}>
          {error ?? message}
        </p>
      )}

      <section aria-label="Filters" className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/70 bg-surface p-4 shadow-sm">
        <div className="min-w-[12rem] flex-1">
          <label htmlFor="report-search" className="mb-1.5 block text-xs font-medium text-muted">Search</label>
          <input id="report-search" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Address, device or page title" className={`${INPUT} w-full`} />
        </div>
        <div role="group" aria-label="Type" className="flex rounded-xl border border-border bg-background p-1 text-sm">
          {(["all", "website", "audit", "apk"] as const).map((value) => (
            <button key={value} type="button" aria-pressed={kind === value} onClick={() => { setKind(value); setPage(1); }} className={`rounded-lg px-3 py-1.5 font-medium transition ${kind === value ? "bg-surface text-accent shadow-sm" : "text-muted hover:text-foreground"}`}>
              {value === "all" ? "All" : value === "website" ? "Website" : value === "audit" ? "Audit" : "APK"}
            </button>
          ))}
        </div>
        <div>
          <label htmlFor="report-status" className="mb-1.5 block text-xs font-medium text-muted">Status</label>
          <select id="report-status" value={status} onChange={(event) => { setStatus(event.target.value as StatusFilter); setPage(1); }} className={INPUT}>
            <option value="all">Any status</option>
            <option value="completed">Completed</option>
            <option value="running">Running</option>
            <option value="attention">Failed or timed out</option>
          </select>
        </div>
        <div>
          <label htmlFor="report-period" className="mb-1.5 block text-xs font-medium text-muted">Period</label>
          <select id="report-period" value={String(period)} onChange={(event) => choosePeriod(Number(event.target.value))} className={INPUT}>
            <option value="0">All time</option>
            <option value="1">Last 24 hours</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </select>
        </div>
        {filtering && <button type="button" onClick={clearFilters} className="pb-2 text-sm font-medium text-accent hover:underline">Clear filters</button>}
      </section>

      <section aria-label="Results" className="rounded-2xl border border-border/70 bg-surface shadow-sm">
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">Your reports</caption>
            <thead className="border-b border-border text-xs uppercase tracking-wider text-muted">
              <tr>
                <SortHeader label="Type" sortKey="kind" sort={sort} onSort={changeSort} />
                <SortHeader label="Target" sortKey="target" sort={sort} onSort={changeSort} />
                <SortHeader label="Started" sortKey="startedAt" sort={sort} onSort={changeSort} className="hidden md:table-cell" />
                <SortHeader label="Duration" sortKey="durationMs" sort={sort} onSort={changeSort} className="hidden lg:table-cell" />
                <th scope="col" className="hidden px-4 py-3 font-medium lg:table-cell">Result</th>
                <SortHeader label="Status" sortKey="status" sort={sort} onSort={changeSort} />
                <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((entry) => (
                <tr key={entry.id} className="transition hover:bg-background/60">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2.5">
                      <KindIcon kind={entry.kind} />
                      <span className="whitespace-nowrap font-medium">{KIND_LABEL[entry.kind]}{entry.sample && <span className="ml-2 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted">Example</span>}</span>
                    </span>
                  </td>
                  <td className="max-w-[16rem] px-4 py-3">
                    <span className="block truncate font-medium" title={entry.target}>{entry.target}</span>
                    <span className="block truncate text-xs text-muted">{entry.device}</span>
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-xs text-muted md:table-cell">{formatWhen(entry.startedAt)}</td>
                  <td className="hidden px-4 py-3 text-xs text-muted lg:table-cell">{formatDuration(entry.durationMs)}</td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    {entry.audit ? (
                      <span className={`font-bold tabular-nums ${TONE[scoreTone(entry.audit.overall)]}`}>{entry.audit.overall}<span className="text-xs font-medium text-muted"> / 100</span></span>
                    ) : entry.test ? (
                      <span className="text-xs text-muted">HTTP {entry.test.httpStatus ?? "none"}</span>
                    ) : (
                      <span className="text-xs text-muted">None</span>
                    )}
                  </td>
                  <td className="px-4 py-3"><StatusChip status={entry.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => setOpenId(entry.id)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent">
                      View<span className="sr-only"> report for {entry.target}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sorted.length === 0 && (
          <div role="status" className="px-5 py-12 text-center">
            <p className="font-semibold">{entries.length === 0 ? "No reports yet" : "No reports match these filters"}</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              {entries.length === 0 ? "Run an audit or open a website on a device and it shows up here." : "Try a different search, or clear the filters."}
            </p>
            {filtering && <button type="button" onClick={clearFilters} className={`${BUTTON} mt-4`}>Clear filters</button>}
          </div>
        )}

        {sorted.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
            <p className="text-muted" aria-live="polite">
              Showing {(safePage - 1) * PAGE_SIZE + 1} to {Math.min(safePage * PAGE_SIZE, sorted.length)} of {sorted.length}
              {filtering && entries.length !== sorted.length ? ` (${entries.length} in total)` : ""}
            </p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage(safePage - 1)} disabled={safePage <= 1} className={BUTTON}>Previous</button>
              <span className="px-1 text-muted">Page {safePage} of {pageCount}</span>
              <button type="button" onClick={() => setPage(safePage + 1)} disabled={safePage >= pageCount} className={BUTTON}>Next</button>
            </div>
          </div>
        )}
      </section>

      {open && <Detail entry={open} onClose={() => setOpenId(null)} onRemove={() => askRemove(open)} />}

      {confirm && (
        <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />
      )}
    </div>
  );
}

function ConfirmDialog({ confirm, onClose }: { confirm: NonNullable<Confirm>; onClose: () => void }) {
  const [pending, setPending] = useState(false);
  return (
    <Modal title={confirm.title} onClose={onClose}>
      <p className="text-sm text-muted">{confirm.body}</p>
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} className={BUTTON}>Cancel</button>
        <button
          type="button"
          autoFocus
          disabled={pending}
          onClick={async () => {
            setPending(true);
            await confirm.run();
            onClose();
          }}
          className="rounded-xl bg-danger px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Working…" : confirm.label}
        </button>
      </div>
    </Modal>
  );
}
