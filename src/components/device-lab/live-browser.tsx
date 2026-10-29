"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { LoadingRegion, Skeleton } from "@/components/skeleton";

const FRAME_INTERVAL_MS = 100;
const RETRY_INTERVAL_MS = 1000;
const WHEEL_FLUSH_MS = 60;
/** Keys sent to the page. Mirrors the server's list; anything else is left to the browser. */
const FORWARDED_KEYS = new Set([
  "Enter",
  "Backspace",
  "Delete",
  "Tab",
  "Escape",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

/** Converts a pointer position to 0 to 1 page coordinates, accounting for the frame's letterboxing. */
function pagePosition(image: HTMLImageElement | null, clientX: number, clientY: number): { x: number; y: number } | null {
  if (!image || !image.naturalWidth || !image.naturalHeight) return null;
  const box = image.getBoundingClientRect();
  const scale = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight);
  const drawnWidth = image.naturalWidth * scale;
  const drawnHeight = image.naturalHeight * scale;
  const x = (clientX - box.left - (box.width - drawnWidth) / 2) / drawnWidth;
  const y = (clientY - box.top - (box.height - drawnHeight) / 2) / drawnHeight;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x, y };
}

type Props = {
  sessionId: string;
  /** Shown while the first frame loads. */
  label: string;
  /** Called with the page's current address whenever it changes. Pass a stable setter. */
  onPageUrl?: (url: string) => void;
};

/**
 * Shows the live page from a server-side Chromium session and forwards pointer, scroll and keyboard input to it.
 * Frames are polled as JPEGs. Input is sent in order, one request at a time.
 */
export function LiveBrowser({ sessionId, label, onPageUrl }: Props) {
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const lastFrameUrl = useRef<string | null>(null);
  const sendChain = useRef<Promise<void>>(Promise.resolve());
  const pendingWheel = useRef<{ x: number; y: number; deltaY: number } | null>(null);
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pull frames until the session ends or the component unmounts.
  useEffect(() => {
    let cancelled = false;
    let after = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      let next = FRAME_INTERVAL_MS;
      try {
        const response = await fetch(`/api/browser-sessions/${sessionId}/frame?after=${after}`, { cache: "no-store" });
        if (cancelled) return;
        if (response.status === 404) {
          setEnded(true);
          return;
        }
        const pageUrl = response.headers.get("X-Page-Url");
        if (pageUrl && onPageUrl) onPageUrl(decodeURIComponent(pageUrl));
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
  }, [sessionId, onPageUrl]);

  const send = useCallback(
    (body: Record<string, unknown>) => {
      sendChain.current = sendChain.current.then(async () => {
        try {
          const response = await fetch(`/api/browser-sessions/${sessionId}/input`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (response.status === 404) setEnded(true);
          else if (!response.ok) setSendError("The page did not respond. Try that again.");
          else setSendError(null);
        } catch {
          setSendError("Connection lost. Check your network and try again.");
        }
      });
    },
    [sessionId],
  );

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    surfaceRef.current?.focus();
    const position = pagePosition(imageRef.current, event.clientX, event.clientY);
    if (position) send({ type: "click", ...position });
  }

  // React attaches wheel handlers as passive, which cannot cancel the browser's own scroll. Listen directly instead,
  // so the page in the device scrolls and the panel around the device stays where it is.
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;

    function flushWheel() {
      const pending = pendingWheel.current;
      pendingWheel.current = null;
      wheelTimer.current = null;
      if (pending) send({ type: "wheel", ...pending });
    }

    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      const position = pagePosition(imageRef.current, event.clientX, event.clientY);
      if (!position) return;
      // Firefox and some mice report lines or pages instead of pixels.
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? surface!.clientHeight : 1;
      const pending = pendingWheel.current ?? { ...position, deltaY: 0 };
      pendingWheel.current = { x: position.x, y: position.y, deltaY: pending.deltaY + event.deltaY * unit };
      if (!wheelTimer.current) wheelTimer.current = setTimeout(flushWheel, WHEEL_FLUSH_MS);
    }

    surface.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      surface.removeEventListener("wheel", handleWheel);
      if (wheelTimer.current) clearTimeout(wheelTimer.current);
      wheelTimer.current = null;
    };
  }, [send]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.length === 1) {
      event.preventDefault();
      send({ type: "text", text: event.key });
    } else if (FORWARDED_KEYS.has(event.key)) {
      event.preventDefault();
      send({ type: "key", key: event.key });
    }
  }

  return (
    <div
      ref={surfaceRef}
      tabIndex={0}
      role="application"
      aria-label={`Live browser: ${label}. Click, scroll, and type to use the page.`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="absolute inset-0 flex items-center justify-center bg-white focus-visible:outline-2 focus-visible:outline-accent"
    >
      {ended ? (
        <p role="status" className="p-4 text-center text-xs text-neutral-500">
          This browser session has ended. Start a test again to reconnect.
        </p>
      ) : frameUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- frames are object URLs from our own API
        <img
          ref={imageRef}
          src={frameUrl}
          alt=""
          draggable={false}
          className="max-h-full max-w-full select-none object-contain"
        />
      ) : (
        <LoadingRegion label={`Loading ${label}`} className="flex h-full w-full flex-col gap-3 bg-white p-4">
          <p className="text-center text-xs text-neutral-500">Loading {label}…</p>
          <Skeleton className="h-3 w-1/3 bg-neutral-200" />
          <Skeleton className="h-20 w-full bg-neutral-200" />
          <Skeleton className="h-3 w-4/5 bg-neutral-200" />
          <Skeleton className="h-3 w-3/5 bg-neutral-200" />
        </LoadingRegion>
      )}
      {sendError && !ended && (
        <p role="alert" className="absolute inset-x-2 bottom-2 rounded bg-white/95 px-2 py-1 text-center text-xs text-danger">
          {sendError}
        </p>
      )}
    </div>
  );
}
