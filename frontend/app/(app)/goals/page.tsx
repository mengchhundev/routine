import { apiGet, getCurrentUser } from "@/lib/api";
import { GoalBoard } from "@/components/goals/GoalBoard";
import type { GoalResponse, GoalStatus } from "@/types/api";

export const metadata = { title: "Goals" };

/** A goal's percentage moves whenever a milestone does; never serve a cache. */
export const dynamic = "force-dynamic";

const STATUSES: (GoalStatus | "ALL")[] = ["ACTIVE", "PAUSED", "COMPLETED", "ABANDONED", "ALL"];

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  // Hand-editable URL: an unknown status falls back to the useful default.
  const filter = STATUSES.includes(status as GoalStatus | "ALL")
    ? (status as GoalStatus | "ALL")
    : "ACTIVE";

  const query = filter === "ALL" ? "" : `?status=${filter}`;

  const [user, goals] = await Promise.all([
    getCurrentUser(),
    apiGet<GoalResponse[]>(`/api/v1/goals${query}`),
  ]);

  // The user's own today, not the server's — every date decision in the product
  // is made in their timezone.
  const today = new Date().toLocaleDateString("en-CA", { timeZone: user.timezone });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[1.75rem] leading-tight font-semibold sm:text-3xl">Goals</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          What you are trying to become. Break a goal into milestones and its
          percentage stops being a guess — it becomes a count of what is
          actually done.
        </p>
      </header>

      <GoalBoard goals={goals} filter={filter} today={today} />
    </div>
  );
}
