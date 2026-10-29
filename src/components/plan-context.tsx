"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Plan, SubscriptionStatus } from "@/lib/mock-data";

type PlanState = { plan: Plan; subscription: SubscriptionStatus };

const PlanContext = createContext<PlanState>({ plan: "free", subscription: "free" });

/** Carries the signed-in user's plan from the server layout to client components. */
export function PlanProvider({ value, children }: { value: PlanState; children: ReactNode }) {
  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanState {
  return useContext(PlanContext);
}
