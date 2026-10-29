"use client";

import { DevicePhoto } from "@/components/device-photo";
import { useAuthMirror, type AuthMirrorState } from "@/components/auth/auth-mirror";

/** Number of password characters at which the tablet is fully in focus. */
const FULL_FOCUS_AT = 12;
const MAX_DOTS = 12;

function displayName(state: AuthMirrorState): string {
  return state.name.trim() || state.email.split("@")[0].trim();
}

function statusLine(state: AuthMirrorState): string {
  switch (state.status) {
    case "pending":
      return "Signing in…";
    case "error":
      return "That did not work";
    case "success":
      return "Welcome in";
    default:
      return state.secretLength > 0 ? "Locking it down" : "Ready when you are";
  }
}

/** Phone screen: an avatar and a name that appear as you type, one dot per password character, and the sign-in status. */
function PhoneScreen({ state }: { state: AuthMirrorState }) {
  const name = displayName(state);
  const initial = name ? name[0].toUpperCase() : "";
  const dots = Math.min(state.secretLength, MAX_DOTS);
  const success = state.status === "success";
  const error = state.status === "error";

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-brand-ink to-brand-deep px-2 text-center text-white">
      <div
        key={error ? "shake" : "calm"}
        className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold shadow-lg transition-colors duration-300 ${
          error ? "stage-shake bg-rose-500" : success ? "bg-emerald-500" : "bg-gradient-to-br from-brand-blue to-brand-fuchsia"
        }`}
      >
        {success ? (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        ) : initial ? (
          initial
        ) : (
          <svg viewBox="0 0 24 24" className="h-6 w-6 text-white/80" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="8.5" r="3.5" />
            <path d="M5 20a7 7 0 0 1 14 0" />
          </svg>
        )}
      </div>
      <p className="w-full truncate text-[11px] font-semibold">{name ? `Hi, ${name}` : "Hello there"}</p>
      <div className="flex h-2.5 items-center justify-center gap-[3px]" aria-hidden="true">
        {Array.from({ length: Math.max(dots, 1) }).map((_, index) => (
          <span key={index} className={`h-1.5 w-1.5 rounded-full transition-all ${dots === 0 ? "bg-white/20" : "bg-white"}`} />
        ))}
      </div>
      <p className="text-[9px] text-white/60">{statusLine(state)}</p>
    </div>
  );
}

/** Tablet screen: a dashboard that is blurred and locked until the password is long enough, then unlocks on success. */
function TabletScreen({ state }: { state: AuthMirrorState }) {
  const success = state.status === "success";
  const progress = success ? 1 : Math.min(state.secretLength / FULL_FOCUS_AT, 1);
  const radius = 15;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative h-full overflow-hidden bg-gradient-to-b from-slate-50 to-slate-200 text-slate-900">
      <div className="h-full p-3 transition-[filter] duration-500" style={{ filter: `blur(${((1 - progress) * 5).toFixed(1)}px)` }}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold">Dashboard</span>
          <span className="h-2 w-10 rounded-full bg-slate-300" />
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {["from-brand-blue to-brand-violet", "from-emerald-400 to-teal-500", "from-amber-400 to-rose-500"].map((tint) => (
            <div key={tint} className={`h-12 rounded-lg bg-gradient-to-br ${tint}`} />
          ))}
        </div>
        <div className="mt-2 space-y-1.5">
          {[0.9, 0.7, 0.55, 0.8].map((width) => (
            <div key={width} className="flex items-center gap-2 rounded-md bg-white px-2 py-1.5 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-violet-400" />
              <span className="h-1.5 rounded-full bg-slate-200" style={{ width: `${width * 70}%` }} />
            </div>
          ))}
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-white/90 shadow-xl">
          <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="20" cy="20" r={radius} fill="none" stroke="rgba(100,116,139,0.25)" strokeWidth="3" />
            <circle
              cx="20"
              cy="20"
              r={radius}
              fill="none"
              stroke={success ? "#10b981" : "#6b3df0"}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${progress * circumference} ${circumference}`}
              className="transition-all duration-300"
            />
          </svg>
          <svg viewBox="0 0 24 24" className={`h-5 w-5 ${success ? "text-emerald-500" : "text-brand-violet"}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {success ? (
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            ) : (
              <>
                <rect x="5" y="11" width="14" height="9" rx="2.5" />
                <path d={progress >= 1 ? "M8 11V8a4 4 0 0 1 7.5-2" : "M8 11V8a4 4 0 0 1 8 0v3"} />
              </>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}

/**
 * An iPad and an iPhone, real device photos, that react to the form beside them. They drift with the pointer
 * (through the --px and --py variables the panel sets) and float gently.
 */
export function AuthStage() {
  const state = useAuthMirror();

  return (
    <div className="relative mx-auto mt-2 h-[380px] w-full max-w-[420px]" aria-hidden="true">
      <div aria-hidden="true" className="absolute inset-x-10 top-1/2 h-60 -translate-y-1/2 rounded-full bg-gradient-to-r from-brand-blue/30 to-brand-fuchsia/30 blur-3xl" />

      <div
        className="absolute left-0 top-2 will-change-transform"
        style={{ transform: "translate3d(calc(var(--px) * -12px), calc(var(--py) * -8px), 0) rotate(-4deg)" }}
      >
        <div className="stage-float drop-shadow-[0_25px_35px_rgba(0,0,0,0.45)]">
          <DevicePhoto id="ipad-air" height={340}>
            <TabletScreen state={state} />
          </DevicePhoto>
        </div>
      </div>

      <div
        className="absolute bottom-0 left-[190px] will-change-transform"
        style={{ transform: "translate3d(calc(var(--px) * 18px), calc(var(--py) * 12px), 0) rotate(3deg)" }}
      >
        <div className="stage-float drop-shadow-[0_25px_35px_rgba(0,0,0,0.5)] [animation-delay:-3s]">
          <DevicePhoto id="iphone-se" height={300}>
            <PhoneScreen state={state} />
          </DevicePhoto>
        </div>
      </div>
    </div>
  );
}
