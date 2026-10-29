# Master Plan: Website & Mobile App Testing and Optimization Platform

**Working name:** Emulab (placeholder; check trademark and domain
availability)\
**Frontend stack:** React, Next.js, TypeScript, Tailwind CSS

## 1. Product Vision

Build a platform for developers, designers, and QA teams to test
websites across device profiles, test Android APKs, audit website
quality, and manage results from one workspace.

Core capabilities: - Responsive website preview across selected mobile
and desktop profiles. - Real browser testing with screenshots, console
output, and network evidence. - Android APK upload, installation,
launch, and test evidence on supported Android environments. - Website
optimization audits for performance, Core Web Vitals, accessibility,
SEO, and best practices. - Free and Pro subscriptions with
server-enforced feature and usage limits. - User profile, projects, job
history, reports, usage, and subscription management.

**Platform accuracy:** A viewport preview is not the same as running on
a genuine device or operating system. Android APK execution needs
Android emulator/device infrastructure. Native iOS app execution needs
compatible macOS/Xcode simulator infrastructure or a supported device
provider. Clearly label simulated and real execution.

## 2. Goals and Success Metrics

Goals: - Make it easy to start a test from a URL or APK. - Reproduce
device-specific layout and behavior issues. - Provide useful, shareable
reports with actionable findings. - Make Free limits understandable and
Pro upgrades clear. - Build a secure, scalable job-execution
architecture.

Track first-test completion, job success rate, queue time, report
usefulness, Free-to-Pro conversion, Pro retention, cost per job, worker
failures, and security incidents. Set targets after establishing
baselines.

## 3. Users and Use Cases

Target users: frontend/full-stack developers, QA engineers, designers,
agencies, product teams, and Android developers.

Main use cases: - Test a React or Next.js website at multiple viewport
sizes. - Compare layouts across browser/device profiles. - Capture
screenshots and inspect console/network errors. - Upload an APK and test
it on a supported Android profile. - Run website audits and prioritize
fixes. - Save, compare, export, and share reports. - Upgrade to Pro for
more profiles and advanced tools.

## 4. Free and Pro Plans

### Free plan --- proposed starting point

-   A curated set of **2--5 device profiles**; choose the exact number
    before launch.
-   Basic responsive website preview.
-   Limited website audit runs.
-   Basic screenshots and reports.
-   Limited APK testing, subject to infrastructure availability.
-   Basic history and a usage meter.
-   Pro-only features visible as locked, with explanations and an
    upgrade path.

### Pro plan --- proposed benefits

-   Full supported device and OS profile library.
-   Higher quotas and longer sessions.
-   Website testing and optimization features.
-   Android APK testing on supported infrastructure.
-   Supported iOS web testing; native iOS app testing only when
    compatible infrastructure exists.
-   Advanced screenshots, recordings, logs, and reports.
-   Automated and parallel runs within stated fair-use limits.
-   Longer history, exports, and report comparisons.

Do not promise literally unlimited emulator usage. Set transparent
limits for concurrent sessions, emulator minutes, storage, and other
expensive resources.

### Central entitlements and enforcement

Configurable limits should include: - Device profiles available. - Jobs
and audits per billing period. - Concurrent sessions and session
duration. - Emulator/device minutes. - APK upload size. - Report
retention and artifact storage. - Automation and parallel execution.

For every protected request: authenticate the user; load current
subscription and entitlements; validate quota, concurrency, file size,
and platform; reserve quota; enqueue the job if allowed; reconcile usage
after completion/failure; log the usage event. If denied, return a clear
reason and appropriate upgrade or quota message.

**Security rule:** frontend-only locking is not enough. Enforce plan
access on every protected API and job-creation path.

Plan for subscription states such as `free`, `trialing`, `active`,
`past_due`, `cancelled`, and `expired`. Define downgrade,
failed-payment, cancellation, and report-retention behavior.

## 5. Animated Profile Picture Border

-   **Free:** standard avatar with a subtle neutral border.
-   **Pro:** smooth animated gradient ring around the profile picture,
    plus a Pro label or crown indicator.
-   The profile menu shows plan, subscription status, usage, and
    manage-plan links.
-   Derive the animation from authenticated subscription status, not a
    client-editable setting.
-   Respect `prefers-reduced-motion`, maintain contrast, and provide a
    non-animated fallback.

## 6. Product Pages and Modules

### Public website

Landing page, feature overview, pricing, help/security pages, sign-up,
sign-in, password recovery, and account verification.

### Dashboard

Recent jobs, job statuses, quick actions (test URL, upload APK, run
audit), recent reports, usage meter, plan label, and clear
empty/loading/error states.

### Website testing workspace

URL validation, device/browser selector, clear simulated-versus-real
labels, interactive session where supported, reload/rotate/navigation
controls where supported, screenshots, console/network logs, recordings,
and saved sessions.

### APK testing workspace

APK upload and progress, file/package validation, Android version/device
selection, job status, install/launch results, screenshots, logs, crash
evidence, retry actions, and automatic cleanup. An APK must not be
presented as runnable in an iOS simulator.

### Optimization studio

Performance audit, Core Web Vitals (LCP, INP, CLS where supported),
accessibility, SEO, best practices, asset/image suggestions, prioritized
issues, evidence, suggested fixes, and before/after reports. Distinguish
lab measurements from field/user data.

### Reports and history

Job metadata, platform/profile, screenshots, logs, audit findings,
filters, comparisons, exports/sharing with access controls, and
documented retention rules.

### Profile and billing

Profile picture, account details, current plan, subscription status,
usage, billing history, subscription management, and security settings.

### Admin workspace

User/subscription lookup, configurable plan limits, queue and worker
health, diagnostics, abuse flags, usage/cost reporting, and
administrative audit logs.

## 7. Technology Stack

### Frontend

-   **React** for reusable components and interactive UI.
-   **Next.js + TypeScript** for routing, public pages, authenticated
    app structure, and server-side API/orchestration integration.
-   **Tailwind CSS** for responsive styling and design tokens.
-   A consistent component system for forms, dialogs, tables, dropdowns,
    alerts, badges, and usage indicators.
-   CSS animation for the Pro avatar ring, with reduced-motion support.

### Execution services

Do not run full emulators inside the browser or ordinary frontend server
process. Use separate workers/services for: - Browser automation and
website screenshots. - Website audits. - Android emulator/device jobs. -
Native iOS testing through compatible macOS/Xcode or a supported
provider, if added. - Queueing, session orchestration, artifacts, and
real-time status/log updates.

Use a database for users, plans, jobs, usage, and reports; a queue for
jobs; object storage for screenshots, recordings, and artifacts; and
WebSockets or server-sent events where live updates are useful. Choose
the backend language, database, queue, and hosting after validating team
skills, cost, and workload.

## 8. High-Level Architecture

``` text
User
  |
  v
Next.js + React + TypeScript + Tailwind CSS
  |
  v
Application API / Authentication / Entitlements
  |
  +--> Project and Job Service
  |       |
  |       v
  |    Session Orchestrator + Job Queue
  |       +--> Browser Automation Workers
  |       +--> Website Audit Workers
  |       +--> Android Emulator / Device Workers
  |       +--> iOS Simulator / Device Provider (later)
  |
  +--> Subscription and Usage Service
  |
  +--> Reports and Artifact Service
          +--> Database
          +--> Object Storage
          +--> Logs and Monitoring
```

Job lifecycle:
`created → entitlement_checked → queued → starting → running → collecting_results → completed`.
Include explicit `failed`, `cancelled`, `timed_out`, and `rejected`
states. Record transitions for support and diagnostics.

## 9. Initial Data Model

-   **User:** identity, profile, account status, timestamps.
-   **Subscription:** user/workspace, plan, status, billing period,
    provider reference.
-   **Plan:** plan name and public description.
-   **Entitlement:** feature key, limit/value, enforcement behavior.
-   **UsageEvent:** resource, quantity, job, user/workspace, timestamp.
-   **Project:** owner/workspace, name, settings.
-   **DeviceProfile:** platform, OS version, viewport/hardware metadata,
    availability.
-   **TestJob:** type, requester, project, status, profile, timestamps,
    failure reason.
-   **JobArtifact:** screenshots, recordings, logs, report references,
    retention metadata.
-   **AuditReport:** scores, findings, measurements, recommendations.
-   **Workspace/Membership:** optional foundation for team support.
-   **AdminAuditLog:** sensitive administrative changes.

Keep secrets and payment credentials server-side and out of client
bundles and logs.

## 10. UX and Design System

Design principles: - Professional developer-tool interface with clear
hierarchy. - Responsive workspace and consistent spacing, typography,
color, radius, and elevation tokens. - Clear job states and useful
loading, empty, success, and error screens. - Common actions visible:
start test, select device, view report, check usage.

Reusable components: - App shell, sidebar, top navigation, profile menu,
plan badge. - Avatar with Free/Pro state and usage meter. -
Device-profile card and selector. - URL form and APK upload/dropzone. -
Job table/status badge and session viewport. - Log viewer, screenshot
gallery, audit score card, issue list. - Pricing cards, upgrade modal,
quota warning, report controls.

Implementation sequence: define navigation and page goals; create design
tokens; wireframe key flows; validate dashboard, test workspace,
reports, pricing, and profile; build with React/Next.js/Tailwind;
connect real API states; review accessibility and usability.

## 11. Security, Privacy, and Reliability

The system processes untrusted URLs and APK files. Isolation is a
release requirement.

-   Execute browsers/emulators in isolated, disposable workers.
-   Enforce CPU, memory, disk, runtime, and concurrency limits.
-   Validate file type and size; do not trust filenames or MIME types
    alone.
-   Scan files where appropriate and enforce retention/deletion rules.
-   Restrict worker network access to reduce SSRF, private-network, and
    metadata-service risks.
-   Control redirects and block unsafe protocols/destinations.
-   Isolate jobs and artifacts between users.
-   Use short-lived credentials and signed artifact links where
    appropriate.
-   Enforce authorization, ownership, and quotas on the server.
-   Keep secrets and sensitive page content out of logs.
-   Implement timeouts, cancellation, cleanup, and orphan-worker
    recovery.
-   Add rate limits, abuse detection, audit logs, and monitoring.
-   Publish clear privacy and artifact-retention policies.

Security tests must include malicious APKs, hostile URLs, oversized
uploads, quota bypass, cross-user report access, and worker isolation.

## 12. Testing and QA

### Frontend

Unit tests for plan badges, usage meters, entitlements, forms, and
status components; component tests for dialogs/selectors/uploads;
integration tests for protected routes; end-to-end tests for sign-up →
create job → status → report → upgrade; accessibility and responsive
checks.

### Backend/infrastructure

Test entitlements, concurrent quota reservations, reconciliation, queue
retry, timeout, cancellation, cleanup, worker recovery, artifact
ownership, retention, uploads, and subscription
activation/renewal/downgrade/expiry/payment failures.

### Platform

Maintain a validated matrix of browsers, device profiles, OS versions,
and known limitations. Test website rendering, reproducible screenshots,
Android install/launch/logs/crashes, audit repeatability, and
simulated-versus-real labels. Advertise only validated combinations.

## 13. Phased Roadmap

### Phase 0 --- Definition and technical validation

Confirm target users, product scope, pricing assumptions, device matrix,
worker infrastructure, security boundaries, user flows, data model, API
contracts, and acceptance criteria.

**Exit:** approved scope, architecture decisions, prototype plan, and
measurable MVP requirements.

### Phase 1 --- Frontend prototype

Build with React, Next.js, TypeScript, and Tailwind CSS: -
Landing/pricing pages, sign-in, dashboard, and navigation. - Device
selector and clearly labelled simulated preview. - APK upload interface
and report screens. - Free/Pro plan presentation, usage meter, locked
features, and animated Pro avatar border.

Mock data must be clearly identified as mock data.

**Exit:** responsive prototype, reusable components, validated flows,
and design/accessibility review.

### Phase 2 --- Website testing MVP

Add authentication, projects, secure browser workers, URL validation,
device selection, screenshots, basic console/network evidence,
queue/status updates, cancellation, timeouts, and report history.

**Exit:** a user can submit a URL, run a real browser test, and retrieve
a real report.

### Phase 3 --- Optimization and reports

Add audits, performance/accessibility/SEO findings, supported Core Web
Vitals measurements, prioritized recommendations, exports, and report
comparisons.

**Exit:** repeatable audits with actionable findings and transparent
measurement methodology.

### Phase 4 --- Subscription and Pro enforcement

Add central entitlements, billing integration, usage metering,
concurrency controls, quota reconciliation, upgrade UX, and
subscription-driven avatar status.

**Exit:** limits cannot be bypassed through direct API calls;
subscription transitions pass end-to-end tests.

### Phase 5 --- Android APK testing

Add secure upload, package validation, Android workers, install/launch,
screenshots/logs, failure diagnosis, cleanup, and emulator-minute
quotas.

**Exit:** supported APKs execute in isolated Android environments with
reliable evidence and cleanup.

### Phase 6 --- iOS and advanced testing

Expand iOS web coverage; consider native iOS execution through
compatible infrastructure; add test scripts, parallel runs, scheduled
regressions, and team workspaces based on demand and cost.

**Exit:** every advertised platform combination has validated execution,
cost, security, and QA coverage.

## 14. MVP: Build First vs. Defer

### Build first

-   React + Next.js + TypeScript + Tailwind CSS.
-   Authentication, dashboard, and project structure.
-   Website testing using a small validated profile set.
-   Real browser screenshots and basic test results.
-   Basic audit and report history.
-   Free/Pro entitlement foundation, usage meter, locked-feature UX, and
    Pro avatar animation.
-   Secure queue, timeouts, and worker cleanup.

### Defer

-   Very large device library.
-   Native iOS app execution until infrastructure is validated.
-   Unlimited parallel sessions.
-   Complex test scripting and large-scale scheduled regressions.
-   Enterprise SSO, advanced team administration, and custom SLAs.
-   Claims of full real-device fidelity when using simulation.

Deliver a dependable end-to-end workflow before expanding platform
coverage.

## 15. Definition of Done

A feature is complete when: - User goal and acceptance criteria are
documented. - UI follows agreed React/Next.js/TypeScript/Tailwind
conventions. - Loading, empty, success, error, and limit states are
handled. - Server-side authorization and entitlement checks are
present. - Appropriate unit, integration, and end-to-end tests pass. -
Accessibility and responsive behavior are reviewed. - Logs and errors
are actionable without exposing secrets. - Documentation and
supported-platform claims are updated. - Security, timeout, and cleanup
requirements are met.

## 16. Decisions to Finalize

1.  Product name and branding.
2.  Exact Free device count within the proposed 2--5 range.
3.  Job, audit, emulator-minute, upload-size, storage, and concurrency
    limits.
4.  Pro pricing, billing provider, trial policy, and cancellation
    behavior.
5.  Initial browser/OS/device matrix.
6.  Self-hosted Android emulators versus a device-cloud provider.
7.  Whether native iOS testing is required at MVP.
8.  Backend language, database, queue, storage, and deployment provider.
9.  Report retention and sharing rules.
10. Whether team workspaces are required at launch.

## 17. Rules for AI Coding Tools

When using Codex CLI or another coding assistant: - Treat this plan as
the product source of truth. - Break work into small, reviewable tasks
and phases. - Inspect the repository before editing. - Maintain a
README, environment example, architecture notes, and task checklist. -
Never commit real secrets. - Never claim a mock screen is connected to a
real emulator/backend. - Add tests alongside functionality. - Run lint,
type checks, tests, and production builds before completing a task. -
Review diffs and use small, descriptive Git commits. - Document
decisions and deviations.

## Final Product Principle

Build a trustworthy testing and optimization platform---not merely an
emulator mockup. Start with a polished Next.js frontend and a working
website-testing workflow, enforce Free/Pro access centrally on the
server, and add real Android and iOS execution only when the
infrastructure can support it safely and reliably.
