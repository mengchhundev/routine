import { apiGet, getCurrentUser } from "@/lib/api";
import { ReminderBoard } from "@/components/reminders/ReminderBoard";
import { formatLocalStamp } from "@/lib/dates";
import type {
  GoalResponse,
  NotificationResponse,
  ReminderResponse,
  ReminderScope,
  RoutineResponse,
  SettingsResponse,
  TaskResponse,
} from "@/types/api";

export const metadata = { title: "Reminders" };

export const dynamic = "force-dynamic";

const SCOPES: ReminderScope[] = ["UPCOMING", "PAST", "ALL"];

export default async function RemindersPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const { scope } = await searchParams;
  const resolved: ReminderScope = SCOPES.includes(scope as ReminderScope)
    ? (scope as ReminderScope)
    : "UPCOMING";

  const [user, reminders, history, settings, tasks, routines, goals] = await Promise.all([
    getCurrentUser(),
    apiGet<ReminderResponse[]>(`/api/v1/reminders?scope=${resolved}`),
    apiGet<NotificationResponse[]>("/api/v1/reminders/history"),
    apiGet<SettingsResponse>("/api/v1/users/me/settings"),
    // The form's pickers. Upcoming tasks only — a reminder about something that
    // was due last month is not a thing anybody sets.
    apiGet<TaskResponse[]>("/api/v1/tasks?scope=UPCOMING"),
    apiGet<RoutineResponse[]>("/api/v1/routines"),
    apiGet<GoalResponse[]>("/api/v1/goals?status=ACTIVE"),
  ]);

  // The form opens at the next round hour in the *account's* timezone, which is
  // the clock the reminder will actually fire against.
  const now = defaultRemindAt(user.timezone);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[1.75rem] leading-tight font-semibold sm:text-3xl">Reminders</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Nudges at times you choose. Everything here fires in {user.timezone},
          the timezone on your account.
        </p>
      </header>

      <ReminderBoard
        reminders={reminders}
        scope={resolved}
        tasks={tasks}
        routines={routines}
        goals={goals}
        now={now}
        remindersEnabled={settings.remindersEnabled}
      />

      {history.length > 0 ? (
        <details className="group">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-[0.8125rem] text-faint transition-colors hover:text-muted">
            Delivery history
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

          {/* Kept because a reminder you cannot verify is a reminder you stop
              relying on — but folded away, since it is read once. */}
          <ul className="mt-2 space-y-1">
            {history.map((entry) => (
              <li key={entry.id} className="flex flex-wrap gap-x-2 text-[0.8125rem] text-muted">
                <span className="tabular-nums text-faint">
                  {formatLocalStamp(
                    new Date(entry.processedAt)
                      .toLocaleString("sv-SE", { timeZone: user.timezone })
                      .replace(" ", "T"),
                  )}
                </span>
                <span className={entry.outcome === "SENT" ? "text-positive" : "text-danger"}>
                  {entry.outcome === "SENT" ? "Sent" : "Failed"}
                </span>
                {entry.detail ? <span className="min-w-0 truncate">· {entry.detail}</span> : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

/** The next whole hour, in the given timezone, as a `datetime-local` value. */
function defaultRemindAt(timezone: string): string {
  // "sv-SE" formats as YYYY-MM-DD HH:mm — the only common locale that is
  // already ISO-shaped, which makes this a swap rather than a reassembly.
  const local = new Date(Date.now() + 60 * 60 * 1000).toLocaleString("sv-SE", { timeZone: timezone });
  return `${local.slice(0, 14)}00`;
}
