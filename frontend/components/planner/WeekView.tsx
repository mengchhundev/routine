"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckIcon, PlusIcon, RepeatIcon } from "@/components/icons";
import { FormMessage } from "@/components/form/controls";
import { actOnTask, createTask } from "@/lib/tasks";
import { formatDay } from "@/lib/dates";
import type { PlannerLayout } from "@/lib/plannerLayout";
import type { Progress, TaskResponse, WeekDay, WeekResponse } from "@/types/api";

/**
 * A week of real tasks — not a summary of them — as day cards or as one list.
 *
 * <p>The point of the week view is moving work between days, so completing and
 * adding happen here rather than sending the user to Today and back. Anything
 * more (editing, priorities, rescheduling) is a click away on the day itself,
 * which each day's heading links to.
 */
export function WeekView({ week, layout }: { week: WeekResponse; layout: PlannerLayout }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Ticks flip immediately, in both directions; the server's answer replaces
  // them on refresh.
  const [overrides, override] = useOptimistic(
    new Map<string, boolean>(),
    (state, [taskId, done]: [string, boolean]) => new Map(state).set(taskId, done),
  );

  const isDone = (task: TaskResponse) => overrides.get(task.id) ?? task.status === "COMPLETED";

  function toggle(task: TaskResponse) {
    const done = isDone(task);
    setError(null);
    startTransition(async () => {
      override([task.id, !done]);
      try {
        await actOnTask(task.id, done ? "reopen" : "complete");
        router.refresh();
      } catch {
        setError("That did not save. Check your connection and try again.");
      }
    });
  }

  const shared = { today: week.today, isDone, onToggle: toggle, onError: setError };

  return (
    <div className="space-y-3">
      <FormMessage error={error} />

      {layout === "card" ? (
        // As many columns as fit at a readable width: one on a phone, up to
        // seven on a wide screen. A fixed seven squeezes every card into a
        // strip on anything smaller.
        <div className="grid grid-cols-[repeat(auto-fill,minmax(15.5rem,1fr))] gap-3">
          {week.days.map((day) => (
            <DayCard key={day.date} day={day} {...shared} />
          ))}
        </div>
      ) : (
        <div className="card divide-y divide-line overflow-hidden p-0">
          {week.days.map((day) => (
            <DayRow key={day.date} day={day} {...shared} />
          ))}
        </div>
      )}
    </div>
  );
}

type DayProps = {
  day: WeekDay;
  today: string;
  isDone: (task: TaskResponse) => boolean;
  onToggle: (task: TaskResponse) => void;
  onError: (message: string | null) => void;
};

function DayCard({ day, today, isDone, onToggle, onError }: DayProps) {
  const past = day.date < today;

  return (
    <section
      aria-labelledby={`day-${day.date}`}
      className={`card flex flex-col p-0 transition-[border-color,box-shadow] duration-200 hover:border-line-strong hover:shadow-lift ${
        day.isToday ? "border-accent/50 ring-1 ring-accent/50" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <DayHeading day={day} past={past} />
        <Count progress={day.progress} />
      </div>

      <div className="px-4 pt-3">
        <Bar progress={day.progress} label={formatDay(day.date, { weekday: "long" })} />
      </div>

      <div className="flex-1 px-2 py-2">
        <TaskList tasks={day.tasks} isDone={isDone} onToggle={onToggle} />
      </div>

      <div className="border-t border-line px-2 py-1.5">
        <QuickAdd date={day.date} onError={onError} />
      </div>
    </section>
  );
}

function DayRow({ day, today, isDone, onToggle, onError }: DayProps) {
  const past = day.date < today;

  return (
    <section
      aria-labelledby={`day-${day.date}`}
      className={`relative grid gap-x-8 gap-y-2 px-4 py-4 sm:grid-cols-[11rem_1fr] sm:px-5 ${
        day.isToday ? "bg-accent-soft/35 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-accent" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-start sm:justify-start">
        <DayHeading day={day} past={past} />
        <div className="flex items-center gap-2.5 sm:mt-1 sm:w-full">
          {day.progress.planned > 0 ? (
            <div className="w-16 sm:flex-1">
              <Bar progress={day.progress} label={formatDay(day.date, { weekday: "long" })} />
            </div>
          ) : null}
          <Count progress={day.progress} />
        </div>
      </div>

      <div className="-mx-1 min-w-0">
        <TaskList tasks={day.tasks} isDone={isDone} onToggle={onToggle} />
        <QuickAdd date={day.date} onError={onError} />
      </div>
    </section>
  );
}

/** The date as the eye wants it: a big number, the weekday beside it. */
function DayHeading({ day, past }: { day: WeekDay; past: boolean }) {
  return (
    <Link
      id={`day-${day.date}`}
      href={`/today?date=${day.date}`}
      aria-label={formatDay(day.date, { weekday: "long", month: "long", day: "numeric" })}
      className="group flex items-baseline gap-2"
    >
      <span
        className={`text-2xl leading-none font-semibold tabular-nums transition-colors group-hover:text-accent ${
          day.isToday ? "text-accent" : past ? "text-muted" : ""
        }`}
      >
        {formatDay(day.date, { day: "numeric" })}
      </span>
      <span className="text-[0.6875rem] font-semibold tracking-[0.08em] text-faint uppercase transition-colors group-hover:text-accent">
        {formatDay(day.date, { weekday: "short" })}
      </span>
      {day.isToday ? (
        <span className="rounded-full bg-accent px-2 py-0.5 text-[0.625rem] font-semibold text-accent-ink">
          Today
        </span>
      ) : null}
    </Link>
  );
}

function Count({ progress }: { progress: Progress }) {
  if (progress.planned === 0) return null;
  const complete = progress.completed === progress.planned;

  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium tabular-nums ${
        complete ? "bg-positive-soft text-positive" : "bg-canvas text-muted"
      }`}
    >
      {progress.completed}/{progress.planned}
    </span>
  );
}

function Bar({ progress, label }: { progress: Progress; label: string }) {
  return (
    <div
      className="h-1 overflow-hidden rounded-full bg-canvas"
      role="progressbar"
      aria-valuenow={progress.percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${label} progress`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${
          progress.percent === 100 ? "bg-positive" : "bg-accent"
        }`}
        style={{ width: `${progress.percent}%` }}
      />
    </div>
  );
}

function TaskList({
  tasks,
  isDone,
  onToggle,
}: {
  tasks: TaskResponse[];
  isDone: (task: TaskResponse) => boolean;
  onToggle: (task: TaskResponse) => void;
}) {
  if (tasks.length === 0) {
    return <p className="px-2 py-1.5 text-[0.8125rem] text-faint">Nothing planned</p>;
  }

  return (
    <ul className="space-y-0.5">
      {tasks.map((task) => {
        const done = isDone(task);
        const closed = done || task.status === "SKIPPED" || task.status === "CANCELLED";

        return (
          <li key={task.id} className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-canvas">
            <button
              type="button"
              onClick={() => onToggle(task)}
              aria-pressed={done}
              aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
              className={`mt-px grid size-[1.125rem] shrink-0 place-items-center rounded-full border transition-colors ${
                done
                  ? "animate-check-pop border-positive bg-positive text-white"
                  : "border-line-strong hover:border-accent"
              }`}
            >
              {done ? <CheckIcon className="size-2.5" /> : null}
            </button>

            <span className={`min-w-0 flex-1 text-[0.8125rem] leading-5 ${closed ? "text-faint line-through" : ""}`}>
              {task.title}
            </span>

            {task.dueTime ? (
              <span className="shrink-0 text-[0.6875rem] leading-5 tabular-nums text-faint">
                {task.dueTime.slice(0, 5)}
              </span>
            ) : null}

            {task.generated ? (
              <RepeatIcon className="mt-[0.1875rem] size-3.5 shrink-0 text-faint" aria-label="From a routine" />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Adding to a day is the week view's other real action, so every day has one. */
function QuickAdd({ date, onError }: { date: string; onError: (message: string | null) => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    onError(null);
    setTitle("");
    setSaving(true);
    try {
      await createTask(trimmed, date);
      router.refresh();
    } catch {
      setTitle(trimmed);
      onError("Could not add that task.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={add} className="group/add flex items-center gap-2.5 rounded-lg px-2 focus-within:bg-canvas hover:bg-canvas">
      <PlusIcon className="size-[1.125rem] shrink-0 text-faint transition-colors group-focus-within/add:text-accent" />
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        disabled={saving}
        maxLength={200}
        placeholder="Add task"
        aria-label={`Add a task on ${formatDay(date, { weekday: "long", month: "long", day: "numeric" })}`}
        className="min-w-0 flex-1 bg-transparent py-1.5 text-[0.8125rem] placeholder:text-faint focus:outline-none"
      />
    </form>
  );
}
