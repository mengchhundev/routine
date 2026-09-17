import type { RoutineDraft } from "@/types/api";

/**
 * Writes to the routine endpoints. All of them go through the same proxy route
 * as the rest of the app, so the access token stays in an httpOnly cookie.
 */
async function send(path: string, method: string, body?: unknown) {
  const response = await fetch(`/api/proxy${path}`, {
    method,
    ...(body === undefined
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    // The server explains a rejected schedule; anything else gets a generic
    // message rather than a status code the reader cannot act on.
    const problem = await response.json().catch(() => null);
    throw new Error(problem?.message ?? "That did not save. Try again.");
  }

  return response;
}

export const createRoutine = (draft: RoutineDraft) => send("/routines", "POST", draft);

export const updateRoutine = (id: string, draft: RoutineDraft) =>
  send(`/routines/${id}`, "PUT", draft);

export const setRoutineActive = (id: string, active: boolean) =>
  send(`/routines/${id}/active`, "POST", { active });

export const deleteRoutine = (id: string) => send(`/routines/${id}`, "DELETE");

/** ISO-8601 day numbers, Monday first — the order the form shows them in. */
export const WEEKDAYS = [
  { value: 1, short: "Mon", letter: "M" },
  { value: 2, short: "Tue", letter: "T" },
  { value: 3, short: "Wed", letter: "W" },
  { value: 4, short: "Thu", letter: "T" },
  { value: 5, short: "Fri", letter: "F" },
  { value: 6, short: "Sat", letter: "S" },
  { value: 7, short: "Sun", letter: "S" },
] as const;

/** One line describing when a routine runs, for the list. */
export function describeSchedule(schedule: {
  type: string;
  daysOfWeek: number[];
} | null | undefined): string {
  if (!schedule) return "No schedule";

  switch (schedule.type) {
    case "DAILY":
      return "Every day";
    case "WEEKDAYS":
      return "Weekdays";
    default: {
      const days = [...schedule.daysOfWeek].sort((a, b) => a - b);
      if (days.length === 0) return "No days chosen";
      if (days.length === 7) return "Every day";
      return days.map((day) => WEEKDAYS.find((w) => w.value === day)?.short).join(", ");
    }
  }
}
