"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Field, FormMessage, INPUT, INPUT_BLOCK } from "@/components/form/controls";
import { NoteIcon } from "@/components/icons";
import { createNote, deleteNote, updateNote, type NoteDraft } from "@/lib/notes";
import { formatDay } from "@/lib/dates";
import type { GoalResponse, NotePage, NoteResponse } from "@/types/api";

/**
 * Everything written, newest first.
 *
 * <p>Today's note is written on Today, where the day it belongs to is obvious.
 * This screen is the other half — coming back to what you wrote, which is the
 * only reason to keep notes at all. So search is the first control on it.
 */
export function NoteBoard({
  page,
  goals,
  query,
  today,
}: {
  page: NotePage;
  goals: GoalResponse[];
  query: string;
  today: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const goalsById = new Map(goals.map((goal) => [goal.id, goal]));

  async function remove(note: NoteResponse) {
    setError(null);
    try {
      await deleteNote(note.id);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not delete that note.");
    }
  }

  function pageHref(next: number) {
    const search = new URLSearchParams(params.toString());
    if (next <= 0) search.delete("page");
    else search.set("page", String(next));
    return `/notes?${search.toString()}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form action="/notes" className="flex items-center gap-2">
          <input
            name="q"
            defaultValue={query}
            placeholder="Search your notes…"
            aria-label="Search notes"
            className={`${INPUT} w-56 sm:w-72`}
          />
          {query ? (
            <Link href="/notes" className="btn btn-ghost px-3 py-1.5 text-[0.8125rem]">
              Clear
            </Link>
          ) : null}
        </form>

        {!creating ? (
          <button type="button" onClick={() => setCreating(true)} className="btn btn-primary px-4 py-2">
            New note
          </button>
        ) : null}
      </div>

      {creating ? (
        <NoteForm goals={goals} today={today} onDone={() => setCreating(false)} />
      ) : null}

      <FormMessage error={error} />

      {page.notes.length === 0 && !creating ? (
        <div className="card animate-rise p-6 text-center sm:p-10">
          <span className="mx-auto grid size-11 place-items-center rounded-xl bg-accent-soft text-accent">
            <NoteIcon className="size-5" />
          </span>
          <h2 className="mt-4 text-lg font-semibold">
            {query ? "Nothing matches that search." : "Nothing written yet."}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
            {query
              ? "Search looks at titles and content, whole words only."
              : "What you learned, what went wrong, an idea worth keeping. Notes are what make a month of tasks add up to something you can read back."}
          </p>
        </div>
      ) : null}

      <ul className="space-y-3">
        {page.notes.map((note) =>
          editing === note.id ? (
            <li key={note.id}>
              <NoteForm note={note} goals={goals} today={today} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li key={note.id}>
              <article className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    {note.title ? <h2 className="text-sm font-medium">{note.title}</h2> : null}
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.6875rem] text-faint">
                      {note.noteDate ? (
                        <Link href={`/today?date=${note.noteDate}`} className="hover:text-accent">
                          {formatDay(note.noteDate, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </Link>
                      ) : (
                        <span>No date</span>
                      )}
                      {note.goalId && goalsById.has(note.goalId) ? (
                        <span>· {goalsById.get(note.goalId)?.title}</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditing(note.id)}
                      className="btn btn-ghost px-2.5 py-1.5 text-[0.8125rem]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(note)}
                      className="btn btn-ghost px-2.5 py-1.5 text-[0.8125rem] hover:text-danger"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Written as prose and shown as prose: line breaks are part of
                    what somebody wrote, and collapsing them loses the shape. */}
                <p className="mt-3 max-w-2xl text-sm leading-relaxed whitespace-pre-wrap">
                  {note.content}
                </p>
              </article>
            </li>
          ),
        )}
      </ul>

      {page.total > page.notes.length || page.page > 0 ? (
        <nav aria-label="Note pages" className="flex items-center justify-between gap-3 pt-1">
          <p className="text-[0.8125rem] text-muted">
            {page.total} note{page.total === 1 ? "" : "s"}
          </p>
          <div className="flex gap-1">
            {page.page > 0 ? (
              <Link href={pageHref(page.page - 1)} className="btn btn-secondary px-3 py-1.5 text-[0.8125rem]">
                Newer
              </Link>
            ) : null}
            {page.hasMore ? (
              <Link href={pageHref(page.page + 1)} className="btn btn-secondary px-3 py-1.5 text-[0.8125rem]">
                Older
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}

function NoteForm({
  note,
  goals,
  today,
  onDone,
}: {
  note?: NoteResponse;
  goals: GoalResponse[];
  today: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const [noteDate, setNoteDate] = useState(note?.noteDate ?? today);
  const [goalId, setGoalId] = useState(note?.goalId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const draft: NoteDraft = {
      title: title.trim() || null,
      content: content.trim(),
      noteDate: noteDate || null,
      goalId: goalId || null,
      // A note edited here keeps whatever it was attached to elsewhere.
      taskId: note?.taskId ?? null,
      routineId: note?.routineId ?? null,
    };

    if (!draft.content) {
      setError("A note needs something in it.");
      return;
    }

    setSaving(true);
    try {
      if (note) {
        await updateNote(note.id, draft);
      } else {
        await createNote(draft);
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
      <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Field label="Title" htmlFor="note-title" optional>
          <input
            id="note-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            placeholder="What I learned today"
            className={INPUT_BLOCK}
          />
        </Field>

        <Field label="Day" htmlFor="note-date" optional>
          <input
            id="note-date"
            type="date"
            value={noteDate}
            onChange={(event) => setNoteDate(event.target.value)}
            className={INPUT_BLOCK}
          />
        </Field>

        <Field label="Goal" htmlFor="note-goal" optional>
          <select
            id="note-goal"
            value={goalId}
            onChange={(event) => setGoalId(event.target.value)}
            className={INPUT_BLOCK}
          >
            <option value="">Not attached</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.title}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Note" htmlFor="note-content">
        <textarea
          id="note-content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          required
          rows={6}
          maxLength={20000}
          placeholder="What went well, what went wrong, what to do differently."
          className={`${INPUT_BLOCK} resize-y leading-relaxed`}
        />
      </Field>

      <FormMessage error={error} />

      <div className="flex gap-2 border-t border-line pt-4">
        <button type="submit" disabled={saving} className="btn btn-primary px-4 py-2">
          {saving ? "Saving…" : note ? "Save changes" : "Save note"}
        </button>
        <button type="button" onClick={onDone} className="btn btn-ghost px-4 py-2">
          Cancel
        </button>
      </div>
    </form>
  );
}
