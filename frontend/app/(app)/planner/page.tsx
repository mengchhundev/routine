import { apiGet } from "@/lib/api";
import { Planner } from "@/components/planner/Planner";
import { isValidDay, isValidMonth } from "@/lib/dates";
import type { MonthResponse, WeekResponse } from "@/types/api";

export const metadata = { title: "Planner" };

/** Never cache a page whose whole point is "what is true right now". */
export const dynamic = "force-dynamic";

export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string; month?: string }>;
}) {
  const { view, date, month } = await searchParams;

  // Unparseable parameters fall back to the user's own current week or month
  // rather than erroring: these URLs are hand-editable and shared.
  if (view === "month") {
    const query = isValidMonth(month) ? `?month=${month}` : "";
    const data = await apiGet<MonthResponse>(`/api/v1/planner/month${query}`);
    return <Planner view="month" month={data} />;
  }

  const query = isValidDay(date) ? `?date=${date}` : "";
  const data = await apiGet<WeekResponse>(`/api/v1/planner/week${query}`);
  return <Planner view="week" week={data} />;
}
