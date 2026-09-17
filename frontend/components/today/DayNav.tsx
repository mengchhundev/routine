import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { formatDay, shiftDay } from "@/lib/dates";

/**
 * Moving between days is the spine of this screen: a plan you cannot look back
 * at is a plan you cannot learn from. Links rather than buttons, so each day is
 * a real URL that can be shared, bookmarked and reached with the back button.
 */
export function DayNav({ date, isToday }: { date: string; isToday: boolean }) {
  const previous = shiftDay(date, -1);
  const next = shiftDay(date, 1);

  const step = "grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink";

  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <p className="text-[0.8125rem] font-medium text-muted">
          {formatDay(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </p>
        <h1 className="mt-1 text-[1.75rem] leading-tight font-semibold sm:text-3xl">
          {isToday ? "Today" : formatDay(date, { weekday: "long" })}
        </h1>
      </div>

      <nav aria-label="Change day" className="flex items-center gap-0.5 rounded-lg border border-line bg-canvas p-0.5">
        <Link
          href={`/today?date=${previous}`}
          aria-label={`Previous day, ${formatDay(previous, { month: "long", day: "numeric" })}`}
          className={step}
        >
          <ChevronLeftIcon className="size-4" />
        </Link>

        {/* No date parameter at all: the API resolves the user's own today,
            which the browser cannot be trusted to know. */}
        <Link
          href="/today"
          aria-current={isToday ? "page" : undefined}
          className={`rounded-md px-2.5 py-1.5 text-[0.8125rem] font-medium transition-colors ${
            isToday ? "bg-surface text-ink shadow-card" : "text-muted hover:bg-surface hover:text-ink"
          }`}
        >
          Today
        </Link>

        <Link
          href={`/today?date=${next}`}
          aria-label={`Next day, ${formatDay(next, { month: "long", day: "numeric" })}`}
          className={step}
        >
          <ChevronRightIcon className="size-4" />
        </Link>
      </nav>
    </header>
  );
}
