package com.routine.planner;

import com.routine.common.Progress;
import java.time.LocalDate;
import java.util.List;

/**
 * A month, as a calendar of completion rates.
 *
 * <p>Counts only, no task lists: a month of tasks is a payload nobody reads,
 * and the question this view answers — which days did I actually do the work —
 * is answered by the numbers. Clicking a day goes to Today.
 *
 * @param month     {@code YYYY-MM}
 * @param activeDays days that had at least one task planned, which is the
 *                   denominator the summary line should use — a month is not
 *                   30% done because you took weekends off
 */
public record MonthResponse(
        String month,
        LocalDate start,
        LocalDate end,
        String timezone,
        LocalDate today,
        int weekStartsOn,
        List<Day> days,
        Progress total,
        int activeDays) {

    public record Day(LocalDate date, boolean isToday, int planned, int completed, int percent) {}
}
