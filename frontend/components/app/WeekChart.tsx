import type { DayProgress } from "@/types/api";

const PLOT_HEIGHT = 104;

/**
 * Completion rate across a rolling seven days. One series, so no legend — the
 * heading says what is plotted. Today is emphasised; the other days are the
 * same hue held back, which keeps colour meaning one thing (completion) rather
 * than encoding rank.
 */
export function WeekChart({ days, today }: { days: DayProgress[]; today: string }) {
  const hasAnything = days.some((day) => day.planned > 0);

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-medium">Last 7 days</h2>
        <p className="text-[0.8125rem] text-muted">completion rate</p>
      </div>

      {hasAnything ? (
        <>
          <div className="mt-5 flex items-end gap-1.5 sm:gap-2" style={{ height: PLOT_HEIGHT }}>
            {days.map((day, index) => (
              <Column key={day.date} day={day} isToday={day.date === today} index={index} />
            ))}
          </div>

          <div className="mt-2 flex gap-1.5 sm:gap-2">
            {days.map((day) => (
              <p
                key={day.date}
                className={`flex-1 text-center text-[0.6875rem] ${
                  day.date === today ? "font-semibold text-ink" : "text-faint"
                }`}
              >
                {weekdayLetter(day.date)}
              </p>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-muted">
          No tasks in the last seven days. Once you plan a day, its bar appears here.
        </p>
      )}

      {/* The table is the non-visual route to the same numbers, so nothing in
          this chart is gated behind seeing colour or shape. */}
      <table className="sr-only">
        <caption>Completion rate for the last seven days</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Completed</th>
            <th scope="col">Planned</th>
            <th scope="col">Rate</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.date}>
              <th scope="row">{day.date}</th>
              <td>{day.completed}</td>
              <td>{day.planned}</td>
              <td>{day.planned === 0 ? "no tasks planned" : `${day.percent}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Column({ day, isToday, index }: { day: DayProgress; isToday: boolean; index: number }) {
  const empty = day.planned === 0;
  // A visible sliver for a planned-but-untouched day, so "0% done" still reads
  // as a bar rather than vanishing into the track.
  const fill = empty ? 0 : Math.max(day.percent, 3);

  return (
    <div className="group relative flex h-full flex-1 flex-col justify-end">
      <div className="relative mx-auto flex h-full w-full max-w-6 flex-col justify-end">
        {/* A lighter step of the fill's own ramp, not the page colour: on a
            dark surface the canvas is darker than the card, so the unfilled
            part read as a hole punched through it rather than as a track. */}
        <div className="absolute inset-0 rounded-t bg-accent-soft" />
        {!empty ? (
          <div
            className={`animate-grow-up relative rounded-t transition-[height] duration-500 ease-out ${
              isToday ? "bg-accent" : "bg-accent/40"
            }`}
            // Left to right, so the week reads in the order it happened.
            style={{ height: `${fill}%`, animationDelay: `${index * 60}ms` }}
          />
        ) : null}
      </div>

      {/* Hover layer: an HTML chart is interactive, so every mark answers for
          itself rather than sending the reader to the table. */}
      <div
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-center shadow-lift group-hover:block"
      >
        <p className="text-[0.6875rem] whitespace-nowrap text-muted">{formatDay(day.date)}</p>
        <p className="text-xs font-medium whitespace-nowrap">
          {empty ? "No tasks planned" : `${day.completed} of ${day.planned} · ${day.percent}%`}
        </p>
      </div>
    </div>
  );
}

/** Parsed as a plain calendar date — these are local days, not instants. */
function asDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function weekdayLetter(iso: string) {
  return asDate(iso).toLocaleDateString("en-US", { weekday: "narrow" });
}

function formatDay(iso: string) {
  return asDate(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
