"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { postAi } from "@/lib/ai/client";
import type { AiErrorBody, AiUsage, BugDraftResponse } from "@/lib/ai/types";
import {
  MAX_BUG_DESCRIPTION_LENGTH,
  MAX_BUG_TITLE_LENGTH,
  bugFileStem,
  buildBugReport,
  type BugCapture,
} from "@/lib/testing/bug-report";

type Props = {
  capture: BugCapture;
  onClose: () => void;
};

type DraftState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; usage: AiUsage }
  | { status: "error"; error: AiErrorBody };

/** Larger screenshots are left out of the AI request; the server would drop them anyway. */
const MAX_AI_SCREENSHOT_LENGTH = 4_000_000;

function saveFile(href: string, filename: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
}

const fieldClass =
  "mt-1 w-full rounded-[3px] border border-border bg-background px-2.5 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-accent";
const buttonClass =
  "rounded-[3px] border border-border px-3 py-1.5 text-sm font-medium hover:border-accent focus-visible:outline-2 focus-visible:outline-accent";

/**
 * Shows what a bug capture caught, lets the tester describe it, and saves it as a Markdown report plus the screenshot.
 * The capture lives in the browser only; nothing is sent anywhere until the tester downloads it.
 */
export function BugCapturePanel({ capture, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [draft, setDraft] = useState<DraftState>({ status: "idle" });
  const dialogRef = useRef<HTMLDivElement>(null);

  // Put focus back where it was, so keyboard users land on the menu again after closing.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    return () => opener?.focus?.();
  }, []);

  const stem = bugFileStem(capture);
  const evidence: [string, number][] = [
    ["Console errors and warnings", capture.consoleMessages.length],
    ["Uncaught page errors", capture.pageErrors.length],
    ["Failed requests", capture.failedRequests.length],
    ["HTTP errors", capture.httpErrors.length],
  ];

  /** Asks the server for a draft and fills the title and description with it. The tester reviews it before downloading. */
  async function draftWithAi(fresh: boolean) {
    setDraft({ status: "loading" });
    const screenshot = capture.screenshot.length > MAX_AI_SCREENSHOT_LENGTH ? undefined : capture.screenshot;
    const result = await postAi<BugDraftResponse>("/api/ai/bug-draft", { capture: { ...capture, screenshot }, fresh });
    if (!result.ok) {
      setDraft({ status: "error", error: result.error });
      return;
    }
    const { draft: drafted, usage } = result.data;
    setTitle(drafted.title.slice(0, MAX_BUG_TITLE_LENGTH));
    setDescription(`**Severity:** ${drafted.severity}\n\n${drafted.description}`.slice(0, MAX_BUG_DESCRIPTION_LENGTH));
    setDraft({ status: "done", usage });
  }

  function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    saveFile(url, filename);
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }

  function downloadReport() {
    const report = buildBugReport(capture, title, description, `${stem}.png`);
    saveBlob(new Blob([report], { type: "text/markdown;charset=utf-8" }), `${stem}.md`);
  }

  // Large data URLs do not download reliably as links, so the screenshot goes through a Blob.
  async function downloadScreenshot() {
    const blob = await (await fetch(capture.screenshot)).blob();
    saveBlob(blob, `${stem}.png`);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    // Keep Tab inside the dialog while it is open.
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>("button, input, textarea, [href]");
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bug-capture-heading"
        onKeyDown={handleKeyDown}
        className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-surface text-foreground shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 id="bug-capture-heading" className="text-base font-semibold">
            Capture a bug
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-[3px] px-1.5 text-xl leading-none text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">
            ×
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="flex min-h-0 justify-center rounded-[3px] border border-border bg-background p-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- a data URL from our own capture */}
            <img
              src={capture.screenshot}
              alt={`Screenshot of ${capture.pageTitle || capture.pageUrl} on ${capture.device.name}`}
              className="max-h-[60vh] w-auto max-w-full object-contain"
            />
          </div>

          <div className="min-w-0 text-sm">
            <label className="block font-medium">
              Title
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={MAX_BUG_TITLE_LENGTH}
                placeholder={`Bug on ${capture.device.name}`}
                autoFocus
                className={fieldClass}
              />
            </label>
            <label className="mt-3 block font-medium">
              What went wrong?
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={MAX_BUG_DESCRIPTION_LENGTH}
                rows={4}
                placeholder="Steps to reproduce, what you expected, and what happened instead."
                className={`${fieldClass} resize-y`}
              />
            </label>

            <div className="mt-2 rounded-[3px] border border-border bg-background p-2.5 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void draftWithAi(draft.status === "done")}
                  disabled={draft.status === "loading"}
                  className={`${buttonClass} disabled:opacity-60`}
                >
                  {draft.status === "loading" ? "Drafting…" : draft.status === "done" ? "Regenerate with AI" : "Draft with AI"}
                </button>
                <span className="text-muted">Fills the title and description above. This replaces what you have typed.</span>
              </div>
              <p className="mt-1.5 text-muted">
                Sends the screenshot and the errors below, with addresses shortened, to the AI provider. Nothing is stored.
              </p>
              <div aria-live="polite">
                {draft.status === "done" && (
                  <p className="mt-1.5 font-medium">
                    AI-generated draft. Check it against the evidence before you download.{" "}
                    <span className="font-normal text-muted">
                      {draft.usage.used} of {draft.usage.limit} AI requests used this month.
                    </span>
                  </p>
                )}
                {draft.status === "error" && (
                  <p role="alert" className="mt-1.5 font-medium text-danger">
                    {draft.error.message}{" "}
                    {draft.error.upgradeUrl && (
                      <Link href={draft.error.upgradeUrl} className="underline">
                        Upgrade to Pro
                      </Link>
                    )}
                  </p>
                )}
              </div>
            </div>

            <dl className="mt-4 space-y-1.5 border-y border-border py-3 text-xs">
              {[
                ["Device", capture.device.name],
                ["Viewport", `${capture.device.viewport.width} × ${capture.device.viewport.height}${capture.device.landscape ? " (landscape)" : ""}`],
                ["Page", capture.pageUrl],
                ["Captured", new Date(capture.capturedAt).toLocaleString()],
              ].map(([term, value]) => (
                <div key={term} className="flex justify-between gap-3">
                  <dt className="shrink-0 text-muted">{term}</dt>
                  <dd className="min-w-0 break-all text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">Caught on the page</p>
            <ul className="mt-1.5 space-y-1 text-xs">
              {evidence.map(([label, count]) => (
                <li key={label} className="flex justify-between gap-3">
                  <span>{label}</span>
                  <span className={`font-semibold tabular-nums ${count > 0 ? "text-danger" : "text-muted"}`}>{count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-background px-4 py-3">
          <p className="mr-auto text-xs text-muted">Saved on your device only. Nothing is shared.</p>
          <button type="button" onClick={() => void downloadScreenshot()} className={buttonClass}>
            Download screenshot
          </button>
          <button type="button" onClick={downloadReport} className="rounded-[3px] bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            Download report
          </button>
        </div>
      </div>
    </div>
  );
}
