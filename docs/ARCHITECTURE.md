# Architecture notes

Source of truth for product scope: [../website_mobile_testing_platform_master_plan.md](../website_mobile_testing_platform_master_plan.md).
This file records what is built now and the decisions behind it.

## Current implementation (Phase 1)

```text
src/
  app/
    page.tsx              public landing (server component)
    pricing/page.tsx      plans (server component, no prices)
    (app)/layout.tsx      wraps authenticated-style screens in AppShell
    (app)/dashboard/      dashboard
    (app)/test/           website testing (client: form + viewport preview)
    (app)/apk/            APK upload checks (client; nothing is uploaded)
    (app)/optimize/       optimization studio (sample data)
    (app)/reports/        job history table
    (app)/profile/        profile, usage, billing placeholders
  components/             shared UI: AppShell, Avatar, PlanBadge, UsageMeter,
                          DeviceProfileSelector, JobStatusBadge, MockNotice, SimulationLabel
  lib/
    mock-data.ts          all prototype data, marked as mock
    entitlements.ts       client-side UI helpers only (not enforcement)
```

## Decisions made for Phase 1

- **Mock data is explicit.** Each screen that renders mock or sample data shows a `MockNotice`.
  This follows the plan rule "never claim a mock screen is connected to a real emulator/backend".
- **Simulation is labelled.** Website previews carry a `SimulationLabel`. APK screens state that
  APKs need Android infrastructure and cannot run in an iOS simulator.
- **Pro avatar ring is derived from status.** `Avatar` reads subscription status from mock user
  state, not a user-editable setting. The ring spins through a CSS `@property` angle and stops
  under `prefers-reduced-motion`. A static gradient remains as the fallback.
- **Design tokens on `:root`.** Colors are CSS variables mapped into Tailwind through `@theme inline`.
  Dark mode follows the OS by default and can be forced with `data-theme`.
- **Pages that need interaction are client components.** Server components are the default.
- **Entitlements are client-only in this phase.** `canSelectProfile` and `planForStatus` shape the UI.
  They do not protect anything. Server-side enforcement comes with the Phase 4 entitlement service.
- **No external scripts or fonts beyond `next/font` (Geist).** No live URLs are loaded in the
  website preview. Loading user-supplied pages belongs in an isolated worker (plan section 11).

## Target architecture (later phases)

Matches plan section 8. Not built yet:

- Next.js API layer with auth, entitlements, and job creation.
- Job service and queue, with the lifecycle
  `created → entitlement_checked → queued → starting → running → collecting_results → completed`
  plus `failed`, `cancelled`, `timed_out`, and `rejected`.
- Browser automation workers, audit workers, and Android emulator workers, each isolated and disposable.
- Database, object storage for artifacts, and WebSocket or SSE status updates.

Backend language, database, queue, storage, and hosting are still open (plan section 16, item 8).
