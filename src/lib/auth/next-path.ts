/**
 * The page to open after signing in, taken from ?next=. Only a path on this site is accepted, so a crafted link
 * cannot send someone to another site after they sign in.
 */
export function safeNextPath(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value || value.length > 200) return fallback;
  // Must be one path: starts with a single slash, with no second slash, backslash, scheme or control characters.
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\\\u0000-\u001f]/.test(value) || value.includes("://")) return fallback;
  return value;
}
