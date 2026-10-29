"use client";

import { useRef, type PointerEvent, type ReactNode } from "react";

/**
 * Brand panel that follows the pointer. It only writes CSS variables, so moving the mouse never re-renders React.
 * --mx and --my place the spotlight (0% to 100%). --px and --py are -1 to 1 and drive the devices' parallax.
 */
export function AuthPanel({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  function handleMove(event: PointerEvent<HTMLElement>) {
    const panel = ref.current;
    if (!panel) return;
    const box = panel.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    panel.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
    panel.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
    panel.style.setProperty("--px", ((x - 0.5) * 2).toFixed(3));
    panel.style.setProperty("--py", ((y - 0.5) * 2).toFixed(3));
  }

  function handleLeave() {
    const panel = ref.current;
    if (!panel) return;
    for (const [name, value] of [["--mx", "30%"], ["--my", "25%"], ["--px", "0"], ["--py", "0"]]) {
      panel.style.setProperty(name, value);
    }
  }

  return (
    <aside
      ref={ref}
      aria-label="About Emulix"
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-ink via-brand-deep to-brand-plum p-12 text-white [--mx:30%] [--my:25%] [--px:0] [--py:0] lg:flex"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:26px_26px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-10 h-96 w-96 rounded-full bg-brand-blue/30 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -right-16 h-96 w-96 rounded-full bg-fuchsia-500/30 blur-3xl" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-[background] duration-200 [background:radial-gradient(420px_circle_at_var(--mx)_var(--my),rgba(255,255,255,0.14),transparent_65%)]"
      />
      {children}
    </aside>
  );
}
