"use client";

import { useEffect, useState, useSyncExternalStore, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { DevicePhoto, type ScreenVariant, type ShowcaseId } from "@/components/device-photo";

type Slide = { id: ShowcaseId; variant: ScreenVariant; label: string };

const SLIDES: Slide[] = [
  { id: "iphone-se", variant: "result", label: "Run result on iPhone SE" },
  { id: "ipad-air", variant: "sizes", label: "Tablet check on iPad Air" },
  { id: "iphone-se", variant: "report", label: "Saved report" },
];

const AUTOPLAY_MS = 4500;
/** Horizontal distance a pointer must travel to count as a swipe. */
const SWIPE_PX = 60;
/** Distance between the centres of neighbouring devices. */
const SPACING_PX = 165;
const DEVICE_HEIGHT = 320;

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

/** Offset of a slide from the active one, wrapping around, so the middle slide is 0 and its neighbours are -1 and 1. */
function offsetFrom(index: number, active: number, count: number): number {
  const raw = (((index - active) % count) + count) % count;
  return raw > count / 2 ? raw - count : raw;
}

/**
 * Stack of real device photos that swipe sideways. It advances by itself, pauses while the user is interacting
 * with it, and can be moved by dragging, swiping, arrow keys, or the dots. Motion stops when reduced motion is on.
 */
export function DeviceCarousel() {
  const count = SLIDES.length;
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const reducedMotion = useReducedMotion();
  const start = useRef<number | null>(null);

  const paused = hovered || focused || dragging || reducedMotion;

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => setIndex((current) => (current + 1) % count), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [paused, count]);

  function go(next: number) {
    setIndex(((next % count) + count) % count);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    start.current = event.clientX;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (start.current === null) return;
    setDragX(event.clientX - start.current);
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (start.current === null) return;
    const distance = event.clientX - start.current;
    start.current = null;
    setDragging(false);
    setDragX(0);
    if (distance <= -SWIPE_PX) go(index + 1);
    else if (distance >= SWIPE_PX) go(index - 1);
  }

  function cancelDrag() {
    start.current = null;
    setDragging(false);
    setDragX(0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      go(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(index - 1);
    }
  }

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Device previews"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={cancelDrag}
      className="relative mx-auto w-full max-w-[460px] touch-pan-y select-none overflow-hidden rounded-3xl focus-visible:outline-2 focus-visible:outline-white/70"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-10 top-1/2 h-72 -translate-y-1/2 rounded-full bg-fuchsia-500/25 blur-3xl" />

      <div className="relative h-[400px]">
        {SLIDES.map((slide, position) => {
          const offset = offsetFrom(position, index, count);
          const active = offset === 0;
          const visible = Math.abs(offset) <= 1;
          const shift = offset * SPACING_PX + (active ? dragX : dragX * 0.4);
          return (
            <div
              key={`${slide.id}-${slide.variant}`}
              role="group"
              aria-roledescription="slide"
              aria-label={`${position + 1} of ${count}: ${slide.label}`}
              aria-hidden={!active || undefined}
              onClick={() => {
                if (!active) go(position);
              }}
              className={`absolute left-1/2 top-1/2 transition-[transform,opacity] duration-700 ease-out motion-reduce:transition-none ${
                dragging ? "!transition-none" : ""
              } ${active ? "" : "cursor-pointer"}`}
              style={{
                transform: `translate(calc(-50% + ${shift}px), -50%) scale(${active ? 1 : 0.8})`,
                opacity: active ? 1 : 0.55,
                zIndex: active ? 20 : 10,
                visibility: visible ? "visible" : "hidden",
              }}
            >
              <div className={active ? "drop-shadow-[0_25px_35px_rgba(0,0,0,0.45)]" : ""}>
                <DevicePhoto id={slide.id} height={DEVICE_HEIGHT} variant={slide.variant} />
              </div>
            </div>
          );
        })}
      </div>

      <p aria-live="polite" className="relative text-center text-sm font-medium text-white/85">
        {SLIDES[index].label}
      </p>
      <div className="relative mt-3 flex items-center justify-center gap-2">
        {SLIDES.map((slide, position) => (
          <button
            key={`dot-${position}`}
            type="button"
            aria-label={`Show ${slide.label}`}
            aria-current={position === index ? "true" : undefined}
            onClick={() => go(position)}
            className={`h-2 rounded-full transition-all duration-300 focus-visible:outline-2 focus-visible:outline-white ${
              position === index ? "w-6 bg-white" : "w-2 bg-white/40 hover:bg-white/70"
            }`}
          />
        ))}
      </div>
      <p className="relative mt-2 text-center text-[11px] text-white/55">Swipe, drag, or use the arrow keys. Sample screens.</p>
    </div>
  );
}
