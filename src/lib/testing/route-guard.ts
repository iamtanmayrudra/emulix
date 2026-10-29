import type { BrowserContext } from "playwright";
import { parseTargetUrl, resolvesToPublicAddress } from "./url-guard";

/**
 * Every request a page makes (including redirects and sub-resources) must target a public address.
 * Requests to non-public addresses are aborted, and onBlocked is told about each one.
 */
export async function guardPublicRequests(context: BrowserContext, onBlocked: (url: string) => void): Promise<void> {
  const dnsCache = new Map<string, Promise<boolean>>();
  await context.route("**/*", async (route) => {
    const requestUrl = route.request().url();
    if (!/^https?:/i.test(requestUrl)) {
      await route.continue();
      return;
    }
    const check = parseTargetUrl(requestUrl);
    if (!check.ok) {
      await route.abort("blockedbyclient");
      return;
    }
    const host = check.url.hostname;
    let allowed = dnsCache.get(host);
    if (!allowed) {
      allowed = resolvesToPublicAddress(host);
      dnsCache.set(host, allowed);
    }
    if (await allowed) {
      await route.continue();
    } else {
      onBlocked(requestUrl);
      await route.abort("blockedbyclient");
    }
  });
}
