"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "@/components/icons";

const STORAGE_KEY = "routine-theme";

/**
 * Flips between light and dark and remembers the choice. Until the user makes
 * one, nothing is stored and the OS preference governs — so the default is
 * "whatever the rest of their system does", not an opinion of ours.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [isDark, setIsDark] = useState<boolean | null>(null);

  useEffect(() => {
    const stored = readStoredTheme();
    setIsDark(stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // Private mode, or storage disabled. The choice still applies to this page.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      // The label is only meaningful once we know the current theme, and that
      // is client-only knowledge — so the icon stays neutral until mount.
      aria-label={isDark === null ? "Toggle theme" : isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={`btn btn-ghost size-9 rounded-lg p-0 ${className}`}
    >
      {isDark ? <MoonIcon className="size-[18px]" /> : <SunIcon className="size-[18px]" />}
    </button>
  );
}

function readStoredTheme(): "light" | "dark" | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}
