"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { DevtoolsRequest } from "@/lib/testing/devtools";
import {
  NETWORK_FILTERS,
  formatDuration,
  formatSize,
  networkFilterFor,
  networkMatches,
  requestName,
  statusCell,
  statusLine,
  summarizeRequests,
  waterfallBar,
  type NetworkFilter,
} from "@/lib/testing/devtools-format";
import {
  ClearIcon,
  CloseIcon,
  Disclosure,
  ExplainButton,
  FilterInput,
  Insight,
  ToolbarButton,
  ToolbarDivider,
  toolbarClass,
  type ExplainControls,
} from "./devtools-parts";

type Props = {
  requests: DevtoolsRequest[];
  explain: ExplainControls;
  onClear: () => void;
  emptyMessage: string | null;
};

/** A small coloured square in front of a request's name, standing in for Chrome's file-type icons. */
const TYPE_COLORS: Partial<Record<NetworkFilter, string>> = {
  doc: "bg-[#4c8bf5]",
  js: "bg-[#e8a600]",
  css: "bg-[#a142f4]",
  img: "bg-[#188038]",
  font: "bg-[#d93025]",
  fetch: "bg-[#12b5cb]",
  media: "bg-[#e52592]",
};

function TypeSwatch({ request }: { request: DevtoolsRequest }) {
  const color = TYPE_COLORS[networkFilterFor(request)] ?? "bg-[#9aa0a6]";
  return <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 shrink-0 rounded-[2px] ${color}`} />;
}

function isProblem(request: DevtoolsRequest): boolean {
  return statusCell(request).failed;
}

const headerCell = "h-6 border-b border-r border-[var(--dt-border)] bg-[var(--dt-toolbar)] px-2 text-left text-xs font-normal text-[var(--dt-text)]";
const cell = "truncate border-r border-[var(--dt-border)]/40 px-2";

/** The details pane Chrome opens on the right when a request is selected. Only what the capture knows is shown. */
function RequestDetails({ request, explain, onClose }: { request: DevtoolsRequest; explain: ExplainControls; onClose: () => void }) {
  const [generalOpen, setGeneralOpen] = useState(true);
  const state = explain.states[request.seq];
  const status = request.status;
  const dot = status === null ? "bg-[var(--dt-text-2)]" : status >= 400 ? "bg-[var(--dt-error-text)]" : status >= 300 ? "bg-[var(--dt-warning-icon)]" : "bg-[var(--dt-ok)]";
  const rows: [string, ReactNode][] = [
    ["Request URL:", request.url],
    ["Request Method:", request.method],
    [
      "Status Code:",
      <span key="status" className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className={`inline-block h-2 w-2 rounded-full ${dot}`} />
        {request.failure ? "(failed)" : status === null ? "(pending)" : statusLine(status)}
      </span>,
    ],
  ];
  if (request.failure) rows.push(["Failure reason:", request.failure]);

  return (
    <div className="flex min-h-0 w-[55%] min-w-[220px] shrink-0 flex-col border-l border-[var(--dt-border)] bg-[var(--dt-bg)]">
      <div className="flex h-6 shrink-0 items-stretch border-b border-[var(--dt-border)] bg-[var(--dt-toolbar)]">
        <button
          type="button"
          aria-label="Close request details"
          title="Close"
          onClick={onClose}
          className="flex w-6 items-center justify-center text-[var(--dt-text-2)] hover:bg-[var(--dt-hover)] hover:text-[var(--dt-text)] focus-visible:outline-2 focus-visible:outline-[var(--dt-accent)]"
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
        <span className="flex items-center border-b-2 border-[var(--dt-accent)] px-3 text-xs text-[var(--dt-accent)]">Headers</span>
      </div>
      <div className="dt-scroll min-h-0 flex-1 overflow-auto p-2 text-xs">
        <button
          type="button"
          aria-expanded={generalOpen}
          onClick={() => setGeneralOpen((value) => !value)}
          className="flex w-full items-center gap-1.5 py-0.5 text-left font-semibold text-[var(--dt-text)] focus-visible:outline-2 focus-visible:outline-[var(--dt-accent)]"
        >
          <Disclosure open={generalOpen} />
          General
        </button>
        {generalOpen && (
          <dl className="dt-mono ml-3.5 mt-0.5 space-y-0.5 text-[11px]">
            {rows.map(([term, value]) => (
              <div key={term} className="flex gap-2">
                <dt className="w-28 shrink-0 text-[var(--dt-text-2)]">{term}</dt>
                <dd className="min-w-0 flex-1 break-all text-[var(--dt-text)]">{value}</dd>
              </div>
            ))}
          </dl>
        )}
        {isProblem(request) && (
          <div className="mt-3">
            <ExplainButton label="Understand this request" state={state} onClick={() => explain.explain(request.seq, toTarget(request))} />
            <Insight state={state} onHide={() => explain.hide(request.seq)} />
          </div>
        )}
      </div>
    </div>
  );
}

function toTarget(request: DevtoolsRequest) {
  return {
    kind: "network" as const,
    method: request.method,
    url: request.url,
    resourceType: request.resourceType,
    status: request.status,
    failure: request.failure,
  };
}

/** The Network tab: a toolbar with clear and filter, type chips, the request table, and a status bar. */
export function DevtoolsNetwork({ requests, explain, onClear, emptyMessage }: Props) {
  const [text, setText] = useState("");
  const [typeFilter, setTypeFilter] = useState<NetworkFilter>("all");
  const [selectedSeq, setSelectedSeq] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const visible = requests.filter((request) => networkMatches(request, typeFilter, text));
  const selected = requests.find((request) => request.seq === selectedSeq) ?? null;
  // Like Chrome, an open details pane leaves only the Name column in the table.
  const compact = selected !== null;
  const summary = summarizeRequests(requests);

  useEffect(() => {
    const list = listRef.current;
    if (list && stickToBottom.current) list.scrollTop = list.scrollHeight;
  }, [visible.length]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={toolbarClass}>
        <ToolbarButton label="Clear network log" onClick={onClear} disabled={requests.length === 0}>
          <ClearIcon />
        </ToolbarButton>
        <ToolbarDivider />
        <FilterInput value={text} onChange={setText} label="Filter requests" />
      </div>
      <div role="group" aria-label="Filter by type" className="flex h-6 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-[var(--dt-border)] bg-[var(--dt-toolbar)] px-1.5">
        {NETWORK_FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={typeFilter === item.id}
            onClick={() => setTypeFilter(item.id)}
            className={`h-[18px] shrink-0 rounded-[3px] px-1.5 text-xs focus-visible:outline-2 focus-visible:outline-[var(--dt-accent)] ${
              typeFilter === item.id ? "bg-[var(--dt-selected)] text-[var(--dt-selected-text)]" : "text-[var(--dt-text)] hover:bg-[var(--dt-hover)]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        <div
          ref={listRef}
          onScroll={() => {
            const list = listRef.current;
            if (list) stickToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 24;
          }}
          className="dt-scroll min-h-0 min-w-0 flex-1 overflow-auto"
        >
          {emptyMessage ? (
            <p className="p-3 text-xs text-[var(--dt-text-2)]">{emptyMessage}</p>
          ) : (
            <table className="w-full table-fixed border-collapse text-[11px]">
              <colgroup>
                <col />
                {!compact && (
                  <>
                    <col style={{ width: 72 }} />
                    <col style={{ width: 84 }} />
                    <col style={{ width: 72 }} />
                    <col style={{ width: 72 }} />
                    <col style={{ width: "26%" }} />
                  </>
                )}
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr>
                  <th scope="col" className={headerCell}>Name</th>
                  {!compact && (
                    <>
                      <th scope="col" className={headerCell}>Status</th>
                      <th scope="col" className={headerCell}>Type</th>
                      <th scope="col" className={`${headerCell} text-right`}>Size</th>
                      <th scope="col" className={`${headerCell} text-right`}>Time</th>
                      <th scope="col" className={headerCell}>Waterfall</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {visible.map((request, index) => {
                  const status = statusCell(request);
                  const active = request.seq === selectedSeq;
                  const bar = waterfallBar(request, requests);
                  const tone = active
                    ? "bg-[var(--dt-selected)] text-[var(--dt-selected-text)]"
                    : status.failed
                      ? `text-[var(--dt-error-text)] hover:bg-[var(--dt-hover)] ${index % 2 ? "bg-[var(--dt-stripe)]" : ""}`
                      : `text-[var(--dt-text)] hover:bg-[var(--dt-hover)] ${index % 2 ? "bg-[var(--dt-stripe)]" : ""}`;
                  return (
                    <tr
                      key={request.seq}
                      tabIndex={0}
                      aria-selected={active}
                      onClick={() => setSelectedSeq(active ? null : request.seq)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedSeq(active ? null : request.seq);
                        }
                      }}
                      className={`h-[21px] cursor-default focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-[var(--dt-accent)] ${tone}`}
                    >
                      <td className={cell} title={request.url}>
                        <span className="flex items-center gap-1.5">
                          <TypeSwatch request={request} />
                          <span className="truncate">{requestName(request.url)}</span>
                        </span>
                      </td>
                      {!compact && (
                        <>
                          <td className={cell}>{status.label}</td>
                          <td className={cell}>{request.resourceType}</td>
                          <td className={`${cell} text-right tabular-nums`}>{formatSize(request.sizeBytes)}</td>
                          <td className={`${cell} text-right tabular-nums`}>{formatDuration(request.durationMs)}</td>
                          <td className="relative px-0">
                            <span
                              aria-hidden="true"
                              className={`absolute top-1/2 h-2 -translate-y-1/2 rounded-[1px] ${status.failed ? "bg-[var(--dt-error-text)]" : "bg-[var(--dt-bar)]"}`}
                              style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
                            />
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {selected && <RequestDetails key={selected.seq} request={selected} explain={explain} onClose={() => setSelectedSeq(null)} />}
      </div>

      <div className="flex h-5 shrink-0 items-center gap-2 border-t border-[var(--dt-border)] bg-[var(--dt-toolbar)] px-2 text-xs text-[var(--dt-text-2)]">
        <span>
          {summary.count} {summary.count === 1 ? "request" : "requests"}
        </span>
        {summary.count > 0 && (
          <>
            <span aria-hidden="true">|</span>
            <span>{formatSize(summary.transferredBytes) || "0 B"} transferred</span>
            <span aria-hidden="true">|</span>
            <span>Finish: {formatDuration(summary.finishMs)}</span>
          </>
        )}
      </div>
    </div>
  );
}
