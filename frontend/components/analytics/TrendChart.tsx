import { formatDay } from "@/lib/dates";
import type { DayProgress } from "@/types/api";

/**
 * Daily completion over the window.
 *
 * <p>Bars rather than a line: the gaps matter. A line drawn through days with
 * nothing planned implies a rate on days that never had one, and the honest
 * picture of a month includes the days you did not show up.
 */
export function TrendChart({ days }: { days: DayProgress[] }) {
  const planned = days.some((day) => day.planned > 0);

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="trend-heading">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="trend-heading" className="text-sm font-medium">
          Daily completion
        </h2>
        <p className="text-[0.8125rem] text-muted">{days.length} days</p>
      </div>

      {!planned ? (
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Nothing planned in this window yet. The chart fills in as days go by.
        </p>
      ) : (
        <>
          <div className="mt-5 flex h-32 items-end gap-px" role="img" aria-label="Daily completion rate">
            {days.map((day) => (
              <div key={day.date} className="group relative flex-1" title={tooltip(day)}>
                {/* A day with nothing planned is drawn as an empty track, not a
                    zero bar: "no plan" and "planned and missed" are different
                    days and should not look the same. */}
                <div className="flex h-32 items-end">
                  <div
                    className={`w-full rounded-sm transition-colors ${
                      day.planned === 0
                        ? "h-px bg-line"
                        : day.percent === 100
                          ? "bg-positive"
                          : "bg-accent"
                    }`}
                    style={day.planned === 0 ? undefined : { height: `${Math.max(day.percent, 3)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-2 flex justify-between text-[0.6875rem] text-faint">
            <span>{formatDay(days[0].date, { month: "short", day: "numeric" })}</span>
            <span>{formatDay(days[days.length - 1].date, { month: "short", day: "numeric" })}</span>
          </div>
        </>
      )}
    </section>
  );
}

function tooltip(day: DayProgress): string {
  const date = formatDay(day.date, { weekday: "short", month: "short", day: "numeric" });
  return day.planned === 0 ? `${date}: nothing planned` : `${date}: ${day.completed}/${day.planned}`;
}
