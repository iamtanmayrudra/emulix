"use client";

import { useEffect, useRef, useState } from "react";
import { CONSOLE_LEVELS, DEFAULT_CONSOLE_LEVELS, consoleLevel, consoleMatches, sourceLabel, type ConsoleLevel } from "@/lib/testing/devtools-format";
import type { DevtoolsConsoleEntry } from "@/lib/testing/devtools";
import {
  ClearIcon,
  Disclosure,
  ErrorIcon,
  ExplainButton,
  FilterInput,
  InfoIcon,
  Insight,
  ToolbarButton,
  ToolbarDivider,
  WarningIcon,
  toolbarClass,
  type ExplainControls,
} from "./devtools-parts";

type Props = {
  entries: DevtoolsConsoleEntry[];
  explain: ExplainControls;
  onClear: () => void;
  /** Shown instead of an empty list, for example before a test has started. */
  emptyMessage: string | null;
};

const ROW_TONE: Record<ConsoleLevel, string> = {
  error: "border-[var(--dt-error-border)] bg-[var(--dt-error-bg)] text-[var(--dt-error-text)]",
  warning: "border-[var(--dt-warning-border)] bg-[var(--dt-warning-bg)] text-[var(--dt-warning-text)]",
  info: "border-[var(--dt-border)]/50 text-[var(--dt-text)]",
  log: "border-[var(--dt-border)]/50 text-[var(--dt-text)]",
  verbose: "border-[var(--dt-border)]/50 text-[var(--dt-text-2)]",
};

function LevelIcon({ level }: { level: ConsoleLevel }) {
  if (level === "error") return <ErrorIcon />;
  if (level === "warning") return <WarningIcon />;
  if (level === "info") return <InfoIcon />;
  return null;
}

/** "Default levels" menu with a checkbox per level, as in Chrome. */
function LevelsMenu({ levels, onChange }: { levels: ConsoleLevel[]; onChange: (levels: ConsoleLevel[]) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const isDefault = levels.length === DEFAULT_CONSOLE_LEVELS.length && DEFAULT_CONSOLE_LEVELS.every((level) => levels.includes(level));

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-6 items-center gap-1 rounded-[3px] px-1.5 text-xs text-[var(--dt-text)] hover:bg-[var(--dt-hover)] focus-visible:outline-2 focus-visible:outline-[var(--dt-accent)]"
      >
        {isDefault ? "Default levels" : "Custom levels"}
        <span aria-hidden="true" className="text-[8px] text-[var(--dt-text-2)]">
          ▼
        </span>
      </button>
      {open && (
        <div role="group" aria-label="Log levels" className="absolute left-0 top-7 z-20 w-36 rounded-[3px] border border-[var(--dt-border)] bg-[var(--dt-bg)] py-1 shadow-lg">
          {CONSOLE_LEVELS.map((level) => (
            <label key={level.id} className="flex cursor-pointer items-center gap-2 px-2 py-0.5 text-xs text-[var(--dt-text)] hover:bg-[var(--dt-hover)]">
              <input
                type="checkbox"
                checked={levels.includes(level.id)}
                onChange={(event) => onChange(event.target.checked ? [...levels, level.id] : levels.filter((item) => item !== level.id))}
                className="accent-[var(--dt-accent)]"
              />
              {level.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function ConsoleRow({ entry, explain }: { entry: DevtoolsConsoleEntry; explain: ExplainControls }) {
  const level = consoleLevel(entry.type);
  const [open, setOpen] = useState(false);
  const lines = entry.text.split("\n");
  const expandable = lines.length > 1;
  const prefix = entry.type === "exception" ? "Uncaught " : "";
  const text = expandable && !open ? lines[0] : entry.text;
  const state = explain.states[entry.seq];
  const source = sourceLabel(entry.source);

  return (
    <div className="group">
      <div className={`flex items-start gap-1 border-b px-1 py-px leading-[1.45] ${ROW_TONE[level]}`}>
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          <LevelIcon level={level} />
        </span>
        {expandable ? (
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? "Collapse message" : "Expand message"}
            onClick={() => setOpen((value) => !value)}
            className="flex h-4 w-3 shrink-0 items-center justify-center focus-visible:outline-2 focus-visible:outline-[var(--dt-accent)]"
          >
            <Disclosure open={open} />
          </button>
        ) : null}
        <span className="dt-mono min-w-0 flex-1 whitespace-pre-wrap break-words">
          {prefix}
          {text}
        </span>
        {(level === "error" || level === "warning") && (
          <ExplainButton
            label="Understand this error"
            state={state}
            revealOnHover
            onClick={() => explain.explain(entry.seq, { kind: "console", type: entry.type, text: entry.text })}
          />
        )}
        {source && (
          <span className="dt-mono shrink-0 pl-2 text-[var(--dt-text-2)]" title={entry.source ? `${entry.source.url}:${entry.source.line}` : undefined}>
            {source}
          </span>
        )}
      </div>
      {state && state.status !== "loading" && (
        <div className="border-b border-[var(--dt-border)]/50 bg-[var(--dt-bg)] pl-6 pr-2 text-[var(--dt-text)]">
          <Insight state={state} onHide={() => explain.hide(entry.seq)} />
        </div>
      )}
    </div>
  );
}

/** The Console tab: a toolbar with clear, filter and log levels, then the messages, newest at the bottom. */
export function DevtoolsConsole({ entries, explain, onClear, emptyMessage }: Props) {
  const [filter, setFilter] = useState("");
  const [levels, setLevels] = useState<ConsoleLevel[]>(DEFAULT_CONSOLE_LEVELS);
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const visible = entries.filter((entry) => consoleMatches(entry, levels, filter));
  const hidden = entries.length - visible.length;

  // Follow new messages, unless the tester has scrolled up to read.
  useEffect(() => {
    const list = listRef.current;
    if (list && stickToBottom.current) list.scrollTop = list.scrollHeight;
  }, [visible.length]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={toolbarClass}>
        <ToolbarButton label="Clear console" onClick={onClear} disabled={entries.length === 0}>
          <ClearIcon />
        </ToolbarButton>
        <ToolbarDivider />
        <FilterInput value={filter} onChange={setFilter} label="Filter console messages" />
        <ToolbarDivider />
        <LevelsMenu levels={levels} onChange={setLevels} />
        {hidden > 0 && <span className="ml-1 text-xs text-[var(--dt-text-2)]">{hidden} hidden</span>}
      </div>
      <div
        ref={listRef}
        onScroll={() => {
          const list = listRef.current;
          if (list) stickToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 24;
        }}
        className="dt-scroll min-h-0 flex-1 overflow-auto text-[11px]"
      >
        {emptyMessage ? (
          <p className="p-3 text-xs text-[var(--dt-text-2)]">{emptyMessage}</p>
        ) : (
          visible.map((entry) => <ConsoleRow key={entry.seq} entry={entry} explain={explain} />)
        )}
      </div>
    </div>
  );
}
