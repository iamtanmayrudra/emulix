"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import { LoadingRegion, Skeleton } from "@/components/skeleton";

const FRAME_INTERVAL_MS = 150;
const RETRY_INTERVAL_MS = 1000;
/** Typed letters are sent together when they come this close, so fast typing is one request, not one per key. */
const TEXT_FLUSH_MS = 60;
const WHEEL_FLUSH_MS = 80;
/** A press that moves less than this many screen pixels is a tap, not a swipe. */
const TAP_SLOP_PX = 8;
/** A press held this long without moving is a long press. */
const LONG_PRESS_MS = 500;

type Point = { x: number; y: number };

type Props = {
  sessionId: string;
  /** Shown while the first picture loads. */
  label: string;
  /** Called once the session has ended, so the page can say so. */
  onEnded: () => void;
};

const NAV_BUTTONS = [
  { key: "BACK", label: "Back", path: "M15 5l-7 7 7 7" },
  { key: "HOME", label: "Home", path: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z" },
  { key: "RECENTS", label: "Recent apps", path: "M5 5h14v14H5z" },
] as const;

/**
 * The live screen of an Android phone running on the server. Pictures arrive as images. A click is a tap, a drag is a swipe,
 * holding is a long press, the wheel scrolls, and the keyboard types into whatever field is focused on the phone.
 */
export function LiveAndroid({ sessionId, label, onEnded }: Props) {
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const lastFrameUrl = useRef<string | null>(null);
  const sendChain = useRef<Promise<unknown>>(Promise.resolve());
  const press = useRef<{ start: Point; at: number } | null>(null);
  const pendingText = useRef("");
  const textTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingWheel = useRef<{ x: number; y: number; dy: number } | null>(null);
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endedRef = useRef(false);

  const end = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    onEnded();
  }, [onEnded]);

  // Pull pictures until the session ends or the component goes away.
  useEffect(() => {
    let cancelled = false;
    let after = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      let next = FRAME_INTERVAL_MS;
      try {
        const response = await fetch(`/api/android-sessions/${sessionId}/frame?after=${after}`, { cache: "no-store" });
        if (cancelled) return;
        if (response.status === 404) {
          end();
          return;
        }
        if (response.status === 200) {
          after = Number(response.headers.get("X-Frame-Seq") ?? after);
          const blob = await response.blob();
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          if (lastFrameUrl.current) URL.revokeObjectURL(lastFrameUrl.current);
          lastFrameUrl.current = url;
          setFrameUrl(url);
        }
      } catch {
        next = RETRY_INTERVAL_MS;
      }
      if (!cancelled) timer = setTimeout(poll, next);
    }

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (lastFrameUrl.current) URL.revokeObjectURL(lastFrameUrl.current);
      lastFrameUrl.current = null;
    };
  }, [sessionId, end]);

  /** Sends one input, after the ones before it. */
  const send = useCallback(
    (body: Record<string, unknown>) => {
      sendChain.current = sendChain.current.then(async () => {
        try {
          const response = await fetch(`/api/android-sessions/${sessionId}/input`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (response.status === 404) end();
          else if (!response.ok) setSendError("The phone did not respond. Try that again.");
          else setSendError(null);
        } catch {
          setSendError("Connection lost. Check your network and try again.");
        }
      });
    },
    [sessionId, end],
  );

  /** A position on the picture as 0 to 1 of the phone's screen, or null if it is not on the picture. */
  function position(clientX: number, clientY: number, clamp = false): Point | null {
    const image = imageRef.current;
    if (!image) return null;
    const box = image.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return null;
    let x = (clientX - box.left) / box.width;
    let y = (clientY - box.top) / box.height;
    if (clamp) {
      x = Math.min(1, Math.max(0, x));
      y = Math.min(1, Math.max(0, y));
    } else if (x < 0 || x > 1 || y < 0 || y > 1) {
      return null;
    }
    return { x, y };
  }

  function handleMouseDown(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    surfaceRef.current?.focus();
    const start = position(event.clientX, event.clientY);
    if (start) press.current = { start, at: performance.now() };
  }

  // The button can be released anywhere, so the end of a press is heard on the window.
  useEffect(() => {
    function handleMouseUp(event: MouseEvent) {
      const current = press.current;
      press.current = null;
      const image = imageRef.current;
      if (!current || !image) return;
      const end = position(event.clientX, event.clientY, true) ?? current.start;
      const box = image.getBoundingClientRect();
      const moved = Math.hypot((end.x - current.start.x) * box.width, (end.y - current.start.y) * box.height);
      const held = performance.now() - current.at;
      if (moved < TAP_SLOP_PX) {
        // Holding in place is a swipe of no distance, which is how Android makes a long press.
        if (held >= LONG_PRESS_MS) {
          send({ type: "swipe", fromX: current.start.x, fromY: current.start.y, toX: current.start.x, toY: current.start.y, durationMs: 800 });
        } else {
          send({ type: "tap", x: current.start.x, y: current.start.y });
        }
      } else {
        send({
          type: "swipe",
          fromX: current.start.x,
          fromY: current.start.y,
          toX: end.x,
          toY: end.y,
          durationMs: Math.min(1000, Math.max(100, held)),
        });
      }
    }
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [send]);

  // A wheel scroll is a short swipe the other way. Wheel handlers must be non-passive to stop the page behind from scrolling.
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;

    function flushWheel() {
      const pending = pendingWheel.current;
      pendingWheel.current = null;
      wheelTimer.current = null;
      const image = imageRef.current;
      if (!pending || !image) return;
      const height = image.getBoundingClientRect().height || 1;
      // Content follows the finger: scrolling down means the finger moves up.
      const toY = Math.min(1, Math.max(0, pending.y - (pending.dy * 0.8) / height));
      if (Math.abs(toY - pending.y) < 0.01) return;
      send({ type: "swipe", fromX: pending.x, fromY: pending.y, toX: pending.x, toY, durationMs: 220 });
    }

    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      const at = position(event.clientX, event.clientY);
      if (!at) return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? surface!.clientHeight : 1;
      const pending = pendingWheel.current ?? { x: at.x, y: at.y, dy: 0 };
      pendingWheel.current = { x: pending.x, y: pending.y, dy: pending.dy + event.deltaY * unit };
      if (!wheelTimer.current) wheelTimer.current = setTimeout(flushWheel, WHEEL_FLUSH_MS);
    }

    surface.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      surface.removeEventListener("wheel", handleWheel);
      if (wheelTimer.current) clearTimeout(wheelTimer.current);
      wheelTimer.current = null;
    };
  }, [send]);

  function flushText() {
    const text = pendingText.current;
    pendingText.current = "";
    textTimer.current = null;
    if (text) send({ type: "text", text });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if ([...event.key].length === 1) {
      event.preventDefault();
      pendingText.current += event.key;
      if (!textTimer.current) textTimer.current = setTimeout(flushText, TEXT_FLUSH_MS);
      return;
    }
    const keys: Record<string, string> = {
      Enter: "ENTER",
      Backspace: "DELETE",
      Delete: "FORWARD_DELETE",
      Tab: "TAB",
      Escape: "BACK",
      ArrowUp: "UP",
      ArrowDown: "DOWN",
      ArrowLeft: "LEFT",
      ArrowRight: "RIGHT",
      PageUp: "PAGE_UP",
      PageDown: "PAGE_DOWN",
    };
    const key = keys[event.key];
    if (!key) return;
    event.preventDefault();
    // Letters typed just before keep their place in line.
    if (textTimer.current) {
      clearTimeout(textTimer.current);
      flushText();
    }
    send({ type: "key", key });
  }

  useEffect(
    () => () => {
      if (textTimer.current) clearTimeout(textTimer.current);
    },
    [],
  );

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-[2.25rem] bg-neutral-900 p-2.5 shadow-xl ring-1 ring-black/20">
        <div
          ref={surfaceRef}
          tabIndex={0}
          role="application"
          aria-label={`Android phone running ${label}. Click to tap, drag to swipe, scroll to scroll, and type to enter text.`}
          onMouseDown={handleMouseDown}
          onKeyDown={handleKeyDown}
          className="relative w-[280px] cursor-pointer touch-none overflow-hidden rounded-[1.75rem] bg-white focus-visible:outline-2 focus-visible:outline-accent"
        >
          {frameUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- frames are object URLs from our own API
            <img ref={imageRef} src={frameUrl} alt="" draggable={false} className="block h-auto w-full select-none" />
          ) : (
            <LoadingRegion label={`Loading ${label}`} className="flex aspect-[9/20] w-full flex-col gap-3 bg-white p-4">
              <p className="text-center text-xs text-neutral-500">Loading {label}…</p>
              <Skeleton className="h-3 w-1/3 bg-neutral-200" />
              <Skeleton className="h-20 w-full bg-neutral-200" />
              <Skeleton className="h-3 w-4/5 bg-neutral-200" />
            </LoadingRegion>
          )}
        </div>
      </div>

      <div role="group" aria-label="Phone buttons" className="flex items-center gap-2">
        {NAV_BUTTONS.map((button) => (
          <button
            key={button.key}
            type="button"
            aria-label={button.label}
            title={button.label}
            onClick={() => send({ type: "key", key: button.key })}
            className="flex h-10 w-14 items-center justify-center rounded-full border border-border bg-surface text-foreground transition hover:border-accent hover:text-accent active:scale-95 focus-visible:outline-2 focus-visible:outline-accent"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={button.path} />
            </svg>
          </button>
        ))}
      </div>

      {sendError && (
        <p role="alert" className="text-center text-xs text-danger">
          {sendError}
        </p>
      )}
    </div>
  );
}
