import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import { rateLimited } from "@/lib/auth/http";
import { getCurrentUser } from "@/lib/auth/runtime";
import { ApkRejected, looksLikeZip } from "@/lib/android/apk";
import { activeAndroidSession, androidRuntime, AndroidSessionFailure, startAndroidSession } from "@/lib/android/sessions";
import { PLAN_LIMITS } from "@/lib/mock-data";
import { effectiveSubscription, platformGate } from "@/lib/org/runtime";
import { dashboardTotals } from "@/lib/reports/dashboard";
import { planForUser } from "@/lib/testing/jobs";

const STATUS_BY_CODE: Record<AndroidSessionFailure["code"], number> = {
  unavailable: 503,
  concurrency_limit: 429,
  not_found: 404,
  invalid_input: 400,
  input_failed: 409,
  unknown_profile: 400,
};

const MB = 1024 * 1024;
/** The room the form's other parts take up, on top of the file. */
const FORM_OVERHEAD_BYTES = 64 * 1024;

/** Whether this server can run Android, which devices it offers, and the person's running session if they have one. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized", message: "Sign in to test an APK." }, { status: 401 });

  const support = await androidRuntime().support();
  const plan = planForUser(effectiveSubscription(user));
  const limits = { maxSizeMb: PLAN_LIMITS[plan].apkMaxSizeMb, uploadsPerPeriod: PLAN_LIMITS[plan].apkUploadsPerPeriod };
  const used = dashboardTotals(user.id).apkUploadsThisPeriod;
  const active = activeAndroidSession(user.id);

  if (!support.ok) {
    return NextResponse.json({ available: false, reason: support.reason, profiles: [], limits, used, active: null }, { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ available: true, profiles: support.profiles, limits, used, active }, { headers: { "Cache-Control": "no-store" } });
}

/** Uploads an APK and starts it on an Android emulator. The reply is immediate: the emulator comes up in the background. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized", message: "Sign in to test an APK." }, { status: 401 });

  const blocked = await platformGate(user, "POST /api/android-sessions");
  if (blocked) return blocked;

  const limited = rateLimited(`android-sessions:${user.id}`, 20, 60 * 60 * 1000);
  if (limited) return limited;

  const runtime = androidRuntime();
  const support = await runtime.support();
  if (!support.ok) return NextResponse.json({ error: "unavailable", message: support.reason }, { status: 503 });

  const plan = planForUser(effectiveSubscription(user));
  const limits = PLAN_LIMITS[plan];
  if (dashboardTotals(user.id).apkUploadsThisPeriod >= limits.apkUploadsPerPeriod) {
    return NextResponse.json(
      { error: "plan_required", message: `You have used all ${limits.apkUploadsPerPeriod} APK tests for this period on the ${plan} plan.` },
      { status: 403 },
    );
  }

  // Refuse a body that is clearly too big before reading it into memory.
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > limits.apkMaxSizeMb * MB + FORM_OVERHEAD_BYTES) {
    return NextResponse.json({ error: "too_large", message: `This file is over the ${limits.apkMaxSizeMb} MB limit on your plan.` }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_input", message: "Choose an .apk file to upload." }, { status: 400 });
  }
  const upload = form.get("file");
  const profile = form.get("profile");
  if (!(upload instanceof File) || upload.size === 0) {
    return NextResponse.json({ error: "invalid_input", message: "Choose an .apk file to upload." }, { status: 400 });
  }
  if (!upload.name.toLowerCase().endsWith(".apk")) {
    return NextResponse.json({ error: "invalid_input", message: "Only .apk files can be tested." }, { status: 400 });
  }
  if (upload.size > limits.apkMaxSizeMb * MB) {
    return NextResponse.json(
      { error: "too_large", message: `This file is ${(upload.size / MB).toFixed(1)} MB. The ${plan} plan limit is ${limits.apkMaxSizeMb} MB.` },
      { status: 413 },
    );
  }
  const bytes = Buffer.from(await upload.arrayBuffer());
  if (!looksLikeZip(bytes)) {
    return NextResponse.json({ error: "invalid_input", message: "This file is not a valid Android app." }, { status: 400 });
  }

  // The file lives under a random name, readable only by this server, until the session ends.
  const folder = path.join(tmpdir(), "emulix-apk");
  await mkdir(folder, { recursive: true, mode: 0o700 });
  const file = path.join(folder, `${randomUUID()}.apk`);
  await writeFile(file, bytes, { mode: 0o600 });

  let info;
  try {
    info = await runtime.inspect(file);
  } catch (error) {
    await unlink(file).catch(() => undefined);
    if (error instanceof ApkRejected) return NextResponse.json({ error: "invalid_input", message: error.message }, { status: 400 });
    console.error("[android] could not read the APK", error);
    return NextResponse.json({ error: "unavailable", message: "The APK could not be read on this server." }, { status: 503 });
  }
  if (!info.launchActivity) {
    await unlink(file).catch(() => undefined);
    return NextResponse.json({ error: "invalid_input", message: "This app has no screen to open, so there is nothing to test." }, { status: 400 });
  }

  try {
    const session = await startAndroidSession({
      userId: user.id,
      plan,
      profileId: typeof profile === "string" && profile ? profile : support.profiles[0].id,
      fileName: upload.name.slice(0, 120),
      file,
      info,
    });
    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    if (error instanceof AndroidSessionFailure) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: STATUS_BY_CODE[error.code] });
    }
    throw error;
  }
}
