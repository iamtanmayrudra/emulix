"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type ClipboardEvent } from "react";
import { LoadingRegion, Skeleton } from "@/components/skeleton";
import type { PageControl } from "@/lib/testing/browser-sessions";

const FRAME_INTERVAL_MS = 100;
const RETRY_INTERVAL_MS = 1000;
const WHEEL_FLUSH_MS = 60;
/** Hover and drag positions are sent at most this often. */
const MOVE_INTERVAL_MS = 50;
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
function pagePosition(
  image: HTMLImageElement | null,
  clientX: number,
  clientY: number,
  clamp = false,
): { x: number; y: number } | null {
  if (!image || !image.naturalWidth || !image.naturalHeight) return null;
  const box = image.getBoundingClientRect();
  const scale = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight);
  const drawnWidth = image.naturalWidth * scale;
  const drawnHeight = image.naturalHeight * scale;
  let x = (clientX - box.left - (box.width - drawnWidth) / 2) / drawnWidth;
  let y = (clientY - box.top - (box.height - drawnHeight) / 2) / drawnHeight;
  if (clamp) {
    // A drag that ends outside the picture still ends at its edge, so the page sees the button come up.
    x = Math.min(1, Math.max(0, x));
    y = Math.min(1, Math.max(0, y));
  } else if (x < 0 || x > 1 || y < 0 || y > 1) {
    return null;
  }
  return { x, y };
}

type Props = {
  sessionId: string;
  /** Shown while the first frame loads. */
  label: string;
  /** Called with the page's current address whenever it changes. Pass a stable setter. */
  onPageUrl?: (url: string) => void;
};

type InputResponse = { control?: PageControl };

/** A drop-down or picker the device is showing over the page, and where on the page it belongs. */
type OpenControl = {
  data: PageControl;
  /** The press that opened it, so the choice can be written to the same element. */
  x: number;
  y: number;
  /** Where the list or picker sits inside the live view, in pixels. */
  placement: { left: number; top: number; minWidth: number; maxHeight: number };
};

const PICKER_LABELS: Record<Extract<PageControl, { kind: "value" }>["inputType"], string> = {
  date: "Choose a date",
  time: "Choose a time",
  "datetime-local": "Choose a date and time",
  month: "Choose a month",
  week: "Choose a week",
  color: "Choose a colour",
};

/**
 * Shows the live page from a server-side browser session and forwards pointer, scroll and keyboard input to it:
 * presses and drags, double and triple clicks, hover, scrolling, typing, pasting, and the select-all, undo and
 * shift-tab keys. The browser's own drop-downs and date and colour pickers are never drawn in its picture, so the
 * device shows its own for them and writes the choice back to the page.
 * Frames are polled as JPEGs. Input is sent in order, one request at a time.
 */
export function LiveBrowser({ sessionId, label, onPageUrl }: Props) {
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [control, setControl] = useState<OpenControl | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const lastFrameUrl = useRef<string | null>(null);
  const sendChain = useRef<Promise<unknown>>(Promise.resolve());
  const pendingWheel = useRef<{ x: number; y: number; deltaY: number } | null>(null);
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Set while a button is held down on the page, with the click count of the press. */
  const pressed = useRef<{ clickCount: number } | null>(null);
  const lastPosition = useRef<{ x: number; y: number } | null>(null);
  const lastMoveAt = useRef(0);
  /** A move is on its way. Another is not queued behind it, so a slow connection does not build a backlog. */
  const moveInFlight = useRef(false);

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

  /** Sends one input, after the ones before it. Resolves with what the server answered, or null if it failed. */
  const send = useCallback(
    (body: Record<string, unknown>): Promise<InputResponse | null> => {
      const run = sendChain.current.then(async (): Promise<InputResponse | null> => {
        try {
          const response = await fetch(`/api/browser-sessions/${sessionId}/input`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (response.status === 404) {
            setEnded(true);
            return null;
          }
          if (!response.ok) {
            setSendError("The page did not respond. Try that again.");
            return null;
          }
          setSendError(null);
          return (await response.json().catch(() => ({}))) as InputResponse;
        } catch {
          setSendError("Connection lost. Check your network and try again.");
          return null;
        }
      });
      sendChain.current = run;
      return run;
    },
    [sessionId],
  );

  /** Works out where to put a list or picker for a control, from where the control sits in the picture. */
  function placeControl(rect: { x: number; y: number; width: number; height: number }) {
    const image = imageRef.current;
    const surface = surfaceRef.current;
    if (!image || !surface) return null;
    const imageBox = image.getBoundingClientRect();
    const surfaceBox = surface.getBoundingClientRect();
    const left = imageBox.left - surfaceBox.left + rect.x * imageBox.width;
    const controlTop = imageBox.top - surfaceBox.top + rect.y * imageBox.height;
    const controlBottom = controlTop + rect.height * imageBox.height;
    const visible = surface.clientHeight;
    const room = 8;
    const below = visible - controlBottom - room;
    const above = controlTop - room;
    const useBelow = below >= 160 || below >= above;
    const maxHeight = Math.max(96, Math.min(280, useBelow ? below : above));
    return {
      left: Math.max(room, Math.min(left, surface.clientWidth - 120)),
      top: useBelow ? controlBottom + 2 : Math.max(room, controlTop - maxHeight - 2),
      minWidth: Math.min(Math.max(rect.width * imageBox.width, 140), surface.clientWidth - 2 * room),
      maxHeight,
    };
  }

  function handleMouseDown(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    surfaceRef.current?.focus();
    setControl(null);
    const position = pagePosition(imageRef.current, event.clientX, event.clientY);
    if (!position) return;
    // The browser counts quick presses in a row, which is what makes a double click select a word.
    const clickCount = Math.min(3, Math.max(1, event.detail || 1));
    pressed.current = { clickCount };
    lastPosition.current = position;
    void send({ type: "down", ...position, clickCount });
  }

  function handleMouseMove(event: ReactMouseEvent<HTMLDivElement>) {
    if (moveInFlight.current) return;
    const now = performance.now();
    if (now - lastMoveAt.current < MOVE_INTERVAL_MS) return;
    const position = pagePosition(imageRef.current, event.clientX, event.clientY);
    if (!position) return;
    lastMoveAt.current = now;
    lastPosition.current = position;
    moveInFlight.current = true;
    void send({ type: "move", ...position }).finally(() => {
      moveInFlight.current = false;
    });
  }

  // The button can be released anywhere on the screen, so the end of a press is heard on the window.
  useEffect(() => {
    function handleMouseUp(event: MouseEvent) {
      const press = pressed.current;
      if (!press) return;
      pressed.current = null;
      const position = pagePosition(imageRef.current, event.clientX, event.clientY, true) ?? lastPosition.current;
      if (!position) return;
      void send({ type: "up", ...position, clickCount: press.clickCount }).then((result) => {
        if (!result?.control) return;
        const placement = placeControl(result.control.rect);
        if (placement) setControl({ data: result.control, x: position.x, y: position.y, placement });
      });
    }
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [send]);

  // React attaches wheel handlers as passive, which cannot cancel the browser's own scroll. Listen directly instead,
  // so the page in the device scrolls and the panel around the device stays where it is.
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;

    function flushWheel() {
      const pending = pendingWheel.current;
      pendingWheel.current = null;
      wheelTimer.current = null;
      if (pending) void send({ type: "wheel", ...pending });
    }

    function handleWheel(event: WheelEvent) {
      // A list the device is showing scrolls by itself.
      if ((event.target as HTMLElement | null)?.closest("[data-control-popover]")) return;
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
    if (event.ctrlKey || event.metaKey) {
      // Select all, undo and redo go to the page. Paste is handled below. Copy and cut need the page's clipboard, which
      // this view does not have, so they are left to the browser.
      const key = event.key.toLowerCase();
      const action = key === "a" ? "SelectAll" : key === "z" ? (event.shiftKey ? "Redo" : "Undo") : key === "y" ? "Redo" : null;
      if (!action) return;
      event.preventDefault();
      void send({ type: "key", key: action });
      return;
    }
    if (event.altKey) return;
    // Counted in whole characters, so an emoji (two code units) is typed, not dropped.
    if ([...event.key].length === 1) {
      event.preventDefault();
      void send({ type: "text", text: event.key });
    } else if (event.key === "Tab" && event.shiftKey) {
      event.preventDefault();
      void send({ type: "key", key: "ShiftTab" });
    } else if (FORWARDED_KEYS.has(event.key)) {
      event.preventDefault();
      void send({ type: "key", key: event.key });
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const text = event.clipboardData.getData("text/plain");
    if (!text) return;
    event.preventDefault();
    void send({ type: "paste", text: text.slice(0, 2_000) });
  }

  function chooseOption(index: number) {
    if (!control) return;
    const { x, y } = control;
    setControl(null);
    void send({ type: "select", x, y, index });
  }

  function chooseValue(value: string) {
    if (!control) return;
    const { x, y } = control;
    setControl(null);
    void send({ type: "setValue", x, y, value });
  }

  return (
    <div
      ref={surfaceRef}
      tabIndex={0}
      role="application"
      aria-label={`Live browser: ${label}. Click, drag, scroll, and type to use the page.`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      className="absolute inset-0 overflow-hidden bg-white focus-visible:outline-2 focus-visible:outline-accent"
    >
      {ended ? (
        <p role="status" className="flex h-full items-center justify-center p-4 text-center text-xs text-neutral-500">
          This browser session has ended. Start a test again to reconnect.
        </p>
      ) : frameUrl ? (
        // The frame is the device's full viewport, which is taller than the page area between the browser's bars. It fills
        // the width and is anchored to the top, so there are no bands at the sides. The lower part is reached by scrolling,
        // as on a real phone. Not object-contain: that would shrink the page to fit the height and leave gaps.
        // eslint-disable-next-line @next/next/no-img-element -- frames are object URLs from our own API
        <img
          ref={imageRef}
          src={frameUrl}
          alt=""
          draggable={false}
          className="block h-auto w-full max-w-none select-none"
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

      {control && !ended && <ControlPopover control={control} onChooseOption={chooseOption} onChooseValue={chooseValue} onClose={() => setControl(null)} />}

      {sendError && !ended && (
        <p role="alert" className="absolute inset-x-2 bottom-2 rounded bg-white/95 px-2 py-1 text-center text-xs text-danger">
          {sendError}
        </p>
      )}
    </div>
  );
}

type PopoverProps = {
  control: OpenControl;
  onChooseOption: (index: number) => void;
  onChooseValue: (value: string) => void;
  onClose: () => void;
};

/**
 * The list or picker for a control whose own cannot be drawn. It sits over the page, beside the control. Presses and
 * keys inside it stay inside it, so they are not sent on to the page.
 */
function ControlPopover({ control, onChooseOption, onChooseValue, onClose }: PopoverProps) {
  const { data, placement } = control;
  const fieldRef = useRef<HTMLInputElement>(null);
  const style = { left: placement.left, top: placement.top, minWidth: placement.minWidth, maxHeight: placement.maxHeight };

  function stop(event: { stopPropagation: () => void }) {
    event.stopPropagation();
  }

  return (
    <div
      data-control-popover=""
      style={style}
      onMouseDown={stop}
      onMouseMove={stop}
      onPaste={stop}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") onClose();
      }}
      className="absolute z-20 overflow-auto rounded-md border border-neutral-300 bg-white text-sm text-neutral-900 shadow-lg"
    >
      {data.kind === "select" ? (
        <ul role="listbox" aria-label="Options" className="py-1">
          {data.options.map((option, index) => (
            <li key={index}>
              <button
                type="button"
                role="option"
                aria-selected={option.selected}
                disabled={option.disabled}
                ref={(element) => {
                  if (element && option.selected) element.scrollIntoView({ block: "nearest" });
                }}
                onClick={() => onChooseOption(index)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left enabled:hover:bg-neutral-100 disabled:text-neutral-400 focus-visible:outline-2 focus-visible:outline-accent ${
                  option.selected ? "bg-neutral-100 font-semibold" : ""
                }`}
              >
                <span aria-hidden="true" className="w-3 shrink-0 text-xs">
                  {option.selected ? "✓" : ""}
                </span>
                <span className="min-w-0 flex-1 truncate">{option.label || " "}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-2 p-3">
          <label className="block text-xs font-medium text-neutral-600">
            {PICKER_LABELS[data.inputType]}
            {/* The browser draws its own picker for this field here, on the tester's screen, where it can be seen. */}
            <input
              ref={fieldRef}
              type={data.inputType}
              defaultValue={data.inputType === "color" && !data.value ? "#000000" : data.value}
              min={data.min || undefined}
              max={data.max || undefined}
              step={data.step || undefined}
              autoFocus
              className="mt-1 block w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-accent"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onChooseValue(fieldRef.current?.value ?? "")}
              className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-accent"
            >
              Set
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
