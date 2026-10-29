import { getCurrentUser, clientIp } from "@/lib/auth/runtime";

/** Identifies the caller of an audit: the signed-in user, or the client address for anonymous visitors. */
export async function auditOwner(request: Request): Promise<{ owner: string; signedIn: boolean }> {
  const user = await getCurrentUser();
  if (user) return { owner: `user:${user.id}`, signedIn: true };
  return { owner: `anon:${clientIp(request)}`, signedIn: false };
}
