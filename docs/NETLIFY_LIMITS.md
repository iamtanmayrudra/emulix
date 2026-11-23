# What runs on Netlify

Netlify runs the site as serverless functions. A function has no browser installed, stops when its response is sent,
and shares nothing with the next request. Features that need a real browser therefore cannot run there. This page says
what happens instead, and what to set.

## Summary

| Feature | On Netlify | On your own server or laptop |
| --- | --- | --- |
| Sign-up, sign-in, profile, billing demo | Works. Needs the database ([NETLIFY_LOGIN_FIX.md](NETLIFY_LOGIN_FIX.md)) | Works |
| Optimization audit (`/optimize`) | Works through Google PageSpeed Insights. **Needs `PAGESPEED_API_KEY`** | Runs Lighthouse in a local browser |
| Website testing and APK testing on live devices (`/test`, `/apk`) | Shows "Live browser testing is not available on this hosted demo" | Works with the Playwright browsers |
| Reports list | Works, but audit and session history is kept in memory per server instance, so it can appear empty | Works |

## The error you saw: "The audit could not start"

On Netlify the audit routes returned an empty 500. Every route that touches audits, test jobs, live sessions or the
reports list loaded the Playwright browser library when the route started, and a Netlify function cannot run it. The fix:

- The browser library is now loaded only when a browser is actually launched.
- A host that cannot run a browser is detected (`NETLIFY`, `AWS_LAMBDA_FUNCTION_NAME` or `VERCEL`), and the browser
  features answer with a clear message (HTTP 503, `browser_unavailable`) instead of crashing.
- Audits on such a host use PageSpeed Insights, which returns the same Lighthouse report, and finish inside the one
  request (about 10 to 25 seconds). The page shows the result when the request returns.

## Set this in Netlify

| Variable | Value |
| --- | --- |
| `PAGESPEED_API_KEY` | A free Google API key with the PageSpeed Insights API enabled |

The key is required. Google gives requests without a key a daily quota of zero, so every one is refused.

| What the audit page says | Meaning |
| --- | --- |
| "Audits are not set up on this site yet." | `PAGESPEED_API_KEY` is not set on the site. Add it and redeploy |
| "The audit service is busy. Try again in a minute." | Google refused with 429 even with a key: the key's daily quota is used up, or the PageSpeed Insights API is not enabled for its project |
| "That page could not be audited. Check the address is public and loads." | Google could not open the page. Staging sites behind a login, a password or an IP allow-list cannot be audited |
| "The audit took too long." | The page needed more than 24 seconds |

1. Open [console.cloud.google.com](https://console.cloud.google.com) and pick or create a project.
2. APIs & Services → Library → search **PageSpeed Insights API** → Enable.
3. APIs & Services → Credentials → Create credentials → API key. Restrict it to the PageSpeed Insights API.
4. Put it in Netlify → Environment variables as `PAGESPEED_API_KEY`, then redeploy.

Do not put the key in a file that is committed, and never give it a `NEXT_PUBLIC_` name.

## Limits to know about

- A Netlify function stops after its time limit. The audit gives up after 24 seconds and says it took too long. Very
  slow pages can hit that.
- The page being audited must be reachable from the internet. `localhost` and private addresses are refused, as before.
- Audit history is per server instance. Showing history on Netlify needs the history stored in the database.
- To run live device testing for real, host the app on a server that can run a browser (a container platform such as
  Render, Railway or Fly.io), or run the browser part as a separate service and call it from Netlify.

## Controls

`LIVE_BROWSER=on` makes the app use the local browser even where it looks serverless. `LIVE_BROWSER=off` forces the
PageSpeed and "not available" behaviour, which is handy for trying the hosted behaviour on your own machine.
