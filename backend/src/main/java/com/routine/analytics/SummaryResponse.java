package com.routine.analytics;

import com.routine.common.Progress;
import java.time.LocalDate;
import java.util.List;

/**
 * The Analytics screen: a window of days, and the handful of cuts through it
 * that answer "am I becoming better over time".
 *
 * <p>Deliberately short. The proposal warns against turning the MVP into an
 * analytics platform, and every extra chart here is one more thing to read
 * instead of one more task done.
 *
 * @param days              per-day rates, oldest first — the trend line
 * @param categories        where the effort actually went
 * @param weekdays          seven rows, Monday first, for "when am I reliable"
 * @param routines          consistency per routine: the promise versus the record
 * @param missedTaskCount   past-due tasks still open, plus ones skipped in the window
 * @param currentStreak     consecutive days, ending today or yesterday, with a completion
 * @param longestStreak     the best run inside the window
 */
public record SummaryResponse(
        LocalDate start,
        LocalDate end,
        String timezone,
        int dayCount,
        Progress total,
        List<DayPoint> days,
        List<Slice> categories,
        List<Slice> weekdays,
        List<RoutineConsistency> routines,
        int missedTaskCount,
        int currentStreak,
        int longestStreak,
        List<GoalPoint> goals) {

    public record DayPoint(LocalDate date, int planned, int completed, int percent) {}

    /** A named cut of the window: a category, or a day of the week. */
    public record Slice(String label, int planned, int completed, int percent) {}

    /**
     * @param expected how many task-days the routine should have produced
     * @param completed how many were actually completed
     */
    public record RoutineConsistency(
            java.util.UUID routineId,
            String name,
            boolean active,
            int expected,
            int completed,
            int percent) {}

    public record GoalPoint(java.util.UUID goalId, String title, int progress, String progressSource) {}
}
