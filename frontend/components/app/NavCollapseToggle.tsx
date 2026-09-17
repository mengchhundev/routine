"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "routine-nav";

/**
 * Collapses the desktop rail to icons. The state lives on the root element as
 * `data-nav`, not in React: the layout grid, the labels and the tooltips all
 * key off it in CSS, so one attribute drives the whole change and an inline
 * script can apply it before first paint (see the root layout).
 */
export function NavCollapseToggle() {
  const [collapsed, setCollapsed] = useState(false);

  // The server cannot know the stored preference, so the button's label syncs
  // after mount. The rail itself is already correct — CSS got there first.
  useEffect(() => {
    setCollapsed(document.documentElement.dataset.nav === "collapsed");
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);

    if (next) {
      document.documentElement.dataset.nav = "collapsed";
    } else {
      delete document.documentElement.dataset.nav;
    }

    try {
      localStorage.setItem(STORAGE_KEY, next ? "collapsed" : "expanded");
    } catch {
      // Storage unavailable. The choice still holds for this page.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={!collapsed}
      aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
      className="nav-item group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-faint transition-colors hover:bg-canvas hover:text-muted"
    >
      <svg viewBox="0 0 24 24" className="size-[18px] shrink-0" fill="none" stroke="currentColor" aria-hidden>
        <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" strokeWidth="1.6" />
        <path d="M9.5 4.5v15" strokeWidth="1.6" />
        {/* The chevron points the way the rail will move. */}
        <path
          d={collapsed ? "m13.5 9.5 2.5 2.5-2.5 2.5" : "m16.5 9.5-2.5 2.5 2.5 2.5"}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="nav-label truncate">Collapse</span>
      <span className="nav-tip" aria-hidden>
        Expand
      </span>
    </button>
  );
}
