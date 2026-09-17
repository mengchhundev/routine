import { apiGet } from "@/lib/api";
import { isValidDay } from "@/lib/dates";
import { DayNav } from "@/components/today/DayNav";
import { DayTasks } from "@/components/today/DayTasks";
import { DailyNote } from "@/components/today/DailyNote";
import { PanelBoard } from "@/components/today/PanelBoard";
import type { DayResponse } from "@/types/api";

export const metadata = { title: "Today" };

/** Never cache a page whose whole point is "what is true right now". */
export const dynamic = "force-dynamic";

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;

  // An unparseable ?date= falls back to the user's today rather than erroring:
  // the URL is hand-editable and the sane day is always one request away.
  const query = isValidDay(date) ? `?date=${date}` : "";
  const day = await apiGet<DayResponse>(`/api/v1/planner/day${query}`);

  return (
    <div className="space-y-6">
      <DayNav date={day.date} isToday={day.isToday} />

      {/* The arrangement is the reader's, not this file's. The default puts the
          plan in the wide column with the note beside it.

          `key` on the date so switching days resets the optimistic and draft
          state inside these clients instead of carrying it across. */}
      <PanelBoard
        panels={{
          tasks: (
            <DayTasks
              key={`tasks-${day.date}`}
              tasks={day.tasks}
              date={day.date}
              progress={day.progress}
            />
          ),
          note: <DailyNote key={`note-${day.date}`} note={day.note} date={day.date} />,
        }}
      />
    </div>
  );
}
