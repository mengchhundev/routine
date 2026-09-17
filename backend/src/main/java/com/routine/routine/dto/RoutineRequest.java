package com.routine.routine.dto;

import com.routine.routine.ScheduleType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

/**
 * A routine, its recurrence and its steps, written in one request.
 *
 * <p>The three are edited together because they are meaningless apart: a
 * routine with no schedule generates nothing, and a schedule with no steps
 * generates nothing to do.
 */
public record RoutineRequest(
        @NotBlank @Size(max = 200) String name,
        @Size(max = 5000) String description,
        @Size(max = 80) String category,
        UUID goalId,
        LocalTime startTime,
        LocalTime endTime,
        /** Null leaves the current state alone; a new routine defaults to active. */
        Boolean active,
        @NotNull @Valid ScheduleRequest schedule,
        @Valid List<StepRequest> steps) {

    /**
     * One schedule per routine. The table permits several — a routine that runs
     * mornings and evenings, one day — but nothing in the product asks for that
     * yet, and one is far easier to explain in a form.
     */
    public record ScheduleRequest(
            @NotNull ScheduleType type,
            /** ISO-8601 day numbers, 1 = Monday .. 7 = Sunday. */
            List<@Min(1) @Max(7) Short> daysOfWeek,
            /** Defaults to today in the user's timezone. */
            LocalDate startDate,
            LocalDate endDate) {
    }

    /**
     * @param id the step being edited, or null for a new one. Sending it back is
     *           what keeps a step's identity across an edit — and with it the
     *           link from every task already generated from that step.
     */
    public record StepRequest(
            UUID id,
            @NotBlank @Size(max = 200) String title,
            @Size(max = 5000) String description,
            @Positive Integer durationMinutes) {
    }
}
