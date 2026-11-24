# Running every feature on a server

Netlify cannot run a real browser, so there live device testing is unavailable and audits go through Google PageSpeed
Insights ([NETLIFY_LIMITS.md](NETLIFY_LIMITS.md)). To have **everything work like it does on your computer**, run the app
in a container on a host that can run one. The project now has a `Dockerfile` for this.

## What works there

| Feature | In the container |
| --- | --- |
| Sign-up, sign-in, billing demo | Works, with a Postgres database |
| Live device testing and the two-device view (Chrome and Safari engines) | Works: real Chromium and WebKit |
| Mac Safari 15 to 18 devices | Works: the older WebKit builds are installed in the image |
| Website tests, bug capture, DevTools | Works |
| Optimization audits | Run Lighthouse in the server's own browser. No Google key needed |

The app detects a host that can run a browser. After deploying, open `/api/health`. It must show
`"audits":{"mode":"local-browser"}`. If it says `"pagespeed"`, the host looks serverless to the app: set
`LIVE_BROWSER=on`.

## Requirements for the host

- It runs **Docker images** (Render, Railway, Fly.io, a VPS, Google Cloud Run, and similar). Netlify and Vercel do not.
- **Memory:** about 1 GB for the app plus about 400 MB per open browser. Pro accounts can hold 5, so choose **4 GB**
  for comfortable use. 2 GB works for a demo with one or two devices at a time.
- **One instance only.** Live sessions, audit jobs, rate limits and reports are kept in the server's memory. A second copy
  would not see the first one's sessions. Turn off autoscaling and set the instance count to 1.
- **A Postgres database**, as described below.

## What is in the image

`Dockerfile` starts from Microsoft's Playwright image for the same Playwright version as `package.json`, which already
holds Chromium, WebKit and their system libraries. It then installs the four older WebKit builds, runs `npm run build`, and
starts `next start` as an unprivileged user with `tini` to clear leftover browser processes.
`tests/dockerfile.test.ts` fails if the base image version and `package.json` drift apart.

Building the image takes several minutes and downloads about 1.5 GB, mostly browsers. The first build on a host is the
slow one.

## Settings

Set these as environment variables on the host. Keep every secret server-side.

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | A Postgres connection string (see below) |
| `APP_URL` | The public address of this deployment, for example `https://emulix.onrender.com`. Links in emails use it |
| `RESEND_API_KEY`, `EMAIL_FROM` | Optional. Only needed for verification and reset emails |
| `ANTHROPIC_API_KEY` | Optional. Turns on the AI bug drafts and "Explain" |
| `PORT` | Set by the host. Do not set it yourself |

`PAGESPEED_API_KEY` is **not** needed here.

## Database

The server needs a Postgres database it can reach. Any of these:

1. The host's own Postgres (Render Postgres, Railway Postgres, Fly Postgres). Easiest, and in the same network.
2. Neon, Supabase, or another hosted Postgres.
3. The Netlify database, if its connection string accepts outside connections. Try
   `netlify database status --show-credentials`. If the connection is refused, use option 1 or 2.

Create the tables and the demo account from your computer, with the new database's string in your local `.env`:

```powershell
npm run db:migrate
```

```powershell
npm run db:seed-demo
```

```powershell
npm run db:check
```

The demo account is `admin` / `admin` on the Pro plan. It is guessable. Remove it when the demo is over with
`npm run db:seed-demo -- --remove`. See [DATABASE.md](DATABASE.md).

## Deploying

The steps are the same on any container host: connect the GitHub repository, tell the host to build from the `Dockerfile`,
set the variables above, choose at least the memory above, and set the health check path to `/api/health`.

| Host | How |
| --- | --- |
| Render | New → Web Service → connect the repo → Language: **Docker** → pick an instance with at least 2 GB → add the variables → Advanced → Health Check Path `/api/health` |
| Railway | New Project → Deploy from GitHub repo. The `Dockerfile` is detected. Add the variables, add a Postgres service and copy its `DATABASE_URL`, and raise the memory limit in Settings |
| Fly.io | Install `flyctl`, then `fly launch` in the project folder (it reads the `Dockerfile`), `fly scale memory 4096`, `fly secrets set DATABASE_URL=...`. Keep one machine |

Plans, prices and screens change, so check the host's current options. The only fixed requirements are the ones above.

## Checking it

1. Open `https://<your-host>/api/health`. Expect `"database":true` and `"audits":{"mode":"local-browser",...}`.
2. Sign in as `admin` / `admin`, open **Website testing**, and start a test on a public page.
3. Press **+** beside the device and add a second one.
4. Run an audit on **Optimization**. Scores appear after about 20 to 60 seconds.

## Netlify afterwards

You can leave the Netlify site running. It keeps working in its limited mode: sign-in, and audits through PageSpeed.
If you move the domain to the container host, remove the Netlify site so people do not land on the limited one.

## Not tested here

The Docker image could not be built on the machine this was written on, because Docker was not installed. Its checks
were limited to `tests/dockerfile.test.ts` and running the same production build directly: it reported
`local-browser`, opened a live browser session, and finished a real Lighthouse audit (Performance 100, Accessibility 96,
Best Practices 100, SEO 80 on `example.com`). The first build on your host is the real test of the image. If it fails,
send the build log.
