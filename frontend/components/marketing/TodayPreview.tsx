"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/* The loop rewinds the card before it replays it, and that rewind has to happen
   before the browser paints or the finished state flashes first. On the server
   there is no paint and no layout effect, so it falls back to useEffect purely
   to keep React quiet. */
const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

const TASKS = [
  { title: "Morning workout", meta: "06:45", done: true },
  { title: "Read 20 pages", meta: "08:30", done: true },
  { title: "Study Kubernetes", meta: "19:00", done: true },
  { title: "Write daily note", meta: "21:00", done: true },
  { title: "Review goals", meta: "21:30", done: false },
];

const GOALS = [
  { title: "Senior DevOps Engineer", progress: 38 },
  { title: "Fitness", progress: 62 },
  { title: "English improvement", progress: 24 },
];

const DONE_COUNT = TASKS.filter((task) => task.done).length;

/* One cycle, in milliseconds. The rewind is a single frame with transitions
   switched off — long enough for the browser to apply the zeroed widths, short
   enough that nobody sees the card empty out. */
const REWIND_MS = 60;
const START_MS = 400;
const STEP_MS = 420;
const GOALS_MS = START_MS + (DONE_COUNT + 1) * STEP_MS;
/** How long the finished day rests on screen before the loop starts over. */
const HOLD_MS = 2600;
const CYCLE_MS = GOALS_MS + 940 + HOLD_MS;

type Frame = {
  /** Tasks that should read as complete, in order. */
  checked: number;
  goalsFilled: boolean;
  /** True during the rewind, when nothing should animate back down. */
  rewinding: boolean;
};

const FINISHED: Frame = { checked: DONE_COUNT, goalsFilled: true, rewinding: false };
const EMPTY: Frame = { checked: 0, goalsFilled: false, rewinding: true };

/**
 * Runs the day on a loop for as long as the card is on screen: the tasks tick
 * off one by one, the day's progress follows them up, the goals fill last, and
 * after a pause on the finished day it rewinds and does it again — the same
 * order the product itself updates in.
 */
function useDayLoop() {
  const ref = useRef<HTMLDivElement>(null);
  // Starts finished: that is what the server renders and what a visitor without
  // JavaScript keeps, so the hero never shows an empty card.
  const [frame, setFrame] = useState<Frame>(FINISHED);

  useBeforePaint(() => {
    const node = ref.current;
    if (!node) return;

    // Reduced motion keeps the finished state rather than getting a faster or
    // shorter loop: the point of the still is the finished day, and the motion
    // is decoration on top of it.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, run: () => void) => timers.push(setTimeout(run, ms));

    const stop = () => {
      timers.forEach(clearTimeout);
      timers = [];
    };

    const play = () => {
      setFrame(EMPTY);
      // Transitions come back only once the zeroed state has been painted.
      at(REWIND_MS, () => setFrame((f) => ({ ...f, rewinding: false })));

      for (let step = 1; step <= DONE_COUNT; step += 1) {
        at(REWIND_MS + START_MS + step * STEP_MS, () =>
          setFrame((f) => ({ ...f, checked: step })),
        );
      }
      at(REWIND_MS + GOALS_MS, () => setFrame((f) => ({ ...f, goalsFilled: true })));

      // Scheduled rather than an interval, so a slow frame delays the next
      // cycle instead of stacking one on top of it.
      at(REWIND_MS + CYCLE_MS, play);
    };

    // Off-screen cycles are wasted work — and a visitor scrolling back should
    // catch the loop from the top, not halfway through.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          play();
        } else {
          stop();
          setFrame(FINISHED);
        }
      },
      { threshold: 0.35 },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      stop();
    };
  }, []);

  return { ref, ...frame };
}

/**
 * Counts a number up to `target` once `on` flips, so the goal percentages move
 * with their bars instead of snapping to the final figure. Drops straight back
 * to zero when it flips off, because the loop rewinds rather than unwinding.
 */
function useCountUp(target: number, on: boolean, duration = 700, delay = 0) {
  const [value, setValue] = useState(target);

  // Before paint, so the figure rewinds in the same frame as its bar.
  useBeforePaint(() => {
    if (!on) {
      setValue(0);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }

    let frame = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const elapsed = now - start - delay;
      if (elapsed < 0) {
        frame = requestAnimationFrame(tick);
        return;
      }
      const t = Math.min(elapsed / duration, 1);
      // Matches --ease-out-soft closely enough that bar and number stay together.
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, on, duration, delay]);

  return value;
}

/**
 * A still of the product, not a screenshot: real markup, so it stays sharp,
 * themes correctly, and cannot drift out of date the way an image would.
 * Decorative — the surrounding copy carries the meaning for screen readers.
 */
export function TodayPreview() {
  const { ref, checked, goalsFilled, rewinding } = useDayLoop();
  const percent = Math.round((checked / TASKS.length) * 100);

  return (
    // `data-rewinding` kills every transition inside the card for one frame, so
    // the jump back to an empty day is instant rather than a reverse animation.
    // A single CSS rule rather than swapping utility classes, whose precedence
    // would depend on the order Tailwind happened to emit them in.
    <div
      ref={ref}
      data-rewinding={rewinding ? "" : undefined}
      className="day-loop card overflow-hidden p-0 shadow-lift"
      aria-hidden
    >
      <div className="flex items-center gap-1.5 border-b border-line px-5 py-3.5">
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="ml-2 text-xs text-faint">Today</span>
      </div>

      <div className="space-y-6 p-5 sm:p-6">
        <div>
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium">Today&apos;s progress</p>
            <p className="text-sm font-semibold tabular-nums">{percent}%</p>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-canvas">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-500 ease-[var(--ease-out-soft)]"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        <ul className="space-y-1">
          {TASKS.map((task, index) => {
            const done = task.done && index < checked;
            return (
              <li key={task.title} className="flex items-center gap-3 rounded-lg py-1.5">
                <span
                  className={`grid size-5 shrink-0 place-items-center rounded-md border transition-[background-color,border-color] duration-200 ease-[var(--ease-out-soft)] ${
                    done
                      ? "animate-check-pop border-positive bg-positive text-white"
                      : "border-line-strong bg-transparent"
                  }`}
                >
                  {/* Kept mounted so the tick can draw itself in rather than
                      appearing whole the instant the box turns green. */}
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`size-3 transition-opacity duration-100 ${done ? "opacity-100" : "opacity-0"}`}
                  >
                    <path
                      d="m4.5 12.5 5 5 10-11"
                      pathLength={1}
                      strokeDasharray={1}
                      strokeDashoffset={done ? 0 : 1}
                      className="transition-[stroke-dashoffset] duration-300 ease-[var(--ease-out-soft)]"
                    />
                  </svg>
                </span>

                <span
                  className={`relative flex-1 text-sm transition-colors duration-300 ease-[var(--ease-out-soft)] ${
                    done ? "text-muted" : "text-ink"
                  }`}
                >
                  {task.title}
                  {/* An animated rule rather than `line-through`, which cannot
                      be transitioned — it strikes the title through as it lands. */}
                  <span
                    className="pointer-events-none absolute top-1/2 left-0 h-px bg-current transition-[width] duration-300 ease-[var(--ease-out-soft)]"
                    style={{ width: done ? "100%" : "0%" }}
                  />
                </span>

                <span className="text-xs tabular-nums text-faint">{task.meta}</span>
              </li>
            );
          })}
        </ul>

        <div className="space-y-3 border-t border-line pt-5">
          <p className="text-xs font-medium tracking-wide text-faint uppercase">Goals</p>
          {GOALS.map((goal, index) => (
            <GoalMeter
              key={goal.title}
              goal={goal}
              filled={goalsFilled}
              index={index}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function GoalMeter({
  goal,
  filled,
  index,
}: {
  goal: (typeof GOALS)[number];
  filled: boolean;
  index: number;
}) {
  const delay = index * 120;
  const shown = useCountUp(goal.progress, filled, 700, delay);

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="truncate text-sm">{goal.title}</span>
        <span className="text-xs tabular-nums text-muted">{shown}%</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-canvas">
        <div
          className="h-full rounded-full bg-accent/70 transition-[width] duration-700 ease-[var(--ease-out-soft)]"
          style={{ width: filled ? `${goal.progress}%` : "0%", transitionDelay: `${delay}ms` }}
        />
      </div>
    </div>
  );
}
