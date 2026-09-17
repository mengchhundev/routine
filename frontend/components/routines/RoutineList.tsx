"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RoutineForm } from "@/components/routines/RoutineForm";
import { deleteRoutine, describeSchedule, setRoutineActive } from "@/lib/routines";
import { RepeatIcon } from "@/components/icons";
import type { RoutineResponse } from "@/types/api";

export function RoutineList({ routines }: { routines: RoutineResponse[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(run: () => Promise<unknown>) {
    setError(null);
    try {
      await run();
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "That did not work. Try again.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {routines.length === 0
            ? "No routines yet."
            : `${routines.length} routine${routines.length === 1 ? "" : "s"}`}
        </p>
        {!creating ? (
          <button type="button" onClick={() => setCreating(true)} className="btn btn-primary px-4 py-2">
            New routine
          </button>
        ) : null}
      </div>

      {creating ? <RoutineForm onDone={() => setCreating(false)} /> : null}

      {error ? (
        <p role="alert" className="text-[0.8125rem] text-danger">
          {error}
        </p>
      ) : null}

      {routines.length === 0 && !creating ? (
        <div className="card animate-rise p-6 text-center sm:p-10">
          <span className="mx-auto grid size-11 place-items-center rounded-xl bg-accent-soft text-accent">
            <RepeatIcon className="size-5" />
          </span>
          <h2 className="mt-4 text-lg font-semibold">Define it once. It shows up every day.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
            A routine is a short list of steps and the days it runs on. Routine
            puts those steps on your day for you, so the deciding happens once
            rather than every morning.
          </p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="btn btn-primary mt-5 px-4 py-2"
          >
            Create your first routine
          </button>
        </div>
      ) : null}

      <ul className="space-y-3">
        {routines.map((routine) => (
          <li key={routine.id}>
            {editing === routine.id ? (
              <RoutineForm routine={routine} onDone={() => setEditing(null)} />
            ) : (
              <article className={`card p-5 transition-opacity ${routine.active ? "" : "opacity-65"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-medium">{routine.name}</h2>
                      {!routine.active ? (
                        <span className="rounded-full bg-canvas px-2 py-0.5 text-[0.6875rem] text-muted">
                          Paused
                        </span>
                      ) : null}
                      {routine.category ? (
                        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[0.6875rem] text-accent">
                          {routine.category}
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-1 text-[0.8125rem] text-muted">
                      {describeSchedule(routine.schedule)}
                      {routine.startTime ? ` · from ${routine.startTime.slice(0, 5)}` : ""}
                      {` · ${routine.steps.length} step${routine.steps.length === 1 ? "" : "s"}`}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => act(() => setRoutineActive(routine.id, !routine.active))}
                      className="btn btn-ghost px-2.5 py-1.5 text-[0.8125rem]"
                    >
                      {routine.active ? "Pause" : "Resume"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(routine.id)}
                      className="btn btn-ghost px-2.5 py-1.5 text-[0.8125rem]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => act(() => deleteRoutine(routine.id))}
                      className="btn btn-ghost px-2.5 py-1.5 text-[0.8125rem] hover:text-danger"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {routine.steps.length > 0 ? (
                  <ol className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
                    {routine.steps.map((step) => (
                      <li
                        key={step.id}
                        className="rounded-lg border border-line px-2.5 py-1 text-[0.8125rem] text-muted"
                      >
                        {step.title}
                        {step.durationMinutes ? (
                          <span className="ml-1.5 text-faint">{step.durationMinutes}m</span>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                ) : null}
              </article>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
