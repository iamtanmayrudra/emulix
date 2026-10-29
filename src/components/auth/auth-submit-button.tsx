"use client";

import { useRef, type PointerEvent } from "react";
import { useAuthMirror } from "@/components/auth/auth-mirror";

type Props = {
  pending: boolean;
  label: string;
  /** Text once the server accepts the form. */
  successLabel: string;
};

const GRADIENTS = {
  idle: "from-brand-blue via-brand-violet to-brand-fuchsia",
  error: "from-rose-500 via-red-500 to-orange-500",
  success: "from-emerald-500 via-teal-500 to-cyan-500",
};

/**
 * Submit button that acts like a device unlocking. At rest it has a slowly drifting gradient. Hovering adds a light
 * patch under the pointer and a shine sweep. While the request runs a progress line travels along the bottom edge,
 * then the button turns red and shakes when the server says no, or green with a tick when it says yes.
 * The outcome comes from the same state that drives the devices beside the form.
 */
export function AuthSubmitButton({ pending, label, successLabel }: Props) {
  const { status } = useAuthMirror();
  const ref = useRef<HTMLButtonElement>(null);
  const state = pending ? "pending" : status === "error" ? "error" : status === "success" ? "success" : "idle";
  const gradient = state === "error" ? GRADIENTS.error : state === "success" ? GRADIENTS.success : GRADIENTS.idle;

  function handleMove(event: PointerEvent<HTMLButtonElement>) {
    const button = ref.current;
    if (!button) return;
    const box = button.getBoundingClientRect();
    button.style.setProperty("--bx", `${event.clientX - box.left}px`);
    button.style.setProperty("--by", `${event.clientY - box.top}px`);
  }

  return (
    <button
      ref={ref}
      // A new key restarts the shake each time an error arrives.
      key={state === "error" ? "error" : "steady"}
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      data-state={state}
      onPointerMove={handleMove}
      className={`group relative isolate flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl px-5 py-4 text-sm font-bold tracking-wide text-white shadow-xl shadow-indigo-500/30 transition duration-300 [--bx:50%] [--by:50%] hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-indigo-500/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:translate-y-0 active:scale-[0.985] disabled:cursor-wait disabled:hover:translate-y-0 ${
        state === "error" ? "stage-shake" : ""
      }`}
    >
      <span
        aria-hidden="true"
        className={`btn-drift absolute inset-0 -z-10 bg-gradient-to-r bg-[length:200%_100%] transition-opacity duration-500 ${gradient}`}
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 [background:radial-gradient(110px_circle_at_var(--bx)_var(--by),rgba(255,255,255,0.4),transparent_70%)] group-hover:opacity-100"
      />
      <span
        aria-hidden="true"
        className="absolute inset-y-0 -left-1/3 w-1/4 -skew-x-12 bg-white/30 opacity-0 blur-md transition duration-700 ease-out group-hover:translate-x-[520%] group-hover:opacity-100"
      />

      {state === "pending" && (
        <>
          <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" />
          Please wait…
          <span aria-hidden="true" className="btn-progress absolute bottom-0 left-0 h-[3px] w-1/3 rounded-full bg-white/80" />
        </>
      )}

      {state === "success" && (
        <>
          <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-white/25">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          {successLabel}
        </>
      )}

      {(state === "idle" || state === "error") && (
        <>
          {state === "error" ? "Try again" : label}
          <span
            aria-hidden="true"
            className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 transition duration-300 group-hover:translate-x-1 group-hover:bg-white/30"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </>
      )}
    </button>
  );
}
