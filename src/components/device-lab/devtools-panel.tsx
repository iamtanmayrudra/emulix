"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { postAi } from "@/lib/ai/client";
import type { ExplainResponse, ExplainTarget } from "@/lib/ai/types";
import type { DevtoolsSnapshot } from "@/lib/testing/devtools";
import { consoleLevel } from "@/lib/testing/devtools-format";
import { DevtoolsConsole } from "./devtools-console";
import { DevtoolsNetwork } from "./devtools-network";
import { CloseIcon, ErrorIcon, WarningIcon, type ExplainControls, type ExplainState } from "./devtools-parts";

const POLL_INTERVAL_MS = 1000;
const DEFAULT_HEIGHT = 300;
const MIN_HEIGHT = 160;
const KEYBOARD_STEP = 24;

type Tab = "console" | "network";

type Props = {
  /** The live browser session to inspect, or null before a test has started. */
  sessionId: string | null;
  onClose: () => void;
  /** The server refused the log because the account is not on Pro (for example, the subscription ended). */
  onPlanRequired: (message: string) => void;
};

function maxHeight(): number {
  return typeof window === "undefined" ? 600 : Math.max(MIN_HEIGHT, Math.round(window.innerHeight * 0.8));
}

function clampHeight(value: number): number {
  return Math.min(maxHeight(), Math.max(MIN_HEIGHT, value));
}

const tabClass = (active: boolean) =>
  `flex h-full items-center border-b-2 px-3 text-xs focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--dt-accent)] ${
    active
      ? "border-[var(--dt-accent)] text-[var(--dt-accent)]"
      : "border-transparent text-[var(--dt-text-2)] hover:bg-[var(--dt-hover)] hover:text-[var(--dt-text)]"
  }`;

/**
 * The page's console and network log, laid out like Chrome DevTools: a tab bar with error and warning counts, a Console
 * and a Network tab, and an edge you can drag to resize. It is only rendered for Pro accounts, and the server checks the
 * plan again on every request for the log. Entries are kept by the server; "Clear" only hides what has been shown so far.
 */
export function DevtoolsPanel({ sessionId, onClose, onPlanRequired }: Props) {
  const [tab, setTab] = useState<Tab>("console");
  const [snapshot, setSnapshot] = useState<DevtoolsSnapshot | null>(null);
  const [ended, setEnded] = useState(false);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  /** Entries up to these sequence numbers were cleared in each tab, which clear separately as in Chrome. */
  const [consoleClearedSeq, setConsoleClearedSeq] = useState(0);
  const [networkClearedSeq, setNetworkClearedSeq] = useState(0);
  /** AI explanations by entry. Console entries and requests share one numbering, so the keys do not collide. */
  const [explained, setExplained] = useState<Record<number, ExplainState>>({});
  const drag = useRef<{ startY: number; startHeight: number } | null>(null);
  // The latest callback, so the polling loop does not restart when the parent re-renders.
  const planRequiredRef = useRef(onPlanRequired);
  useEffect(() => {
    planRequiredRef.current = onPlanRequired;
  }, [onPlanRequired]);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let version = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const response = await fetch(`/api/browser-sessions/${sessionId}/devtools?after=${version}`, { cache: "no-store" });
        if (cancelled) return;
        if (response.status === 403) {
          const data = (await response.json().catch(() => ({}))) as { message?: string };
          planRequiredRef.current(data.message ?? "DevTools is available on Pro.");
          return;
        }
        if (response.status === 404) {
          setEnded(true);
          return;
        }
        if (response.ok) {
          const data = (await response.json()) as DevtoolsSnapshot | { unchanged: true };
          if (cancelled) return;
          if (!("unchanged" in data)) {
            version = data.version;
            setSnapshot(data);
          }
        }
      } catch {
        // A dropped request is retried on the next tick.
      }
      if (!cancelled) timer = setTimeout(poll, POLL_INTERVAL_MS);
    }
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId]);

  async function explain(seq: number, target: ExplainTarget) {
    setExplained((current) => ({ ...current, [seq]: { status: "loading" } }));
    const result = await postAi<ExplainResponse>("/api/ai/explain", { target });
    setExplained((current) => ({
      ...current,
      [seq]: result.ok ? { status: "done", explanation: result.data.explanation } : { status: "error", error: result.error },
    }));
  }

  function hideExplanation(seq: number) {
    setExplained((current) => {
      const next = { ...current };
      delete next[seq];
      return next;
    });
  }

  const controls: ExplainControls = { states: explained, explain: (seq, target) => void explain(seq, target), hide: hideExplanation };

  const consoleEntries = (snapshot?.console ?? []).filter((entry) => entry.seq > consoleClearedSeq);
  const requests = (snapshot?.requests ?? []).filter((entry) => entry.seq > networkClearedSeq);
  const errorCount = consoleEntries.filter((entry) => consoleLevel(entry.type) === "error").length;
  const warningCount = consoleEntries.filter((entry) => consoleLevel(entry.type) === "warning").length;

  let emptyMessage: string | null = null;
  if (!sessionId) emptyMessage = "Start a test to see what the page logs and requests.";
  else if (ended) emptyMessage = "This browser session has ended.";

  // Drag the top edge to resize, as in Chrome. Pointer capture keeps the drag going when the pointer leaves the edge.
  function startResize(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startY: event.clientY, startHeight: height };
  }
  function moveResize(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (start) setHeight(clampHeight(start.startHeight + start.startY - event.clientY));
  }
  function endResize() {
    drag.current = null;
  }
  function resizeWithKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowUp") setHeight((value) => clampHeight(value + KEYBOARD_STEP));
    else if (event.key === "ArrowDown") setHeight((value) => clampHeight(value - KEYBOARD_STEP));
    else return;
    event.preventDefault();
  }

  return (
    <section
      aria-label="DevTools"
      style={{ height }}
      className="devtools relative flex shrink-0 flex-col border-t border-[var(--dt-border)] bg-[var(--dt-bg)] font-sans text-xs text-[var(--dt-text)]"
    >
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize DevTools"
        aria-valuenow={height}
        aria-valuemin={MIN_HEIGHT}
        tabIndex={0}
        onPointerDown={startResize}
        onPointerMove={moveResize}
        onPointerUp={endResize}
        onPointerCancel={endResize}
        onKeyDown={resizeWithKeys}
        className="absolute inset-x-0 -top-1 z-30 h-2 cursor-row-resize touch-none focus-visible:outline-2 focus-visible:outline-[var(--dt-accent)]"
      />

      <div className="flex h-7 shrink-0 items-stretch border-b border-[var(--dt-border)] bg-[var(--dt-toolbar)]">
        <div role="tablist" aria-label="DevTools panels" className="flex items-stretch">
          <button type="button" role="tab" aria-selected={tab === "console"} onClick={() => setTab("console")} className={tabClass(tab === "console")}>
            Console
          </button>
          <button type="button" role="tab" aria-selected={tab === "network"} onClick={() => setTab("network")} className={tabClass(tab === "network")}>
            Network
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2 pr-1">
          {errorCount > 0 && (
            <span className="flex items-center gap-1 text-[var(--dt-text)]" title={`${errorCount} ${errorCount === 1 ? "error" : "errors"}`}>
              <ErrorIcon className="h-3 w-3" /> {errorCount}
            </span>
          )}
          {warningCount > 0 && (
            <span className="flex items-center gap-1 text-[var(--dt-text)]" title={`${warningCount} ${warningCount === 1 ? "warning" : "warnings"}`}>
              <WarningIcon className="h-3 w-3" /> {warningCount}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close DevTools"
            title="Close DevTools"
            className="flex h-6 w-6 items-center justify-center rounded-[3px] text-[var(--dt-text-2)] hover:bg-[var(--dt-hover)] hover:text-[var(--dt-text)] focus-visible:outline-2 focus-visible:outline-[var(--dt-accent)]"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Both tabs stay mounted, so each keeps its filters, scroll position and selection while the other is shown. */}
      <div role="tabpanel" aria-label="Console" hidden={tab !== "console"} className="min-h-0 flex-1 flex-col data-[visible=true]:flex" data-visible={tab === "console"}>
        <DevtoolsConsole
          entries={consoleEntries}
          explain={controls}
          emptyMessage={emptyMessage}
          onClear={() => setConsoleClearedSeq(Math.max(0, ...(snapshot?.console ?? []).map((entry) => entry.seq)))}
        />
      </div>
      <div role="tabpanel" aria-label="Network" hidden={tab !== "network"} className="min-h-0 flex-1 flex-col data-[visible=true]:flex" data-visible={tab === "network"}>
        <DevtoolsNetwork
          requests={requests}
          explain={controls}
          emptyMessage={emptyMessage}
          onClear={() => setNetworkClearedSeq(Math.max(0, ...(snapshot?.requests ?? []).map((entry) => entry.seq)))}
        />
      </div>
    </section>
  );
}
