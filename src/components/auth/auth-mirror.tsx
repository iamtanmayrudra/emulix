"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type MirrorStatus = "idle" | "pending" | "error" | "success";

/**
 * What the device stage shows of the form. Only the length of the password is kept, never its value,
 * and nothing here leaves the browser.
 */
export type AuthMirrorState = {
  name: string;
  email: string;
  secretLength: number;
  status: MirrorStatus;
};

const INITIAL: AuthMirrorState = { name: "", email: "", secretLength: 0, status: "idle" };

const StateContext = createContext<AuthMirrorState>(INITIAL);
const UpdateContext = createContext<(patch: Partial<AuthMirrorState>) => void>(() => undefined);

/** Shares the form's progress with the device stage beside it. */
export function AuthMirrorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthMirrorState>(INITIAL);
  const update = useCallback((patch: Partial<AuthMirrorState>) => setState((current) => ({ ...current, ...patch })), []);
  const value = useMemo(() => state, [state]);
  return (
    <UpdateContext.Provider value={update}>
      <StateContext.Provider value={value}>{children}</StateContext.Provider>
    </UpdateContext.Provider>
  );
}

export function useAuthMirror(): AuthMirrorState {
  return useContext(StateContext);
}

/** Without a provider this does nothing, so the form also works on its own. */
export function useAuthMirrorUpdate(): (patch: Partial<AuthMirrorState>) => void {
  return useContext(UpdateContext);
}
