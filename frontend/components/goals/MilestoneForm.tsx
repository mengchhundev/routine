"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, FormMessage, INPUT_BLOCK } from "@/components/form/controls";
import { addMilestone, MILESTONE_STATUSES, updateMilestone } from "@/lib/goals";
import type { MilestoneDraft, MilestoneResponse, MilestoneStatus } from "@/types/api";

/**
 * The whole of a milestone: what it is, what it means, and the span it runs
 * over.
 *
 * <p>Carries no chrome of its own — every caller opens it inside a `Modal`,
 * which supplies the panel and the heading.
 */
export function MilestoneForm({
  goalId,
  milestone,
  parentId,
  onDone,
}: {
  goalId: string;
  /** Absent when creating. */
  milestone?: MilestoneResponse;
  /** Creating a sub-milestone under this parent. Ignored when editing. */
  parentId?: string | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(milestone?.title ?? "");
  const [description, setDescription] = useState(milestone?.description ?? "");
  const [startDate, setStartDate] = useState(milestone?.startDate ?? "");
  const [targetDate, setTargetDate] = useState(milestone?.targetDate ?? "");
  const [status, setStatus] = useState<MilestoneStatus>(milestone?.status ?? "PENDING");
  const [progress, setProgress] = useState(String(milestone?.ownProgress ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sub-milestones decide this milestone's percentage, so a slider that changes
  // nothing would be a lie. It disappears instead, exactly as it does on a goal.
  const derived = (milestone?.childCount ?? 0) > 0;

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (startDate && targetDate && targetDate < startDate) {
      setError("That milestone would end before it starts.");
      return;
    }

    const draft: MilestoneDraft = {
      title: title.trim(),
      description: description.trim() || null,
      startDate: startDate || null,
      targetDate: targetDate || null,
      status,
      progress: Number(progress) || 0,
    };

    setSaving(true);
    try {
      if (milestone) {
        await updateMilestone(goalId, milestone.id, draft);
      } else {
        await addMilestone(goalId, { ...draft, parentId: parentId ?? null });
      }
      router.refresh();
      onDone();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "That did not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const prefix = milestone?.id ?? parentId ?? "new";

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Milestone" htmlFor={`ms-title-${prefix}`}>
        <input
          id={`ms-title-${prefix}`}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          // The dialog opens on the field you came to fill in, so a milestone
          // that is only a title is still type-and-enter.
          autoFocus
          maxLength={200}
          placeholder="Deep understanding of Linux, foundation to advanced"
          className={INPUT_BLOCK}
        />
      </Field>

      <Field label="What this involves" htmlFor={`ms-desc-${prefix}`} optional>
        <textarea
          id={`ms-desc-${prefix}`}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          maxLength={5000}
          placeholder="What you will have done by the end of it."
          className={`${INPUT_BLOCK} resize-y leading-relaxed`}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Starts" htmlFor={`ms-start-${prefix}`} optional>
          <input
            id={`ms-start-${prefix}`}
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className={INPUT_BLOCK}
          />
        </Field>

        <Field label="By" htmlFor={`ms-target-${prefix}`} optional>
          <input
            id={`ms-target-${prefix}`}
            type="date"
            value={targetDate}
            onChange={(event) => setTargetDate(event.target.value)}
            className={INPUT_BLOCK}
          />
        </Field>

        <Field label="Status" htmlFor={`ms-status-${prefix}`}>
          <select
            id={`ms-status-${prefix}`}
            value={status}
            onChange={(event) => setStatus(event.target.value as MilestoneStatus)}
            className={INPUT_BLOCK}
          >
            {MILESTONE_STATUSES.map((option) => (
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
          htmlFor={`ms-progress-${prefix}`}
          hint="Your own estimate. Add sub-milestones and this is worked out for you instead."
        >
          <div className="flex items-center gap-3">
            <input
              id={`ms-progress-${prefix}`}
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
        <p className="rounded-lg bg-surface px-3 py-2.5 text-[0.8125rem] text-muted">
          Progress is worked out from this milestone&apos;s {milestone?.childCount} sub-milestones.
        </p>
      )}

      <FormMessage error={error} />

      <div className="flex gap-2 border-t border-line pt-4">
        <button type="submit" disabled={saving} className="btn btn-primary px-4 py-2">
          {saving ? "Saving…" : milestone ? "Save changes" : "Add milestone"}
        </button>
        <button type="button" onClick={onDone} className="btn btn-ghost px-4 py-2">
          Cancel
        </button>
      </div>
    </form>
  );
}
