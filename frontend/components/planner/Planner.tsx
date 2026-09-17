"use client";

import { useState } from "react";
import { GridIcon, ListIcon } from "@/components/icons";
import { LayoutToggle, type LayoutOption } from "@/components/LayoutToggle";
import { MonthView } from "@/components/planner/MonthView";
import { PlannerNav, monthLabel, weekLabel } from "@/components/planner/PlannerNav";
import { PlannerSummary } from "@/components/planner/PlannerSummary";
import { WeekView } from "@/components/planner/WeekView";
import { monthOf } from "@/lib/dates";
import {
  DEFAULT_PLANNER_LAYOUT,
  readPlannerLayout,
  writePlannerLayout,
  type PlannerLayout,
} from "@/lib/plannerLayout";
import { useBeforePaint } from "@/lib/useBeforePaint";
import type { MonthResponse, WeekResponse } from "@/types/api";

const LAYOUT_OPTIONS: LayoutOption<PlannerLayout>[] = [
  { value: "card", label: "Card", icon: GridIcon },
  { value: "list", label: "List", icon: ListIcon },
];

type Props = { view: "week"; week: WeekResponse } | { view: "month"; month: MonthResponse };

/**
 * The planner screen. A client component only because the card/list choice is
 * the reader's and lives in their browser; the data itself is fetched by the
 * page on the server.
 */
export function Planner(props: Props) {
  const [layout, setLayout] = useState<PlannerLayout>(DEFAULT_PLANNER_LAYOUT);

  // The stored choice lands before the first paint, so the default never
  // flashes into the reader's own.
  useBeforePaint(() => setLayout(readPlannerLayout()), []);

  function chooseLayout(next: PlannerLayout) {
    setLayout(next);
    writePlannerLayout(next);
  }

  const toggle = (
    <LayoutToggle
      label="Planner layout"
      options={LAYOUT_OPTIONS}
      value={layout}
      onChange={chooseLayout}
      className="border border-line"
    />
  );

  if (props.view === "month") {
    const { month } = props;

    return (
      <div className="space-y-6">
        <PlannerNav view="month" weekStart={month.today} month={month.month} label={monthLabel(month.month)}>
          {toggle}
        </PlannerNav>
        <PlannerSummary total={month.total} days={month.days} unit="month" />
        <MonthView month={month} layout={layout} />
      </div>
    );
  }

  const { week } = props;

  return (
    <div className="space-y-6">
      <PlannerNav
        view="week"
        weekStart={week.start}
        month={monthOf(week.start)}
        label={weekLabel(week.start, week.end)}
      >
        {toggle}
      </PlannerNav>
      <PlannerSummary
        total={week.total}
        days={week.days.map((day) => ({ ...day.progress, date: day.date }))}
        unit="week"
      />
      <WeekView week={week} layout={layout} />
    </div>
  );
}
