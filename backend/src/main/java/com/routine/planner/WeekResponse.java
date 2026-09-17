package com.routine.planner;

import com.routine.common.Progress;
import com.routine.task.dto.TaskResponse;
import java.time.LocalDate;
import java.util.List;

/**
 * A week of the planner: seven days, each with its plan and how much of it
 * happened.
 *
 * @param weekStartsOn ISO-8601 day number the user's week begins on, so the
 *                     client lays out columns without re-deriving the setting
 * @param days         always seven, in order, including days with nothing on
 *                     them — an absent Wednesday would read as a bug
 */
public record WeekResponse(
        LocalDate start,
        LocalDate end,
        String timezone,
        LocalDate today,
        int weekStartsOn,
        List<Day> days,
        Progress total) {

    public record Day(LocalDate date, boolean isToday, Progress progress, List<TaskResponse> tasks) {}
}
