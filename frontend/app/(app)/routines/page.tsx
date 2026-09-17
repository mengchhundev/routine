import { apiGet } from "@/lib/api";
import { RoutineList } from "@/components/routines/RoutineList";
import type { RoutineResponse } from "@/types/api";

export const metadata = { title: "Routines" };

/** Routines change the day they are edited, so never serve a cached list. */
export const dynamic = "force-dynamic";

export default async function RoutinesPage() {
  const routines = await apiGet<RoutineResponse[]>("/api/v1/routines");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[1.75rem] leading-tight font-semibold sm:text-3xl">Routines</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          A routine decides once what a day should contain. Its steps become
          tasks on the days it runs — you will find them waiting on Today.
        </p>
      </header>

      <RoutineList routines={routines} />
    </div>
  );
}
