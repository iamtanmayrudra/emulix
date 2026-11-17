import type { AiErrorBody } from "./types";

export type AiResult<T> = { ok: true; data: T } | { ok: false; error: AiErrorBody };

/** Calls an AI route and turns every failure, including a dropped connection, into an error the UI can show. */
export async function postAi<T>(path: string, body: unknown): Promise<AiResult<T>> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data: unknown = await response.json().catch(() => null);
    if (response.ok && data) return { ok: true, data: data as T };
    const error = data as Partial<AiErrorBody> | null;
    return {
      ok: false,
      error: { error: error?.error ?? "server_error", message: error?.message ?? "The AI request failed. Try again.", upgradeUrl: error?.upgradeUrl },
    };
  } catch {
    return { ok: false, error: { error: "network", message: "Network error. Check your connection and try again." } };
  }
}
