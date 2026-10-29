# Emulix

Website and mobile app testing and optimization platform. The product plan is in
[website_mobile_testing_platform_master_plan.md](website_mobile_testing_platform_master_plan.md).

**Current state: website testing MVP in development.** Live browsers, Lighthouse audits, and sign-in work.
Storage, email, billing, and APK testing are still stand-ins. See [Services](#services) for what is real.

## What it does

- **Website testing:** open a public page in a live browser inside a device frame (iPhone, iPad, Android
  phones and tablets, laptops, desktops, and Mac Safari 15 to 26). Click, scroll, type, and use the
  back, forward, reload, and address controls.
- **Optimization studio:** run a Lighthouse audit on any public page, with no sign-in needed. It returns
  scores, Core Web Vitals, and ranked findings, each with the failing items, fix steps, a code example,
  and a link to the guide.
- **Accounts:** sign-up, email verification, sign-in with lockout, password reset, and protected routes.
- **Dashboard:** plan, usage, recent jobs, and quick actions.

## Services

| Feature | Service used | Status |
| --- | --- | --- |
| App and pages | Next.js 16 (App Router), React 19, Tailwind CSS 4, TypeScript | Real |
| Live device browser | Playwright with Chromium for iOS, Android, and desktop devices | Real, runs on the app's own server |
| Mac Safari versions | Playwright WebKit (current build for Safari 26) and older Playwright packages for Safari 18, 17, 16, and 15 | Real, runs on the app's own server |
| Website audit | Lighthouse 13, driven through Playwright's Chromium | Real |
| Protection for tested sites | Own code: refuses local and private addresses, plus a filtering proxy for Lighthouse | Real |
| Accounts and sessions | Own code: password hashing (scrypt), sessions, lockout, rate limiting | Works, but stored in memory and lost on restart |
| Verification and reset emails | Development mailer that prints each email to the server console | Stand-in. No email provider chosen. |
| Billing and checkout | Simulated checkout: card checks run in the browser, and the upgrade call only changes the plan | Stand-in. No payment provider chosen. |
| Plans and limits | Own rules (Free: 1 live browser, Pro: 5) | Real rules, placeholder numbers |
| Dashboard jobs and usage | Sample data in `src/lib/mock-data.ts` | Stand-in |
| APK testing | UI only. Nothing runs an Android emulator or device. | Not built |
| Device photos | Two CC0 frames (iPhone SE, iPad Air). Every other device is drawn in code. | Mixed |

### Needed before production

These are decisions for the project owner. Nothing here is chosen yet.

- A **database** to replace the in-memory store in `src/lib/auth/store.ts`.
- An **email provider** for verification and reset emails.
- A **payment provider** to replace the simulated checkout.
- **Hosting that can run browsers** (heavy and long-lived), with a job queue.
- An **Android emulator or device farm** for APK testing.
- **Shared rate limiting**, such as Redis. It is kept in process memory now.

## Getting started

```bash
npm install
npx playwright install chromium webkit
```

Playwright needs its browser binaries. The older Safari versions use their own Playwright packages
(`playwright-webkit-15` to `playwright-webkit-18`), each with its own WebKit build:

```bash
node node_modules/playwright-webkit-15/cli.js install webkit
node node_modules/playwright-webkit-16/cli.js install webkit
node node_modules/playwright-webkit-17/cli.js install webkit
node node_modules/playwright-webkit-18/cli.js install webkit
```

Then start the app:

```bash
npm run dev
```

Open http://localhost:3000. In development only, a seeded account signs in with the login `admin` and the
password `admin`. It has Pro so every device can be tested. It is never created in production.

## Routes

| Route | Screen | Sign-in |
| --- | --- | --- |
| `/` | Landing page | No |
| `/pricing` | Free and Pro plans | No |
| `/optimize` | Optimization studio (Lighthouse audits) | No |
| `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email` | Account pages | No |
| `/dashboard` | Plan, usage, recent jobs, quick actions | Yes |
| `/test` | Website testing with live device browsers | Yes |
| `/apk` | APK upload checks (nothing is uploaded or run) | Yes |
| `/reports` | Job history | Yes |
| `/profile`, `/checkout` | Profile, billing, and the simulated checkout | Yes |

## Device photos

Devices are drawn in code by default. To show a real photo or render with a live browser inside it, add the image
to `public/device-frames/` and run `npm run frames`. See [public/device-frames/README.md](public/device-frames/README.md)
for naming, how the screen is found, and the licensing note.

## Theming and brand

The palette comes from the logo and is defined once in `src/app/globals.css`.

| Token | Value | Use |
| --- | --- | --- |
| `brand-blue` | `#2f7bf5` | Gradient start, tiles, glows |
| `brand-violet` | `#6b3df0` | Main accent (`--accent` in light mode), links, primary buttons |
| `brand-fuchsia` | `#c026d3` | Gradient end, Pro plan (`--pro`) |
| `brand-amber` | `#fbbf24` | The "live" spark in the logo, sparing highlights |
| `brand-ink`, `brand-deep`, `brand-plum` | `#0d0f2e`, `#1d1560`, `#3b1668` | Header and dark hero backgrounds |

- Use `--accent` and `--pro` (the `text-accent` and `bg-accent` classes) for text and buttons. They lighten in dark mode.
- Use the `brand-*` colours for gradients and decoration, for example `from-brand-blue to-brand-violet`.
- Success, warning and danger stay green, amber and red, because they carry meaning.
- Logo and icon files are generated by `npm run brand`. Change the colours in `scripts/build-brand-assets.mjs` as well.

## Checks

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

`npm test` skips the live-browser tests by default. Set `LIVE_TEST=1` to run them.
`src/components/theme-toggle.tsx` has a known lint error that predates this work.

## Important limits

- Live browser sessions close after 3 minutes without input and after 15 minutes in total.
  Free accounts get 1 live browser at a time and Pro gets 5. Launches are limited to 90 per hour.
- Only public `http` and `https` addresses on the standard web ports can be tested. Local and private
  addresses are refused, including on redirects and sub-requests.
- Mac Safari entries run real WebKit builds. Only the iPhone SE and iPad Air have real device photos so far; add more as described under Device photos.
  The device frames around the other devices are drawn.
- WebKit has no screencast protocol, so Safari sessions stream screenshots about four times a second.
- Device sizes, plan limits, and device counts in `src/lib/mock-data.ts` are placeholders.
- Entitlement checks in `src/lib/entitlements.ts` also shape the UI. The server enforces them.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/TASKS.md](docs/TASKS.md), and
[docs/AUTH_AND_SUBSCRIPTION.md](docs/AUTH_AND_SUBSCRIPTION.md) for the architecture, task checklist,
and the sign-up, sign-in, subscription, and payment design.
