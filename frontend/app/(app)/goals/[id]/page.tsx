import Link from "next/link";
import { notFound } from "next/navigation";
import { apiGet, ApiError, getCurrentUser } from "@/lib/api";
import { GoalDetail } from "@/components/goals/GoalDetail";
import type { GoalResponse } from "@/types/api";

/** A goal's percentage moves whenever a milestone does; never serve a cache. */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const goal = await apiGet<GoalResponse>(`/api/v1/goals/${id}`);
    return { title: goal.title };
  } catch {
    return { title: "Goal" };
  }
}

export default async function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let goal: GoalResponse;
  try {
    goal = await apiGet<GoalResponse>(`/api/v1/goals/${id}`);
  } catch (error) {
    // A goal belonging to someone else answers 404, not 403, so a guessed id
    // cannot confirm that it exists. Render the same page either way.
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  const user = await getCurrentUser();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: user.timezone });

  return (
    // Full-bleed, like every other screen in the shell. The prose inside keeps
    // its own reading measure, so the page can use the width without the
    // sentences stretching to it.
    <div className="space-y-6">
      <Link
        href="/goals"
        className="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted transition-colors hover:text-ink"
      >
        ← Goals
      </Link>

      <GoalDetail goal={goal} today={today} />
    </div>
  );
}
