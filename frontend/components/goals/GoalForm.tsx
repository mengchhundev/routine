"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, FormMessage, INPUT, INPUT_BLOCK } from "@/components/form/controls";
import { createGoal, GOAL_STATUSES, updateGoal } from "@/lib/goals";
import type { GoalDraft, GoalResponse, GoalStatus } from "@/types/api";

/**
 * Creating and editing are the same form, because they are the same decision:
 * what you are trying to become, and by when.
 */
export function GoalForm({ goal, onDone }: { goal?: GoalResponse; onDone: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState(goal?.title ?? "");
  const [description, setDescription] = useState(goal?.description ?? "");
  const [category, setCategory] = useState(goal?.category ?? "");
  const [startDate, setStartDate] = useState(goal?.startDate ?? "");
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? "");
  const [status, setStatus] = useState<GoalStatus>(goal?.status ?? "ACTIVE");
  const [progress, setProgress] = useState(String(goal?.manualProgress ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Once a goal has milestones they decide the percentage, so offering a slider
  // that does nothing would be a lie. The field disappears instead.
  const derived = (goal?.milestoneCount ?? 0) > 0;

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (targetDate && startDate && targetDate < startDate) {
      setError("The target date is before the start date.");
      return;
    }

    const draft: GoalDraft = {
      title: title.trim(),
      description: description.trim() || null,
      category: category.trim() || null,
      startDate: startDate || null,
      targetDate: targetDate || null,
      status,
      progress: Number(progress) || 0,
    };

    setSaving(true);
    try {
      if (goal) {
        await updateGoal(goal.id, draft);
      } else {
        await createGoal(draft);
      }
      router.refresh();
      onDone();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "That did not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="card animate-rise space-y-5 p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Field label="Goal" htmlFor="goal-title">
          <input
            id="goal-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            maxLength={200}
            placeholder="Become a Senior DevOps Engineer"
            className={INPUT_BLOCK}
          />
        </Field>

        <Field label="Category" htmlFor="goal-category" optional>
          <input
            id="goal-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            maxLength={80}
            placeholder="Career"
            className={INPUT_BLOCK}
          />
        </Field>
      </div>

      <Field label="What this means" htmlFor="goal-description" optional>
        <textarea
          id="goal-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          maxLength={5000}
          placeholder="What becoming this actually looks like, in your own words."
          className={`${INPUT_BLOCK} resize-y leading-relaxed`}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Starts" htmlFor="goal-start" optional>
          <input
            id="goal-start"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className={INPUT_BLOCK}
          />
        </Field>

        <Field label="Target" htmlFor="goal-target" optional>
          <input
            id="goal-target"
            type="date"
            value={targetDate}
            onChange={(event) => setTargetDate(event.target.value)}
            className={INPUT_BLOCK}
          />
        </Field>

        <Field label="Status" htmlFor="goal-status">
          <select
            id="goal-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as GoalStatus)}
            className={INPUT_BLOCK}
          >
            {GOAL_STATUSES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {!derived ? (
        <Field
          label="Progress"
          htmlFor="goal-progress"
          hint="Your own estimate. Add milestones and this is worked out for you instead."
        >
          <div className="flex items-center gap-3">
            <input
              id="goal-progress"
              type="range"
              min={0}
              max={100}
              step={5}
              value={progress}
              onChange={(event) => setProgress(event.target.value)}
              className="h-1.5 flex-1 accent-[var(--color-accent)]"
            />
            <span className="w-12 text-right text-sm tabular-nums text-muted">{progress}%</span>
          </div>
        </Field>
      ) : (
        <p className="rounded-lg bg-canvas px-3 py-2.5 text-[0.8125rem] text-muted">
          Progress is worked out from this goal&apos;s {goal?.milestoneCount} milestones.
        </p>
      )}

      <FormMessage error={error} />

      <div className="flex gap-2 border-t border-line pt-4">
        <button type="submit" disabled={saving} className="btn btn-primary px-4 py-2">
          {saving ? "Saving…" : goal ? "Save changes" : "Create goal"}
        </button>
        <button type="button" onClick={onDone} className="btn btn-ghost px-4 py-2">
          Cancel
        </button>
      </div>
    </form>
  );
}
