import type { TaskDraft } from "@/types/api";

/**
 * One definition of "add a task to a day", shared by every card that offers it,
 * so the payload and the failure both stay identical wherever it is called.
 */
export async function createTask(title: string, dueDate: string, dueTime?: string | null) {
  const response = await fetch("/api/proxy/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, dueDate, dueTime: dueTime || null, priority: "MEDIUM" }),
  });
  if (!response.ok) throw new Error(`Task create failed: ${response.status}`);
}

/** Full create and edit, for the Tasks screen's form. */
export async function saveTask(draft: TaskDraft, id?: string) {
  const response = await fetch(id ? `/api/proxy/tasks/${id}` : "/api/proxy/tasks", {
    method: id ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...draft,
      description: draft.description || null,
      category: draft.category || null,
      dueDate: draft.dueDate || null,
      dueTime: draft.dueTime || null,
    }),
  });

  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new Error(problem?.message ?? "That did not save. Try again.");
  }
}

export async function deleteTask(id: string) {
  const response = await fetch(`/api/proxy/tasks/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Could not delete that task.");
}

/** complete · skip · reopen · reschedule — the transitions the API models. */
export async function actOnTask(id: string, action: string, body?: unknown) {
  const response = await fetch(`/api/proxy/tasks/${id}/${action}`, {
    method: "POST",
    ...(body === undefined
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error("That did not save. Check your connection and try again.");
}
