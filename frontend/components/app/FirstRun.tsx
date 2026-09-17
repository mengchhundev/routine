"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createTask } from "@/lib/tasks";
import {
  CalendarIcon,
  CheckIcon,
  ListIcon,
  NoteIcon,
  RepeatIcon,
  SunIcon,
  TargetIcon,
} from "@/components/icons";

/**
 * Six ordinary things people actually put on a first day. Offered as one-click
 * adds because the hardest part of an empty tracker is the blank field, not the
 * typing — and every one of them is editable the moment it lands.
 */
const SUGGESTIONS = [
  { title: "Morning workout", icon: SunIcon },
  { title: "Read 20 pages", icon: NoteIcon },
  { title: "Walk 30 minutes", icon: RepeatIcon },
  { title: "Study for one hour", icon: TargetIcon },
  { title: "Write today's note", icon: ListIcon },
  { title: "Plan tomorrow", icon: CalendarIcon },
];

const STEPS = [
  { icon: ListIcon, text: "Add one task — anything you actually intend to do." },
  { icon: CheckIcon, text: "Check it off when it is done." },
  { icon: RepeatIcon, text: "Come back tomorrow. That second day is the streak." },
];

/**
 * The empty dashboard's one job is to stop being empty, so it leads with the
 * field rather than describing what the field would do. Everything else on this
 * card is secondary to the input at the top of it.
 */
export function FirstRun({ date }: { date: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function add(title: string) {
    if (pending) return;
    setPending(title);
    setError(null);
    try {
      await createTask(title, date);
      // The page flips out of its first-run state on this refresh, so there is
      // no success state to design — the whole screen is the confirmation.
      router.refresh();
    } catch {
      setError("That did not save. Check your connection and try again.");
      setPending(null);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const title = String(new FormData(form).get("title") ?? "").trim();
    if (!title) {
      inputRef.current?.focus();
      return;
    }
    await add(title);
    form.reset();
  }

  return (
    <section className="card animate-rise p-5 sm:p-6" aria-labelledby="start-heading">
      <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.09em] text-accent uppercase">
        <span className="size-1.5 animate-pulse rounded-full bg-accent" />
        Start here
      </p>

      <h2 id="start-heading" className="mt-3 text-xl font-semibold sm:text-2xl">
        One task is enough to begin.
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
        Routine works from the bottom up. Add something you intend to do today
        and this page starts measuring — rate, streak, and the week behind you.
      </p>

      <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-2 sm:flex-row">
        <input
          ref={inputRef}
          name="title"
          maxLength={200}
          disabled={pending !== null}
          placeholder="What will you do today?"
          aria-label="New task title"
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm placeholder:text-faint transition-colors hover:border-line-strong focus:border-accent focus:ring-4 focus:ring-accent/12 focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={pending !== null}
          className="btn btn-primary px-5 py-2.5 sm:w-auto"
        >
          {pending ? "Adding…" : "Add task"}
        </button>
      </form>

      <div className="mt-5">
        <p className="text-[0.8125rem] text-muted">Or start with one of these:</p>

        <ul className="mt-2.5 flex flex-wrap gap-2">
          {SUGGESTIONS.map(({ title, icon: Icon }, index) => {
            const busy = pending === title;
            return (
              <li key={title}>
                <button
                  type="button"
                  onClick={() => add(title)}
                  disabled={pending !== null}
                  aria-label={`Add task: ${title}`}
                  className="animate-rise group inline-flex items-center gap-2 rounded-full border border-line bg-surface py-2 pr-3.5 pl-3 text-sm text-muted shadow-card transition-[transform,border-color,color,box-shadow] duration-150 hover:-translate-y-0.5 hover:border-accent/40 hover:text-ink hover:shadow-lift focus-visible:-translate-y-0.5 active:translate-y-0 disabled:pointer-events-none disabled:opacity-50"
                  style={{ animationDelay: `${120 + index * 45}ms` }}
                >
                  <span className="grid size-5 place-items-center rounded-full bg-accent-soft text-accent transition-transform duration-200 group-hover:scale-110">
                    {busy ? (
                      <CheckIcon className="size-3" />
                    ) : (
                      <Icon className="size-3.5" />
                    )}
                  </span>
                  {title}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <ol className="mt-6 grid gap-3 border-t border-line pt-5 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, text }, index) => (
          <li
            key={text}
            className="animate-rise flex gap-3 text-sm text-muted"
            style={{ animationDelay: `${200 + index * 70}ms` }}
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
              <Icon className="size-4" />
            </span>
            <span className="leading-snug">{text}</span>
          </li>
        ))}
      </ol>

      {error ? (
        <p role="alert" className="mt-4 text-[0.8125rem] text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}
