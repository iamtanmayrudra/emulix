# Authentication, subscriptions, and payment journey

Status: **specification, not yet built.** Authentication belongs to Phase 2 and subscriptions and
payments to Phase 4 of the [master plan](../website_mobile_testing_platform_master_plan.md). Where this
document gives a concrete value (for example a password length), it is a proposed default to confirm
before build.

## 1. Summary

- Anyone can sign up for free. No card is needed for the Free plan.
- **Free users** get the basic features only.
- **Pro users** get all features included in the Pro plan (see section 5). Paid access is enforced on the
  server for every protected request, never only in the browser.
- Upgrades go through a hosted checkout page. Emulix never receives or stores card numbers.
- Access changes follow the subscription state, so a cancelled, failed, or expired payment moves the user
  back to Free without deleting their data.

"All features" means every feature Pro includes that is live on the platform. Some features, such as APK
execution, depend on infrastructure that arrives in later phases. Those features are visible to Pro users
but show a clear "not yet available" state until they ship. Pro does not mean unlimited usage: fair-use
limits still apply (plan section 4).

## 2. Accounts: sign up, sign in, and account recovery

### 2.1 Pages

| Route | Purpose |
| --- | --- |
| `/signup` | Create an account with email and password (or Google, optional) |
| `/login` | Sign in |
| `/verify-email` | Confirm email ownership; shows resend action |
| `/forgot-password` | Request a reset link |
| `/reset-password?token=…` | Set a new password from an emailed single-use token |
| `/logout` | Ends the current session (POST, not a link) |
| `/profile` | Account details, security settings, plan (existing screen, extended) |

Public routes: landing, pricing, sign-up, sign-in, password recovery, help, and security pages.
Everything under `(app)` requires a signed-in user.

### 2.2 Sign-up flow

1. User enters name, email, and password, and accepts the terms and privacy policy (required checkbox).
2. Server validates input, normalises the email (trimmed, lowercase), and checks for an existing account.
   **The response is the same whether or not the email exists**, so sign-up cannot be used to find accounts.
3. Server creates the user with `account_status = pending_verification`, stores a hashed password, and
   creates a Free subscription record with `plan = free`, `status = free`.
4. Server emails a verification link (single use, expires in 24 hours).
5. User clicks the link → account becomes `active`, and the user is signed in and sent to the dashboard.

Until verification is complete, the user can view the pricing page but cannot create jobs or start
checkout. This keeps abuse down and makes billing contact details reliable.

### 2.3 Sign-in flow

1. User submits email and password.
2. Server verifies the password with a slow hash (argon2id preferred; bcrypt acceptable).
3. On success, server creates a session and sets an `HttpOnly`, `Secure`, `SameSite=Lax` cookie.
4. On failure, the error says "Email or password is incorrect". It never says which one is wrong.
5. Repeated failures are rate-limited per account and per IP. After 10 failed attempts in 15 minutes,
   the account is temporarily locked for 15 minutes and the user is shown how to reset the password.

Sessions:
- Default lifetime: 14 days idle, 30 days absolute. "Remember me" can extend the idle window.
- Session IDs are random and stored hashed on the server. Sessions can be listed and revoked from the profile page.
- Changing a password revokes all other sessions.
- Sensitive actions (changing email, changing password, cancelling a subscription, deleting an account)
  require re-entering the password if the session is older than 15 minutes.

### 2.4 Password recovery

1. User enters email on `/forgot-password`. The response is always "If an account exists, a link has been sent."
2. If the account exists, server emails a single-use reset token valid for 30 minutes.
3. The reset page validates the token, takes a new password, and invalidates all existing sessions.

### 2.5 Password policy

- Minimum 12 characters. No forced periodic rotation.
- Check against a breached-password list (for example the k-anonymity range API of a breach database).
- No password hints and no password is ever logged, emailed, or shown back to the user.

### 2.6 Optional sign-in methods

- **Google sign-in:** supported on `/login` and `/signup`. A Google account with a verified email links to an
  existing account with that email only if the existing account was verified. Otherwise the user is asked
  to sign in with their password first.
- **Two-factor authentication (TOTP):** available to all users from the profile page. Recommended for Pro
  users, required for team workspaces when they ship (plan decision 10).

### 2.7 Account deletion

Users can delete their account from the profile page after re-authenticating. Deletion:
- Cancels any active subscription at the period end (see 3.6) and stops renewals.
- Removes personal data and reports, except records billing law requires us to keep (invoice history).
- Starts the artifact deletion job for APKs, screenshots, and logs.

## 3. Subscription model

### 3.1 Plans

| Plan | Who | Price | Notes |
| --- | --- | --- | --- |
| Free | Every signed-in, verified user | None | Basic features only, section 5 |
| Pro | Users with an active or trialing paid subscription | Not set (plan decision 4) | All Pro features, section 5 |

Only two plans exist at launch. Team or enterprise plans are out of scope for this document.

### 3.2 Subscription states

| State | Meaning | Effective plan |
| --- | --- | --- |
| `free` | No paid subscription ever started | Free |
| `trialing` | Within a free trial (if the trial policy is adopted) | Pro |
| `active` | Paid and in good standing | Pro |
| `past_due` | Renewal payment failed; in grace period | Pro during grace period, then Free |
| `cancelled` | User cancelled; access continues until the period ends | Pro until period end, then Free |
| `expired` | Period ended with no renewal, or grace period ended | Free |

The grace period for `past_due` is proposed at 7 days (decision needed). Retry payment on days 1, 3, and 7.

### 3.3 Access rules (summary)

- Pro features are allowed only when the effective plan is Pro.
- The effective plan is recalculated on every protected request from the stored subscription state and
  the current time. It is not cached in the browser or in the JWT-like claims beyond a short TTL (60 seconds).
- Dropping to Free never deletes data. Excess resources are locked, not removed (see 3.7).

### 3.4 Payment journey (upgrade)

```text
Pricing page → "Upgrade to Pro" (must be signed in and verified)
  → POST /api/billing/checkout-session   (server creates Checkout Session, returns redirect URL)
  → Hosted checkout page (payment provider collects card; Emulix never sees card data)
  → Payment succeeds → provider redirects to /billing/success?session=…
  → Provider sends webhook "subscription created / invoice paid"
  → Server verifies webhook signature, records PaymentEvent, sets subscription status = active
  → Dashboard shows Pro badge, avatar ring, and unlocked features
```

Step-by-step:

1. **Start checkout.** The user clicks "Upgrade". The server checks the user is verified and not already Pro,
   then creates a checkout session with the user's ID as the client reference. The browser is redirected to
   the provider's hosted page.
2. **Pay.** The provider collects payment details. Emulix does not receive card numbers, and the page must
   not embed card fields. Strong customer authentication (3-D Secure) is handled by the provider.
3. **Return.** The success page does not grant access by itself. It shows "Confirming your payment…" and
   polls the server until the webhook has updated the subscription (timeout after 30 seconds with a
   "We're still confirming" message and a support link).
4. **Confirm by webhook.** Access is granted only when the signed webhook arrives. Webhooks are idempotent:
   each provider event ID is stored once, and replays do nothing.
5. **Activate.** Subscription becomes `active` with the current billing period. The avatar ring starts
   animating, the plan badge changes to Pro, and Pro features unlock on the next request.
6. **Receipt.** The provider emails the invoice. Emulix links to it from the billing history on the profile page.

If the user abandons checkout, nothing changes. The pricing page shows the Free plan until a paid state is recorded.

### 3.5 Renewal and failed payment

- Renewals are charged by the provider automatically each billing period.
- On `invoice.payment_failed`, the subscription moves to `past_due`, the user gets an email with a link to
  update the payment method, and a banner appears in the app. Pro features stay on during the grace period.
- Updating the card through the provider's billing portal returns the subscription to `active`.
- When the grace period ends with no successful payment, the subscription moves to `expired` and the user
  drops to Free.

### 3.6 Cancellation

- Users cancel from the billing page. The request goes to the provider and cancellation takes effect at the
  end of the current period (no immediate cutoff, no partial refunds by default).
- The subscription shows `cancelled` with an end date. The user keeps Pro until that date.
- Users can undo cancellation before the period ends.
- Cancellation requires re-authentication (section 2.3).

### 3.7 Downgrade behaviour (Pro → Free)

When the effective plan drops to Free:

- **Reports and history are kept.** Retention follows the Free retention policy (proposed: 30 days for
  reports and artifacts, decision 9). Anything older than that is deleted by the retention job, with notice
  sent 7 days before.
- **Excess device profiles are locked, not removed.** Saved projects remain. Pro-only profiles show as locked
  if a user tries to run a test on them.
- **Running jobs finish.** Jobs started while Pro complete. New jobs are checked against Free limits.
- **Quotas drop to Free limits immediately** for new jobs. Usage already consumed in the current period stays counted.
- The user sees a notice explaining what changed and how to upgrade back.

### 3.8 Upgrading again

Reactivating restores access to locked profiles and features immediately after the webhook confirms payment.
Previously stored reports are shown again if they are still within retention.

## 4. Entitlement enforcement (server-side)

Every protected API and every job-creation path runs the same check, in this order:

1. Authenticate the session. Unauthenticated → 401.
2. Confirm the account is verified and not locked. Otherwise → 403 with a reason.
3. Load the subscription and compute the effective plan.
4. Load the entitlements for that plan (limits and feature flags).
5. Validate the request against the entitlements: profile allowed, feature allowed, file size, concurrency,
   and period quota.
6. Reserve quota atomically (a database transaction or conditional update, so two parallel requests cannot
   both use the last slot).
7. Enqueue the job. If enqueueing fails, release the reservation.
8. On completion or failure, reconcile usage and write a `UsageEvent`.

Denied requests return a stable error code with a human message, for example:

```json
{
  "error": "plan_required",
  "feature": "apk_testing",
  "message": "APK testing is available on Pro.",
  "upgradeUrl": "/pricing"
}
```

Other codes: `quota_exceeded`, `concurrency_limit`, `file_too_large`, `profile_not_in_plan`, `email_not_verified`,
`feature_not_yet_available`.

Frontend checks only decide what to show. They are never the only check.

## 5. Feature access by plan

Values are placeholders from `src/lib/mock-data.ts` (`PLAN_LIMITS`, `DEVICE_PROFILES`) until decisions 2 and 3 are made.

| Feature | Free (basic) | Pro (all features) |
| --- | --- | --- |
| Create account, sign in, reset password | Yes | Yes |
| Dashboard, history, usage meter | Yes | Yes |
| Website testing: responsive preview on selected profiles | 3 profiles | Full profile library |
| Screenshots | Basic | Advanced (full resolution, comparisons) |
| Console and network logs | Basic summary | Full logs |
| Session recordings | No | Yes |
| Website audits (performance, accessibility, SEO, best practices) | 5 per period | 100 per period |
| Optimization reports and exports | Basic report | Exports and report comparisons |
| APK testing (upload and run) | 2 uploads per period, 50 MB max, when available | 50 uploads per period, 300 MB max, when available |
| Parallel and automated runs | No | Yes, within fair-use limits |
| Report retention | 30 days (proposed) | Longer retention (proposed 12 months) |
| Concurrent sessions | 1 | Fair-use limit (proposed 5) |
| Profile picture ring and Pro badge | Standard neutral border | Animated Pro ring and badge |
| Two-factor authentication | Available | Available |
| Support | Help centre | Priority email support |

Not in either plan at launch: native iOS app execution, team workspaces, SSO, and custom SLAs (plan section 14).

## 6. Data model additions

- **User:** `id`, `email` (unique, normalised), `password_hash`, `name`, `account_status`
  (`pending_verification`, `active`, `locked`, `deleted`), `email_verified_at`, `created_at`, `last_login_at`.
- **Session:** `id` (hashed token), `user_id`, `created_at`, `last_seen_at`, `expires_at`, `ip`, `user_agent`,
  `revoked_at`.
- **Subscription:** `id`, `user_id`, `plan` (`free`, `pro`), `status` (section 3.2), `provider_customer_id`,
  `provider_subscription_id`, `current_period_start`, `current_period_end`, `cancel_at_period_end`,
  `grace_period_ends_at`, `updated_at`.
- **PaymentEvent:** `provider_event_id` (unique), `type`, `payload_hash`, `received_at`, `processed_at`, `result`.
  Used for idempotency and support diagnostics. Full card data is never stored; only provider IDs and amounts.
- **Invoice reference:** `provider_invoice_id`, `amount`, `currency`, `status`, `period`, `hosted_url`.
- **UsageEvent:** unchanged from plan section 9, plus `reserved`, `reconciled`, and `released` states.
- **AdminAuditLog:** records manual subscription changes made by staff.

## 7. API surface (proposed)

Auth:
- `POST /api/auth/signup`
- `POST /api/auth/verify-email`
- `POST /api/auth/resend-verification`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/auth/sessions` and `DELETE /api/auth/sessions/:id`
- `POST /api/auth/2fa/setup`, `POST /api/auth/2fa/verify`

Billing:
- `GET /api/billing/subscription` (current plan, status, period end, grace state)
- `GET /api/billing/entitlements` (effective limits and feature flags for the UI)
- `POST /api/billing/checkout-session` (plan = `pro`; returns the hosted checkout URL)
- `POST /api/billing/portal-session` (opens the provider's billing portal for card and invoice changes)
- `POST /api/billing/cancel` and `POST /api/billing/resume`
- `GET /api/billing/invoices`
- `POST /api/webhooks/billing` (no session auth; verified by provider signature; idempotent)

Every `/api/*` route except the public auth and webhook routes requires a valid session and runs the check in section 4.

## 8. Security requirements

- Passwords hashed with argon2id (or bcrypt with cost ≥ 12). Hashes are never returned by any API.
- Login, sign-up, and password reset are rate-limited. Responses never reveal whether an email is registered.
- Session cookies are `HttpOnly`, `Secure`, and `SameSite=Lax`. State-changing requests use CSRF protection.
- Password reset and verification tokens are random, stored hashed, single use, and time limited.
- Webhook requests are rejected unless the provider signature verifies. Events are processed once.
- The server recalculates entitlements; the browser never sends a plan level the server trusts.
- No card data, payment secrets, or session tokens appear in logs, URLs, or analytics.
- Email change requires verification of the new address before it takes effect.
- Admin changes to subscriptions are audited (`AdminAuditLog`).

## 9. Edge cases

| Case | Expected behaviour |
| --- | --- |
| Webhook arrives before the success page loads | Success page shows Pro as soon as the server reads the subscription. |
| Webhook never arrives | Success page times out after 30 s with a support message. A reconciliation job compares provider state every hour. |
| User pays twice (two checkout tabs) | Second checkout is blocked when a Pro subscription exists. If the provider still creates a duplicate, the duplicate is refunded through the provider and logged. |
| Card declined at checkout | Provider shows its error. No subscription record is created. |
| Payment fails on renewal | `past_due` with grace period, as in 3.5. |
| User deletes account while Pro | Cancel at period end, then delete data (section 2.7). No refund by default. |
| Email unverified after paying | Not possible: checkout requires a verified account. |
| Downgrade while a job is running | Running job completes. Next job uses Free limits. |
| Concurrent job requests at the last quota slot | Only one succeeds; the other gets `quota_exceeded` (atomic reservation). |
| Provider outage | New checkouts show "Billing is temporarily unavailable". Existing Pro access continues. |

## 10. Acceptance criteria

Authentication:
- A new user can sign up, verify email, and reach the dashboard.
- An unverified user cannot start checkout or create jobs.
- Login errors do not reveal whether an email exists. Login lockout works after 10 failures.
- Password reset works once per token and expires after 30 minutes.
- Changing the password signs out all other sessions.

Subscriptions:
- A Free user sees Pro features as locked with an upgrade path, and API calls to Pro features return `plan_required`.
- A Pro user (`active` or `trialing`) can use all Pro features in section 5 within stated limits.
- A `past_due` user keeps Pro until the grace period ends, then drops to Free.
- A `cancelled` user keeps Pro until the period end, then drops to Free.
- Downgrade keeps all reports and locks excess profiles without deleting them.
- Upgrading unlocks features after the webhook is processed, not before.

Security:
- Direct API calls cannot bypass plan checks (tested for every Pro feature).
- Forged or unsigned webhooks are rejected.
- Duplicate webhooks do not create duplicate subscriptions or extra access.

## 11. Testing plan

- **Unit:** entitlement calculation for each state, quota reservation and release, password policy, token expiry.
- **Integration:** signup → verify → login; reset flow; checkout session creation; webhook handling for
  created, paid, failed, cancelled, and expired events; idempotent replays.
- **Contract:** provider webhook fixtures in the provider's test mode (test keys only, never live keys in tests).
- **End-to-end (Playwright):** sign-up → verify → upgrade with a test card in test mode → Pro features unlock →
  cancel → Free after period end. Use test credentials from the local seed file only.
- **Security:** cross-user report access, quota race tests, webhook signature tests, rate-limit tests.

Use only the provider's published test cards in test mode. Never use real cards or real customer data.

## 12. Payment provider choice

Recommended: a hosted checkout and billing portal from a provider such as Stripe. Reasons:
- Card data never touches Emulix servers, which keeps the scope of PCI compliance small.
- Hosted checkout handles 3-D Secure and local payment methods.
- Built-in dunning, invoices, and a customer billing portal reduce the custom code required.

This is not yet confirmed. Plan decision 4 covers the billing provider, pricing, trial policy, and cancellation rules.

## 13. Open decisions

1. Pro price, currency, and billing periods (monthly, annual, or both).
2. Billing provider (recommended: hosted checkout with billing portal).
3. Free trial: none, or a fixed trial length with or without a card up front.
4. Grace period length for failed payments (proposed 7 days).
5. Refund policy: none by default, or pro-rated refunds on request.
6. Free report retention (proposed 30 days) and Pro retention (proposed 12 months).
7. Whether 2FA is required for Pro users.
8. Whether Google sign-in ships at launch or later.
9. Exact fair-use limits (concurrent sessions, runs per period) for Pro.

## 14. Implementation order

1. Authentication: sign-up, verification, login, sessions, password reset (Phase 2).
2. Entitlement service and quota reservation, wired to every protected route (Phase 4 start).
3. Billing integration: checkout, webhooks, state machine, portal (Phase 4).
4. Downgrade behaviour, retention jobs, and reconciliation (Phase 4).
5. Admin tooling for subscriptions and audit logs (Phase 4 to 6).

Frontend screens for these flows can be built earlier against mock data, but each must be labelled as mock
until the real API exists (plan section 17).
