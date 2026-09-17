"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckIcon } from "@/components/icons";
import { createTask } from "@/lib/tasks";
import type { TaskResponse, TaskStatus } from "@/types/api";

type Patch = { id: string; status: TaskStatus };

export function TodayTasks({
  tasks,
  date,
  progress,
}: {
  tasks: TaskResponse[];
  date: string;
  /** The server's own count. See `displayed` below for why it is not recomputed. */
  progress: { planned: number; completed: number };
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Checking a box should feel instant. The optimistic state carries the row
  // until the server confirms, and router.refresh() then re-derives the
  // progress figures above from the real data rather than guessing them here.
  const [optimisticTasks, applyPatch] = useOptimistic(tasks, (state, patch: Patch) =>
    state.map((task) => (task.id === patch.id ? { ...task, status: patch.status } : task)),
  );

  function act(task: TaskResponse, action: "complete" | "reopen" | "skip", nextStatus: TaskStatus) {
    setError(null);
    startTransition(async () => {
      applyPatch({ id: task.id, status: nextStatus });
      try {
        const response = await fetch(`/api/proxy/tasks/${task.id}/${action}`, { method: "POST" });
        if (!response.ok) throw new Error();
        router.refresh();
      } catch {
        // The optimistic value is discarded when the transition ends, so the
        // row snaps back on its own — all that is left to do is say why.
        setError("That did not save. Check your connection and try again.");
      }
    });
  }

  async function addTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const title = String(new FormData(form).get("title") ?? "").trim();
    if (!title) return;

    setAdding(true);
    setError(null);
    try {
      await createTask(title, date);
      form.reset();
      router.refresh();
      // Adding tasks comes in bursts, so keep the caret where it was.
      inputRef.current?.focus();
    } catch {
      setError("Could not add that task. Try again.");
    } finally {
      setAdding(false);
    }
  }

  // The server's definition of the ratio is not this list's length: it drops
  // cancelled tasks from `planned` and counts completion records rather than
  // current status. Recomputing it here would put a different number on this
  // card than on the week tile, so the server's figure stands and only the
  // toggle the user just made is applied on top — a delta that falls back to
  // zero the moment the refresh lands.
  const pending =
    optimisticTasks.filter((task) => task.status === "COMPLETED").length -
    tasks.filter((task) => task.status === "COMPLETED").length;

  const planned = progress.planned;
  const done = Math.min(Math.max(progress.completed + pending, 0), planned);
  const percent = planned === 0 ? 0 : Math.round((done / planned) * 100);

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="today-tasks-heading">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="today-tasks-heading" className="text-sm font-medium">
          Today
        </h2>
        <Link href="/today" className="text-[0.8125rem] text-accent transition-opacity hover:opacity-80">
          Open Today
        </Link>
      </div>

      {/* The day's ratio belongs on the day's list. Split across two cards it
          was the same fact twice, and the reader had to hold one to read the
          other. */}
      {planned > 0 ? (
        <div className="mt-4">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-[2rem] leading-none font-semibold">
              {percent}
              <span className="text-lg font-medium text-muted">%</span>
            </p>
            <p className="text-[0.8125rem] text-muted">
              <span className="font-medium text-ink tabular-nums">{done}</span> of{" "}
              <span className="tabular-nums">{planned}</span> done
              {planned - done > 0 ? (
                <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-[0.6875rem] font-medium text-accent">
                  {planned - done} left
                </span>
              ) : (
                <span className="ml-2 rounded-full bg-positive-soft px-2 py-0.5 text-[0.6875rem] font-medium text-positive">
                  All done
                </span>
              )}
            </p>
          </div>

          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-accent-soft"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Today's completion: ${done} of ${planned} tasks`}
          >
            <div
              className="animate-grow-right h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      ) : null}

      {optimisticTasks.length === 0 ? (
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Nothing planned for today. Add the first thing you actually intend to
          do — one is enough to start.
        </p>
      ) : (
        <ul className="mt-5 -mx-2 border-t border-line pt-2">
          {optimisticTasks.map((task) => {
            const completed = task.status === "COMPLETED";
            const skipped = task.status === "SKIPPED";

            return (
              <li
                key={task.id}
                className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-canvas"
              >
                <button
                  type="button"
                  onClick={() =>
                    act(task, completed ? "reopen" : "complete", completed ? "TODO" : "COMPLETED")
                  }
                  aria-pressed={completed}
                  aria-label={completed ? `Reopen ${task.title}` : `Complete ${task.title}`}
                  className={`grid size-5 shrink-0 place-items-center rounded-md border transition-colors ${
                    completed
                      ? "animate-check-pop border-positive bg-positive text-white"
                      : "border-line-strong hover:border-accent"
                  }`}
                >
                  {completed ? <CheckIcon className="size-3" /> : null}
                </button>

                <span
                  className={`min-w-0 flex-1 truncate text-sm ${
                    completed || skipped ? "text-muted line-through" : ""
                  }`}
                >
                  {task.title}
                </span>

                {task.priority === "HIGH" && !completed ? (
                  <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[0.6875rem] font-medium text-accent">
                    High
                  </span>
                ) : null}

                {task.dueTime ? (
                  <span className="shrink-0 text-xs tabular-nums text-faint">
                    {task.dueTime.slice(0, 5)}
                  </span>
                ) : null}

                {/* Revealed on hover and on keyboard focus — focus-within keeps
                    it reachable without a pointer. */}
                {!completed && !skipped ? (
                  <button
                    type="button"
                    onClick={() => act(task, "skip", "SKIPPED")}
                    className="shrink-0 text-xs text-faint opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                  >
                    Skip
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={addTask} className="mt-4 flex gap-2 border-t border-line pt-4">
        <input
          ref={inputRef}
          name="title"
          maxLength={200}
          placeholder="Add a task for today…"
          aria-label="New task title"
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm placeholder:text-faint transition-colors hover:border-line-strong focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/12"
        />
        <button type="submit" disabled={adding} className="btn btn-primary px-4 py-2">
          {adding ? "Adding…" : "Add"}
        </button>
      </form>

      {error ? (
        <p role="alert" className="mt-3 text-[0.8125rem] text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}
