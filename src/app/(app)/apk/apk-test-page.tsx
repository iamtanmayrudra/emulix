"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { LiveAndroid } from "@/components/android/live-android";
import { usePlan } from "@/components/plan-context";
import { PLAN_LIMITS } from "@/lib/mock-data";
import type { PublicAndroidSession } from "@/lib/android/sessions";

type Support = {
  available: boolean;
  reason?: string;
  profiles: { id: string; label: string }[];
  limits: { maxSizeMb: number; uploadsPerPeriod: number };
  used: number;
  active: PublicAndroidSession | null;
};

type ApiError = { error?: string; message?: string };

/** Ends a session on the server. Failures are ignored: the server also stops idle sessions. */
function stopSession(id: string) {
  return fetch(`/api/android-sessions/${id}`, { method: "DELETE", keepalive: true }).catch(() => undefined);
}

const POLL_MS = 1500;

/** Asks the server what Android testing can do, and whether this person already has a session running. */
async function fetchSupport(): Promise<{ data: Support } | { error: string }> {
  try {
    const response = await fetch("/api/android-sessions", { cache: "no-store" });
    const data = (await response.json()) as Support & ApiError;
    if (!response.ok) return { error: data.message ?? "APK testing could not be loaded." };
    return { data };
  } catch {
    return { error: "Network error. Check your connection and reload the page." };
  }
}

export default function ApkTestPage() {
  const { plan } = usePlan();
  const [support, setSupport] = useState<Support | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [profileId, setProfileId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [session, setSession] = useState<PublicAndroidSession | null>(null);
  /** The running session ended on its own: it timed out, or the server stopped it. */
  const [endedNotice, setEndedNotice] = useState<string | null>(null);
  const sessionRef = useRef<string | null>(null);
  /** Counts uploads, so one cancelled while it was still uploading is stopped when it finishes. */
  const attemptRef = useRef(0);

  const maxSizeMb = support?.limits.maxSizeMb ?? PLAN_LIMITS[plan].apkMaxSizeMb;

  const applySupport = useCallback((result: { data: Support } | { error: string }) => {
    if ("error" in result) {
      setLoadError(result.error);
      return;
    }
    const { data } = result;
    setSupport(data);
    setLoadError(null);
    setProfileId((current) => current || data.profiles[0]?.id || "");
    // A session that is still running, for example after the page was reloaded, is picked up again.
    if (data.active) setSession((current) => current ?? data.active);
  }, []);

  const refreshSupport = useCallback(() => {
    void fetchSupport().then(applySupport);
  }, [applySupport]);

  useEffect(() => {
    let cancelled = false;
    void fetchSupport().then((result) => {
      if (!cancelled) applySupport(result);
    });
    return () => {
      cancelled = true;
    };
  }, [applySupport]);

  useEffect(() => {
    sessionRef.current = session && (session.status === "live" || session.status === "booting" || session.status === "installing" || session.status === "starting") ? session.id : null;
  }, [session]);

  // Stop the emulator when the page is left, and when the tab is closed (React does not unmount then).
  useEffect(() => {
    function release() {
      if (sessionRef.current) void stopSession(sessionRef.current);
    }
    window.addEventListener("pagehide", release);
    return () => {
      window.removeEventListener("pagehide", release);
      release();
    };
  }, []);

  // While the emulator starts, ask the server how far along it is.
  const watchedId = session && session.status !== "live" && session.status !== "failed" && session.status !== "closed" ? session.id : null;
  useEffect(() => {
    if (!watchedId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      try {
        const response = await fetch(`/api/android-sessions/${watchedId}`, { cache: "no-store" });
        if (cancelled) return;
        if (response.status === 404) {
          setSession(null);
          setEndedNotice("The Android session ended before it was ready.");
          return;
        }
        if (response.ok) {
          const data = (await response.json()) as { session: PublicAndroidSession };
          if (!cancelled) setSession(data.session);
        }
      } catch {
        // A network blip is retried on the next check.
      }
      if (!cancelled) timer = setTimeout(poll, POLL_MS);
    }
    timer = setTimeout(poll, POLL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [watchedId]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    if (!chosen) return;
    setFormError(null);
    setEndedNotice(null);
    const sizeMb = chosen.size / (1024 * 1024);
    if (!chosen.name.toLowerCase().endsWith(".apk")) {
      setFile(null);
      setFileError("Only .apk files can be selected.");
    } else if (sizeMb > maxSizeMb) {
      setFile(null);
      setFileError(`This file is ${sizeMb.toFixed(1)} MB. The ${plan} plan limit is ${maxSizeMb} MB.`);
    } else {
      setFileError(null);
      setFile(chosen);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || uploading) return;
    const attempt = ++attemptRef.current;
    setUploading(true);
    setFormError(null);
    setEndedNotice(null);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("profile", profileId);
      const response = await fetch("/api/android-sessions", { method: "POST", body });
      const data = (await response.json().catch(() => ({}))) as ApiError & { session?: PublicAndroidSession };
      if (attempt !== attemptRef.current) {
        // Cancelled while uploading. The server started a session anyway, so stop it.
        if (data.session) void stopSession(data.session.id);
        return;
      }
      if (!response.ok || !data.session) {
        setFormError(data.message ?? "The APK could not be started. Try again.");
        return;
      }
      setSession(data.session);
      refreshSupport();
    } catch {
      if (attempt === attemptRef.current) setFormError("Network error. Check your connection and try again.");
    } finally {
      if (attempt === attemptRef.current) setUploading(false);
    }
  }

  function handleStop() {
    attemptRef.current += 1;
    setUploading(false);
    if (sessionRef.current) void stopSession(sessionRef.current);
    sessionRef.current = null;
    setSession(null);
    setFormError(null);
    refreshSupport();
  }

  const handleEnded = useCallback(() => {
    setSession(null);
    setEndedNotice("The Android session ended. Upload the APK again to start a new one.");
    refreshSupport();
  }, [refreshSupport]);

  const running = session !== null && session.status !== "failed" && session.status !== "closed";
  const live = session?.status === "live";
  const starting = running && !live;
  const used = support?.used ?? 0;
  const allowed = support?.limits.uploadsPerPeriod ?? PLAN_LIMITS[plan].apkUploadsPerPeriod;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">APK testing</h1>
        <p className="text-sm text-muted">
          Upload an Android app and use it on a real Android emulator. Android apps cannot run in an iOS simulator.
        </p>
      </header>

      {loadError && (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm font-medium text-danger">
          {loadError}
        </p>
      )}

      {support && !support.available && (
        <div role="status" className="rounded-lg border border-border bg-surface p-5 text-sm">
          <p className="font-semibold">APK testing is not available here</p>
          <p className="mt-1 text-muted">{support.reason}</p>
        </div>
      )}

      {support?.available && !running && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <section aria-labelledby="upload-heading" className="space-y-4 rounded-lg border border-border bg-surface p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="upload-heading" className="text-base font-semibold">
                Upload APK
              </h2>
              <p className="text-xs text-muted">
                {used} of {allowed} APK tests used this month
              </p>
            </div>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-background px-4 py-8 text-center text-sm hover:border-accent">
              <span className="font-medium">{file ? file.name : "Choose an .apk file"}</span>
              <span className="text-muted">
                {file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : `Limit on your ${plan} plan: ${maxSizeMb} MB`}
              </span>
              <input type="file" accept=".apk,application/vnd.android.package-archive" className="sr-only" onChange={handleFileChange} />
            </label>
            {fileError && (
              <p role="alert" className="text-sm font-medium text-danger">
                {fileError}
              </p>
            )}
            <p className="text-xs text-muted">
              The app is installed on a temporary emulator and removed when the session ends. Only test apps you trust.
            </p>
          </section>

          <section aria-labelledby="android-heading" className="space-y-4 rounded-lg border border-border bg-surface p-5">
            <h2 id="android-heading" className="text-base font-semibold">
              Android device
            </h2>
            <div>
              <label htmlFor="android-profile" className="text-sm font-medium">
                Device
              </label>
              <select
                id="android-profile"
                value={profileId}
                onChange={(event) => setProfileId(event.target.value)}
                className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                {support.profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.label}
                  </option>
                ))}
              </select>
            </div>

            {formError && (
              <p role="alert" className="text-sm font-medium text-danger">
                {formError}
              </p>
            )}
            {endedNotice && (
              <p role="status" className="text-sm font-medium text-muted">
                {endedNotice}
              </p>
            )}
            {session?.status === "failed" && (
              <p role="alert" className="text-sm font-medium text-danger">
                {session.error ?? "The Android session failed."}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={!file || uploading}
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
              >
                {uploading ? "Uploading…" : "Run APK test"}
              </button>
              {uploading && (
                <button
                  type="button"
                  onClick={handleStop}
                  className="rounded-md border border-border px-4 py-2 text-sm font-semibold hover:border-danger hover:text-danger focus-visible:outline-2 focus-visible:outline-accent"
                >
                  Cancel
                </button>
              )}
            </div>
          </section>
        </form>
      )}

      {starting && session && (
        <section aria-live="polite" className="space-y-4 rounded-lg border border-border bg-surface p-6">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-accent motion-reduce:animate-none" />
            <div>
              <p className="text-sm font-semibold">{session.message}</p>
              <p className="text-xs text-muted">
                {session.app.label} {session.app.versionName && `· version ${session.app.versionName}`}. The first start can take a minute or two.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleStop}
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold hover:border-danger hover:text-danger focus-visible:outline-2 focus-visible:outline-accent"
          >
            Cancel
          </button>
        </section>
      )}

      {live && session && (
        <section aria-label="Running app" className="grid items-start gap-8 lg:grid-cols-[auto_1fr]">
          <LiveAndroid key={session.id} sessionId={session.id} label={session.app.label} onEnded={handleEnded} />
          <div className="max-w-sm space-y-4 text-sm">
            <p className="text-lg font-semibold leading-snug">{session.app.label}</p>
            <dl className="space-y-2 border-y border-border py-3 text-xs">
              {[
                ["File", session.fileName],
                ["Package", session.app.packageName],
                ["Version", session.app.versionName ? `${session.app.versionName} (${session.app.versionCode})` : session.app.versionCode],
                ["Built for", session.app.targetSdk ? `Android API ${session.app.targetSdk}` : "Not stated"],
                ["Permissions", String(session.app.permissionCount)],
                ["Device", session.profileId.replace(/_/g, " ")],
              ].map(([term, value]) => (
                <div key={term} className="flex justify-between gap-3">
                  <dt className="text-muted">{term}</dt>
                  <dd className="min-w-0 break-all text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-muted">Click to tap, drag to swipe, scroll to scroll, and type to enter text.</p>
            <button
              type="button"
              onClick={handleStop}
              className="rounded-md border border-neutral-500 px-4 py-2 text-sm font-semibold hover:border-danger hover:text-danger focus-visible:outline-2 focus-visible:outline-accent"
            >
              Stop session
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
