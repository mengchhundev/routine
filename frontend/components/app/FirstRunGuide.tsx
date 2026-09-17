import {
  ArrowRightIcon,
  ChartIcon,
  ListIcon,
  NoteIcon,
  RepeatIcon,
  SunIcon,
  TargetIcon,
} from "@/components/icons";

/**
 * What the empty tiles would have said if they had anything to report. Written
 * out rather than rendered as a row of zeros: a zero implies a measurement was
 * taken, and on day one none has been.
 */
const UNLOCKS = [
  {
    icon: SunIcon,
    title: "Today's rate",
    body: "Completed ÷ planned, moving the moment you tick a box.",
  },
  {
    icon: RepeatIcon,
    title: "Your streak",
    body: "Consecutive days with at least one thing finished.",
  },
  {
    icon: ChartIcon,
    title: "The last 7 days",
    body: "One bar per day, so a pattern shows before you feel it.",
  },
  {
    icon: TargetIcon,
    title: "Goal progress",
    body: "What the daily tasks are quietly adding up to.",
  },
];

/** The chain the product is built around, stated once where it applies. */
const LOOP = [
  { icon: TargetIcon, label: "Goal" },
  { icon: RepeatIcon, label: "Routine" },
  { icon: ListIcon, label: "Today's task" },
  { icon: NoteIcon, label: "Reflection" },
];

export function FirstRunGuide() {
  return (
    <div className="animate-rise space-y-4 [animation-delay:100ms]">
      <section className="card p-5 sm:p-6" aria-labelledby="unlocks-heading">
        <h2 id="unlocks-heading" className="text-sm font-medium">
          What fills in as you go
        </h2>

        <ul className="mt-4 space-y-4">
          {UNLOCKS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                <Icon className="size-[18px]" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{title}</p>
                <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-5 sm:p-6" aria-labelledby="loop-heading">
        <h2 id="loop-heading" className="text-sm font-medium">
          The loop
        </h2>
        <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">
          Every part of Routine is one link in this chain.
        </p>

        <ol className="mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-2">
          {LOOP.map(({ icon: Icon, label }, index) => (
            <li key={label} className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-[0.8125rem]">
                <Icon className="size-4 text-accent" />
                {label}
              </span>
              {index < LOOP.length - 1 ? (
                <ArrowRightIcon className="size-3.5 shrink-0 text-faint" />
              ) : null}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
