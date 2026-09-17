import { readChoice, writeChoice } from "@/lib/storedChoice";

/**
 * How the planner is laid out, owned by the reader.
 *
 * Stored in localStorage rather than in the URL for the same reason as the
 * milestone layout (see `milestoneLayout.ts`): the URL says which week you are
 * looking at, not how you like to look at weeks.
 */
export type PlannerLayout = "card" | "list";

export const PLANNER_LAYOUTS: PlannerLayout[] = ["card", "list"];

/** Cards, because a week reads first as seven separate days. */
export const DEFAULT_PLANNER_LAYOUT: PlannerLayout = "card";

const STORAGE_KEY = "routine-planner-layout";

export const readPlannerLayout = () => readChoice(STORAGE_KEY, PLANNER_LAYOUTS, DEFAULT_PLANNER_LAYOUT);
export const writePlannerLayout = (layout: PlannerLayout) => writeChoice(STORAGE_KEY, layout);
