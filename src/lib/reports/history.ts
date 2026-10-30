/**
 * A record of each live browser session, so the Reports page can list them after they end.
 * Development storage is in memory and lost on restart, like the other stores. Swap it for the database later.
 */

export type SessionRecord = {
  id: string;
  userId: string;
  url: string;
  profileName: string;
  startedAt: string;
  endedAt: string | null;
  /** The page the browser was on when the session ended. */
  finalUrl: string | null;
  title: string | null;
};

const MAX_KEPT_PER_USER = 100;

const globalForHistory = globalThis as typeof globalThis & { __emulixSessionHistory?: Map<string, SessionRecord> };

function records(): Map<string, SessionRecord> {
  globalForHistory.__emulixSessionHistory ??= new Map();
  return globalForHistory.__emulixSessionHistory;
}

export function recordSessionStart(input: Pick<SessionRecord, "id" | "userId" | "url" | "profileName" | "startedAt">): void {
  records().set(input.id, { ...input, endedAt: null, finalUrl: null, title: null });

  // Keep the newest sessions and drop the oldest finished ones.
  const mine = listSessions(input.userId);
  for (const old of mine.slice(MAX_KEPT_PER_USER)) {
    if (old.endedAt) records().delete(old.id);
  }
}

export function recordSessionEnd(id: string, finalUrl: string, title: string): void {
  const record = records().get(id);
  if (!record || record.endedAt) return;
  record.endedAt = new Date().toISOString();
  record.finalUrl = finalUrl;
  record.title = title || null;
}

export function listSessions(userId: string): SessionRecord[] {
  return [...records().values()]
    .filter((record) => record.userId === userId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .map((record) => ({ ...record }));
}

/** Removes an ended session from the user's history. A session that is still open stays until it ends. */
export function deleteSession(userId: string, id: string): boolean {
  const record = records().get(id);
  if (!record || record.userId !== userId || !record.endedAt) return false;
  records().delete(id);
  return true;
}
