import { readChoice, writeChoice } from "@/lib/storedChoice";

/**
 * How the Tasks screen is laid out, owned by the reader. Kept in the browser,
 * not the URL, for the same reasons as the planner's (see `plannerLayout.ts`):
 * the URL carries the filter and search, which are about what you are looking
 * at, not how.
 */
export type TasksLayout = "list" | "card";

export const TASKS_LAYOUTS: TasksLayout[] = ["list", "card"];

/** A list, because this screen is for scanning many tasks at once. */
export const DEFAULT_TASKS_LAYOUT: TasksLayout = "list";

const STORAGE_KEY = "routine-tasks-layout";

export const readTasksLayout = () => readChoice(STORAGE_KEY, TASKS_LAYOUTS, DEFAULT_TASKS_LAYOUT);
export const writeTasksLayout = (layout: TasksLayout) => writeChoice(STORAGE_KEY, layout);
