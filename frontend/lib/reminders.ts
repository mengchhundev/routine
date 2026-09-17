import type { ReminderDraft } from "@/types/api";

/** Writes to the reminder endpoints. See lib/goals.ts for why it goes via the proxy. */
async function send(path: string, method: string, body?: unknown) {
  const response = await fetch(`/api/proxy${path}`, {
    method,
    ...(body === undefined
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new Error(problem?.message ?? "That did not save. Try again.");
  }

  return response;
}

function clean(draft: ReminderDraft) {
  return {
    ...draft,
    message: draft.message || null,
    taskId: draft.taskId || null,
    routineId: draft.routineId || null,
    goalId: draft.goalId || null,
  };
}

export const createReminder = (draft: ReminderDraft) => send("/reminders", "POST", clean(draft));

export const updateReminder = (id: string, draft: ReminderDraft) =>
  send(`/reminders/${id}`, "PUT", clean(draft));

/** Stop it firing but keep the record — deleting is the other one. */
export const cancelReminder = (id: string) => send(`/reminders/${id}/cancel`, "POST");

export const deleteReminder = (id: string) => send(`/reminders/${id}`, "DELETE");
