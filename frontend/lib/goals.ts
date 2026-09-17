import type { GoalDraft, MilestoneDraft, MilestoneStatus } from "@/types/api";

/**
 * Writes to the goal endpoints, through the same proxy route as everything
 * else, so the access token stays in an httpOnly cookie.
 */
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

/** Empty strings from a form are "not set", which the API spells as null. */
function clean(draft: GoalDraft) {
  return {
    ...draft,
    description: draft.description || null,
    category: draft.category || null,
    startDate: draft.startDate || null,
    targetDate: draft.targetDate || null,
  };
}

export const createGoal = (draft: GoalDraft) => send("/goals", "POST", clean(draft));

export const updateGoal = (id: string, draft: GoalDraft) => send(`/goals/${id}`, "PUT", clean(draft));

export const deleteGoal = (id: string) => send(`/goals/${id}`, "DELETE");

/** Empty strings from a form are "not set", which the API spells as null. */
function cleanMilestone(draft: MilestoneDraft) {
  return {
    ...draft,
    description: draft.description || null,
    startDate: draft.startDate || null,
    targetDate: draft.targetDate || null,
    parentId: draft.parentId || null,
  };
}

export const addMilestone = (goalId: string, draft: MilestoneDraft) =>
  send(`/goals/${goalId}/milestones`, "POST", cleanMilestone(draft));

export const updateMilestone = (goalId: string, milestoneId: string, draft: MilestoneDraft) =>
  send(`/goals/${goalId}/milestones/${milestoneId}`, "PUT", cleanMilestone(draft));

export const setMilestoneStatus = (goalId: string, milestoneId: string, status: MilestoneStatus) =>
  send(`/goals/${goalId}/milestones/${milestoneId}/status`, "POST", { status });

export const deleteMilestone = (goalId: string, milestoneId: string) =>
  send(`/goals/${goalId}/milestones/${milestoneId}`, "DELETE");

/** Ordering is per level: `parentId` says which one, null for the goal's own steps. */
export const reorderMilestones = (goalId: string, parentId: string | null, order: string[]) =>
  send(`/goals/${goalId}/milestones/order`, "POST", { parentId, order });

export const GOAL_STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "PAUSED", label: "Paused" },
  { value: "COMPLETED", label: "Completed" },
  { value: "ABANDONED", label: "Abandoned" },
] as const;

/**
 * The milestone states, in the order a milestone moves through them. Skipped
 * last, because it is a decision rather than a step.
 */
export const MILESTONE_STATUSES = [
  { value: "PENDING", label: "Not started" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETED", label: "Done" },
  { value: "SKIPPED", label: "Skipped" },
] as const;
