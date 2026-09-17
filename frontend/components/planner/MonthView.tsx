import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { formatDay, weekdayOrder } from "@/lib/dates";
import type { PlannerLayout } from "@/lib/plannerLayout";
import type { MonthDay, MonthResponse } from "@/types/api";

/** Day names for a week that starts where the user says it does. */
const NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * A month as completion rates, as a calendar or as a list of the days that had
 * something planned.
 *
 * <p>Counts, not task lists: the question a month answers is "which days did I
 * actually do the work", and thirty lists of tasks answer it worse than thirty
 * numbers. Each day links to itself on Today.
 */
export function MonthView({ month, layout }: { month: MonthResponse; layout: PlannerLayout }) {
  return layout === "card" ? <Calendar month={month} /> : <DayList month={month} />;
}

function describe(day: MonthDay) {
  return `${formatDay(day.date, { weekday: "long", month: "long", day: "numeric" })}: ${
    day.planned === 0 ? "nothing planned" : `${day.completed} of ${day.planned} done`
  }`;
}

function Calendar({ month }: { month: MonthResponse }) {
  const order = weekdayOrder(month.weekStartsOn);

  // How many blank cells before the 1st, so the month lines up under its
  // weekday headings.
  const firstWeekday = new Date(`${month.start}T00:00:00Z`).getUTCDay();
  const isoFirst = firstWeekday === 0 ? 7 : firstWeekday;
  const lead = (isoFirst - month.weekStartsOn + 7) % 7;

  return (
    <div className="card p-2 sm:p-4" role="grid" aria-label={`${month.month} calendar`}>
      <div role="row" className="grid grid-cols-7 gap-1 sm:gap-2">
        {order.map((day) => (
          <div
            key={day}
            role="columnheader"
            className="py-2 text-center text-[0.6875rem] font-semibold tracking-[0.08em] text-faint uppercase"
          >
            {NAMES[day - 1]}
          </div>
        ))}
      </div>

      <div role="rowgroup" className="grid grid-cols-7 gap-1 sm:gap-2">
        {Array.from({ length: lead }, (_, index) => (
          <div key={`lead-${index}`} aria-hidden className="rounded-xl bg-canvas/60" />
        ))}

        {month.days.map((day) => {
          const planned = day.planned > 0;
          const perfect = planned && day.percent === 100;
          const past = day.date < month.today;

          return (
            <Link
              key={day.date}
              href={`/today?date=${day.date}`}
              role="gridcell"
              aria-label={describe(day)}
              className={`group relative flex h-16 flex-col justify-between rounded-xl border p-1.5 transition-[border-color,background-color,box-shadow] duration-150 sm:h-24 sm:p-2.5 ${
                day.isToday
                  ? "border-accent/50 bg-accent-soft/50"
                  : perfect
                    ? "border-positive/25 bg-positive-soft/50 hover:border-positive/50"
                    : "border-line hover:border-line-strong hover:shadow-card"
              }`}
            >
              <span
                className={`grid size-6 place-items-center rounded-full text-[0.75rem] tabular-nums sm:size-7 sm:text-[0.8125rem] ${
                  day.isToday
                    ? "bg-accent font-semibold text-accent-ink"
                    : past && !planned
                      ? "text-faint"
                      : "font-medium text-ink"
                }`}
              >
                {Number(day.date.slice(8, 10))}
              </span>

              {planned ? (
                <span className="space-y-1.5">
                  <span className="hidden text-[0.6875rem] tabular-nums text-muted sm:block">
                    {day.completed}/{day.planned} done
                  </span>
                  {/* The fill is the day's rate. A ring or a number would make
                      thirty-one of them compete; a bar at the foot reads as a
                      shape across the month at a glance. */}
                  <span className="block h-1 overflow-hidden rounded-full bg-canvas">
                    <span
                      className={`block h-full rounded-full ${perfect ? "bg-positive" : "bg-accent"}`}
                      style={{ width: `${day.percent}%` }}
                    />
                  </span>
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Only the days that had something planned, plus today. The calendar already
 * shows every day; the list is for reading the ones that count, and thirty rows
 * of "nothing planned" would bury them.
 */
function DayList({ month }: { month: MonthResponse }) {
  const shown = month.days.filter((day) => day.planned > 0 || day.isToday);
  const hidden = month.days.length - shown.length;

  if (shown.length === 0) {
    return (
      <div className="card px-5 py-12 text-center">
        <p className="text-sm font-medium">Nothing planned this month</p>
        <p className="mt-1 text-[0.8125rem] text-muted">Days you plan tasks on will be listed here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ul className="card divide-y divide-line overflow-hidden p-0">
        {shown.map((day) => {
          const planned = day.planned > 0;
          const perfect = planned && day.percent === 100;

          return (
            <li key={day.date}>
              <Link
                href={`/today?date=${day.date}`}
                aria-label={describe(day)}
                className={`group grid grid-cols-[3rem_1fr_auto] items-center gap-4 px-4 py-3 transition-colors hover:bg-canvas sm:grid-cols-[3.5rem_1fr_6rem_auto] sm:px-5 ${
                  day.isToday ? "bg-accent-soft/35" : ""
                }`}
              >
                <span className="flex flex-col">
                  <span className="text-[0.625rem] font-semibold tracking-[0.08em] text-faint uppercase">
                    {formatDay(day.date, { weekday: "short" })}
                  </span>
                  <span
                    className={`text-xl leading-tight font-semibold tabular-nums ${day.isToday ? "text-accent" : ""}`}
                  >
                    {Number(day.date.slice(8, 10))}
                  </span>
                </span>

                <span className="min-w-0">
                  <span className="flex items-baseline gap-2 text-[0.8125rem]">
                    {planned ? (
                      <span className="font-medium tabular-nums">
                        {day.completed} of {day.planned} done
                      </span>
                    ) : (
                      <span className="text-faint">Nothing planned</span>
                    )}
                    {day.isToday ? (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[0.625rem] font-semibold text-accent-ink">
                        Today
                      </span>
                    ) : null}
                  </span>
                  {planned ? (
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-canvas sm:hidden">
                      <span
                        className={`block h-full rounded-full ${perfect ? "bg-positive" : "bg-accent"}`}
                        style={{ width: `${day.percent}%` }}
                      />
                    </span>
                  ) : null}
                </span>

                {/* On a wider screen the bar gets its own column, so the bars
                    line up down the list and read as a chart. */}
                <span className="hidden h-1.5 overflow-hidden rounded-full bg-canvas sm:block">
                  {planned ? (
                    <span
                      className={`block h-full rounded-full ${perfect ? "bg-positive" : "bg-accent"}`}
                      style={{ width: `${day.percent}%` }}
                    />
                  ) : null}
                </span>

                <span className="flex items-center gap-3">
                  <span
                    className={`w-10 text-right text-[0.8125rem] tabular-nums ${
                      perfect ? "font-medium text-positive" : "text-muted"
                    }`}
                  >
                    {planned ? `${day.percent}%` : "—"}
                  </span>
                  <ArrowRightIcon className="size-4 text-faint transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-accent" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {hidden > 0 ? (
        <p className="px-1 text-[0.75rem] text-faint">
          {hidden} day{hidden === 1 ? "" : "s"} with nothing planned not shown. Switch to cards to see the full calendar.
        </p>
      ) : null}
    </div>
  );
}
