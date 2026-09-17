/**
 * A per-browser preference picked from a fixed set: a layout, a view.
 *
 * Anything stored can be stale or hand-edited, so it is checked against the
 * options rather than trusted, and unreadable storage falls back to the
 * default instead of breaking the screen.
 */
export function readChoice<T extends string>(key: string, options: readonly T[], fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return options.includes(stored as T) ? (stored as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeChoice(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable. The choice still holds for this visit.
  }
}
