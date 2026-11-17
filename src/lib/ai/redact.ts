/**
 * Removes secrets from text before it is sent to an AI provider (docs/AI_FEATURES.md, rule 3).
 * This is a best effort for text. It cannot see inside a screenshot, so the screenshot is sent only after an explicit click.
 */

const MAX_PATH_SEGMENT = 20;

/** A long run of letters and digits with both kinds present, such as a token or a hash. Plain words and numbers pass. */
function looksOpaque(value: string, minLength: number): boolean {
  return value.length >= minLength && /^[A-Za-z0-9_+/=-]+$/.test(value) && /[A-Za-z]/.test(value) && /\d/.test(value);
}

/**
 * Keeps the address of a page or request but drops what could carry a secret: credentials in the address, the whole query
 * string, the fragment, and any path segment that looks like a token. "https://a.com/x?token=1" becomes "https://a.com/x?…".
 */
export function redactUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const path = url.pathname
      .split("/")
      .map((segment) => (looksOpaque(segment, MAX_PATH_SEGMENT) ? "[redacted]" : segment))
      .join("/");
    return `${url.protocol}//${url.host}${path}${url.search ? "?…" : ""}`;
  } catch {
    return redactText(raw).slice(0, 300);
  }
}

const URL_IN_TEXT = /https?:\/\/[^\s"'<>)\]]+/gi;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const JWT = /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g;
const SECRET_PAIR = /\b(token|secret|password|passwd|api[_-]?key|access[_-]?token|auth(?:orization)?|session(?:id)?)(["']?\s*[:=]\s*["']?)(?!Bearer\b|\[redacted)([^\s"',;&]+)/gi;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const LONG_TOKEN = /[A-Za-z0-9+/_-]{32,}={0,2}/g;

/** Redacts addresses, bearer tokens, JWTs, secret-looking key/value pairs, email addresses and long opaque strings. */
export function redactText(text: string): string {
  return text
    .replace(URL_IN_TEXT, (match) => redactUrl(match))
    .replace(JWT, "[redacted token]")
    .replace(BEARER, "Bearer [redacted]")
    .replace(SECRET_PAIR, (_match, key: string, separator: string) => `${key}${separator}[redacted]`)
    .replace(EMAIL, "[email]")
    .replace(LONG_TOKEN, (match) => (looksOpaque(match, 32) ? "[redacted]" : match));
}
