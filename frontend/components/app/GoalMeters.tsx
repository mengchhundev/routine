import type { GoalResponse } from "@/types/api";

export function GoalMeters({ goals }: { goals: GoalResponse[] }) {
  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-medium">Active goals</h2>
        {goals.length > 0 ? <p className="text-[0.8125rem] text-muted">{goals.length}</p> : null}
      </div>

      {goals.length === 0 ? (
        <p className="mt-4 text-sm leading-relaxed text-muted">
          No active goals. A goal is what the daily tasks are for — it is the
          thing that makes a routine worth keeping.
        </p>
      ) : (
        <ul className="mt-5 space-y-4">
          {goals.map((goal, index) => (
            <li key={goal.id}>
              <div className="flex items-baseline justify-between gap-4">
                <p className="truncate text-sm">{goal.title}</p>
                {/* Tabular here on purpose: these align in a column. */}
                <p className="text-xs tabular-nums text-muted">{goal.progress}%</p>
              </div>

              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-accent-soft"
                role="progressbar"
                aria-valuenow={goal.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${goal.title} progress`}
              >
                <div
                  className="animate-grow-right h-full rounded-full bg-accent"
                  style={{ width: `${goal.progress}%`, animationDelay: `${index * 90}ms` }}
                />
              </div>

              {goal.targetDate ? (
                <p className="mt-1.5 text-[0.6875rem] text-faint">
                  Target {new Date(goal.targetDate).toLocaleDateString("en-US", {
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
