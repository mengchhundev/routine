"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Field, FormMessage, INPUT_BLOCK } from "@/components/form/controls";
import { BellIcon } from "@/components/icons";
import { cancelReminder, createReminder, deleteReminder, updateReminder } from "@/lib/reminders";
import { formatLocalStamp } from "@/lib/dates";
import type {
  GoalResponse,
  ReminderChannel,
  ReminderDraft,
  ReminderResponse,
  ReminderScope,
  RoutineResponse,
  TaskResponse,
} from "@/types/api";

const SCOPES: { value: ReminderScope; label: string }[] = [
  { value: "UPCOMING", label: "Upcoming" },
  { value: "PAST", label: "Past" },
  { value: "ALL", label: "All" },
];

const STATUS_LABEL: Record<ReminderResponse["status"], string> = {
  PENDING: "Scheduled",
  SENT: "Sent",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

export function ReminderBoard({
  reminders,
  scope,
  tasks,
  routines,
  goals,
  now,
  remindersEnabled,
}: {
  reminders: ReminderResponse[];
  scope: ReminderScope;
  tasks: TaskResponse[];
  routines: RoutineResponse[];
  goals: GoalResponse[];
  now: string;
  remindersEnabled: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(run: () => Promise<unknown>, failure: string) {
    setError(null);
    try {
      await run();
      router.refresh();
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : failure);
    }
  }

  return (
    <div className="space-y-4">
      {/* Said once, at the top, rather than on every row: a screen full of
          reminders that will never fire should explain itself immediately. */}
      {!remindersEnabled ? (
        <p className="rounded-lg bg-danger-soft px-3.5 py-2.5 text-[0.8125rem] text-danger">
          Reminders are switched off for your account, so nothing here will be
          delivered.{" "}
          <Link href="/settings" className="underline">
            Turn them back on in settings
          </Link>
          .
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter reminders" className="flex flex-wrap gap-1">
          {SCOPES.map((option) => (
            <Link
              key={option.value}
              href={`/reminders?scope=${option.value}`}
              aria-current={scope === option.value ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 text-[0.8125rem] transition-colors ${
                scope === option.value
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
            New reminder
          </button>
        ) : null}
      </div>

      {creating ? (
        <ReminderForm
          tasks={tasks}
          routines={routines}
          goals={goals}
          now={now}
          onDone={() => setCreating(false)}
        />
      ) : null}

      <FormMessage error={error} />

      {reminders.length === 0 && !creating ? (
        <div className="card animate-rise p-6 text-center sm:p-10">
          <span className="mx-auto grid size-11 place-items-center rounded-xl bg-accent-soft text-accent">
            <BellIcon className="size-5" />
          </span>
          <h2 className="mt-4 text-lg font-semibold">
            {scope === "UPCOMING" ? "Nothing scheduled." : "Nothing here yet."}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
            A reminder is a nudge at a time you choose — the morning routine at
            06:30, the daily review at 21:30. It fires in your account&apos;s
            timezone, not your browser&apos;s.
          </p>
        </div>
      ) : null}

      <ul className="space-y-2">
        {reminders.map((reminder) =>
          editing === reminder.id ? (
            <li key={reminder.id}>
              <ReminderForm
                reminder={reminder}
                tasks={tasks}
                routines={routines}
                goals={goals}
                now={now}
                onDone={() => setEditing(null)}
              />
            </li>
          ) : (
            <li key={reminder.id}>
              <article className="card flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {reminder.message ?? reminder.subject?.title ?? "Reminder"}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.6875rem] text-faint">
                    <span className="tabular-nums">{formatLocalStamp(reminder.remindAtLocal)}</span>
                    <span>· {STATUS_LABEL[reminder.status]}</span>
                    {reminder.subject ? (
                      <span>· {reminder.subject.title}</span>
                    ) : null}
                    <span>· {reminder.channel === "EMAIL" ? "Email" : "In app"}</span>
                  </div>

                  {/* Why it did not arrive, on the row itself: a reminder that
                      silently failed teaches people to stop trusting them. */}
                  {reminder.lastError ? (
                    <p className="mt-1 text-[0.6875rem] text-danger">{reminder.lastError}</p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {reminder.status === "PENDING" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditing(reminder.id)}
                        className="btn btn-ghost px-2.5 py-1.5 text-[0.8125rem]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => act(() => cancelReminder(reminder.id), "Could not cancel that reminder.")}
                        className="btn btn-ghost px-2.5 py-1.5 text-[0.8125rem]"
                      >
                        Cancel
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => act(() => deleteReminder(reminder.id), "Could not delete that reminder.")}
                    className="btn btn-ghost px-2.5 py-1.5 text-[0.8125rem] hover:text-danger"
                  >
                    Delete
                  </button>
                </div>
              </article>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

/** Attaching a reminder to something is a single picker, because a reminder is
 *  about exactly one thing — the API rejects more than one. */
type SubjectKind = "NONE" | "TASK" | "ROUTINE" | "GOAL";

function ReminderForm({
  reminder,
  tasks,
  routines,
  goals,
  now,
  onDone,
}: {
  reminder?: ReminderResponse;
  tasks: TaskResponse[];
  routines: RoutineResponse[];
  goals: GoalResponse[];
  now: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [remindAt, setRemindAt] = useState(reminder?.remindAtLocal.slice(0, 16) ?? now);
  const [message, setMessage] = useState(reminder?.message ?? "");
  const [channel, setChannel] = useState<ReminderChannel>(reminder?.channel ?? "IN_APP");
  const [kind, setKind] = useState<SubjectKind>(reminder?.subject?.type ?? "NONE");
  const [subjectId, setSubjectId] = useState(reminder?.subject?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options =
    kind === "TASK"
      ? tasks.map((task) => ({ id: task.id, label: task.title }))
      : kind === "ROUTINE"
        ? routines.map((routine) => ({ id: routine.id, label: routine.name }))
        : kind === "GOAL"
          ? goals.map((goal) => ({ id: goal.id, label: goal.title }))
          : [];

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const attached = kind !== "NONE" ? subjectId : "";
    if (kind !== "NONE" && !attached) {
      setError("Pick what this reminder is about, or set it to nothing.");
      return;
    }
    if (!message.trim() && !attached) {
      setError("Write a message, or attach the reminder to a task, routine or goal.");
      return;
    }

    const draft: ReminderDraft = {
      remindAt,
      message: message.trim() || null,
      channel,
      taskId: kind === "TASK" ? attached : null,
      routineId: kind === "ROUTINE" ? attached : null,
      goalId: kind === "GOAL" ? attached : null,
    };

    setSaving(true);
    try {
      if (reminder) {
        await updateReminder(reminder.id, draft);
      } else {
        await createReminder(draft);
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
    <form onSubmit={save} className="card animate-rise space-y-4 p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Field
          label="When"
          htmlFor="reminder-at"
          hint={`In ${reminder?.timezone ?? "your account's"} time, not your browser's.`}
        >
          <input
            id="reminder-at"
            type="datetime-local"
            value={remindAt}
            onChange={(event) => setRemindAt(event.target.value)}
            required
            className={INPUT_BLOCK}
          />
        </Field>

        <Field label="How" htmlFor="reminder-channel">
          <select
            id="reminder-channel"
            value={channel}
            onChange={(event) => setChannel(event.target.value as ReminderChannel)}
            className={INPUT_BLOCK}
          >
            <option value="IN_APP">In app</option>
            <option value="EMAIL">Email</option>
          </select>
        </Field>
      </div>

      <Field label="Message" htmlFor="reminder-message" optional>
        <input
          id="reminder-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={300}
          placeholder="Daily review"
          className={INPUT_BLOCK}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Field label="About" htmlFor="reminder-kind" optional>
          <select
            id="reminder-kind"
            value={kind}
            onChange={(event) => {
              setKind(event.target.value as SubjectKind);
              setSubjectId("");
            }}
            className={INPUT_BLOCK}
          >
            <option value="NONE">Nothing in particular</option>
            <option value="TASK">A task</option>
            <option value="ROUTINE">A routine</option>
            <option value="GOAL">A goal</option>
          </select>
        </Field>

        {kind !== "NONE" ? (
          <Field label="Which one" htmlFor="reminder-subject">
            <select
              id="reminder-subject"
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
              className={INPUT_BLOCK}
            >
              <option value="">Choose…</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </div>

      <FormMessage error={error} />

      <div className="flex gap-2 border-t border-line pt-4">
        <button type="submit" disabled={saving} className="btn btn-primary px-4 py-2">
          {saving ? "Saving…" : reminder ? "Save changes" : "Schedule reminder"}
        </button>
        <button type="button" onClick={onDone} className="btn btn-ghost px-4 py-2">
          Cancel
        </button>
      </div>
    </form>
  );
}
