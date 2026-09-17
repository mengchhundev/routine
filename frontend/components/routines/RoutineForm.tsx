"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, INPUT } from "@/components/form/controls";
import { createRoutine, updateRoutine, WEEKDAYS } from "@/lib/routines";
import type { RoutineDraft, RoutineResponse, ScheduleType } from "@/types/api";

const SCHEDULES: { value: ScheduleType; label: string; hint: string }[] = [
  { value: "DAILY", label: "Every day", hint: "Seven days a week" },
  { value: "WEEKDAYS", label: "Weekdays", hint: "Monday to Friday" },
  { value: "SELECTED_DAYS", label: "Selected days", hint: "Pick the days yourself" },
];

type StepDraft = { id?: string; title: string; durationMinutes: string };

function stepsFrom(routine?: RoutineResponse): StepDraft[] {
  if (!routine || routine.steps.length === 0) return [{ title: "", durationMinutes: "" }];
  return routine.steps.map((step) => ({
    id: step.id,
    title: step.title,
    durationMinutes: step.durationMinutes?.toString() ?? "",
  }));
}

/**
 * Creating and editing are the same form, because they are the same decision:
 * what this routine is, when it runs, and what it puts on the day.
 */
export function RoutineForm({
  routine,
  onDone,
}: {
  routine?: RoutineResponse;
  onDone: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(routine?.name ?? "");
  const [category, setCategory] = useState(routine?.category ?? "");
  const [startTime, setStartTime] = useState(routine?.startTime?.slice(0, 5) ?? "");
  const [type, setType] = useState<ScheduleType>(routine?.schedule?.type ?? "DAILY");
  const [days, setDays] = useState<number[]>(routine?.schedule?.daysOfWeek ?? []);
  const [steps, setSteps] = useState<StepDraft[]>(stepsFrom(routine));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsDays = type === "SELECTED_DAYS" || type === "WEEKLY";

  function setStep(index: number, patch: Partial<StepDraft>) {
    setSteps((current) => current.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const kept = steps
      .map((step) => ({ ...step, title: step.title.trim() }))
      .filter((step) => step.title.length > 0);

    if (kept.length === 0) {
      setError("A routine needs at least one step — that is what it puts on your day.");
      return;
    }
    if (needsDays && days.length === 0) {
      setError("Pick at least one day for this schedule.");
      return;
    }

    const draft: RoutineDraft = {
      name: name.trim(),
      category: category.trim() || null,
      startTime: startTime || null,
      schedule: { type, daysOfWeek: needsDays ? days : [] },
      steps: kept.map((step) => ({
        // Sending the id back is what keeps a step's identity — and the tasks
        // already generated from it — across an edit.
        id: step.id,
        title: step.title,
        durationMinutes: step.durationMinutes ? Number(step.durationMinutes) : null,
      })),
    };

    setSaving(true);
    try {
      if (routine) {
        await updateRoutine(routine.id, draft);
      } else {
        await createRoutine(draft);
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
    <form onSubmit={save} className="card animate-rise space-y-5 p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
        <Field label="Name" htmlFor="routine-name">
          <input
            id="routine-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={200}
            placeholder="Morning routine"
            className={INPUT}
          />
        </Field>

        <Field label="Category" htmlFor="routine-category" optional>
          <input
            id="routine-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            maxLength={80}
            placeholder="Health"
            className={INPUT}
          />
        </Field>

        <Field label="Starts at" htmlFor="routine-start" optional>
          <input
            id="routine-start"
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            className={`${INPUT} w-32`}
          />
        </Field>
      </div>

      <fieldset>
        <legend className="text-[0.8125rem] font-medium">When it runs</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {SCHEDULES.map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer rounded-lg border px-3 py-2.5 transition-colors ${
                type === option.value
                  ? "border-accent bg-accent-soft"
                  : "border-line hover:border-line-strong"
              }`}
            >
              <input
                type="radio"
                name="schedule"
                value={option.value}
                checked={type === option.value}
                onChange={() => setType(option.value)}
                className="sr-only"
              />
              <span className={`block text-sm ${type === option.value ? "font-medium text-accent" : ""}`}>
                {option.label}
              </span>
              <span className="mt-0.5 block text-[0.6875rem] text-muted">{option.hint}</span>
            </label>
          ))}
        </div>

        {needsDays ? (
          <div className="animate-rise mt-3 flex flex-wrap gap-1.5">
            {WEEKDAYS.map((day) => {
              const on = days.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() =>
                    setDays((current) =>
                      on ? current.filter((value) => value !== day.value) : [...current, day.value],
                    )
                  }
                  aria-pressed={on}
                  className={`h-9 w-12 rounded-lg border text-[0.8125rem] transition-colors ${
                    on
                      ? "border-accent bg-accent text-accent-ink"
                      : "border-line text-muted hover:border-line-strong hover:text-ink"
                  }`}
                >
                  {day.short}
                </button>
              );
            })}
          </div>
        ) : null}
      </fieldset>

      <fieldset>
        <legend className="text-[0.8125rem] font-medium">Steps</legend>
        <p className="mt-0.5 text-[0.6875rem] text-muted">
          Each step becomes a task on the days this routine runs. Durations are
          optional and stagger the times from the start.
        </p>

        <ul className="mt-2.5 space-y-2">
          {steps.map((step, index) => (
            <li key={step.id ?? `new-${index}`} className="flex gap-2">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-canvas text-[0.6875rem] tabular-nums text-faint">
                {index + 1}
              </span>
              <input
                value={step.title}
                onChange={(event) => setStep(index, { title: event.target.value })}
                maxLength={200}
                placeholder="Drink water"
                aria-label={`Step ${index + 1} title`}
                className={`${INPUT} flex-1`}
              />
              <input
                value={step.durationMinutes}
                onChange={(event) =>
                  setStep(index, { durationMinutes: event.target.value.replace(/\D/g, "") })
                }
                inputMode="numeric"
                placeholder="min"
                aria-label={`Step ${index + 1} duration in minutes`}
                className={`${INPUT} w-20`}
              />
              <button
                type="button"
                onClick={() => setSteps((current) => current.filter((_, i) => i !== index))}
                disabled={steps.length === 1}
                aria-label={`Remove step ${index + 1}`}
                className="grid size-9 shrink-0 place-items-center rounded-lg text-faint transition-colors hover:bg-canvas hover:text-ink disabled:pointer-events-none disabled:opacity-40"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" aria-hidden>
                  <path d="M6 6l12 12M18 6 6 18" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => setSteps((current) => [...current, { title: "", durationMinutes: "" }])}
          className="btn btn-secondary mt-2.5 px-3 py-1.5 text-[0.8125rem]"
        >
          Add step
        </button>
      </fieldset>

      {error ? (
        <p role="alert" className="text-[0.8125rem] text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2 border-t border-line pt-4">
        <button type="submit" disabled={saving} className="btn btn-primary px-4 py-2">
          {saving ? "Saving…" : routine ? "Save changes" : "Create routine"}
        </button>
        <button type="button" onClick={onDone} className="btn btn-ghost px-4 py-2">
          Cancel
        </button>
      </div>
    </form>
  );
}
