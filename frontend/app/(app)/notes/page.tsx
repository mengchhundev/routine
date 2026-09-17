import { apiGet, getCurrentUser } from "@/lib/api";
import { NoteBoard } from "@/components/notes/NoteBoard";
import type { GoalResponse, NotePage } from "@/types/api";

export const metadata = { title: "Notes" };

export const dynamic = "force-dynamic";

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page } = await searchParams;

  const query = q?.trim() ?? "";
  // A hand-edited page number that is not a number is page one.
  const pageNumber = Number.isFinite(Number(page)) ? Math.max(Number(page) || 0, 0) : 0;

  const search = new URLSearchParams();
  if (query) search.set("q", query);
  if (pageNumber > 0) search.set("page", String(pageNumber));

  const [user, notes, goals] = await Promise.all([
    getCurrentUser(),
    apiGet<NotePage>(`/api/v1/notes/search?${search.toString()}`),
    // Only for naming the goal a note belongs to, and for the form's picker.
    apiGet<GoalResponse[]>("/api/v1/goals"),
  ]);

  const today = new Date().toLocaleDateString("en-CA", { timeZone: user.timezone });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[1.75rem] leading-tight font-semibold sm:text-3xl">Notes</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Everything you have written, newest first. Today&apos;s note belongs on
          Today; this is where you come back to read what you wrote.
        </p>
      </header>

      <NoteBoard page={notes} goals={goals} query={query} today={today} />
    </div>
  );
}
