"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { NavList } from "@/components/app/NavList";

/**
 * Below lg the nav lives behind a drawer rather than a horizontal scroller.
 * Nine destinations do not fit across a phone, and a scroller hides most of
 * them behind a gesture with no affordance.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  // Any navigation closes the drawer, including a browser back that lands on a
  // different section while it is open.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);

    // Stop the page behind the drawer from scrolling with it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    panel.current?.querySelector<HTMLElement>("a, button")?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
      // Send focus back where it came from, not to the top of the document.
      trigger.current?.focus();
    };
  }, [open]);

  const drawer = (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        aria-label="Close navigation"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
      />

      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Sections"
        className="absolute inset-y-0 left-0 flex w-[17rem] max-w-[85vw] flex-col border-r border-line bg-surface shadow-lift"
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-4">
          <p className="text-xs font-semibold tracking-[0.12em] text-faint uppercase">Sections</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
            className="btn btn-ghost size-9 rounded-lg p-0"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" aria-hidden>
              <path d="m6 6 12 12M18 6 6 18" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-6">
          <NavList onNavigate={() => setOpen(false)} />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        aria-expanded={open}
        className="btn btn-ghost -ml-1 size-9 rounded-lg p-0 lg:hidden"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h16" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {/* Rendered at the document root on purpose. The header sets
          backdrop-blur, and a filtered ancestor becomes the containing block
          for position:fixed — which pinned the drawer inside the 4rem header
          instead of the viewport. A portal is the only reliable escape. */}
      {open && mounted ? createPortal(drawer, document.body) : null}
    </>
  );
}
