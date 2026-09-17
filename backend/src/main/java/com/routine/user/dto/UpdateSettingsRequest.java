package com.routine.user.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.time.LocalTime;

public record UpdateSettingsRequest(
        @NotNull Boolean remindersEnabled,
        @NotNull Boolean emailReminders,
        @NotNull LocalTime dailyReviewTime,
        @Min(1) @Max(7) short weekStartsOn,
        @Pattern(regexp = "light|dark|system") String theme) {
}
