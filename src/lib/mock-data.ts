/**
 * MOCK DATA: Phase 1 frontend prototype only.
 * Nothing here is connected to a backend, browser worker, or Android emulator.
 * Every screen that renders this data must show a mock-data notice.
 * Plan limits are illustrative placeholders until the decisions in docs/TASKS.md are made.
 */

export type Plan = "free" | "pro";

export type SubscriptionStatus =
  | "free"
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired";

export type DeviceProfile = {
  id: string;
  name: string;
  kind: "mobile" | "tablet" | "desktop";
  width: number;
  height: number;
  /** Lowest plan that may select this profile. */
  minPlan: Plan;
  /**
   * Browser engine for live sessions. Safari profiles use a WebKit build; everything else uses Chromium.
   * Each WebKit id maps to a Safari release (see lib/testing/webkit-engines.ts).
   */
  engine?: "chromium" | "webkit" | "webkit-18" | "webkit-17" | "webkit-16" | "webkit-15";
};

export type JobStatus =
  | "created"
  | "entitlement_checked"
  | "queued"
  | "starting"
  | "running"
  | "collecting_results"
  | "completed"
  | "failed"
  | "cancelled"
  | "timed_out"
  | "rejected";

export type JobType = "website" | "audit" | "apk";

export type TestJob = {
  id: string;
  type: JobType;
  target: string;
  profile: string;
  status: JobStatus;
  startedAt: string;
};

export const MOCK_USER = {
  name: "Demo User",
  email: "demo@example.com",
  subscription: "free" as SubscriptionStatus,
};

export const PLAN_LIMITS: Record<
  Plan,
  { auditsPerPeriod: number; apkUploadsPerPeriod: number; apkMaxSizeMb: number }
> = {
  free: { auditsPerPeriod: 5, apkUploadsPerPeriod: 2, apkMaxSizeMb: 50 },
  pro: { auditsPerPeriod: 100, apkUploadsPerPeriod: 50, apkMaxSizeMb: 300 },
};

export const MOCK_USAGE = { auditsUsed: 3, apkUploadsUsed: 0 };

export const DEVICE_PROFILES: DeviceProfile[] = [
  { id: "iphone-14", name: "iPhone 14", kind: "mobile", width: 390, height: 844, minPlan: "free" },
  { id: "pixel-7", name: "Pixel 7", kind: "mobile", width: 412, height: 915, minPlan: "free" },
  { id: "desktop-1280", name: "Desktop 1280", kind: "desktop", width: 1280, height: 800, minPlan: "free" },
  { id: "iphone-se", name: "iPhone SE", kind: "mobile", width: 375, height: 667, minPlan: "pro" },
  { id: "galaxy-s23", name: "Galaxy S23", kind: "mobile", width: 360, height: 780, minPlan: "pro" },
  { id: "ipad-air", name: "iPad Air", kind: "tablet", width: 820, height: 1180, minPlan: "pro" },
  { id: "galaxy-tab-s9", name: "Galaxy Tab S9", kind: "tablet", width: 800, height: 1280, minPlan: "pro" },
  // More Android devices. Viewport sizes are approximate CSS sizes for the demo; confirm before relying on them.
  { id: "pixel-8", name: "Pixel 8", kind: "mobile", width: 412, height: 915, minPlan: "pro" },
  { id: "pixel-8-pro", name: "Pixel 8 Pro", kind: "mobile", width: 448, height: 998, minPlan: "pro" },
  { id: "pixel-tablet", name: "Pixel Tablet", kind: "tablet", width: 800, height: 1280, minPlan: "pro" },
  { id: "oneplus-12", name: "OnePlus 12", kind: "mobile", width: 412, height: 919, minPlan: "pro" },
  { id: "galaxy-s24", name: "Galaxy S24", kind: "mobile", width: 360, height: 780, minPlan: "pro" },
  { id: "galaxy-s24-ultra", name: "Galaxy S24 Ultra", kind: "mobile", width: 412, height: 915, minPlan: "pro" },
  { id: "galaxy-a54", name: "Galaxy A54", kind: "mobile", width: 412, height: 915, minPlan: "pro" },
  { id: "galaxy-tab-s8", name: "Galaxy Tab S8", kind: "tablet", width: 800, height: 1280, minPlan: "pro" },
  { id: "xiaomi-14", name: "Xiaomi 14", kind: "mobile", width: 393, height: 852, minPlan: "pro" },
  { id: "nothing-phone-2", name: "Nothing Phone (2)", kind: "mobile", width: 412, height: 915, minPlan: "pro" },
  { id: "laptop-1366", name: "Laptop 1366", kind: "desktop", width: 1366, height: 768, minPlan: "pro" },
  { id: "desktop-1440", name: "Desktop 1440", kind: "desktop", width: 1440, height: 900, minPlan: "pro" },
  // Mac Safari versions. Live sessions run in the WebKit build for each version (see lib/testing/webkit-engines.ts).
  { id: "mac-safari-26", name: "Mac Safari 26", kind: "desktop", width: 1440, height: 900, minPlan: "pro", engine: "webkit" },
  { id: "mac-safari-18", name: "Mac Safari 18", kind: "desktop", width: 1440, height: 900, minPlan: "pro", engine: "webkit-18" },
  { id: "mac-safari-17", name: "Mac Safari 17", kind: "desktop", width: 1440, height: 900, minPlan: "pro", engine: "webkit-17" },
  { id: "mac-safari-16", name: "Mac Safari 16", kind: "desktop", width: 1440, height: 900, minPlan: "pro", engine: "webkit-16" },
  { id: "mac-safari-15", name: "Mac Safari 15", kind: "desktop", width: 1440, height: 900, minPlan: "pro", engine: "webkit-15" },
  // Latest iPhone and iPad models. Viewport sizes are approximate CSS sizes for the demo; confirm before relying on them.
  { id: "iphone-17-pro-max", name: "iPhone 17 Pro Max", kind: "mobile", width: 440, height: 956, minPlan: "pro" },
  { id: "iphone-17-pro", name: "iPhone 17 Pro", kind: "mobile", width: 402, height: 874, minPlan: "pro" },
  { id: "iphone-17", name: "iPhone 17", kind: "mobile", width: 402, height: 874, minPlan: "pro" },
  { id: "iphone-air", name: "iPhone Air", kind: "mobile", width: 420, height: 912, minPlan: "pro" },
  { id: "iphone-16-pro-max", name: "iPhone 16 Pro Max", kind: "mobile", width: 440, height: 956, minPlan: "pro" },
  { id: "iphone-16-pro", name: "iPhone 16 Pro", kind: "mobile", width: 402, height: 874, minPlan: "pro" },
  { id: "iphone-16-plus", name: "iPhone 16 Plus", kind: "mobile", width: 430, height: 932, minPlan: "pro" },
  { id: "iphone-16", name: "iPhone 16", kind: "mobile", width: 393, height: 852, minPlan: "pro" },
  { id: "ipad-pro-13", name: "iPad Pro 13\"", kind: "tablet", width: 1032, height: 1376, minPlan: "pro" },
  { id: "ipad-pro-11", name: "iPad Pro 11\"", kind: "tablet", width: 834, height: 1210, minPlan: "pro" },
  { id: "ipad-air-13", name: "iPad Air 13\"", kind: "tablet", width: 1024, height: 1366, minPlan: "pro" },
  { id: "ipad-11", name: "iPad 11\"", kind: "tablet", width: 820, height: 1180, minPlan: "pro" },
  { id: "ipad-mini", name: "iPad mini", kind: "tablet", width: 744, height: 1133, minPlan: "pro" },
];

/** Android profiles are placeholders; no OS version is validated yet. */
export const ANDROID_PROFILES = [
  { id: "pixel-7-android-placeholder", label: "Pixel 7, Android (version TBD)" },
  { id: "galaxy-s23-android-placeholder", label: "Galaxy S23, Android (version TBD)" },
];

export const MOCK_JOBS: TestJob[] = [
  { id: "job_1042", type: "website", target: "https://example.com", profile: "iPhone 14", status: "completed", startedAt: "2026-10-14 16:20" },
  { id: "job_1041", type: "audit", target: "https://example.com/pricing", profile: "Desktop 1280", status: "completed", startedAt: "2026-10-14 11:05" },
  { id: "job_1040", type: "apk", target: "sample-app.apk", profile: "Pixel 7, Android (version TBD)", status: "rejected", startedAt: "2026-10-13 09:42" },
  { id: "job_1039", type: "website", target: "https://example.org/login", profile: "Pixel 7", status: "timed_out", startedAt: "2026-10-12 18:10" },
];
