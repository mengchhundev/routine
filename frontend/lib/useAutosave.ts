"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

/**
 * Debounced save for writing surfaces.
 *
 * Reflection is not a form you submit — people come back to it through the
 * evening — so there is no Save button to forget. The delay is long enough that
 * a sentence is not saved a character at a time, and a pending change is
 * flushed on unmount so navigating away never loses what was typed.
 */
export function useAutosave(save: (signal: AbortSignal) => Promise<void>, delay = 900) {
  const [status, setStatus] = useState<SaveStatus>("idle");

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controller = useRef<AbortController | null>(null);
  // Kept in a ref so the debounce timer always runs the newest closure without
  // being re-created — and therefore cancelled — on every keystroke.
  const latest = useRef(save);
  latest.current = save;

  const run = useCallback(async () => {
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;

    setStatus("saving");
    try {
      await latest.current(next.signal);
      if (!next.signal.aborted) setStatus("saved");
    } catch {
      if (!next.signal.aborted) setStatus("error");
    }
  }, []);

  const schedule = useCallback(() => {
    setStatus("pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(run, delay);
  }, [run, delay]);

  useEffect(() => {
    return () => {
      // A scheduled save that never fired is lost work; fire it now.
      if (timer.current) {
        clearTimeout(timer.current);
        void latest.current(new AbortController().signal);
      }
    };
  }, []);

  return { status, schedule };
}

export function statusLabel(status: SaveStatus): string | null {
  switch (status) {
    case "pending":
    case "saving":
      return "Saving…";
    case "saved":
      return "Saved";
    case "error":
      return "Not saved — check your connection";
    default:
      return null;
  }
}
