import { apiGet, getCurrentUser } from "@/lib/api";
import { FirstRun } from "@/components/app/FirstRun";
import { FirstRunGuide } from "@/components/app/FirstRunGuide";
import { StatTile } from "@/components/app/StatTile";
import { WeekChart } from "@/components/app/WeekChart";
import { GoalMeters } from "@/components/app/GoalMeters";
import { TodayTasks } from "@/components/app/TodayTasks";
import { ChartIcon, ListIcon, RepeatIcon } from "@/components/icons";
import type { DashboardResponse } from "@/types/api";

export const metadata = { title: "Dashboard" };

/** Never cache a page whose whole point is "what is true right now". */
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // One request for the whole screen: five separate calls would mean five
  // loading states and five chances for the numbers to disagree.
  const [user, data] = await Promise.all([
    getCurrentUser(),
    apiGet<DashboardResponse>("/api/v1/analytics/dashboard"),
  ]);

  const firstName = user.displayName.trim().split(/\s+/)[0];
  const greeting = greetingFor(data.timezone);
  const today = new Date(`${data.date}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // A brand-new account has nothing to measure, and measuring nothing produces
  // a screen of zeros that reads as failure rather than as a fresh start. Until
  // there is one real number, the dashboard asks for a task instead.
  const isFirstRun =
    data.today.planned === 0 &&
    data.openTaskCount === 0 &&
    data.activeGoals.length === 0 &&
    !data.week.days.some((day) => day.planned > 0);

  return (
    <div className="mx-auto max-w-[110rem] space-y-6">
      <header>
        <p className="text-sm text-muted">{today}</p>
        <h1 className="mt-1 text-[1.75rem] leading-tight font-semibold sm:text-3xl">
          {greeting}, {firstName}.
        </h1>
      </header>

      {isFirstRun ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-start">
          <FirstRun date={data.date} />
          <FirstRunGuide />
        </div>
      ) : (
        <>
          {/* Three supporting figures. The day's own rate is not among them —
              it lives on the day's task list, where it can be acted on. */}
          <div className="animate-rise grid gap-4 sm:grid-cols-3">
            <StatTile
              icon={RepeatIcon}
              label="Current streak"
              value={data.streakDays}
              unit={data.streakDays === 1 ? "day" : "days"}
              foot="Days in a row with something completed"
            />
            <StatTile
              icon={ChartIcon}
              label="Last 7 days"
              value={`${data.week.percent}%`}
              foot={`${data.week.completed} of ${data.week.planned} tasks completed`}
            />
            <StatTile
              icon={ListIcon}
              label="Still open"
              value={data.openTaskCount}
              unit={data.openTaskCount === 1 ? "task" : "tasks"}
              foot="Across every day, not just today"
            />
          </div>

          <div className="animate-rise grid gap-4 [animation-delay:90ms] lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
            <TodayTasks tasks={data.todayTasks} date={data.date} progress={data.today} />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <WeekChart days={data.week.days} today={data.date} />
              <GoalMeters goals={data.activeGoals} />
            </div>
          </div>

          {/* Kept, because a number you cannot check is a number you cannot
              trust — but folded away, since it is read once and not again. */}
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
              Rates are completed ÷ planned for the day, in {data.timezone}. A
              streak counts consecutive days with at least one completion, and
              today only breaks it once it is over.
            </p>
          </details>
        </>
      )}
    </div>
  );
}

/** Greets by the user's local hour, not the server's. */
function greetingFor(timezone: string) {
  const hour =
    Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: timezone })) % 24;
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}
