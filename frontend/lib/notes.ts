/** Writes to the note endpoints. See lib/goals.ts for why it goes via the proxy. */

export type NoteDraft = {
  title?: string | null;
  content: string;
  noteDate?: string | null;
  goalId?: string | null;
  taskId?: string | null;
  routineId?: string | null;
};

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

function clean(draft: NoteDraft) {
  return {
    ...draft,
    title: draft.title || null,
    noteDate: draft.noteDate || null,
    goalId: draft.goalId || null,
    taskId: draft.taskId || null,
    routineId: draft.routineId || null,
  };
}

export const createNote = (draft: NoteDraft) => send("/notes", "POST", clean(draft));

export const updateNote = (id: string, draft: NoteDraft) => send(`/notes/${id}`, "PUT", clean(draft));

export const deleteNote = (id: string) => send(`/notes/${id}`, "DELETE");
