"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormMessage } from "@/components/form/controls";
import { GoalForm } from "@/components/goals/GoalForm";
import { MilestoneSection } from "@/components/goals/MilestoneSection";
import { deleteGoal, GOAL_STATUSES } from "@/lib/goals";
import { formatDay } from "@/lib/dates";
import type { GoalResponse } from "@/types/api";

/**
 * One goal, in full: what it is, how far along it is, and the milestones that
 * decide that. The list page shows the summary and links here; this is the only
 * place milestones are edited, so there is one answer to "where do I add one".
 */
export function GoalDetail({ goal, today }: { goal: GoalResponse; today: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setError(null);
    try {
      await deleteGoal(goal.id);
      // Back to the list: the page this is on no longer exists.
      router.push("/goals");
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not delete that goal.");
    }
  }

  const overdue = goal.targetDate !== null && goal.targetDate < today && goal.status === "ACTIVE";
  const statusLabel = GOAL_STATUSES.find((option) => option.value === goal.status)?.label;

  return (
    <div className="space-y-6">
      {editing ? (
        <GoalForm goal={goal} onDone={() => setEditing(false)} />
      ) : (
        <header className="card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl leading-tight font-semibold sm:text-2xl">{goal.title}</h1>
                {goal.status !== "ACTIVE" ? (
                  <span className="rounded-full bg-canvas px-2 py-0.5 text-[0.6875rem] text-muted">
                    {statusLabel}
                  </span>
                ) : null}
                {goal.category ? (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[0.6875rem] text-accent">
                    {goal.category}
                  </span>
                ) : null}
              </div>

              {goal.description ? (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed whitespace-pre-wrap text-muted">
                  {goal.description}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="btn btn-ghost px-2.5 py-1.5 text-[0.8125rem]"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={remove}
                className="btn btn-ghost px-2.5 py-1.5 text-[0.8125rem] hover:text-danger"
              >
                Delete
              </button>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-[0.8125rem] text-muted">
                {goal.progressSource === "MILESTONES"
                  ? `${goal.completedMilestones} of ${goal.milestoneCount} milestones`
                  : "Your own estimate"}
              </p>
              <p className="text-sm tabular-nums">{goal.progress}%</p>
            </div>

            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-accent-soft"
              role="progressbar"
              aria-valuenow={goal.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${goal.title} progress`}
            >
              <div
                className="animate-grow-right h-full rounded-full bg-accent"
                style={{ width: `${goal.progress}%` }}
              />
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 text-[0.6875rem] text-faint">
              <span>
                {goal.startDate
                  ? `Started ${formatDay(goal.startDate, { month: "long", year: "numeric" })}`
                  : "No start date"}
              </span>
              <span className={overdue ? "font-medium text-danger" : ""}>
                {goal.targetDate
                  ? `Target ${formatDay(goal.targetDate, { month: "long", year: "numeric" })}${
                      overdue ? " · passed" : ""
                    }`
                  : "No target date"}
              </span>
              {goal.progressSource === "MILESTONES" ? (
                <span>Percentage worked out from the milestones below</span>
              ) : null}
            </div>
          </div>
        </header>
      )}

      <FormMessage error={error} />

      <MilestoneSection goalId={goal.id} milestones={goal.milestones ?? []} today={today} />
    </div>
  );
}
