"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INPUT } from "@/components/form/controls";
import { saveTask } from "@/lib/tasks";
import type { TaskPriority, TaskResponse } from "@/types/api";

const PRIORITIES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH"];

export const PRIORITY_DOT: Record<TaskPriority, string> = {
  LOW: "bg-line-strong",
  MEDIUM: "bg-accent/50",
  HIGH: "bg-danger",
};

/**
 * The full task, as opposed to the one-line "add" on Today. This is where a
 * task gets a day, a time, a priority and a category — the fields the quick add
 * deliberately leaves out so that adding stays quick.
 */
export function TaskForm({ task, onDone }: { task?: TaskResponse; onDone: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [category, setCategory] = useState(task?.category ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "MEDIUM");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");
  const [dueTime, setDueTime] = useState(task?.dueTime?.slice(0, 5) ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await saveTask(
        { title: title.trim(), description, category, priority, dueDate, dueTime },
        task?.id,
      );
      router.refresh();
      onDone();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "That did not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label htmlFor="task-title" className="text-[0.8125rem] font-medium">
          Title
        </label>
        <input
          id="task-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          maxLength={200}
          placeholder="Study Kubernetes"
          className={`${INPUT} mt-1.5 w-full`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
        <div>
          <label htmlFor="task-date" className="text-[0.8125rem] font-medium">
            Due date
            <span className="ml-1.5 font-normal text-faint">optional</span>
          </label>
          <input
            id="task-date"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className={`${INPUT} mt-1.5 w-full`}
          />
          <p className="mt-1 text-[0.6875rem] text-faint">
            Leave empty to keep it in the backlog.
          </p>
        </div>

        <div>
          <label htmlFor="task-time" className="text-[0.8125rem] font-medium">
            Time
            <span className="ml-1.5 font-normal text-faint">optional</span>
          </label>
          <input
            id="task-time"
            type="time"
            value={dueTime}
            onChange={(event) => setDueTime(event.target.value)}
            className={`${INPUT} mt-1.5 w-full`}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <label htmlFor="task-category" className="text-[0.8125rem] font-medium">
            Category
            <span className="ml-1.5 font-normal text-faint">optional</span>
          </label>
          <input
            id="task-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            maxLength={80}
            placeholder="Learning"
            className={`${INPUT} mt-1.5 w-full`}
          />
        </div>

        <fieldset>
          <legend className="text-[0.8125rem] font-medium">Priority</legend>
          <div className="mt-1.5 inline-flex gap-0.5 rounded-lg border border-line bg-canvas p-0.5">
            {PRIORITIES.map((option) => (
              <label
                key={option}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-[0.8125rem] transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
                  priority === option ? "bg-surface font-medium text-ink shadow-card" : "text-muted hover:text-ink"
                }`}
              >
                <input
                  type="radio"
                  name="priority"
                  checked={priority === option}
                  onChange={() => setPriority(option)}
                  className="sr-only"
                />
                <span aria-hidden className={`size-1.5 rounded-full ${PRIORITY_DOT[option]}`} />
                {option.charAt(0) + option.slice(1).toLowerCase()}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div>
        <label htmlFor="task-description" className="text-[0.8125rem] font-medium">
          Notes
          <span className="ml-1.5 font-normal text-faint">optional</span>
        </label>
        <textarea
          id="task-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          maxLength={5000}
          placeholder="Anything worth remembering about this task."
          className={`${INPUT} mt-1.5 w-full resize-y leading-relaxed`}
        />
      </div>

      {error ? (
        <p role="alert" className="text-[0.8125rem] text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <button type="button" onClick={onDone} className="btn btn-ghost px-4 py-2">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn btn-primary px-4 py-2">
          {saving ? "Saving…" : task ? "Save changes" : "Add task"}
        </button>
      </div>
    </form>
  );
}
