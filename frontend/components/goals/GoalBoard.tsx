"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GoalForm } from "@/components/goals/GoalForm";
import { FormMessage } from "@/components/form/controls";
import { TargetIcon } from "@/components/icons";
import { deleteGoal, GOAL_STATUSES } from "@/lib/goals";
import { formatDay } from "@/lib/dates";
import type { GoalResponse, GoalStatus } from "@/types/api";

const FILTERS: { value: GoalStatus | "ALL"; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "COMPLETED", label: "Completed" },
  { value: "PAUSED", label: "Paused" },
  { value: "ALL", label: "All" },
];

export function GoalBoard({
  goals,
  filter,
  today,
}: {
  goals: GoalResponse[];
  filter: GoalStatus | "ALL";
  today: string;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(goal: GoalResponse) {
    setError(null);
    try {
      await deleteGoal(goal.id);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not delete that goal.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter goals" className="flex flex-wrap gap-1">
          {FILTERS.map((option) => (
            <Link
              key={option.value}
              href={`/goals?status=${option.value}`}
              aria-current={filter === option.value ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 text-[0.8125rem] transition-colors ${
                filter === option.value
                  ? "bg-accent-soft font-medium text-accent"
                  : "text-muted hover:bg-canvas hover:text-ink"
              }`}
            >
              {option.label}
            </Link>
          ))}
        </nav>

        {!creating ? (
          <button type="button" onClick={() => setCreating(true)} className="btn btn-primary px-4 py-2">
            New goal
          </button>
        ) : null}
      </div>

      {creating ? <GoalForm onDone={() => setCreating(false)} /> : null}

      <FormMessage error={error} />

      {goals.length === 0 && !creating ? (
        <div className="card animate-rise p-6 text-center sm:p-10">
          <span className="mx-auto grid size-11 place-items-center rounded-xl bg-accent-soft text-accent">
            <TargetIcon className="size-5" />
          </span>
          <h2 className="mt-4 text-lg font-semibold">
            {filter === "ACTIVE" ? "No active goals." : "Nothing here."}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
            A goal is what the daily tasks are for. Write down what you are
            trying to become, break it into milestones, and the percentage stops
            being something you have to guess at.
          </p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="btn btn-primary mt-5 px-4 py-2"
          >
            Create your first goal
          </button>
        </div>
      ) : null}

      <ul className="space-y-3">
        {goals.map((goal) => (
          <li key={goal.id}>
            {editing === goal.id ? (
              <GoalForm goal={goal} onDone={() => setEditing(null)} />
            ) : (
              <GoalCard
                goal={goal}
                today={today}
                onEdit={() => setEditing(goal.id)}
                onDelete={() => remove(goal)}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function GoalCard({
  goal,
  today,
  onEdit,
  onDelete,
}: {
  goal: GoalResponse;
  today: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const overdue = goal.targetDate !== null && goal.targetDate < today && goal.status === "ACTIVE";
  const statusLabel = GOAL_STATUSES.find((option) => option.value === goal.status)?.label;

  return (
    <article className={`card p-5 transition-opacity ${goal.status === "ACTIVE" ? "" : "opacity-75"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {/* The title is the way in. Milestones are edited on the goal's own
                page rather than in two places that could drift apart. */}
            <h2 className="text-sm font-medium">
              <Link href={`/goals/${goal.id}`} className="transition-colors hover:text-accent">
                {goal.title}
              </Link>
            </h2>
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
            <p className="mt-1.5 max-w-2xl text-[0.8125rem] leading-relaxed text-muted">
              {goal.description}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={onEdit} className="btn btn-ghost px-2.5 py-1.5 text-[0.8125rem]">
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="btn btn-ghost px-2.5 py-1.5 text-[0.8125rem] hover:text-danger"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-[0.6875rem] text-faint">
            {goal.progressSource === "MILESTONES"
              ? `${goal.completedMilestones} of ${goal.milestoneCount} milestones`
              : "Your own estimate"}
          </p>
          <p className="text-xs tabular-nums text-muted">{goal.progress}%</p>
        </div>

        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-accent-soft"
          role="progressbar"
          aria-valuenow={goal.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${goal.title} progress`}
        >
          <div className="animate-grow-right h-full rounded-full bg-accent" style={{ width: `${goal.progress}%` }} />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-2 text-[0.6875rem] text-faint">
          {goal.targetDate ? (
            <span className={overdue ? "font-medium text-danger" : ""}>
              Target {formatDay(goal.targetDate, { month: "long", year: "numeric" })}
              {overdue ? " · passed" : ""}
            </span>
          ) : (
            <span>No target date</span>
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <Link
          href={`/goals/${goal.id}`}
          className="text-[0.8125rem] text-muted transition-colors hover:text-accent"
        >
          {goal.milestoneCount > 0
            ? `Milestones · ${goal.completedMilestones}/${goal.milestoneCount}`
            : "Add milestones"}{" "}
          →
        </Link>
      </div>
    </article>
  );
}
