/**
 * Whether this server can run a real browser (Playwright Chromium and WebKit, and Lighthouse on top of it).
 *
 * Serverless hosts such as Netlify and Vercel cannot: there is no browser binary, a function stops when its response
 * ends, and a live browser session needs a process that stays up. On those hosts the browser features answer with a
 * clear message instead of crashing, and audits use the PageSpeed Insights service instead (src/lib/audit/pagespeed.ts).
 *
 * LIVE_BROWSER=on forces it on, LIVE_BROWSER=off forces it off. Otherwise it is off on a detected serverless host.
 */
export function hasLocalBrowser(env: Record<string, string | undefined> = process.env): boolean {
  const setting = env.LIVE_BROWSER?.trim().toLowerCase();
  if (setting === "on") return true;
  if (setting === "off") return false;
  return !isServerlessHost(env);
}

/** Netlify, AWS Lambda and Vercel run each request in a short-lived function: no browser, no emulator, no memory kept. */
export function isServerlessHost(env: Record<string, string | undefined> = process.env): boolean {
  return env.NETLIFY === "true" || Boolean(env.AWS_LAMBDA_FUNCTION_NAME) || Boolean(env.VERCEL);
}

export const BROWSER_UNAVAILABLE_MESSAGE =
  "Live browser testing is not available on this hosted demo. It needs a server that can run a browser.";
