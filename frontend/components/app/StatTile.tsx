/**
 * Label · value · optional footnote. No delta: comparing to a previous period
 * needs history this product has not accumulated yet, and an invented delta is
 * worse than none.
 */
export function StatTile({
  label,
  value,
  unit,
  foot,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  unit?: string;
  foot?: string;
  /** Decorative: the label already names the figure. */
  icon?: (props: { className?: string }) => React.JSX.Element;
}) {
  // A zero is a real answer, but it is not news. Held back so a quiet week
  // does not read as a row of alarms.
  const zero = value === 0 || value === "0" || value === "0%";

  return (
    <div className="card flex flex-col p-4 sm:p-5">
      <div className="flex items-center gap-2.5">
        {Icon ? (
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
            <Icon className="size-4" />
          </span>
        ) : null}
        <p className="text-sm text-muted">{label}</p>
      </div>
      <p className={`mt-2 text-3xl font-semibold ${zero ? "text-faint" : ""}`}>
        {value}
        {unit ? <span className="ml-1 text-lg font-medium text-muted">{unit}</span> : null}
      </p>
      {/* Pushed to the bottom so the footnotes line up across tiles whose
          labels wrap to different heights. */}
      {foot ? <p className="mt-auto pt-1 text-[0.8125rem] text-faint">{foot}</p> : null}
    </div>
  );
}
