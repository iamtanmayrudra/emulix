import { PLAN_LIMITS, type Plan } from "@/lib/mock-data";
import { AiFailure } from "./errors";
import type { AiUsage } from "./types";

/**
 * AI credits per user per calendar month (UTC). One credit is one call to the model; a result served from the cache costs
 * nothing. Development storage is in memory and lost on restart, like the other stores. Swap it for the database later.
 */

type Counter = { period: string; used: number };

const globalForQuota = globalThis as typeof globalThis & { __emulixAiQuota?: Map<string, Counter> };

function counters(): Map<string, Counter> {
  globalForQuota.__emulixAiQuota ??= new Map();
  return globalForQuota.__emulixAiQuota;
}

export function currentPeriod(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7);
}

function counterFor(userId: string, now: Date): Counter {
  const period = currentPeriod(now);
  const existing = counters().get(userId);
  if (existing && existing.period === period) return existing;
  const fresh = { period, used: 0 };
  counters().set(userId, fresh);
  return fresh;
}

export function getAiUsage(userId: string, plan: Plan, now: Date = new Date()): AiUsage {
  return { used: counterFor(userId, now).used, limit: PLAN_LIMITS[plan].aiCreditsPerPeriod };
}

/** Takes one credit and returns the usage after it, or null when the month's allowance is used up. */
export function reserveCredit(userId: string, plan: Plan, now: Date = new Date()): AiUsage | null {
  const counter = counterFor(userId, now);
  const limit = PLAN_LIMITS[plan].aiCreditsPerPeriod;
  if (counter.used >= limit) return null;
  counter.used += 1;
  return { used: counter.used, limit };
}

/** Gives a credit back, for a call that failed before the tester got anything. */
export function refundCredit(userId: string, now: Date = new Date()): void {
  const counter = counterFor(userId, now);
  if (counter.used > 0) counter.used -= 1;
}

/** Runs `work` against one credit. The credit is refunded if `work` throws. */
export async function withCredit<T>(userId: string, plan: Plan, work: () => Promise<T>): Promise<{ result: T; usage: AiUsage }> {
  const usage = reserveCredit(userId, plan);
  if (!usage) throw new AiFailure("quota_exceeded", "You have used this month's AI allowance.");
  try {
    return { result: await work(), usage };
  } catch (error) {
    refundCredit(userId);
    throw error;
  }
}
