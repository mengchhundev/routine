package com.routine.analytics;

import com.routine.common.Progress;
import com.routine.goal.GoalResponse;
import com.routine.task.dto.TaskResponse;
import java.time.LocalDate;
import java.util.List;

/**
 * Everything the dashboard renders, in one round trip. The alternative — five
 * calls the page has to stitch together — turns one screen into five loading
 * states and five chances to disagree with each other.
 */
public record DashboardResponse(
        LocalDate date,
        String timezone,
        Progress today,
        /** Consecutive days, ending today or yesterday, with at least one completion. */
        int streakDays,
        Week week,
        List<TaskResponse> todayTasks,
        List<GoalResponse> activeGoals,
        int openTaskCount) {


    public record Day(LocalDate date, int planned, int completed, int percent) {}

    /** A rolling seven days ending today — not a calendar week, which would
     *  show a nearly empty chart every Monday morning. */
    public record Week(List<Day> days, int planned, int completed, int percent) {}
}
