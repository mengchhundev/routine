"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  PlusIcon,
  RepeatIcon,
  TrashIcon,
  XIcon,
} from "@/components/icons";
import { createTask } from "@/lib/tasks";
import { formatDay, shiftDay } from "@/lib/dates";
import type { TaskResponse, TaskStatus } from "@/types/api";

type Patch = { id: string; status: TaskStatus } | { id: string; removed: true };

export function DayTasks({
  tasks,
  date,
  progress,
}: {
  tasks: TaskResponse[];
  date: string;
  /** The server's own count — see `done` below for why it is not recomputed. */
  progress: { planned: number; completed: number };
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);

  const nextDay = shiftDay(date, 1);
  const nextDayLabel = formatDay(nextDay, { weekday: "short" });

  const [optimisticTasks, applyPatch] = useOptimistic(tasks, (state, patch: Patch) =>
    "removed" in patch
      ? state.filter((task) => task.id !== patch.id)
      : state.map((task) => (task.id === patch.id ? { ...task, status: patch.status } : task)),
  );

  function mutate(patch: Patch, request: () => Promise<Response>, failure: string) {
    setError(null);
    startTransition(async () => {
      applyPatch(patch);
      try {
        const response = await request();
        if (!response.ok) throw new Error();
        router.refresh();
      } catch {
        // The optimistic value is dropped when the transition ends, so the row
        // returns on its own; all that remains is to say why.
        setError(failure);
      }
    });
  }

  const post = (id: string, action: string, body?: unknown) => () =>
    fetch(`/api/proxy/tasks/${id}/${action}`, {
      method: "POST",
      ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    });

  async function addTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();
    if (!title) return;

    setBusy(true);
    setError(null);
    try {
      await createTask(title, date, String(data.get("dueTime") ?? "").trim());
      form.reset();
      router.refresh();
      // Planning a day happens in bursts, so keep the caret in the title field.
      titleRef.current?.focus();
    } catch {
      setError("Could not add that task. Try again.");
    } finally {
      setBusy(false);
    }
  }

  // The server's ratio is not this list's length: it drops cancelled tasks from
  // `planned` and counts completion records rather than current status. Only the
  // toggle the user just made is applied on top, and that delta falls back to
  // zero the moment the refresh lands.
  const pending =
    optimisticTasks.filter((task) => task.status === "COMPLETED").length -
    tasks.filter((task) => task.status === "COMPLETED").length;

  const planned = progress.planned;
  const done = Math.min(Math.max(progress.completed + pending, 0), planned);
  const percent = planned === 0 ? 0 : Math.round((done / planned) * 100);

  // Open work first, finished work gathered beneath it: the list a reader is
  // working through should not get longer as they tick things off.
  const open = optimisticTasks.filter((task) => task.status === "TODO" || task.status === "IN_PROGRESS");
  const closed = optimisticTasks.filter((task) => !open.includes(task));
  const anySkipped = closed.some((task) => task.status !== "COMPLETED");

  const rowProps = {
    nextDayLabel,
    onToggle: (task: TaskResponse) => {
      const completed = task.status === "COMPLETED";
      mutate(
        { id: task.id, status: completed ? "TODO" : "COMPLETED" },
        post(task.id, completed ? "reopen" : "complete"),
        "That did not save. Check your connection and try again.",
      );
    },
    onSkip: (task: TaskResponse) =>
      mutate({ id: task.id, status: "SKIPPED" }, post(task.id, "skip"), "Could not skip that task."),
    onMove: (task: TaskResponse) =>
      mutate(
        { id: task.id, removed: true },
        post(task.id, "reschedule", { dueDate: nextDay }),
        "Could not move that task.",
      ),
    onDelete: (task: TaskResponse) =>
      mutate(
        { id: task.id, removed: true },
        () => fetch(`/api/proxy/tasks/${task.id}`, { method: "DELETE" }),
        "Could not delete that task.",
      ),
  };

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="day-tasks-heading">
      {/* The day's ratio sits on the day's list. As its own card it was the
          same fact stated twice, a card-height apart. */}
      <div className="flex items-center gap-4">
        <Ring percent={percent} planned={planned} label={`Completion for this day: ${done} of ${planned} tasks`} />

        <div className="min-w-0 flex-1">
          <h2 id="day-tasks-heading" className="text-base font-semibold">
            Tasks
          </h2>
          <p className="mt-0.5 text-[0.8125rem] text-muted">
            {planned === 0 ? (
              "Nothing planned yet"
            ) : (
              <>
                <span className="font-medium text-ink tabular-nums">{done}</span> of{" "}
                <span className="tabular-nums">{planned}</span> done
              </>
            )}
          </p>
        </div>

        {planned > 0 ? (
          planned - done > 0 ? (
            <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-[0.75rem] font-medium text-accent tabular-nums">
              {planned - done} left
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-positive-soft px-2.5 py-1 text-[0.75rem] font-medium text-positive">
              All done
            </span>
          )
        ) : null}
      </div>

      <form onSubmit={addTask} className="mt-5">
        <div className="flex items-center gap-1.5 rounded-xl border border-line bg-canvas py-1.5 pr-1.5 pl-3 transition-[border-color,background-color,box-shadow] focus-within:border-accent focus-within:bg-surface focus-within:ring-4 focus-within:ring-accent/12 hover:border-line-strong">
          <PlusIcon className="size-4 shrink-0 text-faint" />
          <input
            ref={titleRef}
            name="title"
            maxLength={200}
            placeholder="Add a task…"
            aria-label="New task title"
            className="min-w-0 flex-1 bg-transparent px-1 py-1.5 text-sm placeholder:text-faint focus:outline-none"
          />

          {/* Most tasks are "today", not "today at 14:30". An empty native time
              field renders as `--:-- --`, which reads as broken sitting in the
              primary row, so it waits behind its own control. */}
          <button
            type="button"
            onClick={() => {
              setShowTime((open) => !open);
              if (!showTime) requestAnimationFrame(() => timeRef.current?.focus());
            }}
            aria-expanded={showTime}
            aria-controls="new-task-time"
            aria-label={showTime ? "Remove the time" : "Add a time"}
            title={showTime ? "Remove the time" : "Add a time"}
            className={`grid size-8 shrink-0 place-items-center rounded-lg transition-colors ${
              showTime ? "bg-accent-soft text-accent" : "text-faint hover:bg-surface hover:text-muted"
            }`}
          >
            <ClockIcon className="size-4" />
          </button>

          <button type="submit" disabled={busy} className="btn btn-primary shrink-0 px-3.5 py-1.5 text-[0.8125rem]">
            {busy ? "Adding…" : "Add"}
          </button>
        </div>

        {/* Kept mounted so the value survives a toggle, and so the field is
            still submitted if it is filled and then hidden. */}
        <div id="new-task-time" hidden={!showTime} className="mt-2 flex items-center gap-2 pl-1">
          <label htmlFor="new-task-due-time" className="text-[0.8125rem] text-muted">
            At
          </label>
          <input
            ref={timeRef}
            id="new-task-due-time"
            name="dueTime"
            type="time"
            className="w-32 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm transition-colors hover:border-line-strong focus:border-accent focus:ring-4 focus:ring-accent/12 focus:outline-none"
          />
        </div>
      </form>

      {error ? (
        <p role="alert" className="mt-3 text-[0.8125rem] text-danger">
          {error}
        </p>
      ) : null}

      {optimisticTasks.length === 0 ? (
        <div className="mt-5 flex flex-col items-center rounded-xl border border-dashed border-line px-6 py-10 text-center">
          <span className="grid size-10 place-items-center rounded-full bg-accent-soft text-accent">
            <CheckIcon className="size-4" />
          </span>
          <p className="mt-3 text-sm font-medium">A clear day</p>
          <p className="mt-1 max-w-xs text-[0.8125rem] leading-relaxed text-muted">
            Add the first thing you actually intend to do — one is enough to start.
          </p>
        </div>
      ) : (
        <div className="mt-4 -mx-2 space-y-4">
          {open.length > 0 ? (
            <ul className="space-y-0.5">
              {open.map((task) => (
                <TaskRow key={task.id} task={task} {...rowProps} />
              ))}
            </ul>
          ) : (
            <p className="px-3 py-2 text-[0.8125rem] text-muted">Everything planned is dealt with.</p>
          )}

          {closed.length > 0 ? (
            <div>
              <h3 className="flex items-center gap-2 px-3 pb-1.5 text-[0.6875rem] font-semibold tracking-[0.08em] text-faint uppercase">
                {anySkipped ? "Done & skipped" : "Done"}
                <span className="tabular-nums">{closed.length}</span>
                <span aria-hidden className="h-px flex-1 bg-line" />
              </h3>
              <ul className="space-y-0.5">
                {closed.map((task) => (
                  <TaskRow key={task.id} task={task} {...rowProps} />
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

/** A ring rather than a bar: it states the day's rate in the heading's own row. */
function Ring({ percent, planned, label }: { percent: number; planned: number; label: string }) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const complete = planned > 0 && percent === 100;

  return (
    <div
      className="relative grid size-12 shrink-0 place-items-center"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <svg viewBox="0 0 48 48" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle cx="24" cy="24" r={radius} fill="none" strokeWidth="4" className="stroke-accent-soft" />
        {planned > 0 ? (
          <circle
            cx="24"
            cy="24"
            r={radius}
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - percent / 100)}
            className={`transition-[stroke-dashoffset] duration-500 ease-out ${complete ? "stroke-positive" : "stroke-accent"}`}
          />
        ) : null}
      </svg>
      {complete ? (
        <CheckIcon className="size-4 text-positive" />
      ) : (
        <span className="text-[0.6875rem] font-semibold tabular-nums">{planned === 0 ? "—" : `${percent}%`}</span>
      )}
    </div>
  );
}

function TaskRow({
  task,
  nextDayLabel,
  onToggle,
  onSkip,
  onMove,
  onDelete,
}: {
  task: TaskResponse;
  nextDayLabel: string;
  onToggle: (task: TaskResponse) => void;
  onSkip: (task: TaskResponse) => void;
  onMove: (task: TaskResponse) => void;
  onDelete: (task: TaskResponse) => void;
}) {
  const completed = task.status === "COMPLETED";
  const skipped = task.status === "SKIPPED";
  const closed = completed || skipped || task.status === "CANCELLED";
  const high = task.priority === "HIGH" && !closed;
  const hasMeta = Boolean(task.dueTime) || task.generated || high || skipped;

  return (
    <li className="group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-canvas">
      <button
        type="button"
        onClick={() => onToggle(task)}
        aria-pressed={completed}
        aria-label={completed ? `Reopen ${task.title}` : `Complete ${task.title}`}
        className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] transition-colors ${
          completed
            ? "animate-check-pop border-positive bg-positive text-white"
            : "border-line-strong hover:border-accent hover:bg-accent-soft"
        }`}
      >
        {completed ? <CheckIcon className="size-3" /> : null}
      </button>

      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm leading-6 ${closed ? "text-faint line-through" : ""}`}>{task.title}</p>

        {hasMeta ? (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] text-faint">
            {task.dueTime ? (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <ClockIcon className="size-3.5" />
                {task.dueTime.slice(0, 5)}
              </span>
            ) : null}
            {/* Generated tasks reappear tomorrow, and a reader who did not put
                this on their day deserves to know why it is there. */}
            {task.generated ? (
              <span className="inline-flex items-center gap-1">
                <RepeatIcon className="size-3.5" />
                Routine
              </span>
            ) : null}
            {high ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-accent">
                <span aria-hidden className="size-1.5 rounded-full bg-accent" />
                High priority
              </span>
            ) : null}
            {skipped ? <span>Skipped</span> : null}
          </div>
        ) : null}
      </div>

      {/* Secondary actions stay out of the way until the row is hovered or
          focused, so a long list reads as a list. Devices without hover show
          them, since there is nothing that would ever reveal them there. */}
      <div className="flex shrink-0 items-center gap-0.5 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-within:opacity-100">
        {!closed ? (
          <RowAction label={`Skip ${task.title}`} title="Skip" onClick={() => onSkip(task)}>
            <XIcon className="size-4" />
          </RowAction>
        ) : null}
        <RowAction
          label={`Move ${task.title} to ${nextDayLabel}`}
          title={`Move to ${nextDayLabel}`}
          onClick={() => onMove(task)}
        >
          <ArrowRightIcon className="size-4" />
        </RowAction>
        <RowAction label={`Delete ${task.title}`} title="Delete" onClick={() => onDelete(task)} danger>
          <TrashIcon className="size-4" />
        </RowAction>
      </div>
    </li>
  );
}

function RowAction({
  label,
  title,
  onClick,
  danger = false,
  children,
}: {
  label: string;
  title: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={title}
      className={`grid size-7 place-items-center rounded-lg text-faint transition-colors hover:bg-surface ${
        danger ? "hover:text-danger" : "hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
