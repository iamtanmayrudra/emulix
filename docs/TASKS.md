# Task checklist

Tracks progress against the phases in the [master plan](../website_mobile_testing_platform_master_plan.md).

## Phase 0: Definition and technical validation

- [x] Repository scaffolded and documented (README, env example, architecture notes, this checklist)
- [ ] Confirm target users, scope, and pricing assumptions
- [ ] Confirm device matrix and OS versions (see Decisions)
- [ ] Choose worker infrastructure (self-hosted emulators vs device cloud)
- [ ] Define security boundaries for untrusted URLs and APKs
- [ ] Write API contracts and acceptance criteria for Phase 2

## Phase 1: Frontend prototype

- [x] Landing page and pricing page
- [x] App shell with navigation, profile menu basics, and plan badge
- [x] Dashboard with recent jobs, quick actions, and usage meter
- [x] Website testing workspace: URL validation, device selector, simulated viewport
- [x] APK upload checks: extension and size, no upload
- [x] Optimization studio with sample scores, labelled as lab sample data
- [x] Reports table and profile/billing placeholders
- [x] Pro avatar ring derived from status, with reduced-motion fallback
- [x] Mock data labelled on every screen that uses it
- [ ] Sign-in, sign-up, password recovery, and account verification pages (needs Phase 2 auth)
- [ ] Accessibility review pass with a screen reader and keyboard only
- [ ] Responsive review at 375 px width on real screens
- [x] Run `npm run lint`, `npx tsc --noEmit`, and `npm run build` (all pass)
- [ ] Unit tests for `entitlements.ts` and the URL validation helper

## Phase 2: Website testing MVP (in progress)

- [x] Authentication: sign-up, email verification, sign-in with lockout, sessions, password reset,
  sign-out, and server-side route protection. Development storage is in memory only; see
  [AUTH_AND_SUBSCRIPTION.md](AUTH_AND_SUBSCRIPTION.md) and `src/lib/auth/`.
- [ ] Persistent database and production mail provider (blocked on plan decision 8 and a mail provider choice)
- [ ] Google sign-in and two-factor authentication (optional in the spec)
- [x] Website testing runs: URL checks that refuse private and local targets (also on every redirect and
  sub-request), headless Chromium runs with viewport and touch emulation, screenshots, console errors,
  failed and HTTP-error requests, and per-user run history. Source in `src/lib/testing/`.
- [ ] Run history persisted in the database and shown on the reports page (reports still use mock data)
- [ ] Projects
- [ ] Browser worker with isolation, timeouts, and cleanup
- [ ] Screenshots and console/network evidence
- [ ] Job queue, status updates, cancellation, report history

## Phases 3 to 6

See the master plan, section 13. Not started.

## Decisions to finalize (plan section 16)

These are still open. The prototype uses placeholders where noted.

1. Product name. Prototype uses "Emulix" (folder name). The plan lists "Emulab" as a placeholder. Check trademark and domain.
2. Free device count. Prototype uses 3 (`DEVICE_PROFILES` with `minPlan: "free"`).
3. Limits (audits, APK uploads, APK size, storage, concurrency). Prototype uses placeholders in `PLAN_LIMITS`.
4. Pro pricing, billing provider, trial policy, cancellation. Not set; no prices shown.
5. Initial browser/OS/device matrix. Android profiles are placeholders with no validated OS version.
6. Self-hosted Android emulators vs device-cloud provider.
7. Native iOS testing at MVP (plan default: defer).
8. Backend language, database, queue, storage, hosting.
9. Report retention and sharing rules.
10. Team workspaces at launch (plan default: defer).

## Known gaps in this working copy

- `npm install` reports 5 high-severity audit findings. Not yet reviewed (`npm audit`).
- A `.git` directory was copied in from the scaffold tool. The project folder was not a git repo
  before, so remove it if you do not want version control here.
