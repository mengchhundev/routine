import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { formatDay, formatMonth, shiftDay, shiftMonth } from "@/lib/dates";

/**
 * The planner's heading and toolbar: where you are, how to move, and which
 * horizon you are looking at.
 *
 * <p>Position and horizon live in the URL rather than component state, so a
 * week can be linked to, bookmarked and reloaded — the same decision the Today
 * screen made. `children` is the slot for controls that are not about position,
 * such as the layout toggle.
 */
export function PlannerNav({
  view,
  weekStart,
  month,
  label,
  children,
}: {
  view: "week" | "month";
  weekStart: string;
  month: string;
  label: string;
  children?: React.ReactNode;
}) {
  const previous =
    view === "week"
      ? `/planner?view=week&date=${shiftDay(weekStart, -7)}`
      : `/planner?view=month&month=${shiftMonth(month, -1)}`;

  const next =
    view === "week"
      ? `/planner?view=week&date=${shiftDay(weekStart, 7)}`
      : `/planner?view=month&month=${shiftMonth(month, 1)}`;

  const step = "grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink";

  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div>
        <p className="text-[0.8125rem] font-medium text-muted">Planner</p>
        <h1 className="mt-1 text-[1.75rem] leading-tight font-semibold sm:text-3xl">{label}</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5 rounded-lg border border-line bg-canvas p-0.5">
          <Link href={previous} aria-label={`Previous ${view}`} className={step}>
            <ChevronLeftIcon className="size-4" />
          </Link>
          {/* The way back from wherever browsing has gone. It carries no date,
              so the server answers with the user's own today. */}
          <Link
            href={`/planner?view=${view}`}
            className="rounded-md px-2.5 py-1.5 text-[0.8125rem] font-medium text-muted transition-colors hover:bg-surface hover:text-ink"
          >
            {view === "week" ? "This week" : "This month"}
          </Link>
          <Link href={next} aria-label={`Next ${view}`} className={step}>
            <ChevronRightIcon className="size-4" />
          </Link>
        </div>

        <nav aria-label="Planner horizon" className="flex gap-0.5 rounded-lg border border-line bg-canvas p-0.5">
          {(["week", "month"] as const).map((option) => (
            <Link
              key={option}
              href={
                option === "week"
                  ? `/planner?view=week&date=${weekStart}`
                  : `/planner?view=month&month=${month}`
              }
              aria-current={view === option ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-[0.8125rem] capitalize transition-colors ${
                view === option ? "bg-surface font-medium text-ink shadow-card" : "text-muted hover:text-ink"
              }`}
            >
              {option}
            </Link>
          ))}
        </nav>

        {children}
      </div>
    </header>
  );
}

/** The heading a week gets: "March 3 – 9" or "Mar 30 – Apr 5". */
export function weekLabel(start: string, end: string): string {
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  return sameMonth
    ? `${formatDay(start, { month: "long", day: "numeric" })} – ${formatDay(end, { day: "numeric" })}`
    : `${formatDay(start, { month: "short", day: "numeric" })} – ${formatDay(end, { month: "short", day: "numeric" })}`;
}

export function monthLabel(month: string): string {
  return formatMonth(month, { month: "long", year: "numeric" });
}
