/**
 * How the milestone list is laid out, owned by the reader.
 *
 * Stored in localStorage rather than in the URL, because this is not where you
 * are — it is how you like to look. A link to a goal should open that goal the
 * way the person opening it prefers, not the way the person who sent it does.
 * Kept alongside the Today screen's arrangement for the same reasons, written
 * up in `todayLayout.ts`.
 */
export type MilestoneLayout = "list" | "grid";

export const MILESTONE_LAYOUTS: MilestoneLayout[] = ["list", "grid"];

/**
 * A list, because milestones are a sequence before they are a collection: the
 * order is the plan, and a single column is the only shape that states it
 * without the reader having to work out which way the eye travels.
 */
export const DEFAULT_MILESTONE_LAYOUT: MilestoneLayout = "list";

const STORAGE_KEY = "routine-milestone-layout";

export function readMilestoneLayout(): MilestoneLayout {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    // Anything stored can be stale or hand-edited, so it is checked rather
    // than trusted — an unknown value is simply the default.
    return MILESTONE_LAYOUTS.includes(stored as MilestoneLayout)
      ? (stored as MilestoneLayout)
      : DEFAULT_MILESTONE_LAYOUT;
  } catch {
    // Unreadable storage is not worth a broken screen.
    return DEFAULT_MILESTONE_LAYOUT;
  }
}

export function writeMilestoneLayout(layout: MilestoneLayout) {
  try {
    localStorage.setItem(STORAGE_KEY, layout);
  } catch {
    // Storage unavailable. The choice still holds for this visit.
  }
}
