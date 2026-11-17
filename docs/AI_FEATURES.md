# AI features plan

Status: **phase 1 built** (foundation, bug-report drafting, and "Explain" in DevTools). Phases 2 to 4 are not started.
This document sets the scope, technical approach and phases. Phase 1 was built on the proposed defaults below, so the
"Decision needed" items are still open and can change the numbers or policy without a redesign. Where this document
gives a concrete value (for example a monthly allowance), it is a proposed default.

Phase 1 as built:

- `src/lib/ai/`: provider (Anthropic Messages API over `fetch`, no new dependency), redaction, evidence parsing, versioned
  prompts, monthly credits, cache, and the two features. Routes: `POST /api/ai/bug-draft` and `POST /api/ai/explain`.
- Defaults applied: Claude (Haiku 5.5 for text, Sonnet 5.5 for screenshots), Free allowance of 10 and Pro of 300 credits a
  month, redacted evidence, nothing stored. Free gets the allowance (so rule 2 below means "plan-checked", with Pro getting
  the larger allowance).
- Not done yet: the AI allowance in the dashboard and profile usage meters, and the pricing-page copy.
- Without `ANTHROPIC_API_KEY` the AI buttons show "AI features are not set up on this server yet." (see the README).

## 1. Guiding rules

1. **AI explains and drafts; it does not act.** Early features read evidence the app already collects and write text.
   Nothing changes state or drives a page.
2. **Server-side only, Pro-gated.** One place on the server checks sign-in, plan and quota, the same pattern as
   `GET /api/browser-sessions/:id/devtools`. The UI only decides what to show; it is never the only check.
3. **Page content is untrusted.** Console text, page text and URLs are data, never instructions. Tokens and query strings
   are stripped from URLs before anything reaches a model.
4. **Always labelled and optional.** Every AI output is marked "AI-generated", can be regenerated, and nothing is sent to a
   model without an explicit click.

## 2. Scope by module

| Module | AI feature | Value | Effort |
| --- | --- | --- | --- |
| Website testing: Capture a bug | Draft a bug report from the screenshot, console, network and device: title, steps to reproduce, expected vs actual, severity. It fills the existing title and description fields. | High | S |
| Website testing: DevTools | "Explain this" on a console error or failed request: what it means, likely cause, how to fix. | High | S |
| Website testing: live page | "Check this page" visual QA on the screenshot: overflow, clipped text, small tap targets, layout breaks for the chosen device. | High | M |
| Optimization (Lighthouse) | Replace the static lookup in `src/lib/audit/solutions.ts` with fixes tailored to the failing elements, with code snippets and a priority order. Add a plain-language summary of the run. | High | M |
| Reports | A summary per run, regression notes between two runs, and plain-language search ("failed runs on iPhone last week"). | Medium | M |
| Dashboard | A weekly digest: what got worse, what to fix first. | Medium | S |
| Help (public and in-app) | A help assistant that answers from the how-it-works, pricing and terms pages. | Medium | S |
| APK testing | Later, once APK execution exists: manifest and permission review, crash-log summaries. | Later | L |
| Admin and organization | Activity-log summaries and seat insights. | Low | S |
| Auth, billing, profile | No AI features. Add only an AI usage meter beside the existing usage meter. | n/a | S |

Effort: S is a few days, M about a week or two, L more than that. These are rough sizes, not estimates.

## 3. Technical plan

### 3.1 Foundation

- A new `src/lib/ai/` folder holds the provider wrapper, versioned prompt templates, the redaction step, and streaming
  helpers.
- AI routes live under `/api/ai/*`. Each route checks, in order: signed in, platform gate (`platformGate`), whether any of
  the month's allowance is left, then the per-user rate limit (`rateLimited` from `src/lib/auth/http`). The credit itself
  is spent only when the model is called, and refunded if the call fails, so a rate-limited request, a cached result or a
  failed call costs nothing. The shared checks are in `src/lib/ai/route.ts`.

### 3.2 Plan and quota

- Add `aiCreditsPerPeriod` to `PLAN_LIMITS` in `src/lib/mock-data.ts`, metered the same way as audits.
- Proposed defaults: Free about 10 per month, Pro about 300 per month. **Decision needed:** whether Free gets an allowance
  at all (see section 6).
- Show the AI allowance in the usage meter on the dashboard and profile pages.
- Responses to a refused request use the existing shape, for example `{ "error": "plan_required" }` or
  `{ "error": "quota_exceeded" }`, with `upgradeUrl`.

### 3.3 Cost control

- Use a small, cheap model for summaries and text-only explanations.
- Use a stronger vision-capable model for screenshot checks and bug triage.
- Cache results by a hash of the input, so regenerating the same evidence costs nothing.
- Cap the evidence sent. The bug capture already keeps the newest 50 of each kind, and DevTools keeps the newest 200.
- Quota the vision calls first: they are the expensive ones.

### 3.4 Privacy and data handling

- Send redacted evidence only (see rule 3 in section 1).
- Do not store prompts or outputs on the server unless the user saves them to a report.
- Update the privacy page and the terms to say what is sent to the provider and why.
- **Decision needed:** confirm the policy above and whether a per-user opt-out is required.

### 3.5 Quality

- Keep a small fixed set of real captures and audits as an evaluation set.
- Run it before every prompt or model change, and compare outputs to the previous version.
- Unit-test the redaction step and the quota checks as ordinary tests (`npm test`).

## 4. Phases

1. **Foundation and first win.** Provider wrapper, quota, redaction, plus bug-report drafting and "Explain this" in
   DevTools. Both reuse data the app already collects.
2. **Audits and visual QA.** Tailored Lighthouse fixes, "Check this page", and AI summaries on the Reports and Dashboard
   pages.
3. **Search and help.** Plain-language report search and the help assistant.
4. **Later.** APK analysis, and natural-language test steps ("log in and open the cart"). The second is agentic and needs
   its own safety design before any build.

## 5. Risks

| Risk | Mitigation |
| --- | --- |
| Prompt injection: a tested page contains text aimed at the model | Outputs are text only, with no tools or actions. Page content is passed as quoted data. |
| Wrong answers presented as fact | Show the evidence beside each suggestion, and label the output as AI-generated. |
| Cost growth from vision calls | Quota vision calls first, cache by input hash, cap evidence size. |
| Sensitive data in URLs or console output | Redact tokens and query strings before sending. Nothing is stored by default. |

## 6. Decisions needed

1. **Provider and models.** Proposed: Claude, with Haiku 5.5 for cheap text and Sonnet 5.5 for vision and triage.
2. **Free plan.** A small AI allowance for Free, or Pro-only?
3. **Data policy.** Is "send redacted evidence, store nothing unless the user saves it" acceptable?
4. **Allowance numbers.** Confirm or change the proposed 10 and 300 per month.
