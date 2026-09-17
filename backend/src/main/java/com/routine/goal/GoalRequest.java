package com.routine.goal;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record GoalRequest(
        @NotBlank @Size(max = 200) String title,
        @Size(max = 5000) String description,
        @Size(max = 80) String category,
        LocalDate startDate,
        LocalDate targetDate,
        GoalStatus status,
        /** Manual in the MVP; derived from milestones once those exist. */
        @Min(0) @Max(100) Short progress) {
}
