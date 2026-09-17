"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckIcon,
  ClockIcon,
  GridIcon,
  ListIcon,
  PencilIcon,
  PlusIcon,
  RepeatIcon,
  SearchIcon,
  TrashIcon,
  XIcon,
} from "@/components/icons";
import { LayoutToggle, type LayoutOption } from "@/components/LayoutToggle";
import { Modal } from "@/components/Modal";
import { PRIORITY_DOT, TaskForm } from "@/components/tasks/TaskForm";
import { actOnTask, deleteTask } from "@/lib/tasks";
import { formatDay, shiftDay } from "@/lib/dates";
import {
  DEFAULT_TASKS_LAYOUT,
  readTasksLayout,
  writeTasksLayout,
  type TasksLayout,
} from "@/lib/tasksLayout";
import { useBeforePaint } from "@/lib/useBeforePaint";
import type { TaskResponse, TaskScope, TaskStatus } from "@/types/api";

const SCOPES: { value: TaskScope; label: string }[] = [
  { value: "UPCOMING", label: "Upcoming" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "BACKLOG", label: "Backlog" },
  { value: "DONE", label: "Done" },
  { value: "ALL", label: "All" },
];

const EMPTY: Record<TaskScope, { title: string; body: string }> = {
  UPCOMING: { title: "Nothing coming up", body: "Nothing is scheduled from today onwards." },
  OVERDUE: { title: "Nothing is late", body: "That is the whole point of this list." },
  BACKLOG: { title: "Backlog is empty", body: "Anything added without a day lands here." },
  DONE: { title: "Nothing finished yet", body: "Completed and skipped tasks collect here." },
  ALL: { title: "No tasks yet", body: "Add the first thing you intend to do." },
};

const LAYOUT_OPTIONS: LayoutOption<TasksLayout>[] = [
  { value: "list", label: "List", icon: ListIcon },
  { value: "card", label: "Card", icon: GridIcon },
];

type Patch = { id: string; status: TaskStatus } | { id: string; removed: true };
type Mutate = (patch: Patch, request: () => Promise<unknown>, failure: string) => void;

export function TaskBoard({
  tasks,
  scope,
  query,
  today,
}: {
  tasks: TaskResponse[];
  scope: TaskScope;
  query: string;
  today: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<TaskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [layout, setLayout] = useState<TasksLayout>(DEFAULT_TASKS_LAYOUT);

  // The stored choice lands before the first paint, so the default never
  // flashes into the reader's own.
  useBeforePaint(() => setLayout(readTasksLayout()), []);

  function chooseLayout(next: TasksLayout) {
    setLayout(next);
    writeTasksLayout(next);
  }

  const [optimisticTasks, applyPatch] = useOptimistic(tasks, (state, patch: Patch) =>
    "removed" in patch
      ? state.filter((task) => task.id !== patch.id)
      : state.map((task) => (task.id === patch.id ? { ...task, status: patch.status } : task)),
  );

  const mutate: Mutate = (patch, request, failure) => {
    setError(null);
    startTransition(async () => {
      applyPatch(patch);
      try {
        await request();
        router.refresh();
      } catch {
        // The optimistic value is dropped when the transition ends, so the row
        // returns on its own; all that remains is to say why.
        setError(failure);
      }
    });
  };

  /** Scope and search live in the URL, so a filtered list can be linked to. */
  function href(next: { scope?: TaskScope; q?: string }) {
    const search = new URLSearchParams(params.toString());
    if (next.scope) search.set("scope", next.scope);
    if (next.q !== undefined) {
      if (next.q) search.set("q", next.q);
      else search.delete("q");
    }
    return `/tasks?${search.toString()}`;
  }

  const groups = groupByDay(optimisticTasks, today);
  const empty = optimisticTasks.length === 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="text-[1.75rem] leading-tight font-semibold sm:text-3xl">Tasks</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
            Everything you have planned, across every day — including the things
            with no day yet. Today shows one day; this is the whole picture.
          </p>
        </div>

        <button type="button" onClick={() => setCreating(true)} className="btn btn-primary px-4 py-2">
          <PlusIcon className="size-4" />
          New task
        </button>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Scrolls sideways rather than wrapping on a phone, so the control
            keeps its shape. */}
        <div className="-mx-1 max-w-full overflow-x-auto px-1">
          <nav aria-label="Filter tasks" className="flex w-max gap-0.5 rounded-lg border border-line bg-canvas p-0.5">
            {SCOPES.map((option) => (
              <Link
                key={option.value}
                href={href({ scope: option.value })}
                aria-current={scope === option.value ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 text-[0.8125rem] transition-colors ${
                  scope === option.value
                    ? "bg-surface font-medium text-ink shadow-card"
                    : "text-muted hover:text-ink"
                }`}
              >
                {option.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <form action="/tasks" role="search" className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
            <input type="hidden" name="scope" value={scope} />
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
            <input
              name="q"
              defaultValue={query}
              placeholder="Search titles"
              aria-label="Search tasks by title"
              className="w-full rounded-lg border border-line bg-surface py-2 pr-9 pl-9 text-[0.8125rem] placeholder:text-faint transition-[border-color,box-shadow] hover:border-line-strong focus:border-accent focus:ring-4 focus:ring-accent/12 focus:outline-none"
            />
            {query ? (
              <Link
                href={href({ q: "" })}
                aria-label="Clear search"
                className="absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 place-items-center rounded-md text-faint transition-colors hover:bg-canvas hover:text-ink"
              >
                <XIcon className="size-3.5" />
              </Link>
            ) : null}
          </form>

          <LayoutToggle
            label="Task layout"
            options={LAYOUT_OPTIONS}
            value={layout}
            onChange={chooseLayout}
            className="shrink-0 border border-line"
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-[0.8125rem] text-danger">
          {error}
        </p>
      ) : null}

      {empty ? (
        <div className="card animate-rise flex flex-col items-center px-6 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
            {query ? <SearchIcon className="size-5" /> : <ListIcon className="size-5" />}
          </span>
          <h2 className="mt-4 text-base font-semibold">
            {query ? "Nothing matches that search" : EMPTY[scope].title}
          </h2>
          <p className="mt-1 max-w-sm text-[0.8125rem] leading-relaxed text-muted">
            {query ? `No task titles contain “${query}” here.` : EMPTY[scope].body}
          </p>
          {query ? (
            <Link href={href({ q: "" })} className="btn btn-secondary mt-5 px-4 py-2">
              Clear search
            </Link>
          ) : (
            <button type="button" onClick={() => setCreating(true)} className="btn btn-secondary mt-5 px-4 py-2">
              <PlusIcon className="size-4" />
              New task
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`group-${group.key}`}>
              <h2
                id={`group-${group.key}`}
                className={`flex items-center gap-2 px-1 text-[0.6875rem] font-semibold tracking-[0.08em] uppercase ${
                  group.late ? "text-danger" : group.today ? "text-accent" : "text-faint"
                }`}
              >
                {group.heading}
                <span className="rounded-full bg-canvas px-1.5 py-px text-[0.625rem] tabular-nums text-muted">
                  {group.tasks.length}
                </span>
                <span aria-hidden className="h-px flex-1 bg-line" />
              </h2>

              <ul
                className={
                  layout === "card"
                    ? "mt-2 grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-3"
                    : "card mt-2 divide-y divide-line/70 p-1.5"
                }
              >
                {group.tasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    today={today}
                    layout={layout}
                    onEdit={() => setEditing(task)}
                    mutate={mutate}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {creating ? (
        <Modal
          title="New task"
          description="Only the title is required. Leave the date empty to keep it in the backlog."
          onClose={() => setCreating(false)}
        >
          <TaskForm onDone={() => setCreating(false)} />
        </Modal>
      ) : null}

      {editing ? (
        <Modal title="Edit task" onClose={() => setEditing(null)}>
          <TaskForm task={editing} onDone={() => setEditing(null)} />
        </Modal>
      ) : null}
    </div>
  );
}

function TaskItem({
  task,
  today,
  layout,
  onEdit,
  mutate,
}: {
  task: TaskResponse;
  today: string;
  layout: TasksLayout;
  onEdit: () => void;
  mutate: Mutate;
}) {
  const completed = task.status === "COMPLETED";
  const skipped = task.status === "SKIPPED";
  const closed = completed || skipped || task.status === "CANCELLED";
  const high = task.priority === "HIGH" && !closed;
  const hasMeta = Boolean(task.dueTime || task.category) || task.generated || high || skipped;
  const tomorrow = shiftDay(today, 1);
  const card = layout === "card";

  const move = (dueDate: string) =>
    mutate({ id: task.id, removed: true }, () => actOnTask(task.id, "reschedule", { dueDate }), "Could not move that task.");

  const check = (
    <button
      type="button"
      onClick={() =>
        mutate(
          { id: task.id, status: completed ? "TODO" : "COMPLETED" },
          () => actOnTask(task.id, completed ? "reopen" : "complete"),
          "That did not save. Check your connection and try again.",
        )
      }
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
  );

  const body = (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        {!closed && task.priority !== "MEDIUM" ? (
          <span
            className={`size-1.5 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`}
            title={`${task.priority === "HIGH" ? "High" : "Low"} priority`}
          />
        ) : null}
        <p
          className={`text-sm leading-6 ${card ? "line-clamp-2" : "truncate"} ${
            closed ? "text-faint line-through" : "font-medium"
          }`}
        >
          {task.title}
        </p>
      </div>

      {task.description ? (
        <p className={`mt-0.5 text-[0.8125rem] text-muted ${card ? "line-clamp-2 leading-relaxed" : "truncate"}`}>
          {task.description}
        </p>
      ) : null}
    </div>
  );

  // No date chip: the group heading above already says which day.
  const meta = hasMeta ? (
    <div className="flex flex-wrap items-center gap-1.5 text-[0.6875rem]">
      {task.dueTime ? (
        <Chip>
          <ClockIcon className="size-3" />
          {task.dueTime.slice(0, 5)}
        </Chip>
      ) : null}
      {task.category ? <Chip>{task.category}</Chip> : null}
      {/* Generated tasks reappear, and a reader who did not type this one
          deserves to know where it came from. */}
      {task.generated ? (
        <Chip tone="accent">
          <RepeatIcon className="size-3" />
          Routine
        </Chip>
      ) : null}
      {high ? <Chip tone="danger">High priority</Chip> : null}
      {skipped ? <Chip>Skipped</Chip> : null}
    </div>
  ) : null;

  const moves = !closed ? (
    <>
      {task.dueDate !== today ? (
        <button type="button" onClick={() => move(today)} className="btn btn-ghost px-2 py-1 text-[0.6875rem]">
          Today
        </button>
      ) : null}
      {task.dueDate !== tomorrow ? (
        <button type="button" onClick={() => move(tomorrow)} className="btn btn-ghost px-2 py-1 text-[0.6875rem]">
          Tomorrow
        </button>
      ) : null}
    </>
  ) : null;

  const icons = (
    <>
      {!closed ? (
        <IconAction
          label={`Skip ${task.title}`}
          title="Skip"
          onClick={() =>
            mutate({ id: task.id, status: "SKIPPED" }, () => actOnTask(task.id, "skip"), "Could not skip that task.")
          }
        >
          <XIcon className="size-4" />
        </IconAction>
      ) : null}
      <IconAction label={`Edit ${task.title}`} title="Edit" onClick={onEdit}>
        <PencilIcon className="size-4" />
      </IconAction>
      <IconAction
        label={`Delete ${task.title}`}
        title="Delete"
        danger
        onClick={() => mutate({ id: task.id, removed: true }, () => deleteTask(task.id), "Could not delete that task.")}
      >
        <TrashIcon className="size-4" />
      </IconAction>
    </>
  );

  if (card) {
    // A card has room to keep its actions in view, in a footer of their own,
    // so nothing depends on hovering.
    return (
      <li
        className={`card group flex flex-col p-4 transition-[border-color,box-shadow] duration-200 hover:border-line-strong hover:shadow-lift ${
          completed ? "bg-canvas/60" : ""
        }`}
      >
        <div className="flex items-start gap-3">
          {check}
          {body}
        </div>

        {meta ? <div className="mt-3 pl-8">{meta}</div> : null}

        <div className="mt-auto pt-4">
          <div className="flex items-center justify-between gap-2 border-t border-line pt-2.5">
            <div className="-ml-2 flex items-center gap-0.5">{moves}</div>
            <div className="-mr-1.5 flex items-center gap-0.5">{icons}</div>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="group flex items-start gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-canvas">
      {check}

      <div className="min-w-0 flex-1">
        {body}
        {meta ? <div className="mt-1.5">{meta}</div> : null}
      </div>

      {/* Secondary actions stay out of the way until the row is hovered or
          focused on devices that can hover; elsewhere nothing would ever reveal
          them, so they simply show. */}
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-0.5 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-within:opacity-100">
        {moves ? <div className="mr-1 hidden items-center gap-0.5 sm:flex">{moves}</div> : null}
        {icons}
      </div>
    </li>
  );
}

function Chip({ tone = "plain", children }: { tone?: "plain" | "accent" | "danger"; children: React.ReactNode }) {
  const tones = {
    plain: "bg-canvas text-muted",
    accent: "bg-accent-soft text-accent",
    danger: "bg-danger-soft font-medium text-danger",
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 tabular-nums ${tones[tone]}`}>
      {children}
    </span>
  );
}

function IconAction({
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

type Group = { key: string; heading: string; late: boolean; today: boolean; tasks: TaskResponse[] };

/**
 * Days are the heading people actually scan for. The server already sorts by
 * date, so grouping is a fold over the list rather than a re-sort.
 *
 * <p>A past day is only "overdue" while something in it is still open — a
 * finished day in the Done list is history, not a warning.
 */
function groupByDay(tasks: TaskResponse[], today: string): Group[] {
  const groups = new Map<string, Group>();
  const tomorrow = shiftDay(today, 1);

  for (const task of tasks) {
    const key = task.dueDate ?? "none";
    const group = groups.get(key) ?? { key, heading: "", late: false, today: task.dueDate === today, tasks: [] };
    group.tasks.push(task);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    const date = group.key === "none" ? null : group.key;
    group.late =
      date !== null &&
      date < today &&
      group.tasks.some((task) => task.status === "TODO" || task.status === "IN_PROGRESS");

    group.heading = !date
      ? "No date"
      : date === today
        ? "Today"
        : date === tomorrow
          ? "Tomorrow"
          : group.late
            ? `Overdue · ${formatDay(date, { month: "short", day: "numeric" })}`
            : formatDay(date, { weekday: "long", month: "short", day: "numeric" });
  }

  return [...groups.values()];
}
