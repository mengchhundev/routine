"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NoteIcon } from "@/components/icons";
import { useAutosave, statusLabel } from "@/lib/useAutosave";
import type { NoteResponse } from "@/types/api";

export function DailyNote({ note, date }: { note: NoteResponse | null; date: string }) {
  const router = useRouter();
  const [content, setContent] = useState(note?.content ?? "");
  // The id only exists once something has been written, so the first save is a
  // create and every one after it an update.
  const noteId = useRef<string | null>(note?.id ?? null);

  const { status, schedule } = useAutosave(async (signal) => {
    const body = JSON.stringify({ content, noteDate: date });
    const existing = noteId.current;

    // An emptied note is deleted rather than stored as a blank row.
    if (!content.trim()) {
      if (existing) {
        await fetch(`/api/proxy/notes/${existing}`, { method: "DELETE", signal });
        noteId.current = null;
        router.refresh();
      }
      return;
    }

    const response = await fetch(
      existing ? `/api/proxy/notes/${existing}` : "/api/proxy/notes",
      { method: existing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body, signal },
    );
    if (!response.ok) throw new Error();

    if (!existing) {
      noteId.current = ((await response.json()) as NoteResponse).id;
      router.refresh();
    }
  });

  const label = statusLabel(status);
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <section className="card flex flex-col p-5 sm:p-6" aria-labelledby="daily-note-heading">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <NoteIcon className="size-[1.125rem]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="daily-note-heading" className="text-base font-semibold">
            Note
          </h2>
          <p className="mt-0.5 text-[0.8125rem] text-muted">Saves as you type</p>
        </div>
      </div>

      <textarea
        value={content}
        onChange={(event) => {
          setContent(event.target.value);
          schedule();
        }}
        rows={9}
        maxLength={20000}
        placeholder="What happened today? What did you learn?"
        aria-label="Note for this day"
        className="mt-5 w-full resize-y rounded-xl border border-line bg-canvas px-4 py-3 text-sm leading-relaxed placeholder:text-faint transition-[border-color,background-color,box-shadow] hover:border-line-strong focus:border-accent focus:bg-surface focus:ring-4 focus:ring-accent/12 focus:outline-none"
      />

      <div className="mt-2 flex items-center justify-between gap-3 px-1 text-[0.6875rem] text-faint">
        <span className="tabular-nums">
          {words} word{words === 1 ? "" : "s"}
        </span>
        <span aria-live="polite" className={`inline-flex items-center gap-1.5 ${status === "error" ? "text-danger" : ""}`}>
          {label ? (
            <span
              aria-hidden
              className={`size-1.5 rounded-full ${
                status === "error" ? "bg-danger" : status === "saved" ? "bg-positive" : "animate-pulse bg-faint"
              }`}
            />
          ) : null}
          {label}
        </span>
      </div>
    </section>
  );
}
