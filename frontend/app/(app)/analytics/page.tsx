import Link from "next/link";
import { apiGet } from "@/lib/api";
import { SliceBars } from "@/components/analytics/SliceBars";
import { TrendChart } from "@/components/analytics/TrendChart";
import { StatTile } from "@/components/app/StatTile";
import { ChartIcon, ListIcon, RepeatIcon } from "@/components/icons";
import type { SummaryResponse } from "@/types/api";

export const metadata = { title: "Analytics" };

export const dynamic = "force-dynamic";

const WINDOWS = [7, 30, 90, 365];

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days } = await searchParams;
  // The server clamps this anyway; picking a listed value keeps the tabs honest.
  const window = WINDOWS.includes(Number(days)) ? Number(days) : 30;

  const data = await apiGet<SummaryResponse>(`/api/v1/analytics/summary?days=${window}`);

  const best = [...data.weekdays].sort((first, second) => second.percent - first.percent)[0];

  return (
    <div className="mx-auto max-w-[110rem] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.75rem] leading-tight font-semibold sm:text-3xl">Analytics</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Whether the routines are working. Everything here is derived from
            your tasks and completions — nothing is stored separately, so this
            page can never disagree with the lists it describes.
          </p>
        </div>

        <nav aria-label="Time window" className="flex gap-1 rounded-lg bg-canvas p-0.5">
          {WINDOWS.map((option) => (
            <Link
              key={option}
              href={`/analytics?days=${option}`}
              aria-current={window === option ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-[0.8125rem] transition-colors ${
                window === option
                  ? "bg-surface font-medium text-ink shadow-card"
                  : "text-muted hover:text-ink"
              }`}
            >
              {option === 365 ? "1y" : `${option}d`}
            </Link>
          ))}
        </nav>
      </header>

      <div className="animate-rise grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={ChartIcon}
          label="Completion rate"
          value={`${data.total.percent}%`}
          foot={`${data.total.completed} of ${data.total.planned} planned tasks`}
        />
        <StatTile
          icon={RepeatIcon}
          label="Current streak"
          value={data.currentStreak}
          unit={data.currentStreak === 1 ? "day" : "days"}
          foot={`Longest in this window: ${data.longestStreak}`}
        />
        <StatTile
          icon={ListIcon}
          label="Missed"
          value={data.missedTaskCount}
          unit={data.missedTaskCount === 1 ? "task" : "tasks"}
          foot="Planned on a day that has passed, never done"
        />
        <StatTile
          icon={ChartIcon}
          label="Best day"
          value={best && best.planned > 0 ? best.label : "—"}
          foot={
            best && best.planned > 0
              ? `${best.percent}% completed on ${best.label}s`
              : "Not enough planned yet to say"
          }
        />
      </div>

      <TrendChart days={data.days} />

      <div className="grid gap-4 lg:grid-cols-3">
        <SliceBars
          heading="By category"
          description="Where the effort actually went"
          slices={data.categories}
          empty="No categories yet. Tag a few tasks and this fills in."
        />
        <SliceBars
          heading="By day of week"
          description="Which days you are reliable on"
          slices={data.weekdays}
          empty="Nothing planned in this window yet."
        />
        <SliceBars
          heading="Routine consistency"
          description="Of what each routine put on the calendar, how much got done"
          slices={data.routines.map((routine) => ({
            label: routine.active ? routine.name : `${routine.name} (paused)`,
            planned: routine.expected,
            completed: routine.completed,
            percent: routine.percent,
          }))}
          empty="No routines have generated tasks in this window."
        />
      </div>

      {data.goals.length > 0 ? (
        <section className="card p-5 sm:p-6" aria-labelledby="goals-heading">
          <h2 id="goals-heading" className="text-sm font-medium">
            Active goals
          </h2>
          <ul className="mt-4 space-y-3">
            {data.goals.map((goal) => (
              <li key={goal.goalId}>
                <div className="flex items-baseline justify-between gap-4">
                  <Link href="/goals" className="truncate text-[0.8125rem] hover:text-accent">
                    {goal.title}
                  </Link>
                  <p className="shrink-0 text-[0.6875rem] tabular-nums text-muted">
                    {goal.progress}%
                    <span className="ml-1.5 text-faint">
                      {goal.progressSource === "MILESTONES" ? "from milestones" : "your estimate"}
                    </span>
                  </p>
                </div>
                <div
                  className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-accent-soft"
                  role="progressbar"
                  aria-valuenow={goal.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${goal.title} progress`}
                >
                  <div className="h-full rounded-full bg-accent" style={{ width: `${goal.progress}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <details className="group">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-[0.8125rem] text-faint transition-colors hover:text-muted">
          How these numbers are calculated
          <svg
            viewBox="0 0 24 24"
            className="size-3.5 transition-transform group-open:rotate-180"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>
        <p className="mt-2 max-w-2xl text-[0.8125rem] leading-relaxed text-faint">
          Rates are completed ÷ planned for the day a task was <em>due</em>, in{" "}
          {data.timezone}, so catching up late credits the day the work belonged
          to rather than pushing another day past 100%. Cancelled tasks are not
          counted as planned. A streak counts consecutive days with at least one
          completion, and today only breaks it once it is over.
        </p>
      </details>
    </div>
  );
}
