import type { Progress } from "@/types/api";

/**
 * Four numbers across the top of the planner. Each says what it counts, so
 * none of them has to be taken on trust.
 *
 * <p>With nothing planned the rate shows a dash rather than 0%: a zero implies
 * a measurement was taken, and none has been.
 */
export function PlannerSummary({
  total,
  days,
  unit,
}: {
  total: Progress;
  days: { date: string; planned: number; percent: number }[];
  unit: "week" | "month";
}) {
  const active = days.filter((day) => day.planned > 0);
  const perfect = active.filter((day) => day.percent === 100).length;
  const measured = total.planned > 0;

  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-panel)] border border-line bg-line shadow-card lg:grid-cols-4">
      <Stat label="Completion" hint={`of everything planned this ${unit}`}>
        {measured ? `${total.percent}%` : "—"}
        {measured ? (
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-accent-soft"
            role="progressbar"
            aria-valuenow={total.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Completion this ${unit}`}
          >
            <div
              className={`animate-grow-right h-full rounded-full ${total.percent === 100 ? "bg-positive" : "bg-accent"}`}
              style={{ width: `${total.percent}%` }}
            />
          </div>
        ) : null}
      </Stat>

      <Stat label="Tasks done" hint="completed of planned">
        {total.completed}
        <span className="text-base font-normal text-faint"> / {total.planned}</span>
      </Stat>

      <Stat label="Active days" hint="days with something planned">
        {active.length}
        <span className="text-base font-normal text-faint"> / {days.length}</span>
      </Stat>

      <Stat label="Perfect days" hint="everything planned was done">
        {perfect}
      </Stat>
    </dl>
  );
}

function Stat({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface p-4 sm:p-5">
      <dt className="text-[0.75rem] font-medium text-muted">{label}</dt>
      <dd className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">{children}</dd>
      <dd className="mt-1 text-[0.75rem] text-faint">{hint}</dd>
    </div>
  );
}
