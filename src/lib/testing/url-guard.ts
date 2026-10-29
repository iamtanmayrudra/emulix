import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const MAX_URL_LENGTH = 2048;
const ALLOWED_PORTS = new Set(["", "80", "443", "8080", "8443"]);

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: string };

/** Syntax checks only. Network checks happen in resolvesToPublicAddress. */
export function parseTargetUrl(input: string): UrlCheck {
  const value = input.trim();
  if (!value) return { ok: false, reason: "Enter a website address." };
  if (value.length > MAX_URL_LENGTH) return { ok: false, reason: "That address is too long." };

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: "Enter a full address, including https://." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "Only http and https addresses can be tested." };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "Addresses with a username or password are not allowed." };
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    return { ok: false, reason: "Only the standard web ports (80, 443, 8080, 8443) can be tested." };
  }
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    return { ok: false, reason: "Local addresses cannot be tested." };
  }
  if (!host.includes(".") && isIP(host) === 0) {
    return { ok: false, reason: "Use a full domain name, such as example.com." };
  }
  return { ok: true, url };
}

/** True for loopback, private, link-local, carrier-grade NAT, multicast, reserved, and metadata ranges. */
export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPrivateIPv4(address);
  if (version === 6) {
    const lower = address.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIPv4(mapped[1]);
    if (lower === "::" || lower === "::1") return true;
    if (/^f[cd]/.test(lower)) return true; // fc00::/7 unique local
    if (/^fe[89ab]/.test(lower)) return true; // fe80::/10 link local
    if (/^ff/.test(lower)) return true; // multicast
    return false;
  }
  return true; // not an address: refuse
}

function isPrivateIPv4(address: string): boolean {
  const [a, b, c] = address.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 192 && b === 0 && c === 0) || // 192.0.0.0/24 IETF protocol assignments; the rest of 192.0.0.0/16 is public
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

/**
 * Resolves the hostname and confirms every address is public.
 * Checked before each navigation and each sub-request, so redirects to internal addresses are blocked too.
 */
export async function resolvesToPublicAddress(hostname: string): Promise<boolean> {
  if (isIP(hostname)) return !isPrivateAddress(hostname);
  try {
    const records = await lookup(hostname, { all: true, verbatim: true });
    return records.length > 0 && records.every((record) => !isPrivateAddress(record.address));
  } catch {
    return false;
  }
}
