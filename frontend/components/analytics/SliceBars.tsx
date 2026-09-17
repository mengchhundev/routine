import type { SummarySlice } from "@/types/api";

/**
 * A labelled set of completion rates — categories, weekdays, routines.
 *
 * <p>One component for all three because they are the same question asked of
 * different groupings, and three near-identical charts would drift apart.
 */
export function SliceBars({
  heading,
  description,
  slices,
  empty,
}: {
  heading: string;
  description?: string;
  slices: SummarySlice[];
  empty: string;
}) {
  const withWork = slices.filter((slice) => slice.planned > 0);

  return (
    <section className="card p-5 sm:p-6" aria-labelledby={`slice-${heading}`}>
      <h2 id={`slice-${heading}`} className="text-sm font-medium">
        {heading}
      </h2>
      {description ? <p className="mt-1 text-[0.6875rem] text-faint">{description}</p> : null}

      {withWork.length === 0 ? (
        <p className="mt-4 text-sm leading-relaxed text-muted">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {withWork.map((slice) => (
            <li key={slice.label}>
              <div className="flex items-baseline justify-between gap-4">
                <p className="truncate text-[0.8125rem]">{slice.label}</p>
                <p className="shrink-0 text-[0.6875rem] tabular-nums text-muted">
                  {slice.completed}/{slice.planned} · {slice.percent}%
                </p>
              </div>
              <div
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-accent-soft"
                role="progressbar"
                aria-valuenow={slice.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${slice.label} completion`}
              >
                <div
                  className={`h-full rounded-full ${slice.percent === 100 ? "bg-positive" : "bg-accent"}`}
                  style={{ width: `${slice.percent}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
