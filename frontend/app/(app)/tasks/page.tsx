import { apiGet, getCurrentUser } from "@/lib/api";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import type { TaskResponse, TaskScope } from "@/types/api";

export const metadata = { title: "Tasks" };

/** Never cache a list whose whole point is what is true right now. */
export const dynamic = "force-dynamic";

const SCOPES: TaskScope[] = ["ALL", "OVERDUE", "UPCOMING", "BACKLOG", "DONE"];

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; q?: string }>;
}) {
  const { scope, q } = await searchParams;

  // The scope comes from a hand-editable URL, so an unknown one falls back to
  // the useful default rather than erroring.
  const resolved: TaskScope = SCOPES.includes(scope as TaskScope) ? (scope as TaskScope) : "UPCOMING";
  const query = q?.trim() ?? "";

  const search = new URLSearchParams({ scope: resolved });
  if (query) search.set("q", query);

  const [user, tasks] = await Promise.all([
    getCurrentUser(),
    apiGet<TaskResponse[]>(`/api/v1/tasks?${search.toString()}`),
  ]);

  // The user's own today, not the server's — every date decision in the product
  // is made in their timezone.
  const today = new Date().toLocaleDateString("en-CA", { timeZone: user.timezone });

  return <TaskBoard tasks={tasks} scope={resolved} query={query} today={today} />;
}
