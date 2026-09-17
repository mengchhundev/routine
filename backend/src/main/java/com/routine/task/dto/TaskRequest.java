package com.routine.task.dto;

import com.routine.task.TaskPriority;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public record TaskRequest(
        @NotBlank @Size(max = 200) String title,
        @Size(max = 5000) String description,
        @Size(max = 80) String category,
        TaskPriority priority,
        /** The user's local calendar day. Null means an unscheduled backlog task. */
        LocalDate dueDate,
        LocalTime dueTime,
        UUID goalId,
        UUID routineId) {
}
