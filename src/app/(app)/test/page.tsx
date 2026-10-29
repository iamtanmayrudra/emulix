"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { usePlan } from "@/components/plan-context";
import { BrowserControlsContext, type BrowserControls } from "@/components/device-lab/browser-controls";
import { BrowserToolbar } from "@/components/device-lab/browser-toolbar";
import { DeviceLabPicker } from "@/components/device-lab/device-lab-picker";
import { LiveBrowser } from "@/components/device-lab/live-browser";
import { PromotionBanner } from "@/components/device-lab/promotion-banner";
import { LoadingRegion, Skeleton } from "@/components/skeleton";
import { TestSidebar } from "@/components/test-sidebar";
import { UpgradeNotice } from "@/components/upgrade-notice";
import { DEVICES, findDevice, type Device } from "@/lib/device-lab/devices";
import { canSelectProfile } from "@/lib/entitlements";
import { DEVICE_PROFILES } from "@/lib/mock-data";
import type { PublicBrowserSession } from "@/lib/testing/browser-sessions";

/**
 * The reference workspace is a light panel. These tokens keep it light even when the OS is in dark mode,
 * so the rest of the app's theme is unchanged.
 */
const WORKSPACE_STYLE = {
  "--background": "#f2f2fa",
  "--surface": "#ffffff",
  "--foreground": "#1f1e3a",
  "--muted": "#5b5b78",
  "--border": "#dddcec",
  "--accent": "#6b3df0",
  "--accent-foreground": "#ffffff",
  "--success": "#14894a",
  "--pro": "#b61fc8",
  color: "var(--foreground)",
  colorScheme: "light",
} as CSSProperties;

type ApiError = { error?: string; message?: string };

type UpgradePrompt = { title: string; message: string };

/** Shown in the device's screen while its live browser opens. */
function Connecting({ device }: { device: string }) {
  return (
    <LoadingRegion label={`Opening a browser on ${device}`} className="flex h-full flex-col gap-3 bg-white p-4">
      <p className="text-center text-xs text-neutral-500">Opening a browser on {device}…</p>
      <Skeleton className="h-3 w-1/3 bg-neutral-200" />
      <Skeleton className="h-16 w-full bg-neutral-200" />
      <Skeleton className="h-3 w-5/6 bg-neutral-200" />
      <Skeleton className="h-3 w-2/3 bg-neutral-200" />
      <Skeleton className="h-3 w-1/2 bg-neutral-200" />
    </LoadingRegion>
  );
}

/** Ends a live browser session. Failures are ignored: the server also closes idle sessions. */
function closeSession(id: string) {
  return fetch(`/api/browser-sessions/${id}`, { method: "DELETE", keepalive: true }).catch(() => undefined);
}

export default function WebsiteTestPage() {
  const { plan } = usePlan();
  const [url, setUrl] = useState("https://");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [profileId, setProfileId] = useState(DEVICE_PROFILES[0].id);
  const [starred, setStarred] = useState(false);
  const [started, setStarted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [upgrade, setUpgrade] = useState<UpgradePrompt | null>(null);
  const [session, setSession] = useState<PublicBrowserSession | null>(null);
  /** The address the live page is on, which the browser bars show. */
  const [pageUrl, setPageUrl] = useState(url);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const sessionRef = useRef<string | null>(null);
  /** Counts launches, so an older launch that finishes late is closed instead of replacing a newer one. */
  const launchRef = useRef(0);

  const device: Device = findDevice(profileId) ?? DEVICES[0];
  const restricted = !canSelectProfile(plan, device);
  // The live browser shows only for the device it was started on.
  const liveSession = started && session && session.profileId === profileId ? session : null;

  useEffect(() => {
    sessionRef.current = session?.id ?? null;
  }, [session]);

  // Close the browser when the page is left, and when the tab is closed (React does not unmount then).
  useEffect(() => {
    function release() {
      if (sessionRef.current) void closeSession(sessionRef.current);
    }
    window.addEventListener("pagehide", release);
    return () => {
      window.removeEventListener("pagehide", release);
      release();
    };
  }, []);

  async function startRun(target: string, chosenProfile: string) {
    const launch = ++launchRef.current;
    setFormError(null);
    setSubmitting(true);
    try {
      // Close the previous browser first, so it does not count against the plan's limit.
      if (sessionRef.current) await closeSession(sessionRef.current);
      sessionRef.current = null;
      setSession(null);

      const response = await fetch("/api/browser-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target, profileId: chosenProfile, landscape: false }),
      });
      const data = (await response.json().catch(() => ({}))) as ApiError & { session?: PublicBrowserSession };
      if (!response.ok || !data.session) {
        if (data.error === "plan_required") {
          setUpgrade({ title: "This device needs Pro", message: data.message ?? "Upgrade to Pro to use it." });
        } else {
          setFormError(data.message ?? "The browser could not start. Try again.");
        }
        return;
      }
      if (launch !== launchRef.current) {
        // A newer launch started while this one was opening. Keep only the newest browser.
        void closeSession(data.session.id);
        return;
      }
      setSession(data.session);
      setPageUrl(data.session.requestedUrl);
      setStarted(true);
    } catch {
      if (launch === launchRef.current) setFormError("Network error. Check your connection and try again.");
    } finally {
      if (launch === launchRef.current) setSubmitting(false);
    }
  }

  /** While a test is open, picking another device opens a live browser on that device at the page you are on. */
  function handleSelectDevice(next: Device) {
    setProfileId(next.id);
    if (started && next.id !== session?.profileId && canSelectProfile(plan, next)) {
      void startRun(pageUrl, next.id);
    }
  }

  const liveId = liveSession?.id ?? null;
  const controls = useMemo<BrowserControls>(() => {
    function send(body: Record<string, unknown>) {
      if (!liveId) return;
      void fetch(`/api/browser-sessions/${liveId}/input`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => undefined);
    }
    return {
      live: liveId !== null,
      navigate: (address) => send({ type: "navigate", url: address }),
      back: () => send({ type: "back" }),
      forward: () => send({ type: "forward" }),
      reload: () => send({ type: "reload" }),
    };
  }, [liveId]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      new URL(url.trim());
    } catch {
      setUrlError("Enter a full address, including https://.");
      return;
    }
    setUrlError(null);
    void startRun(url.trim(), profileId);
  }

  function handleEdit() {
    if (sessionRef.current) void closeSession(sessionRef.current);
    sessionRef.current = null;
    setSession(null);
    setStarted(false);
  }

  return (
    <div
      style={WORKSPACE_STYLE}
      className="relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden p-4 pl-16 md:p-8 md:pl-16"
    >
      <TestSidebar />

      {/* Blurred backdrop */}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-brand-fuchsia via-brand-violet to-brand-blue" />
      <div aria-hidden="true" className="absolute -left-24 top-16 h-96 w-96 rounded-full bg-brand-blue/60 blur-3xl" />
      <div aria-hidden="true" className="absolute -right-16 bottom-0 h-96 w-96 rounded-full bg-rose-300/60 blur-3xl" />

      <form
        onSubmit={handleSubmit}
        noValidate
        aria-labelledby="config-heading"
        className="relative flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-surface shadow-2xl"
      >
        <h1 id="config-heading" className="sr-only">
          Website testing
        </h1>

        {!started && (
          <>
            <PromotionBanner
              title="Ready to test a page?"
              message="Pick a device, enter a public address, and start a live browser."
              ctaLabel="Enter an address"
              onCta={() => urlInputRef.current?.focus()}
            />

            <BrowserToolbar
              url={url}
              onUrlChange={setUrl}
              urlError={urlError}
              starred={starred}
              onToggleStar={() => setStarred((value) => !value)}
              inputRef={urlInputRef}
            />
          </>
        )}

        <div className="min-h-0 flex-1 overflow-auto border-t border-border">
          <BrowserControlsContext.Provider value={controls}>
            <DeviceLabPicker
              selectedId={profileId}
              plan={plan}
              url={liveSession || (started && submitting) ? pageUrl : url}
              pageContent={
                started && submitting ? (
                  <Connecting device={device.name} />
                ) : liveSession ? (
                  <LiveBrowser key={liveSession.id} sessionId={liveSession.id} label={liveSession.requestedUrl} onPageUrl={setPageUrl} />
                ) : undefined
              }
              focused={started}
              onSelect={handleSelectDevice}
            />
          </BrowserControlsContext.Provider>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/60 px-4 py-3">
          <div className="min-w-0 text-sm">
            <p>
              <span className="text-muted">Selected:</span>{" "}
              <span className="font-medium">{device.name}</span>{" "}
              <span className="text-muted">
                · {device.width} × {device.height}
              </span>
            </p>
            {liveSession && (
              <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                Browser:
                <span className="inline-flex rounded-full bg-success/10 px-2 py-0.5 font-semibold text-success">Live</span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {formError && (
              <p role="alert" className="text-sm font-medium text-danger">
                {formError}
              </p>
            )}
            {/*
              Two separate buttons, not one that changes type. A single button that flips from "button" to "submit"
              while React handles its own click would submit the form straight after "Edit test" is pressed.
            */}
            {started ? (
              <button
                key="edit"
                type="button"
                onClick={handleEdit}
                disabled={submitting}
                className="rounded-md bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
              >
                {submitting ? "Starting…" : "Edit test"}
              </button>
            ) : (
              <button
                key="start"
                type="submit"
                disabled={submitting || restricted}
                className="rounded-md bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
              >
                {submitting ? "Starting…" : restricted ? "Pro device selected" : "Start test"}
              </button>
            )}
          </div>
        </div>
      </form>

      {upgrade && (
        <UpgradeNotice title={upgrade.title} message={upgrade.message} onDismiss={() => setUpgrade(null)} />
      )}
    </div>
  );
}
