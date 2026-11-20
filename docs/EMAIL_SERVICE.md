# Email service

Status: **built**, following [emulix-optimizer-email-service-plan.md](emulix-optimizer-email-service-plan.md). It sends the account emails through
[Resend](https://resend.com) and falls back to the server console when no key is set. The email log is kept with the
rest of the auth data ([DATABASE.md](DATABASE.md)).

## What it sends

| Email | When | Subject | Link lifetime |
| --- | --- | --- | --- |
| Verification | Sign-up, "send a new link", changing your email | Verify your Emulix Optimizer account | 1 hour |
| Password reset | "Forgot password", or a super admin sends a reset link | Reset your Emulix Optimizer password | 30 minutes |
| Welcome | The first time an address is verified | Welcome to Emulix Optimizer | none |
| Security alert | A password was changed, or an account locked after failed sign-ins | Security alert for your Emulix Optimizer account | none |

Verification and reset links are single use. Asking for a new one retires the old one, so only the newest email works.

## Setup

1. Create a Resend account and an API key.
2. Verify the sending domain in Resend (SPF, DKIM, DMARC) and pick a sender such as `auth@yourdomain.com`.
3. Put these in `.env` (local) or the host's secret store (production). They are server-only: never give them a
   `NEXT_PUBLIC_` name.

```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=Emulix Optimizer <auth@yourdomain.com>
APP_URL=https://your-production-domain.com
```

4. Restart the server. `.env` is read once at start.

| Situation | What happens |
| --- | --- |
| Key and sender set | Emails go through Resend, in every environment |
| Neither set, development | Emails are printed in the server console (`[dev mail] …`) |
| Neither set, production | Sending throws, so a missing provider is never silent |
| Key set, sender missing | A warning is logged and no email is sent through Resend |
| `APP_URL` missing in production | Each email fails and is logged as FAILED with the reason, because a link to localhost is never right. Sign-in and sign-up keep working. `NEXT_PUBLIC_APP_URL` is read as a fallback, and on Netlify its own `URL` is the last resort |

`APP_URL` must be the address the app is opened on. If something else holds port 3000 and Next moves to 3001, set it to 3001, or the links in emails open the wrong site.

While testing with Resend's sandbox sender (`onboarding@resend.dev`) a message can only go to the address that owns the Resend account.

## How it is built

```text
route  ->  auth service  ->  email service  ->  mailer  ->  Resend
                                  |
                              email log
```

| Part | Where |
| --- | --- |
| Resend client, sender config, `ResendMailer` | `src/lib/email/resend.ts` |
| Choosing Resend or the console mailer | `getMailer()` in `src/lib/auth/mailer.ts` |
| One method per email, rendering, logging | `src/lib/email/email.service.ts` |
| Templates (React Email) | `src/lib/email/templates/` |
| Token lifetimes, retiring old links, who gets which email | `src/lib/auth/service.ts` |
| Rate limits and the 502 answer | `src/app/api/auth/*`, `src/lib/auth/http.ts` |
| 30 tests | `tests/email.test.ts` |

Routes never call Resend. The browser never sees the key. To change provider, write another `Mailer` and return it from `getMailer()`.

### Behaviour worth knowing

- **Sending happens after the response** for sign-up, forgot-password and sign-in (`after()`). A slow or failing provider
  therefore changes nothing a visitor can see, so the answer is the same whether or not an address has an account.
  The cost: when the provider fails, a new user is told "check your email" and no email comes. They can sign in and
  press "Send a new verification link", which does report a failure ("Unable to send email", HTTP 502).
- **Welcome and security alert emails are best effort.** If one cannot be sent, the password change or sign-in it
  follows still succeeds.
- **Rate limits** (in memory, per server process): sign-up 10 per hour per IP, sign-in 30 per 15 minutes per IP,
  forgot-password 5 per 15 minutes per IP and 3 per 15 minutes per address, resend-verification 5 per hour per user.
  Multi-instance deployments need a shared store such as Redis.

## Email log

Every attempt writes one row: who, what kind, recipient, status, the provider's message id, and any error. It never
stores the body, because the body holds a single-use link.

`QUEUED` when the attempt starts, `SENT` when Resend accepted it, `FAILED` when it did not. `DELIVERED` exists in the
type but nothing sets it yet: that needs a Resend webhook. `findEmailLogs(userId)` on the store returns a user's rows,
newest first. There is no admin screen for it yet.

## Not built yet

- Nothing about storage: users, tokens and the email log are in Postgres when `DATABASE_URL` is set ([DATABASE.md](DATABASE.md)).
  Without it they are in memory, and restarting the server erases them.
- Resend webhooks, to move rows to `DELIVERED` and catch bounces.
- Redis rate limiting.
- Turning `EMAIL_VERIFICATION_REQUIRED` on (`src/lib/auth/policy.ts`). It is off, so people can use the app before verifying.
