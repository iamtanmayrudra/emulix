"use client";

import { useState, type ChangeEvent } from "react";
import { MockNotice } from "@/components/mock-notice";
import { usePlan } from "@/components/plan-context";
import { ANDROID_PROFILES, PLAN_LIMITS } from "@/lib/mock-data";

type SelectedFile = { name: string; sizeMb: number };

export default function ApkTestPage() {
  const { plan } = usePlan();
  const maxSizeMb = PLAN_LIMITS[plan].apkMaxSizeMb;
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [androidId, setAndroidId] = useState(ANDROID_PROFILES[0].id);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const sizeMb = file.size / (1024 * 1024);
    if (!file.name.toLowerCase().endsWith(".apk")) {
      setSelectedFile(null);
      setError("Only .apk files can be selected.");
    } else if (sizeMb > maxSizeMb) {
      setSelectedFile(null);
      setError(`This file is ${sizeMb.toFixed(1)} MB. The ${plan} plan limit is ${maxSizeMb} MB.`);
    } else {
      setError(null);
      setSelectedFile({ name: file.name, sizeMb: Number(sizeMb.toFixed(1)) });
    }
  }

  return (
    <div className="space-y-8">
      <MockNotice>
        File checks here run in the browser for convenience only. The server must validate file type, content,
        and size. Nothing is uploaded and nothing runs.
      </MockNotice>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">APK testing</h1>
        <p className="text-sm text-muted">
          Android APKs run only on Android environments. They cannot run in an iOS simulator.
        </p>
      </header>

      <section aria-labelledby="upload-heading" className="space-y-4 rounded-lg border border-border bg-surface p-5">
        <h2 id="upload-heading" className="text-base font-semibold">
          Upload APK
        </h2>
        <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-background px-4 py-8 text-center text-sm hover:border-accent">
          <span className="font-medium">Choose an .apk file</span>
          <span className="text-muted">Limit on your {plan} plan: {maxSizeMb} MB</span>
          <input type="file" accept=".apk,application/vnd.android.package-archive" className="sr-only" onChange={handleFileChange} />
        </label>

        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}
        {selectedFile && (
          <p role="status" className="text-sm text-muted">
            Selected {selectedFile.name} ({selectedFile.sizeMb} MB). Not uploaded.
          </p>
        )}
      </section>

      <section aria-labelledby="android-heading" className="space-y-4 rounded-lg border border-border bg-surface p-5">
        <h2 id="android-heading" className="text-base font-semibold">
          Android profile
        </h2>
        <div>
          <label htmlFor="android-profile" className="text-sm font-medium">
            Target
          </label>
          <select
            id="android-profile"
            value={androidId}
            onChange={(event) => setAndroidId(event.target.value)}
            className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            {ANDROID_PROFILES.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted">Android versions are not yet validated for this product.</p>
        </div>

        <button
          type="button"
          disabled
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground opacity-60"
        >
          Run APK test
        </button>
        <p className="text-xs text-muted">APK execution needs Android emulator infrastructure (Phase 5).</p>
      </section>
    </div>
  );
}
